import React from 'react';

const Alert = ({ type, message }) => {
  if (!message) return null;
  
  // Ensure message is a string
  const messageStr = typeof message === 'object' 
    ? JSON.stringify(message) 
    : String(message);
  
  return (
    <div className={`alert alert-${type}`}>
      {messageStr}
    </div>
  );
};

export default Alert;