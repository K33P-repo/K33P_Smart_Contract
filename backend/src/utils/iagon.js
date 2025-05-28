// Iagon API wrapper for user, session, and UTxO management
const axios = require('axios');

const IAGON_API_URL = process.env.IAGON_API_URL;
const IAGON_API_KEY = process.env.IAGON_API_KEY;

const api = axios.create({
  baseURL: IAGON_API_URL,
  headers: { 'Authorization': `Bearer ${IAGON_API_KEY}` }
});

// User management
async function findUser(query) {
  // Example: query = { walletAddress } or { phoneHash }
  const res = await api.get('/users', { params: query });
  return res.data[0] || null;
}

async function createUser(data) {
  const res = await api.post('/users', data);
  return res.data;
}

async function findUserById(id) {
  const res = await api.get(`/users/${id}`);
  return res.data;
}

// Session management
async function createSession(data) {
  const res = await api.post('/sessions', data);
  return res.data;
}

async function deleteSessions(query) {
  await api.delete('/sessions', { params: query });
}

// Script UTxO management
async function findScriptUtxo(query) {
  const res = await api.get('/script-utxos', { params: query });
  return res.data[0] || null;
}

async function createScriptUtxo(data) {
  const res = await api.post('/script-utxos', data);
  return res.data;
}

async function updateScriptUtxo(id, data) {
  const res = await api.patch(`/script-utxos/${id}`, data);
  return res.data;
}

async function findScriptUtxos(query) {
  const res = await api.get('/script-utxos', { params: query });
  return res.data;
}

module.exports = {
  findUser,
  createUser,
  findUserById,
  createSession,
  deleteSessions,
  findScriptUtxo,
  createScriptUtxo,
  updateScriptUtxo,
  findScriptUtxos
};