import admin from 'firebase-admin';
import { SendOtpResponse, VerifyOtpResponse, CancelVerificationResponse } from '../interfaces/otp';
/**
 * Verify a Firebase authentication token from a mobile app
 * @param idToken The Firebase ID token to verify
 * @returns The decoded token if valid, null otherwise
 */
export declare const verifyFirebaseToken: (idToken: string) => Promise<admin.auth.DecodedIdToken | null>;
/**
 * Send OTP to a phone number using Firebase Authentication
 * Note: For mobile apps, this should be done directly in the app using Firebase SDK
 * This function is a placeholder for server-side implementation
 * @param phoneNumber The phone number to send OTP to
 * @returns Promise with the request ID or error
 */
export declare const sendOtp: (phoneNumber: string) => Promise<SendOtpResponse>;
/**
 * Verify OTP code sent to a phone number
 * Note: For mobile apps, this should be done directly in the app using Firebase SDK
 * This function is a placeholder for server-side implementation
 * @param requestId The request ID returned from sendOtp
 * @param code The OTP code entered by the user
 * @returns Promise with verification result
 */
export declare const verifyOtp: (requestId: string, code: string) => Promise<VerifyOtpResponse>;
/**
 * Cancel an ongoing verification request
 * Note: For mobile apps, this should be done directly in the app using Firebase SDK
 * This function is a placeholder for server-side implementation
 * @param requestId The request ID to cancel
 * @returns Promise with cancellation result
 */
export declare const cancelVerification: (requestId: string) => Promise<CancelVerificationResponse>;
/**
 * Check if a phone number has been verified
 * @param phoneNumber The phone number to check
 * @returns Boolean indicating if the number is verified
 */
export declare const isPhoneNumberVerified: (phoneNumber: string) => boolean;
//# sourceMappingURL=firebase.d.ts.map