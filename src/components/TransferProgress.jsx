import React, { useEffect } from 'react';
import { Card, ProgressBar } from 'react-bootstrap';
import { XLg } from 'react-bootstrap-icons';
import { useTransfer } from '../contexts/TransferContext';
import './TransferProgress.css';

const TransferProgress = () => {
  const { transfers, removeTransfer } = useTransfer();

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
              <button
                className="btn-close"
                onClick={() => removeTransfer(transfer.id)}
                aria-label="Close"
              />
            </div>
            <ProgressBar
              now={transfer.progress}
              variant={
                transfer.status === 'error' ? 'danger' :
                transfer.status === 'completed' ? 'success' :
                'primary'
              }
              label={`${transfer.progress}%`}
            />
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
