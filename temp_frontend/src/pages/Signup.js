import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { AuthContext } from '../context/AuthContext';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

const Signup = () => {
  const [formData, setFormData] = useState({
    walletAddress: '',
    phone: '',
    biometric: 'placeholder-biometric-data', // Simplified for demo
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
      if (!formData.walletAddress || !formData.phone || !formData.passkey) {
        setAlert({ type: 'danger', message: 'All fields are required' });
        setLoading(false);
        return;
      }

      // Call signup API
      const response = await apiService.signup(formData);
      
      // Handle successful signup
      setAlert({ 
        type: 'success', 
        message: `Signup successful! Transaction hash: ${response.data.txHash}` 
      });
      
      // Login the user
      login({ walletAddress: formData.walletAddress }, response.data.token);
      
      // Redirect after a delay
      setTimeout(() => {
        navigate('/refund');
      }, 2000);
      
    } catch (error) {
      console.error('Signup error:', error);
      setAlert({ 
        type: 'danger', 
        message: error.response?.data?.error || 'Failed to sign up. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>Sign Up</h1>
      <Alert type={alert.type} message={alert.message} />
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="walletAddress">Cardano Wallet Address</label>
          <input
            type="text"
            id="walletAddress"
            name="walletAddress"
            value={formData.walletAddress}
            onChange={handleChange}
            placeholder="addr_test1..."
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="1234567890"
            required
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
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
        
        {loading && <Spinner size="small" />}
      </form>
    </div>
  );
};

export default Signup;