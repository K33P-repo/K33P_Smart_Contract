# K33P Smart Contract Render Deployment

## Overview

This README provides a quick reference for deploying the K33P Smart Contract project to Render.com. For detailed instructions, please refer to the following documentation files:

- [Complete Deployment Guide](./RENDER_DEPLOYMENT_GUIDE.md) - Comprehensive instructions for deploying both backend and frontend
- [Backend Deployment Guide](./RENDER_DEPLOYMENT.md) - Specific instructions for deploying the backend
- [Frontend Deployment Guide](./temp_frontend/RENDER_DEPLOYMENT.md) - Specific instructions for deploying the frontend

## Quick Start

### Option 1: Blueprint Deployment (Recommended)

The easiest way to deploy both the backend and frontend is using Render's Blueprint feature:

1. Push your code to GitHub
2. Log in to your Render dashboard
3. Click on "New" and select "Blueprint"
4. Connect your GitHub repository
5. Render will automatically detect the `render.yaml` file in the root directory and configure both services
6. Set the required environment variables when prompted
7. Click "Apply" to start the deployment process

### Option 2: Manual Deployment

If you prefer to deploy the services separately:

#### Backend Deployment

1. Log in to your Render dashboard
2. Click on "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service using the settings in `backend/render.yaml`
5. Set the required environment variables
6. Click "Create Web Service" to deploy

#### Frontend Deployment

1. Log in to your Render dashboard
2. Click on "New" and select "Static Site"
3. Connect your GitHub repository
4. Configure the site using the settings in `temp_frontend/render.yaml`
5. Set the required environment variables
6. Click "Create Static Site" to deploy

## Required Environment Variables

### Backend

- `NODE_ENV`: Set to `production`
- `PORT`: Set to `3000` (as specified in the root render.yaml) or `10000` (as specified in the backend render.yaml)
- `BLOCKFROST_API_KEY`: Your Blockfrost API key for the Cardano Preprod network
- `SEED_PHRASE`: The seed phrase for the backend wallet
- `ADMIN_API_KEY`: Your admin API key for protected endpoints

### Frontend

- `REACT_APP_API_URL_PROD`: Set to the URL of your deployed backend API (e.g., https://k33p-backend.onrender.com/api)
- `REACT_APP_ENABLE_MOCK_MODE`: Set to `false` for production deployment

## Verification

### Backend

Verify the backend deployment by accessing the health endpoint. The exact path may vary depending on your backend configuration:

```
https://your-backend-service.onrender.com/api/health
# or
https://your-backend-service.onrender.com/health
```

If you receive a 404 error, check your backend routes configuration to ensure the health endpoint is correctly defined.

### Frontend

Verify the frontend deployment by accessing the Render URL provided after deployment:

```
https://k33p-frontend.onrender.com
```

## Troubleshooting

If you encounter any issues during deployment, please refer to the detailed documentation files for troubleshooting guidance. You can also check the logs in the Render dashboard for specific error messages.

## Support

For additional assistance, please contact the K33P Smart Contract development team or refer to the Render documentation at https://render.com/docs.