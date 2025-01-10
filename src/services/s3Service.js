import { 
  S3Client, 
  ListObjectsV2Command, 
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import JSZip from 'jszip';

// Configure S3 client with browser-compatible settings
const s3Client = new S3Client({
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

const EXCLUDED_FILES = ['history-log.json'];

// Update upload configuration for browser compatibility
export const uploadToS3 = async (file, folderName) => {
  try {
    // Enhanced file validation
    if (!file) {
      throw new Error('No file provided');
    }

    if (!(file instanceof Blob || file instanceof File)) {
      throw new Error('Invalid file type - must be File or Blob');
    }

    if (!file.name || !file.type || file.size === undefined) {
      throw new Error('File object missing required properties');
    }

    const key = folderName ? `${folderName}/${file.name}` : file.name;

    // Create a proper Blob if needed
    const fileBlob = file instanceof Blob ? file : new Blob([file], { type: file.type });

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: key,
        Body: fileBlob,
        ContentType: file.type || 'application/octet-stream',
      },
      queueSize: 4, // Reduced for browser
      partSize: 5 * 1024 * 1024, // 5MB parts
      leavePartsOnError: false, // Clean up failed uploads
    });

    upload.on("httpUploadProgress", (progress) => {
      const percentage = Math.round((progress.loaded / progress.total) * 100);
      // Progress can be used for UI updates if needed
    });

    const response = await upload.done();

    // Log the upload activity
    await logActivity({
      action: 'Upload',
      itemName: file.name,
      size: file.size,
      fileCount: 1
    });

    return response;
  } catch (error) {
    console.error('Upload error occurred');
    throw error;
  }
};

export const listS3Objects = async (prefix = '') => {
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
export const getAllObjects = async (prefix = '') => {
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

export const deleteS3Object = async (key) => {
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

export const getS3DownloadUrl = async (key, size) => {
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

// Update download handling for browser compatibility
export const downloadFolder = async (folderKey) => {
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

    // Log the download activity first
    await logActivity({
      action: 'Download',
      itemName: folderKey,
      size: totalSize,
      fileCount: fileCount
    });

    const zip = new JSZip();

    for (const item of contents) {
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
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        data = new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
      } else {
        data = await Body.transformToByteArray();
      }

      const relativePath = item.Key.substring(folderKey.length);
      zip.file(relativePath, data);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderKey.split('/').slice(-2)[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error downloading folder');
    throw error;
  }
};

export const getFolderSize = async (folderKey) => {
  try {
    const allObjects = await getAllObjects(folderKey);
    const totalSize = allObjects.reduce((acc, item) => acc + item.Size, 0);
    return totalSize;
  } catch (error) {
    console.error('Error calculating folder size');
    return 0;
  }
};

export const getHistoryLog = async () => {
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
    
    // Add new entry
    const updatedHistory = [...currentHistory, newEntry];
    
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

export const logActivity = async (activity) => {
  try {
    const currentHistory = await getHistoryLog();
    const newEntry = {
      date: new Date().toISOString(),
      action: activity.action,
      itemName: activity.itemName,
      size: activity.size || 0,
      fileCount: activity.fileCount || 1
    };
    
    const updatedHistory = [...currentHistory, newEntry];
    
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

export const clearHistoryLog = async () => {
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
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const getBucketMetrics = async () => {
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
export const getDetailedFolderStructure = async (prefix = '') => {
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

