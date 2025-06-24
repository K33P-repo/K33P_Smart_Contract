# Deploying K33P Frontend to Render

## Overview

This guide provides step-by-step instructions for deploying the K33P Frontend (temp_frontend) to Render.com as a static site.

## Prerequisites

- A Render.com account
- Git repository with your K33P Smart Contract code
- Backend already deployed to Render (or another hosting service)

## Deployment Steps

### 1. Prepare Your Frontend for Production

Before deploying, make sure your frontend is ready for production:

1. Update the `.env` file to point to your production backend API:
   ```
   REACT_APP_API_URL_PROD=https://your-backend-service.onrender.com/api
   REACT_APP_ENABLE_MOCK_MODE=false
   ```

2. Test your application locally with production settings:
   ```bash
   # In the temp_frontend directory
   REACT_APP_API_URL=$REACT_APP_API_URL_PROD npm start
   ```

3. Make sure all dependencies are correctly listed in `package.json`

### 2. Create a New Static Site on Render

1. Log in to your Render dashboard at https://dashboard.render.com/
2. Click on "New" and select "Static Site"
3. Connect your GitHub repository containing the K33P Smart Contract code

### 3. Configure Your Static Site

- **Name**: Choose a name for your frontend (e.g., "k33p-frontend")
- **Branch**: Select the branch you want to deploy (usually "main" or "master")
- **Root Directory**: Set to `temp_frontend` (the directory containing your React application)
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `build`

### 4. Configure Environment Variables

Add the following environment variables in the Render dashboard:

- `REACT_APP_API_URL_PROD`: Set to the URL of your deployed backend API (e.g., https://k33p-backend.onrender.com/api)
- `REACT_APP_ENABLE_MOCK_MODE`: Set to `false` for production deployment

### 5. Deploy Your Static Site

Click "Create Static Site" to deploy your frontend application. Render will automatically build and deploy your React application.

### 6. Verify Deployment

Once deployment is complete, you can access your frontend application at the provided Render URL (e.g., https://k33p-frontend.onrender.com).

## Connecting to the Backend

Your frontend needs to communicate with the backend API. Make sure:

1. The backend is properly deployed and accessible
2. The `REACT_APP_API_URL_PROD` environment variable is correctly set to your backend API URL
3. CORS is properly configured on the backend to allow requests from your frontend domain

## Troubleshooting

### Build Errors

If your build fails, check the build logs in the Render dashboard for specific errors. Common issues include:

1. **Dependency Issues**: Make sure all dependencies are correctly listed in `package.json`
2. **Node.js Version**: If you're using features that require a specific Node.js version, you can specify it in the Render dashboard
3. **Environment Variables**: Ensure all required environment variables are set correctly

### Runtime Errors

If your application builds successfully but doesn't work correctly when deployed, check for:

1. **API Connection Issues**: Open the browser console to see if there are any errors connecting to the backend API
2. **CORS Errors**: If you see CORS errors in the console, make sure your backend is configured to allow requests from your frontend domain
3. **Environment Variables**: Make sure environment variables are correctly set and accessible in your React application

### Checking Logs

You can view build logs for your static site in the Render dashboard:

1. Go to your static site in the Render dashboard
2. Click on the "Logs" tab
3. Review the logs for any errors or warnings during the build process

## Custom Domain (Optional)

To use a custom domain for your frontend:

1. Go to your static site in the Render dashboard
2. Click on the "Settings" tab
3. Scroll down to the "Custom Domain" section
4. Click "Add Custom Domain" and follow the instructions

## Automatic Deployments

Render automatically deploys your frontend when you push changes to the connected branch. To disable automatic deployments:

1. Go to your static site in the Render dashboard
2. Click on the "Settings" tab
3. Scroll down to the "Auto-Deploy" section
4. Toggle off "Auto-Deploy"

## Conclusion

By following this guide, you should be able to successfully deploy the K33P Frontend to Render.com as a static site. If you encounter any issues during the deployment process, refer to the troubleshooting section or consult the Render documentation for additional assistance.