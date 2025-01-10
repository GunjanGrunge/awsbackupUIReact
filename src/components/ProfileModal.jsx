import { useState } from 'react';
import { Modal, Form, Button, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const ProfileModal = ({ show, onHide }) => {
  const { currentUser, updateUserProfile, updateUserEmail } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: currentUser?.displayName || '',
    email: currentUser?.email || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates = [];

      if (formData.displayName !== currentUser?.displayName) {
        updates.push(updateUserProfile({ displayName: formData.displayName }));
      }

      if (formData.email !== currentUser?.email) {
        updates.push(updateUserEmail(formData.email));
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        showToast('Profile updated successfully! Please verify your new email if changed.', 'success');
        onHide();
      } else {
        showToast('No changes to update', 'info');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      showToast(error.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Update Profile</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Display Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter your name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email Address</Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
            />
            {formData.email !== currentUser?.email && (
              <Form.Text className="text-muted">
                You'll need to verify your new email address after updating.
              </Form.Text>
            )}
          </Form.Group>

          <div className="d-grid gap-2">
            <Button 
              type="submit" 
              variant="primary" 
              disabled={loading || (!formData.displayName && formData.email === currentUser?.email)}
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  <span>Updating...</span>
                </>
              ) : (
                'Update Profile'
              )}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default ProfileModal;
