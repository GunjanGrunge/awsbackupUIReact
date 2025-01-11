import { Navbar, Nav, Container, Dropdown, DropdownButton } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUser, FaHome, FaFolder, FaHistory, FaCog, FaSignOutAlt, FaKey, FaMoneyBillWave, FaRobot } from 'react-icons/fa';
import { useState } from 'react';
import ProfileModal from './ProfileModal';
import awsLogo from '../images/aws-s3.png';
import aiLogo from '../images/ailogo.png';
import './Navbar.css';
import { useToast } from '../contexts/ToastContext';

function NavigationBar() {
  const { currentUser, logout, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const adminEmail = "stdevilgunjan@gmail.com";
  const isAdmin = currentUser?.email === adminEmail;

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Successfully logged out!', 'success');
      navigate('/login');
    } catch (error) {
      showToast('Failed to logout. Please try again.', 'danger');
      console.error('Failed to logout:', error);
    }
  };

  const handleResetPassword = async () => {
    try {
      await resetPassword(currentUser.email);
      showToast('Password reset email sent! Check your inbox.', 'success');
    } catch (error) {
      showToast('Failed to send reset email. Please try again.', 'danger');
      console.error('Failed to send reset email:', error);
    }
  };

  return (
    <>
      <Navbar 
        bg="white" 
        expand="lg" 
        fixed="top" 
        className="navbar-custom"
        expanded={expanded}
        onToggle={(expanded) => setExpanded(expanded)}
      >
        <Container fluid className="px-4">
          <Navbar.Brand as={Link} to="/" className="brand-wrapper me-4" onClick={() => setExpanded(false)}>
            <img src={awsLogo} height="40" className="brand-logo" alt="AWS S3 Logo" />
            <span className="brand-text">File Manager</span>
          </Navbar.Brand>
          <Navbar.Toggle 
            aria-controls="basic-navbar-nav"
            className="custom-toggler"
          />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mx-auto nav-links-center">
              {[
                { path: '/', icon: FaHome, label: 'Home' },
                { path: '/folder', icon: FaFolder, label: 'Folders' },
                { path: '/history', icon: FaHistory, label: 'Activity' },
                { path: '/cost', icon: FaMoneyBillWave, label: 'Cost' },
                ...(isAdmin ? [{ 
                  path: '/ai-analysis', 
                  icon: () => <img src={aiLogo} alt="AI" className="nav-icon ai-nav-icon" />, 
                  label: '' 
                }] : [])
              ].map(({ path, icon: Icon, label }) => (
                <Nav.Link
                  key={path}
                  as={Link}
                  to={path}
                  className={`nav-link-custom ${location.pathname === path ? 'active' : ''}`}
                  onClick={() => setExpanded(false)}
                >
                  <Icon className="nav-icon" />
                  <span>{label}</span>
                </Nav.Link>
              ))}
            </Nav>
            
            <div className="nav-actions">
              <DropdownButton
                id="user-dropdown"
                title={
                  <div className="d-flex align-items-center">
                    <div className="avatar-circle">
                      {currentUser?.displayName?.[0] || currentUser?.email?.[0] || 'U'}
                    </div>
                    <span className="ms-2 d-none d-md-inline username">
                      {currentUser?.displayName || currentUser?.email?.split('@')[0]}
                    </span>
                  </div>
                }
                variant="ghost"
                className="user-dropdown"
              >
                <Dropdown.Item onClick={() => setShowProfileModal(true)}>
                  <FaCog className="dropdown-icon" />
                  Profile Settings
                </Dropdown.Item>
                <Dropdown.Item onClick={handleResetPassword}>
                  <FaKey className="dropdown-icon" />
                  Change Password
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout} className="logout-item">
                  <FaSignOutAlt className="dropdown-icon" />
                  Sign Out
                </Dropdown.Item>
              </DropdownButton>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <ProfileModal 
        show={showProfileModal} 
        onHide={() => setShowProfileModal(false)} 
      />
    </>
  );
}

export default NavigationBar;
