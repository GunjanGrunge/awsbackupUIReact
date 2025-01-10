import { useState, useEffect } from 'react';
import { Card, Row, Col, Alert } from 'react-bootstrap';
import { 
  FaDatabase, 
  FaExchangeAlt, 
  FaDollarSign, 
  FaRupeeSign, 
  FaInfoCircle,
  FaCheckCircle 
} from 'react-icons/fa';
import { getBucketMetrics, formatFileSize } from '../services/s3Service';
import { useToast } from '../contexts/ToastContext';
import costImage from '../images/10075627.jpg';
import './Cost.css';

const Cost = () => {
  const [metrics, setMetrics] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsData, exchangeData] = await Promise.all([
        getBucketMetrics(),
        fetch('https://open.er-api.com/v6/latest/USD')
          .then(res => res.json())
      ]);

      setMetrics(metricsData);
      setExchangeRate(exchangeData.rates.INR);
    } catch (error) {
      showToast('Failed to load cost information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    });
    return formatter.format(amount);
  };

  if (loading) {
    return <div className="loading-spinner">Loading cost information...</div>;
  }

  return (
    <div className="cost-container">
      <h2 className="cost-title">Storage & Transfer Costs</h2>
      <Alert variant="info" className="exchange-rate-alert">
        <FaInfoCircle className="me-2" />
        Exchange Rate: 1 USD = ₹{exchangeRate?.toFixed(2)} INR
        <small className="d-block mt-1">
          (Live rates from Exchange Rate API - Updated every hour)
        </small>
      </Alert>

      <Row className="mt-4">
        <Col md={4}>
          <Card className="cost-card storage">
            <Card.Body>
              <div className="cost-icon">
                <FaDatabase />
              </div>
              <h3>Storage Cost</h3>
              <div className="cost-amount">
                <div className="inr">{formatCurrency(metrics?.storageCost * exchangeRate, 'INR')}</div>
                <div className="usd secondary">{formatCurrency(metrics?.storageCost)}</div>
              </div>
              <div className="cost-details">
                Total Storage: {formatFileSize(metrics?.totalSize)}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="cost-card transfer">
            <Card.Body>
              <div className="cost-icon">
                <FaExchangeAlt />
              </div>
              <h3>Transfer Cost</h3>
              <div className="cost-amount">
                <div className="inr">{formatCurrency(metrics?.transferCost * exchangeRate, 'INR')}</div>
                <div className="usd secondary">{formatCurrency(metrics?.transferCost)}</div>
              </div>
              <div className="cost-details">
                Objects: {metrics?.totalObjects}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="cost-card total">
            <Card.Body>
              <div className="cost-icon">
                <FaRupeeSign/>
              </div>
              <h3>Total Cost</h3>
              <div className="cost-amount">
                <div className="inr">{formatCurrency(metrics?.totalCost * exchangeRate, 'INR')}</div>
                <div className="usd secondary">{formatCurrency(metrics?.totalCost)}</div>
              </div>
              <div className="cost-details">
                Monthly Estimate
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="welcome-section mt-4">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <h2 className="welcome-title mb-4">Cost Management</h2>
            <p className="welcome-text">
              Monitor and optimize your AWS S3 storage costs with our comprehensive cost management dashboard. 
              Track storage usage and data transfer expenses in real-time.
            </p>
            <ul className="feature-list">
              <li><FaCheckCircle className="feature-icon" /> Real-time cost tracking</li>
              <li><FaCheckCircle className="feature-icon" /> Storage usage analytics</li>
              <li><FaCheckCircle className="feature-icon" /> Transfer cost monitoring</li>
              <li><FaCheckCircle className="feature-icon" /> Cost optimization insights</li>
            </ul>
          </div>
          <div className="col-lg-6">
            <div className="welcome-image">
              <img src={costImage} alt="Cost Management Illustration" className="img-fluid" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cost;
