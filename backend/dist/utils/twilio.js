// twilio.ts - Twilio Phone Authentication Service
import dotenv from 'dotenv';
import twilio from 'twilio';
// Load environment variables
dotenv.config();
// Initialize Twilio client
let twilioClient = null;
let twilioInitialized = false;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        twilioInitialized = true;
        console.log('Twilio client initialized successfully');
    }
    else {
        console.warn('Twilio credentials not found. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    }
}
catch (error) {
    console.error('Failed to initialize Twilio client:', error);
}
// In-memory storage for OTP requests (in production, use a database)
const otpRequests = new Map();
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
 * Send OTP to a phone number using Twilio Verify API
 * @param phoneNumber The phone number to send OTP to (in E.164 format)
 * @returns Promise with the request ID or error
 */
export const sendOtp = async (phoneNumber) => {
    try {
        if (!twilioInitialized || !twilioClient) {
            return {
                success: false,
                error: 'Twilio service not initialized. Please check your credentials.'
            };
        }
        // Clean up the phone number format (ensure E.164 format)
        let formattedNumber = phoneNumber.replace(/\s+/g, '');
        if (!formattedNumber.startsWith('+')) {
            // Assume US number if no country code provided
            formattedNumber = '+1' + formattedNumber;
        }
        // Check if there's an existing request for this number that's not expired
        const existingRequest = otpRequests.get(formattedNumber);
        if (existingRequest && !existingRequest.verified && (Date.now() - existingRequest.timestamp < 5 * 60 * 1000)) {
            return {
                success: true,
                requestId: existingRequest.requestId,
                error: 'An OTP was already sent recently. Please wait before requesting a new one.'
            };
        }
        // Use Twilio Verify service if available, otherwise use SMS
        let verification;
        let requestId;
        if (process.env.TWILIO_VERIFY_SERVICE_SID) {
            // Use Twilio Verify API
            verification = await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verifications
                .create({
                to: formattedNumber,
                channel: 'sms'
            });
            requestId = verification.sid;
        }
        else {
            // Use regular SMS with generated OTP
            const otpCode = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit OTP
            requestId = `twilio-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            const message = await twilioClient.messages.create({
                body: `Your K33P verification code is: ${otpCode}. This code will expire in 5 minutes.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: formattedNumber
            });
            // Store the OTP for verification
            otpRequests.set(formattedNumber, {
                requestId,
                phoneNumber: formattedNumber,
                timestamp: Date.now(),
                verified: false,
                otpCode // Store for manual verification
            });
        }
        // Store the request for tracking
        if (!otpRequests.has(formattedNumber)) {
            otpRequests.set(formattedNumber, {
                requestId,
                phoneNumber: formattedNumber,
                timestamp: Date.now(),
                verified: false
            });
        }
        console.log(`OTP sent successfully to ${formattedNumber}, request ID: ${requestId}`);
        return {
            success: true,
            requestId
        };
    }
    catch (error) {
        console.error('Twilio OTP send error:', error);
        return {
            success: false,
            error: error.message || 'Failed to send OTP'
        };
    }
};
/**
 * Verify OTP code sent to a phone number
 * @param requestId The request ID returned from sendOtp
 * @param code The OTP code entered by the user
 * @returns Promise with verification result
 */
export const verifyOtp = async (requestId, code) => {
    try {
        if (!twilioInitialized || !twilioClient) {
            return {
                success: false,
                error: 'Twilio service not initialized. Please check your credentials.'
            };
        }
        // Find the request by ID
        let phoneNumber = '';
        let storedRequest;
        for (const [number, request] of otpRequests.entries()) {
            if (request.requestId === requestId) {
                phoneNumber = number;
                storedRequest = request;
                break;
            }
        }
        if (!phoneNumber || !storedRequest) {
            return {
                success: false,
                error: 'Invalid or expired verification request'
            };
        }
        // Check if request is expired (10 minutes)
        if (Date.now() - storedRequest.timestamp > 10 * 60 * 1000) {
            otpRequests.delete(phoneNumber);
            return {
                success: false,
                error: 'Verification code has expired. Please request a new one.'
            };
        }
        let verificationResult;
        if (process.env.TWILIO_VERIFY_SERVICE_SID && requestId.startsWith('VA')) {
            // Use Twilio Verify API
            verificationResult = await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verificationChecks
                .create({
                to: phoneNumber,
                code: code
            });
            if (verificationResult.status === 'approved') {
                storedRequest.verified = true;
                otpRequests.set(phoneNumber, storedRequest);
                return { success: true, verified: true };
            }
            else {
                return {
                    success: false,
                    error: 'Invalid verification code. Please try again.'
                };
            }
        }
        else {
            // Manual verification for regular SMS
            if (storedRequest.otpCode && storedRequest.otpCode === code) {
                storedRequest.verified = true;
                otpRequests.set(phoneNumber, storedRequest);
                return { success: true, verified: true };
            }
            else {
                return {
                    success: false,
                    error: 'Invalid verification code. Please try again.'
                };
            }
        }
    }
    catch (error) {
        console.error('Twilio OTP verification error:', error);
        return {
            success: false,
            error: error.message || 'Failed to verify code'
        };
    }
};
/**
 * Cancel an ongoing verification request
 * @param requestId The request ID to cancel
 * @returns Promise with cancellation result
 */
export const cancelVerification = async (requestId) => {
    try {
        // Find and remove the request
        for (const [phoneNumber, request] of otpRequests.entries()) {
            if (request.requestId === requestId) {
                otpRequests.delete(phoneNumber);
                return { success: true };
            }
        }
        return {
            success: false,
            error: 'Verification request not found'
        };
    }
    catch (error) {
        console.error('Twilio verification cancellation error:', error);
        return {
            success: false,
            error: error.message || 'Failed to cancel verification'
        };
    }
};
/**
 * Check if a phone number has been verified
 * @param phoneNumber The phone number to check
 * @returns Boolean indicating if the number is verified
 */
export const isPhoneNumberVerified = (phoneNumber) => {
    const formattedNumber = phoneNumber.replace(/\s+/g, '');
    const request = otpRequests.get(formattedNumber);
    return request ? request.verified : false;
};
//# sourceMappingURL=twilio.js.map