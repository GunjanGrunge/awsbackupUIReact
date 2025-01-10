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

const s3Client = new S3Client({
  region: import.meta.env.VITE_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_SECRET_KEY,
  },
  endpoint: `https://s3.${import.meta.env.VITE_REGION}.amazonaws.com`,
  forcePathStyle: true,
  signatureVersion: 'v4'
});

const EXCLUDED_FILES = ['history-log.json'];

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
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
    });

    console.log('Starting upload with params:', {
      bucket: import.meta.env.VITE_BUCKET_NAME,
      key,
      fileDetails: {
        name: file.name,
        type: file.type,
        size: file.size,
        isFile: file instanceof File,
        isBlob: file instanceof Blob
      }
    });

    upload.on("httpUploadProgress", (progress) => {
      const percentage = Math.round((progress.loaded / progress.total) * 100);
      console.log(`Upload progress: ${percentage}%`);
    });

    const response = await upload.done();
    console.log('Upload successful:', response);

    // Log the upload activity
    await logActivity({
      action: 'Upload',
      itemName: file.name,
      size: file.size,
      fileCount: 1
    });

    return response;
  } catch (error) {
    console.error('S3 Upload Error Details:', {
      error,
      errorMessage: error.message,
      errorStack: error.stack,
      fileDetails: file ? {
        name: file.name,
        type: file.type,
        size: file.size,
        constructor: file.constructor?.name,
        isFile: file instanceof File,
        isBlob: file instanceof Blob,
        properties: Object.keys(file)
      } : 'No file object',
      folderName
    });
    throw error;
  }
};

export const listS3Objects = async (prefix = '') => {
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
      lastModified: null,
      size: null
    }));

    const files = (response.Contents || [])
      .filter(item => !EXCLUDED_FILES.includes(item.Key.split('/').pop())) // Filter out excluded files
      .map(item => ({
        key: item.Key,
        name: item.Key.split('/').pop(),
        type: 'file',
        lastModified: item.LastModified,
        size: item.Size
      }))
      .filter(item => item.name); // Filter out empty names (folder markers)

    return [...folders, ...files];
  } catch (error) {
    console.error('Error listing S3 objects:', error);
    throw error;
  }
};

export const deleteS3Object = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting S3 object:', error);
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
      const arrayBuffer = await Body.transformToByteArray();
      const relativePath = item.Key.substring(folderKey.length);
      zip.file(relativePath, arrayBuffer);
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
    console.error('Error downloading folder:', error);
    throw error;
  }
};

export const getFolderSize = async (folderKey) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Prefix: folderKey
    });

    const response = await s3Client.send(command);
    const totalSize = (response.Contents || []).reduce((acc, item) => acc + item.Size, 0);
    return totalSize;
  } catch (error) {
    console.error('Error calculating folder size:', error);
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
    const command = new ListObjectsV2Command({
      Bucket: import.meta.env.VITE_BUCKET_NAME
    });

    const response = await s3Client.send(command);
    
    // Calculate total size and object count
    let totalSize = 0;
    let totalObjects = 0;

    (response.Contents || []).forEach(item => {
      if (!EXCLUDED_FILES.includes(item.Key.split('/').pop())) {
        totalSize += item.Size;
        totalObjects += 1;
      }
    });

    // Calculate costs (AWS S3 Standard Storage pricing)
    const storageRate = 0.023; // per GB per month
    const transferRate = 0.09; // per GB outbound

    const storageGB = totalSize / (1024 * 1024 * 1024); // Convert bytes to GB
    const storageCost = storageGB * storageRate;
    const transferCost = storageGB * transferRate;
    const totalCost = storageCost + transferCost;

    return {
      totalSize,
      totalObjects,
      storageCost,
      transferCost,
      totalCost,
      storageGB
    };
  } catch (error) {
    console.error('Error getting bucket metrics:', error);
    throw error;
  }
};

