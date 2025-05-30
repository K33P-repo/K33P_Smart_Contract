// otp.ts - OTP Service Interfaces

/**
 * Request to send OTP to a phone number
 */
export interface SendOtpRequest {
  phoneNumber: string;
}

/**
 * Response from sending OTP
 */
export interface SendOtpResponse {
  success: boolean;
  requestId?: string;
  error?: string;
}

/**
 * Request to verify OTP code
 */
export interface VerifyOtpRequest {
  requestId: string;
  code: string;
}

/**
 * Response from verifying OTP
 */
export interface VerifyOtpResponse {
  success: boolean;
  verified?: boolean;
  error?: string;
}

/**
 * Request to cancel verification
 */
export interface CancelVerificationRequest {
  requestId: string;
}

/**
 * Response from cancelling verification
 */
export interface CancelVerificationResponse {
  success: boolean;
  error?: string;
}

/**
 * OTP request stored in memory
 */
export interface OtpRequest {
  requestId: string;
  phoneNumber: string;
  timestamp: number;
  verified: boolean;
}