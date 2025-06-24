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
      const responseData = response.data.data || response.data;
      
      setAlert({ 
        type: 'success', 
        message: responseData.message || 'Sign in successful!' 
      });
      
      // Login the user
      login({ 
        walletAddress: formData.walletAddress || responseData.walletAddress,
        phone: formData.phone || responseData.phone
      }, responseData.token);
      
      // Redirect after a delay
      setTimeout(() => {
        navigate('/refund');
      }, 1500);
      
    } catch (error) {
      console.error('Signin error:', error);
      setAlert({ 
        type: 'danger', 
        message: error.response?.data?.error || 'Failed to sign in. Please check your credentials.' 
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