import { useState, useEffect } from 'react';
import { Container, Form, Button, Modal } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  listS3Objects, 
  downloadFolder, 
  getS3DownloadUrl,
  restoreFromGlacier,
  getGlacierStats,
  checkGlacierStatus,
  renameS3Object
} from './services/s3Service';
import { useToast } from './contexts/ToastContext';
import { useTransfer } from './contexts/TransferContext';
import FileBrowser from './components/FileBrowser';
import { FaCheckCircle } from 'react-icons/fa';
import welcomeImage from './src/images/4569774.jpg';

const Folder = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [itemToRestore, setItemToRestore] = useState(null);
  const [newName, setNewName] = useState('');
  const [glacierStats, setGlacierStats] = useState(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const transferContext = useTransfer();
  
  // Fetch items and glacier stats on component mount and path change
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const path = queryParams.get('path') || '';
    setCurrentPath(path);
    loadFolderContents(path);
    loadGlacierStats(path);
  }, [location, loadFolderContents, loadGlacierStats]);
  
  // Load folder contents
  const loadFolderContents = async (path) => {
    setLoading(true);
    try {
      const result = await listS3Objects(path);
      setItems(result);
    } catch (error) {
      showToast(`Error loading folder: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load Glacier statistics
  const loadGlacierStats = async (path) => {
    try {
      const stats = await getGlacierStats(path);
      setGlacierStats(stats);
    } catch (error) {
      console.error('Error loading Glacier stats:', error);
      showToast('Error loading storage statistics', 'error');
    }
  };
  
  // Handle navigation to a folder
  const handleNavigate = (path) => {
    navigate(`/folder${path ? `?path=${encodeURIComponent(path)}` : ''}`);
  };
  
  // Handle download
  const handleDownload = async (item) => {
    try {
      // Check if item is in Glacier
      const glacierStatus = await checkGlacierStatus(item.key);
      if (glacierStatus.isGlacier && !glacierStatus.restoreStatus) {
        setItemToRestore(item);
        setShowRestoreModal(true);
        return;
      }

      if (item.type === 'folder') {
        await downloadFolder(item.key, transferContext);
      } else {
        const url = await getS3DownloadUrl(item.key, item.size, transferContext);
        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = item.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
      showToast(`Download started for ${item.name}`, 'success');
    } catch (error) {
      if (error.message === 'Download cancelled by user') {
        showToast('Download cancelled', 'info');
      } else {
        showToast(`Download failed: ${error.message}`, 'error');
      }
    }
  };
  
  // Handle restore from Glacier
  const handleRestore = async (item, tier) => {
    try {
      await restoreFromGlacier(item.key, tier);
      showToast(
        `Restoration initiated for ${item.name}. This may take several hours depending on the chosen retrieval option.`,
        'success'
      );
      loadFolderContents(currentPath); // Reload to update status
    } catch (error) {
      showToast(`Restore failed: ${error.message}`, 'error');
    }
  };
  
  // Handle rename
  const handleRename = (item) => {
    // Don't allow rename for items in Glacier
    if (item.storageClass === 'GLACIER' || item.storageClass === 'DEEP_ARCHIVE') {
      showToast('Cannot rename items in Glacier storage', 'warning');
      return;
    }
    setItemToRename(item);
    setNewName(item.name);
    setShowRenameModal(true);
  };
  
  const submitRename = async () => {
    if (!newName || newName === itemToRename.name) {
      setShowRenameModal(false);
      return;
    }
    
    try {
      await renameS3Object(itemToRename, newName);
      showToast(`${itemToRename.type === 'folder' ? 'Folder' : 'File'} renamed successfully!`, 'success');
      loadFolderContents(currentPath);
      setShowRenameModal(false);
    } catch (error) {
      showToast(`Rename failed: ${error.message}`, 'error');
    }
  };

  return (
    <Container className="py-4">
      <div className="welcome-section">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <h2 className="welcome-title mb-4">Your Files & Folders</h2>
            <p className="welcome-text">
              Browse and manage your files securely. You can download, rename, and organize your content with ease.
            </p>
            <ul className="feature-list">
              <li><FaCheckCircle className="feature-icon" /> Download files and folders</li>
              <li><FaCheckCircle className="feature-icon" /> Rename items</li>
              <li><FaCheckCircle className="feature-icon" /> Manage storage classes</li>
            </ul>
          </div>
          <div className="col-lg-6">
            <div className="welcome-image">
              <img src={welcomeImage} alt="File Management Illustration" className="img-fluid" />
            </div>
          </div>
        </div>
      </div>

      <FileBrowser 
        currentPath={currentPath}
        items={items}
        isLoading={loading}
        onNavigate={handleNavigate}
        onDownload={handleDownload}
        onRename={handleRename}
        onRestore={handleRestore}
        glacierStats={glacierStats}
      />
      
      {/* Rename Modal */}
      <Modal show={showRenameModal} onHide={() => setShowRenameModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            Rename {itemToRename?.type === 'folder' ? 'Folder' : 'File'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>New name</Form.Label>
            <Form.Control
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRenameModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={submitRename}
            disabled={!newName || newName === itemToRename?.name}
          >
            Rename
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Restore Modal */}
      <Modal show={showRestoreModal} onHide={() => setShowRestoreModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Restore from Glacier</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>This file is stored in Glacier and needs to be restored before downloading.</p>
          <p>Choose a restore option:</p>
          <Button 
            variant="primary" 
            className="w-100 mb-2"
            onClick={() => {
              handleRestore(itemToRestore, 'Expedited');
              setShowRestoreModal(false);
            }}
          >
            Expedited (1-5 minutes, higher cost)
          </Button>
          <Button 
            variant="primary" 
            className="w-100 mb-2"
            onClick={() => {
              handleRestore(itemToRestore, 'Standard');
              setShowRestoreModal(false);
            }}
          >
            Standard (3-5 hours)
          </Button>
          <Button 
            variant="primary" 
            className="w-100"
            onClick={() => {
              handleRestore(itemToRestore, 'Bulk');
              setShowRestoreModal(false);
            }}
          >
            Bulk (5-12 hours, lowest cost)
          </Button>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRestoreModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Folder;
