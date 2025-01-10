import React, { useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';

const OTPModal = ({ show, onHide, onVerify, loading }) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onVerify(otp);
    } catch (error) {
      setError('Invalid OTP. Please try again.');
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Guest Verification</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <p>Enter the OTP sent to +919874332744</p>
        <Form onSubmit={handleSubmit}>
          <Form.Group>
            <Form.Control
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </Form.Group>
          <div className="d-flex justify-content-end mt-3">
            <Button variant="secondary" onClick={onHide} className="me-2">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default OTPModal;
