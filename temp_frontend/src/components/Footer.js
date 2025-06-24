import React from 'react';

const Footer = () => {
  const year = new Date().getFullYear();
  
  return (
    <footer style={{
      marginTop: '40px',
      padding: '20px',
      textAlign: 'center',
      borderTop: '1px solid #eaeaea',
      color: '#666',
      fontSize: '0.9rem'
    }}>
      <p>© {year} K33P Identity System. All rights reserved.</p>
      <p style={{ marginTop: '10px' }}>
        <a 
          href="#privacy" 
          style={{ color: '#4CAF50', marginRight: '15px', textDecoration: 'none' }}
          onClick={(e) => {
            e.preventDefault();
            alert('Privacy Policy page would open here');
          }}
        >
          Privacy Policy
        </a>
        <a 
          href="#terms" 
          style={{ color: '#4CAF50', marginRight: '15px', textDecoration: 'none' }}
          onClick={(e) => {
            e.preventDefault();
            alert('Terms of Service page would open here');
          }}
        >
          Terms of Service
        </a>
        <a 
          href="#contact" 
          style={{ color: '#4CAF50', textDecoration: 'none' }}
          onClick={(e) => {
            e.preventDefault();
            alert('Contact page would open here');
          }}
        >
          Contact
        </a>
      </p>
    </footer>
  );
};

export default Footer;