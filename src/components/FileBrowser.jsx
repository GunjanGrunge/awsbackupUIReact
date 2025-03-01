import React, { useState } from 'react';
import { 
  Table, Button, Breadcrumb, Spinner, Card, 
  Badge, OverlayTrigger, Tooltip 
} from 'react-bootstrap';
import { 
  FolderFill, FileFill, Download, PencilSquare, 
  ArrowLeft, SortDown, SortUp, FileEarmark
} from 'react-bootstrap-icons';
import { useTransfer } from '../contexts/TransferContext';
import './FileBrowser.css';
import { formatFileSize } from '../services/s3Service';

const FileBrowser = ({ 
  currentPath, 
  items, 
  isLoading, 
  onNavigate, 
  onDownload, 
  onRename, 
  emptyStateMessage = "This folder is empty" 
}) => {
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const transferContext = useTransfer();

  // Prepare breadcrumbs from current path
  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];
  
  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    // Always put folders before files
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    
    // Sort by the selected column
    if (sortBy === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else if (sortBy === 'size') {
      const sizeA = a.size || 0;
      const sizeB = b.size || 0;
      return sortDirection === 'asc' ? sizeA - sizeB : sizeB - sizeA;
    }
    return 0;
  });

  // Handle sort changes
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  // Determine file icon/type
  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    
    // Map extensions to icons/types
    const fileTypes = {
      // Images
      'jpg': { icon: <FileFill className="file-icon image-icon" />, badge: 'Image' },
      'jpeg': { icon: <FileFill className="file-icon image-icon" />, badge: 'Image' },
      'png': { icon: <FileFill className="file-icon image-icon" />, badge: 'Image' },
      'gif': { icon: <FileFill className="file-icon image-icon" />, badge: 'Image' },
      // Documents
      'pdf': { icon: <FileFill className="file-icon pdf-icon" />, badge: 'PDF' },
      'doc': { icon: <FileFill className="file-icon doc-icon" />, badge: 'Doc' },
      'docx': { icon: <FileFill className="file-icon doc-icon" />, badge: 'Doc' },
      'xls': { icon: <FileFill className="file-icon excel-icon" />, badge: 'Excel' },
      'xlsx': { icon: <FileFill className="file-icon excel-icon" />, badge: 'Excel' },
      'ppt': { icon: <FileFill className="file-icon ppt-icon" />, badge: 'PPT' },
      'pptx': { icon: <FileFill className="file-icon ppt-icon" />, badge: 'PPT' },
      // Code
      'js': { icon: <FileFill className="file-icon code-icon" />, badge: 'JS' },
      'jsx': { icon: <FileFill className="file-icon code-icon" />, badge: 'JSX' },
      'ts': { icon: <FileFill className="file-icon code-icon" />, badge: 'TS' },
      'tsx': { icon: <FileFill className="file-icon code-icon" />, badge: 'TSX' },
      'html': { icon: <FileFill className="file-icon code-icon" />, badge: 'HTML' },
      'css': { icon: <FileFill className="file-icon code-icon" />, badge: 'CSS' },
      // Archive
      'zip': { icon: <FileFill className="file-icon archive-icon" />, badge: 'ZIP' },
      'rar': { icon: <FileFill className="file-icon archive-icon" />, badge: 'RAR' },
      '7z': { icon: <FileFill className="file-icon archive-icon" />, badge: '7Z' },
      // Default
      'default': { icon: <FileEarmark className="file-icon" />, badge: null }
    };
    
    return fileTypes[extension] || fileTypes['default'];
  };

  return (
    <div className="file-browser-container">
      {/* Breadcrumb navigation */}
      <div className="browser-header">
        <div className="path-navigation">
          <Breadcrumb className="file-breadcrumb">
            <Breadcrumb.Item 
              onClick={() => onNavigate('')}
              active={!currentPath}
              className="breadcrumb-item"
            >
              Root
            </Breadcrumb.Item>
            
            {pathSegments.map((segment, index) => (
              <Breadcrumb.Item
                key={segment}
                onClick={() => onNavigate(pathSegments.slice(0, index + 1).join('/'))}
                active={index === pathSegments.length - 1}
                className="breadcrumb-item"
              >
                {segment}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
          
          {currentPath && (
            <Button 
              variant="light" 
              size="sm"
              className="back-button"
              onClick={() => {
                const newPath = pathSegments.length > 1 
                  ? pathSegments.slice(0, -1).join('/') 
                  : '';
                onNavigate(newPath);
              }}
            >
              <ArrowLeft className="me-1" /> Back
            </Button>
          )}
        </div>
        
        <div className="browser-info">
          <Badge bg="primary" className="item-count">
            {isLoading ? (
              <Spinner animation="border" size="sm" role="status" className="me-1" />
            ) : (
              <>
                <FileEarmark className="me-1" /> 
                {sortedItems.length} {sortedItems.length === 1 ? 'item' : 'items'}
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* File listing */}
      <Card className="file-browser-card">
        {isLoading ? (
          <div className="text-center loading-container">
            <Spinner animation="border" role="status" className="loading-spinner">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="loading-text">Loading files...</p>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="empty-container">
            <FolderFill size={64} className="empty-icon" />
            <p className="empty-message">{emptyStateMessage}</p>
          </div>
        ) : (
          <div className="items-container">
            <Table hover className="file-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} className="sortable-header name-column">
                    <div className="header-content">
                      Name
                      {sortBy === 'name' && (
                        <span className="sort-icon">
                          {sortDirection === 'asc' ? <SortUp /> : <SortDown />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('size')} className="sortable-header size-column">
                    <div className="header-content">
                      Size
                      {sortBy === 'size' && (
                        <span className="sort-icon">
                          {sortDirection === 'asc' ? <SortUp /> : <SortDown />}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.key} className={`file-row ${item.type}-row`}>
                    <td className="name-cell">
                      {item.type === 'folder' ? (
                        <Button 
                          variant="link" 
                          className="folder-name-btn"
                          onClick={() => onNavigate(`${currentPath ? `${currentPath}/` : ''}${item.name}`)}
                        >
                          <div className="folder-icon-wrapper">
                            <FolderFill className="folder-icon" />
                          </div>
                          <span className="folder-name">{item.name}</span>
                        </Button>
                      ) : (
                        <div className="file-info">
                          <div className="file-icon-wrapper">
                            {getFileIcon(item.name).icon}
                          </div>
                          <span className="file-name">{item.name}</span>
                          {getFileIcon(item.name).badge && (
                            <Badge bg="light" text="dark" pill className="file-type-badge">
                              {getFileIcon(item.name).badge}
                            </Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="size-cell">
                      <span className="size-value">
                        {item.type === 'folder' ? (
                          <span className="folder-size">—</span>
                        ) : (
                          formatFileSize(item.size)
                        )}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Download {item.type === 'folder' ? 'as ZIP' : ''}</Tooltip>}
                        >
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="action-button download-button"
                            onClick={() => onDownload(item, transferContext)}
                          >
                            <Download className="button-icon" />
                          </Button>
                        </OverlayTrigger>
                        
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Rename</Tooltip>}
                        >
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="action-button rename-button"
                            onClick={() => onRename(item)}
                          >
                            <PencilSquare className="button-icon" />
                          </Button>
                        </OverlayTrigger>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FileBrowser;
