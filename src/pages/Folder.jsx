import { useState, useEffect } from 'react';
import { Breadcrumb, Table } from 'react-bootstrap';
import { FaFolder, FaFile, FaArrowUp, FaDownload, FaCheckCircle } from 'react-icons/fa';
import { useToast } from '../contexts/ToastContext';
import { listS3Objects, getS3DownloadUrl, downloadFolder, getFolderSize, formatFileSize } from '../services/s3Service';
import folderManagementImage from '../images/4569774.jpg';
import './Folder.css';

const EXCLUDED_FILES = ['history-log.json'];

const Folder = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folderSizes, setFolderSizes] = useState({});
  const { showToast } = useToast();

  useEffect(() => {
    loadFolderContents(currentPath);
  }, [currentPath]);

  useEffect(() => {
    const loadFolderSizes = async () => {
      const sizes = {};
      for (const item of contents) {
        if (item.type === 'folder') {
          sizes[item.key] = await getFolderSize(item.key);
        }
      }
      setFolderSizes(sizes);
    };

    if (contents.length > 0) {
      loadFolderSizes();
    }
  }, [contents]);

  const loadFolderContents = async (path) => {
    try {
      setLoading(true);
      const items = await listS3Objects(path);
      setContents(items);
    } catch (error) {
      showToast('Failed to load folder contents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path) => {
    setCurrentPath(path);
  };

  const handleBack = () => {
    const newPath = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(newPath);
  };

  const handleDownload = async (item) => {
    try {
      if (item.type === 'file' && EXCLUDED_FILES.includes(item.name)) {
        showToast('This file cannot be downloaded', 'warning');
        return;
      }

      showToast(`Preparing ${item.type} download...`, 'info');

      if (item.type === 'folder') {
        await downloadFolder(item.key);
      } else {
        const url = await getS3DownloadUrl(item.key, item.size);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      showToast(`${item.type} download started`, 'success');
    } catch (error) {
      console.error('Download error:', error);
      showToast(`Failed to download ${item.type}`, 'error');
    }
  };

  const breadcrumbs = [
    { name: 'Root', path: '' },
    ...currentPath.split('/').filter(Boolean).map((part, index, array) => ({
      name: part,
      path: array.slice(0, index + 1).join('/')
    }))
  ];

  return (
    <div className="folder-container">
      <div className="folder-header">
        <h2 className="folder-title">File Browser</h2>
        <Breadcrumb className="custom-breadcrumb">
          <Breadcrumb.Item 
            onClick={() => handleNavigate('')}
            className="breadcrumb-hover"
          >
            <FaFolder className="me-2" />Root
          </Breadcrumb.Item>
          {currentPath.split('/').filter(Boolean).map((part, index, array) => (
            <Breadcrumb.Item
              key={part}
              onClick={() => handleNavigate(array.slice(0, index + 1).join('/'))}
              active={index === array.length - 1}
              className="breadcrumb-hover"
            >
              {part}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      </div>

      <div className="folder-content-wrapper">
        <div className="table-responsive custom-table-container">
          <Table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '50%' }}>Name</th>
                <th style={{ width: '20%' }}>Size</th>
                <th style={{ width: '30%' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentPath && (
                <tr className="back-row" onClick={handleBack}>
                  <td>
                    <div className="d-flex align-items-center">
                      <FaArrowUp className="me-2 back-icon" />
                      <span className="back-text">Back to parent folder</span>
                    </div>
                  </td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              )}
              {contents.map((item) => (
                <tr key={item.key} className={item.type === 'folder' ? 'folder-row' : 'file-row'}>
                  <td>
                    {item.type === 'folder' ? (
                      <div className="folder-name">
                        <FaFolder className="folder-icon" />
                        <span onClick={() => handleNavigate(item.key)}>
                          {item.name}
                        </span>
                      </div>
                    ) : (
                      <div className="file-name">
                        <FaFile className="file-icon" />
                        <span>{item.name}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {item.type === 'folder' 
                      ? folderSizes[item.key] ? formatFileSize(folderSizes[item.key]) : 'Calculating...'
                      : formatFileSize(item.size || 0)
                    }
                  </td>
                  <td>
                    <button
                      className={`download-button ${item.type === 'folder' ? 'folder-download' : 'file-download'}`}
                      onClick={() => handleDownload(item)}
                      title={`Download ${item.type}`}
                    >
                      <FaDownload className="download-icon" />
                      <span className="download-text">
                        {item.type === 'folder' ? 'Download ZIP' : 'Download'}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      <div className="welcome-section mt-4">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <h2 className="welcome-title mb-4">Manage Your Files</h2>
            <p className="welcome-text">
              Seamlessly organize and access your files and folders in AWS S3 storage. 
              Enjoy secure, efficient data management with enterprise-grade security and user-friendly features.
            </p>
            <ul className="feature-list">
              <li><FaCheckCircle className="feature-icon" /> Robust Security</li>
              <li><FaCheckCircle className="feature-icon" /> Intuitive Navigation</li>
              <li><FaCheckCircle className="feature-icon" /> Fast Transfers</li>
              <li><FaCheckCircle className="feature-icon" /> Streamlined Organization</li>
            </ul>
          </div>
          <div className="col-lg-6">
            <div className="welcome-image">
              <img src={folderManagementImage} alt="Folder Management Illustration" className="img-fluid" />
            </div>
          </div>
        </div>
      </div>

      <div className="folder-bottom-section">
        {/* Content will be added later */}
      </div>
    </div>
  );
};

export default Folder;
