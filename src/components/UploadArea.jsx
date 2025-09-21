import React, { useState, useRef, useCallback } from 'react';
import { Button, Form, ProgressBar, Card, Alert, Spinner } from 'react-bootstrap';
import { FaUpload, FaFolderOpen, FaBoxes, FaCloudUploadAlt } from 'react-icons/fa';
import { uploadToS3 } from '../services/s3Service';
import { useTransfer } from '../contexts/TransferContext';
import { useToast } from '../contexts/ToastContext';
import { isLargeFile, formatFileSize } from '../utils/fileUtils';
import LargeFileTransferModal from './LargeFileTransferModal';
import './UploadArea.css';

const UploadArea = ({ currentPath, onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showLargeFileModal, setShowLargeFileModal] = useState(false);
  const [largeFileInfo, setLargeFileInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const transferContext = useTransfer();
  const { showToast } = useToast();
  
  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Process files for upload
  const processFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    
    // Check if any of the files are very large
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isLargeFile(file.size)) {
        setLargeFileInfo({
          fileName: file.name,
          fileSize: file.size,
          file,
          allFiles: files
        });
        setShowLargeFileModal(true);
        return;
      }
    }
    
    // If no large files, proceed with upload
    await uploadFiles(files);
  }, [currentPath]);
  
  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    processFiles(files);
  }, [processFiles]);
  
  // Handle file input change
  const handleFileChange = useCallback((e) => {
    const files = e.target.files;
    processFiles(files);
    
    // Reset the input
    if (e.target) {
      e.target.value = null;
    }
  }, [processFiles]);
  
  // Upload the files
  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      // Convert FileList to Array for easier handling
      const fileArray = Array.from(files);
      const totalSize = fileArray.reduce((total, file) => total + file.size, 0);
      
      // Show warning for extremely large uploads
      if (totalSize > 10 * 1024 * 1024 * 1024) { // 10GB
        showToast(`Warning: Uploading ${formatFileSize(totalSize)} of data. This may take a long time.`, 'warning');
      }
      
      // Process each file
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const filePath = currentPath ? `${currentPath}${file.name}` : file.name;
        
        try {
          // Get directory path from webkitRelativePath if available (for folder uploads)
          let fullPath = filePath;
          if (file.webkitRelativePath) {
            fullPath = currentPath ? `${currentPath}${file.webkitRelativePath}` : file.webkitRelativePath;
          }
          
          // For very large files, show specific toast
          if (file.size > 1024 * 1024 * 1024) { // 1GB
            showToast(`Uploading large file: ${file.name} (${formatFileSize(file.size)})`, 'info');
          }
          
          await uploadToS3(
            file, 
            fullPath, 
            () => {}, // Progress is handled by the TransferContext
            transferContext
          );
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
          // Continue with other files
        }
      }
      
      showToast(`${fileArray.length} file(s) uploaded successfully`, 'success');
      onUploadComplete && onUploadComplete();
    } catch (error) {
      showToast(`Upload failed: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };
  
  // Continue with large file upload
  const handleLargeFileConfirm = () => {
    setShowLargeFileModal(false);
    uploadFiles(largeFileInfo.allFiles);
  };
  
  return (
    <>
      <Card 
        className={`upload-area ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Card.Body className="d-flex flex-column align-items-center justify-content-center p-5">
          {isUploading ? (
            <div className="text-center">
              <Spinner animation="border" variant="primary" className="mb-3" />
              <p>Preparing upload...</p>
            </div>
          ) : (
            <>
              <FaCloudUploadAlt className="upload-icon mb-3" />
              <h5>Drop Files Into The Bucket</h5>
              <p className="text-muted mb-4">or choose files using the options below</p>
              
              <div className="d-flex gap-3">
                <Button 
                  variant="primary" 
                  onClick={() => fileInputRef.current?.click()}
                  size="lg"
                  className="px-4"
                >
                  <FaUpload className="me-2" />
                  Add Files
                </Button>
                
                <Button 
                  variant="outline-primary" 
                  onClick={() => folderInputRef.current?.click()}
                  size="lg"
                  className="px-4"
                >
                  <FaFolderOpen className="me-2" />
                  Add Folder
                </Button>
              </div>
              
              <Form.Text className="text-muted mt-3">
                <strong>Storage Bucket</strong> • Supports files up to 500GB in size
              </Form.Text>
            </>
          )}
        </Card.Body>
      </Card>
      
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        multiple
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        webkitdirectory=""
      />
      
      {/* Large file transfer modal */}
      <LargeFileTransferModal
        show={showLargeFileModal}
        onHide={() => setShowLargeFileModal(false)}
        fileSize={largeFileInfo?.fileSize}
        fileName={largeFileInfo?.fileName}
        transferType="upload"
        onConfirm={handleLargeFileConfirm}
      />
    </>
  );
};

export default UploadArea;
