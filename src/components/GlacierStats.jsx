import PropTypes from 'prop-types';
import { Card, Row, Col, ProgressBar } from 'react-bootstrap';
import { FaArchive, FaClock } from 'react-icons/fa';
import { formatFileSize } from '../services/s3Service';
import './GlacierStats.css';

const GlacierStats = ({ stats }) => {
  if (!stats) return null;

  return (
    <Card className="glacier-stats-card mb-4">
      <Card.Body>
        <h4 className="mb-3">
          <FaArchive className="me-2" />
          Storage Statistics
        </h4>
        
        <Row>
          <Col md={6}>
            <div className="stats-section">
              <h5>Storage Overview</h5>
              <div className="stat-item">
                <span>Total Files:</span>
                <strong>{stats.totalCount.toLocaleString()}</strong>
              </div>
              <div className="stat-item">
                <span>Total Size:</span>
                <strong>{formatFileSize(stats.totalSize)}</strong>
              </div>
              <div className="stat-item">
                <span>Archived Files:</span>
                <strong>{stats.glacierCount.toLocaleString()}</strong>
              </div>
              <div className="stat-item">
                <span>Archived Size:</span>
                <strong>{formatFileSize(stats.glacierSize)}</strong>
              </div>
            </div>
          </Col>
          
          <Col md={6}>
            <div className="stats-section">
              <h5>Archive Status</h5>
              <div className="progress-section">
                <label>Files in Glacier ({Math.round(stats.glacierPercentage)}%)</label>
                <ProgressBar 
                  now={stats.glacierPercentage} 
                  variant="warning"
                  className="mb-3"
                />
                
                <label>Storage in Glacier ({Math.round(stats.glacierSizePercentage)}%)</label>
                <ProgressBar 
                  now={stats.glacierSizePercentage} 
                  variant="warning"
                />
              </div>
            </div>
          </Col>
        </Row>

        {stats.pendingTransitions.length > 0 && (
          <div className="pending-transitions mt-3">
            <h5>
              <FaClock className="me-2" />
              Upcoming Transitions
            </h5>
            <div className="transitions-list">
              {stats.pendingTransitions.map((item, index) => (
                <div key={index} className="transition-item">
                  <span className="file-name">{item.name}</span>
                  <span className="days-left">{item.daysLeft} days until archive</span>
                  <span className="file-size">{formatFileSize(item.size)}</span>
                </div>
              ))}
            </div>
            {stats.totalPendingCount > 10 && (
              <div className="more-transitions">
                And {stats.totalPendingCount - 10} more files...
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

GlacierStats.propTypes = {
  stats: PropTypes.shape({
    totalCount: PropTypes.number.isRequired,
    totalSize: PropTypes.number.isRequired,
    glacierCount: PropTypes.number.isRequired,
    glacierSize: PropTypes.number.isRequired,
    glacierPercentage: PropTypes.number.isRequired,
    glacierSizePercentage: PropTypes.number.isRequired,
    pendingTransitions: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        daysLeft: PropTypes.number.isRequired,
        size: PropTypes.number.isRequired,
      })
    ).isRequired,
    totalPendingCount: PropTypes.number.isRequired,
  }),
};

export default GlacierStats;