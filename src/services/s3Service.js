import { S3Client, ListObjectsV2Command, PutObjectCommand, HeadObjectCommand, RestoreObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import JSZip from 'jszip';
import { Upload } from '@aws-sdk/lib-storage';

// Initialize S3 client
const s3Client = new S3Client({
  region: import.meta.env.VITE_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_SECRET_KEY
  },
  forcePathStyle: false
});

// Function to upload file to S3
const uploadToS3 = async (file, filePath, onProgress = () => {}) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!(file instanceof Blob || file instanceof File)) {
      throw new Error('Invalid file type - must be File or Blob');
    }

    // Clean up the file path to remove any leading "./" and ensure proper structure
    const cleanPath = filePath
      .replace(/^\.\//, '')       // Remove leading ./
      .replace(/^\/+|\/+$/g, '')  // Remove leading/trailing slashes
      .replace(/\\/g, '/');       // Replace Windows-style backslashes with forward slashes

    // Create the upload parameters
    const params = {
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: cleanPath,
      Body: file,
      ContentType: file.type || 'application/octet-stream'
    };

    // Use multipart upload for files larger than 5MB
    const upload = new Upload({
      client: s3Client,
      params,
      queueSize: 4,
      partSize: 5 * 1024 * 1024, // 5MB parts
      leavePartsOnError: false
    });

    // Add progress handling
    upload.on("httpUploadProgress", (progress) => {
      const percentage = Math.round((progress.loaded / progress.total) * 100);
      onProgress(percentage);
    });

    const result = await upload.done();
    
    // Log the upload activity
    await logActivity({
      action: 'Upload',
      itemName: cleanPath.split('/').pop(),
      size: file.size,
      fileCount: 1
    });

    return result;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Export listS3Objects function
const listS3Objects = async (prefix = '') => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: prefix,
      Delimiter: '/'
    });
    
    const response = await s3Client.send(command);
    const folders = (response.CommonPrefixes || []).map(prefix => ({
      key: prefix.Prefix,
      name: prefix.Prefix.split('/').slice(-2)[0],
      type: 'folder',
      hasArchivedFiles: false
    }));
    
    const files = (response.Contents || [])
      .filter(item => !item.Key.endsWith('/'))
      .map(item => ({
        key: item.Key,
        name: item.Key.split('/').pop(),
        size: item.Size,
        lastModified: item.LastModified,
        type: 'file',
        storageClass: item.StorageClass
      }));

    // Check each folder for archived files
    for (let folder of folders) {
      folder.hasArchivedFiles = await getFolderGlacierStatus(folder.key);
    }
    
    return [...folders, ...files];
  } catch (error) {
    console.error('Error listing S3 objects:', error);
    throw error;
  }
};

// Helper function to check if a folder contains any Glacier objects
async function getFolderGlacierStatus(prefix) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: prefix
    });
    
    const response = await s3Client.send(command);
    return (response.Contents || []).some(item => 
      item.StorageClass === 'GLACIER' || item.StorageClass === 'DEEP_ARCHIVE'
    );
  } catch (error) {
    console.error('Error checking Glacier status:', error);
    return false;
  }
}

// Utility function to format file sizes
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Get statistics about Glacier storage for a given path
const getGlacierStats = async (prefix = '') => {
  try {
    let totalObjects = 0;
    let glacierObjects = 0;
    let totalSize = 0;
    let glacierSize = 0;
    let pendingTransitions = [];
    let continuationToken;

    const now = new Date();
    const LIFECYCLE_DAYS = 90;

    do {
      const command = new ListObjectsV2Command({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken
      });

      const response = await s3Client.send(command);
      const contents = response.Contents || [];

      for (const item of contents) {
        // Skip folders (objects ending with /)
        if (!item.Key.endsWith('/')) {
          totalObjects++;
          totalSize += item.Size;

          if (item.StorageClass === 'GLACIER' || item.StorageClass === 'DEEP_ARCHIVE') {
            glacierObjects++;
            glacierSize += item.Size;
          } else if (item.StorageClass === 'STANDARD') {
            const lastModified = new Date(item.LastModified);
            const daysOld = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
            const daysUntilTransition = LIFECYCLE_DAYS - daysOld;

            if (daysUntilTransition > 0) {
              pendingTransitions.push({
                name: item.Key.split('/').pop(),
                daysLeft: daysUntilTransition,
                size: item.Size,
                transitionDate: new Date(lastModified.getTime() + (LIFECYCLE_DAYS * 24 * 60 * 60 * 1000))
              });
            }
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Sort pending transitions by days left
    pendingTransitions.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      totalSize,
      glacierSize,
      totalCount: totalObjects,
      glacierCount: glacierObjects,
      glacierPercentage: totalObjects > 0 ? (glacierObjects / totalObjects) * 100 : 0,
      glacierSizePercentage: totalSize > 0 ? (glacierSize / totalSize) * 100 : 0,
      pendingTransitions: pendingTransitions.slice(0, 10),
      totalPendingCount: pendingTransitions.length
    };
  } catch (error) {
    console.error('Error getting Glacier stats:', error);
    throw error;
  }
};

// Check if an object is in Glacier storage and get its restore status
const checkGlacierStatus = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key
    });
    
    const response = await s3Client.send(command);
    
    const isGlacier = response.StorageClass === 'GLACIER' || response.StorageClass === 'DEEP_ARCHIVE';
    let restoreStatus = null;
    
    if (isGlacier && response.Restore) {
      // Parse the restore status from the Restore header
      // Example: "ongoing-request=\"false\", expiry-date=\"Wed, 07 Feb 2024 00:00:00 GMT\""
      const ongoingMatch = response.Restore.match(/ongoing-request="([^"]+)"/);
      const expiryMatch = response.Restore.match(/expiry-date="([^"]+)"/);
      
      restoreStatus = {
        ongoing: ongoingMatch ? ongoingMatch[1] === 'true' : false,
        expiryDate: expiryMatch ? new Date(expiryMatch[1]) : null
      };
    }

    return {
      isGlacier,
      storageClass: response.StorageClass,
      restoreStatus,
      lastModified: response.LastModified
    };
  } catch (error) {
    console.error('Error checking Glacier status:', error);
    throw error;
  }
};

// Function to initiate restore of a Glacier object
const restoreFromGlacier = async (key, tier = 'Standard') => {
  try {
    const command = new RestoreObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key,
      RestoreRequest: {
        Days: 7, // Number of days to keep the restored copy available
        GlacierJobParameters: {
          Tier: tier // Can be 'Expedited', 'Standard', or 'Bulk'
        }
      }
    });

    const response = await s3Client.send(command);
    return response;
  } catch (error) {
    console.error('Error restoring from Glacier:', error);
    throw error;
  }
};

// Function to restore all Glacier objects in a folder
const restoreFromGlacierBulk = async (folderKey, tier = 'Standard') => {
  try {
    // List all objects in the folder
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: folderKey
    });
    
    const response = await s3Client.send(command);
    const contents = response.Contents || [];
    
    // Filter for Glacier objects and initiate restore for each
    const glacierObjects = contents.filter(item => 
      item.StorageClass === 'GLACIER' || item.StorageClass === 'DEEP_ARCHIVE'
    );
    
    // Restore each Glacier object
    const restorePromises = glacierObjects.map(item => 
      restoreFromGlacier(item.Key, tier)
    );
    
    await Promise.all(restorePromises);
    
    return {
      totalFiles: contents.length,
      restoredFiles: glacierObjects.length
    };
  } catch (error) {
    console.error('Error restoring folder from Glacier:', error);
    throw error;
  }
};

// Function to delete an object from S3
const deleteS3Object = async (key) => {
  try {
    if (key.endsWith('/')) {
      // For folders, we need to delete all objects inside first
      const command = new ListObjectsV2Command({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Prefix: key
      });
      
      const response = await s3Client.send(command);
      if (response.Contents && response.Contents.length > 0) {
        // Delete multiple objects
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: import.meta.env.VITE_BUCKET_NAME,
          Delete: {
            Objects: response.Contents.map(item => ({ Key: item.Key })),
            Quiet: true
          }
        });
        await s3Client.send(deleteCommand);
      }
    } else {
      // For single files
      const command = new DeleteObjectCommand({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: key
      });
      await s3Client.send(command);
    }
    return true;
  } catch (error) {
    console.error('Error deleting S3 object:', error);
    throw error;
  }
};

// Function to download a folder as a zip file
const downloadFolder = async (folderKey, transferContext = null) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: folderKey
    });
    
    const response = await s3Client.send(command);
    const zip = new JSZip();
    const contents = response.Contents || [];
    
    // Update total size in transfer context
    const totalSize = contents.reduce((acc, item) => acc + item.Size, 0);
    transferContext.initializeTransfer(totalSize);
    
    for (const item of contents) {
      if (!item.Key.endsWith('/')) {
        const getCommand = new GetObjectCommand({
          Bucket: import.meta.env.VITE_BUCKET_NAME,
          Key: item.Key
        });
        
        const { Body } = await s3Client.send(getCommand);
        const arrayBuffer = await Body.transformToByteArray();
        
        // Add file to zip, removing the prefix from the path
        const relativePath = item.Key.slice(folderKey.length);
        zip.file(relativePath, arrayBuffer);
        
        // Update progress
        transferContext.updateProgress(item.Size);
      }
    }
    
    // Generate zip file
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = folderKey.split('/').slice(-2)[0] + '.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Cleanup
    URL.revokeObjectURL(url);
    transferContext.completeTransfer();
    
    return true;
  } catch (error) {
    transferContext.failTransfer();
    console.error('Error downloading folder:', error);
    throw error;
  }
};

// Function to get a signed URL for downloading a file
const getS3DownloadUrl = async (key, size, transferContext = null) => {
  try {
    const command = new GetObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key
    });
    
    transferContext.initializeTransfer(size);
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    transferContext.completeTransfer();
    return url;
  } catch (error) {
    transferContext.failTransfer();
    console.error('Error getting download URL:', error);
    throw error;
  }
};

// Function to rename an S3 object
const renameS3Object = async (item, newName) => {
  try {
    const oldKey = item.key;
    const newKey = oldKey.substring(0, oldKey.lastIndexOf('/') + 1) + newName;
    
    // Copy the object with the new key
    const copyCommand = new CopyObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      CopySource: encodeURIComponent(import.meta.env.VITE_BUCKET_NAME + '/' + oldKey),
      Key: newKey
    });
    
    await s3Client.send(copyCommand);
    
    // Delete the old object
    const deleteCommand = new DeleteObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: oldKey
    });
    
    await s3Client.send(deleteCommand);
    return true;
  } catch (error) {
    console.error('Error renaming S3 object:', error);
    throw error;
  }
};

// Function to get all objects including those in subfolders
const getAllObjects = async (prefix = '') => {
  const allObjects = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken
    });

    const response = await s3Client.send(command);
    if (response.Contents) {
      allObjects.push(...response.Contents);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allObjects;
};

// Function to get folder size
const getFolderSize = async (folderKey) => {
  try {
    const allObjects = await getAllObjects(folderKey);
    const totalSize = allObjects.reduce((acc, item) => acc + item.Size, 0);
    return totalSize;
  } catch (error) {
    console.error('Error calculating folder size');
    return 0;
  }
};

// Function to get history log
const getHistoryLog = async () => {
  try {
    const command = new GetObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'history-log.json'
    });

    try {
      const response = await s3Client.send(command);
      const bodyContents = await response.Body.transformToString();
      return JSON.parse(bodyContents);
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        // If file doesn't exist, create it with empty array
        await initializeHistoryLog();
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching history log:', error);
    return [];
  }
};

// Function to initialize history log
const initializeHistoryLog = async () => {
  try {
    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'history-log.json',
      Body: JSON.stringify([]),
      ContentType: 'application/json'
    });
    await s3Client.send(command);
  } catch (error) {
    console.error('Error initializing history log:', error);
    throw error;
  }
};

// Function to update history log
const updateHistoryLog = async (newEntry) => {
  try {
    const currentHistory = await getHistoryLog();
    const updatedHistory = [newEntry, ...currentHistory];
    
    await s3Client.send(new PutObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'history-log.json',
      Body: JSON.stringify(updatedHistory),
      ContentType: 'application/json'
    }));

    return newEntry;
  } catch (error) {
    console.error('Error updating history log:', error);
    throw error;
  }
};

// Function to log activity
const logActivity = async (activity) => {
  try {
    const newEntry = {
      date: new Date().toISOString(),
      action: activity.action,
      itemName: activity.itemName,
      size: activity.size || 0,
      fileCount: activity.fileCount || 1
    };
    
    return await updateHistoryLog(newEntry);
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

// Function to clear history log
const clearHistoryLog = async () => {
  try {
    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'history-log.json',
      Body: JSON.stringify([]),
      ContentType: 'application/json'
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('Error clearing history log:', error);
    throw error;
  }
};

// Function to get bucket metrics
const getBucketMetrics = async () => {
  try {
    let totalSize = 0;
    let totalObjects = 0;
    let continuationToken;

    do {
      const command = new ListObjectsV2Command({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        ContinuationToken: continuationToken
      });

      const response = await s3Client.send(command);
      const contents = response.Contents || [];

      // Count only actual files, not folders
      contents.forEach(item => {
        if (!item.Key.endsWith('/')) {
          totalObjects++;
          totalSize += item.Size;
        }
      });

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    const storageGB = totalSize / (1024 * 1024 * 1024);
    const storageRate = 0.023; // per GB per month
    const transferRate = 0.09; // per GB outbound

    return {
      totalSize,
      totalObjects,
      storageGB,
      storageCost: storageGB * storageRate,
      transferCost: storageGB * transferRate * 0.1,
      totalCost: (storageGB * storageRate) + (storageGB * transferRate * 0.1)
    };
  } catch (error) {
    console.error('Error getting bucket metrics:', error);
    throw error;
  }
};

// Function to get detailed folder structure
const getDetailedFolderStructure = async (prefix = '') => {
  try {
    const allObjects = await getAllObjects(prefix);
    const structure = {};
    
    for (const object of allObjects) {
      const parts = object.Key.split('/');
      let currentLevel = structure;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        
        if (i === parts.length - 1) {
          currentLevel[part] = {
            type: 'file',
            size: object.Size,
            lastModified: object.LastModified,
            key: object.Key
          };
        } else {
          if (!currentLevel[part]) {
            currentLevel[part] = {
              type: 'folder',
              contents: {},
              key: parts.slice(0, i + 1).join('/') + '/'
            };
          }
          currentLevel = currentLevel[part].contents;
        }
      }
    }

    return structure;  } catch (error) {
    console.error('Error getting detailed folder structure:', error);
    return {};
  }
};

// Import enhanced services to replace existing ones
import { 
  uploadToS3Enhanced, 
  getS3DownloadUrlEnhanced, 
  downloadFolderEnhanced 
} from './enhancedS3Service';

import {
  checkGlacierStatus as enhancedCheckGlacierStatus,
  restoreFromGlacier as enhancedRestoreFromGlacier,
  restoreFromGlacierBulk as enhancedRestoreFromGlacierBulk,
  GLACIER_RETRIEVAL_TIERS
} from './glacierService';

// Export all services - using enhanced versions where available
export {
  s3Client,
  listS3Objects,
  deleteS3Object,
  getFolderSize,
  getHistoryLog,
  logActivity,
  clearHistoryLog,
  formatFileSize,
  getBucketMetrics,
  getDetailedFolderStructure,
  getAllObjects,
  renameS3Object,
  getGlacierStats,
  // Enhanced functions
  uploadToS3Enhanced as uploadToS3,
  getS3DownloadUrlEnhanced as getS3DownloadUrl,
  downloadFolderEnhanced as downloadFolder,
  enhancedCheckGlacierStatus as checkGlacierStatus,
  enhancedRestoreFromGlacier as restoreFromGlacier,
  enhancedRestoreFromGlacierBulk as restoreFromGlacierBulk,
  GLACIER_RETRIEVAL_TIERS
};
