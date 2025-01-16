import React, { useState, useEffect } from 'react';

const TypewriterText = ({ text, speed = 10 }) => {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let currentIndex = 0;
    setIsComplete(false);
    setDisplayText('');

    const intervalId = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayText(prev => prev + text[currentIndex]);
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(intervalId);
      }
    }, speed);

    return () => clearInterval(intervalId);
  }, [text, speed]);

  // Use pre-wrap to maintain formatting
  return (
    <pre style={{ 
      whiteSpace: 'pre-wrap',
      fontFamily: 'inherit',
      margin: 0
    }}>
      {displayText}
      {!isComplete && '▋'} {/* Blinking cursor while typing */}
    </pre>
  );
};

export default TypewriterText;
