/**
 * Utility functions for file handling operations
 */

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places to show
 * @returns {string} Formatted size string
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Calculate the estimated time remaining for a transfer
 * @param {number} bytesRemaining - Number of bytes remaining
 * @param {number} bytesPerSecond - Current transfer speed in bytes per second
 * @returns {string} Formatted time string
 */
export const formatTimeRemaining = (bytesRemaining, bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond <= 0) {
    return 'calculating...';
  }
  
  const seconds = Math.round(bytesRemaining / bytesPerSecond);
  
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Determine if a file is considered "large" (requires special handling)
 * @param {number} sizeInBytes - Size of the file in bytes
 * @returns {boolean} True if the file is large
 */
export const isLargeFile = (sizeInBytes) => {
  const LARGE_FILE_THRESHOLD = 1024 * 1024 * 1024; // 1GB
  return sizeInBytes > LARGE_FILE_THRESHOLD;
};

/**
 * Get an appropriate chunk size for a file based on its size
 * @param {number} fileSizeInBytes - Size of the file in bytes
 * @returns {number} Optimal chunk size in bytes
 */
export const getOptimalChunkSize = (fileSizeInBytes) => {
  // For files less than 100MB, use 5MB chunks
  if (fileSizeInBytes < 100 * 1024 * 1024) {
    return 5 * 1024 * 1024; // 5MB
  }
  
  // For files less than 1GB, use 10MB chunks
  if (fileSizeInBytes < 1024 * 1024 * 1024) {
    return 10 * 1024 * 1024; // 10MB
  }
  
  // For files 1GB to 5GB, use smaller 25MB chunks for more reliability
  if (fileSizeInBytes < 5 * 1024 * 1024 * 1024) {
    return 25 * 1024 * 1024; // 25MB
  }
  
  // For files 5GB to 10GB, use 50MB chunks
  if (fileSizeInBytes < 10 * 1024 * 1024 * 1024) {
    return 50 * 1024 * 1024; // 50MB
  }
  
  // For larger files, limit to 100MB chunks to avoid memory issues
  return 100 * 1024 * 1024; // 100MB
};

/**
 * Calculate transfer speed based on bytes transferred and time elapsed
 * @param {number} bytesDelta - Number of bytes transferred since last update
 * @param {number} timeElapsedMs - Time elapsed in milliseconds since last update
 * @returns {number} Transfer speed in bytes per second
 */
export const calculateTransferSpeed = (bytesDelta, timeElapsedMs) => {
  if (timeElapsedMs <= 0) return 0;
  return Math.round(bytesDelta / (timeElapsedMs / 1000));
};

/**
 * Detect file type based on file extension
 * @param {string} filename - Name of the file
 * @returns {string} File type category
 */
export const detectFileType = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'].includes(extension)) {
    return 'image';
  }
  
  // Videos
  if (['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv', 'm4v'].includes(extension)) {
    return 'video';
  }
  
  // Documents
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt'].includes(extension)) {
    return 'document';
  }
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
    return 'archive';
  }
  
  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(extension)) {
    return 'audio';
  }
  
  return 'other';
};

/**
 * Split a large file into an array of chunks for processing
 * @param {File} file - The file to split
 * @param {number} chunkSize - Size of each chunk in bytes
 * @returns {Array} Array of Blob chunks
 */
export const splitFileIntoChunks = (file, chunkSize) => {
  const chunks = [];
  let offset = 0;
  
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    chunks.push(chunk);
    offset += chunkSize;
  }
  
  return chunks;
};

export default {
  formatFileSize,
  formatTimeRemaining,
  isLargeFile,
  getOptimalChunkSize,
  calculateTransferSpeed,
  detectFileType,
  splitFileIntoChunks
};
