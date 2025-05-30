// firebase.ts - Firebase Phone Authentication Service
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { OtpRequest, SendOtpResponse, VerifyOtpResponse, CancelVerificationResponse } from '../interfaces/otp';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
// Note: You need to create a service account in Firebase console and download the JSON file
// Then set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the path of the JSON file
// Or use the following code to initialize the SDK with the service account JSON directly
let firebaseInitialized = false;

try {
  // Check if Firebase Admin SDK is already initialized
  if (!admin.apps.length) {
    // Initialize with service account if provided
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        firebaseInitialized = true;
        console.log('Firebase Admin SDK initialized with service account');
      } catch (parseError) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError);
        console.log('Falling back to application default credentials');
        admin.initializeApp();
        firebaseInitialized = true;
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Initialize with application default credentials from path
      admin.initializeApp();
      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized with application default credentials');
    } else {
      console.warn('No Firebase credentials found. Firebase authentication will not work.');
      console.warn('Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS environment variable.');
      // Still initialize with default config for development environments
      admin.initializeApp();
      firebaseInitialized = true;
    }
  } else {
    firebaseInitialized = true;
    console.log('Firebase Admin SDK already initialized');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
}

// In-memory storage for OTP requests (in production, use a database)
const otpRequests: Map<string, OtpRequest> = new Map();

// Clean up expired OTP requests (older than 10 minutes)
const cleanupExpiredRequests = () => {
  const now = Date.now();
  const expiryTime = 10 * 60 * 1000; // 10 minutes
  
  for (const [phoneNumber, request] of otpRequests.entries()) {
    if (now - request.timestamp > expiryTime) {
      otpRequests.delete(phoneNumber);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredRequests, 5 * 60 * 1000);

/**
 * Verify a Firebase authentication token from a mobile app
 * @param idToken The Firebase ID token to verify
 * @returns The decoded token if valid, null otherwise
 */
export const verifyFirebaseToken = async (idToken: string): Promise<admin.auth.DecodedIdToken | null> => {
  if (!firebaseInitialized) {
    console.error('Firebase Admin SDK not initialized');
    return null;
  }
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return null;
  }
};

/**
 * Send OTP to a phone number using Firebase Authentication
 * Note: For mobile apps, this should be done directly in the app using Firebase SDK
 * This function is a placeholder for server-side implementation
 * @param phoneNumber The phone number to send OTP to
 * @returns Promise with the request ID or error
 */
export const sendOtp = async (phoneNumber: string): Promise<SendOtpResponse> => {
  try {
    // Clean up the phone number format (remove spaces, ensure international format)
    const formattedNumber = phoneNumber.replace(/\s+/g, '');
    
    // Check if there's an existing request for this number that's not expired
    const existingRequest = otpRequests.get(formattedNumber);
    if (existingRequest && !existingRequest.verified && (Date.now() - existingRequest.timestamp < 5 * 60 * 1000)) {
      return { 
        success: true, 
        requestId: existingRequest.requestId,
        error: 'An OTP was already sent recently. Please wait before requesting a new one.'
      };
    }
    
    // For server-side implementation, we would use the Firebase Admin SDK
    // However, for mobile apps, the Firebase SDK should be used directly in the app
    // This is a placeholder to maintain compatibility with the existing interface
    const requestId = `firebase-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // Store the request for later verification
    otpRequests.set(formattedNumber, {
      requestId,
      phoneNumber: formattedNumber,
      timestamp: Date.now(),
      verified: false
    });
    
    console.log(`OTP request created for ${formattedNumber}, request ID: ${requestId}`);
    console.log('Note: For mobile apps, use Firebase Authentication SDK directly in the app');
    
    return { 
      success: true, 
      requestId,
      error: 'For mobile apps, use Firebase Authentication SDK directly in the app'
    };
  } catch (error: any) {
    console.error('OTP error:', error);
    return { success: false, error: 'Failed to create OTP request' };
  }
};

/**
 * Verify OTP code sent to a phone number
 * Note: For mobile apps, this should be done directly in the app using Firebase SDK
 * This function is a placeholder for server-side implementation
 * @param requestId The request ID returned from sendOtp
 * @param code The OTP code entered by the user
 * @returns Promise with verification result
 */
export const verifyOtp = async (requestId: string, code: string): Promise<VerifyOtpResponse> => {
  try {
    // Find the request by ID
    let phoneNumber = '';
    for (const [number, request] of otpRequests.entries()) {
      if (request.requestId === requestId) {
        phoneNumber = number;
        break;
      }
    }
    
    if (!phoneNumber) {
      return { success: false, error: 'Invalid or expired verification request' };
    }
    
    // For server-side implementation, we would use the Firebase Admin SDK
    // However, for mobile apps, the Firebase SDK should be used directly in the app
    // This is a placeholder to maintain compatibility with the existing interface
    console.log(`Verification attempt for request ${requestId} with code ${code}`);
    console.log('Note: For mobile apps, use Firebase Authentication SDK directly in the app');
    
    // For testing purposes, always return success
    // In a real implementation, this would verify the code with Firebase
    const request = otpRequests.get(phoneNumber);
    if (request) {
      request.verified = true;
      otpRequests.set(phoneNumber, request);
    }
    
    return { success: true, verified: true };
  } catch (error: any) {
    console.error('Verification error:', error);
    return { success: false, error: 'Failed to verify code' };
  }
};

/**
 * Cancel an ongoing verification request
 * Note: For mobile apps, this should be done directly in the app using Firebase SDK
 * This function is a placeholder for server-side implementation
 * @param requestId The request ID to cancel
 * @returns Promise with cancellation result
 */
export const cancelVerification = async (requestId: string): Promise<CancelVerificationResponse> => {
  try {
    // Find the request by ID
    let found = false;
    for (const [number, request] of otpRequests.entries()) {
      if (request.requestId === requestId) {
        otpRequests.delete(number);
        found = true;
        break;
      }
    }
    
    if (!found) {
      return { success: false, error: 'Invalid or expired verification request' };
    }
    
    console.log(`Verification request ${requestId} cancelled successfully`);
    return { success: true };
  } catch (error: any) {
    console.error('Cancel error:', error);
    return { success: false, error: 'Failed to cancel verification' };
  }
};

/**
 * Check if a phone number has been verified
 * @param phoneNumber The phone number to check
 * @returns Boolean indicating if the number is verified
 */
export const isPhoneNumberVerified = (phoneNumber: string): boolean => {
  const formattedNumber = phoneNumber.replace(/\s+/g, '');
  const request = otpRequests.get(formattedNumber);
  return request ? request.verified : false;
};