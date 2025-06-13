import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Modal, Alert, Form, Badge, ProgressBar, Spinner } from 'react-bootstrap';
import { 
  FaDownload, 
  FaClock, 
  FaFolder, 
  FaFile, 
  FaArrowUp, 
  FaPencilAlt,
  FaPause,
  FaPlay
} from 'react-icons/fa';
import { useToast } from '../contexts/ToastContext';
import { useTransfer } from '../contexts/TransferContext';
import { 
  checkGlacierStatus, 
  restoreFromGlacier, 
  restoreFromGlacierBulk,
  GLACIER_RETRIEVAL_TIERS,
  uploadToS3,
  getS3DownloadUrl,
  downloadFolder,
  formatFileSize
} from '../services/s3Service';
import GlacierStats from './GlacierStats';
import './FileBrowser.css';

const EnhancedFileBrowser = ({ 
  currentPath, 
  items = [],
  isLoading = false,
  onNavigate,
  onUpload,
  onRename,
  onRestore,
  glacierStats
}) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreOption, setRestoreOption] = useState('Standard');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { transfers, addTransfer, updateTransferProgress, completeTransfer, errorTransfer } = useTransfer();

  // Convert lastModified date to string if it's a Date object
  const formatItems = items.map(item => ({
    ...item,
    lastModified: item.lastModified instanceof Date ? 
      item.lastModified.toLocaleString() : 
      item.lastModified
  }));

  const handleRestore = async (item) => {
    setSelectedItem(item);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    setLoading(true);
    try {
      if (selectedItem.type === 'folder') {
        const result = await restoreFromGlacierBulk(
          selectedItem.key, 
          restoreOption, 
          { addTransfer, updateTransferProgress, completeTransfer, errorTransfer, transfers }
        );
        
        showToast(
          `Restoration initiated for ${result.restoredFiles} files in ${selectedItem.name}. This may take several hours.`,
          'success'
        );
      } else {
        await restoreFromGlacier(
          selectedItem.key, 
          restoreOption, 
          { addTransfer, updateTransferProgress, completeTransfer, errorTransfer, transfers }
        );
        
        showToast(
          `Restoration initiated for ${selectedItem.name}. This may take ${GLACIER_RETRIEVAL_TIERS[restoreOption].time}.`,
          'success'
        );
      }
      setShowRestoreModal(false);
      onRestore && onRestore();
    } catch (error) {
      showToast(`Error initiating restore: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced download function that handles large files and Glacier
  const handleDownload = async (file) => {
    try {
      const glacierStatus = await checkGlacierStatus(file.key);
      
      // If file is in Glacier and not restored, prompt for restore
      if (glacierStatus.isGlacier && !glacierStatus.restoreStatus?.isReady) {
        handleRestore(file);
        return;
      }
        // For folders, use enhanced folder download
      if (file.type === 'folder') {
        await downloadFolder(
          file.key, 
          { addTransfer, updateTransferProgress, completeTransfer, errorTransfer, transfers }
        );
        return;
      }
      
      // For regular files, use enhanced download
      await getS3DownloadUrl(
        file.key, 
        file.size || 0, 
        { addTransfer, updateTransferProgress, completeTransfer, errorTransfer, transfers }
      );
    } catch (error) {
      showToast(`Error downloading file: ${error.message}`, 'error');
    }
  };

  // Enhanced upload function that handles large files
  const handleUpload = useCallback(async (file, targetPath) => {
    try {
      const filePath = targetPath ? `${targetPath}${file.name}` : file.name;
      
      await uploadToS3(
        file, 
        filePath, 
        (progress) => {}, // Progress is handled by the transfer context
        { addTransfer, updateTransferProgress, completeTransfer, errorTransfer, transfers }
      );
      
      onUpload && onUpload();
    } catch (error) {
      showToast(`Error uploading file: ${error.message}`, 'error');
    }
  }, [onUpload, addTransfer, updateTransferProgress, completeTransfer, errorTransfer, transfers, showToast]);

  const renderGlacierStatus = (file) => {
    if (file.storageClass === 'GLACIER' || file.storageClass === 'DEEP_ARCHIVE') {
      return (
        <Badge bg="info" className="glacier-badge">
          {file.storageClass}
          {file.restoring && <span className="restore-status ms-1">Restoring...</span>}
        </Badge>
      );
    }
    return <Badge bg="secondary" className="standard-badge">STANDARD</Badge>;
  };

  const renderBreadcrumb = () => {
    const parts = currentPath.split('/').filter(Boolean);
    return (
      <div className="breadcrumb-container mb-3">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb m-0">
            <li className="breadcrumb-item">
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate(''); }}>
                Home
              </a>
            </li>
            {parts.map((part, i) => {
              // Build the path up to this part
              const path = parts.slice(0, i + 1).join('/') + '/';
              return (
                <li key={path} className={`breadcrumb-item ${i === parts.length - 1 ? 'active' : ''}`}>
                  {i === parts.length - 1 ? (
                    part
                  ) : (
                    <a href="#" onClick={(e) => { e.preventDefault(); onNavigate(path); }}>
                      {part}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    );
  };

  return (
    <div className="file-browser">
      {renderBreadcrumb()}
      
      {glacierStats && <GlacierStats stats={glacierStats} />}
      
      {isLoading ? (
        <div className="text-center p-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      ) : (
        <Table striped hover responsive className="file-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Last Modified</th>
              <th>Storage Class</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {formatItems.map((item) => (
              <tr key={item.key}>
                <td>
                  {item.type === 'folder' ? (
                    <div 
                      className="folder-name" 
                      onClick={() => onNavigate(item.key)}
                    >
                      <FaFolder className="me-2 text-warning" />
                      {item.name}
                      {item.hasArchivedFiles && (
                        <Badge bg="info" pill className="ms-2">
                          Glacier
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="file-name">
                      <FaFile className="me-2 text-primary" />
                      {item.name}
                    </div>
                  )}
                </td>
                <td>{item.size ? formatFileSize(item.size) : '-'}</td>
                <td>{item.lastModified || '-'}</td>
                <td>{item.storageClass ? renderGlacierStatus(item) : '-'}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      onClick={() => handleDownload(item)}
                      title="Download"
                    >
                      <FaDownload />
                    </Button>
                    
                    {(item.storageClass === 'GLACIER' || item.storageClass === 'DEEP_ARCHIVE') && (
                      <Button 
                        variant="outline-warning" 
                        size="sm" 
                        onClick={() => handleRestore(item)}
                        title="Restore from Glacier"
                      >
                        <FaClock />
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline-secondary" 
                      size="sm" 
                      onClick={() => onRename(item)}
                      title="Rename"
                    >
                      <FaPencilAlt />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {formatItems.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center">
                  No items found in this location
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
      
      {/* Restore Modal */}
      <Modal show={showRestoreModal} onHide={() => !loading && setShowRestoreModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Restore from Glacier</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            You are about to restore <strong>{selectedItem?.name}</strong> from Glacier storage.
            {selectedItem?.type === 'folder' && ' This will restore all files in this folder.'}
          </p>
          
          <Alert variant="info">
            <p className="mb-1">
              <strong>Important:</strong> Restoration is not immediate and may take several hours depending on the retrieval option selected.
            </p>
          </Alert>
          
          <Form.Group className="mb-3">
            <Form.Label>Retrieval Option</Form.Label>
            <Form.Select 
              value={restoreOption}
              onChange={(e) => setRestoreOption(e.target.value)}
              disabled={loading}
            >
              {Object.entries(GLACIER_RETRIEVAL_TIERS).map(([tier, info]) => (
                <option key={tier} value={tier}>
                  {tier} ({info.time}, ${info.costPerGB}/GB)
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              {GLACIER_RETRIEVAL_TIERS[restoreOption]?.description}
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRestoreModal(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmRestore} disabled={loading}>
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Initiating...
              </>
            ) : (
              'Restore'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

EnhancedFileBrowser.propTypes = {
  currentPath: PropTypes.string.isRequired,
  items: PropTypes.array,
  isLoading: PropTypes.bool,
  onNavigate: PropTypes.func.isRequired,
  onUpload: PropTypes.func,
  onRename: PropTypes.func,
  onRestore: PropTypes.func,
  glacierStats: PropTypes.object
};

export default EnhancedFileBrowser;
