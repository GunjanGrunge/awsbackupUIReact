import React, { useState, useRef, useCallback } from 'react';
import { Button, Form, ProgressBar, Card, Alert, Spinner } from 'react-bootstrap';
import { FaUpload, FaFolderOpen, FaDownload } from 'react-icons/fa';
import { uploadToS3 } from '../services/s3Service';
import { useTransfer } from '../contexts/TransferContext';
import { useToast } from '../contexts/ToastContext';
import { isLargeFile } from '../utils/fileUtils';
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
    setIsUploading(true);
    
    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = currentPath ? `${currentPath}${file.name}` : file.name;
          await uploadToS3(
          file, 
          filePath, 
          () => {}, // Progress is handled by the TransferContext
          transferContext
        );
      }
      
      showToast(`${files.length} file(s) uploaded successfully`, 'success');
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
              <FaUpload className="upload-icon mb-3" />
              <h5>Drag & Drop Files Here</h5>
              <p className="text-muted mb-4">or select files using the buttons below</p>
              
              <div className="d-flex gap-3">
                <Button 
                  variant="primary" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FaUpload className="me-2" />
                  Select Files
                </Button>
                
                <Button 
                  variant="outline-primary" 
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FaFolderOpen className="me-2" />
                  Select Folder
                </Button>
              </div>
              
              <Form.Text className="text-muted mt-3">
                Supports files up to 50GB in size
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
        directory=""
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
