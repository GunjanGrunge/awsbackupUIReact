import { useState, useEffect } from 'react';
import { Card, Row, Col, Alert } from 'react-bootstrap';
import { 
  FaDatabase, 
  FaExchangeAlt, 
  FaDollarSign, 
  FaRupeeSign, 
  FaInfoCircle,
  FaCheckCircle,
  FaChartLine
} from 'react-icons/fa';
import { getBucketMetrics, formatFileSize } from '../services/s3Service';
import { useToast } from '../contexts/ToastContext';
import costImage from '../images/10075627.jpg';
import './Cost.css';
import { getCostData } from '../services/costService';  // Add this import

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
      const [bucketMetrics, exchangeData, costData] = await Promise.all([
        getBucketMetrics(),
        fetch('https://open.er-api.com/v6/latest/USD').then(res => res.json()),
        getCostData()
      ]);

      // Update metrics with actual cost data from Cost Explorer
      setMetrics({
        ...bucketMetrics,
        storageCost: costData.currentBillingCosts.storage,
        requestCost: costData.currentBillingCosts.requests.total,
        transferCost: costData.currentBillingCosts.transfer,
        totalCost: costData.currentBillingCosts.total,
        detailedCosts: costData
      });
      setExchangeRate(exchangeData.rates.INR || 83);
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    
    // Add ordinal suffix to day
    const ordinal = (d) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };

    return `${day}${ordinal(day)} ${month} ${year}`;
  };

  if (loading) {
    return <div className="loading-spinner">Loading cost information...</div>;
  }

  // Update the storage cost card
  const StorageCostCard = () => (
    <Card className="cost-card storage">
      <Card.Body>
        <div className="cost-icon">
          <FaDatabase />
        </div>
        <h3>Storage Cost</h3>
        <div className="cost-amount">
          <div className="inr">
            {formatCurrency((metrics?.detailedCosts?.currentBillingCosts?.storage || 0) * (exchangeRate || 83), 'INR')}
          </div>
          <div className="usd secondary">
            {formatCurrency(metrics?.detailedCosts?.currentBillingCosts?.storage || 0)}
          </div>
        </div>
        <div className="cost-details">
          <div>Total Storage: {formatFileSize(metrics?.totalSize || 0)}</div>
          <div>Objects: {metrics?.totalObjects || 0}</div>
        </div>
      </Card.Body>
    </Card>
  );

  // Update the request & transfer card
  const RequestTransferCard = () => (
    <Card className="cost-card transfer">
      <Card.Body>
        <div className="cost-icon">
          <FaExchangeAlt />
        </div>
        <h3>Request & Transfer</h3>
        <div className="cost-amount">
          <div className="inr">
            {formatCurrency(
              (metrics?.detailedCosts?.currentBillingCosts?.requests?.total || 0) * (exchangeRate || 83),
              'INR'
            )}
          </div>
          <div className="usd secondary">
            {formatCurrency(metrics?.detailedCosts?.currentBillingCosts?.requests?.total || 0)}
          </div>
        </div>
        <div className="cost-details">
          <div>Total Requests: {metrics?.detailedCosts?.requestMetrics?.tier1Requests?.toLocaleString() || 0}</div>
          <div>Rate: $0.005 per 1,000 requests</div>
        </div>
      </Card.Body>
    </Card>
  );

  // Update the total cost card
  const TotalCostCard = () => (
    <Card className="cost-card total">
      <Card.Body>
        <div className="cost-icon">
          <FaRupeeSign/>
        </div>
        <h3>Total Cost</h3>
        <div className="cost-amount">
          <div className="inr">{formatCurrency(metrics?.totalCost * (exchangeRate || 83), 'INR')}</div>
          <div className="usd secondary">{formatCurrency(metrics?.totalCost || 0)}</div>
        </div>
        <div className="cost-details">
          Monthly Estimate: {formatCurrency(metrics?.detailedCosts?.projectedCosts?.total || 0)}
        </div>
      </Card.Body>
    </Card>
  );

  // Add dual currency display component
  const DualCurrencyDisplay = ({ amount }) => (
    <div>
      <div>{formatCurrency(amount * (exchangeRate || 83), 'INR')}</div>
      <div className="secondary-currency">{formatCurrency(amount)}</div>
    </div>
  );

  const ServiceChargesSection = () => (
    <Card className="cost-details-card">
      <Card.Header>
        <h3>
          <FaChartLine className="section-icon" />
          AWS Service Charges
        </h3>
      </Card.Header>
      <Card.Body>
        <div className="service-charges">
          <div className="service-type">
            <div className="service-type-header">
              <h4>Storage Charges</h4>
              <DualCurrencyDisplay 
                amount={metrics?.detailedCosts?.currentBillingCosts?.storage || 0} 
              />
            </div>
            <div className="metrics-grid">
              <div className="metric-item">
                <span>Total Storage</span>
                <div>{formatFileSize(metrics?.totalSize || 0)}</div>
              </div>
              <div className="metric-item">
                <span>Objects</span>
                <div>{metrics?.totalObjects?.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="service-type">
            <div className="service-type-header">
              <h4>API Requests</h4>
              <DualCurrencyDisplay 
                amount={metrics?.detailedCosts?.currentBillingCosts?.requests?.total || 0} 
              />
            </div>
            <div className="metrics-grid">
              <div className="metric-item">
                <span>Tier 1 Requests</span>
                <div>{metrics?.detailedCosts?.requestMetrics?.tier1Requests?.toLocaleString()}</div>
                <small>{formatCurrency(metrics?.detailedCosts?.currentBillingCosts?.requests?.tier1 || 0)}</small>
              </div>
              <div className="metric-item">
                <span>Tier 2 Requests</span>
                <div>{metrics?.detailedCosts?.requestMetrics?.tier2Requests?.toLocaleString()}</div>
                <small>{formatCurrency(metrics?.detailedCosts?.currentBillingCosts?.requests?.tier2 || 0)}</small>
              </div>
            </div>
          </div>

          {/* ... similar sections for Data Transfer ... */}

          <div className="total-section">
            <div className="total-row">
              <span className="total-label">Total Current Charges</span>
              <DualCurrencyDisplay 
                amount={metrics?.detailedCosts?.currentBillingCosts?.total || 0} 
                className="total-value"
              />
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  const BillingHeader = () => (
    <div className="billing-header">
      <div className="billing-info">
        <div className="billing-period">
          <span className="info-label">Billing Period</span>
          <span className="info-value">
            {formatDate(metrics?.detailedCosts?.billingCycle?.start)} - {formatDate(metrics?.detailedCosts?.billingCycle?.end)}
          </span>
        </div>
        <div className="billing-progress">
          <span className="info-label">Billing Cycle Progress</span>
          <div className="progress-container">
            <div className="progress-bar" 
                 style={{ width: `${(metrics?.detailedCosts?.billingCycle?.daysElapsed / 31) * 100}%` }}>
            </div>
            <span className="progress-text">
              {metrics?.detailedCosts?.billingCycle?.daysElapsed} of {metrics?.detailedCosts?.billingCycle?.daysElapsed + metrics?.detailedCosts?.billingCycle?.daysRemaining} days
            </span>
          </div>
        </div>
        <div className="exchange-rate">
          <span className="info-label">Exchange Rate</span>
          <span className="info-value">
            <FaDollarSign className="currency-icon" /> 1 = <FaRupeeSign className="currency-icon" /> {exchangeRate?.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="cost-container">
      <h2 className="cost-title">Current Billing Cycle Costs</h2>
      <BillingHeader />
      <Row className="mt-4">
        <Col md={4}><StorageCostCard /></Col>
        <Col md={4}><RequestTransferCard /></Col>
        <Col md={4}><TotalCostCard /></Col>
      </Row>

      <Row className="mt-4">
        <Col md={12}>
          <Card className="cost-details-card">
            <Card.Header>
              <h3>Request & Transfer Details</h3>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <h4>Request Details</h4>
                  <ul className="cost-breakdown-list">
                    <li>
                      <span>Tier 1 Requests:</span>
                      <span>{metrics?.detailedCosts?.requestMetrics?.tier1Requests?.toLocaleString()} requests</span>
                    </li>
                    <li>
                      <span>Tier 1 Cost:</span>
                      <span>{formatCurrency(metrics?.detailedCosts?.currentBillingCosts?.requests?.tier1 || 0)}</span>
                    </li>
                    <li>
                      <span>Rate:</span>
                      <span>$0.005 per 1,000 requests</span>
                    </li>
                  </ul>
                </Col>
                <Col md={6}>
                  <h4>Data Transfer</h4>
                  <ul className="cost-breakdown-list">
                    <li>
                      <span>Data Transfer Out:</span>
                      <span>{formatFileSize(metrics?.detailedCosts?.dataTransfer?.bytesOut || 0)}</span>
                    </li>
                    <li>
                      <span>Transfer Cost:</span>
                      <span>{formatCurrency(metrics?.detailedCosts?.currentBillingCosts?.transfer || 0)}</span>
                    </li>
                  </ul>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <ServiceChargesSection />

      <Row className="mt-4">
        <Col md={12} className="mt-4">
          <Card className="cost-details-card">
            <Card.Header>
              <h3>Detailed Cost Breakdown</h3>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <h4>Storage Costs</h4>
                  <ul className="cost-breakdown-list">
                    <li>
                      <span>Standard Storage:</span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.monthlyCosts?.storage || 0} />
                    </li>
                    <li>
                      <span>Request Costs:</span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.monthlyCosts?.requests || 0} />
                    </li>
                    <li>
                      <span>Data Transfer:</span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.monthlyCosts?.transfer || 0} />
                    </li>
                  </ul>
                </Col>
                <Col md={6}>
                  <h4>Usage Statistics</h4>
                  <ul className="cost-breakdown-list">
                    <li>
                      <span>Total Objects:</span>
                      <span>{metrics?.totalObjects}</span>
                    </li>
                    <li>
                      <span>Storage Used:</span>
                      <span>{formatFileSize(metrics?.totalSize)}</span>
                    </li>
                    <li>
                      <span>Monthly Requests:</span>
                      <span>{metrics?.detailedCosts?.estimatedMonthlyRequests?.total || 0}</span>
                    </li>
                  </ul>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col md={12}>
          <Card className="cost-details-card">
            <Card.Header>
              <h3>Current Billing Cycle Details</h3>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <h4>Current Month Costs</h4>
                  <ul className="cost-breakdown-list">
                    <li>
                      <span>Storage:</span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.currentBillingCosts?.storage || 0} />
                    </li>
                    <li>
                      <span>Data Transfer:</span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.currentBillingCosts?.transfer || 0} />
                    </li>
                    <li>
                      <span>API Requests:</span>
                      <DualCurrencyDisplay 
                        amount={(metrics?.detailedCosts?.currentBillingCosts?.requests?.tier1 || 0) + 
                               (metrics?.detailedCosts?.currentBillingCosts?.requests?.tier2 || 0)} 
                      />
                    </li>
                    <li className="total-cost">
                      <span><strong>Total Current Cost:</strong></span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.currentBillingCosts?.total || 0} />
                    </li>
                  </ul>
                </Col>
                <Col md={6}>
                  <h4>Projected Costs</h4>
                  <ul className="cost-breakdown-list">
                    <li>
                      <span>Projected Storage:</span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.projectedCosts?.storage || 0} />
                    </li>
                    <li>
                      <span>Projected Transfer:</span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.projectedCosts?.transfer || 0} />
                    </li>
                    <li>
                      <span>Projected API Costs:</span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.projectedCosts?.requests || 0} />
                    </li>
                    <li className="total-cost">
                      <span><strong>Total Projected:</strong></span>
                      <DualCurrencyDisplay amount={metrics?.detailedCosts?.projectedCosts?.total || 0} />
                    </li>
                  </ul>
                </Col>
              </Row>
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