import pool from './config.js';
import { PoolClient } from 'pg';

// ============================================================================
// INTERFACES
// ============================================================================


export interface UserDeposit {
  id?: string;
  user_address: string;
  user_id: string;
  phone_hash: string;
  zk_proof?: string;
  zk_commitment?: string;
  tx_hash?: string;
  amount: bigint;
  timestamp?: Date;
  refunded: boolean;
  signup_completed: boolean;
  verified: boolean;
  verification_attempts: number;
  last_verification_attempt?: Date;
  pin_hash?: string;
  biometric_hash?: string;
  biometric_type?: 'fingerprint' | 'faceid' | 'voice' | 'iris';
  verification_method?: 'phone' | 'pin' | 'biometric';
  refund_tx_hash?: string;
  refund_timestamp?: Date;
  sender_wallet_address?: string;
  created_at?: Date;
}

export interface Transaction {
  id?: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: bigint;
  confirmations: number;
  block_time?: Date;
  transaction_type: 'deposit' | 'refund' | 'signup';
  status: 'pending' | 'confirmed' | 'failed';
  user_deposit_id?: string;
  created_at?: Date;
}

export interface ZKProof {
  id?: string;
  user_id: string;
  commitment: string;
  proof: string;
  public_inputs?: any;
  is_valid: boolean;
  created_at?: Date;
  verified_at?: Date;
}

export interface AuthData {
  id?: string;
  user_id: string;
  auth_type: 'phone' | 'pin' | 'biometric' | 'passkey';
  auth_hash: string;
  salt?: string;
  metadata?: any;
  is_active: boolean;
  created_at?: Date;
  last_used?: Date;
}

export interface AuthMethod {
  type: 'pin' | 'face' | 'fingerprint' | 'voice' | 'iris' | 'phone';
  data?: string; // hashed PIN for 'pin', biometric data for 'face', null for others
  createdAt: Date;
  lastUsed?: Date;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// models/database.ts - Update interfaces
export interface WalletItem {
  id: string;
  name: string;
  type: 'wallet';
  keyType?: '12' | '24';
  fileId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  items: WalletItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id?: string;
  user_id: string;
  email?: string;
  name?: string;
  username?: string;       
  wallet_address?: string;
  phone_hash?: string;
  phone_number?: string;    
  pin_hash?: string;        
  zk_commitment?: string;
  auth_methods: AuthMethod[];
  folders: Folder[];
  verification_method?: string;        
  biometric_type?: string;             
  sender_wallet_address?: string;      
  verified?: boolean;                  
  created_at?: Date;
  updated_at?: Date;
}
// ============================================================================
// INTERFACES - Add Subscription Interface
// ============================================================================

export interface PaymentTransaction {
  id?: string;
  reference: string;
  phone: string;
  customer_email?: string;
  amount: number;
  currency: string;
  user_id?: string;
  status: string;
  customer_code?: string;
  plan_code?: string;
  authorization_code?: string;
  gateway_response?: string;
  channel?: string;
  fees?: number;
  paid_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface Subscription {
  id?: string;
  subscription_code?: string;
  user_id: string;
  phone?: string;
  customer_code?: string;
  plan_code?: string;
  tier: 'freemium' | 'premium';
  is_active: boolean;
  start_date?: Date;
  end_date?: Date;
  auto_renew: boolean;
  status?: string;
  next_payment_date?: Date;
  cancelled_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface SubscriptionStatus {
  tier: 'freemium' | 'premium';
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  daysRemaining?: number;
  autoRenew: boolean;
  status?: string;
  nextPaymentDate?: Date;
}
// ============================================================================
// USER MODEL
// ============================================================================

export class UserModel {
  static async create(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const client = await pool.connect();
    try {
      // Validate minimum 3 auth methods
      if (!user.auth_methods || user.auth_methods.length < 3) {
        throw new Error('At least 3 authentication methods are required');
      }

      const query = `
        INSERT INTO users (user_id, email, name, wallet_address, phone_hash, zk_commitment, auth_methods, folders)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const values = [
        user.user_id, 
        user.email, 
        user.name, 
        user.wallet_address, 
        user.phone_hash, 
        user.zk_commitment,
        JSON.stringify(user.auth_methods), // Store as JSONB
        JSON.stringify(user.folders || []) // Store as JSONB
      ];
      const result = await client.query(query, values);
      return this.parseUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  static async findByUserId(userId: string): Promise<User | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM users WHERE user_id = $1';
      const result = await client.query(query, [userId]);
      return result.rows[0] ? this.parseUser(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  static async findByWalletAddress(walletAddress: string): Promise<User | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM users WHERE wallet_address = $1';
      const result = await client.query(query, [walletAddress]);
      return result.rows[0] ? this.parseUser(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  static async update(userId: string, updates: Partial<User>): Promise<User | null> {
    const client = await pool.connect();
    try {
      // Validate auth methods if being updated
      if (updates.auth_methods && updates.auth_methods.length < 3) {
        throw new Error('At least 3 authentication methods are required');
      }
  
      // Filter out fields that shouldn't be updated directly
      const filteredUpdates = { ...updates };
      delete filteredUpdates.id;
      delete filteredUpdates.user_id;
      delete filteredUpdates.created_at;
      delete filteredUpdates.updated_at; // Remove updated_at from updates
  
      const setClause = Object.keys(filteredUpdates)
        .map((key, index) => {
          if (key === 'auth_methods' || key === 'folders') {
            return `${key} = $${index + 2}::jsonb`;
          }
          return `${key} = $${index + 2}`;
        })
        .join(', ');
      
      if (!setClause) return null;
      
      // Add updated_at separately at the end
      const finalSetClause = `${setClause}, updated_at = CURRENT_TIMESTAMP`;
      
      const query = `
        UPDATE users 
        SET ${finalSetClause}
        WHERE user_id = $1
        RETURNING *
      `;
      
      const values = [userId, ...Object.values(filteredUpdates).map((value, index) => {
        const key = Object.keys(filteredUpdates)[index];
        if (key === 'auth_methods' || key === 'folders') {
          return JSON.stringify(value);
        }
        return value;
      })];
      
      console.log('Update query:', query);
      console.log('Update values count:', values.length);
      
      const result = await client.query(query, values);
      return result.rows[0] ? this.parseUser(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  // NEW: Update authentication methods
  static async updateAuthMethods(userId: string, authMethods: AuthMethod[]): Promise<User | null> {
    if (authMethods.length < 3) {
      throw new Error('At least 3 authentication methods are required');
    }

    return await this.update(userId, { auth_methods: authMethods });
  }

  // NEW: Add a single authentication method
  static async addAuthMethod(userId: string, authMethod: AuthMethod): Promise<User | null> {
    const user = await this.findByUserId(userId);
    if (!user) return null;

    const updatedMethods = [...user.auth_methods, authMethod];
    return await this.updateAuthMethods(userId, updatedMethods);
  }

  // NEW: Remove an authentication method (ensure minimum 3)
  static async removeAuthMethod(userId: string, authType: AuthMethod['type']): Promise<User | null> {
    const user = await this.findByUserId(userId);
    if (!user) return null;

    const updatedMethods = user.auth_methods.filter(method => method.type !== authType);
    if (updatedMethods.length < 3) {
      throw new Error(`Cannot remove ${authType}. Minimum 3 authentication methods required.`);
    }

    return await this.updateAuthMethods(userId, updatedMethods);
  }

  // NEW: Manage folders
  static async addFolder(userId: string, folder: Omit<Folder, 'createdAt' | 'updatedAt'>): Promise<User | null> {
    const user = await this.findByUserId(userId);
    if (!user) return null;

    const newFolder: Folder = {
      ...folder,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedFolders = [...user.folders, newFolder];
    return await this.update(userId, { folders: updatedFolders });
  }

  static async updateFolder(userId: string, folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>): Promise<User | null> {
    const user = await this.findByUserId(userId);
    if (!user) return null;

    const updatedFolders = user.folders.map(folder => 
      folder.id === folderId 
        ? { ...folder, ...updates, updatedAt: new Date() }
        : folder
    );

    return await this.update(userId, { folders: updatedFolders });
  }

  static async removeFolder(userId: string, folderId: string): Promise<User | null> {
    const user = await this.findByUserId(userId);
    if (!user) return null;

    const updatedFolders = user.folders.filter(folder => folder.id !== folderId);
    return await this.update(userId, { folders: updatedFolders });
  }

  static async getAll(): Promise<User[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM users ORDER BY created_at DESC';
      const result = await client.query(query);
      return result.rows.map(row => this.parseUser(row));
    } finally {
      client.release();
    }
  }

private static parseUser(row: any): User {
  const safeJsonParse = (data: any): any => {
    if (!data) return [];
    if (typeof data === 'object') return data; // Already parsed
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('JSON parse error:', e, 'for data:', data);
        return [];
      }
    }
    return [];
  };

  return {
    ...row,
    auth_methods: safeJsonParse(row.auth_methods),
    folders: safeJsonParse(row.folders)
  };
}
}


// ============================================================================
// USER DEPOSIT MODEL
// ============================================================================

export class UserDepositModel {
  static async create(deposit: Omit<UserDeposit, 'id' | 'timestamp'>): Promise<UserDeposit> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO user_deposits (
          user_address, user_id, phone_hash, zk_proof, zk_commitment, tx_hash, amount,
          refunded, signup_completed, verified, verification_attempts, last_verification_attempt,
          pin_hash, biometric_hash, biometric_type, verification_method, refund_tx_hash,
          refund_timestamp, sender_wallet_address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `;
      const values = [
        deposit.user_address, deposit.user_id, deposit.phone_hash, deposit.zk_proof,
        deposit.zk_commitment, deposit.tx_hash, deposit.amount.toString(), deposit.refunded,
        deposit.signup_completed, deposit.verified, deposit.verification_attempts,
        deposit.last_verification_attempt, deposit.pin_hash, deposit.biometric_hash,
        deposit.biometric_type, deposit.verification_method, deposit.refund_tx_hash,
        deposit.refund_timestamp, deposit.sender_wallet_address
      ];
      const result = await client.query(query, values);
      const row = result.rows[0];
      return {
        ...row,
        amount: BigInt(row.amount)
      };
    } finally {
      client.release();
    }
  }

  static async findByUserAddress(userAddress: string): Promise<UserDeposit | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM user_deposits WHERE user_address = $1 ORDER BY timestamp DESC LIMIT 1';
      const result = await client.query(query, [userAddress]);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        ...row,
        amount: BigInt(row.amount)
      };
    } finally {
      client.release();
    }
  }

  
  static async findByUserId(userId: string): Promise<UserDeposit[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM user_deposits WHERE user_id = $1 ORDER BY timestamp DESC';
      const result = await client.query(query, [userId]);
      return result.rows.map(row => ({
        ...row,
        amount: BigInt(row.amount)
      }));
    } finally {
      client.release();
    }
  }

  static async update(userAddress: string, updates: Partial<UserDeposit>): Promise<UserDeposit | null> {
    const client = await pool.connect();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'timestamp')
        .map((key, index) => {
          if (key === 'amount') {
            return `${key} = $${index + 2}::bigint`;
          }
          return `${key} = $${index + 2}`;
        })
        .join(', ');
      
      if (!setClause) return null;
      
      const query = `
        UPDATE user_deposits 
        SET ${setClause}
        WHERE user_address = $1
        RETURNING *
      `;
      const values = [userAddress, ...Object.values(updates).filter((_, index) => {
        const key = Object.keys(updates)[index];
        return key !== 'id' && key !== 'timestamp';
      }).map((value, index) => {
        const key = Object.keys(updates).filter(k => k !== 'id' && k !== 'timestamp')[index];
        if (key === 'amount' && typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      })];
      
      const result = await client.query(query, values);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        ...row,
        amount: BigInt(row.amount)
      };
    } finally {
      client.release();
    }
  }

  static async getAll(): Promise<UserDeposit[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM user_deposits ORDER BY timestamp DESC';
      const result = await client.query(query);
      return result.rows.map(row => ({
        ...row,
        amount: BigInt(row.amount)
      }));
    } finally {
      client.release();
    }
  }

  static async getUnverified(): Promise<UserDeposit[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM user_deposits WHERE verified = false ORDER BY timestamp ASC';
      const result = await client.query(query);
      return result.rows.map(row => ({
        ...row,
        amount: BigInt(row.amount)
      }));
    } finally {
      client.release();
    }
  }
}

// ============================================================================
// TRANSACTION MODEL
// ============================================================================

export class TransactionModel {
  static async create(transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO transactions (
          tx_hash, from_address, to_address, amount, confirmations, block_time,
          transaction_type, status, user_deposit_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const values = [
        transaction.tx_hash, transaction.from_address, transaction.to_address,
        transaction.amount.toString(), transaction.confirmations, transaction.block_time,
        transaction.transaction_type, transaction.status, transaction.user_deposit_id
      ];
      const result = await client.query(query, values);
      const row = result.rows[0];
      return {
        ...row,
        amount: BigInt(row.amount)
      };
    } finally {
      client.release();
    }
  }

  static async findByTxHash(txHash: string): Promise<Transaction | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM transactions WHERE tx_hash = $1';
      const result = await client.query(query, [txHash]);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        ...row,
        amount: BigInt(row.amount)
      };
    } finally {
      client.release();
    }
  }

  static async updateStatus(txHash: string, status: 'pending' | 'confirmed' | 'failed', confirmations?: number): Promise<Transaction | null> {
    const client = await pool.connect();
    try {
      let query = 'UPDATE transactions SET status = $1';
      const values = [status, txHash];
      
      if (confirmations !== undefined) {
        query += ', confirmations = $3';
        values.splice(1, 0, confirmations.toString());
      }
      
      query += ' WHERE tx_hash = $' + values.length + ' RETURNING *';
      
      const result = await client.query(query, values);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        ...row,
        amount: BigInt(row.amount)
      };
    } finally {
      client.release();
    }
  }

  static async getAll(): Promise<Transaction[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM transactions ORDER BY created_at DESC';
      const result = await client.query(query);
      return result.rows.map(row => ({
        ...row,
        amount: BigInt(row.amount)
      }));
    } finally {
      client.release();
    }
  }
}

// ============================================================================
// AUTH DATA MODEL
// ============================================================================

export class AuthDataModel {
  static async create(authData: Omit<AuthData, 'id' | 'created_at'>): Promise<AuthData> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO auth_data (user_id, auth_type, auth_hash, salt, metadata, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const values = [
        authData.user_id, 
        authData.auth_type, 
        authData.auth_hash, 
        authData.salt, 
        JSON.stringify(authData.metadata), 
        authData.is_active
      ];
      const result = await client.query(query, values);
      const row = result.rows[0];
      return {
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      };
    } finally {
      client.release();
    }
  }

  static async findByUserIdAndType(userId: string, authType: 'phone' | 'pin' | 'biometric' | 'passkey'): Promise<AuthData | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM auth_data WHERE user_id = $1 AND auth_type = $2 AND is_active = true ORDER BY created_at DESC LIMIT 1';
      const result = await client.query(query, [userId, authType]);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      };
    } finally {
      client.release();
    }
  }

  static async findByUserId(userId: string): Promise<AuthData[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM auth_data WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC';
      const result = await client.query(query, [userId]);
      return result.rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));
    } finally {
      client.release();
    }
  }

  static async update(userId: string, authType: 'phone' | 'pin' | 'biometric' | 'passkey', updates: Partial<AuthData>): Promise<AuthData | null> {
    const client = await pool.connect();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'user_id' && key !== 'auth_type' && key !== 'created_at')
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');
      
      if (!setClause) return null;
      
      const query = `
        UPDATE auth_data 
        SET ${setClause}, last_used = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND auth_type = $2 AND is_active = true
        RETURNING *
      `;
      
      const values = [userId, authType, ...Object.values(updates).filter((_, index) => {
        const key = Object.keys(updates)[index];
        return key !== 'id' && key !== 'user_id' && key !== 'auth_type' && key !== 'created_at';
      }).map((value, index) => {
        const key = Object.keys(updates).filter(k => k !== 'id' && k !== 'user_id' && k !== 'auth_type' && k !== 'created_at')[index];
        if (key === 'metadata') {
          return JSON.stringify(value);
        }
        return value;
      })];
      
      const result = await client.query(query, values);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      };
    } finally {
      client.release();
    }
  }

  static async upsert(authData: Omit<AuthData, 'id' | 'created_at'>): Promise<AuthData> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO auth_data (user_id, auth_type, auth_hash, salt, metadata, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, auth_type) 
        DO UPDATE SET 
          auth_hash = EXCLUDED.auth_hash,
          salt = EXCLUDED.salt,
          metadata = EXCLUDED.metadata,
          is_active = EXCLUDED.is_active,
          last_used = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const values = [
        authData.user_id, 
        authData.auth_type, 
        authData.auth_hash, 
        authData.salt, 
        JSON.stringify(authData.metadata), 
        authData.is_active
      ];
      const result = await client.query(query, values);
      const row = result.rows[0];
      return {
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      };
    } finally {
      client.release();
    }
  }

  static async deactivate(userId: string, authType: 'phone' | 'pin' | 'biometric' | 'passkey'): Promise<boolean> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE auth_data 
        SET is_active = false, last_used = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND auth_type = $2
      `;
      const result = await client.query(query, [userId, authType]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  static async getAll(): Promise<AuthData[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM auth_data WHERE is_active = true ORDER BY created_at DESC';
      const result = await client.query(query);
      return result.rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }));
    } finally {
      client.release();
    }
  }
}

// ============================================================================
// SUBSCRIPTION MODEL
// ============================================================================

// ============================================================================
// PAYMENT TRANSACTION MODEL
// ============================================================================

export class PaymentTransactionModel {
  static async create(transaction: Omit<PaymentTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentTransaction> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO payment_transactions (
          reference, phone, customer_email, amount, currency, user_id, status,
          customer_code, plan_code, authorization_code, gateway_response, channel, fees, paid_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      const values = [
        transaction.reference,
        transaction.phone,
        transaction.customer_email,
        transaction.amount,
        transaction.currency,
        transaction.user_id,
        transaction.status,
        transaction.customer_code,
        transaction.plan_code,
        transaction.authorization_code,
        transaction.gateway_response,
        transaction.channel,
        transaction.fees,
        transaction.paid_at
      ];
      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async findByReference(reference: string): Promise<PaymentTransaction | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM payment_transactions WHERE reference = $1';
      const result = await client.query(query, [reference]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async findByUserId(userId: string): Promise<PaymentTransaction[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM payment_transactions WHERE user_id = $1 ORDER BY created_at DESC';
      const result = await client.query(query, [userId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async findByPhone(phone: string): Promise<PaymentTransaction[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM payment_transactions WHERE phone = $1 ORDER BY created_at DESC';
      const result = await client.query(query, [phone]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async update(reference: string, updates: Partial<PaymentTransaction>): Promise<PaymentTransaction | null> {
    const client = await pool.connect();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'reference' && key !== 'created_at' && key !== 'updated_at')
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      if (!setClause) return null;
      
      const query = `
        UPDATE payment_transactions 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE reference = $1
        RETURNING *
      `;
      
      const values = [reference, ...Object.values(updates).filter((_, index) => {
        const key = Object.keys(updates)[index];
        return key !== 'id' && key !== 'reference' && key !== 'created_at' && key !== 'updated_at';
      })];
      
      const result = await client.query(query, values);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async updateStatus(reference: string, status: string, additionalData?: Partial<PaymentTransaction>): Promise<PaymentTransaction | null> {
    const client = await pool.connect();
    try {
      let query = 'UPDATE payment_transactions SET status = $1, updated_at = CURRENT_TIMESTAMP';
      const values: any[] = [status, reference];
      let paramIndex = 3;

      if (additionalData) {
        if (additionalData.gateway_response) {
          query += `, gateway_response = $${paramIndex++}`;
          values.splice(1, 0, additionalData.gateway_response);
        }
        if (additionalData.paid_at) {
          query += `, paid_at = $${paramIndex++}`;
          values.splice(1, 0, additionalData.paid_at);
        }
        if (additionalData.channel) {
          query += `, channel = $${paramIndex++}`;
          values.splice(1, 0, additionalData.channel);
        }
        if (additionalData.fees) {
          query += `, fees = $${paramIndex++}`;
          values.splice(1, 0, additionalData.fees);
        }
        if (additionalData.authorization_code) {
          query += `, authorization_code = $${paramIndex++}`;
          values.splice(1, 0, additionalData.authorization_code);
        }
      }

      query += ' WHERE reference = $2 RETURNING *';
      
      const result = await client.query(query, values);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async getAll(): Promise<PaymentTransaction[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM payment_transactions ORDER BY created_at DESC';
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getByStatus(status: string): Promise<PaymentTransaction[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM payment_transactions WHERE status = $1 ORDER BY created_at DESC';
      const result = await client.query(query, [status]);
      return result.rows;
    } finally {
      client.release();
    }
  }
}

// ============================================================================
// UPDATED SUBSCRIPTION MODEL
// ============================================================================

export class SubscriptionModel {
  static async create(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO subscriptions (
          user_id, phone, tier, is_active, start_date, end_date, auto_renew,
          subscription_code, customer_code, plan_code, status, next_payment_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const values = [
        subscription.user_id,
        subscription.phone,
        subscription.tier,
        subscription.is_active,
        subscription.start_date,
        subscription.end_date,
        subscription.auto_renew,
        subscription.subscription_code,
        subscription.customer_code,
        subscription.plan_code,
        subscription.status || 'inactive',
        subscription.next_payment_date
      ];
      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async findByUserId(userId: string): Promise<Subscription | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM subscriptions WHERE user_id = $1';
      const result = await client.query(query, [userId]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async findBySubscriptionCode(subscriptionCode: string): Promise<Subscription | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM subscriptions WHERE subscription_code = $1';
      const result = await client.query(query, [subscriptionCode]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async findByCustomerCode(customerCode: string): Promise<Subscription | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM subscriptions WHERE customer_code = $1';
      const result = await client.query(query, [customerCode]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async update(userId: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    const client = await pool.connect();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at')
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      if (!setClause) return null;
      
      const query = `
        UPDATE subscriptions 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;
      
      const values = [userId, ...Object.values(updates).filter((_, index) => {
        const key = Object.keys(updates)[index];
        return key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at';
      })];
      
      const result = await client.query(query, values);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async updateBySubscriptionCode(subscriptionCode: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    const client = await pool.connect();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'subscription_code' && key !== 'created_at' && key !== 'updated_at')
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      if (!setClause) return null;
      
      const query = `
        UPDATE subscriptions 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE subscription_code = $1
        RETURNING *
      `;
      
      const values = [subscriptionCode, ...Object.values(updates).filter((_, index) => {
        const key = Object.keys(updates)[index];
        return key !== 'id' && key !== 'subscription_code' && key !== 'created_at' && key !== 'updated_at';
      })];
      
      const result = await client.query(query, values);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async upsert(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO subscriptions (
          user_id, phone, tier, is_active, start_date, end_date, auto_renew,
          subscription_code, customer_code, plan_code, status, next_payment_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          phone = EXCLUDED.phone,
          tier = EXCLUDED.tier,
          is_active = EXCLUDED.is_active,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          auto_renew = EXCLUDED.auto_renew,
          subscription_code = EXCLUDED.subscription_code,
          customer_code = EXCLUDED.customer_code,
          plan_code = EXCLUDED.plan_code,
          status = EXCLUDED.status,
          next_payment_date = EXCLUDED.next_payment_date,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const values = [
        subscription.user_id,
        subscription.phone,
        subscription.tier,
        subscription.is_active,
        subscription.start_date,
        subscription.end_date,
        subscription.auto_renew,
        subscription.subscription_code,
        subscription.customer_code,
        subscription.plan_code,
        subscription.status || 'inactive',
        subscription.next_payment_date
      ];
      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async activatePremium(userId: string, durationMonths: number = 1, subscriptionData?: Partial<Subscription>): Promise<Subscription> {
    const client = await pool.connect();
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);

      const query = `
        INSERT INTO subscriptions (
          user_id, phone, tier, is_active, start_date, end_date, auto_renew,
          subscription_code, customer_code, plan_code, status
        )
        VALUES ($1, $2, 'premium', true, $3, $4, true, $5, $6, $7, 'active')
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          tier = 'premium',
          is_active = true,
          start_date = $3,
          end_date = $4,
          auto_renew = true,
          phone = COALESCE($2, subscriptions.phone),
          subscription_code = COALESCE($5, subscriptions.subscription_code),
          customer_code = COALESCE($6, subscriptions.customer_code),
          plan_code = COALESCE($7, subscriptions.plan_code),
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const values = [
        userId,
        subscriptionData?.phone,
        startDate,
        endDate,
        subscriptionData?.subscription_code,
        subscriptionData?.customer_code,
        subscriptionData?.plan_code
      ];
      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async cancelSubscription(userId: string): Promise<Subscription | null> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE subscriptions 
        SET tier = 'freemium', is_active = false, auto_renew = false, 
            status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;
      const result = await client.query(query, [userId]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async getExpiringSubscriptions(daysThreshold: number = 7): Promise<Subscription[]> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT * FROM subscriptions 
        WHERE tier = 'premium' 
        AND is_active = true 
        AND status = 'active'
        AND end_date BETWEEN NOW() AND NOW() + INTERVAL '${daysThreshold} days'
        ORDER BY end_date ASC
      `;
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getExpiredSubscriptions(): Promise<Subscription[]> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT * FROM subscriptions 
        WHERE tier = 'premium' 
        AND is_active = true 
        AND status = 'active'
        AND end_date < NOW()
        ORDER BY end_date ASC
      `;
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getAll(): Promise<Subscription[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM subscriptions ORDER BY created_at DESC';
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getActiveSubscriptions(): Promise<Subscription[]> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT * FROM subscriptions 
        WHERE tier = 'premium' AND is_active = true AND status = 'active'
        ORDER BY created_at DESC
      `;
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Helper method to calculate subscription status
  static async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
    const subscription = await this.findByUserId(userId);
    
    if (!subscription) {
      // Return default freemium status if no subscription exists
      return {
        tier: 'freemium',
        isActive: false,
        autoRenew: false,
        status: 'inactive'
      };
    }

    let daysRemaining: number | undefined;
    if (subscription.end_date) {
      const now = new Date();
      const endDate = new Date(subscription.end_date);
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Auto-expire if past end date and still marked as active
      if (daysRemaining < 0 && subscription.is_active && subscription.status === 'active') {
        await this.update(userId, { 
          is_active: false, 
          status: 'expired',
          auto_renew: false 
        });
        subscription.is_active = false;
        subscription.status = 'expired';
        subscription.auto_renew = false;
      }
    }

    return {
      tier: subscription.tier,
      isActive: subscription.is_active,
      startDate: subscription.start_date,
      endDate: subscription.end_date,
      daysRemaining: daysRemaining,
      autoRenew: subscription.auto_renew,
      status: subscription.status,
      nextPaymentDate: subscription.next_payment_date
    };
  }
}

// ============================================================================
// DATABASE MIGRATION AND INITIALIZATION
// ============================================================================

export class DatabaseManager {
  static async initializeDatabase(): Promise<void> {
    const client = await pool.connect();
    try {
      // Read and execute schema file
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await client.query(schema);
      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async migrateFromJSON(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      // Helper function to create default auth methods
      const createDefaultAuthMethods = (): AuthMethod[] => [
        {
          type: 'phone',
          createdAt: new Date()
        },
        {
          type: 'pin',
          data: 'default-hash-placeholder', // Will be updated with real hash later
          createdAt: new Date()
        },
        {
          type: 'fingerprint',
          createdAt: new Date()
        }
      ];

      let totalUsersMigrated = 0;
      let totalDepositsMigrated = 0;

      // Migrate user-deposits.json
      const depositsPath = path.join(__dirname, '../../user-deposits.json');
      if (fs.existsSync(depositsPath)) {
        console.log('📦 Migrating user deposits from JSON...');
        const depositsData = JSON.parse(fs.readFileSync(depositsPath, 'utf8'));
        
        for (const deposit of depositsData) {
          try {
            // Create user if not exists - WITH REQUIRED FIELDS
            const existingUser = await UserModel.findByUserId(deposit.userId);
            if (!existingUser) {
              await UserModel.create({
                user_id: deposit.userId,
                wallet_address: deposit.userAddress,
                phone_hash: deposit.phoneHash,
                auth_methods: createDefaultAuthMethods(), // ✅ REQUIRED FIELD
                folders: [] // ✅ REQUIRED FIELD
              });
              totalUsersMigrated++;
              console.log(`✅ Created user: ${deposit.userId}`);
            }
            
            // Create deposit record
            const existingDeposit = await UserDepositModel.findByUserAddress(deposit.userAddress);
            if (!existingDeposit) {
              await UserDepositModel.create({
                user_address: deposit.userAddress,
                user_id: deposit.userId,
                phone_hash: deposit.phoneHash,
                zk_proof: deposit.zkProof,
                zk_commitment: deposit.zkCommitment,
                tx_hash: deposit.txHash,
                amount: BigInt(deposit.amount || '0'),
                refunded: deposit.refunded || false,
                signup_completed: deposit.signupCompleted || false,
                verified: deposit.verified || false,
                verification_attempts: deposit.verificationAttempts || 0,
                last_verification_attempt: deposit.lastVerificationAttempt ? new Date(deposit.lastVerificationAttempt) : undefined,
                pin_hash: deposit.pinHash,
                biometric_hash: deposit.biometricHash,
                biometric_type: deposit.biometricType,
                verification_method: deposit.verificationMethod,
                refund_tx_hash: deposit.refundTxHash,
                refund_timestamp: deposit.refundTimestamp ? new Date(deposit.refundTimestamp) : undefined,
                sender_wallet_address: deposit.senderWalletAddress
              });
              totalDepositsMigrated++;
            }
          } catch (error) {
            console.error(`❌ Failed to migrate deposit for user ${deposit.userId}:`, error);
            // Continue with next deposit
          }
        }
        
        console.log(`✅ Migrated ${depositsData.length} deposits from JSON to database`);
      } else {
        console.log('ℹ️  No user-deposits.json file found, skipping deposits migration');
      }
      
      // Migrate mock-db.json
      const mockDbPath = path.join(__dirname, '../utils/mock-db.json');
      if (fs.existsSync(mockDbPath)) {
        console.log('👥 Migrating mock users from JSON...');
        const mockData = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
        
        for (const user of mockData.users || []) {
          try {
            const existingUser = await UserModel.findByUserId(user.id);
            if (!existingUser) {
              await UserModel.create({
                user_id: user.id,
                email: user.email,
                name: user.name,
                wallet_address: user.walletAddress,
                phone_hash: user.phoneHash,
                zk_commitment: user.zkCommitment,
                auth_methods: createDefaultAuthMethods(), // ✅ REQUIRED FIELD
                folders: [] // ✅ REQUIRED FIELD
              });
              totalUsersMigrated++;
              console.log(`✅ Created mock user: ${user.id}`);
            }
          } catch (error) {
            console.error(`❌ Failed to migrate mock user ${user.id}:`, error);
            // Continue with next user
          }
        }
        
        console.log(`✅ Migrated ${mockData.users?.length || 0} users from mock database`);
      } else {
        console.log('ℹ️  No mock-db.json file found, skipping mock users migration');
      }

      // Final summary
      console.log('\n📊 Migration Summary:');
      console.log(`✅ Total users migrated: ${totalUsersMigrated}`);
      console.log(`✅ Total deposits migrated: ${totalDepositsMigrated}`);
      console.log('🎉 JSON to database migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Failed to migrate data from JSON:', error);
      throw error;
    }
  }

  // NEW: Run specific migration for auth_methods and folders
  static async runAuthMethodsMigration(): Promise<void> {
    const client = await pool.connect();
    try {
      console.log('🔄 Running auth_methods and folders migration...');
      
      // Check if columns already exist
      const checkColumns = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('auth_methods', 'folders')
      `;
      const existingColumns = await client.query(checkColumns);
      
      if (existingColumns.rows.length === 2) {
        console.log('✅ auth_methods and folders columns already exist');
      } else {
        // Add columns if they don't exist
        const addColumns = `
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS auth_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS folders JSONB NOT NULL DEFAULT '[]'::jsonb
        `;
        await client.query(addColumns);
        console.log('✅ Added auth_methods and folders columns');
      }
      
      // Create indexes
      const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_users_auth_methods ON users USING gin (auth_methods);
        CREATE INDEX IF NOT EXISTS idx_users_folders ON users USING gin (folders);
      `;
      await client.query(createIndexes);
      console.log('✅ Created indexes for auth_methods and folders');
      
      // Update existing users with default auth methods
      const updateUsers = `
        UPDATE users 
        SET auth_methods = $1::jsonb
        WHERE auth_methods = '[]'::jsonb OR auth_methods IS NULL
      `;
      const defaultAuthMethods = [
        {
          type: 'phone',
          createdAt: new Date().toISOString()
        },
        {
          type: 'pin',
          data: 'default-hash-placeholder',
          createdAt: new Date().toISOString()
        },
        {
          type: 'fingerprint',
          createdAt: new Date().toISOString()
        }
      ];
      
      const result = await client.query(updateUsers, [JSON.stringify(defaultAuthMethods)]);
      console.log(`✅ Updated ${result.rowCount} users with default auth methods`);
      
      console.log('🎉 Auth methods migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Auth methods migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // NEW: Check database health and migration status
  static async checkDatabaseHealth(): Promise<{
    users: number;
    usersWithAuthMethods: number;
    usersWithFolders: number;
    deposits: number;
    transactions: number;
    healthy: boolean;
  }> {
    const client = await pool.connect();
    try {
      const healthQuery = `
        SELECT 
          (SELECT COUNT(*) FROM users) as users_count,
          (SELECT COUNT(*) FROM users WHERE jsonb_array_length(auth_methods) >= 3) as users_with_auth_methods,
          (SELECT COUNT(*) FROM users WHERE jsonb_array_length(folders) >= 0) as users_with_folders,
          (SELECT COUNT(*) FROM user_deposits) as deposits_count,
          (SELECT COUNT(*) FROM transactions) as transactions_count
      `;
      
      const result = await client.query(healthQuery);
      const row = result.rows[0];
      
      const health = {
        users: parseInt(row.users_count),
        usersWithAuthMethods: parseInt(row.users_with_auth_methods),
        usersWithFolders: parseInt(row.users_with_folders),
        deposits: parseInt(row.deposits_count),
        transactions: parseInt(row.transactions_count),
        healthy: parseInt(row.users_with_auth_methods) === parseInt(row.users_count)
      };
      
      console.log('🏥 Database Health Check:');
      console.log(`   Total Users: ${health.users}`);
      console.log(`   Users with Auth Methods: ${health.usersWithAuthMethods}`);
      console.log(`   Users with Folders: ${health.usersWithFolders}`);
      console.log(`   Total Deposits: ${health.deposits}`);
      console.log(`   Total Transactions: ${health.transactions}`);
      console.log(`   Overall Health: ${health.healthy ? '✅ HEALTHY' : '❌ NEEDS ATTENTION'}`);
      
      return health;
      
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // NEW: Run all migrations in sequence
 /*  static async runAllMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting all database migrations...\n');
      
      // 1. Initialize database schema
      await this.initializeDatabase();
      console.log('');
      
      // 2. Run auth methods migration
      await this.runAuthMethodsMigration();
      console.log('');
      
      // 3. Migrate data from JSON files
      await this.migrateFromJSON();
      console.log('');
      
      // 4. Check final database health
      await this.checkDatabaseHealth();
      console.log('');
      
      console.log('🎉 All migrations completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration process failed:', error);
      throw error;
    }
  } */

  static async runSubscriptionMigration(): Promise<void> {
    const client = await pool.connect();
    try {
      console.log('🔄 Running subscription table migration...');
      
      // Check if subscriptions table exists
      const checkTable = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'subscriptions'
        );
      `;
      const tableExists = await client.query(checkTable);
      
      if (!tableExists.rows[0].exists) {
        // Create subscriptions table
        const createTable = `
          CREATE TABLE subscriptions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id VARCHAR(50) NOT NULL,
            tier VARCHAR(50) NOT NULL DEFAULT 'freemium' CHECK (tier IN ('freemium', 'premium')),
            is_active BOOLEAN NOT NULL DEFAULT false,
            start_date TIMESTAMPTZ,
            end_date TIMESTAMPTZ,
            auto_renew BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            UNIQUE(user_id)
          );
        `;
        await client.query(createTable);
        console.log('✅ Created subscriptions table');
        
        // Create indexes
        const createIndexes = `
          CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
          CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
          CREATE INDEX idx_subscriptions_is_active ON subscriptions(is_active);
          CREATE INDEX idx_subscriptions_end_date ON subscriptions(end_date);
        `;
        await client.query(createIndexes);
        console.log('✅ Created subscription indexes');
        
        // Add trigger
        const addTrigger = `
          CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `;
        await client.query(addTrigger);
        console.log('✅ Created subscription trigger');
      } else {
        console.log('✅ Subscriptions table already exists');
      }
      
      console.log('🎉 Subscription migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Subscription migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update runAllMigrations to include subscription migration
  static async runPaymentMigration(): Promise<void> {
    const client = await pool.connect();
    try {
      console.log('🔄 Running payment and subscription table migration...');
      
      // Check if payment_transactions table exists
      const checkPaymentTable = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'payment_transactions'
        );
      `;
      const paymentTableExists = await client.query(checkPaymentTable);
      
      if (!paymentTableExists.rows[0].exists) {
        // Create payment_transactions table
        const createPaymentTable = `
          CREATE TABLE payment_transactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            reference VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(50) NOT NULL,
            customer_email VARCHAR(255),
            amount DECIMAL(10,2) NOT NULL,
            currency VARCHAR(10) DEFAULT 'NGN',
            user_id VARCHAR(50),
            status VARCHAR(50) NOT NULL,
            customer_code VARCHAR(255),
            plan_code VARCHAR(255),
            authorization_code VARCHAR(255),
            gateway_response TEXT,
            channel VARCHAR(50),
            fees DECIMAL(10,2),
            paid_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
          );
        `;
        await client.query(createPaymentTable);
        console.log('✅ Created payment_transactions table');
        
        // Create indexes for payment_transactions
        const createPaymentIndexes = `
          CREATE INDEX idx_payment_transactions_reference ON payment_transactions(reference);
          CREATE INDEX idx_payment_transactions_phone ON payment_transactions(phone);
          CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
          CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
          CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at);
        `;
        await client.query(createPaymentIndexes);
        console.log('✅ Created payment transaction indexes');
        
        // Add trigger for payment_transactions
        const addPaymentTrigger = `
          CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `;
        await client.query(addPaymentTrigger);
        console.log('✅ Created payment transaction trigger');
      } else {
        console.log('✅ payment_transactions table already exists');
      }
      
      // Update subscriptions table if needed
      const checkSubscriptionColumns = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name IN ('subscription_code', 'phone', 'customer_code', 'plan_code', 'status', 'next_payment_date', 'cancelled_at')
      `;
      const subscriptionColumns = await client.query(checkSubscriptionColumns);
      
      if (subscriptionColumns.rows.length < 7) {
        // Add missing columns to subscriptions table
        const alterSubscriptionTable = `
          ALTER TABLE subscriptions 
          ADD COLUMN IF NOT EXISTS subscription_code VARCHAR(255) UNIQUE,
          ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
          ADD COLUMN IF NOT EXISTS customer_code VARCHAR(255),
          ADD COLUMN IF NOT EXISTS plan_code VARCHAR(255),
          ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'inactive',
          ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
        `;
        await client.query(alterSubscriptionTable);
        console.log('✅ Updated subscriptions table with new columns');
        
        // Create new indexes for subscriptions
        const createSubscriptionIndexes = `
          CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(phone);
          CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
          CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment_date ON subscriptions(next_payment_date);
        `;
        await client.query(createSubscriptionIndexes);
        console.log('✅ Created new subscription indexes');
      } else {
        console.log('✅ subscriptions table already has all required columns');
      }
      
      // Create payment_subscription_summary view
      const createPaymentSummaryView = `
        CREATE OR REPLACE VIEW payment_subscription_summary AS
        SELECT 
            u.user_id,
            u.email,
            u.phone_hash,
            s.tier as subscription_tier,
            s.is_active as subscription_active,
            s.end_date as subscription_end_date,
            s.auto_renew as subscription_auto_renew,
            COUNT(pt.id) as total_payments,
            SUM(CASE WHEN pt.status = 'success' THEN pt.amount ELSE 0 END) as total_paid_amount,
            MAX(pt.created_at) as last_payment_date
        FROM users u
        LEFT JOIN subscriptions s ON u.user_id = s.user_id
        LEFT JOIN payment_transactions pt ON u.user_id = pt.user_id
        GROUP BY u.user_id, u.email, u.phone_hash, s.tier, s.is_active, s.end_date, s.auto_renew;
      `;
      await client.query(createPaymentSummaryView);
      console.log('✅ Created payment_subscription_summary view');
      
      console.log('🎉 Payment and subscription migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Payment and subscription migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update runAllMigrations to include payment migration
  static async runAllMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting all database migrations...\n');
      
      // 1. Initialize database schema
      await this.initializeDatabase();
      console.log('');
      
      // 2. Run auth methods migration
      await this.runAuthMethodsMigration();
      console.log('');
      
      // 3. Run payment and subscription migration
      await this.runPaymentMigration();
      console.log('');
      
      // 4. Migrate data from JSON files
      await this.migrateFromJSON();
      console.log('');
      
      // 5. Check final database health
      await this.checkDatabaseHealth();
      console.log('');
      
      console.log('🎉 All migrations completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration process failed:', error);
      throw error;
    }
  }

  // Update health check to include payment and subscription data
  static async checkDatabaseHealth(): Promise<{
    users: number;
    usersWithAuthMethods: number;
    usersWithFolders: number;
    deposits: number;
    transactions: number;
    paymentTransactions: number;
    subscriptions: number;
    activeSubscriptions: number;
    healthy: boolean;
  }> {
    const client = await pool.connect();
    try {
      const healthQuery = `
        SELECT 
          (SELECT COUNT(*) FROM users) as users_count,
          (SELECT COUNT(*) FROM users WHERE jsonb_array_length(auth_methods) >= 3) as users_with_auth_methods,
          (SELECT COUNT(*) FROM users WHERE jsonb_array_length(folders) >= 0) as users_with_folders,
          (SELECT COUNT(*) FROM user_deposits) as deposits_count,
          (SELECT COUNT(*) FROM transactions) as transactions_count,
          (SELECT COUNT(*) FROM payment_transactions) as payment_transactions_count,
          (SELECT COUNT(*) FROM subscriptions) as subscriptions_count,
          (SELECT COUNT(*) FROM subscriptions WHERE tier = 'premium' AND is_active = true) as active_subscriptions_count
      `;
      
      const result = await client.query(healthQuery);
      const row = result.rows[0];
      
      const health = {
        users: parseInt(row.users_count),
        usersWithAuthMethods: parseInt(row.users_with_auth_methods),
        usersWithFolders: parseInt(row.users_with_folders),
        deposits: parseInt(row.deposits_count),
        transactions: parseInt(row.transactions_count),
        paymentTransactions: parseInt(row.payment_transactions_count),
        subscriptions: parseInt(row.subscriptions_count),
        activeSubscriptions: parseInt(row.active_subscriptions_count),
        healthy: parseInt(row.users_with_auth_methods) === parseInt(row.users_count)
      };
      
      console.log('🏥 Database Health Check:');
      console.log(`   Total Users: ${health.users}`);
      console.log(`   Users with Auth Methods: ${health.usersWithAuthMethods}`);
      console.log(`   Users with Folders: ${health.usersWithFolders}`);
      console.log(`   Total Deposits: ${health.deposits}`);
      console.log(`   Total Transactions: ${health.transactions}`);
      console.log(`   Payment Transactions: ${health.paymentTransactions}`);
      console.log(`   Total Subscriptions: ${health.subscriptions}`);
      console.log(`   Active Subscriptions: ${health.activeSubscriptions}`);
      console.log(`   Overall Health: ${health.healthy ? '✅ HEALTHY' : '❌ NEEDS ATTENTION'}`);
      
      return health;
      
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}