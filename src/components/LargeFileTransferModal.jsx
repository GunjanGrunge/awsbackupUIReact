import React, { useState } from 'react';
import { Modal, Button, Alert } from 'react-bootstrap';
import { formatFileSize } from '../utils/fileUtils';

const LargeFileTransferModal = ({ 
  show, 
  onHide, 
  fileSize, 
  fileName, 
  transferType, 
  onConfirm 
}) => {
  const [showAdvancedInfo, setShowAdvancedInfo] = useState(false);
  
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Large File Transfer</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info">
          <Alert.Heading>You're about to {transferType} a large file</Alert.Heading>
          <p>
            You're about to {transferType} <strong>{fileName}</strong> ({formatFileSize(fileSize)})
          </p>
          <p>
            Files of this size require special handling to ensure reliable transfer.
            The process may take a while, but you can continue working while the transfer runs in the background.
          </p>
          {transferType === 'upload' && (
            <p>
              If the upload is interrupted, you'll be able to resume it from where it left off.
            </p>
          )}
          {transferType === 'download' && (
            <p>
              If the download is interrupted, you'll be able to resume it from where it left off.
            </p>
          )}
        </Alert>
        
        <Button 
          variant="link" 
          className="p-0 mb-3" 
          onClick={() => setShowAdvancedInfo(!showAdvancedInfo)}
        >
          {showAdvancedInfo ? 'Hide' : 'Show'} advanced information
        </Button>
        
        {showAdvancedInfo && (
          <div className="advanced-info">
            <h6>Transfer Process</h6>
            <ul>
              <li>The file will be split into multiple chunks for more reliable transfer</li>
              <li>A progress bar will show the status of the transfer</li>
              <li>You can pause and resume the transfer at any time</li>
              <li>If your connection is interrupted, you can resume later from where you left off</li>
              <li>For files in Glacier storage, a restoration process will need to complete before download</li>
            </ul>
            
            <h6>Recommendations</h6>
            <ul>
              <li>Make sure you have a stable internet connection</li>
              <li>Keep your computer from going to sleep during transfer</li>
              <li>For very large files (larger than 10GB), use a wired connection if possible</li>
            </ul>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Continue with Transfer
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LargeFileTransferModal;
