import { useState } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Modal, Alert, Form } from 'react-bootstrap';
import { FaDownload, FaClock, FaFolder, FaFile, FaArrowUp, FaPencilAlt } from 'react-icons/fa';
import { useToast } from '../contexts/ToastContext';
import { 
  restoreFromGlacier, 
  checkGlacierStatus, 
  restoreFromGlacierBulk,
  formatFileSize 
} from '../services/s3Service';
import GlacierStats from './GlacierStats';
import './FileBrowser.css';

const RETRIEVAL_TIERS = {
  Expedited: { time: '1-5 minutes', costPerGB: 0.03 },
  Standard: { time: '3-5 hours', costPerGB: 0.01 },
  Bulk: { time: '5-12 hours', costPerGB: 0.0025 }
};

const FileBrowser = ({ 
  currentPath, 
  items = [],
  isLoading = false,
  onNavigate,
  onDownload,
  onRename,
  onRestore,
  glacierStats
}) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreOption, setRestoreOption] = useState('Standard');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleRestore = async (item) => {
    setSelectedItem(item);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    setLoading(true);
    try {
      if (selectedItem.type === 'folder') {
        const result = await restoreFromGlacierBulk(selectedItem.key, restoreOption);
        showToast(
          `Restoration initiated for ${result.restoredFiles} files in ${selectedItem.name}. This may take several hours.`,
          'success'
        );
      } else {
        await restoreFromGlacier(selectedItem.key, restoreOption);
        showToast(
          `Restoration initiated for ${selectedItem.name}. This may take several hours.`,
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

  const handleDownload = async (file) => {
    const glacierStatus = await checkGlacierStatus(file.key);
    if (glacierStatus.isGlacier && !glacierStatus.restoreStatus) {
      handleRestore(file);
      return;
    }
    onDownload && onDownload(file);
  };

  const renderGlacierStatus = (file) => {
    if (file.storageClass === 'GLACIER' || file.storageClass === 'DEEP_ARCHIVE') {
      return (
        <span className="storage-class glacier">
          GLACIER
          {file.restoring && <span className="restore-status">Restoring...</span>}
        </span>
      );
    }
    return <span className="storage-class standard">STANDARD</span>;
  };

  const renderBreadcrumb = () => {
    const parts = currentPath.split('/').filter(Boolean);
    return (
      <div className="breadcrumb-container mb-3">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb m-0">
            <li className="breadcrumb-item">
              <Button 
                variant="link" 
                className="p-0 text-primary" 
                onClick={() => onNavigate('')}
              >
                Home
              </Button>
            </li>
            {parts.map((part, index) => (
              <li 
                key={index} 
                className={`breadcrumb-item ${index === parts.length - 1 ? 'active' : ''}`}
              >
                {index === parts.length - 1 ? (
                  part
                ) : (
                  <Button
                    variant="link"
                    className="p-0 text-primary"
                    onClick={() => onNavigate(parts.slice(0, index + 1).join('/') + '/')}
                  >
                    {part}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>
    );
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="file-browser">
      {glacierStats && <GlacierStats stats={glacierStats} />}
      
      {renderBreadcrumb()}
      
      {currentPath && (
        <div className="back-button mb-3">
          <Button
            variant="light"
            size="sm"
            onClick={() => onNavigate(currentPath.split('/').slice(0, -2).join('/') + '/')}
          >
            <FaArrowUp /> Back to Previous Folder
          </Button>
        </div>
      )}
      
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Storage Class</th>
            <th style={{width: '220px'}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key} className={item.storageClass === 'GLACIER' ? 'glacier-row' : ''}>
              <td>
                <div className="item-name">
                  {item.type === 'folder' ? (
                    <span 
                      className="folder-name"
                      onClick={() => onNavigate(item.key)}
                      style={{ cursor: 'pointer' }}
                    >
                      <FaFolder className="folder-icon" /> {item.name}
                      {item.hasArchivedFiles && (
                        <span className="glacier-indicator ms-2">
                          <FaClock title="Contains archived files" />
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="file-name">
                      <FaFile className="file-icon" /> {item.name}
                    </span>
                  )}
                </div>
              </td>
              <td>{item.type === 'folder' ? '--' : formatFileSize(item.size)}</td>
              <td>{item.type === 'folder' ? '--' : renderGlacierStatus(item)}</td>
              <td>
                <div className="action-buttons">
                  {item.type === 'folder' ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        className="action-btn"
                        onClick={() => onNavigate(item.key)}
                      >
                        <FaFolder /> Open
                      </Button>
                      {item.hasArchivedFiles && (
                        <Button
                          variant="warning"
                          size="sm"
                          className="action-btn"
                          onClick={() => handleRestore(item)}
                        >
                          <FaClock />
                          <span className="btn-text">Restore</span>
                        </Button>
                      )}
                    </>
                  ) : item.storageClass === 'GLACIER' && !item.restoring ? (
                    <Button
                      variant="warning"
                      size="sm"
                      className="action-btn"
                      onClick={() => handleRestore(item)}
                    >
                      <FaClock />
                      <span className="btn-text">Restore</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        className="action-btn"
                        onClick={() => handleDownload(item)}
                        disabled={item.storageClass === 'GLACIER' && !item.restored}
                      >
                        <FaDownload />
                        <span className="btn-text">Download</span>
                      </Button>
                      <Button 
                        variant="secondary"
                        size="sm"
                        className="action-btn"
                        onClick={() => onRename(item)}
                      >
                        <FaPencilAlt />
                        <span className="btn-text">Edit</span>
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan="4" className="text-center">
                This folder is empty
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={showRestoreModal} onHide={() => setShowRestoreModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedItem?.type === 'folder' ? 'Restore Folder from Glacier' : 'Restore from Glacier'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            {selectedItem?.type === 'folder' 
              ? 'Restoring all archived files in this folder from Glacier storage requires additional processing time and costs.'
              : 'Restoring files from Glacier storage requires additional processing time and costs.'
            }
            Choose a retrieval option that best suits your needs.
          </Alert>
          
          <Form>
            <Form.Group>
              <Form.Label>Selected {selectedItem?.type === 'folder' ? 'Folder' : 'File'}: {selectedItem?.name}</Form.Label>
              
              <Form.Select 
                value={restoreOption}
                onChange={(e) => setRestoreOption(e.target.value)}
                className="mt-3"
              >
                {Object.entries(RETRIEVAL_TIERS).map(([tier, info]) => (
                  <option key={tier} value={tier}>
                    {tier} - {info.time}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Alert variant="warning" className="mt-3">
              <strong>Note:</strong> After restoration, the files will be available for download for 7 days.
            </Alert>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRestoreModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={confirmRestore}
            disabled={loading}
          >
            {loading ? 'Initiating Restore...' : 'Restore'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

FileBrowser.propTypes = {
  currentPath: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['file', 'folder']).isRequired,
      size: PropTypes.number,
      lastModified: PropTypes.string,
      storageClass: PropTypes.string,
      hasArchivedFiles: PropTypes.bool,
      restoring: PropTypes.bool,
      restored: PropTypes.bool
    })
  ),
  isLoading: PropTypes.bool,
  onNavigate: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  onRestore: PropTypes.func.isRequired,
  glacierStats: PropTypes.object
};

export default FileBrowser;
