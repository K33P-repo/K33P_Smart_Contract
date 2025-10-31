import pool from '../database/config.js';
import { generateZkCommitment, generateZkProof } from '../utils/zk.js';
import { hashPhone, hashBiometric, hashPasskey } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';
import { QueryResult } from 'pg';

export interface ZKProofData {
  commitment: string;
  proof: any;
  publicInputs: any;
  isValid: boolean;
}

export interface UserZKData {
  userId: string;
  phoneNumber?: string;
  biometricData?: string;
  passkeyData?: string;
  userAddress?: string;
  additionalData?: Record<string, any>;
}

export class ZKProofService {
  static async generateAndStoreUserZKProof(userData: UserZKData): Promise<ZKProofData> {
    try {
      logger.info('Generating ZK proof for user registration', { userId: userData.userId });
      
      const hashes: any = {};
      
      if (userData.phoneNumber) {
        hashes.phoneHash = hashPhone(userData.phoneNumber);
      }
      
      if (userData.biometricData) {
        hashes.biometricHash = hashBiometric(userData.biometricData);
      }
      
      if (userData.passkeyData) {
        hashes.passkeyHash = hashPasskey(userData.passkeyData);
      }
      
      const commitment = generateZkCommitment(hashes);
      
      const proofInputs: any = {};
      if (userData.phoneNumber) proofInputs.phone = userData.phoneNumber;
      if (userData.biometricData) proofInputs.biometric = userData.biometricData;
      if (userData.passkeyData) proofInputs.passkey = userData.passkeyData;
      
      const proof = generateZkProof(proofInputs, commitment);
      
      const publicInputs = {
        ...hashes,
        userAddress: userData.userAddress,
        timestamp: new Date().toISOString(),
        additionalData: userData.additionalData || {}
      };
      
      await this.storeZKProofInDatabase({
        userId: userData.userId,
        commitment,
        proof,
        publicInputs,
        isValid: true
      });
      
      logger.info('ZK proof generated and stored successfully', { 
        userId: userData.userId, 
        commitment: commitment.substring(0, 20) + '...' 
      });
      
      return {
        commitment,
        proof,
        publicInputs,
        isValid: true
      };
      
    } catch (error) {
      logger.error('Failed to generate and store ZK proof', { 
        userId: userData.userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
  
  static async generateAndStoreDataZKProof(
    userId: string, 
    dataType: string, 
    data: Record<string, any>
  ): Promise<ZKProofData> {
    try {
      logger.info('Generating ZK proof for data entry', { userId, dataType });
      
      const dataId = crypto.randomUUID();
      
      const dataHash = crypto.createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
      
      const phoneHash = hashPhone(dataHash);
      const biometricHash = hashBiometric('dummy_biometric');
      const passkeyHash = hashPasskey('dummy_passkey');
      
      const commitment = generateZkCommitment({ phoneHash, biometricHash, passkeyHash });
      
      const proof = generateZkProof({ phone: dataHash, biometric: 'dummy_biometric', passkey: 'dummy_passkey' }, commitment);
      
      const publicInputs = {
        dataId,
        dataType,
        dataHash,
        timestamp: new Date().toISOString(),
        metadata: {
          dataSize: JSON.stringify(data).length,
          fields: Object.keys(data)
        }
      };
      
      await this.storeZKProofInDatabase({
        userId,
        commitment,
        proof,
        publicInputs,
        isValid: true
      });
      
      logger.info('Data ZK proof generated and stored successfully', { 
        userId, 
        dataType, 
        dataId,
        commitment: commitment.substring(0, 20) + '...' 
      });
      
      return {
        commitment,
        proof,
        publicInputs,
        isValid: true
      };
      
    } catch (error) {
      logger.error('Failed to generate and store data ZK proof', { 
        userId, 
        dataType, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
  
  private static async storeZKProofInDatabase(zkData: {
    userId: string;
    commitment: string;
    proof: any;
    publicInputs: any;
    isValid: boolean;
  }): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query(
        'INSERT INTO zk_proofs (user_id, commitment, proof, public_inputs, is_valid, verified_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          zkData.userId,
          zkData.commitment,
          JSON.stringify(zkData.proof),
          JSON.stringify(zkData.publicInputs),
          zkData.isValid,
          new Date()
        ]
      );
    } finally {
      client.release();
    }
  }
  
  static async getUserZKProofs(userId: string): Promise<any[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM zk_proofs WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        commitment: row.commitment,
        proof: typeof row.proof === 'string' ? JSON.parse(row.proof) : row.proof,
        publicInputs: typeof row.public_inputs === 'string' ? JSON.parse(row.public_inputs) : row.public_inputs,
        isValid: row.is_valid,
        createdAt: row.created_at,
        verifiedAt: row.verified_at
      }));
    } finally {
      client.release();
    }
  }
  
  static async verifyStoredZKProof(userId: string, commitment: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT is_valid FROM zk_proofs WHERE user_id = $1 AND commitment = $2',
        [userId, commitment]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      return result.rows[0].is_valid;
    } finally {
      client.release();
    }
  }
  
  static async getLatestUserZKProof(userId: string): Promise<any | null> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM zk_proofs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        commitment: row.commitment,
        proof: typeof row.proof === 'string' ? JSON.parse(row.proof) : row.proof,
        publicInputs: typeof row.public_inputs === 'string' ? JSON.parse(row.public_inputs) : row.public_inputs,
        isValid: row.is_valid,
        createdAt: row.created_at,
        verifiedAt: row.verified_at
      };
    } finally {
      client.release();
    }
  }
  
  static async getUserByPhoneHash(phoneHash: string): Promise<any | null> {
    const client = await pool.connect();
    
    try {
      console.log('🔍 getUserByPhoneHash called with hash:', phoneHash ? `${phoneHash.substring(0, 20)}...` : 'null');
      
      if (!phoneHash || typeof phoneHash !== 'string') {
        console.log('❌ Invalid phone hash');
        return null;
      }
      
      console.log('✅ Querying database with hash...');
      
      const result: QueryResult = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment", auth_methods as "authMethods", verification_method as "verificationMethod", verified FROM users WHERE phone_hash = $1',
        [phoneHash]
      );
      
      console.log(`📊 Database query returned ${result.rows.length} rows`);
      
      if (result.rows.length === 0) {
        console.log('✅ No existing user found with this phone hash');
        return null;
      }
      
      const row = result.rows[0];
      console.log('✅ Found existing user:', row.userId);
      
      return {
        user_id: row.userId,
        wallet_address: row.walletAddress,
        phone_hash: row.phoneHash,
        zk_commitment: row.zkCommitment,
        auth_methods: row.authMethods,
        verification_method: row.verificationMethod,
        verified: row.verified
      };
    } catch (error: unknown) {
      // ... error handling
    } finally {
      client.release();
    }
  }

  static async getUserById(userId: string): Promise<any | null> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment", auth_methods as "authMethods", verification_method as "verificationMethod", verified FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        user_id: row.userId,
        wallet_address: row.walletAddress,
        phone_hash: row.phoneHash,
        zk_commitment: row.zkCommitment,
        auth_methods: row.authMethods,
        verification_method: row.verificationMethod,
        verified: row.verified
      };
    } finally {
      client.release();
    }
  }

  static async getUserByWalletAddress(walletAddress: string): Promise<any | null> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment", auth_methods as "authMethods", verification_method as "verificationMethod", verified FROM users WHERE wallet_address = $1',
        [walletAddress]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        user_id: row.userId,
        wallet_address: row.walletAddress,
        phone_hash: row.phoneHash,
        zk_commitment: row.zkCommitment,
        auth_methods: row.authMethods,
        verification_method: row.verificationMethod,
        verified: row.verified
      };
    } finally {
      client.release();
    }
  }

  static async createUser(userData: {
    userId: string;
    walletAddress?: string;
    phoneHash: string;
    zkCommitment: string;
    authMethods: any[];
    verificationMethod: string;
  }): Promise<any> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'INSERT INTO users (user_id, wallet_address, phone_hash, zk_commitment, auth_methods, verification_method, verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment", auth_methods as "authMethods", verification_method as "verificationMethod", verified',
        [
          userData.userId,
          userData.walletAddress,
          userData.phoneHash,
          userData.zkCommitment,
          userData.authMethods,
          userData.verificationMethod,
          false
        ]
      );
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async updateUser(userId: string, updates: any): Promise<any> {
    const client = await pool.connect();
    
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = Object.values(updates);
      
      const result = await client.query(
        `UPDATE users SET ${setClause} WHERE user_id = $1 RETURNING user_id as "userId", wallet_address as "walletAddress", phone_hash as "phoneHash", zk_commitment as "zkCommitment", auth_methods as "authMethods", verification_method as "verificationMethod", verified`,
        [userId, ...values]
      );
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

export default ZKProofService;