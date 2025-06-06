import { useState, useEffect, useCallback } from 'react';
import { Container, Form, Button, Modal } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  listS3Objects, 
  downloadFolder, 
  getS3DownloadUrl,
  getGlacierStats,
  restoreFromGlacier,
  renameS3Object,
  uploadFile
} from '../services/s3Service';
import { useToast } from '../contexts/ToastContext';
import { useTransfer } from '../contexts/TransferContext';
import FileBrowser from '../components/FileBrowser';
import UploadAnimation from '../components/UploadAnimation';
import { FaCheckCircle } from 'react-icons/fa';
import welcomeImage from '../images/4569774.jpg';

const Folder = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [newName, setNewName] = useState('');
  const [glacierStats, setGlacierStats] = useState(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [uploadType, setUploadType] = useState('file');
  
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const transferContext = useTransfer();
  
  const loadFolderContents = useCallback(async (path) => {
    setLoading(true);
    try {
      const result = await listS3Objects(path);
      setItems(result);
      const stats = await getGlacierStats(path);
      setGlacierStats(stats);
    } catch (error) {
      showToast(`Error loading folder: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);
  
  // Fetch items on component mount and path change
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const path = queryParams.get('path') || '';
    setCurrentPath(path);
    loadFolderContents(path);
  }, [location, loadFolderContents]);
  
  // Handle navigation to a folder
  const handleNavigate = (path) => {
    navigate(`/folder${path ? `?path=${encodeURIComponent(path)}` : ''}`);
  };
  
  // Handle download
  const handleDownload = async (item) => {
    try {
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
  const handleRestore = async (item) => {
    try {
      await restoreFromGlacier(item.key);
      showToast(
        `Restoration initiated for ${item.name}. This may take several hours.`,
        'success'
      );
      loadFolderContents(currentPath);
    } catch (error) {
      showToast(`Restore failed: ${error.message}`, 'error');
    }
  };
  
  // Handle rename
  const handleRename = (item) => {
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

  // Handle upload
  const handleUpload = async (files) => {
    try {
      const isFolder = files.length > 1 || files[0].webkitRelativePath;
      setUploadType(isFolder ? 'folder' : 'file');
      
      const uploadPromises = files.map(file => {
        const key = currentPath + file.webkitRelativePath || file.name;
        return uploadFile(key, file, transferContext);
      });
      
      await Promise.all(uploadPromises);
      setShowAnimation(true); // Show animation after successful upload
      
      // Hide animation after duration
      setTimeout(() => {
        setShowAnimation(false);
      }, uploadType === 'folder' ? 3000 : 2000);
      
      loadFolderContents(currentPath);
      showToast('Upload completed successfully!', 'success');
    } catch (error) {
      showToast(`Upload failed: ${error.message}`, 'error');
    }
  };

  return (
    <Container className="folder-container">
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

      <UploadAnimation show={showAnimation} type={uploadType} />
      
      <div className="welcome-section mt-4">
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
    </Container>
  );
};

export default Folder;
