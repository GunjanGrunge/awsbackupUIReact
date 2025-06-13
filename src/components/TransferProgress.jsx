import React, { useEffect } from 'react';
import { Card, ProgressBar, Button, Badge } from 'react-bootstrap';
import { XLg, PauseFill, PlayFill } from 'react-bootstrap-icons';
import { useTransfer } from '../contexts/TransferContext';
import './TransferProgress.css';

// Helper function to format bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Helper function to format time
const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return 'calculating...';
  
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
};

const TransferProgress = () => {
  const { transfers, removeTransfer, pauseTransfer, resumeTransfer } = useTransfer();

  // Auto-remove completed transfers after 3 seconds
  useEffect(() => {
    transfers.forEach(transfer => {
      if (transfer.status === 'completed' || transfer.status === 'error') {
        const timer = setTimeout(() => {
          removeTransfer(transfer.id);
        }, 3000);
        return () => clearTimeout(timer);
      }
    });
  }, [transfers, removeTransfer]);

  if (transfers.length === 0) return null;

  return (
    <div className="transfer-progress-container">
      {transfers.map((transfer) => (
        <Card key={transfer.id} className="transfer-progress-card mb-2">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="transfer-title">
                <small className="text-muted">{transfer.type}</small>
                <div>{transfer.name}</div>
              </div>
              <div className="d-flex align-items-center">
                {/* Pause/Resume buttons for in-progress transfers */}
                {transfer.status === 'in_progress' && (
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    className="me-2"
                    onClick={() => pauseTransfer(transfer.id)}
                    title="Pause transfer"
                  >
                    <PauseFill />
                  </Button>
                )}
                {transfer.status === 'paused' && (
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    className="me-2"
                    onClick={() => resumeTransfer(transfer.id)}
                    title="Resume transfer"
                  >
                    <PlayFill />
                  </Button>
                )}
                <button
                  className="btn-close"
                  onClick={() => removeTransfer(transfer.id)}
                  aria-label="Close"
                />
              </div>
            </div>
            
            {/* Progress bar */}
            <ProgressBar
              now={transfer.progress}
              variant={
                transfer.status === 'error' ? 'danger' :
                transfer.status === 'completed' ? 'success' :
                transfer.status === 'paused' ? 'warning' :
                'primary'
              }
              label={`${transfer.progress}%`}
            />
            
            {/* Transfer details for large files */}
            {transfer.loaded && transfer.total && (
              <div className="transfer-details mt-1">
                <small className="text-muted">
                  {formatBytes(transfer.loaded)} of {formatBytes(transfer.total)}
                  {transfer.bytesPerSecond > 0 && (
                    <> • {formatBytes(transfer.bytesPerSecond)}/s</>
                  )}
                  {transfer.estimatedTimeRemaining > 0 && (
                    <> • {formatTime(transfer.estimatedTimeRemaining)} remaining</>
                  )}
                </small>
              </div>
            )}
            
            {/* Status badges */}
            {transfer.status === 'compressing' && (
              <Badge bg="info" className="mt-1">Compressing...</Badge>
            )}
            
            {/* Error message */}
            {transfer.status === 'error' && (
              <div className="text-danger mt-1">
                <small>{transfer.error || 'Transfer failed'}</small>
              </div>
            )}
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};

export default TransferProgress;
