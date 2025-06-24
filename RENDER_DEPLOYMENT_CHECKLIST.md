# K33P Smart Contract Render Deployment Checklist

Use this checklist to ensure you've completed all necessary steps for deploying the K33P Smart Contract project to Render.com.

## Pre-Deployment Preparation

### Repository Setup

- [ ] Code is pushed to a GitHub repository
- [ ] All necessary files are included in the repository
- [ ] `.gitignore` is properly configured to exclude sensitive files

### Environment Variables

- [ ] Blockfrost API key is available
- [ ] Backend wallet seed phrase is available
- [ ] Admin API key is created

### Backend Preparation

- [ ] TypeScript code compiles without errors
- [ ] All dependencies are correctly listed in `package.json`
- [ ] `fix-imports.js` script is present and working
- [ ] Health check endpoints (`/api/health` and `/health`) are implemented

### Frontend Preparation

- [ ] React application builds without errors
- [ ] All dependencies are correctly listed in `package.json`
- [ ] Environment variables are properly configured in `.env` file
- [ ] API endpoints are correctly configured to use environment variables

## Deployment Process

### Blueprint Deployment (Recommended)

- [ ] Logged in to Render dashboard
- [ ] Created a new Blueprint
- [ ] Connected GitHub repository
- [ ] Set required environment variables:
  - [ ] `NODE_ENV`
  - [ ] `PORT`
  - [ ] `BLOCKFROST_API_KEY`
  - [ ] `SEED_PHRASE`
  - [ ] `ADMIN_API_KEY`
  - [ ] `REACT_APP_API_URL_PROD` (if not using `fromService`)
  - [ ] `REACT_APP_ENABLE_MOCK_MODE`
- [ ] Applied Blueprint configuration

### Manual Deployment (Alternative)

#### Backend Deployment

- [ ] Logged in to Render dashboard
- [ ] Created a new Web Service
- [ ] Connected GitHub repository
- [ ] Configured service settings:
  - [ ] Name: `k33p-backend`
  - [ ] Environment: `node`
  - [ ] Branch: `main` (or your preferred branch)
  - [ ] Root Directory: `/`
  - [ ] Build Command: `cd backend && npm ci --legacy-peer-deps --include=dev && npx tsc && node fix-imports.js`
  - [ ] Start Command: `cd backend && npm start`
  - [ ] Health Check Path: `/api/health`
- [ ] Set required environment variables:
  - [ ] `NODE_ENV`: `production`
  - [ ] `PORT`: `3000` or `10000`
  - [ ] `BLOCKFROST_API_KEY`: Your Blockfrost API key
  - [ ] `SEED_PHRASE`: Your backend wallet seed phrase
  - [ ] `ADMIN_API_KEY`: Your admin API key
  - [ ] `FRONTEND_URL`: Your frontend URL (once deployed)
- [ ] Created Web Service

#### Frontend Deployment

- [ ] Logged in to Render dashboard
- [ ] Created a new Static Site
- [ ] Connected GitHub repository
- [ ] Configured site settings:
  - [ ] Name: `k33p-frontend`
  - [ ] Branch: `main` (or your preferred branch)
  - [ ] Root Directory: `temp_frontend`
  - [ ] Build Command: `npm install && npm run build`
  - [ ] Publish Directory: `build`
- [ ] Set required environment variables:
  - [ ] `REACT_APP_API_URL_PROD`: Your backend API URL
  - [ ] `REACT_APP_ENABLE_MOCK_MODE`: `false`
- [ ] Created Static Site

## Post-Deployment Verification

### Backend Verification

- [ ] Backend service is deployed successfully
- [ ] Health check endpoint (`/api/health` or `/health`) returns a successful response
- [ ] API endpoints are accessible and working correctly

### Frontend Verification

- [ ] Frontend site is deployed successfully
- [ ] Frontend can connect to the backend API
- [ ] All features are working as expected

### Security Verification

- [ ] Sensitive environment variables are properly secured
- [ ] API endpoints are properly protected
- [ ] CORS is correctly configured

## Additional Configuration (Optional)

### Custom Domain

- [ ] Custom domain is configured for backend
- [ ] Custom domain is configured for frontend
- [ ] DNS records are properly set up
- [ ] SSL certificates are issued and working

### Monitoring and Alerts

- [ ] Monitoring is set up for backend service
- [ ] Alerts are configured for service outages
- [ ] Log retention is configured

## Notes

Use this space to note any specific configuration details or issues encountered during deployment:

```

```

## Completion

Deployment completed on: ________________

Deployed by: ________________

Backend URL: ________________

Frontend URL: ________________