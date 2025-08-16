/**
 * Centralized Error Handling Middleware for K33P Backend
 * Provides consistent error responses and logging across all endpoints
 */
import { Request, Response, NextFunction } from 'express';
export declare enum SuccessCodes {
    AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS",
    AUTH_LOGOUT_SUCCESS = "AUTH_LOGOUT_SUCCESS",
    AUTH_TOKEN_VERIFIED = "AUTH_TOKEN_VERIFIED",
    TOKEN_VERIFIED = "TOKEN_VERIFIED",
    USER_CREATED = "USER_CREATED",
    USER_RETRIEVED = "USER_RETRIEVED",
    USER_UPDATED = "USER_UPDATED",
    PHONE_VERIFIED = "PHONE_VERIFIED",
    WALLET_CONNECTED = "WALLET_CONNECTED",
    WALLET_VERIFIED = "WALLET_VERIFIED",
    WALLET_RETRIEVED = "WALLET_RETRIEVED",
    OTP_SENT = "OTP_SENT",
    OTP_VERIFIED = "OTP_VERIFIED",
    PIN_SETUP_SUCCESS = "PIN_SETUP_SUCCESS",
    PIN_VERIFIED = "PIN_VERIFIED",
    BIOMETRIC_SETUP_SUCCESS = "BIOMETRIC_SETUP_SUCCESS",
    BIOMETRIC_VERIFIED = "BIOMETRIC_VERIFIED",
    USERNAME_SET = "USERNAME_SET",
    SESSION_CREATED = "SESSION_CREATED",
    SESSION_RETRIEVED = "SESSION_RETRIEVED",
    ZK_PROOF_VERIFIED = "ZK_PROOF_VERIFIED",
    ZK_COMMITMENT_CREATED = "ZK_COMMITMENT_CREATED",
    TRANSACTION_SUCCESS = "TRANSACTION_SUCCESS",
    DEPOSIT_VERIFIED = "DEPOSIT_VERIFIED",
    REFUND_PROCESSED = "REFUND_PROCESSED",
    OPERATION_SUCCESS = "OPERATION_SUCCESS",
    DATA_RETRIEVED = "DATA_RETRIEVED",
    DATA_CREATED = "DATA_CREATED",
    DATA_UPDATED = "DATA_UPDATED"
}
export declare enum ErrorCodes {
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS",
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED",
    AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID",
    AUTH_TOKEN_MISSING = "AUTH_TOKEN_MISSING",
    TOKEN_REQUIRED = "TOKEN_REQUIRED",
    TOKEN_INVALID = "TOKEN_INVALID",
    INVALID_TOKEN = "INVALID_TOKEN",
    ACCESS_DENIED = "ACCESS_DENIED",
    USER_NOT_FOUND = "USER_NOT_FOUND",
    USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
    USER_ALREADY_SIGNED_UP = "USER_ALREADY_SIGNED_UP",
    USER_ALREADY_REFUNDED = "USER_ALREADY_REFUNDED",
    USER_NO_ADA_SENT = "USER_NO_ADA_SENT",
    USER_SECOND_TIME_USE = "USER_SECOND_TIME_USE",
    USER_CREATION_FAILED = "USER_CREATION_FAILED",
    PHONE_ALREADY_EXISTS = "PHONE_ALREADY_EXISTS",
    PHONE_INVALID_FORMAT = "PHONE_INVALID_FORMAT",
    PHONE_REQUIRED = "PHONE_REQUIRED",
    WALLET_ALREADY_EXISTS = "WALLET_ALREADY_EXISTS",
    WALLET_ADDRESS_IN_USE = "WALLET_ADDRESS_IN_USE",
    WALLET_ADDRESS_INVALID = "WALLET_ADDRESS_INVALID",
    WALLET_ADDRESS_REQUIRED = "WALLET_ADDRESS_REQUIRED",
    WALLET_ADDRESS_NOT_FOUND = "WALLET_ADDRESS_NOT_FOUND",
    WALLET_IN_USE = "WALLET_IN_USE",
    OTP_EXPIRED = "OTP_EXPIRED",
    OTP_INVALID = "OTP_INVALID",
    OTP_SEND_FAILED = "OTP_SEND_FAILED",
    OTP_VERIFICATION_FAILED = "OTP_VERIFICATION_FAILED",
    OTP_CANCELLATION_FAILED = "OTP_CANCELLATION_FAILED",
    OTP_REQUEST_ID_REQUIRED = "OTP_REQUEST_ID_REQUIRED",
    OTP_CODE_REQUIRED = "OTP_CODE_REQUIRED",
    OTP_CODE_INVALID_FORMAT = "OTP_CODE_INVALID_FORMAT",
    BIOMETRIC_VERIFICATION_FAILED = "BIOMETRIC_VERIFICATION_FAILED",
    BIOMETRIC_NOT_ENROLLED = "BIOMETRIC_NOT_ENROLLED",
    BIOMETRIC_DATA_REQUIRED = "BIOMETRIC_DATA_REQUIRED",
    PIN_INVALID = "PIN_INVALID",
    PIN_SETUP_FAILED = "PIN_SETUP_FAILED",
    PIN_REQUIRED = "PIN_REQUIRED",
    PIN_INVALID_FORMAT = "PIN_INVALID_FORMAT",
    PIN_NOT_FOUND = "PIN_NOT_FOUND",
    USERNAME_REQUIRED = "USERNAME_REQUIRED",
    USERNAME_ALREADY_EXISTS = "USERNAME_ALREADY_EXISTS",
    USERNAME_INVALID_FORMAT = "USERNAME_INVALID_FORMAT",
    SESSION_ID_REQUIRED = "SESSION_ID_REQUIRED",
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
    SESSION_INVALID = "SESSION_INVALID",
    INVALID_SESSION = "INVALID_SESSION",
    INVALID_FLOW = "INVALID_FLOW",
    ZK_PROOF_INVALID = "ZK_PROOF_INVALID",
    ZK_PROOF_GENERATION_FAILED = "ZK_PROOF_GENERATION_FAILED",
    ZK_COMMITMENT_INVALID = "ZK_COMMITMENT_INVALID",
    ZK_PROOF_REQUIRED = "ZK_PROOF_REQUIRED",
    ZK_COMMITMENT_REQUIRED = "ZK_COMMITMENT_REQUIRED",
    TRANSACTION_FAILED = "TRANSACTION_FAILED",
    TRANSACTION_NOT_FOUND = "TRANSACTION_NOT_FOUND",
    REFUND_FAILED = "REFUND_FAILED",
    REFUND_ALREADY_PROCESSED = "REFUND_ALREADY_PROCESSED",
    REFUND_NOT_ELIGIBLE = "REFUND_NOT_ELIGIBLE",
    DEPOSIT_VERIFICATION_FAILED = "DEPOSIT_VERIFICATION_FAILED",
    DEPOSIT_NOT_FOUND = "DEPOSIT_NOT_FOUND",
    USER_UPDATE_FAILED = "USER_UPDATE_FAILED",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_INPUT = "INVALID_INPUT",
    MISSING_REQUIRED_FIELDS = "MISSING_REQUIRED_FIELDS",
    IDENTIFIER_REQUIRED = "IDENTIFIER_REQUIRED",
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    SERVER_ERROR = "SERVER_ERROR",
    DATABASE_ERROR = "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    SEED_PHRASE_NOT_FOUND = "SEED_PHRASE_NOT_FOUND",
    SEED_PHRASE_ENCRYPTION_FAILED = "SEED_PHRASE_ENCRYPTION_FAILED",
    STORAGE_SERVICE_ERROR = "STORAGE_SERVICE_ERROR"
}
export declare class K33PError extends Error {
    code: ErrorCodes;
    statusCode: number;
    userMessage: string;
    details?: any;
    timestamp: string;
    constructor(code: ErrorCodes, details?: any, customMessage?: string);
}
export declare class ResponseUtils {
    /**
     * Send a success response with optional success code
     */
    static success(res: Response, successCode?: SuccessCodes, data?: any, customMessage?: string, statusCode?: number): Response<any, Record<string, any>>;
    /**
     * Send a success response (legacy method for backward compatibility)
     */
    static legacySuccess(res: Response, data?: any, message?: string, statusCode?: number): Response<any, Record<string, any>>;
    /**
     * Send an error response
     */
    static error(res: Response, error: K33PError | ErrorCodes | string, details?: any, customMessage?: string): Response<any, Record<string, any>>;
    /**
     * Send validation error response
     */
    static validationError(res: Response, validationErrors: any[], customMessage?: string): Response<any, Record<string, any>>;
}
export declare const globalErrorHandler: (error: any, req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    SuccessCodes: typeof SuccessCodes;
    ErrorCodes: typeof ErrorCodes;
    K33PError: typeof K33PError;
    ResponseUtils: typeof ResponseUtils;
    globalErrorHandler: (error: any, req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=error-handler.d.ts.map