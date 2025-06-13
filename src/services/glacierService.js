import { 
  S3Client, 
  HeadObjectCommand, 
  RestoreObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";

// Initialize S3 client
const s3Client = new S3Client({
  region: import.meta.env.VITE_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_SECRET_KEY
  },
  forcePathStyle: false
});

// Constants for restoration tiers
export const GLACIER_RETRIEVAL_TIERS = {
  Expedited: { 
    time: '1-5 minutes', 
    costPerGB: 0.03,
    description: 'Fastest retrieval option, typically completes within 1-5 minutes. Higher cost but best for urgent needs.'
  },
  Standard: { 
    time: '3-5 hours', 
    costPerGB: 0.01,
    description: 'Standard retrieval typically completes within 3-5 hours. Balanced option for most use cases.'
  },
  Bulk: { 
    time: '5-12 hours', 
    costPerGB: 0.0025,
    description: 'Lowest cost option, typically completes within 5-12 hours. Best for planned, non-urgent retrievals.'
  }
};

/**
 * Check if an object is in Glacier storage and get its restore status
 * @param {string} key - Object key in S3
 * @returns {Object} Object with Glacier status information
 */
export const checkGlacierStatus = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key
    });
    
    const response = await s3Client.send(command);
    
    const isGlacier = 
      response.StorageClass === 'GLACIER' || 
      response.StorageClass === 'DEEP_ARCHIVE';
    
    let restoreStatus = null;
    
    if (isGlacier && response.Restore) {
      // Parse the restore status from the Restore header
      // Example: "ongoing-request="false", expiry-date="Fri, 23 Dec 2023 00:00:00 GMT""
      const ongoingMatch = response.Restore.match(/ongoing-request="([^"]+)"/);
      const expiryMatch = response.Restore.match(/expiry-date="([^"]+)"/);
      
      restoreStatus = {
        ongoingRequest: ongoingMatch ? ongoingMatch[1] === 'true' : null,
        expiryDate: expiryMatch ? new Date(expiryMatch[1]) : null,
        isReady: ongoingMatch && ongoingMatch[1] === 'false'
      };
    }
    
    return {
      key,
      isGlacier,
      storageClass: response.StorageClass,
      restoreStatus,
      size: response.ContentLength,
      lastModified: response.LastModified
    };
  } catch (error) {
    console.error('Error checking Glacier status:', error);
    throw error;
  }
};

/**
 * Initiate restoration of a Glacier object with progress tracking
 * @param {string} key - Object key in S3
 * @param {string} tier - Retrieval tier: 'Expedited', 'Standard', or 'Bulk'
 * @param {Object} transferContext - Optional transfer context for tracking progress
 * @returns {Object} Result of the restoration request
 */
export const restoreFromGlacier = async (key, tier = 'Standard', transferContext = null) => {
  try {
    // First check the current status
    const statusCheck = await checkGlacierStatus(key);
    
    // If it's already being restored or is ready, just return the current status
    if (statusCheck.restoreStatus?.ongoingRequest === true) {
      return { 
        message: 'Restoration already in progress',
        status: 'in_progress',
        key
      };
    }
    
    if (statusCheck.restoreStatus?.isReady) {
      return {
        message: 'Object is already restored and available',
        status: 'completed',
        key
      };
    }
    
    // Get the file name from the key
    const fileName = key.split('/').pop();
    
    // Create a transfer for tracking if context is provided
    let transferId = null;
    if (transferContext) {
      transferId = transferContext.addTransfer({
        name: fileName,
        type: 'restore',
        size: statusCheck.size || 0,
        status: 'initiating'
      });
    }
    
    // Initiate the restore
    const command = new RestoreObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key,
      RestoreRequest: {
        Days: 7, // Number of days to keep the restored copy available
        GlacierJobParameters: {
          Tier: tier
        }
      }
    });
    
    await s3Client.send(command);
    
    // Update the transfer
    if (transferContext && transferId) {
      transferContext.updateTransfer(transferId, {
        status: 'in_progress',
        progress: 5, // Initial progress to show something is happening
        estimatedTime: GLACIER_RETRIEVAL_TIERS[tier].time,
        tier
      });
      
      // Set up a polling mechanism to periodically check the status
      const checkInterval = setInterval(async () => {
        try {
          const currentStatus = await checkGlacierStatus(key);
          
          if (currentStatus.restoreStatus?.isReady) {
            // Restoration is complete
            transferContext.completeTransfer(transferId);
            clearInterval(checkInterval);
          } else if (currentStatus.restoreStatus?.ongoingRequest === true) {
            // Still in progress, update with estimated progress
            // Note: We don't get actual progress from AWS, so we'll simulate it
            transferContext.updateTransfer(transferId, {
              progress: Math.min(95, transferContext.transfers.find(t => t.id === transferId)?.progress + 5 || 10)
            });
          } else if (!currentStatus.isGlacier) {
            // No longer in Glacier, must be complete
            transferContext.completeTransfer(transferId);
            clearInterval(checkInterval);
          }
        } catch (error) {
          console.error('Error checking restore status:', error);
          // Don't stop the interval, just log the error
        }
      }, 60000); // Check every minute
    }
    
    return {
      message: `Restoration initiated for ${fileName}. This may take ${GLACIER_RETRIEVAL_TIERS[tier].time} depending on the retrieval tier.`,
      status: 'initiated',
      key,
      tier
    };
  } catch (error) {
    console.error('Error restoring from Glacier:', error);
    
    // Update the transfer if there was an error
    if (transferContext && transferId) {
      transferContext.errorTransfer(transferId, error);
    }
    
    throw error;
  }
};

/**
 * Restore all Glacier objects in a folder
 * @param {string} folderKey - Folder key in S3
 * @param {string} tier - Retrieval tier: 'Expedited', 'Standard', or 'Bulk'
 * @param {Object} transferContext - Optional transfer context for tracking progress
 * @returns {Object} Summary of the bulk restoration
 */
export const restoreFromGlacierBulk = async (folderKey, tier = 'Standard', transferContext = null) => {
  try {
    // Get all objects in the folder
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: folderKey,
      MaxKeys: 1000 // Increase for large folders
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      throw new Error('No objects found in folder');
    }
    
    // Filter for Glacier objects
    const glacierObjects = [];
    
    // Check each object's storage class
    for (const item of response.Contents) {
      try {
        const status = await checkGlacierStatus(item.Key);
        if (status.isGlacier && (!status.restoreStatus || !status.restoreStatus.isReady)) {
          glacierObjects.push(item);
        }
      } catch (error) {
        console.error(`Error checking status for ${item.Key}:`, error);
        // Continue with other objects
      }
    }
    
    if (glacierObjects.length === 0) {
      return {
        message: 'No Glacier objects found in folder that need restoration',
        restoredFiles: 0
      };
    }
    
    // Create a bulk transfer for tracking if context is provided
    let transferId = null;
    if (transferContext) {
      transferId = transferContext.addTransfer({
        name: `Bulk Restore: ${folderKey.split('/').slice(-2)[0]}`,
        type: 'bulk-restore',
        fileCount: glacierObjects.length,
        status: 'initiating',
        tier
      });
    }
    
    // Restore each Glacier object
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < glacierObjects.length; i++) {
      const item = glacierObjects[i];
      try {
        await restoreFromGlacier(item.Key, tier);
        successCount++;
        
        // Update the bulk transfer progress
        if (transferContext && transferId) {
          const progress = Math.round((i + 1) / glacierObjects.length * 100);
          transferContext.updateTransfer(transferId, {
            progress,
            status: 'in_progress',
            successCount,
            failCount
          });
        }
      } catch (error) {
        console.error(`Error restoring ${item.Key}:`, error);
        failCount++;
      }
    }
    
    // Complete the bulk transfer
    if (transferContext && transferId) {
      if (failCount === 0) {
        transferContext.completeTransfer(transferId);
      } else {
        transferContext.updateTransfer(transferId, {
          status: 'completed_with_errors',
          progress: 100,
          successCount,
          failCount
        });
      }
    }
    
    return {
      message: `Restoration initiated for ${successCount} files. ${failCount} files failed.`,
      restoredFiles: successCount,
      failedFiles: failCount
    };
  } catch (error) {
    console.error('Error restoring folder from Glacier:', error);
    
    // Update the transfer if there was an error
    if (transferContext && transferId) {
      transferContext.errorTransfer(transferId, error);
    }
    
    throw error;
  }
};

export default {
  checkGlacierStatus,
  restoreFromGlacier,
  restoreFromGlacierBulk,
  GLACIER_RETRIEVAL_TIERS
};
