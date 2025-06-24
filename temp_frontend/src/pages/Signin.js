import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { AuthContext } from '../context/AuthContext';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

const Signin = () => {
  const [formData, setFormData] = useState({
    walletAddress: '',
    phone: '',
    passkey: ''
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert({ type: '', message: '' });

    try {
      // Validate form data
      if ((!formData.walletAddress && !formData.phone) || !formData.passkey) {
        setAlert({ 
          type: 'danger', 
          message: 'Either Wallet Address or Phone Number is required, along with Passkey' 
        });
        setLoading(false);
        return;
      }

      // Call signin API
      const response = await apiService.signin(formData);
      
      // Handle successful signin
      // Safely extract data from the response
      const responseData = response.data?.data || response.data || {};
      const message = typeof responseData.message === 'string' ? responseData.message : 'Sign in successful!';
      
      setAlert({ 
        type: 'success', 
        message: message 
      });
      
      // Ensure token exists before login
      if (responseData.token) {
        // Login the user
        login({ 
          walletAddress: formData.walletAddress || responseData.walletAddress,
          phone: formData.phone || responseData.phone
        }, responseData.token);
        
        // Redirect is handled in the token check above
      } else {
        console.error('No token received from signin response');
        setAlert({
          type: 'warning',
          message: 'Authentication successful but no token received. Please try again.'
        });
      }
      
      // Redirect after a delay
      setTimeout(() => {
        navigate('/refund');
      }, 1500);
      
    } catch (error) {
      console.error('Signin error:', error);
      let errorMessage = 'Failed to sign in. Please check your credentials.';
      
      // Handle different error formats
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (typeof error.message === 'string') {
        try {
          // Try to parse error message if it's a stringified JSON
          const parsedError = JSON.parse(error.message);
          errorMessage = parsedError.response?.data?.error || errorMessage;
        } catch (e) {
          // If parsing fails, use the error message directly
          errorMessage = error.message || errorMessage;
        }
      }
      
      setAlert({ 
        type: 'danger', 
        message: errorMessage 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>Sign In</h1>
      <Alert type={alert.type} message={alert.message} />
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="walletAddress">Cardano Wallet Address (Optional if Phone provided)</label>
          <input
            type="text"
            id="walletAddress"
            name="walletAddress"
            value={formData.walletAddress}
            onChange={handleChange}
            placeholder="addr_test1..."
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="phone">Phone Number (Optional if Wallet Address provided)</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="1234567890"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="passkey">Passkey</label>
          <input
            type="password"
            id="passkey"
            name="passkey"
            value={formData.passkey}
            onChange={handleChange}
            placeholder="Your secure passkey"
            required
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        
        {loading && <Spinner size="small" />}
      </form>
    </div>
  );
};

export default Signin;