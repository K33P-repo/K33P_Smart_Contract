import axios from 'axios';
import mockApiService from './mockApi';

// Define API URLs based on environment
const API_URL = process.env.NODE_ENV === 'production'
  ? process.env.REACT_APP_API_URL_PROD || 'https://k33p-backend.onrender.com/api'
  : process.env.REACT_APP_API_URL_DEV || 'http://localhost:3001/api';

// Enable mock mode for development if specified
const ENABLE_MOCK_MODE = process.env.REACT_APP_ENABLE_MOCK_MODE === 'true';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Real API service methods
const realApiService = {
  // Auth endpoints
  signup: async (userData) => {
    return apiClient.post('/auth/signup', userData);
  },
  signin: async (credentials) => {
    return apiClient.post('/zk/login', credentials);
  },
  verifyToken: async () => {
    return apiClient.get('/auth/me');
  },
  
  // UTXO endpoints
  fetchUtxos: async (phoneHash) => {
    return apiClient.get(`/utxo/fetch/${phoneHash}`);
  },
  refund: async (refundData) => {
    return apiClient.post('/utxo/refund', refundData);
  },
  getUserUtxos: async () => {
    return apiClient.get('/utxo/user');
  },
  
  // Health check
  healthCheck: async () => {
    return apiClient.get('/health');
  }
};

// Determine which API service to use based on environment and configuration
const apiService = process.env.NODE_ENV !== 'production' && ENABLE_MOCK_MODE
  ? mockApiService
  : realApiService;

// Log which API service is being used
console.log(`Using ${process.env.NODE_ENV !== 'production' && ENABLE_MOCK_MODE ? 'MOCK' : 'REAL'} API service`);


export default apiService;