import { SendOtpResponse, VerifyOtpResponse, CancelVerificationResponse } from '../interfaces/otp.js';
/**
 * Send OTP to a phone number using Twilio Verify API
 * @param phoneNumber The phone number to send OTP to (in E.164 format)
 * @returns Promise with the request ID or error
 */
export declare const sendOtp: (phoneNumber: string) => Promise<SendOtpResponse>;
/**
 * Verify OTP code sent to a phone number
 * @param requestId The request ID returned from sendOtp
 * @param code The OTP code entered by the user
 * @returns Promise with verification result
 */
export declare const verifyOtp: (requestId: string, code: string) => Promise<VerifyOtpResponse>;
/**
 * Cancel an ongoing verification request
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
//# sourceMappingURL=twilio.d.ts.map