import awsLogo from '../images/Amazon_Web_Services-Logo.wine.png';
import reactLogo from '../images/react.png';
import fireBase from '../images/firebase.png';
import openai from '../images/openai.png';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <span className="footer-text">Powered by</span>
        <img src={awsLogo} alt="AWS Logo" className="aws-logo" />
        <img src={reactLogo} alt="AWS Logo" className="aws-logo" />
        <img src={fireBase} alt="AWS Logo" className="firebase-logo"/>
        <img src={openai} alt="AWS Logo" className="openai-logo"/>
      </div>
    </footer>
  );
};

export default Footer;
