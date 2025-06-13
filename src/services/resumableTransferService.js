import { 
  S3Client, 
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  GetObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { getOptimalChunkSize } from '../utils/fileUtils';

// Initialize S3 client
const s3Client = new S3Client({
  region: import.meta.env.VITE_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_SECRET_KEY
  },
  forcePathStyle: false,
  maxAttempts: 3
});

/**
 * Resume a previously started multipart upload
 * 
 * @param {string} key - The object key in S3
 * @param {File} file - The file to upload
 * @param {string} uploadId - The ID of the multipart upload to resume
 * @param {function} onProgress - Progress callback function
 * @returns {Object} Upload result
 */
export const resumeMultipartUpload = async (key, file, uploadId, onProgress = () => {}) => {
  try {
    // List already uploaded parts
    const listPartsCommand = new ListPartsCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key,
      UploadId: uploadId
    });
    
    const listPartsResponse = await s3Client.send(listPartsCommand);
    const uploadedParts = listPartsResponse.Parts || [];
    
    // Map part numbers to ETags
    const existingParts = uploadedParts.reduce((acc, part) => {
      acc[part.PartNumber] = part.ETag;
      return acc;
    }, {});
    
    // Calculate optimal chunk size
    const chunkSize = getOptimalChunkSize(file.size);
    const numParts = Math.ceil(file.size / chunkSize);
    
    // Calculate how much has been uploaded already
    let uploadedBytes = 0;
    uploadedParts.forEach(part => {
      uploadedBytes += part.Size;
    });
    
    // Report initial progress
    onProgress({
      loaded: uploadedBytes,
      total: file.size,
      percentage: Math.round((uploadedBytes / file.size) * 100)
    });
    
    // Upload remaining parts
    const newParts = [];
    
    for (let i = 0; i < numParts; i++) {
      const partNumber = i + 1;
      
      // Skip already uploaded parts
      if (existingParts[partNumber]) {
        newParts.push({
          ETag: existingParts[partNumber],
          PartNumber: partNumber
        });
        continue;
      }
      
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const uploadPartCommand = new UploadPartCommand({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: chunk
      });
      
      const uploadPartResponse = await s3Client.send(uploadPartCommand);
      
      newParts.push({
        ETag: uploadPartResponse.ETag,
        PartNumber: partNumber
      });
      
      // Update progress
      uploadedBytes += (end - start);
      onProgress({
        loaded: uploadedBytes,
        total: file.size,
        percentage: Math.round((uploadedBytes / file.size) * 100)
      });
    }
    
    // Complete the multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: newParts.sort((a, b) => a.PartNumber - b.PartNumber)
      }
    });
    
    await s3Client.send(completeCommand);
    
    return { success: true, key };
  } catch (error) {
    console.error('Error resuming multipart upload:', error);
    throw error;
  }
};

/**
 * Function to save upload state for resuming later
 * 
 * @param {string} key - The object key in S3
 * @param {string} uploadId - The ID of the multipart upload
 * @param {number} fileSize - The total size of the file
 * @param {string} fileName - The name of the file
 */
export const saveUploadState = (key, uploadId, fileSize, fileName) => {
  try {
    const uploads = JSON.parse(localStorage.getItem('pendingUploads') || '{}');
    
    uploads[key] = {
      uploadId,
      fileSize,
      fileName,
      timestamp: Date.now()
    };
    
    localStorage.setItem('pendingUploads', JSON.stringify(uploads));
  } catch (error) {
    console.error('Error saving upload state:', error);
  }
};

/**
 * Function to get saved upload state
 * 
 * @param {string} key - The object key in S3
 * @returns {Object|null} The saved upload state or null if not found
 */
export const getSavedUploadState = (key) => {
  try {
    const uploads = JSON.parse(localStorage.getItem('pendingUploads') || '{}');
    return uploads[key] || null;
  } catch (error) {
    console.error('Error getting saved upload state:', error);
    return null;
  }
};

/**
 * Function to clear saved upload state
 * 
 * @param {string} key - The object key in S3
 */
export const clearUploadState = (key) => {
  try {
    const uploads = JSON.parse(localStorage.getItem('pendingUploads') || '{}');
    
    if (uploads[key]) {
      delete uploads[key];
      localStorage.setItem('pendingUploads', JSON.stringify(uploads));
    }
  } catch (error) {
    console.error('Error clearing upload state:', error);
  }
};

/**
 * Resumable download function for large files
 * 
 * @param {string} key - The object key in S3
 * @param {number} totalSize - The total size of the file
 * @param {function} onProgress - Progress callback function
 * @param {number} startByte - The byte to start downloading from
 * @returns {Blob} The downloaded file as a Blob
 */
export const resumableDownload = async (key, totalSize, onProgress = () => {}, startByte = 0) => {
  try {
    // Optimal chunk size for download
    const chunkSize = getOptimalChunkSize(totalSize);
    
    // Calculate number of chunks
    const numChunks = Math.ceil((totalSize - startByte) / chunkSize);
    
    // Array to store chunks
    const chunks = [];
    
    // Download in chunks
    for (let i = 0; i < numChunks; i++) {
      const start = startByte + (i * chunkSize);
      const end = Math.min(start + chunkSize, totalSize) - 1;
      
      const command = new GetObjectCommand({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: key,
        Range: `bytes=${start}-${end}`
      });
      
      const response = await s3Client.send(command);
      const chunk = await response.Body.transformToByteArray();
      chunks.push(chunk);
      
      // Update progress
      const downloaded = end + 1;
      onProgress({
        loaded: downloaded,
        total: totalSize,
        percentage: Math.round((downloaded / totalSize) * 100)
      });
      
      // Save download state for potential resume
      saveDownloadState(key, downloaded, totalSize);
    }
    
    // Combine chunks into a single blob
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    
    // Clear download state since it's complete
    clearDownloadState(key);
    
    return blob;
  } catch (error) {
    console.error('Error during resumable download:', error);
    throw error;
  }
};

/**
 * Function to save download state for resuming later
 * 
 * @param {string} key - The object key in S3
 * @param {number} downloadedBytes - Number of bytes downloaded so far
 * @param {number} totalSize - Total size of the file
 */
export const saveDownloadState = (key, downloadedBytes, totalSize) => {
  try {
    const downloads = JSON.parse(localStorage.getItem('pendingDownloads') || '{}');
    
    downloads[key] = {
      downloadedBytes,
      totalSize,
      timestamp: Date.now()
    };
    
    localStorage.setItem('pendingDownloads', JSON.stringify(downloads));
  } catch (error) {
    console.error('Error saving download state:', error);
  }
};

/**
 * Function to get saved download state
 * 
 * @param {string} key - The object key in S3
 * @returns {Object|null} The saved download state or null if not found
 */
export const getSavedDownloadState = (key) => {
  try {
    const downloads = JSON.parse(localStorage.getItem('pendingDownloads') || '{}');
    return downloads[key] || null;
  } catch (error) {
    console.error('Error getting saved download state:', error);
    return null;
  }
};

/**
 * Function to clear saved download state
 * 
 * @param {string} key - The object key in S3
 */
export const clearDownloadState = (key) => {
  try {
    const downloads = JSON.parse(localStorage.getItem('pendingDownloads') || '{}');
    
    if (downloads[key]) {
      delete downloads[key];
      localStorage.setItem('pendingDownloads', JSON.stringify(downloads));
    }
  } catch (error) {
    console.error('Error clearing download state:', error);
  }
};

export default {
  resumeMultipartUpload,
  saveUploadState,
  getSavedUploadState,
  clearUploadState,
  resumableDownload,
  saveDownloadState,
  getSavedDownloadState,
  clearDownloadState
};
