import { Modal } from 'react-bootstrap';
import Confetti from 'react-confetti';
import { useState, useEffect } from 'react';
import '../styles/WelcomeModal.css';

const WelcomeModal = ({ show, onHide }) => {
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    useEffect(() => {
        console.log('Modal show state:', show); // Debug log
        
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Call immediately

        return () => window.removeEventListener('resize', handleResize);
    }, [show]);

    if (!show) return null;

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            size="lg"
            className="welcome-modal"
            backdrop="static"
            keyboard={false}
        >
            <Confetti
                width={windowSize.width}
                height={windowSize.height}
                numberOfPieces={300}
                recycle={true}
                run={show}
            />
            <Modal.Body className="text-center p-5 gradient-bg">
                <div className="welcome-content">
                    <h1 className="welcome-title">
                        Hello Salamat Sir! 👋
                    </h1>
                    <p className="welcome-message">
                        Welcome back to your File Manager!
                    </p>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default WelcomeModal;
