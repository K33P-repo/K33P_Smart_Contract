import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist or has been moved.</p>
      <Link to="/">
        <button style={{ marginTop: '20px' }}>Go to Home Page</button>
      </Link>
    </div>
  );
};

export default NotFound;