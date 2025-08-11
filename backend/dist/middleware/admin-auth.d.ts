/**
 * Admin Authentication Middleware for K33P Backend
 * Validates X-API-KEY header against ADMIN_API_KEY environment variable
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Middleware to authenticate admin requests using X-API-KEY header
 */
export declare const authenticateAdmin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
declare const _default: {
    authenticateAdmin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
};
export default _default;
//# sourceMappingURL=admin-auth.d.ts.map