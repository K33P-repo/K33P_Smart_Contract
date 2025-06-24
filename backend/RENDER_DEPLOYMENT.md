# Deploying K33P Backend to Render

## Overview

This guide provides instructions for deploying the K33P Backend to Render.com, a cloud platform for hosting web applications.

## Prerequisites

- A Render.com account
- Git repository with your K33P Backend code

## Deployment Steps

### 1. Connect Your Repository to Render

1. Log in to your Render dashboard at https://dashboard.render.com/
2. Click on "New" and select "Web Service"
3. Connect your Git repository containing the K33P Backend code

### 2. Configure Your Web Service

- **Name**: Choose a name for your service (e.g., "k33p-backend")
- **Environment**: Select "Node"
- **Region**: Choose the region closest to your users
- **Branch**: Select the branch you want to deploy (usually "main" or "master")
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### 3. Configure Environment Variables

Add the following environment variables in the Render dashboard:

- `NODE_ENV`: Set to `production`
- `PORT`: Set to `10000` (or your preferred port)
- `BLOCKFROST_API_KEY`: Your Blockfrost API key
- `ADMIN_API_KEY`: Your admin API key for protected endpoints

### 4. Deploy Your Service

Click "Create Web Service" to deploy your application. Render will automatically build and deploy your service.

### 5. Verify Deployment

Once deployment is complete, you can verify that your service is running by accessing the health check endpoint:

```
https://your-service-name.onrender.com/api/health
```

You should receive a JSON response indicating that the service is running.

## Troubleshooting

### Route Not Found Issues

If you encounter "route not found" errors for endpoints like `/api/utxo/refund`, ensure that:

1. The route is properly registered in your application
2. The correct file is being used as the entry point (check `package.json`)
3. ES module imports are properly resolved (the `fix-imports.js` script should handle this)

### Checking Logs

You can view logs for your service in the Render dashboard to diagnose any issues:

1. Go to your service in the Render dashboard
2. Click on the "Logs" tab
3. Review the logs for any errors or warnings

## Important Notes

### Signup Process

The K33P backend handles the signup process in two ways:

1. **Automatic Transaction**: The backend can create a signup transaction using `signupTxBuilder()` that pays 2 ADA to a smart contract with an inline datum containing the user's hashed data and wallet address.

2. **Manual Transaction**: Alternatively, users can manually send 2 ADA from their wallet to the provided deposit address. After making the transaction, they input their wallet address, and the payment is verified and can be refunded back to the user's address.

Both methods are supported by the backend, and the choice depends on your specific implementation requirements.