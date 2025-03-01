import React, { useState } from 'react';
import { 
  Table, 
  Container, 
  Row, 
  Col, 
  Breadcrumb, 
  Button, 
  Card,
  Badge
} from 'react-bootstrap';
import { 
  FaFolder, 
  FaFile, 
  FaArrowUp, 
  FaDownload, 
  FaTrash, 
  FaPencilAlt,
  FaClock
} from 'react-icons/fa';
import { formatFileSize } from '../services/s3Service';

const FolderBrowser = ({ 
  currentPath, 
  onNavigate, 
  onDownload, 
  onDelete, 
  onRename,
  items = [] 
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const getBreadcrumbItems = () => {
    const parts = currentPath.split('/').filter(Boolean);
    return [
      <Breadcrumb.Item 
        key="root" 
        onClick={() => onNavigate('')}
        className="cursor-pointer"
        active={parts.length === 0}
      >
        Root
      </Breadcrumb.Item>,
      ...parts.map((part, index) => (
        <Breadcrumb.Item
          key={index}
          onClick={() => onNavigate(parts.slice(0, index + 1).join('/') + '/')}
          className="cursor-pointer"
          active={index === parts.length - 1}
        >
          {part}
        </Breadcrumb.Item>
      ))
    ];
  };

  const sortedItems = [...items].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    
    if (sortConfig.key === 'size') {
      return (aValue - bValue) * direction;
    }
    if (sortConfig.key === 'lastModified') {
      return ((new Date(aValue) - new Date(bValue)) * direction);
    }
    return aValue.localeCompare(bValue) * direction;
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <Container fluid className="py-3">
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <Row className="align-items-center">
            <Col>
              <Breadcrumb className="mb-0">
                {getBreadcrumbItems()}
              </Breadcrumb>
            </Col>
            {currentPath && (
              <Col xs="auto">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => onNavigate(currentPath.split('/').slice(0, -2).join('/') + '/')}
                >
                  <FaArrowUp className="me-1" /> Back
                </Button>
              </Col>
            )}
          </Row>
        </Card.Header>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0">
            <thead className="bg-light">
              <tr>
                <th 
                  className="cursor-pointer" 
                  onClick={() => handleSort('name')}
                  style={{ width: '40%' }}
                >
                  Name {sortConfig.key === 'name' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  className="cursor-pointer" 
                  onClick={() => handleSort('size')}
                  style={{ width: '20%' }}
                >
                  Size {sortConfig.key === 'size' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  className="cursor-pointer" 
                  onClick={() => handleSort('lastModified')}
                  style={{ width: '25%' }}
                >
                  Last Modified {sortConfig.key === 'lastModified' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th style={{ width: '15%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, index) => (
                <tr key={index}>
                  <td>
                    <div className="d-flex align-items-center">
                      {item.type === 'folder' ? (
                        <FaFolder className="text-warning me-2" />
                      ) : (
                        <FaFile className="text-secondary me-2" />
                      )}
                      <span
                        className={item.type === 'folder' ? 'cursor-pointer' : ''}
                        onClick={() => item.type === 'folder' && onNavigate(item.key)}
                        style={{ cursor: item.type === 'folder' ? 'pointer' : 'default' }}
                      >
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td>{item.type === 'folder' ? '--' : formatFileSize(item.size)}</td>
                  <td>
                    {item.lastModified ? (
                      <div className="d-flex align-items-center text-muted">
                        <FaClock className="me-1" />
                        {new Date(item.lastModified).toLocaleString()}
                      </div>
                    ) : '--'}
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => onDownload(item)}
                        title="Download"
                      >
                        <FaDownload />
                      </Button>
                      <Button
                        variant="outline-warning"
                        size="sm"
                        onClick={() => onRename(item)}
                        title="Rename"
                      >
                        <FaPencilAlt />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => onDelete(item)}
                        title="Delete"
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-4 text-muted">
                    This folder is empty
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default FolderBrowser;
