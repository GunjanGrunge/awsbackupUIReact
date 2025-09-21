import awsLogo from '../images/Amazon_Web_Services-Logo.wine.png';
import reactLogo from '../images/react.png';
import fireBase from '../images/firebase.png';
import supabaseLogo from '../images/icons8-supabase-144.png';
import vayuLogo from '../images/Logo.png';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="powered-by-section">
          <span className="footer-text">Powered by</span>
          <img src={awsLogo} alt="AWS Logo" className="aws-logo" />
          <img src={reactLogo} alt="React Logo" className="aws-logo" />
          <img src={fireBase} alt="Firebase Logo" className="firebase-logo"/>
          <img src={supabaseLogo} alt="Supabase Logo" className="supabase-logo"/>
        </div>
        <div className="vayu-section">
          <img src={vayuLogo} alt="Vayu Logo" className="vayu-logo" />
          <span className="vayu-text">A Vayu innovation</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
