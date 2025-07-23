import { Pool } from 'pg';
declare const pool: Pool;
export declare const createTables: () => Promise<boolean>;
export declare const testConnection: () => Promise<boolean>;
export declare const closePool: () => Promise<void>;
export default pool;
//# sourceMappingURL=config.d.ts.map