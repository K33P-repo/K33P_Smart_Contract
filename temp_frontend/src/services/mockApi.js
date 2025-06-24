// Mock API service for development testing

// Mock user data
const mockUsers = [
  {
    id: '1',
    walletAddress: 'addr_test1qp0knz8wuhrh7zadvs3mp5m6eju2szfzgqlnpsckw3cdqwpxdrcj5h97rv7gvjytfcdca5uyqh3kzk3uh8qj0xj3a9mqm2qnkr',
    phoneHash: 'phone_hash_1',
    biometricHash: 'biometric_hash_1',
    passkeyHash: 'passkey_hash_1',
    zkCommitment: 'zk_commitment_1',
    txHash: 'tx_hash_1'
  }
];

// Mock session data
const mockSessions = [
  {
    id: '1',
    userId: '1',
    token: 'mock_token_1',
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  }
];

// Mock UTXO data
const mockUtxos = [
  {
    id: '1',
    txHash: '5d677265fa5bb21ce6d8e7e70c3b78de535d48b2b7f198f26cc5663e2c0a73e7',
    outputIndex: 0,
    amount: '10000000',
    datum: '{"phoneHash":"phone_hash_1","biometricHash":"biometric_hash_1","passkeyHash":"passkey_hash_1"}',
    userId: '1',
    refunded: false
  },
  {
    id: '2',
    txHash: '7f9a6a49e9a6a49e9a6a49e9a6a49e9a6a49e9a6a49e9a6a49e9a6a49e9a6a49',
    outputIndex: 1,
    amount: '5000000',
    datum: '{"phoneHash":"phone_hash_1","biometricHash":"biometric_hash_1","passkeyHash":"passkey_hash_1"}',
    userId: '1',
    refunded: false
  }
];

// Delay helper to simulate network latency
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API service
const mockApiService = {
  // Auth endpoints
  signup: async (userData) => {
    await delay(1000); // Simulate network delay
    
    // Check if user already exists
    const existingUser = mockUsers.find(u => 
      u.walletAddress === userData.walletAddress || 
      u.phoneHash === userData.phone
    );
    
    if (existingUser) {
      throw new Error(JSON.stringify({
        response: {
          data: { error: 'User already exists' },
          status: 400
        }
      }));
    }
    
    // Create new user
    const newUser = {
      id: String(mockUsers.length + 1),
      walletAddress: userData.walletAddress,
      phoneHash: userData.phone,
      biometricHash: userData.biometric,
      passkeyHash: userData.passkey,
      zkCommitment: 'mock_zk_commitment',
      txHash: 'mock_tx_hash_' + Date.now()
    };
    
    mockUsers.push(newUser);
    
    // Create token
    const token = 'mock_token_' + Date.now();
    
    // Create session
    mockSessions.push({
      id: String(mockSessions.length + 1),
      userId: newUser.id,
      token,
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });
    
    return {
      data: {
        message: 'User registered successfully',
        txHash: newUser.txHash,
        token
      }
    };
  },
  
  signin: async (credentials) => {
    await delay(800); // Simulate network delay
    
    // Find user by wallet address or phone
    const user = mockUsers.find(u => 
      (credentials.walletAddress && u.walletAddress === credentials.walletAddress) || 
      (credentials.phone && u.phoneHash === credentials.phone)
    );
    
    if (!user || user.passkeyHash !== credentials.passkey) {
      throw new Error(JSON.stringify({
        response: {
          data: { error: 'Invalid credentials' },
          status: 401
        }
      }));
    }
    
    // Create token
    const token = 'mock_token_' + Date.now();
    
    // Create session
    mockSessions.push({
      id: String(mockSessions.length + 1),
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });
    
    return {
      data: {
        message: 'Login successful',
        walletAddress: user.walletAddress,
        phone: user.phoneHash,
        token
      }
    };
  },
  
  verifyToken: async () => {
    await delay(500); // Simulate network delay
    return { data: { valid: true } };
  },
  
  // UTXO endpoints
  fetchUtxos: async (phoneHash) => {
    await delay(800); // Simulate network delay
    
    const userUtxos = mockUtxos.filter(u => {
      const datum = JSON.parse(u.datum);
      return datum.phoneHash === phoneHash;
    });
    
    return { data: userUtxos };
  },
  
  refund: async (refundData) => {
    await delay(1500); // Simulate network delay
    
    // eslint-disable-next-line no-unused-vars
    const { utxo, ownerAddress } = refundData;
    
    // Find the UTXO
    const utxoIndex = mockUtxos.findIndex(u => 
      u.txHash === utxo.txHash && 
      u.outputIndex === utxo.outputIndex
    );
    
    if (utxoIndex === -1) {
      throw new Error(JSON.stringify({
        response: {
          data: { error: 'UTXO not found' },
          status: 404
        }
      }));
    }
    
    // Check if already refunded
    if (mockUtxos[utxoIndex].refunded) {
      throw new Error(JSON.stringify({
        response: {
          data: { error: 'UTXO already refunded' },
          status: 400
        }
      }));
    }
    
    // Mark as refunded
    mockUtxos[utxoIndex].refunded = true;
    mockUtxos[utxoIndex].refundTxHash = 'mock_refund_tx_' + Date.now();
    
    return {
      data: {
        message: 'Refund issued successfully',
        txHash: mockUtxos[utxoIndex].refundTxHash
      }
    };
  },
  
  getUserUtxos: async () => {
    await delay(700); // Simulate network delay
    return { data: mockUtxos.filter(u => !u.refunded) };
  },
  
  // Health check
  healthCheck: async () => {
    await delay(300); // Simulate network delay
    return { data: { status: 'ok' } };
  }
};

export default mockApiService;