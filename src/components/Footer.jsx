import awsLogo from '../images/Amazon_Web_Services-Logo.wine.png';
import reactLogo from '../images/react.png';
import fireBase from '../images/firebase.png';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <span className="footer-text">Powered by</span>
        <img src={awsLogo} alt="AWS Logo" className="aws-logo" />
        <img src={reactLogo} alt="React Logo" className="aws-logo" />
        <img src={fireBase} alt="Firebase Logo" className="firebase-logo"/>
      </div>
    </footer>
  );
};

export default Footer;
