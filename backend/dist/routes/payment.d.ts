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
//# sourceMappingURL=payment.d.ts.map