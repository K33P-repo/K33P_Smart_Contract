import dotenv from 'dotenv';
import { DatabaseManager } from './models.js';
// Load environment variables
dotenv.config();
async function main() {
    try {
        console.log('🚀 Running database migrations...\n');
        await DatabaseManager.runNotificationMigration();
        console.log('\n🎉 All migrations completed successfully!');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=run-migration.js.map