import React from 'react';

const Spinner = ({ size = 'medium', color = '#4CAF50' }) => {
  // Determine size in pixels
  const sizeInPx = {
    small: 20,
    medium: 40,
    large: 60
  }[size] || 40;

  const spinnerStyle = {
    border: `${sizeInPx / 8}px solid rgba(0, 0, 0, 0.1)`,
    borderTop: `${sizeInPx / 8}px solid ${color}`,
    borderRadius: '50%',
    width: `${sizeInPx}px`,
    height: `${sizeInPx}px`,
    animation: 'spin 1s linear infinite',
    margin: '20px auto'
  };

  return (
    <div>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={spinnerStyle}></div>
    </div>
  );
};

export default Spinner;