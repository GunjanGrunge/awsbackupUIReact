import React, { useState, useEffect } from 'react';
import { getHistoryLog, formatFileSize } from '../services/s3Service';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const historyData = await getHistoryLog();
        
        // Sort history by date in descending order (newest first)
        const sortedHistory = [...historyData].sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );
        
        setHistory(sortedHistory);
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Helper function to safely format file size
  const safeFormatFileSize = (size) => {
    if (typeof size !== 'number' || isNaN(size)) {
      return '0 Bytes';
    }
    return formatFileSize(size);
  };

  if (loading) {
    return <div>Loading history...</div>;
  }

  return (
    <div className="history-container">
      <h2>Activity History</h2>
      <div className="history-list">
        {history.map((item, index) => (
          <div key={item.date + index} className="history-item">
            <div className="history-item-header">
              <span className="history-action">{item.action || 'Unknown Action'}</span>
              <span className="history-date">
                {formatDate(item.date)}
              </span>
            </div>
            <div className="history-item-details">
              <span className="history-name">{item.itemName || 'Unnamed Item'}</span>
              <span className="history-size">{safeFormatFileSize(item.size)}</span>
              {item.fileCount > 1 && (
                <span className="history-count">
                  ({item.fileCount} {item.fileCount === 1 ? 'file' : 'files'})
                </span>
              )}
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <div className="no-history">No activity history available</div>
        )}
      </div>
    </div>
  );
};

export default History;
