import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { AuthContext } from '../context/AuthContext';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

const Signup = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [depositAddress, setDepositAddress] = useState('');
  const [formData, setFormData] = useState({
    walletAddress: '',
    userId: '',
    phone: '',
    verificationMethod: 'phone',
    pin: '',
    biometricData: 'placeholder-biometric-data', // Simplified for demo
    biometricType: 'fingerprint',
    passkey: ''
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // Fetch deposit address when component mounts
  useEffect(() => {
    const fetchDepositAddress = async () => {
      try {
        const response = await apiService.healthCheck();
        if (response.data && response.data.data && response.data.data.address) {
          setDepositAddress(response.data.data.address);
        }
      } catch (error) {
        console.error('Error fetching deposit address:', error);
      }
    };
    
    fetchDepositAddress();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Show/hide PIN field based on verification method
    if (name === 'verificationMethod' && value === 'pin') {
      setFormData(prev => ({
        ...prev,
        pin: ''
      }));
    }
    
    // Update biometric type when verification method changes
    if (name === 'verificationMethod' && value === 'biometric') {
      setFormData(prev => ({
        ...prev,
        biometricType: 'fingerprint'
      }));
    }
  };
  
  const nextStep = () => {
    setCurrentStep(currentStep + 1);
  };
  
  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const validateStep = (step) => {
    switch(step) {
      case 1:
        return formData.walletAddress && formData.userId && formData.phone;
      case 2:
        if (formData.verificationMethod === 'pin') {
          return formData.pin && formData.pin.length === 4 && /^\d+$/.test(formData.pin);
        } else if (formData.verificationMethod === 'biometric') {
          return formData.biometricType;
        }
        return true;
      case 3:
        return formData.passkey;
      default:
        return true;
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert({ type: '', message: '' });

    try {
      // Validate all form data
      if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
        setAlert({ type: 'danger', message: 'All required fields must be filled correctly' });
        setLoading(false);
        return;
      }

      // Map frontend form data to backend expected format
      const signupData = {
        userAddress: formData.walletAddress,
        userId: formData.userId,
        phoneNumber: formData.phone,
        senderWalletAddress: formData.walletAddress,
        pin: formData.verificationMethod === 'pin' ? formData.pin : undefined,
        biometricData: formData.verificationMethod === 'biometric' ? formData.biometricData : undefined,
        verificationMethod: formData.verificationMethod,
        biometricType: formData.verificationMethod === 'biometric' ? formData.biometricType : undefined
      };

      // Call signup API
      const response = await apiService.signup(formData);
      
      // Handle successful signup
      // Safely extract data from the response
      const responseData = response.data?.data || response.data || {};
      
      // Update deposit address if provided in response
      if (responseData.depositAddress) {
        setDepositAddress(responseData.depositAddress);
      }
      
      // Determine appropriate success message
      let message = 'Signup successful!';
      if (typeof responseData.message === 'string') {
        message = responseData.message;
      } else if (responseData.verified === true) {
        message = 'Signup successful! Verification complete.';
      } else if (responseData.verified === false) {
        message = 'Signup recorded! Please follow verification instructions and send 2 ADA to the deposit address.';
      }
      
      setAlert({ 
        type: 'success', 
        message: message
      });
      
      // Move to deposit information step
      setCurrentStep(4);
      
      // If we have a token, login the user
      if (responseData.token) {
        login({ walletAddress: formData.walletAddress }, responseData.token);
      } else {
        console.log('No token received from signup response - user may need to verify first');
      }
      
    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to sign up. Please try again.';
      
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
      <h1>Sign Up</h1>
      <Alert type={alert.type} message={alert.message} />
      
      <form onSubmit={handleSubmit}>
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div>
            <h2>Step 1: Basic Information</h2>
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
              <label htmlFor="userId">User ID</label>
              <input
                type="text"
                id="userId"
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                placeholder="Choose a unique user ID (3-50 characters)"
                pattern="^[a-zA-Z0-9_]{3,50}$"
                title="User ID must be 3-50 characters, alphanumeric and underscores only"
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
            
            <button 
              type="button" 
              onClick={nextStep} 
              disabled={!validateStep(1)}
            >
              Next
            </button>
          </div>
        )}
        
        {/* Step 2: Verification Method */}
        {currentStep === 2 && (
          <div>
            <h2>Step 2: Choose Verification Method</h2>
            <div className="form-group">
              <label>Verification Method</label>
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'inline', marginRight: '15px' }}>
                  <input
                    type="radio"
                    name="verificationMethod"
                    value="phone"
                    checked={formData.verificationMethod === 'phone'}
                    onChange={handleChange}
                    style={{ width: 'auto', marginRight: '5px' }}
                  />
                  Phone
                </label>
                <label style={{ display: 'inline', marginRight: '15px' }}>
                  <input
                    type="radio"
                    name="verificationMethod"
                    value="pin"
                    checked={formData.verificationMethod === 'pin'}
                    onChange={handleChange}
                    style={{ width: 'auto', marginRight: '5px' }}
                  />
                  PIN
                </label>
                <label style={{ display: 'inline' }}>
                  <input
                    type="radio"
                    name="verificationMethod"
                    value="biometric"
                    checked={formData.verificationMethod === 'biometric'}
                    onChange={handleChange}
                    style={{ width: 'auto', marginRight: '5px' }}
                  />
                  Biometric
                </label>
              </div>
            </div>
            
            {formData.verificationMethod === 'pin' && (
              <div className="form-group">
                <label htmlFor="pin">4-Digit PIN</label>
                <input
                  type="password"
                  id="pin"
                  name="pin"
                  value={formData.pin}
                  onChange={handleChange}
                  placeholder="Enter 4-digit PIN"
                  maxLength="4"
                  pattern="^\d{4}$"
                  title="PIN must be exactly 4 digits"
                  required
                />
              </div>
            )}
            
            {formData.verificationMethod === 'biometric' && (
              <div className="form-group">
                <label htmlFor="biometricType">Biometric Type</label>
                <select
                  id="biometricType"
                  name="biometricType"
                  value={formData.biometricType}
                  onChange={handleChange}
                  required
                >
                  <option value="fingerprint">Fingerprint</option>
                  <option value="faceid">Face ID</option>
                  <option value="voice">Voice</option>
                  <option value="iris">Iris</option>
                </select>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={prevStep}>Previous</button>
              <button 
                type="button" 
                onClick={nextStep} 
                disabled={!validateStep(2)}
              >
                Next
              </button>
            </div>
          </div>
        )}
        
        {/* Step 3: Security */}
        {currentStep === 3 && (
          <div>
            <h2>Step 3: Security</h2>
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
            
            <div className="alert alert-info">
              <p><strong>Important:</strong> This signup requires a deposit of 2 ADA to the K33P smart contract.</p>
              <p>The deposit will be refundable when you complete the verification process.</p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={prevStep}>Previous</button>
              <button 
                type="submit" 
                disabled={loading || !validateStep(3)}
              >
                {loading ? 'Signing up...' : 'Complete Signup'}
              </button>
            </div>
            
            {loading && <Spinner size="small" />}
          </div>
        )}
        
        {/* Step 4: Deposit Information */}
        {currentStep === 4 && (
          <div>
            <h2>Deposit Information</h2>
            <div className="alert alert-success">
              <p>Your signup has been recorded! Please complete the verification by sending 2 ADA to the deposit address below.</p>
            </div>
            
            <div className="form-group">
              <label>Deposit Address</label>
              <div style={{ 
                padding: '10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
                wordBreak: 'break-all'
              }}>
                {depositAddress || 'Loading deposit address...'}
              </div>
            </div>
            
            <div className="alert alert-info">
              <p><strong>Instructions:</strong></p>
              <ol style={{ textAlign: 'left', paddingLeft: '20px' }}>
                <li>Send exactly 2 ADA to the address above</li>
                <li>Wait for the transaction to be confirmed on the blockchain</li>
                <li>Your account will be automatically verified once the deposit is detected</li>
                <li>You can request a refund of your deposit after verification</li>
              </ol>
            </div>
            
            <button 
              type="button" 
              onClick={() => navigate('/refund')}
            >
              Go to Refund Page
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default Signup;