/**
 * Storage Abstraction Layer for K33P
 * Provides unified interface for data storage with Iagon as primary and PostgreSQL as fallback
 * Handles automatic failover, data synchronization, and storage health monitoring
 */

import { logger } from '../utils/logger.js';
import pool from '../database/config.js';
import { storeData, retrieveData, updateData, deleteData } from '../utils/iagon.js';
import crypto from 'crypto';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface StorageConfig {
  primaryStorage: 'iagon' | 'postgresql';
  enableFallback: boolean;
  syncBetweenStorages: boolean;
  healthCheckInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  storageUsed: 'iagon' | 'postgresql' | 'both';
  syncStatus?: 'synced' | 'pending' | 'failed';
}

export interface StorageHealthStatus {
  iagon: {
    available: boolean;
    responseTime?: number;
    lastError?: string;
    lastChecked: Date;
  };
  postgresql: {
    available: boolean;
    responseTime?: number;
    lastError?: string;
    lastChecked: Date;
  };
}

export interface UserData {
  id: string;
  userId: string;
  email?: string;
  name?: string;
  walletAddress: string;
  phoneHash: string;
  zkCommitment?: string;
  senderWalletAddress?: string;
  txHash?: string;
  verified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDeposit {
  id: string;
  userAddress: string;
  userId: string;
  phoneHash: string;
  zkProof?: string;
  zkCommitment?: string;
  txHash?: string;
  amount: number;
  timestamp: Date;
  refunded: boolean;
  signupCompleted: boolean;
  verified: boolean;
  verificationAttempts: number;
  lastVerificationAttempt?: Date;
  pinHash?: string;
  biometricHash?: string;
  biometricType?: string;
  verificationMethod?: string;
  refundTxHash?: string;
  refundTimestamp?: Date;
  senderWalletAddress?: string;
  createdAt: Date;
}

// ============================================================================
// STORAGE ABSTRACTION SERVICE CLASS
// ============================================================================

export class StorageAbstractionService {
  private config: StorageConfig;
  private healthStatus: StorageHealthStatus;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      primaryStorage: 'iagon',
      enableFallback: true,
      syncBetweenStorages: false,
      healthCheckInterval: 60000, // 1 minute
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.healthStatus = {
      iagon: {
        available: false,
        lastChecked: new Date()
      },
      postgresql: {
        available: false,
        lastChecked: new Date()
      }
    };

    this.startHealthMonitoring();
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  private async startHealthMonitoring(): Promise<void> {
    // Initial health check
    await this.checkStorageHealth();

    // Set up periodic health checks
    this.healthCheckTimer = setInterval(async () => {
      await this.checkStorageHealth();
    }, this.config.healthCheckInterval);

    logger.info('Storage health monitoring started', {
      service: 'storage-abstraction',
      interval: this.config.healthCheckInterval
    });
  }

  private async checkStorageHealth(): Promise<void> {
    // Check Iagon health
    const iagonStart = Date.now();
    try {
      // Test Iagon with a simple operation
      await storeData('health_check_' + Date.now(), JSON.stringify({ test: true }));
      this.healthStatus.iagon = {
        available: true,
        responseTime: Date.now() - iagonStart,
        lastChecked: new Date()
      };
      logger.debug('Iagon storage health check passed', { service: 'storage-abstraction' });
    } catch (error: any) {
      this.healthStatus.iagon = {
        available: false,
        lastError: error.message,
        lastChecked: new Date()
      };
      logger.warn('Iagon storage health check failed', {
        service: 'storage-abstraction',
        error: error.message
      });
    }

    // Check PostgreSQL health
    const pgStart = Date.now();
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.healthStatus.postgresql = {
        available: true,
        responseTime: Date.now() - pgStart,
        lastChecked: new Date()
      };
      logger.debug('PostgreSQL storage health check passed', { service: 'storage-abstraction' });
    } catch (error: any) {
      this.healthStatus.postgresql = {
        available: false,
        lastError: error.message,
        lastChecked: new Date()
      };
      logger.warn('PostgreSQL storage health check failed', {
        service: 'storage-abstraction',
        error: error.message
      });
    }
  }

  public getHealthStatus(): StorageHealthStatus {
    return { ...this.healthStatus };
  }

  // ============================================================================
  // STORAGE SELECTION LOGIC
  // ============================================================================

  private selectStorage(): 'iagon' | 'postgresql' {
    if (this.config.primaryStorage === 'iagon' && this.healthStatus.iagon.available) {
      return 'iagon';
    }
    
    if (this.config.primaryStorage === 'postgresql' && this.healthStatus.postgresql.available) {
      return 'postgresql';
    }

    // Fallback logic
    if (this.config.enableFallback) {
      if (this.healthStatus.iagon.available) {
        return 'iagon';
      }
      if (this.healthStatus.postgresql.available) {
        return 'postgresql';
      }
    }

    // Default to primary even if unhealthy (will likely fail but allows for error handling)
    return this.config.primaryStorage;
  }

  // ============================================================================
  // RETRY LOGIC
  // ============================================================================

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        logger.warn(`${operationName} attempt ${attempt} failed`, {
          service: 'storage-abstraction',
          error: error.message,
          attempt,
          maxAttempts: this.config.retryAttempts
        });

        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    throw lastError!;
  }

  // ============================================================================
  // IAGON STORAGE OPERATIONS
  // ============================================================================

  private async storeInIagon(key: string, data: any): Promise<string> {
    const jsonData = JSON.stringify(data);
    return await storeData(key, jsonData);
  }

  private async retrieveFromIagon(key: string): Promise<any> {
    const jsonData = await retrieveData(key);
    return JSON.parse(jsonData);
  }

  private async updateInIagon(key: string, data: any): Promise<void> {
    const jsonData = JSON.stringify(data);
    await updateData(key, jsonData);
  }

  private async deleteFromIagon(key: string): Promise<void> {
    await deleteData(key);
  }

  // ============================================================================
  // POSTGRESQL STORAGE OPERATIONS
  // ============================================================================

  private async storeInPostgreSQL(tableName: string, data: any): Promise<string> {
    const client = await pool.connect();
    try {
      let query: string;
      let values: any[];
      
      if (tableName === 'users') {
        query = `
          INSERT INTO users (user_id, email, name, wallet_address, phone_hash, zk_commitment, sender_wallet_address, tx_hash, verified)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `;
        values = [
          data.userId,
          data.email,
          data.name,
          data.walletAddress,
          data.phoneHash,
          data.zkCommitment,
          data.senderWalletAddress,
          data.txHash,
          data.verified || false
        ];
      } else if (tableName === 'user_deposits') {
        query = `
          INSERT INTO user_deposits (
            user_address, user_id, phone_hash, zk_proof, zk_commitment, tx_hash, amount,
            refunded, signup_completed, verified, verification_attempts, pin_hash,
            biometric_hash, biometric_type, verification_method, sender_wallet_address
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id
        `;
        values = [
          data.userAddress,
          data.userId,
          data.phoneHash,
          data.zkProof,
          data.zkCommitment,
          data.txHash,
          data.amount || 0,
          data.refunded || false,
          data.signupCompleted || false,
          data.verified || false,
          data.verificationAttempts || 0,
          data.pinHash,
          data.biometricHash,
          data.biometricType,
          data.verificationMethod,
          data.senderWalletAddress
        ];
      } else {
        throw new Error(`Unsupported table: ${tableName}`);
      }

      const result = await client.query(query, values);
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  private async retrieveFromPostgreSQL(tableName: string, query: any): Promise<any[]> {
    const client = await pool.connect();
    try {
      let sqlQuery: string;
      let values: any[];
      
      if (tableName === 'users') {
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (query.userId) {
          conditions.push(`user_id = $${paramIndex++}`);
          params.push(query.userId);
        }
        if (query.walletAddress) {
          conditions.push(`wallet_address = $${paramIndex++}`);
          params.push(query.walletAddress);
        }
        if (query.phoneHash) {
          conditions.push(`phone_hash = $${paramIndex++}`);
          params.push(query.phoneHash);
        }

        sqlQuery = `SELECT * FROM users${conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''}`;
        values = params;
      } else if (tableName === 'user_deposits') {
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (query.userId) {
          conditions.push(`user_id = $${paramIndex++}`);
          params.push(query.userId);
        }
        if (query.userAddress) {
          conditions.push(`user_address = $${paramIndex++}`);
          params.push(query.userAddress);
        }
        if (query.txHash) {
          conditions.push(`tx_hash = $${paramIndex++}`);
          params.push(query.txHash);
        }

        sqlQuery = `SELECT * FROM user_deposits${conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''}`;
        values = params;
      } else {
        throw new Error(`Unsupported table: ${tableName}`);
      }

      const result = await client.query(sqlQuery, values);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private async updateInPostgreSQL(tableName: string, id: string, data: any): Promise<void> {
    const client = await pool.connect();
    try {
      let query: string;
      let values: any[];
      
      if (tableName === 'users') {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (data.email !== undefined) {
          updates.push(`email = $${paramIndex++}`);
          params.push(data.email);
        }
        if (data.name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          params.push(data.name);
        }
        if (data.walletAddress !== undefined) {
          updates.push(`wallet_address = $${paramIndex++}`);
          params.push(data.walletAddress);
        }
        if (data.senderWalletAddress !== undefined) {
          updates.push(`sender_wallet_address = $${paramIndex++}`);
          params.push(data.senderWalletAddress);
        }
        if (data.txHash !== undefined) {
          updates.push(`tx_hash = $${paramIndex++}`);
          params.push(data.txHash);
        }
        if (data.verified !== undefined) {
          updates.push(`verified = $${paramIndex++}`);
          params.push(data.verified);
        }

        updates.push(`updated_at = $${paramIndex++}`);
        params.push(new Date());
        params.push(id);

        query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
        values = params;
      } else {
        throw new Error(`Unsupported table: ${tableName}`);
      }

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  private async deleteFromPostgreSQL(tableName: string, id: string): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `DELETE FROM ${tableName} WHERE id = $1`;
      await client.query(query, [id]);
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  public async storeUser(userData: Omit<UserData, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<{ id: string }>> {
    const selectedStorage = this.selectStorage();
    
    try {
      const result = await this.withRetry(async () => {
        if (selectedStorage === 'iagon') {
          const key = `user_${userData.userId}`;
          const dataWithTimestamps = {
            ...userData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date()
          };
          const storageId = await this.storeInIagon(key, dataWithTimestamps);
          return { id: storageId };
        } else {
          const id = await this.storeInPostgreSQL('users', userData);
          return { id };
        }
      }, 'storeUser');

      logger.info('User stored successfully', {
        service: 'storage-abstraction',
        userId: userData.userId,
        storage: selectedStorage
      });

      return {
        success: true,
        data: result,
        storageUsed: selectedStorage
      };
    } catch (error: any) {
      logger.error('Failed to store user', {
        service: 'storage-abstraction',
        userId: userData.userId,
        storage: selectedStorage,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        storageUsed: selectedStorage
      };
    }
  }

  public async findUser(query: { userId?: string; walletAddress?: string; phoneHash?: string }): Promise<StorageResult<UserData | null>> {
    const selectedStorage = this.selectStorage();
    
    try {
      const result = await this.withRetry(async () => {
        if (selectedStorage === 'iagon') {
          if (query.userId) {
            const key = `user_${query.userId}`;
            return await this.retrieveFromIagon(key);
          } else {
            // For non-userId queries, we'd need to implement indexing or search
            // For now, fall back to PostgreSQL
            throw new Error('Iagon storage requires userId for user lookup');
          }
        } else {
          const results = await this.retrieveFromPostgreSQL('users', query);
          return results.length > 0 ? results[0] : null;
        }
      }, 'findUser');

      return {
        success: true,
        data: result,
        storageUsed: selectedStorage
      };
    } catch (error: any) {
      logger.error('Failed to find user', {
        service: 'storage-abstraction',
        query,
        storage: selectedStorage,
        error: error.message
      });

      // Try fallback if enabled and primary failed
      if (this.config.enableFallback && selectedStorage === 'iagon') {
        try {
          const results = await this.retrieveFromPostgreSQL('users', query);
          const result = results.length > 0 ? results[0] : null;
          
          logger.info('User found using fallback storage', {
            service: 'storage-abstraction',
            query,
            fallbackStorage: 'postgresql'
          });

          return {
            success: true,
            data: result,
            storageUsed: 'postgresql'
          };
        } catch (fallbackError: any) {
          logger.error('Fallback storage also failed', {
            service: 'storage-abstraction',
            query,
            error: fallbackError.message
          });
        }
      }

      return {
        success: false,
        error: error.message,
        storageUsed: selectedStorage
      };
    }
  }

  public async updateUser(userId: string, updateData: Partial<UserData>): Promise<StorageResult<void>> {
    const selectedStorage = this.selectStorage();
    
    try {
      await this.withRetry(async () => {
        if (selectedStorage === 'iagon') {
          const key = `user_${userId}`;
          const existingData = await this.retrieveFromIagon(key);
          const updatedData = {
            ...existingData,
            ...updateData,
            updatedAt: new Date()
          };
          await this.updateInIagon(key, updatedData);
        } else {
          // Find user by userId first
          const users = await this.retrieveFromPostgreSQL('users', { userId });
          if (users.length === 0) {
            throw new Error('User not found');
          }
          await this.updateInPostgreSQL('users', users[0].id, updateData);
        }
      }, 'updateUser');

      logger.info('User updated successfully', {
        service: 'storage-abstraction',
        userId,
        storage: selectedStorage
      });

      return {
        success: true,
        storageUsed: selectedStorage
      };
    } catch (error: any) {
      logger.error('Failed to update user', {
        service: 'storage-abstraction',
        userId,
        storage: selectedStorage,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        storageUsed: selectedStorage
      };
    }
  }

  public async storeUserDeposit(depositData: Omit<UserDeposit, 'id' | 'createdAt'>): Promise<StorageResult<{ id: string }>> {
    const selectedStorage = this.selectStorage();
    
    try {
      const result = await this.withRetry(async () => {
        if (selectedStorage === 'iagon') {
          const key = `deposit_${depositData.userId}_${Date.now()}`;
          const dataWithTimestamps = {
            ...depositData,
            id: crypto.randomUUID(),
            createdAt: new Date()
          };
          const storageId = await this.storeInIagon(key, dataWithTimestamps);
          return { id: storageId };
        } else {
          const id = await this.storeInPostgreSQL('user_deposits', depositData);
          return { id };
        }
      }, 'storeUserDeposit');

      logger.info('User deposit stored successfully', {
        service: 'storage-abstraction',
        userId: depositData.userId,
        storage: selectedStorage
      });

      return {
        success: true,
        data: result,
        storageUsed: selectedStorage
      };
    } catch (error: any) {
      logger.error('Failed to store user deposit', {
        service: 'storage-abstraction',
        userId: depositData.userId,
        storage: selectedStorage,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        storageUsed: selectedStorage
      };
    }
  }

  public async findUserDeposits(query: { userId?: string; userAddress?: string; txHash?: string }): Promise<StorageResult<UserDeposit[]>> {
    const selectedStorage = this.selectStorage();
    
    try {
      const result = await this.withRetry(async () => {
        if (selectedStorage === 'iagon') {
          // For Iagon, we'd need to implement a search mechanism
          // For now, fall back to PostgreSQL for complex queries
          throw new Error('Iagon storage requires specific key for deposit lookup');
        } else {
          return await this.retrieveFromPostgreSQL('user_deposits', query);
        }
      }, 'findUserDeposits');

      return {
        success: true,
        data: result,
        storageUsed: selectedStorage
      };
    } catch (error: any) {
      logger.error('Failed to find user deposits', {
        service: 'storage-abstraction',
        query,
        storage: selectedStorage,
        error: error.message
      });

      // Try fallback if enabled and primary failed
      if (this.config.enableFallback && selectedStorage === 'iagon') {
        try {
          const results = await this.retrieveFromPostgreSQL('user_deposits', query);
          
          logger.info('User deposits found using fallback storage', {
            service: 'storage-abstraction',
            query,
            fallbackStorage: 'postgresql'
          });

          return {
            success: true,
            data: results,
            storageUsed: 'postgresql'
          };
        } catch (fallbackError: any) {
          logger.error('Fallback storage also failed', {
            service: 'storage-abstraction',
            query,
            error: fallbackError.message
          });
        }
      }

      return {
        success: false,
        error: error.message,
        storageUsed: selectedStorage
      };
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  public async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    logger.info('Storage abstraction service shutdown', { service: 'storage-abstraction' });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const storageService = new StorageAbstractionService({
  primaryStorage: process.env.PRIMARY_STORAGE as 'iagon' | 'postgresql' || 'iagon',
  enableFallback: process.env.ENABLE_STORAGE_FALLBACK !== 'false',
  syncBetweenStorages: process.env.SYNC_BETWEEN_STORAGES === 'true',
  healthCheckInterval: parseInt(process.env.STORAGE_HEALTH_CHECK_INTERVAL || '60000'),
  retryAttempts: parseInt(process.env.STORAGE_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.STORAGE_RETRY_DELAY || '1000')
});