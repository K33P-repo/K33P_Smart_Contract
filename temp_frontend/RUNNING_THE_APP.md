# Running the K33P Frontend Application

## Overview

This guide explains how to run the K33P frontend application in different modes:

1. **Mock Mode**: Uses simulated API responses for development and testing
2. **Real API Mode**: Connects to the actual backend API endpoints

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

```bash
cd temp_frontend
npm install
```

## Configuration

The application can be configured using environment variables in the `.env` file:

```
# API URLs
REACT_APP_API_URL_DEV=http://localhost:3001/api
REACT_APP_API_URL_PROD=https://k33p-backend.onrender.com/api

# Feature flags
REACT_APP_ENABLE_MOCK_MODE=true
```

### Mock Mode vs Real API Mode

To switch between mock mode and real API mode, update the `REACT_APP_ENABLE_MOCK_MODE` value in the `.env` file:

- **Mock Mode**: Set `REACT_APP_ENABLE_MOCK_MODE=true`
- **Real API Mode**: Set `REACT_APP_ENABLE_MOCK_MODE=false`

## Running the Application

### Development Mode

```bash
npm start
```

This will start the application in development mode with hot reloading.

### Production Build

```bash
npm run build
```

This will create a production-ready build in the `build` directory.

## Using Mock Mode

Mock mode is useful for development and testing when the backend API is not available. It uses simulated API responses defined in `src/services/mockApi.js`.

Benefits of mock mode:

- No need to run the backend server
- Consistent, predictable responses
- Faster development iterations
- Works offline

## Using Real API Mode

To use the real backend API, you need to:

1. Set `REACT_APP_ENABLE_MOCK_MODE=false` in the `.env` file
2. Ensure the backend server is running at the URL specified in `REACT_APP_API_URL_DEV` (for development) or `REACT_APP_API_URL_PROD` (for production)

### Running the Backend Server (Development)

To run the backend server locally:

```bash
cd ../backend
npm install
npm run build
npm start
```

This will start the backend server at `http://localhost:3001`.

## Troubleshooting

### API Connection Issues

If you're having trouble connecting to the backend API:

1. Check if the backend server is running
2. Verify the API URL in the `.env` file
3. Check browser console for CORS or network errors
4. Switch to mock mode for development if the backend is unavailable

### Mock Mode Not Working

If mock mode is not working:

1. Verify `REACT_APP_ENABLE_MOCK_MODE=true` in the `.env` file
2. Restart the development server
3. Check browser console for errors

## Deployment

For deployment to production:

1. Update `REACT_APP_API_URL_PROD` to point to your production backend API
2. Set `REACT_APP_ENABLE_MOCK_MODE=false`
3. Build the application with `npm run build`
4. Deploy the contents of the `build` directory to your hosting provider