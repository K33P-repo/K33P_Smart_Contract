import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser, logout } = useContext(AuthContext);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">K33P Identity System</Link>
      </div>
      <div className="navbar-links">
        {currentUser ? (
          <>
            <Link to="/refund">Refund</Link>
            <button 
              className="navbar-link-button" 
              onClick={() => logout()}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/signup">Signup</Link>
            <Link to="/signin">Signin</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;