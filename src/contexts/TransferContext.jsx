import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TransferContext = createContext(null);

export const TransferProvider = ({ children }) => {
  const [transfers, setTransfers] = useState([]);
  const [pausedTransfers, setPausedTransfers] = useState({});

  // Add localStorage persistence for large transfers
  useEffect(() => {
    // Load any paused transfers from localStorage
    try {
      const storedTransfers = localStorage.getItem('pausedTransfers');
      if (storedTransfers) {
        setPausedTransfers(JSON.parse(storedTransfers));
      }
    } catch (error) {
      console.error('Error loading paused transfers:', error);
    }
  }, []);

  // Save paused transfers to localStorage when they change
  useEffect(() => {
    if (Object.keys(pausedTransfers).length > 0) {
      localStorage.setItem('pausedTransfers', JSON.stringify(pausedTransfers));
    }
  }, [pausedTransfers]);

  const addTransfer = useCallback((transfer) => {
    const id = Date.now().toString();
    const newTransfer = {
      id,
      progress: 0,
      status: 'in_progress',
      bytesPerSecond: 0,
      estimatedTimeRemaining: null,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      lastBytes: 0,
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
          const now = Date.now();
          const timeElapsed = now - transfer.lastUpdateTime;
          
          // Calculate transfer speed (bytes per second)
          let bytesPerSecond = transfer.bytesPerSecond;
          let estimatedTimeRemaining = transfer.estimatedTimeRemaining;
          
          if (timeElapsed > 500) { // Update every half second
            const bytesDelta = loaded - transfer.lastBytes;
            bytesPerSecond = Math.round(bytesDelta / (timeElapsed / 1000));
            
            // Calculate estimated time remaining
            if (bytesPerSecond > 0) {
              const bytesRemaining = total - loaded;
              estimatedTimeRemaining = Math.round(bytesRemaining / bytesPerSecond);
            }
          }
          
          return {
            ...transfer,
            progress,
            loaded,
            total,
            event,
            bytesPerSecond: bytesPerSecond || 0,
            estimatedTimeRemaining,
            lastUpdateTime: now,
            lastBytes: loaded
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
          progress: 100,
          bytesPerSecond: 0,
          estimatedTimeRemaining: null,
          completedAt: Date.now()
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
          error: error.message,
          bytesPerSecond: 0,
          estimatedTimeRemaining: null,
          errorAt: Date.now()
        } : transfer
      )
    );
  }, []);

  const pauseTransfer = useCallback((id) => {
    setTransfers(prev => {
      const updatedTransfers = prev.map(transfer => {
        if (transfer.id === id) {
          // Save the transfer state to pausedTransfers
          setPausedTransfers(pausedState => ({
            ...pausedState,
            [id]: {
              key: transfer.key,
              name: transfer.name,
              loaded: transfer.loaded,
              total: transfer.total,
              type: transfer.type,
              pausedAt: Date.now()
            }
          }));
          
          // Mark as paused in the current transfers list
          return {
            ...transfer,
            status: 'paused',
            bytesPerSecond: 0,
            estimatedTimeRemaining: null
          };
        }
        return transfer;
      });
      
      return updatedTransfers;
    });
  }, []);

  const resumeTransfer = useCallback((id) => {
    const pausedTransfer = pausedTransfers[id];
    if (pausedTransfer) {
      // Create a new transfer with the paused information
      const resumedId = addTransfer({
        name: pausedTransfer.name,
        type: pausedTransfer.type,
        size: pausedTransfer.total,
        key: pausedTransfer.key,
        loaded: pausedTransfer.loaded,
        resumed: true,
        originalId: id
      });
      
      // Remove from paused transfers
      setPausedTransfers(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      
      return resumedId;
    }
    return null;
  }, [pausedTransfers, addTransfer]);

  const cancelTransfer = useCallback((id) => {
    setTransfers(prev =>
      prev.map(transfer => {
        if (transfer.id === id) {
          transfer.controller?.abort();
          return {
            ...transfer,
            status: 'cancelled',
            progress: 0,
            bytesPerSecond: 0,
            estimatedTimeRemaining: null
          };
        }
        return transfer;
      })
    );
    
    // Also remove from paused transfers if it exists there
    setPausedTransfers(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }, []);

  const removeTransfer = useCallback((id) => {
    setTransfers(prev => prev.filter(transfer => transfer.id !== id));
    
    // Also remove from paused transfers if it exists there
    setPausedTransfers(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }, []);

  const value = {
    transfers,
    pausedTransfers,
    addTransfer,
    updateTransfer,
    updateTransferProgress,
    completeTransfer,
    errorTransfer,
    pauseTransfer,
    resumeTransfer,
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
