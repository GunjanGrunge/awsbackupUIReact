import { 
  S3Client, 
  ListObjectsV2Command, 
  PutObjectCommand, 
  HeadObjectCommand, 
  RestoreObjectCommand, 
  DeleteObjectCommand, 
  DeleteObjectsCommand, 
  GetObjectCommand, 
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import JSZip from 'jszip';

// Optimized chunk size for large files - 100MB per chunk
const OPTIMAL_CHUNK_SIZE = 100 * 1024 * 1024; // 100MB
// For files larger than this, we'll use multipart upload with manual control
const LARGE_FILE_THRESHOLD = 1024 * 1024 * 1024; // 1GB

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

// Enhanced upload function with better handling for large files
const uploadToS3Enhanced = async (file, filePath, onProgress = () => {}, transferContext = null) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!(file instanceof Blob || file instanceof File)) {
      throw new Error('Invalid file type - must be File or Blob');
    }

    // Clean up the file path
    const cleanPath = filePath
      .replace(/^\.\//, '')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\\/g, '/');

    const fileName = cleanPath.split('/').pop();
    const fileSize = file.size;
    
    // Create a transfer ID if using the transfer context
    let transferId = null;
    if (transferContext) {
      transferId = transferContext.addTransfer({
        name: fileName,
        type: 'upload',
        size: fileSize
      });
    }

    try {
      // For very large files (>1GB), use manual multipart upload for better control
      if (fileSize > LARGE_FILE_THRESHOLD) {
        await uploadLargeFile(file, cleanPath, fileSize, (progress) => {
          onProgress(progress);
          if (transferContext && transferId) {
            transferContext.updateTransferProgress(transferId, progress.loaded, progress.total);
          }
        });
      } else {
        // For smaller files, use the AWS SDK's Upload utility
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: import.meta.env.VITE_BUCKET_NAME,
            Key: cleanPath,
            Body: file,
            ContentType: file.type || 'application/octet-stream'
          },
          queueSize: 4,
          partSize: 10 * 1024 * 1024, // 10MB parts
          leavePartsOnError: false
        });

        // Add progress handling
        upload.on("httpUploadProgress", (progress) => {
          const percentage = Math.round((progress.loaded / progress.total) * 100);
          onProgress({ loaded: progress.loaded, total: progress.total, percentage });
          
          if (transferContext && transferId) {
            transferContext.updateTransferProgress(transferId, progress.loaded, progress.total);
          }
        });

        await upload.done();
      }

      // Complete the transfer
      if (transferContext && transferId) {
        transferContext.completeTransfer(transferId);
      }

      // Log the upload activity
      await logActivity({
        action: 'Upload',
        itemName: fileName,
        size: fileSize,
        fileCount: 1
      });

      return { success: true, key: cleanPath };
    } catch (error) {
      if (transferContext && transferId) {
        transferContext.errorTransfer(transferId, error);
      }
      throw error;
    }
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Function to handle very large file uploads with manual multipart control
const uploadLargeFile = async (file, key, fileSize, onProgress) => {
  // Initiate multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: import.meta.env.VITE_BUCKET_NAME,
    Key: key,
    ContentType: file.type || 'application/octet-stream'
  });
  
  const { UploadId } = await s3Client.send(createCommand);
  
  try {
    // Calculate number of parts
    const numParts = Math.ceil(fileSize / OPTIMAL_CHUNK_SIZE);
    const uploadPromises = [];
    const uploadedParts = [];
    
    // Upload each part
    for (let i = 0; i < numParts; i++) {
      const start = i * OPTIMAL_CHUNK_SIZE;
      const end = Math.min(start + OPTIMAL_CHUNK_SIZE, fileSize);
      const partNumber = i + 1;
      
      // Prepare part upload
      const chunk = file.slice(start, end);
      const uploadPartCommand = new UploadPartCommand({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: key,
        PartNumber: partNumber,
        UploadId,
        Body: chunk
      });
      
      // Use a function to track progress for each part
      const uploadPartWithProgress = async () => {
        const response = await s3Client.send(uploadPartCommand);
        
        // Update progress
        const uploaded = Math.min(end, fileSize);
        onProgress({
          loaded: uploaded,
          total: fileSize,
          percentage: Math.round((uploaded / fileSize) * 100)
        });
        
        return {
          ETag: response.ETag,
          PartNumber: partNumber
        };
      };
      
      uploadPromises.push(uploadPartWithProgress());
    }
    
    // Wait for all parts to upload
    const results = await Promise.all(uploadPromises);
    
    // Complete the multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key,
      UploadId,
      MultipartUpload: {
        Parts: results.sort((a, b) => a.PartNumber - b.PartNumber)
      }
    });
    
    await s3Client.send(completeCommand);
    return { success: true };
  } catch (error) {
    // Abort the multipart upload if something goes wrong
    try {
      await s3Client.send(new AbortMultipartUploadCommand({
        Bucket: import.meta.env.VITE_BUCKET_NAME,
        Key: key,
        UploadId
      }));
    } catch (abortError) {
      console.error('Error aborting multipart upload:', abortError);
    }
    throw error;
  }
};

// Enhanced download function for large files with progress tracking
const getS3DownloadUrlEnhanced = async (key, size, transferContext = null) => {
  try {
    // Determine if the file is in Glacier
    const glacierStatus = await checkGlacierStatus(key);
    if (glacierStatus.isGlacier && !glacierStatus.restoreStatus?.ongoingRequest === false) {
      throw new Error('File is in Glacier storage and not yet restored');
    }

    const command = new GetObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: key
    });

    // Get the file name from the key
    const fileName = key.split('/').pop();

    // Log the download activity
    await logActivity({
      action: 'Download',
      itemName: fileName,
      size: size,
      fileCount: 1
    });

    // For large files, we'll use a different approach with progress tracking
    if (size > 50 * 1024 * 1024) { // 50MB
      return downloadLargeFile(key, fileName, size, transferContext);
    } else {
      // For smaller files, use signed URL
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      // Create transfer record if context provided
      if (transferContext) {
        const transferId = transferContext.addTransfer({
          name: fileName,
          type: 'download',
          size: size
        });

        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);

        // Set up XHR to track progress
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';

        xhr.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            transferContext.updateTransferProgress(transferId, event.loaded, event.total);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            // Download completed successfully
            const blob = new Blob([xhr.response]);
            const downloadUrl = window.URL.createObjectURL(blob);
            a.href = downloadUrl;
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            transferContext.completeTransfer(transferId);
          } else {
            transferContext.errorTransfer(transferId, new Error('Download failed'));
          }
          document.body.removeChild(a);
        });

        xhr.addEventListener('error', () => {
          transferContext.errorTransfer(transferId, new Error('Download failed'));
          document.body.removeChild(a);
        });

        xhr.send();
        return { success: true };
      }

      return url;
    }
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }
};

// Function to handle downloading very large files with better progress tracking
const downloadLargeFile = async (key, fileName, totalSize, transferContext) => {
  if (!transferContext) {
    throw new Error('Transfer context is required for large file downloads');
  }

  const transferId = transferContext.addTransfer({
    name: fileName,
    type: 'download',
    size: totalSize
  });

  try {
    // Optimal chunk size for download
    const chunkSize = 50 * 1024 * 1024; // 50MB
    const numChunks = Math.ceil(totalSize / chunkSize);
    const chunks = [];

    // Fetch file in chunks
    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
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
      transferContext.updateTransferProgress(transferId, downloaded, totalSize);
    }

    // Combine chunks and download
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    transferContext.completeTransfer(transferId);
    
    return { success: true };
  } catch (error) {
    transferContext.errorTransfer(transferId, error);
    throw error;
  }
};

// Enhanced function to download a folder with better progress tracking for large files
const downloadFolderEnhanced = async (folderKey, transferContext = null) => {
  try {
    const zip = new JSZip();
    const objects = await getAllObjects(folderKey);
    
    if (objects.length === 0) {
      throw new Error('No files found in folder');
    }

    // Calculate total size for progress tracking
    const totalSize = objects.reduce((sum, obj) => sum + obj.Size, 0);
    const folderName = folderKey.split('/').slice(-2)[0];
    
    let transferId = null;
    if (transferContext) {
      transferId = transferContext.addTransfer({
        name: `${folderName}.zip`,
        type: 'download',
        size: totalSize,
        fileCount: objects.length
      });
    }

    let processedSize = 0;

    // Process objects in batches to avoid memory issues with very large folders
    const batchSize = 10;
    for (let i = 0; i < objects.length; i += batchSize) {
      const batch = objects.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (obj) => {
        try {
          // Check if file is in Glacier and restored
          const glacierStatus = await checkGlacierStatus(obj.Key);
          if (glacierStatus.isGlacier && !glacierStatus.restoreStatus?.ongoingRequest === false) {
            // Skip files that are in Glacier and not restored
            processedSize += obj.Size;
            return;
          }
          
          const command = new GetObjectCommand({
            Bucket: import.meta.env.VITE_BUCKET_NAME,
            Key: obj.Key
          });
          
          const response = await s3Client.send(command);
          const data = await response.Body.transformToByteArray();
          
          // Add file to zip
          const relativePath = obj.Key.substring(folderKey.length);
          zip.file(relativePath, data);
          
          // Update progress
          processedSize += obj.Size;
          if (transferContext && transferId) {
            transferContext.updateTransferProgress(transferId, processedSize, totalSize);
          }
        } catch (error) {
          console.error(`Error processing file ${obj.Key}:`, error);
          // Continue with other files
        }
      }));
    }

    // Generate the zip file
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 }
    }, (metadata) => {
      if (transferContext && transferId) {
        // Update progress during zip generation
        const zipProgress = Math.round(metadata.percent);
        transferContext.updateTransfer(transferId, {
          progress: zipProgress,
          status: 'compressing'
        });
      }
    });

    // Create download link
    const url = window.URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = folderKey.split('/').slice(-2)[0] + '.zip';
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    if (transferContext && transferId) {
      transferContext.completeTransfer(transferId);
    }

    return { success: true };
  } catch (error) {
    console.error('Error downloading folder:', error);
    throw error;
  }
};

// Expose the enhanced methods
export {
  uploadToS3Enhanced,
  getS3DownloadUrlEnhanced,
  downloadFolderEnhanced
};
