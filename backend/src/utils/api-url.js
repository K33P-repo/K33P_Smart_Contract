// Utility for generating API URLs based on environment
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

/**
 * Get the base URL for API requests based on the current environment
 * @returns {string} The base URL to use for API requests
 */
export function getApiBaseUrl() {
  // For production environment, use the FRONTEND_URL or construct from RENDER_EXTERNAL_URL
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || 
           `https://${process.env.RENDER_EXTERNAL_URL || 'k33p-backend.onrender.com'}`;
  }
  
  // For development or test environments, use localhost with the configured port
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

/**
 * Generate a full API URL for a specific endpoint
 * @param {string} endpoint - The API endpoint (should start with '/')
 * @returns {string} The full URL
 */
export function getApiUrl(endpoint) {
  const baseUrl = getApiBaseUrl();
  // Ensure endpoint starts with '/'
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
}