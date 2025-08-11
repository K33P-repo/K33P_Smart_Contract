#!/usr/bin/env node
/**
 * Database Setup Script for K33P Smart Contract
 * This script helps users set up PostgreSQL database for the project
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(question) {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function checkPostgreSQL() {
  try {
    execSync('psql --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function checkNodeModules() {
  return fs.existsSync(path.join(__dirname, 'node_modules'));
}

async function createEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  if (fs.existsSync(envPath)) {
    log('✅ .env file already exists', 'green');
    return;
  }
  
  if (!fs.existsSync(envExamplePath)) {
    log('❌ .env.example file not found', 'red');
    return;
  }
  
  log('📝 Creating .env file from .env.example...', 'cyan');
  
  // Read .env.example
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // Ask for database configuration
  log('\n🔧 Database Configuration:', 'bright');
  
  const dbHost = await askQuestion('Database Host (default: localhost): ') || 'localhost';
  const dbPort = await askQuestion('Database Port (default: 5432): ') || '5432';
  const dbName = await askQuestion('Database Name (default: k33p_db): ') || 'k33p_db';
  const dbUser = await askQuestion('Database User (default: postgres): ') || 'postgres';
  const dbPassword = await askQuestion('Database Password: ');
  
  // Update database configuration in env content
  envContent = envContent.replace(/DB_HOST=.*/, `DB_HOST=${dbHost}`);
  envContent = envContent.replace(/DB_PORT=.*/, `DB_PORT=${dbPort}`);
  envContent = envContent.replace(/DB_NAME=.*/, `DB_NAME=${dbName}`);
  envContent = envContent.replace(/DB_USER=.*/, `DB_USER=${dbUser}`);
  envContent = envContent.replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${dbPassword}`);
  
  // Write .env file
  fs.writeFileSync(envPath, envContent);
  log('✅ .env file created successfully', 'green');
}

async function setupDatabase() {
  log('\n🚀 K33P Smart Contract - PostgreSQL Database Setup', 'bright');
  log('=' .repeat(60), 'cyan');
  
  // Check prerequisites
  log('\n🔍 Checking prerequisites...', 'cyan');
  
  if (!checkPostgreSQL()) {
    log('❌ PostgreSQL is not installed or not in PATH', 'red');
    log('Please install PostgreSQL and make sure psql command is available', 'yellow');
    log('Download from: https://www.postgresql.org/download/', 'blue');
    process.exit(1);
  }
  log('✅ PostgreSQL is installed', 'green');
  
  if (!checkNodeModules()) {
    log('❌ Node modules not installed', 'red');
    log('Please run "npm install" first', 'yellow');
    process.exit(1);
  }
  log('✅ Node modules are installed', 'green');
  
  // Create .env file
  await createEnvFile();
  
  // Install dependencies if needed
  log('\n📦 Installing PostgreSQL dependencies...', 'cyan');
  try {
    execSync('npm install pg @types/pg', { stdio: 'inherit' });
    log('✅ Dependencies installed successfully', 'green');
  } catch (error) {
    log('❌ Failed to install dependencies', 'red');
    console.error(error.message);
    process.exit(1);
  }
  
  // Initialize database
  log('\n🗄️  Initializing database schema...', 'cyan');
  try {
    execSync('npm run db:init', { stdio: 'inherit' });
    log('✅ Database schema initialized successfully', 'green');
  } catch (error) {
    log('❌ Failed to initialize database schema', 'red');
    log('Please check your database connection settings in .env file', 'yellow');
    console.error(error.message);
    process.exit(1);
  }
  
  // Check for existing JSON data
  const userDepositsPath = path.join(__dirname, 'user-deposits.json');
  const mockDbPath = path.join(__dirname, 'mock-db.json');
  
  if (fs.existsSync(userDepositsPath) || fs.existsSync(mockDbPath)) {
    log('\n📊 Found existing JSON data files', 'yellow');
    const migrate = await askQuestion('Do you want to migrate existing data to PostgreSQL? (y/N): ');
    
    if (migrate.toLowerCase() === 'y' || migrate.toLowerCase() === 'yes') {
      log('\n🔄 Migrating existing data...', 'cyan');
      try {
        execSync('npm run db:migrate', { stdio: 'inherit' });
        log('✅ Data migration completed successfully', 'green');
      } catch (error) {
        log('❌ Failed to migrate data', 'red');
        console.error(error.message);
      }
    }
  }
  
  // Success message
  log('\n🎉 Database setup completed successfully!', 'bright');
  log('=' .repeat(60), 'cyan');
  log('\n📋 Next steps:', 'bright');
  log('1. Start your application: npm start', 'blue');
  log('2. The application will now use PostgreSQL instead of JSON files', 'blue');
  log('3. You can reset the database anytime with: npm run db:reset', 'blue');
  log('\n📚 Available database commands:', 'bright');
  log('• npm run db:init   - Initialize database schema', 'blue');
  log('• npm run db:migrate - Migrate data from JSON files', 'blue');
  log('• npm run db:reset   - Reset database (WARNING: deletes all data)', 'blue');
  log('\n🔗 Database connection details are stored in your .env file', 'yellow');
}

// Run the setup
setupDatabase().catch((error) => {
  log('\n❌ Setup failed:', 'red');
  console.error(error);
  process.exit(1);
});