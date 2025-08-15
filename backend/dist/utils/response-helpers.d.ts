/**
 * Response Helper Utilities for K33P Backend
 * Provides consistent response formatting and validation error handling
 */
import { Response } from 'express';
import { ErrorCodes } from '../middleware/error-handler.js';
/**
 * Handle validation errors from express-validator
 */
export declare const handleValidationErrorsMiddleware: (req: any, res: Response, next: any) => Response<any, Record<string, any>> | undefined;
/**
 * Wrapper for async route handlers to catch errors
 */
export declare const asyncRoute: (fn: Function) => (req: any, res: Response, next: any) => void;
export declare function handleValidationErrors(errors: any[]): never;
export declare function createSuccessResponse(data: any, message?: string): Response<any, Record<string, any>>;
export declare function createErrorResponse(code: ErrorCodes, message?: string, details?: string): void;
export declare function handleUserAlreadyExists(details?: string): never;
export declare function handlePhoneAlreadyExists(details?: string): never;
export declare function handleWalletAlreadyExists(details?: string): never;
export declare function handleRefundFailed(details?: string): never;
/**
 * Check if user exists and handle common user-related errors
 */
export declare const checkUserExists: (userLookupFn: Function, identifier: string, identifierType?: "phone" | "wallet" | "userId") => Promise<any>;
/**
 * Check for duplicate user registration
 */
export declare const checkDuplicateUser: (userLookupFn: Function, phoneNumber?: string, walletAddress?: string) => Promise<void>;
/**
 * Check user signup and refund status
 */
export declare const checkUserStatus: (user: any, checkRefundStatus?: boolean) => Promise<void>;
/**
 * Validate wallet address format
 */
export declare const validateWalletAddress: (walletAddress: string) => boolean;
/**
 * Validate phone number format
 */
export declare const validatePhoneNumber: (phoneNumber: string) => boolean;
/**
 * Handle refund-specific errors
 */
export declare const handleRefundError: (error: any, user?: any) => never;
/**
 * Handle transaction verification errors
 */
export declare const handleTransactionError: (error: any) => never;
/**
 * Log user action for audit trail
 */
export declare const logUserAction: (userId: string, action: string, details?: any, success?: boolean) => void;
/**
 * Rate limiting error handler
 */
export declare const handleRateLimitError: (req: any, res: Response) => Response<any, Record<string, any>>;
/**
 * Database connection error handler
 */
export declare const handleDatabaseError: (error: any) => never;
/**
 * External service error handler
 */
export declare const handleExternalServiceError: (serviceName: string, error: any) => never;
declare const _default: {
    handleValidationErrorsMiddleware: (req: any, res: Response, next: any) => Response<any, Record<string, any>> | undefined;
    handleValidationErrors: typeof handleValidationErrors;
    createSuccessResponse: typeof createSuccessResponse;
    createErrorResponse: typeof createErrorResponse;
    asyncRoute: (fn: Function) => (req: any, res: Response, next: any) => void;
    checkUserExists: (userLookupFn: Function, identifier: string, identifierType?: "phone" | "wallet" | "userId") => Promise<any>;
    checkDuplicateUser: (userLookupFn: Function, phoneNumber?: string, walletAddress?: string) => Promise<void>;
    checkUserStatus: (user: any, checkRefundStatus?: boolean) => Promise<void>;
    validateWalletAddress: (walletAddress: string) => boolean;
    validatePhoneNumber: (phoneNumber: string) => boolean;
    handleRefundError: (error: any, user?: any) => never;
    handleTransactionError: (error: any) => never;
    logUserAction: (userId: string, action: string, details?: any, success?: boolean) => void;
    handleRateLimitError: (req: any, res: Response) => Response<any, Record<string, any>>;
    handleDatabaseError: (error: any) => never;
    handleExternalServiceError: (serviceName: string, error: any) => never;
    handleUserAlreadyExists: typeof handleUserAlreadyExists;
    handlePhoneAlreadyExists: typeof handlePhoneAlreadyExists;
    handleWalletAlreadyExists: typeof handleWalletAlreadyExists;
    handleRefundFailed: typeof handleRefundFailed;
};
export default _default;
//# sourceMappingURL=response-helpers.d.ts.map