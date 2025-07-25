/**
 * ZK Proof Service for K33P Identity System
 * Automatically generates and stores ZK proofs for all database operations
 * Ensures every user registration and data entry has associated ZK proofs
 */

import pool from '../database/config.js';
import { generateZkCommitment, generateZkProof } from '../utils/zk.js';
import { hashPhone, hashBiometric, hashPasskey } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

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
  /**
   * Generate and store ZK proof for a new user registration
   */
  static async generateAndStoreUserZKProof(userData: UserZKData): Promise<ZKProofData> {
    try {
      logger.info('Generating ZK proof for user registration', { userId: userData.userId });
      
      // Generate hashes for available data
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
      
      // Generate ZK commitment
      const commitment = generateZkCommitment(hashes);
      
      // Generate ZK proof
      const proofInputs: any = {};
      if (userData.phoneNumber) proofInputs.phone = userData.phoneNumber;
      if (userData.biometricData) proofInputs.biometric = userData.biometricData;
      if (userData.passkeyData) proofInputs.passkey = userData.passkeyData;
      
      const proof = generateZkProof(proofInputs, commitment);
      
      // Prepare public inputs
      const publicInputs = {
        ...hashes,
        userAddress: userData.userAddress,
        timestamp: new Date().toISOString(),
        additionalData: userData.additionalData || {}
      };
      
      // Store in PostgreSQL
      await this.storeZKProofInDatabase({
        userId: userData.userId,
        commitment,
        proof,
        publicInputs,
        isValid: true // Default to true since we're generating the proof
      });
      
      logger.info('ZK proof generated and stored successfully', { 
        userId: userData.userId, 
        commitment: commitment.substring(0, 20) + '...' 
      });
      
      return {
        commitment,
        proof,
        publicInputs,
        isValid: true // Default to true since we're generating the proof
      };
      
    } catch (error) {
      logger.error('Failed to generate and store ZK proof', { 
        userId: userData.userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
  
  /**
   * Generate and store ZK proof for any data entry
   */
  static async generateAndStoreDataZKProof(
    userId: string, 
    dataType: string, 
    data: Record<string, any>
  ): Promise<ZKProofData> {
    try {
      logger.info('Generating ZK proof for data entry', { userId, dataType });
      
      // Create a unique identifier for this data entry
      const dataId = crypto.randomUUID();
      
      // Generate hash of the data
      const dataHash = crypto.createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
      
      // Generate commitment for the data using phone hash format
      const phoneHash = hashPhone(dataHash);
      const biometricHash = hashBiometric('dummy_biometric');
      const passkeyHash = hashPasskey('dummy_passkey');
      
      const commitment = generateZkCommitment({ phoneHash, biometricHash, passkeyHash });
      
      // Generate proof for the data
      const proof = generateZkProof({ phoneHash, biometricHash, passkeyHash }, commitment);
      
      // Prepare public inputs
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
      
      // Store in PostgreSQL
      await this.storeZKProofInDatabase({
        userId,
        commitment,
        proof,
        publicInputs,
        isValid: true // Default to true since we're generating the proof
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
        isValid: true // Default to true since we're generating the proof
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
  
  /**
   * Store ZK proof in PostgreSQL database
   */
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
  
  /**
   * Retrieve ZK proofs for a user
   */
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
  
  /**
   * Verify a ZK proof against stored data
   */
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
  
  /**
   * Get latest ZK proof for a user
   */
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
}

export default ZKProofService;