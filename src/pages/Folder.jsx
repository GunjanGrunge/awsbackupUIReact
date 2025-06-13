import { useState, useEffect, useCallback } from 'react';
import { Container, Form, Button, Modal, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  listS3Objects, 
  getGlacierStats,
  renameS3Object
} from '../services/s3Service';
import { useToast } from '../contexts/ToastContext';
import { useTransfer } from '../contexts/TransferContext';
import EnhancedFileBrowser from '../components/EnhancedFileBrowser';
import UploadArea from '../components/UploadArea';
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
  
  // Handle rename operation
  const handleRename = (item) => {
    setItemToRename(item);
    setNewName(item.name);
    setShowRenameModal(true);
  };
  
  const confirmRename = async () => {
    if (!newName.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    
    try {
      await renameS3Object(itemToRename, newName);
      showToast(`Renamed ${itemToRename.name} to ${newName}`, 'success');
      setShowRenameModal(false);
      loadFolderContents(currentPath);
    } catch (error) {
      showToast(`Rename failed: ${error.message}`, 'error');
    }
  };
  
  return (
    <Container fluid className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>File Browser</h1>
      </div>
      
      {/* Enhanced upload area */}
      <UploadArea 
        currentPath={currentPath}
        onUploadComplete={() => loadFolderContents(currentPath)}
      />
      
      <div className="my-4"></div>
      
      <EnhancedFileBrowser
        currentPath={currentPath}
        items={items}
        isLoading={loading}
        onNavigate={handleNavigate}
        onRename={handleRename}
        onUpload={() => loadFolderContents(currentPath)}
        onRestore={() => loadFolderContents(currentPath)}
        glacierStats={glacierStats}
      />
      
      {/* Rename Modal */}
      <Modal show={showRenameModal} onHide={() => setShowRenameModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Rename {itemToRename?.type}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>New name for {itemToRename?.name}</Form.Label>
            <Form.Control
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new name"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRenameModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirmRename}>
            Rename
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Upload Animation */}
      {showAnimation && (
        <UploadAnimation 
          onComplete={() => setShowAnimation(false)}
        />
      )}
    </Container>
  );
};

export default Folder;
