/**
 * Image Number Routes for K33P Backend
 * Handles user image number management (profile avatar selection)
 * Image numbers: 1, 2, or 3 (for different avatar styles)
 */
declare const router: import("express-serve-static-core").Router;
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
export default router;
//# sourceMappingURL=image-number-routes.d.ts.map