import React, { createContext, useContext, useState, useCallback } from 'react';

const TransferContext = createContext(null);

export const TransferProvider = ({ children }) => {
  const [transfers, setTransfers] = useState([]);

  const addTransfer = useCallback((transfer) => {
    const id = Date.now().toString();
    const newTransfer = {
      id,
      progress: 0,
      status: 'in_progress',
      ...transfer
    };
    setTransfers(prev => [...prev, newTransfer]);
    return id;
  }, []);

  const updateTransfer = useCallback((id, updates) => {
    setTransfers(prev => 
      prev.map(transfer => 
        transfer.id === id ? { ...transfer, ...updates } : transfer
      )
    );
  }, []);

  const updateTransferProgress = useCallback((id, loaded, total, event = null) => {
    setTransfers(prev => 
      prev.map(transfer => {
        if (transfer.id === id) {
          const progress = Math.round((loaded / total) * 100);
          return {
            ...transfer,
            progress,
            loaded,
            total,
            event
          };
        }
        return transfer;
      })
    );
  }, []);

  const completeTransfer = useCallback((id) => {
    setTransfers(prev =>
      prev.map(transfer =>
        transfer.id === id ? {
          ...transfer,
          status: 'completed',
          progress: 100
        } : transfer
      )
    );
  }, []);

  const errorTransfer = useCallback((id, error) => {
    setTransfers(prev =>
      prev.map(transfer =>
        transfer.id === id ? {
          ...transfer,
          status: 'error',
          error: error.message
        } : transfer
      )
    );
  }, []);

  const cancelTransfer = useCallback((id) => {
    setTransfers(prev =>
      prev.map(transfer => {
        if (transfer.id === id) {
          transfer.controller?.abort();
          return {
            ...transfer,
            status: 'cancelled',
            progress: 0
          };
        }
        return transfer;
      })
    );
  }, []);

  const removeTransfer = useCallback((id) => {
    setTransfers(prev => prev.filter(transfer => transfer.id !== id));
  }, []);

  const value = {
    transfers,
    addTransfer,
    updateTransfer,
    updateTransferProgress,
    completeTransfer,
    errorTransfer,
    cancelTransfer,
    removeTransfer
  };

  return (
    <TransferContext.Provider value={value}>
      {children}
    </TransferContext.Provider>
  );
};

export const useTransfer = () => {
  const context = useContext(TransferContext);
  if (!context) {
    throw new Error('useTransfer must be used within a TransferProvider');
  }
  return context;
};
