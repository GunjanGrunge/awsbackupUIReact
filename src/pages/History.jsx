import { useState, useEffect } from 'react';
import { Table, Modal, Button } from 'react-bootstrap';
import { 
  FaCloudUploadAlt,
  FaCloudDownloadAlt,
  FaCalendarAlt,
  FaFileAlt,
  FaLayerGroup,
  FaTrashAlt,
  FaCheckCircle 
} from 'react-icons/fa';
import { useToast } from '../contexts/ToastContext';
import { getHistoryLog, formatFileSize, clearHistoryLog } from '../services/s3Service';
import historyImage from '../images/rb_5335.jpg';
import './History.css';

const History = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    loadHistory(); // Initial load
    
    // Poll for updates more frequently (every 2 seconds)
    const interval = setInterval(() => {
      loadHistory();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const historyData = await getHistoryLog();
      console.log('Loaded history data:', historyData); // Debug log
      
      if (Array.isArray(historyData)) {
        // Sort by date in descending order
        const sortedData = historyData.sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );
        setActivities(sortedData);
      } else {
        showToast('Invalid history data format', 'error');
        setActivities([]);
      }
    } catch (error) {
      console.error('History load error:', error);
      showToast('Failed to load activity history', 'error');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistoryLog();
      setActivities([]);
      showToast('History cleared successfully', 'success');
      setShowConfirmModal(false);
    } catch (error) {
      showToast('Failed to clear history', 'error');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (action) => {
    switch(action.toLowerCase()) {
      case 'upload':
        return <FaCloudUploadAlt className="folder-icon" style={{ color: '#10b981' }} />;
      case 'download':
        return <FaCloudDownloadAlt className="folder-icon" style={{ color: '#3b82f6' }} />;
      default:
        return <FaCloudUploadAlt className="folder-icon" />;
    }
  };

  return (
    <div className="history-container">
      <div className="history-header">
        <h2 className="history-title">Activity History</h2>
        <div className="history-controls">
          <p className="history-subtitle">Track your file operations</p>
          {activities.length > 0 && (
            <button 
              className="clear-history-btn"
              onClick={() => setShowConfirmModal(true)}
            >
              <FaTrashAlt className="trash-icon" />
              Clear History
            </button>
          )}
        </div>
      </div>

      <div className="folder-content-wrapper">
        <div className="table-responsive custom-table-container">
          <Table hover className="custom-table">
            <thead>
              <tr>
                <th className="name-column">Date</th>
                <th className="size-column">Time</th>
                <th className="name-column">Action</th>
                <th className="name-column">File | Folder</th>
                <th className="size-column">Size</th>
                <th className="size-column">Total Files</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity, index) => (
                <tr key={index} className="file-row">
                  <td>
                    <div className="file-name">
                      <FaCalendarAlt className="file-type-icon" />
                      <span>{formatDate(activity.date)}</span>
                    </div>
                  </td>
                  <td className="text-center">
                    <span>{formatTime(activity.date)}</span>
                  </td>
                  <td>
                    <div className="file-name">
                      {getActionIcon(activity.action)}
                      <span>{activity.action}</span>
                    </div>
                  </td>
                  <td>
                    <div className="file-name">
                      <FaFileAlt className="file-type-icon" />
                      <span>{activity.itemName}</span>  {/* Fixed: Removed extra parenthesis */}
                    </div>
                  </td>
                  <td className="text-center">
                    <span>{formatFileSize(activity.size)}</span>
                  </td>
                  <td className="text-center">
                    <div className="file-name">
                      <FaLayerGroup className="file-type-icon" />
                      <span>{activity.fileCount} files</span>
                    </div>
                  </td>
                </tr>
              ))}
              {activities.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-4">
                    No activity history found
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      <div className="welcome-section mt-4">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <h2 className="welcome-title mb-4">Track Your Activities</h2>
            <p className="welcome-text">
              Stay on top of your file operations with a comprehensive activity tracking system. 
              Monitor uploads, downloads, and management actions with precise timestamps and detailed insights.
            </p>
            <ul className="feature-list">
              <li><FaCheckCircle className="feature-icon" /> Comprehensive Logs</li>
              <li><FaCheckCircle className="feature-icon" /> Detailed File Information</li>
              <li><FaCheckCircle className="feature-icon" /> Accurate Timestamps</li>
              <li><FaCheckCircle className="feature-icon" /> Easy History Management</li>
            </ul>
          </div>
          <div className="col-lg-6">
            <div className="welcome-image">
              <img src={historyImage} alt="History Tracking Illustration" className="img-fluid" />
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        centered
        className="delete-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Clear History</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to clear all history? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleClearHistory}>
            Clear History
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default History;
