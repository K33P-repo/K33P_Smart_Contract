# K33P Smart Contract Deployment Guide for Render

## Overview

This guide provides comprehensive instructions for deploying the K33P Smart Contract project to Render.com. The project consists of two main components:

1. **Backend**: A Node.js server that handles the smart contract interactions, user authentication, and API endpoints
2. **Frontend**: A React application that provides the user interface for interacting with the K33P Smart Contract

## Prerequisites

- A Render.com account
- Your Blockfrost API key for Cardano Preprod network
- Your seed phrase for the backend wallet (for backend deployment)
- The K33P Smart Contract repository with both backend and frontend code
- Git repository access

## Backend Deployment

### 1. Push Your Code to GitHub

Make sure your code is pushed to a GitHub repository. Render can deploy directly from GitHub.

### 2. Set Up a New Blueprint on Render

1. Log in to your Render dashboard at https://dashboard.render.com/
2. Click on "New" and select "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file in the root directory and configure the services

### 3. Configure Environment Variables

During the deployment process, you'll need to set the following environment variables:

- `NODE_ENV`: Set to `production`
- `PORT`: Set to `3000` (as specified in the root render.yaml) or `10000` (as specified in the backend render.yaml)
- `BLOCKFROST_API_KEY`: Your Blockfrost API key for the Cardano Preprod network
- `SEED_PHRASE`: The seed phrase for the backend wallet
- `ADMIN_API_KEY`: Your admin API key for protected endpoints
- `FRONTEND_URL`: The URL of your deployed frontend (e.g., https://k33p-frontend.onrender.com)

These sensitive variables are marked as `sync: false` in the `render.yaml` file, which means you'll need to set them manually in the Render dashboard.

### 4. Deploy the Service

After configuring the environment variables, click "Apply" to start the deployment process. Render will:

1. Clone your repository
2. Install dependencies
3. Build the TypeScript code
4. Run the fix-imports.js script to fix ES module imports
5. Start the server

### 5. Verify the Backend Deployment

Once the deployment is complete, you can verify that the service is running by checking the health endpoint. The health endpoint path may vary depending on your backend configuration, but it's typically one of these:

```
https://your-backend-service.onrender.com/api/health
https://your-backend-service.onrender.com/health
```

You should receive a JSON response indicating that the service is running. If you receive a 404 error, double-check your backend routes configuration to ensure the health endpoint is correctly defined and accessible.

## Frontend Deployment

### 1. Create a New Static Site on Render

1. Log in to your Render dashboard
2. Click on "New" and select "Static Site"
3. Connect your GitHub repository
4. Configure the following settings:
   - **Name**: Choose a name for your frontend (e.g., "k33p-frontend")
   - **Branch**: Select the branch you want to deploy (usually "main" or "master")
   - **Root Directory**: Set to `temp_frontend` (the directory containing your React application)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

### 2. Configure Environment Variables

Add the following environment variables in the Render dashboard for your frontend deployment:

- `REACT_APP_API_URL_PROD`: Set to the URL of your deployed backend API (e.g., https://k33p-backend.onrender.com/api)
- `REACT_APP_ENABLE_MOCK_MODE`: Set to `false` for production deployment

### 3. Deploy the Frontend

Click "Create Static Site" to deploy your frontend application. Render will automatically build and deploy your React application.

### 4. Verify the Frontend Deployment

Once deployment is complete, you can access your frontend application at the provided Render URL (e.g., https://k33p-frontend.onrender.com).

## Important Notes

### Smart Contract Validator

The smart contract validator (`plutus.json`) is already included in the backend directory and will be deployed with the application. You don't need to deploy the smart contract separately.

### ES Module Imports

The backend deployment process includes a script (`fix-imports.js`) that automatically adds `.js` extensions to ES module imports in the compiled JavaScript files. This is necessary for proper module resolution in production environments.

### Render.yaml Configuration

There are two `render.yaml` files in the project:

1. **Root directory**: Used for Blueprint deployment, configures the backend service with Node.js 18.x
2. **Backend directory**: Alternative configuration for direct web service deployment

For simplicity, it's recommended to use the Blueprint deployment with the root `render.yaml` file.

### Free Tier Limitations

If you're using Render's free tier:

- The service will spin down after 15 minutes of inactivity
- There's a limit of 750 hours of runtime per month
- Consider upgrading to a paid plan for production use

### Production Considerations

For a production deployment, consider:

1. Upgrading to a paid plan for better performance and reliability
2. Setting up a custom domain for both backend and frontend
3. Configuring SSL certificates (automatically handled by Render)
4. Setting up monitoring and alerts

## Troubleshooting

### Common Backend Issues

1. **Build Failures**: Check the build logs for errors. Common issues include missing dependencies or TypeScript compilation errors.

2. **Runtime Errors**: Check the logs for runtime errors. Common issues include missing environment variables or connection issues with the Blockfrost API.

3. **Module Resolution Errors**: If you see errors related to module resolution, make sure the `fix-imports.js` script is running correctly during the build process.

### Common Frontend Issues

1. **API Connection Errors**: Ensure that the `REACT_APP_API_URL_PROD` environment variable is correctly set to your backend API URL.

2. **Build Errors**: Check the build logs for any errors during the build process. Common issues include dependency conflicts or syntax errors in the code.

3. **CORS Issues**: If the frontend cannot connect to the backend due to CORS errors, ensure that the backend is properly configured to allow requests from the frontend domain.

### Checking Logs

You can view logs for your services in the Render dashboard. This can help you diagnose issues with the deployment or runtime errors:

1. Go to your service in the Render dashboard
2. Click on the "Logs" tab
3. Review the logs for any errors or warnings

## Signup Process

The K33P backend handles the signup process in two ways:

1. **Automatic Transaction**: The backend can create a signup transaction using `signupTxBuilder()` that pays 2 ADA to a smart contract with an inline datum containing the user's hashed data and wallet address.

2. **Manual Transaction**: Alternatively, users can manually send 2 ADA from their wallet to the provided deposit address. After making the transaction, they input their wallet address, and the payment is verified and can be refunded back to the user's address.

Both methods are supported by the backend, and the choice depends on your specific implementation requirements.

## Conclusion

By following this guide, you should be able to successfully deploy both the backend and frontend components of the K33P Smart Contract project to Render.com. If you encounter any issues during the deployment process, refer to the troubleshooting section or consult the Render documentation for additional assistance.