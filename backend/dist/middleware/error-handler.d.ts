/**
 * Centralized Error Handling Middleware for K33P Backend
 * Provides consistent error responses and logging across all endpoints
 */
import { Request, Response, NextFunction } from 'express';
export declare enum ErrorCodes {
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS",
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED",
    AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID",
    AUTH_TOKEN_MISSING = "AUTH_TOKEN_MISSING",
    ACCESS_DENIED = "ACCESS_DENIED",
    USER_NOT_FOUND = "USER_NOT_FOUND",
    USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
    USER_ALREADY_SIGNED_UP = "USER_ALREADY_SIGNED_UP",
    USER_ALREADY_REFUNDED = "USER_ALREADY_REFUNDED",
    USER_NO_ADA_SENT = "USER_NO_ADA_SENT",
    USER_SECOND_TIME_USE = "USER_SECOND_TIME_USE",
    PHONE_ALREADY_EXISTS = "PHONE_ALREADY_EXISTS",
    PHONE_INVALID_FORMAT = "PHONE_INVALID_FORMAT",
    WALLET_ALREADY_EXISTS = "WALLET_ALREADY_EXISTS",
    WALLET_ADDRESS_IN_USE = "WALLET_ADDRESS_IN_USE",
    WALLET_ADDRESS_INVALID = "WALLET_ADDRESS_INVALID",
    OTP_EXPIRED = "OTP_EXPIRED",
    OTP_INVALID = "OTP_INVALID",
    OTP_SEND_FAILED = "OTP_SEND_FAILED",
    BIOMETRIC_VERIFICATION_FAILED = "BIOMETRIC_VERIFICATION_FAILED",
    BIOMETRIC_NOT_ENROLLED = "BIOMETRIC_NOT_ENROLLED",
    PIN_INVALID = "PIN_INVALID",
    PIN_SETUP_FAILED = "PIN_SETUP_FAILED",
    ZK_PROOF_INVALID = "ZK_PROOF_INVALID",
    ZK_PROOF_GENERATION_FAILED = "ZK_PROOF_GENERATION_FAILED",
    ZK_COMMITMENT_INVALID = "ZK_COMMITMENT_INVALID",
    TRANSACTION_FAILED = "TRANSACTION_FAILED",
    REFUND_FAILED = "REFUND_FAILED",
    REFUND_ALREADY_PROCESSED = "REFUND_ALREADY_PROCESSED",
    REFUND_NOT_ELIGIBLE = "REFUND_NOT_ELIGIBLE",
    DEPOSIT_VERIFICATION_FAILED = "DEPOSIT_VERIFICATION_FAILED",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_INPUT = "INVALID_INPUT",
    MISSING_REQUIRED_FIELDS = "MISSING_REQUIRED_FIELDS",
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
     * Send a success response
     */
    static success(res: Response, data?: any, message?: string, statusCode?: number): Response<any, Record<string, any>>;
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
    ErrorCodes: typeof ErrorCodes;
    K33PError: typeof K33PError;
    ResponseUtils: typeof ResponseUtils;
    globalErrorHandler: (error: any, req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=error-handler.d.ts.map