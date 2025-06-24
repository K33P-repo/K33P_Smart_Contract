# Backend Integration Guide

## Overview

This document explains how the frontend application connects to the backend API. The frontend can operate in two modes:

1. **Mock Mode**: Uses simulated API responses for development and testing
2. **Real API Mode**: Connects to the actual backend API endpoints

**Note**: The frontend has been updated to use the real backend API.

## Configuration

The API mode is controlled by the environment variable in the `.env` file:

```
REACT_APP_ENABLE_MOCK_MODE=false
```

- Set to `false` to use the real backend API
- Set to `true` to use mock API responses

## API Endpoints

The frontend connects to the following backend endpoints:

### Authentication

- **Signup**: `POST /api/auth/signup`
  - Maps frontend form data to the backend expected format
  - Includes wallet address, phone, biometric, and passkey
  - Response includes message, txHash, and token

- **Signin**: `POST /api/auth/login`
  - Requires wallet address or phone number, along with proof and commitment
  - Response includes message and token

### UTXO Operations

- **Fetch UTXOs**: `GET /api/utxo/fetch/:phoneHash`
- **Refund**: `POST /api/utxo/refund`
- **Get User UTXOs**: `GET /api/utxo/user`

### Health Check

- **Health Check**: `GET /api/health`

## Recent Updates

1. Updated API endpoints to match the backend routes:
   - Changed signup endpoint from `/signup` to `/auth/signup`
   - Changed signin endpoint from `/zk/login` to `/auth/login`
   - Updated health check endpoint to `/health`

2. Updated request payload formats to match what the backend expects

3. Updated API URLs to match the deployed backend:
   - Local development: http://localhost:3001/api
   - Production: https://k33p-backend-0kyx.onrender.com/api

4. Verified that both backend and frontend servers are running correctly:
   - Backend server is accessible at http://localhost:3001/api/health (local) or https://k33p-backend-0kyx.onrender.com/health (production)
   - Frontend server is accessible at http://localhost:3000 (local)

## Response Handling

The frontend components are designed to handle both mock API responses and real backend responses. The response structure may differ slightly between the two modes:

- Mock API typically returns data directly in the response
- Real API may nest data in a `data` property and include additional metadata

Components extract the relevant data using:

```javascript
const responseData = response.data.data || response.data;
```

## Error Handling

API errors are caught and displayed to the user with appropriate messages. The error handling extracts error messages from the response when available:

```javascript
error.response?.data?.error || 'Default error message'
```

## Development Workflow

1. During initial development, use mock mode (`REACT_APP_ENABLE_MOCK_MODE=true`)
2. For integration testing, switch to real API mode (`REACT_APP_ENABLE_MOCK_MODE=false`)
3. Ensure the backend server is running at the URL specified in `REACT_APP_API_URL_DEV`
4. For production deployment, use `REACT_APP_API_URL_PROD` and ensure mock mode is disabled