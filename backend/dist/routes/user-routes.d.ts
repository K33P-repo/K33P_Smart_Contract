/**
 * User Routes for K33P Backend
 * Handles user authentication, profile management, and user-related operations
 * Includes biometric authentication, OTP verification, and wallet management
 */
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                [key: string]: any;
            };
        }
    }
}
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=user-routes.d.ts.map