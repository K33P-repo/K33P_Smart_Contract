import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="card">
      <h1>Welcome to K33P Identity System</h1>
      <p>
        K33P is a secure identity management system built on the Cardano blockchain.
        It allows users to securely store and manage their identity information using
        Zero-Knowledge proofs for privacy protection.
      </p>
      <div style={{ marginTop: '20px' }}>
        <Link to="/signup">
          <button>Sign Up</button>
        </Link>
        <Link to="/signin" style={{ marginLeft: '10px' }}>
          <button>Sign In</button>
        </Link>
      </div>
    </div>
  );
};

export default Home;