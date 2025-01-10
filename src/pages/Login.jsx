import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import WelcomeModal from '../components/WelcomeModal';
import './Login.css';
import loginpageimage from '../images/4957136.jpg';
import brandLogo from '../images/aws-s3.png';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            
            // Move this BEFORE navigation
            if (email.toLowerCase().trim() === 'shareit@gmail.com') {
                setShowWelcome(true);
                // Wait for modal to show before navigating
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            showToast('Login successful!', 'success');
            navigate('/');
        } catch (error) {
            console.error('Login error:', error);
            if (error.message.includes('reCAPTCHA')) {
                setError('Please complete the reCAPTCHA verification');
            } else {
                setError('Invalid credentials');
            }
            showToast('Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Add useEffect to handle modal timing
    useEffect(() => {
        if (showWelcome) {
            // Keep modal open for 5 seconds
            const timer = setTimeout(() => {
                setShowWelcome(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showWelcome]);

    return (
        <>
            <div className="login-page">
                <div className="row g-0 h-100">
                    <div className="col-md-6">
                        <div className="login-container">
                            <div className="brand-logo-container mb-4">
                                <img src={brandLogo} alt="AWS S3" className="brand-logo" />
                            </div>
                            <h2>Login to File Manager</h2>
                            {error && (
                                <div className="alert alert-danger">{error}</div>
                            )}
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary w-100 mb-2"
                                    disabled={loading}
                                >
                                    {loading ? 'Logging in...' : 'Login'}
                                </button>
                            </form>
                            <div className="mt-3 text-center">
                                <a href="#" id="forgot-password-link">Forgot Password?</a>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="login-image">
                            <img src={loginpageimage} alt="Login Illustration" className="img-fluid" />
                        </div>
                    </div>
                </div>
            </div>
            <WelcomeModal 
                show={showWelcome} 
                onHide={() => setShowWelcome(false)} 
            />
        </>
    );
};

export default Login;
