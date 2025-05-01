import PropTypes from 'prop-types';
import { Card, Table } from 'react-bootstrap';
import { FaArchive, FaClock } from 'react-icons/fa';
import { formatFileSize } from '../services/s3Service';
import './GlacierStatusCard.css';

const GlacierStatusCard = ({ stats }) => {
  if (!stats) return null;

  return (
    <Card className="glacier-status-card mb-4">
      <Card.Header className="d-flex align-items-center">
        <FaArchive className="me-2" />
        <h5 className="mb-0">Glacier Storage Status</h5>
      </Card.Header>
      
      <Card.Body>
        <div className="glacier-stats">
          <div className="stat-item">
            <label>Total Files in Glacier:</label>
            <span className="stat-value">{stats.glacierCount.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <label>Total Size in Glacier:</label>
            <span className="stat-value">{formatFileSize(stats.glacierSize)}</span>
          </div>
        </div>

        {stats.pendingTransitions.length > 0 && (
          <div className="pending-archives mt-4">
            <h6 className="d-flex align-items-center mb-3">
              <FaClock className="me-2" />
              Files Pending Archival
            </h6>
            <Table hover size="sm" className="pending-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Size</th>
                  <th>Time Until Archive</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendingTransitions.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{formatFileSize(item.size)}</td>
                    <td>
                      <span className={item.daysLeft <= 7 ? 'text-danger' : 'text-warning'}>
                        {item.daysLeft} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {stats.totalPendingCount > 10 && (
              <div className="more-files-note">
                And {stats.totalPendingCount - 10} more files pending archival...
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

GlacierStatusCard.propTypes = {
  stats: PropTypes.shape({
    glacierCount: PropTypes.number.isRequired,
    glacierSize: PropTypes.number.isRequired,
    pendingTransitions: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        size: PropTypes.number.isRequired,
        daysLeft: PropTypes.number.isRequired,
      })
    ).isRequired,
    totalPendingCount: PropTypes.number.isRequired,
  }),
};

export default GlacierStatusCard;