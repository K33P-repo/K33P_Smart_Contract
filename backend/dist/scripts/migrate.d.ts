#!/usr/bin/env ts-node
/**
 * Database Migration Script
 * This script migrates existing JSON data to PostgreSQL database
 */
declare function migrateData(): Promise<void>;
declare function runSpecificMigration(migrationType?: 'all' | 'auth' | 'json' | 'health'): Promise<void>;
declare function showUsage(): Promise<void>;
export { migrateData, runSpecificMigration, showUsage };
//# sourceMappingURL=migrate.d.ts.map