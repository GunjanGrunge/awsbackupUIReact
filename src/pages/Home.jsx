import { useCallback, useState, useEffect } from 'react';
import { 
  FaCloudUploadAlt, 
  FaFile, 
  FaTrash, 
  FaEye, 
  FaCheckCircle, 
  FaTrashAlt, 
  FaRobot 
} from 'react-icons/fa';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { uploadToS3 } from '../services/s3Service';
import welcomeImage from '../images/7471053.jpg';
import { analyzeUserData } from '../services/openaiService';
import './Home.css';

const Home = ({ initialTab }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [previews, setPreviews] = useState({});
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    // Clean up previews when component unmounts
    return () => {
      Object.values(previews).forEach(preview => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  useEffect(() => {
    if (initialTab === 'ai-analysis') {
      const aiSection = document.querySelector('.ai-analysis-section');
      if (aiSection) {
        aiSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [initialTab]);

  const getFolderName = () => {
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    }).split('/').join('');
    const username = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'user';
    return `${username}${dateStr}`;
  };

  const handleUpload = async () => {
    if (!files.length) {
      showToast('Please select files to upload', 'warning');
      return;
    }

    setUploading(true);
    const totalFiles = files.length;
    let uploadedCount = 0;
    let failedFiles = [];

    try {
      for (const file of files) {
        try {
          const folderName = file.path.includes('/') 
            ? file.path.split('/').slice(0, -1).join('/')
            : getFolderName();
          
          // Log file object before upload
          console.log('Uploading file:', {
            name: file.name,
            type: file.type,
            size: file.size,
            path: file.path,
            folderName
          });
          
          await uploadToS3(file, folderName);
          uploadedCount++;
          showToast(`Uploaded ${uploadedCount} of ${totalFiles} files`, 'info');
        } catch (fileError) {
          failedFiles.push(file.name);
          showToast(`Failed to upload ${file.name}: ${fileError.message}`, 'error');
        }
      }
      
      if (failedFiles.length > 0) {
        showToast(`Upload completed with ${failedFiles.length} failures`, 'warning');
      } else {
        showToast('All files uploaded successfully!', 'success');
        setFiles([]); // Only clear files if all uploads were successful
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Upload failed: Please try again', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback(acceptedFiles => {
    const newFiles = acceptedFiles.map(file => {
      // Create a new File object with all properties
      const modifiedFile = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified
      });
      
      // Add additional properties
      Object.defineProperties(modifiedFile, {
        path: {
          value: file.webkitRelativePath || file.path || file.name,
          writable: true,
          enumerable: true
        },
        preview: {
          value: URL.createObjectURL(file),
          writable: true,
          enumerable: true
        }
      });

      return modifiedFile;
    });
    
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
    showToast(`Added ${acceptedFiles.length} file(s)`, 'success');
  }, [showToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: false, // Enable clicking
    noKeyboard: false, // Enable keyboard interaction
    getFilesFromEvent: async (event) => {
      const items = event.dataTransfer ? event.dataTransfer.items : event.target.files;
      
      let files = [];
      for (const item of items) {
        if (item.kind === 'file' || item instanceof File) {
          const file = item instanceof File ? item : await item.getAsFile();
          if (file) {
            // Preserve folder structure if available
            const path = file.webkitRelativePath || file.path || file.name;
            Object.defineProperty(file, 'path', {
              value: path,
              writable: true
            });
            files.push(file);
          }
        }
      }
      return files;
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

  const handleAnalyzeFiles = async () => {
    if (files.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeFiles(files);
      setAiAnalysis(analysis);
      showToast('Analysis complete!', 'success');
    } catch (error) {
      console.error('Analysis error:', error);
      showToast('Failed to analyze files', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="page-container">
      {/* Add this div for reCAPTCHA */}
      <div id="recaptcha-container"></div>
      
      <div className="upload-dashboard">
        <div className="dashboard-header">
          <h1 className="dashboard-title">UPLOAD YOUR FILES & FOLDERS</h1>
          <p className="dashboard-subtitle">We manage your files securely with AWS</p>
        </div>

        <div className="upload-card">
          <div {...getRootProps()} className={`dropzone-area ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <div className="dropzone-content">
              <FaCloudUploadAlt className={`upload-icon ${uploading ? 'rotating' : ''}`} />
              <div className="dropzone-text">
                <h3>{isDragActive ? 'Drop files here' : 'Drag & Drop Files'}</h3>
                <p>or click to browse from your computer</p>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="files-panel">
              <div className="files-header">
                <div className="files-stats">
                  <h4>Selected Files</h4>
                  <span className="files-count">{files.length} files</span>
                </div>
                <div className="files-actions">
                  {files.length > 10 && (
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
                      <FaFile className="file-type-icon" />
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

              <div className="ai-analysis-section">
                <button 
                  className="analyze-button"
                  onClick={handleAnalyzeFiles}
                  disabled={isAnalyzing || uploading}
                >
                  {isAnalyzing ? (
                    <>
                      <span className="spinner-border" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <FaRobot size={20} />
                      <span>Analyze with AI</span>
                    </>
                  )}
                </button>
                
                {aiAnalysis && (
                  <div className="analysis-results">
                    <h3>AI Analysis</h3>
                    <div className="analysis-content">
                      <pre>{aiAnalysis}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="welcome-section">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <h2 className="welcome-title mb-4">Welcome to AWS File Manager</h2>
            <p className="welcome-text">
              Securely manage your files and folders with our AWS S3-powered file management system. 
              Upload, organize, and access your data from anywhere with enterprise-grade security.
            </p>
            <ul className="feature-list">
              <li><FaCheckCircle className="feature-icon" /> Secure file storage</li>
              <li><FaCheckCircle className="feature-icon" /> Easy folder organization</li>
              <li><FaCheckCircle className="feature-icon" /> Quick file access</li>
              <li><FaCheckCircle className="feature-icon" /> Cost-effective solution</li>
            </ul>
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
