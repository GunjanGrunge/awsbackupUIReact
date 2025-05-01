import { useEffect, useState } from 'react';
import './UploadAnimation.css';
import truckImage from '../images/truck.png';
import bikeImage from '../images/bike.png';

const UploadAnimation = ({ show, type }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, type === 'folder' ? 3000 : 2000); // Match animation duration

      return () => clearTimeout(timer);
    }
  }, [show, type]);

  if (!visible) return null;

  return (
    <div className="upload-animation-container">
      {type === 'folder' ? (
        <img src={truckImage} alt="Truck" className="truck-animation" />
      ) : (
        <img src={bikeImage} alt="Bike" className="bike-animation" />
      )}
    </div>
  );
};

export default UploadAnimation;