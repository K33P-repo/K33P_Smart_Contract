/**
 * Seed Phrase Storage and NOK Access Routes for K33P
 * Handles secure storage of 12/24-word seed phrases on Iagon and NOK inheritance
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
//# sourceMappingURL=seed-phrase-routes.d.ts.map