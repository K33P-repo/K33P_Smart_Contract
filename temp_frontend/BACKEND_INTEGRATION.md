# Backend Integration Guide

## Overview

This document explains how the frontend application connects to the backend API. The frontend can operate in two modes:

1. **Mock Mode**: Uses simulated API responses for development and testing
2. **Real API Mode**: Connects to the actual backend API endpoints

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

- **Signup**: `POST /api/signup`
  - Maps frontend form data to the backend expected format
  - Includes user address, user ID, phone number, and other required fields

- **Signin**: `POST /api/zk/login`
  - Requires wallet address or phone number, along with proof and commitment
  - Simplified for demo with simulated ZK proof and commitment

### UTXO Operations

- **Fetch UTXOs**: `GET /api/utxo/fetch/:phoneHash`
- **Refund**: `POST /api/utxo/refund`
- **Get User UTXOs**: `GET /api/utxo/user`

### Health Check

- **Health Check**: `GET /api/health`

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