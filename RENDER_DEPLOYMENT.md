# K33P Backend Deployment Guide for Render

## Overview

This guide explains how to deploy the K33P Backend Server to Render.com. The deployment is configured using the `render.yaml` file in the root directory, which defines the web service configuration.

## Prerequisites

1. A Render.com account
2. Your Blockfrost API key for Cardano Preprod network
3. Your seed phrase for the backend wallet
4. The K33P Smart Contract repository with the backend code

## Deployment Steps

### 1. Push Your Code to GitHub

Make sure your code is pushed to a GitHub repository. Render can deploy directly from GitHub.

### 2. Set Up a New Blueprint on Render

1. Log in to your Render dashboard
2. Click on "New" and select "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file and configure the services

### 3. Configure Environment Variables

During the deployment process, you'll need to set the following environment variables:

- `BLOCKFROST_API_KEY`: Your Blockfrost API key for the Cardano Preprod network
- `SEED_PHRASE`: The seed phrase for the backend wallet

These are marked as `sync: false` in the `render.yaml` file, which means you'll need to set them manually in the Render dashboard.

### 4. Deploy the Service

After configuring the environment variables, click "Apply" to start the deployment process. Render will:

1. Clone your repository
2. Install dependencies
3. Build the TypeScript code
4. Run the fix-imports.js script to fix ES module imports
5. Start the server

### 5. Verify the Deployment

Once the deployment is complete, you can verify that the service is running by checking the health endpoint at `/api/health`.

## Important Notes

### Smart Contract Validator

The smart contract validator (`plutus.json`) is already included in the backend directory and will be deployed with the application. You don't need to deploy the smart contract separately.

### ES Module Imports

The deployment process includes a script (`fix-imports.js`) that automatically adds `.js` extensions to ES module imports in the compiled JavaScript files. This is necessary for proper module resolution in production environments.

### Free Tier Limitations

If you're using Render's free tier:

- The service will spin down after 15 minutes of inactivity
- There's a limit of 750 hours of runtime per month
- Consider upgrading to a paid plan for production use

### Production Considerations

For a production deployment, consider:

1. Upgrading to a paid plan for better performance and reliability
2. Setting up a custom domain
3. Configuring SSL certificates
4. Setting up monitoring and alerts

## Troubleshooting

### Common Issues

1. **Build Failures**: Check the build logs for errors. Common issues include missing dependencies or TypeScript compilation errors.

2. **Runtime Errors**: Check the logs for runtime errors. Common issues include missing environment variables or connection issues with the Blockfrost API.

3. **Module Resolution Errors**: If you see errors related to module resolution, make sure the `fix-imports.js` script is running correctly during the build process.

### Logs

You can view the logs for your service in the Render dashboard. This can help you diagnose issues with the deployment or runtime errors.