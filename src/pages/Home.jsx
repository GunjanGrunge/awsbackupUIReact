import { useCallback, useState, useEffect } from 'react';
import { 
  FaCloudUploadAlt, 
  FaTrash, 
  FaEye, 
  FaCheckCircle, 
  FaTrashAlt,
  FaFolderPlus,
  FaFileMedical
} from 'react-icons/fa';
import { Button } from 'react-bootstrap';  // Add this import
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { uploadToS3 } from '../services/s3Service';
import welcomeImage from '../images/7471053.jpg';
import './Home.css';

const Home = () => {  // Remove unused initialTab prop
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [previews, setPreviews] = useState({});
  const [uploadFolderName, setUploadFolderName] = useState('');
  const [uploadSource, setUploadSource] = useState(null);

  // Define archive file types
  const archiveTypes = ['.zip', '.rar', '.tar', '.7z'];

  // Function to check if file is an archive
  const isArchiveFile = useCallback((filename) => {
    return archiveTypes.some(ext => filename.toLowerCase().endsWith(ext));
  }, [archiveTypes]);

  // Get folder name based on user and date
  const getFolderName = useCallback(() => {
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    }).split('/').join('');
    const username = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'user';
    return `${username.toUpperCase()}${dateStr}`;
  }, [currentUser]);

  const onFolderDrop = useCallback(async (acceptedFiles, event) => {
    try {
      // Handle both drag-and-drop and input selection
      const items = event?.dataTransfer?.items || acceptedFiles;
      let folderName = '';
      const processedFiles = [];

      // Function to process directory entries recursively
      const processEntry = async (entry, path = '') => {
        if (entry.isFile) {
          return new Promise(resolve => {
            entry.file(file => {
              const fullPath = path ? `${path}/${file.name}` : file.name;
              const modifiedFile = new File([file], file.name, {
                type: file.type,
                lastModified: file.lastModified
              });
              Object.defineProperty(modifiedFile, 'webkitRelativePath', {
                value: fullPath,
                writable: false
              });
              processedFiles.push(modifiedFile);
              resolve();
            });
          });
        } else if (entry.isDirectory) {
          if (!folderName) folderName = entry.name;
          const dirReader = entry.createReader();
          return new Promise(resolve => {
            const readEntries = () => {
              dirReader.readEntries(async entries => {
                if (!entries.length) {
                  resolve();
                  return;
                }
                await Promise.all(entries.map(e => processEntry(e, `${path}/${entry.name}`)));
                readEntries();
              });
            };
            readEntries();
          });
        }
      };

      if (items[0]?.webkitGetAsEntry) {
        // Handle drag and drop
        const entry = items[0].webkitGetAsEntry();
        if (entry.isDirectory) {
          await processEntry(entry);
          setUploadSource('folder');
          setUploadFolderName(folderName);
          setFiles(processedFiles);
          showToast(`Added folder: ${folderName}`, 'success');
        } else {
          showToast('Please select a folder', 'warning');
        }
      } else if (acceptedFiles[0]?.webkitRelativePath) {
        // Handle folder input selection
        folderName = acceptedFiles[0].webkitRelativePath.split('/')[0];
        setUploadSource('folder');
        setUploadFolderName(folderName);
        setFiles(acceptedFiles);
        showToast(`Added folder: ${folderName}`, 'success');
      } else {
        showToast('Please select a folder', 'warning');
      }
    } catch (error) {
      console.error('Error processing folder:', error);
      showToast('Error processing folder', 'error');
    }
  }, [showToast]);

  const onFileDrop = useCallback(acceptedFiles => {
    setUploadSource('file');
    
    // Create a folder name for the files if not already set
    if (!uploadFolderName) {
      setUploadFolderName(getFolderName());
    }

    // Process each file
    const processedFiles = acceptedFiles.map(file => {
      // For single files, don't modify them
      if (isArchiveFile(file.name)) {
        return file;
      }
      
      // Create a new File object with the same properties
      const modifiedFile = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified
      });
      return modifiedFile;
    });

    setFiles(prevFiles => [...prevFiles, ...processedFiles]);
    showToast(`Added ${processedFiles.length} files`, 'success');
  }, [getFolderName, isArchiveFile, showToast, uploadFolderName]);

  // Configure folder dropzone to only accept folders
  const { getRootProps: getFolderRootProps, getInputProps: getFolderInputProps, isDragActive: isFolderDragActive } = useDropzone({
    onDrop: onFolderDrop,
    multiple: true,
    webkitdirectory: true,
    directory: '',
    noDrag: false,
    noClick: false,
    getFilesFromEvent: async (event) => {
      const items = event?.dataTransfer?.items || event.target.files;
      
      // Handle directory selection through input
      if (event.target && event.target.files) {
        return Array.from(event.target.files);
      }
      
      // Handle drag and drop
      if (items?.[0]?.webkitGetAsEntry) {
        const entry = items[0].webkitGetAsEntry();
        if (entry.isDirectory) {
          const processedFiles = [];
          const traverseDirectory = async (entry, path = '') => {
            if (entry.isFile) {
              return new Promise(resolve => {
                entry.file(file => {
                  const fullPath = path ? `${path}/${file.name}` : file.name;
                  const modifiedFile = new File([file], file.name, {
                    type: file.type,
                    lastModified: file.lastModified
                  });
                  Object.defineProperty(modifiedFile, 'webkitRelativePath', {
                    value: fullPath,
                    writable: false
                  });
                  processedFiles.push(modifiedFile);
                  resolve();
                });
              });
            } else if (entry.isDirectory) {
              const dirReader = entry.createReader();
              return new Promise(resolve => {
                const readEntries = () => {
                  dirReader.readEntries(async entries => {
                    if (!entries.length) {
                      resolve();
                      return;
                    }
                    await Promise.all(entries.map(e => traverseDirectory(e, `${path}/${entry.name}`)));
                    readEntries();
                  });
                };
                readEntries();
              });
            }
          };
          await traverseDirectory(entry);
          return processedFiles;
        }
      }
      return items;
    }
  });

  // Configure file dropzone
  const { getRootProps: getFileRootProps, getInputProps: getFileInputProps, isDragActive: isFileDragActive } = useDropzone({
    onDrop: onFileDrop,
    multiple: true,
    noClick: false,
    webkitdirectory: false,
    noDragEventsBubbling: true,
    accept: {
      'image/*': [],
      'audio/*': [],
      'video/*': [],
      'application/*': [],
      'text/*': []
    }
  });

  // Cleanup function for previews
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const handleRemoveFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
    showToast('File removed successfully', 'success');
  };

  const handleRemoveAll = () => {
    setFiles([]);
    showToast('All files removed successfully', 'success');
  };

  const handlePreview = (file) => {
    try {
      // Check if file type is previewable
      const previewableTypes = [
        'image/jpeg', 'image/png', 'image/gif', 
        'application/pdf', 
        'text/plain',
        'video/mp4', 'video/quicktime'
      ];
      
      if (!previewableTypes.includes(file.type)) {
        showToast('This file type cannot be previewed', 'warning');
        return;
      }

      // Create or get preview URL
      const previewUrl = previews[file.name] || URL.createObjectURL(file);
      
      // Update previews state if new URL created
      if (!previews[file.name]) {
        setPreviews(prev => ({ ...prev, [file.name]: previewUrl }));
      }

      // Open preview in new window
      const previewWindow = window.open(previewUrl, '_blank');
      if (!previewWindow) {
        showToast('Please allow popups to preview files', 'warning');
      }
    } catch (error) {
      console.error('Preview error:', error);
      showToast('Failed to preview file', 'error');
    }
  };

  const handleFolderSelect = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      const folderName = files[0].webkitRelativePath.split('/')[0];
      setUploadSource('folder');
      setUploadFolderName(folderName);
      setFiles(Array.from(files));
      showToast(`Added folder: ${folderName}`, 'success');
    }
  };

  const handleUpload = async () => {
    if (!files.length) {
      showToast('Please select files to upload', 'warning');
      return;
    }

    setUploading(true);
    let uploadedCount = 0;
    let failedFiles = [];

    try {
      for (const file of files) {
        try {
          let uploadPath;
          
          if (uploadSource === 'folder') {
            uploadPath = file.webkitRelativePath;
          } else {
            uploadPath = isArchiveFile(file.name) ? file.name : `${uploadFolderName}/${file.name}`;
          }

          uploadPath = uploadPath
            .replace(/^\.\//, '')
            .replace(/^\/+|\/+$/g, '');

          await uploadToS3(file, uploadPath, () => {
            // Progress callback left empty intentionally
          });
          
          uploadedCount++;
          showToast(`Uploaded ${uploadedCount} of ${files.length} files`, 'info');
        } catch (error) {
          failedFiles.push(file.name);
          console.error('File upload error:', error);
          showToast(`Failed to upload ${file.name}`, 'error');
        }
      }

      if (failedFiles.length > 0) {
        showToast(`Upload completed with ${failedFiles.length} failures`, 'warning');
      } else {
        showToast('All files uploaded successfully!', 'success');
        setFiles([]);
        setUploadFolderName('');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Upload failed: Please try again', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-container">
      <div id="recaptcha-container"></div>
      
      <div className="upload-dashboard">
        <div className="dashboard-header">
          <h1 className="dashboard-title">UPLOAD YOUR FILES & FOLDERS</h1>
          <p className="dashboard-subtitle">We manage your files securely with AWS</p>
        </div>

        <div className="upload-zones-container">
          {/* Folder Upload Zone */}
          <div className="upload-zone">
            <div className="dropzone-area">
              <div className="dropzone-content">
                <FaFolderPlus className="upload-icon folder-icon" />
                <div className="dropzone-text">
                  <h3>Folder Upload</h3>
                  <p>Select a folder to upload</p>
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    className="folder-input"
                    onChange={handleFolderSelect}
                    style={{ display: 'none' }}
                    id="folder-input"
                  />
                  <Button 
                    variant="primary" 
                    className="select-button"
                    onClick={() => document.getElementById('folder-input').click()}
                  >
                    Browse Folder
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload Zone */}
          <div className="upload-zone">
            <div {...getFileRootProps()} className={`dropzone-area ${isFileDragActive ? 'active' : ''}`}>
              <input {...getFileInputProps()} />
              <div className="dropzone-content">
                <FaFileMedical className="upload-icon file-icon" />
                <div className="dropzone-text">
                  <h3>File Upload</h3>
                  <p>Drag & drop files or click to browse</p>
                  <Button 
                    variant="primary" 
                    className="select-button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.onchange = (e) => onFileDrop(Array.from(e.target.files));
                      input.click();
                    }}
                  >
                    Browse Files
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="files-panel">
            <div className="files-header">
              <div className="files-stats">
                <h4>Selected Files</h4>
                <span className="files-count">{files.length} files</span>
                {uploadFolderName && (
                  <span className="folder-name">
                    Folder: {uploadFolderName}
                  </span>
                )}
              </div>
              <div className="files-actions">
                {files.length > 1 && (
                  <button
                    className="remove-all-button"
                    onClick={handleRemoveAll}
                    disabled={uploading}
                    title="Remove all files"
                  >
                    <FaTrashAlt />
                    Remove All
                  </button>
                )}
                <button
                  className={`upload-button ${uploading ? 'uploading' : ''}`}
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span className="spinner" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FaCloudUploadAlt />
                      UPLOAD
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="files-list">
              {files.map((file, index) => (
                <div key={index} className="file-card">
                  <div className="file-info">
                    <FaFileMedical className="file-type-icon" />
                    <div className="file-details">
                      <span className="file-name" title={file.path || file.name}>
                        {file.path || file.name}
                      </span>
                      <span className="file-size">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <div className="file-actions">
                    <button
                      className="action-button preview"
                      onClick={() => handlePreview(file)}
                      title="Preview file"
                      disabled={uploading}
                    >
                      <FaEye />
                    </button>
                    <button
                      className="action-button delete"
                      onClick={() => handleRemoveFile(index)}
                      title="Remove file"
                      disabled={uploading}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="welcome-section">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <h2 className="welcome-title mb-4">Welcome to AWS File Manager</h2>
            <p className="welcome-text">
              Securely manage your files and folders with our AWS S3-powered file management system. 
              Upload, organize, and access your data from anywhere with enterprise-grade security.
            </p>
            <div className="feature-list">
              <ul>
                <li><FaCheckCircle className="feature-icon" /> Secure file storage</li>
                <li><FaCheckCircle className="feature-icon" /> Easy folder organization</li>
                <li><FaCheckCircle className="feature-icon" /> Quick file access</li>
                <li><FaCheckCircle className="feature-icon" /> Cost-effective solution</li>
              </ul>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="welcome-image">
              <img src={welcomeImage} alt="File Management Illustration" className="img-fluid" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
