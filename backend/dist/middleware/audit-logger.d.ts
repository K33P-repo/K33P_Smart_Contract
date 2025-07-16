import { Request, Response, NextFunction } from 'express';
export declare const auditLogger: (action: string, resource: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const auditSeedPhraseAccess: (req: Request, res: Response, next: NextFunction) => void;
export declare const auditSeedPhraseStore: (req: Request, res: Response, next: NextFunction) => void;
export declare const auditSeedPhraseRetrieve: (req: Request, res: Response, next: NextFunction) => void;
export declare const auditUserLogin: (req: Request, res: Response, next: NextFunction) => void;
export declare const auditUserRegistration: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=audit-logger.d.ts.map