import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Modal } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  listS3Objects, 
  uploadToS3, 
  deleteS3Object, 
  downloadFolder, 
  getS3DownloadUrl 
} from '../services/s3Service';
import { renameS3Object } from '../services/s3Service';  // Add separate import
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTransfer } from '../contexts/TransferContext';
import FileBrowser from '../components/FileBrowser';

const Folder = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [newName, setNewName] = useState('');
  
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const transferContext = useTransfer();
  
  // Fetch items on component mount and path change
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const path = queryParams.get('path') || '';
    setCurrentPath(path);
    loadFolderContents(path);
  }, [location]);
  
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
  
  // Handle navigation to a folder
  const handleNavigate = (path) => {
    navigate(`/folder${path ? `?path=${encodeURIComponent(path)}` : ''}`);
  };
  
  // Handle download
  const handleDownload = async (item, transferCtx = null) => {
    try {
      if (item.type === 'folder') {
        await downloadFolder(item.key, transferCtx || transferContext);
      } else {
        const url = await getS3DownloadUrl(item.key, item.size, transferCtx || transferContext);
        // If we're using the transfer context, download is handled there
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
      loadFolderContents(currentPath); // Reload contents
      setShowRenameModal(false);
    } catch (error) {
      showToast(`Rename failed: ${error.message}`, 'error');
    }
  };

  return (
    <Container className="py-4">
      <FileBrowser 
        currentPath={currentPath}
        items={items}
        isLoading={loading}
        onNavigate={handleNavigate}
        onDownload={handleDownload}
        onRename={handleRename}
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
    </Container>
  );
};

export default Folder;
