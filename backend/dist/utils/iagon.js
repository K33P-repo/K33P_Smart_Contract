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
const IAGON_API_KEY = process.env.IAGON_API_KEY;
// Debug environment variables
console.log('Environment variables:');
console.log('IAGON_API_URL:', process.env.IAGON_API_URL);
console.log('IAGON_API_KEY:', process.env.IAGON_API_KEY ? '[REDACTED]' : undefined);
console.log('NODE_ENV:', process.env.NODE_ENV);
// Validate API URL and key
if (!IAGON_API_URL) {
    console.warn('IAGON_API_URL is not set. Using mock implementation.');
}
if (!IAGON_API_KEY) {
    console.warn('IAGON_API_KEY is not set. Using mock implementation.');
}
// Create a mock database for development/testing when API is not available
import fs from 'fs';
import crypto from 'crypto';
let mockDb = {
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
        }
        else {
            console.log('Mock database file not found, using empty database');
        }
    }
    catch (error) {
        console.error('Error loading mock database:', error.message);
    }
}
else {
    console.log('Running in production mode - not loading mock database');
}
// Helper to validate URL with improved error handling
function isValidUrl(urlString) {
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
    }
    catch (err) {
        console.warn(`URL validation error: ${err.message}`);
        return false;
    }
}
// Create API client with proper validation
const createApiClient = () => {
    console.log('Creating API client with:', {
        url: IAGON_API_URL,
        hasKey: !!IAGON_API_KEY,
        isValidUrl: IAGON_API_URL ? isValidUrl(IAGON_API_URL) : false
    });
    if (!IAGON_API_URL || !IAGON_API_KEY || !isValidUrl(IAGON_API_URL)) {
        console.warn('Using mock implementation because:', {
            missingUrl: !IAGON_API_URL,
            missingKey: !IAGON_API_KEY,
            invalidUrl: IAGON_API_URL ? !isValidUrl(IAGON_API_URL) : false
        });
        return null; // Will use mock implementation
    }
    console.log('Successfully created API client for production use');
    return axios.create({
        baseURL: IAGON_API_URL,
        headers: { 'Authorization': `Bearer ${IAGON_API_KEY}` },
        timeout: 10000 // 10 second timeout
    });
};
const api = createApiClient();
// User management
export async function findUser(query) {
    try {
        // Validate query
        if (!query || (typeof query !== 'object') || Object.keys(query).length === 0) {
            throw new Error('Invalid query parameters');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.get('/users', { params: query });
            return res.data[0] || null;
        }
        else {
            // Mock implementation
            const key = Object.keys(query)[0];
            const value = query[key];
            return mockDb.users.find(user => user[key] === value) || null;
        }
    }
    catch (error) {
        console.error('Error finding user:', error.message);
        // Return null instead of throwing to prevent API failures from breaking the app
        return null;
    }
}
export async function createUser(data) {
    try {
        // Validate data
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid user data');
        }
        const requiredFields = ['phoneHash'];
        for (const field of requiredFields) {
            if (!data[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // walletAddress is optional and can be null
        if (data.walletAddress === undefined) {
            data.walletAddress = null;
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.post('/users', data);
            return res.data;
        }
        else {
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
    }
    catch (error) {
        console.error('Error creating user:', error.message);
        throw error; // Rethrow as this is a critical operation
    }
}
export async function findUserById(id) {
    try {
        // Validate ID
        if (!id) {
            throw new Error('Invalid user ID');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.get(`/users/${id}`);
            return res.data;
        }
        else {
            // Mock implementation
            return mockDb.users.find(user => user.id === id) || null;
        }
    }
    catch (error) {
        console.error('Error finding user by ID:', error.message);
        return null;
    }
}
// Session management
export async function createSession(data) {
    try {
        // Validate data
        if (!data || !data.userId || !data.token) {
            throw new Error('Invalid session data');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.post('/sessions', data);
            return res.data;
        }
        else {
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
        }
    }
    catch (error) {
        console.error('Error creating session:', error.message);
        throw error; // Rethrow as this is a critical operation
    }
}
export async function deleteSessions(query) {
    try {
        // Validate query
        if (!query || typeof query !== 'object') {
            throw new Error('Invalid query parameters');
        }
        // Use API if available, otherwise use mock
        if (api) {
            await api.delete('/sessions', { params: query });
            return true;
        }
        else {
            // Mock implementation
            const key = Object.keys(query)[0];
            const value = query[key];
            mockDb.sessions = mockDb.sessions.filter(session => session[key] !== value);
            // Save updated mock database to file
            saveMockDatabase();
            return true;
        }
    }
    catch (error) {
        console.error('Error deleting sessions:', error.message);
        return false;
    }
}
// Script UTxO management
export async function findScriptUtxo(query) {
    try {
        // Validate query
        if (!query || typeof query !== 'object') {
            throw new Error('Invalid query parameters');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.get('/script-utxos', { params: query });
            return res.data[0] || null;
        }
        else {
            // Mock implementation
            const key = Object.keys(query)[0];
            const value = query[key];
            return mockDb.scriptUtxos.find(utxo => utxo[key] === value) || null;
        }
    }
    catch (error) {
        console.error('Error finding script UTxO:', error.message);
        return null;
    }
}
export async function createScriptUtxo(data) {
    try {
        // Validate data
        if (!data || !data.txHash || !data.outputIndex) {
            throw new Error('Invalid UTxO data');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.post('/script-utxos', data);
            return res.data;
        }
        else {
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
        }
    }
    catch (error) {
        console.error('Error creating script UTxO:', error.message);
        throw error; // Rethrow as this is a critical operation
    }
}
export async function updateScriptUtxo(id, data) {
    try {
        // Validate ID and data
        if (!id || !data) {
            throw new Error('Invalid UTxO ID or data');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.patch(`/script-utxos/${id}`, data);
            return res.data;
        }
        else {
            // Mock implementation
            const index = mockDb.scriptUtxos.findIndex(utxo => utxo.id === id);
            if (index === -1) {
                throw new Error('UTxO not found');
            }
            mockDb.scriptUtxos[index] = { ...mockDb.scriptUtxos[index], ...data };
            // Save updated mock database to file
            saveMockDatabase();
            return mockDb.scriptUtxos[index];
        }
    }
    catch (error) {
        console.error('Error updating script UTxO:', error.message);
        throw error; // Rethrow as this is a critical operation
    }
}
export async function findScriptUtxos(query) {
    try {
        // Validate query
        if (!query || typeof query !== 'object') {
            throw new Error('Invalid query parameters');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.get('/script-utxos', { params: query });
            return res.data;
        }
        else {
            // Mock implementation
            if (Object.keys(query).length === 0) {
                return mockDb.scriptUtxos;
            }
            const key = Object.keys(query)[0];
            const value = query[key];
            return mockDb.scriptUtxos.filter(utxo => utxo[key] === value);
        }
    }
    catch (error) {
        console.error('Error finding script UTxOs:', error.message);
        return [];
    }
}
// Data storage functions
export async function storeData(key, data) {
    try {
        // Validate parameters
        if (!key || !data) {
            throw new Error('Invalid key or data');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.post('/storage', { key, data });
            return res.data.id;
        }
        else {
            // Mock implementation - return a mock storage ID
            const storageId = crypto.randomUUID();
            console.log(`Mock: Stored data with key ${key}, assigned ID: ${storageId}`);
            return storageId;
        }
    }
    catch (error) {
        console.error('Error storing data:', error.message);
        throw error;
    }
}
export async function retrieveData(storageId) {
    try {
        // Validate storage ID
        if (!storageId) {
            throw new Error('Invalid storage ID');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.get(`/storage/${storageId}`);
            return res.data.data;
        }
        else {
            // Mock implementation - return mock data
            console.log(`Mock: Retrieved data for ID: ${storageId}`);
            return JSON.stringify({ mockData: true, id: storageId });
        }
    }
    catch (error) {
        console.error('Error retrieving data:', error.message);
        throw error;
    }
}
export async function updateData(storageId, data) {
    try {
        // Validate parameters
        if (!storageId || !data) {
            throw new Error('Invalid storage ID or data');
        }
        // Use API if available, otherwise use mock
        if (api) {
            const res = await api.put(`/storage/${storageId}`, { data });
            return res.data;
        }
        else {
            // Mock implementation
            console.log(`Mock: Updated data for ID: ${storageId}`);
            return { id: storageId, updated: true };
        }
    }
    catch (error) {
        console.error('Error updating data:', error.message);
        throw error;
    }
}
export async function deleteData(storageId) {
    try {
        // Validate storage ID
        if (!storageId) {
            throw new Error('Invalid storage ID');
        }
        // Use API if available, otherwise use mock
        if (api) {
            await api.delete(`/storage/${storageId}`);
            return true;
        }
        else {
            // Mock implementation
            console.log(`Mock: Deleted data for ID: ${storageId}`);
            return true;
        }
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('Error saving mock database:', error.message);
    }
}
//# sourceMappingURL=iagon.js.map