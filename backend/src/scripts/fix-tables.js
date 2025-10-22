import { createTables } from '../database/config.js';

async function fixTables() {
  console.log('🔧 Fixing missing database tables...');
  try {
    const success = await createTables();
    if (success) {
      console.log('✅ All tables created successfully');
    } else {
      console.log('❌ Failed to create tables');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixTables();
