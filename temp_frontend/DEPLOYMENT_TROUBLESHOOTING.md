# Deployment Troubleshooting Guide

## Common Issues

### 1. API Endpoint 404 Errors

**Symptoms:**
- Error messages like: `Failed to load resource: the server responded with a status of 404 ()`
- Console errors showing requests to incorrect endpoints

**Possible Causes:**
- Incorrect API URL configuration
- Mismatched endpoint paths between frontend and backend
- Backend service not running or deployed correctly

**Solutions:**
- Verify the correct backend URL is set in `.env` and `api.js`
- Check that endpoint paths in API service match the backend routes
- Ensure the backend service is running and accessible

### 2. API Endpoint 500 Errors

**Symptoms:**
- Error messages like: `Failed to load resource: the server responded with a status of 500 ()`
- Backend logs showing errors in transaction creation or user registration

**Possible Causes:**
- Backend service errors in processing requests
- Missing or incorrect environment variables
- Database connection issues

**Solutions:**
- Check backend logs for specific error messages
- Verify all required environment variables are set correctly
- Test backend endpoints directly using tools like Postman or curl

### 3. Authentication Errors

**Symptoms:**
- Unable to sign up or sign in
- JWT token issues
- Redirect failures after authentication

**Possible Causes:**
- Incorrect authentication flow
- Token storage or retrieval issues
- CORS configuration problems

**Solutions:**
- Verify the authentication flow in both frontend and backend
- Check token storage and retrieval in localStorage
- Ensure CORS is properly configured in the backend

## Deployment-Specific Issues

### Render.com Deployment

**Environment Variables:**
- Ensure all required environment variables are set in the Render dashboard
- Check that service URLs are correctly configured for inter-service communication

**Build Process:**
- Verify the build commands in `render.yaml` are correct
- Check build logs for any errors during deployment

**Health Checks:**
- Ensure the health check endpoint is correctly configured and accessible
- Verify the service is passing health checks in the Render dashboard

## Debugging Steps

1. **Check Frontend Console:**
   - Open browser developer tools
   - Look for network request errors
   - Check console logs for error messages

2. **Check Backend Logs:**
   - View logs in the Render dashboard
   - Look for error messages related to failed requests

3. **Test API Endpoints:**
   - Use curl or Postman to test API endpoints directly
   - Verify the expected response format

4. **Verify Configuration:**
   - Check `.env` files for correct URLs
   - Verify `api.js` is using the correct endpoints
   - Ensure `render.yaml` has the correct service configuration

## Recent Fixes

1. Updated API URL in frontend to match the deployed backend URL:
   - Changed from `https://k33p-backend.onrender.com/api` to `https://k33p-backend-0kyx.onrender.com/api`

2. Fixed health check endpoint path:
   - Changed from `/api/health` to `/health`

3. Updated API endpoint paths to match backend routes:
   - Changed signup endpoint from `/signup` to `/auth/signup`
   - Changed signin endpoint from `/zk/login` to `/auth/login`