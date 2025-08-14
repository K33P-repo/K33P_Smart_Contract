import { Pool } from 'pg';
import dotenv from 'dotenv';
import { hashPhone } from './dist/utils/hash.js';
import { verifyZkProof } from './dist/utils/zk.js';

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'k33p_database',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_HOST?.includes('render.com') || process.env.DB_HOST?.includes('railway') ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(dbConfig);

// Replicate the exact login flow
async function findUserInPostgres(query) {
  const client = await pool.connect();
  try {
    let user = null;
    
    if (query.walletAddress) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE wallet_address = $1',
        [query.walletAddress]
      );
      user = result.rows[0] || null;
    } else if (query.phoneHash) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE phone_hash = $1',
        [query.phoneHash]
      );
      user = result.rows[0] || null;
    } else if (query.userId) {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment" FROM users WHERE user_id = $1',
        [query.userId]
      );
      user = result.rows[0] || null;
    }
    
    return user;
  } finally {
    client.release();
  }
}

async function debugLogin() {
  try {
    console.log('🔗 Connecting to database...');
    
    // Test data from the curl request
    const phone = '5631543289236';
    const proof = {
      proof: '0x1a2b3c4d5e6f7890abcdef1234567890fedcba0987654321',
      publicInputs: {
        commitment: '0766668078b1646d0df085f6e9f3cf6c43021ad7e523026220'
      },
      isValid: true
    };
    const commitment = '0766668078b1646d0df085f6e9f3cf6c43021ad7e523026220';
    
    console.log('\n📱 Debug Login Flow');
    console.log('Phone:', phone);
    console.log('Commitment:', commitment);
    console.log('Proof:', JSON.stringify(proof, null, 2));
    
    // Step 1: Calculate phone hash
    console.log('\n🔍 Step 1: Calculate phone hash');
    const phoneHash = hashPhone(phone);
    console.log('Calculated phone hash:', phoneHash);
    
    // Step 2: Find user
    console.log('\n🔍 Step 2: Find user in database');
    let user;
    try {
      user = await findUserInPostgres({ phoneHash });
      console.log('User found:', user ? 'YES' : 'NO');
      if (user) {
        console.log('User details:', {
          userId: user.userId,
          walletAddress: user.walletAddress,
          phoneHash: user.phoneHash,
          zkCommitment: user.zkCommitment
        });
      }
    } catch (error) {
      console.error('Error finding user:', error.message);
      return;
    }
    
    // Step 3: Check if user exists
    if (!user) {
      console.log('\n❌ User not found - this is where the login fails');
      return;
    }
    
    // Step 4: Verify ZK proof
    console.log('\n🔍 Step 3: Verify ZK proof');
    try {
      const isValid = verifyZkProof(proof, commitment);
      console.log('Proof verification result:', isValid);
      
      if (!isValid) {
        console.log('❌ Proof verification failed');
        return;
      }
    } catch (error) {
      console.error('Error verifying proof:', error.message);
      return;
    }
    
    // Step 5: Check commitment match
    console.log('\n🔍 Step 4: Check commitment match');
    console.log('Provided commitment:', commitment);
    console.log('Stored commitment:', user.zkCommitment);
    console.log('Commitments match:', user.zkCommitment === commitment);
    
    console.log('\n✅ Login should succeed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
    console.log('\n🔚 Database connection closed');
  }
}

debugLogin();