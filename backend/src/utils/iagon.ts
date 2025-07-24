// Iagon API wrapper for user, session, and UTxO management
import axios from 'axios';
import { URL } from 'url';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';

// Ensure environment variables are loaded
dotenv.config();

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Load environment variables from .env file
dotenv.config({ path: path.join(rootDir, '.env') });

const IAGON_API_URL = process.env.IAGON_API_URL;
const IAGON_PERSONAL_ACCESS_TOKEN = process.env.IAGON_PERSONAL_ACCESS_TOKEN;

// Debug environment variables
console.log('Environment variables:');
console.log('IAGON_API_URL:', process.env.IAGON_API_URL);
console.log('IAGON_PERSONAL_ACCESS_TOKEN:', process.env.IAGON_PERSONAL_ACCESS_TOKEN ? '[REDACTED]' : undefined);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Validate API URL and token
if (!IAGON_API_URL) {
  console.warn('IAGON_API_URL is not set. Using mock implementation.');
}

if (!IAGON_PERSONAL_ACCESS_TOKEN) {
  console.warn('IAGON_PERSONAL_ACCESS_TOKEN is not set. Using mock implementation.');
  console.warn('Please generate a Personal Access Token from https://app.iagon.com/ settings page.');
}

// Create a mock database for development/testing when API is not available
import fs from 'fs';
import crypto from 'crypto';

let mockDb: {
  users: any[];
  sessions: any[];
  scriptUtxos: any[];
} = {
  users: [],
  sessions: [],
  scriptUtxos: []
};

// Only load mock database in development environment
if (process.env.NODE_ENV !== 'production') {
  try {
    const mockDbPath = path.join(__dirname, 'mock-db.json');
    if (fs.existsSync(mockDbPath)) {
      console.log('Loading mock database from', mockDbPath);
      mockDb = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
      console.log(`Loaded ${mockDb.users.length} users from mock database`);
    } else {
      console.log('Mock database file not found, using empty database');
    }
  } catch (error: any) {
    console.error('Error loading mock database:', error.message);
  }
} else {
  console.log('Running in production mode - not loading mock database');
}

// Helper to validate URL with improved error handling
function isValidUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') {
    console.warn('Invalid URL: URL is empty or not a string');
    return false;
  }
  
  // Trim whitespace that might cause validation issues
  const trimmedUrl = urlString.trim();
  
  try {
    const url = new URL(trimmedUrl);
    // Additional validation: must have http or https protocol
    if (!url.protocol || !['http:', 'https:'].includes(url.protocol)) {
      console.warn(`Invalid URL protocol: ${url.protocol}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`URL validation error: ${err.message}`);
    return false;
  }
}

// Create API client with proper validation
const createApiClient = () => {
  console.log('Creating API client with:', {
    url: IAGON_API_URL,
    hasToken: !!IAGON_PERSONAL_ACCESS_TOKEN,
    isValidUrl: IAGON_API_URL ? isValidUrl(IAGON_API_URL) : false
  });
  
  if (!IAGON_API_URL || !IAGON_PERSONAL_ACCESS_TOKEN || !isValidUrl(IAGON_API_URL)) {
    console.warn('Using mock implementation because:', {
      missingUrl: !IAGON_API_URL,
      missingToken: !IAGON_PERSONAL_ACCESS_TOKEN,
      invalidUrl: IAGON_API_URL ? !isValidUrl(IAGON_API_URL) : false
    });
    return null; // Will use mock implementation
  }
  
  console.log('Successfully created API client for production use');
  return axios.create({
    baseURL: IAGON_API_URL,
    headers: { 
      'Authorization': `Bearer ${IAGON_PERSONAL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000 // 10 second timeout
  });
};

const api = createApiClient();

// User management
export async function findUser(query: any) {
  try {
    // Validate query
    if (!query || (typeof query !== 'object') || Object.keys(query).length === 0) {
      throw new Error('Invalid query parameters');
    }
    
    // Use API if available, otherwise use mock
    // Note: Iagon API v2 doesn't have a direct /users endpoint
    if (api) {
      console.warn('Iagon API available but using mock implementation for user search');
      console.warn('Iagon API v2 focuses on storage services, not user management');
    }
    
    // Mock implementation (used in all cases for now)
    {
      // Mock implementation
      const key = Object.keys(query)[0];
      const value = query[key];
      return mockDb.users.find(user => user[key] === value) || null;
    }
  } catch (error: any) {
    console.error('Error finding user:', error.message);
    // Return null instead of throwing to prevent API failures from breaking the app
    return null;
  }
}

export async function createUser(data: any) {
  try {
    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid user data');
    }
    
    const requiredFields = ['walletAddress', 'phoneHash'];
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Use API if available, otherwise use mock
    // Note: Iagon API v2 doesn't have a direct /users endpoint
    // This implementation uses mock data until proper storage endpoints are identified
    if (api) {
      // For now, we'll use mock implementation even with API available
      // TODO: Implement proper Iagon storage service integration
      console.warn('Iagon API available but using mock implementation for user creation');
      console.warn('Iagon API v2 focuses on storage services, not user management');
    }
    
    // Mock implementation (used in all cases for now)
    {
      // Mock implementation
      const newUser = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString()
      };
      mockDb.users.push(newUser);
      
      // Save updated mock database to file
      saveMockDatabase();
      
      return newUser;
    }
  } catch (error: any) {
    console.error('Error creating user:', error.message);
    throw error; // Rethrow as this is a critical operation
  }
}

export async function findUserById(id: string) {
  try {
    // Validate ID
    if (!id) {
      throw new Error('Invalid user ID');
    }
    
    // Use API if available, otherwise use mock
    // Note: Iagon API v2 doesn't have a direct /users endpoint
    if (api) {
      console.warn('Iagon API available but using mock implementation for user lookup');
      console.warn('Iagon API v2 focuses on storage services, not user management');
    }
    
    // Mock implementation (used in all cases for now)
    {
      // Mock implementation
      return mockDb.users.find(user => user.id === id) || null;
    }
  } catch (error: any) {
    console.error('Error finding user by ID:', error.message);
    return null;
  }
}

// Session management
export async function createSession(data: any) {
  try {
    // Validate data
    if (!data || !data.userId || !data.token) {
      throw new Error('Invalid session data');
    }
    
    // Sessions are application-specific, not Iagon storage - always use mock
    // Mock implementation
    const newSession = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString()
    };
    mockDb.sessions.push(newSession);
    
    // Save updated mock database to file
    saveMockDatabase();
    
    return newSession;
  } catch (error: any) {
    console.error('Error creating session:', error.message);
    throw error; // Rethrow as this is a critical operation
  }
}

export async function deleteSessions(query: any) {
  try {
    // Validate query
    if (!query || typeof query !== 'object') {
      throw new Error('Invalid query parameters');
    }
    
    // Sessions are application-specific, not Iagon storage - always use mock
    // Mock implementation
    const key = Object.keys(query)[0];
    const value = query[key];
    mockDb.sessions = mockDb.sessions.filter(session => session[key] !== value);
    
    // Save updated mock database to file
    saveMockDatabase();
    
    return true;
  } catch (error: any) {
    console.error('Error deleting sessions:', error.message);
    return false;
  }
}

// Script UTxO management
export async function findScriptUtxo(query: any) {
  try {
    // Validate query
    if (!query || typeof query !== 'object') {
      throw new Error('Invalid query parameters');
    }
    
    // Use API if available, otherwise use mock
    if (api) {
      const res = await api.get('/script-utxos', { params: query });
      return res.data[0] || null;
    } else {
      // Mock implementation
      const key = Object.keys(query)[0];
      const value = query[key];
      return mockDb.scriptUtxos.find(utxo => utxo[key] === value) || null;
    }
  } catch (error: any) {
    console.error('Error finding script UTxO:', error.message);
    return null;
  }
}

export async function createScriptUtxo(data: any) {
  try {
    // Validate data
    if (!data || !data.txHash || !data.outputIndex) {
      throw new Error('Invalid UTxO data');
    }
    
    // Script UTxOs are application-specific, not Iagon storage - always use mock
    // Mock implementation
    const newUtxo = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString()
    };
    mockDb.scriptUtxos.push(newUtxo);
    
    // Save updated mock database to file
    saveMockDatabase();
    
    return newUtxo;
  } catch (error: any) {
    console.error('Error creating script UTxO:', error.message);
    throw error; // Rethrow as this is a critical operation
  }
}

export async function updateScriptUtxo(id: string, data: any) {
  try {
    // Validate ID and data
    if (!id || !data) {
      throw new Error('Invalid UTxO ID or data');
    }
    
    // Script UTxOs are application-specific, not Iagon storage - always use mock
    // Mock implementation
    const index = mockDb.scriptUtxos.findIndex(utxo => utxo.id === id);
    if (index === -1) {
      throw new Error('UTxO not found');
    }
    mockDb.scriptUtxos[index] = { ...mockDb.scriptUtxos[index], ...data };
    
    // Save updated mock database to file
    saveMockDatabase();
    
    return mockDb.scriptUtxos[index];
  } catch (error: any) {
    console.error('Error updating script UTxO:', error.message);
    throw error; // Rethrow as this is a critical operation
  }
}

export async function findScriptUtxos(query: any) {
  try {
    // Validate query
    if (!query || typeof query !== 'object') {
      throw new Error('Invalid query parameters');
    }
    
    // Script UTxOs are application-specific, not Iagon storage - always use mock
    // Mock implementation
    if (Object.keys(query).length === 0) {
      return mockDb.scriptUtxos;
    }
    
    const key = Object.keys(query)[0];
    const value = query[key];
    return mockDb.scriptUtxos.filter(utxo => utxo[key] === value);
  } catch (error: any) {
    console.error('Error finding script UTxOs:', error.message);
    return [];
  }
}

// Data storage functions
export async function storeData(key: string, data: string) {
  try {
    // Validate parameters
    if (!key || !data) {
      throw new Error('Invalid key or data');
    }
    
    // Use API if available, otherwise use mock
    if (api) {
      // Create form data for file upload
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Create a buffer from the data string
      const buffer = Buffer.from(data, 'utf8');
      formData.append('file', buffer, {
        filename: `${key}.json`,
        contentType: 'application/json'
      });
      formData.append('filename', `${key}.json`);
      formData.append('visibility', 'private');
      
      const res = await api.post('/storage/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.IAGON_PERSONAL_ACCESS_TOKEN}`
        }
      });
      return res.data.data?.file_id || res.data.id;
    } else {
      // Mock implementation - return a mock storage ID
      const storageId = crypto.randomUUID();
      console.log(`Mock: Stored data with key ${key}, assigned ID: ${storageId}`);
      return storageId;
    }
  } catch (error: any) {
    console.error('Error storing data:', error.message);
    throw error;
  }
}

export async function retrieveData(storageId: string) {
  try {
    // Validate storage ID
    if (!storageId) {
      throw new Error('Invalid storage ID');
    }
    
    // Use API if available, otherwise use mock
    if (api) {
      const res = await api.get(`/storage/download/${storageId}`, {
        responseType: 'text'
      });
      return res.data;
    } else {
      // Mock implementation - return mock data
      console.log(`Mock: Retrieved data for ID: ${storageId}`);
      return JSON.stringify({ mockData: true, id: storageId });
    }
  } catch (error: any) {
    console.error('Error retrieving data:', error.message);
    throw error;
  }
}

export async function updateData(storageId: string, data: string) {
  try {
    // Validate parameters
    if (!storageId || !data) {
      throw new Error('Invalid storage ID or data');
    }
    
    // Use API if available, otherwise use mock
    if (api) {
      // For updates, we need to delete the old file and upload a new one
      // First delete the existing file
      await api.delete(`/storage/delete/${storageId}`);
      
      // Then upload the new data
      const FormData = require('form-data');
      const formData = new FormData();
      
      const buffer = Buffer.from(data, 'utf8');
      formData.append('file', buffer, {
        filename: `updated_${storageId}.json`,
        contentType: 'application/json'
      });
      formData.append('filename', `updated_${storageId}.json`);
      formData.append('visibility', 'private');
      
      const res = await api.post('/storage/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.IAGON_PERSONAL_ACCESS_TOKEN}`
        }
      });
      return res.data;
    } else {
      // Mock implementation
      console.log(`Mock: Updated data for ID: ${storageId}`);
      return { id: storageId, updated: true };
    }
  } catch (error: any) {
    console.error('Error updating data:', error.message);
    throw error;
  }
}

export async function deleteData(storageId: string) {
  try {
    // Validate storage ID
    if (!storageId) {
      throw new Error('Invalid storage ID');
    }
    
    // Use API if available, otherwise use mock
    if (api) {
      await api.delete(`/storage/delete/${storageId}`);
      return true;
    } else {
      // Mock implementation
      console.log(`Mock: Deleted data for ID: ${storageId}`);
      return true;
    }
  } catch (error: any) {
    console.error('Error deleting data:', error.message);
    return false;
  }
}

// Helper function to save mock database to file (only in development)
function saveMockDatabase() {
  // Only save in development mode
  if (process.env.NODE_ENV === 'production') {
    console.log('Running in production mode - not saving mock database');
    return;
  }
  
  try {
    const mockDbPath = path.join(__dirname, 'mock-db.json');
    fs.writeFileSync(mockDbPath, JSON.stringify(mockDb, null, 2), 'utf8');
    console.log(`Saved mock database with ${mockDb.users.length} users`);
  } catch (error: any) {
    console.error('Error saving mock database:', error.message);
  }
}