// Iagon API wrapper for user, session, and UTxO management
import axios from 'axios';
import { URL } from 'url';
const IAGON_API_URL = process.env.IAGON_API_URL;
const IAGON_API_KEY = process.env.IAGON_API_KEY;
// Validate API URL and key
if (!IAGON_API_URL) {
    console.warn('IAGON_API_URL is not set. Using mock implementation.');
}
if (!IAGON_API_KEY) {
    console.warn('IAGON_API_KEY is not set. Using mock implementation.');
}
// Create a mock database for development/testing when API is not available
import fs from 'fs';
import path from 'path';
let mockDb = {
    users: [],
    sessions: [],
    scriptUtxos: []
};
// Try to load mock database from file
try {
    const mockDbPath = 'c:\\Users\\USER\\Desktop\\K33P_Smart_Contract\\backend\\src\\utils\\mock-db.json';
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
// Helper to validate URL
function isValidUrl(urlString) {
    try {
        new URL(urlString);
        return true;
    }
    catch (err) {
        return false;
    }
}
// Create API client with proper validation
const createApiClient = () => {
    if (!IAGON_API_URL || !IAGON_API_KEY || !isValidUrl(IAGON_API_URL)) {
        return null; // Will use mock implementation
    }
    return axios.create({
        baseURL: IAGON_API_URL,
        headers: { 'Authorization': `Bearer ${IAGON_API_KEY}` },
        timeout: 10000 // 10 second timeout
    });
};
const api = createApiClient();
// User management
async function findUser(query) {
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
async function createUser(data) {
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
            return newUser;
        }
    }
    catch (error) {
        console.error('Error creating user:', error.message);
        throw error; // Rethrow as this is a critical operation
    }
}
async function findUserById(id) {
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
async function createSession(data) {
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
            return newSession;
        }
    }
    catch (error) {
        console.error('Error creating session:', error.message);
        throw error; // Rethrow as this is a critical operation
    }
}
async function deleteSessions(query) {
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
            return true;
        }
    }
    catch (error) {
        console.error('Error deleting sessions:', error.message);
        return false;
    }
}
// Script UTxO management
async function findScriptUtxo(query) {
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
async function createScriptUtxo(data) {
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
            return newUtxo;
        }
    }
    catch (error) {
        console.error('Error creating script UTxO:', error.message);
        throw error; // Rethrow as this is a critical operation
    }
}
async function updateScriptUtxo(id, data) {
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
            return mockDb.scriptUtxos[index];
        }
    }
    catch (error) {
        console.error('Error updating script UTxO:', error.message);
        throw error; // Rethrow as this is a critical operation
    }
}
async function findScriptUtxos(query) {
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
export { findUser, createUser, findUserById, createSession, deleteSessions, findScriptUtxo, createScriptUtxo, updateScriptUtxo, findScriptUtxos };
//# sourceMappingURL=iagon.js.map