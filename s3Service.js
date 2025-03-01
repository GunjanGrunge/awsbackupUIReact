import { 
  S3Client, 
  ListObjectsV2Command, 
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import JSZip from 'jszip';

// Export s3Client at the top
export const s3Client = new S3Client({
  region: import.meta.env.VITE_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_SECRET_KEY,
  },
  forcePathStyle: false,
  // Add these settings for browser compatibility
  systemClockOffset: 0,
  tls: true,
  retryMode: 'standard',
  customUserAgent: 'AWS-S3-Browser-Upload',
  // Remove any Node.js specific configurations
  maxAttempts: 3,
});

const EXCLUDED_FILES = ['history-log.json', 'ai-history-log.json'];

// Update upload configuration for browser compatibility
const uploadToS3 = async (file, folderPath, onProgress) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!(file instanceof Blob || file instanceof File)) {
      throw new Error('Invalid file type - must be File or Blob');
    }

    if (!file.name) {
      throw new Error('File must have a name');
    }

    // Clean up the folder path to remove any leading "./" and ensure proper structure
    let cleanFolderPath = folderPath
      .replace(/^\.\//, '') // Remove leading ./
      .replace(/^\//, '');  // Remove leading /

    // If path is empty, use just the file name
    const key = cleanFolderPath || file.name;
    const fileBlob = file instanceof Blob ? file : new Blob([file], { type: file.type });

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: key,
        Body: fileBlob,
        ContentType: file.type || 'application/octet-stream',
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false
    });

    // Add progress handling
    upload.on("httpUploadProgress", (progress) => {
      if (onProgress) {
        onProgress(progress);
      }
    });

    const response = await upload.done();
    
    // Log the upload activity
    await logActivity({
      action: 'Upload',
      itemName: key,
      size: file.size,
      fileCount: 1
    });

    return response;
  } catch (error) {
    console.error('Upload error occurred:', error);
    throw error;
  }
};

const listS3Objects = async (prefix = '') => {
  try {
    // Ensure prefix ends with / if it's not empty
    const normalizedPrefix = prefix ? prefix.endsWith('/') ? prefix : `${prefix}/` : '';
    
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: normalizedPrefix,
      Delimiter: '/'
    });

    const response = await s3Client.send(command);
    
    // Process folders (CommonPrefixes)
    const folders = (response.CommonPrefixes || [])
      .map(prefix => ({
        key: prefix.Prefix,
        name: prefix.Prefix.split('/').slice(-2)[0],
        type: 'folder',
        lastModified: null
      }));

    // Process files (Contents)
    const files = (response.Contents || [])
      .filter(item => {
        // Filter out the current directory prefix and excluded files
        const name = item.Key.replace(normalizedPrefix, '');
        return name && !EXCLUDED_FILES.includes(name) && !name.endsWith('/');
      })
      .map(item => ({
        key: item.Key,
        name: item.Key.split('/').pop(),
        type: 'file',
        lastModified: item.LastModified,
        size: item.Size
      }));

    // Sort: folders first, then files, both alphabetically
    return [
      ...folders.sort((a, b) => a.name.localeCompare(b.name)),
      ...files.sort((a, b) => a.name.localeCompare(b.name))
    ];
  } catch (error) {
    console.error('Error listing objects:', error);
    throw error;
  }
};

// Add new helper function to get all objects including those in subfolders
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

const deleteS3Object = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting object');
    throw error;
  }
};

// Add this function for renaming folders/files in S3
export const renameS3Object = async (item, newName) => {
  try {
    if (!item || !item.key || !newName) {
      throw new Error('Invalid parameters for rename operation');
    }
    
    const isFolder = item.type === 'folder';
    let sourceKey = item.key;
    let oldName = item.name;
    
    // For folders, we need to copy all objects with the prefix and delete old ones
    if (isFolder) {
      // Get all objects in the folder
      const objects = await getAllObjects(sourceKey);
      
      if (objects.length === 0) {
        console.log('No objects found in folder, creating empty folder with new name');
        // For empty folders, create a placeholder file to maintain the folder
        const parentPath = sourceKey.split('/').slice(0, -2).join('/');
        const newKey = parentPath ? `${parentPath}/${newName}/` : `${newName}/`;
        
        // Create an empty placeholder to maintain the folder structure
        await s3Client.send(new PutObjectCommand({
          Bucket: import.meta.env.VITE_BUCKET_NAME,
          Key: newKey + '.placeholder',
          Body: '',
          ContentType: 'application/x-empty'
        }));
        
        return newKey;
      }
      
      // Track successful copies to ensure we only delete after successful copy
      const successfulCopies = [];
      
      // Process each object in the folder
      for (const object of objects) {
        const oldKey = object.Key;
        // Extract the path after the folder name
        const pathWithinFolder = oldKey.substring(sourceKey.length);
        
        // Determine parent directory path
        const pathSegments = sourceKey.split('/');
        pathSegments.pop(); // Remove trailing empty string from split
        pathSegments.pop(); // Remove folder name
        const parentPath = pathSegments.join('/');
        
        // Create new key with the new folder name
        const newKey = parentPath ? 
          `${parentPath}/${newName}/${pathWithinFolder}` : 
          `${newName}/${pathWithinFolder}`;
        
        console.log(`Copying from: ${oldKey} to: ${newKey}`);
        
        try {
          // Copy the object to the new location
          await copyS3Object(oldKey, newKey);
          successfulCopies.push({ oldKey, newKey });
        } catch (copyError) {
          console.error('Error copying object during rename:', copyError);
          
          // If any copy fails, undo the previous copies
          for (const { newKey } of successfulCopies) {
            try {
              await deleteS3Object(newKey);
            } catch (undoError) {
              console.error('Error undoing copy operation:', undoError);
            }
          }
          
          throw new Error('Failed to rename folder: Error during copy operation');
        }
      }
      
      // After all copies are successful, delete the original objects
      for (const { oldKey } of successfulCopies) {
        await deleteS3Object(oldKey);
      }
      
      // Return the new folder key
      const pathSegments = sourceKey.split('/');
      pathSegments.pop(); // Remove trailing empty string
      pathSegments.pop(); // Remove old folder name
      pathSegments.push(newName); // Add new folder name
      pathSegments.push(''); // Add trailing slash
      return pathSegments.join('/');
    } else {
      // For files, we just rename the single file
      const pathParts = sourceKey.split('/');
      pathParts.pop(); // Remove filename
      const filePath = pathParts.length ? `${pathParts.join('/')}/` : '';
      
      // Create new key with the new name
      const newKey = `${filePath}${newName}`;
      
      // Copy the file to the new location
      await copyS3Object(sourceKey, newKey);
      
      // Delete the old file
      await deleteS3Object(sourceKey);
      
      return newKey;
    }
  } catch (error) {
    console.error('Error renaming object:', error);
    throw error;
  }
};

// Helper function to copy objects in S3
const copyS3Object = async (sourceKey, destinationKey) => {
  try {
    console.log(`Copying from ${sourceKey} to ${destinationKey}`);
    
    // Use CopyObjectCommand instead of manually copying with PutObjectCommand
    const copyParams = {
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      CopySource: `${import.meta.env.VITE_BUCKET_NAME}/${encodeURIComponent(sourceKey)}`,
      Key: destinationKey
    };
    
    try {
      const headCommand = new GetObjectCommand({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: sourceKey
      });
      
      const response = await s3Client.send(headCommand);
      const contentType = response.ContentType;
      
      // Add content type to copy parameters if available
      if (contentType) {
        copyParams.ContentType = contentType;
      }
    } catch (error) {
      // If there's an error getting the content type, just proceed with the copy
      console.log("Could not determine content type for copy, using default");
    }
    
    // Use CopyObjectCommand for better performance and reliability
    const command = new CopyObjectCommand(copyParams);
    await s3Client.send(command);
    
    return destinationKey;
  } catch (error) {
    console.error(`Error copying object from ${sourceKey} to ${destinationKey}:`, error);
    throw error;
  }
};

// Update download handling for browser compatibility
const getS3DownloadUrl = async (key, size, transferContext = null) => {
  try {
    // Get the file size if not provided
    if (!size) {
      const headCommand = new GetObjectCommand({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: key
      });
      const response = await s3Client.send(headCommand);
      size = response.ContentLength;
    }

    // Log the download activity first
    await logActivity({
      action: 'Download',
      itemName: key.split('/').pop(),
      size: size,
      fileCount: 1
    });

    const command = new GetObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // If transfer context is provided, we'll need to manually track the download
    if (transferContext) {
      const fileName = key.split('/').pop();
      const controller = new AbortController();
      const signal = controller.signal;
      
      const transferId = transferContext.addTransfer({
        name: fileName,
        type: 'download',
        totalBytes: size,
        controller
      });
      
      // Create a download link but don't automatically click it
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      
      // Set up XHR to track progress
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      
      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          transferContext.updateTransferProgress(
            transferId, 
            event.loaded, 
            event.total,
            event
          );
        }
      };
      
      xhr.onload = () => {
        if (xhr.status === 200) {
          // Download completed successfully
          transferContext.completeTransfer(transferId);
          
          const blob = new Blob([xhr.response], { type: 'application/octet-stream' });
          const objectUrl = URL.createObjectURL(blob);
          
          a.href = objectUrl;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
        } else {
          transferContext.errorTransfer(transferId, new Error('Download failed'));
        }
      };
      
      xhr.onerror = () => {
        transferContext.errorTransfer(transferId, new Error('Download failed'));
      };
      
      xhr.onabort = () => {
        // Do nothing, the transfer context already handles this
      };
      
      // Set up abort handler
      signal.addEventListener('abort', () => {
        xhr.abort();
      });
      
      xhr.send();
      return null; // We're handling the download ourselves
    }
    
    return url;
  } catch (error) {
    console.error('Error generating download URL:', error);
    throw error;
  }
};

// Add polyfill for stream handling
const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

// Update download folder to support progress tracking
const downloadFolder = async (folderKey, transferContext = null) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: folderKey
    });

    const response = await s3Client.send(command);
    const contents = response.Contents || [];
    
    // Calculate metrics before download
    const totalSize = contents.reduce((acc, item) => acc + item.Size, 0);
    const fileCount = contents.length;

    // Create abort controller for cancellation
    const controller = new AbortController();
    
    // Add to transfer context if provided
    let transferId;
    const folderName = folderKey.split('/').slice(-2)[0];
    
    if (transferContext) {
      transferId = transferContext.addTransfer({
        name: `${folderName}.zip`,
        type: 'download',
        totalBytes: totalSize,
        controller,
        fileCount
      });
    }

    // Log the download activity first
    await logActivity({
      action: 'Download',
      itemName: folderKey,
      size: totalSize,
      fileCount: fileCount
    });

    try {
      const zip = new JSZip();
      let loadedBytes = 0;

      for (const item of contents) {
        if (controller.signal.aborted) {
          throw new Error('Download cancelled by user');
        }
        
        if (EXCLUDED_FILES.includes(item.Key.split('/').pop())) continue;

        const getCommand = new GetObjectCommand({
          Bucket: import.meta.env.VITE_BUCKET_NAME,
          Key: item.Key
        });
        
        const { Body } = await s3Client.send(getCommand);
        
        // Handle streaming in browser environment
        let data;
        if (Body instanceof ReadableStream) {
          const reader = Body.getReader();
          const chunks = [];
          let itemLoaded = 0;
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            
            // Update progress
            itemLoaded += value.length;
            loadedBytes += value.length;
            
            if (transferContext && transferId) {
              transferContext.updateTransferProgress(transferId, loadedBytes, totalSize);
            }
          }
          
          data = new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
        } else {
          data = await Body.transformToByteArray();
          
          // Update progress after each file
          loadedBytes += item.Size;
          if (transferContext && transferId) {
            transferContext.updateTransferProgress(transferId, loadedBytes, totalSize);
          }
        }

        const relativePath = item.Key.substring(folderKey.length);
        zip.file(relativePath, data);
      }

      if (controller.signal.aborted) {
        throw new Error('Download cancelled by user');
      }

      const content = await zip.generateAsync({ 
        type: 'blob',
        onUpdate: (metadata) => {
          if (transferContext && transferId) {
            // During zip generation, we're already at file download completion
            // so we'll map the compression progress from 90% to 100%
            const zipProgress = metadata.percent;
            const overallProgress = 90 + (zipProgress * 0.1);
            transferContext.updateTransfer(transferId, { 
              progress: Math.round(overallProgress) 
            });
          }
        }
      });

      if (transferContext && transferId) {
        transferContext.completeTransfer(transferId);
      }
      
      const url = URL.createObjectURL(content);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Handle abort error differently
      if (error.name === 'AbortError' || error.message.includes('cancelled')) {
        console.log('Download aborted by user');
        
        if (transferContext && transferId) {
          transferContext.updateTransfer(transferId, { 
            status: 'cancelled',
            progress: 0
          });
        }
      } else {
        // Handle other errors
        console.error('Error downloading folder:', error);
        
        if (transferContext && transferId) {
          transferContext.errorTransfer(transferId, error);
        }
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Error in downloadFolder:', error);
    throw error;
  }
};

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

const updateHistoryLog = async (newEntry) => {
  try {
    // Get current history
    const currentHistory = await getHistoryLog();
    
    // Add new entry at the beginning
    const updatedHistory = [newEntry, ...currentHistory];
    
    // Update file in S3
    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'history-log.json',
      Body: JSON.stringify(updatedHistory),
      ContentType: 'application/json'
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error updating history log:', error);
    throw error;
  }
};

const logActivity = async (activity) => {
  try {
    const currentHistory = await getHistoryLog();
    const newEntry = {
      date: new Date().toISOString(),
      action: activity.action,
      itemName: activity.itemName,
      size: activity.size || 0,
      fileCount: activity.fileCount || 1
    };
    
    // Add new entry at the beginning of the array
    const updatedHistory = [newEntry, ...currentHistory];
    
    await s3Client.send(new PutObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'history-log.json',
      Body: JSON.stringify(updatedHistory),
      ContentType: 'application/json'
    }));

    return newEntry;
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

const clearHistoryLog = async () => {
  try {
    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'history-log.json',
      Body: JSON.stringify([]),
      ContentType: 'application/json',
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error clearing history log:', error);
    throw error;
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getBucketMetrics = async () => {
  try {
    const items = await listS3Objects();
    
    let totalSize = 0;
    let totalObjects = 0;

    const processItems = (itemsList) => {
      itemsList.forEach(item => {
        if (item.type === 'file' && !EXCLUDED_FILES.includes(item.name)) {
          totalSize += item.size;
          totalObjects += 1;
        }
      });
    };

    processItems(items);

    // Calculate estimated costs
    const storageGB = totalSize / (1024 * 1024 * 1024);
    const storageRate = 0.023; // per GB per month
    const transferRate = 0.09; // per GB outbound

    return {
      totalSize,
      totalObjects,
      storageGB,
      storageCost: storageGB * storageRate,
      transferCost: storageGB * transferRate * 0.1, // Assuming 10% transfer
      totalCost: (storageGB * storageRate) + (storageGB * transferRate * 0.1)
    };
  } catch (error) {
    console.error('Error getting bucket metrics:', error);
    throw error;
  }
};

// Add this new function for AI analysis
const getDetailedFolderStructure = async (prefix = '') => {
  try {
    const allObjects = await getAllObjects(prefix);
    const structure = {};
    
    for (const object of allObjects) {
      const parts = object.Key.split('/');
      let currentLevel = structure;
      
      // Process each part of the path
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        
        if (i === parts.length - 1) {
          // This is a file
          currentLevel[part] = {
            type: 'file',
            size: object.Size,
            lastModified: object.LastModified,
            key: object.Key
          };
        } else {
          // This is a folder
          if (!currentLevel[part]) {
            currentLevel[part] = {
              type: 'folder',
              size: 0,
              lastModified: null,
              contents: {},
              key: parts.slice(0, i + 1).join('/') + '/'
            };
          }
          currentLevel = currentLevel[part].contents;
        }
      }
    }

    // Calculate folder sizes
    const calculateFolderSizes = (folder) => {
      let totalSize = 0;
      
      Object.values(folder).forEach(item => {
        if (item.type === 'file') {
          totalSize += item.size;
        } else if (item.type === 'folder') {
          item.size = calculateFolderSizes(item.contents);
          totalSize += item.size;
        }
      });
      
      return totalSize;
    };

    calculateFolderSizes(structure);
    return structure;
  } catch (error) {
    console.error('Error getting detailed folder structure:', error);
    return {};
  }
};

// Update vite.config.js to handle AWS SDK properly
// Add this comment at the end of the file to remind about vite config
/* 
Add to vite.config.js:
export default defineConfig({
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
    },
  },
  define: {
    'process.env.NODE_DEBUG': JSON.stringify(''),
  }
})
*/

export { 
  uploadToS3,
  listS3Objects,
  deleteS3Object,
  getS3DownloadUrl,
  downloadFolder,
  getFolderSize,
  getHistoryLog,
  logActivity,
  clearHistoryLog,
  formatFileSize,
  getBucketMetrics,
  getDetailedFolderStructure,
  getAllObjects
};