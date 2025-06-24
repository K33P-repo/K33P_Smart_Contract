# K33P Backend Integration Guide for React Native

## Overview

This guide provides instructions for integrating the K33P Identity System backend with your React Native mobile application. The K33P system uses Cardano blockchain for secure identity verification and management.


## Backend API

The backend provides a RESTful API for frontend integration. Detailed API documentation can be found in the `API_DOCUMENTATION.md` file.

### Base URL

The base URL for all API endpoints in development environment is:

```
http://localhost:3000/api
```

In production environment, the base URL will be different. The application uses the `getApiUrl` utility function to dynamically determine the appropriate URL based on the environment.

## User Flow

The typical user flow for the K33P Identity System is as follows:

1. **Get Deposit Address**: Your app requests the deposit address from the backend
2. **User Sends Deposit**: User sends 2 ADA to the deposit address from their wallet
3. **Record Signup**: Your app submits user information and sender wallet address to the backend
4. **Verification**: Backend verifies the transaction on the blockchain
5. **Status Check**: Your app periodically checks the user's status
6. **Completion**: Once verified, the user's identity is established in the system

## React Native Implementation

### Setting Up API Client

Create an API client service in your React Native project:

```javascript
// src/services/api.js
import { Alert } from 'react-native';
import { getApiUrl } from '../utils/api-url';

// Use the getApiUrl utility to dynamically determine the API URL based on environment
const API_URL = getApiUrl('/api').slice(0, -1); // Remove trailing slash from path

// For development on physical device, you might need to use your computer's local IP
// This can be configured in your environment settings

export const apiClient = {
  async get(endpoint) {
    try {
      const response = await fetch(`${API_URL}/${endpoint}`);
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  },

  async post(endpoint, data) {
    try {
      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  },

  async handleResponse(response) {
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'API request failed');
    }
    return data;
  },

  handleError(error) {
    console.error('API Error:', error);
    Alert.alert('Error', error.message || 'Something went wrong');
    throw error;
  },
};
```

### Implementing K33P Service

Create a dedicated service for K33P-specific API calls:

```javascript
// src/services/k33pService.js
import { apiClient } from './api';

export const k33pService = {
  async getDepositAddress() {
    const response = await apiClient.get('deposit-address');
    return response.data.address;
  },

  async recordSignup(userAddress, userId, phoneNumber, senderWalletAddress, pin, biometricData, verificationMethod = 'phone', biometricType) {
    return await apiClient.post('signup', {
      userAddress,
      userId,
      phoneNumber,
      senderWalletAddress,
      pin,
      biometricData,
      verificationMethod,
      biometricType
    });
  },

  async checkUserStatus(userAddress) {
    return await apiClient.get(`user/${userAddress}/status`);
  },

  async retryVerification(userAddress) {
    return await apiClient.post('retry-verification', { userAddress });
  }
};
```

### React Native Component Example

Here's an example of a signup screen component:

```javascript
// src/screens/SignupScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Switch } from 'react-native';
import { k33pService } from '../services/k33pService';

const SignupScreen = ({ navigation }) => {
  const [userId, setUserId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [senderWalletAddress, setSenderWalletAddress] = useState('');
  const [depositAddress, setDepositAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [biometricData, setBiometricData] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('phone');
  const [biometricType, setBiometricType] = useState('fingerprint');

  useEffect(() => {
    fetchDepositAddress();
  }, []);

  const fetchDepositAddress = async () => {
    try {
      setLoading(true);
      const address = await k33pService.getDepositAddress();
      setDepositAddress(address);
    } catch (error) {
      Alert.alert('Error', 'Failed to get deposit address');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricScan = async () => {
    // This would be implemented using a biometric library like react-native-biometrics
    // For this example, we'll just simulate a successful scan
    Alert.alert('Biometric Scan', 'Biometric data captured successfully');
    setBiometricData('simulated-biometric-data-hash');
  };

  const handleSignup = async () => {
    if (!userId || !userAddress || !senderWalletAddress) {
      Alert.alert('Error', 'User ID, Address and Sender Wallet Address are required');
      return;
    }

    if (verificationMethod === 'phone' && !phoneNumber) {
      Alert.alert('Error', 'Phone number is required for phone verification');
      return;
    }

    if (verificationMethod === 'pin' && (!pin || pin.length !== 4)) {
      Alert.alert('Error', 'A 4-digit PIN is required for PIN verification');
      return;
    }

    if (verificationMethod === 'biometric' && !biometricData) {
      Alert.alert('Error', 'Biometric data is required for biometric verification');
      return;
    }

    try {
      setLoading(true);
      const result = await k33pService.recordSignup(
        userAddress, 
        userId, 
        phoneNumber, 
        senderWalletAddress, 
        pin, 
        biometricData, 
        verificationMethod,
        verificationMethod === 'biometric' ? biometricType : undefined
      );
      
      if (result.data.verified) {
        Alert.alert('Success', 'Signup verified successfully!');
        navigation.navigate('StatusScreen', { userAddress });
      } else {
        Alert.alert('Info', result.message || 'Signup recorded, verification pending');
        navigation.navigate('PendingScreen', { userAddress });
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to process signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>K33P Identity Signup</Text>
      
      <View style={styles.depositSection}>
        <Text style={styles.label}>Deposit Address:</Text>
        <Text style={styles.depositAddress}>{loading ? 'Loading...' : depositAddress}</Text>
        <Text style={styles.instructions}>Send exactly 2 ADA to this address to complete signup</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="User ID (alphanumeric, 3-50 chars)"
        value={userId}
        onChangeText={setUserId}
      />
      
      <View style={styles.verificationSection}>
        <Text style={styles.label}>Verification Method:</Text>
        <View style={styles.verificationOptions}>
          <TouchableOpacity 
            style={[styles.verificationOption, verificationMethod === 'phone' && styles.selectedOption]}
            onPress={() => setVerificationMethod('phone')}
          >
            <Text>Phone</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.verificationOption, verificationMethod === 'pin' && styles.selectedOption]}
            onPress={() => setVerificationMethod('pin')}
          >
            <Text>PIN</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.verificationOption, verificationMethod === 'biometric' && styles.selectedOption]}
            onPress={() => setVerificationMethod('biometric')}
          >
            <Text>Biometric</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {verificationMethod === 'phone' && (
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
      )}
      
      {verificationMethod === 'pin' && (
        <TextInput
          style={styles.input}
          placeholder="4-digit PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          maxLength={4}
          secureTextEntry
        />
      )}
      
      {verificationMethod === 'biometric' && (
        <View style={styles.biometricSection}>
          <Text style={styles.label}>Biometric Type:</Text>
          <View style={styles.verificationOptions}>
            <TouchableOpacity 
              style={[styles.verificationOption, biometricType === 'fingerprint' && styles.selectedOption]}
              onPress={() => setBiometricType('fingerprint')}
            >
              <Text>Fingerprint</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.verificationOption, biometricType === 'faceid' && styles.selectedOption]}
              onPress={() => setBiometricType('faceid')}
            >
              <Text>Face ID</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.verificationOption, biometricType === 'voice' && styles.selectedOption]}
              onPress={() => setBiometricType('voice')}
            >
              <Text>Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.verificationOption, biometricType === 'iris' && styles.selectedOption]}
              onPress={() => setBiometricType('iris')}
            >
              <Text>Iris Scan</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.biometricText}>
            {biometricData ? `${biometricType} data captured` : `Tap to scan ${biometricType}`}
          </Text>
          <Button 
            title={biometricData ? `Rescan ${biometricType}` : `Scan ${biometricType}`} 
            onPress={handleBiometricScan} 
          />
        </View>
      )}
      
      <TextInput
        style={styles.input}
        placeholder="Your Wallet Address"
        value={userAddress}
        onChangeText={setUserAddress}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Sender Wallet Address"
        value={senderWalletAddress}
        onChangeText={setSenderWalletAddress}
      />
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Submit Signup" onPress={handleSignup} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  depositSection: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 5,
    marginBottom: 20,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  depositAddress: {
    fontFamily: 'monospace',
    padding: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 10,
  },
  instructions: {
    fontStyle: 'italic',
    color: '#555',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  verificationSection: {
    marginBottom: 15,
  },
  verificationOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  verificationOption: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    width: '30%',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#e0e0e0',
    borderColor: '#0000ff',
  },
  biometricSection: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 5,
    marginBottom: 15,
    alignItems: 'center',
  },
  biometricText: {
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default SignupScreen;
```

### Status Checking Screen

Here's an example of a status checking screen:

```javascript
// src/screens/StatusScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Button } from 'react-native';
import { k33pService } from '../services/k33pService';

const StatusScreen = ({ route, navigation }) => {
  const { userAddress } = route.params;
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkStatus();
    // Set up polling every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const response = await k33pService.checkUserStatus(userAddress);
      setStatus(response.data.status);
      setError(null);
      
      // If verified, stop polling
      if (response.data.status === 'verified') {
        clearInterval(interval);
      }
    } catch (error) {
      setError(error.message || 'Failed to check status');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    try {
      setLoading(true);
      await k33pService.retryVerification(userAddress);
      // Check status immediately after retry
      await checkStatus();
    } catch (error) {
      setError(error.message || 'Failed to retry verification');
      setLoading(false);
    }
  };

  const renderStatusContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#0000ff" />;
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try Again" onPress={checkStatus} />
        </View>
      );
    }

    switch (status) {
      case 'verified':
        return (
          <View style={[styles.statusContainer, styles.verifiedContainer]}>
            <Text style={styles.statusTitle}>Verification Complete!</Text>
            <Text style={styles.statusMessage}>Your identity has been verified successfully.</Text>
            <Button 
              title="Continue to App" 
              onPress={() => navigation.navigate('Dashboard')} 
            />
          </View>
        );
      case 'pending':
        return (
          <View style={[styles.statusContainer, styles.pendingContainer]}>
            <Text style={styles.statusTitle}>Verification Pending</Text>
            <Text style={styles.statusMessage}>Your transaction is being verified on the blockchain. This may take a few minutes.</Text>
            <ActivityIndicator style={styles.statusIndicator} />
          </View>
        );
      case 'failed':
        return (
          <View style={[styles.statusContainer, styles.failedContainer]}>
            <Text style={styles.statusTitle}>Verification Failed</Text>
            <Text style={styles.statusMessage}>We couldn't verify your transaction. Please check the transaction details and try again.</Text>
            <Button title="Retry Verification" onPress={handleRetry} />
          </View>
        );
      default:
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.statusTitle}>Unknown Status</Text>
            <Text style={styles.statusMessage}>Status: {status || 'Not available'}</Text>
            <Button title="Refresh Status" onPress={checkStatus} />
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verification Status</Text>
      <Text style={styles.address}>Address: {userAddress.substring(0, 10)}...{userAddress.substring(userAddress.length - 10)}</Text>
      {renderStatusContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  statusContainer: {
    padding: 20,
    borderRadius: 10,
    marginVertical: 20,
    alignItems: 'center',
  },
  verifiedContainer: {
    backgroundColor: '#e6f7e6',
    borderColor: '#28a745',
    borderWidth: 1,
  },
  pendingContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
  },
  failedContainer: {
    backgroundColor: '#f8d7da',
    borderColor: '#dc3545',
    borderWidth: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  statusMessage: {
    textAlign: 'center',
    marginBottom: 20,
  },
  statusIndicator: {
    marginVertical: 10,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#f8d7da',
    borderRadius: 10,
    alignItems: 'center',
  },
  errorText: {
    color: '#721c24',
    marginBottom: 10,
  },
});

export default StatusScreen;
```

## Mobile-Specific Considerations

### 1. Network Configuration

When testing on a physical device, use your computer's local IP address instead of `localhost`:

```javascript
// For development on physical device
const API_URL = 'http://192.168.1.100:3000/api'; // Replace with your computer's IP
```

### 2. Deep Linking

Implement deep linking for wallet integration:

```javascript
// Example of opening a Cardano wallet app with a specific address
import { Linking } from 'react-native';

const openWallet = (address) => {
  // This is a hypothetical deep link - actual format depends on the wallet app
  Linking.openURL(`cardano-wallet://send?address=${address}&amount=2000000`);
};
```

### 3. QR Code Generation

For easier address sharing, implement QR code generation:

```javascript
// Install: npm install react-native-qrcode-svg
import QRCode from 'react-native-qrcode-svg';

// In your component:
<QRCode
  value={depositAddress}
  size={200}
  backgroundColor="white"
  color="black"
/>
```

### 4. Background Status Checking

Implement background status checking using React Native's `AppState` API:

```javascript
import { AppState } from 'react-native';

// In your component:
useEffect(() => {
  const subscription = AppState.addEventListener('change', nextAppState => {
    if (nextAppState === 'active') {
      // App has come to the foreground
      checkUserStatus(userAddress);
    }
  });
  
  return () => {
    subscription.remove();
  };
}, [userAddress]);
```

### 5. Secure Storage

Use secure storage for sensitive information:

```javascript
// Install: npm install @react-native-async-storage/async-storage
import AsyncStorage from '@react-native-async-storage/async-storage';

// For more sensitive data, use a secure storage solution:
// npm install react-native-keychain
import * as Keychain from 'react-native-keychain';

// Store user data securely
const storeUserData = async (userData) => {
  try {
    // For non-sensitive data
    await AsyncStorage.setItem('userId', userData.userId);
    
    // For sensitive data
    await Keychain.setGenericPassword(
      userData.userAddress, // username
      JSON.stringify(userData), // password (storing the whole object)
      { service: 'k33p.identity' }
    );
  } catch (error) {
    console.error('Error storing user data:', error);
  }
};
```

## Error Handling

All API responses follow a standard format:

```json
{
  "success": true|false,
  "data": { ... },  // Only present on success
  "message": "...", // Success message
  "error": "...",   // Error message (only on failure)
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

## Testing

### Test Wallet

For testing purposes, you can use the test wallet address provided in the `.env` file:

```
TEST_WALLET_ADDRESS=addr_test1vqymx67q572k8z5ln0850m35a6amuw25wg09slrwuv9g0vq7zup5x
```

### Transaction Verification

Note that transaction verification on the Cardano blockchain may take a few minutes. The backend requires at least 1 confirmation before considering a transaction verified.

## Smart Contract Integration

The K33P system uses a Plutus smart contract for identity management. The contract address is:

```
addr_test1wznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735734
```

Frontend developers don't need to interact directly with the smart contract, as the backend handles all blockchain interactions.

## Security Considerations

1. **Never** store private keys or sensitive user information in frontend code
2. Always validate user input before sending to the backend
3. Implement proper error handling for all API calls
4. Use HTTPS in production environments
5. Consider implementing rate limiting on the frontend to prevent API abuse
6. Implement certificate pinning to prevent MITM attacks
7. Use secure storage for any sensitive information that needs to be stored on the device

## Support

If you encounter any issues or have questions about integrating with the K33P backend, please contact the backend development team.