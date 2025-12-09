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
  image_number?: number; 
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
// NOTIFICATION INTERFACES
// ============================================================================

export interface Notification {
  id?: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: 'system' | 'transaction' | 'security' | 'subscription' | 'wallet' | 'backup' | 'emergency' | 'promotion';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_read: boolean;
  is_seen: boolean;
  action_url?: string;
  action_label?: string;
  metadata?: any;
  expires_at?: Date;
  scheduled_for?: Date;
  sent_at?: Date;
  read_at?: Date;
  deleted_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface NotificationPreference {
  id?: string;
  user_id: string;
  notification_type: string;
  enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  quiet_hours_start?: string; // Format: 'HH:MM:SS'
  quiet_hours_end?: string;   // Format: 'HH:MM:SS'
  created_at?: Date;
  updated_at?: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  unseen: number;
  urgent_unread: number;
  by_type: Record<string, number>;
  latest_notification?: Date;
}

export interface CreateNotificationDTO {
  user_id: string;
  title: string;
  message: string;
  notification_type?: Notification['notification_type'];
  priority?: Notification['priority'];
  action_url?: string;
  action_label?: string;
  metadata?: any;
  expires_at?: Date;
  scheduled_for?: Date;
}

export interface NotificationFilter {
  user_id?: string;
  is_read?: boolean;
  is_seen?: boolean;
  notification_type?: string | string[];
  priority?: string | string[];
  start_date?: Date;
  end_date?: Date;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'priority' | 'sent_at';
  order_direction?: 'asc' | 'desc';
}
// ============================================================================
// USER MODEL
// ============================================================================

export class UserModel {
  static async create(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const client = await pool.connect();
    
    // Start a transaction to ensure both operations succeed or fail together
    await client.query('BEGIN');
    
    try {
      // Validate minimum 3 auth methods
      if (!user.auth_methods || user.auth_methods.length < 3) {
        throw new Error('At least 3 authentication methods are required');
      }

      const query = `
        INSERT INTO users (user_id, email, name, wallet_address, phone_hash, zk_commitment, auth_methods, folders, image_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const values = [
        user.user_id, 
        user.email, 
        user.name, 
        user.wallet_address, 
        user.phone_hash, 
        user.zk_commitment,
        JSON.stringify(user.auth_methods),
        JSON.stringify(user.folders || []),
        user.image_number || 1
      ];
      
      const result = await client.query(query, values);
      const createdUser = this.parseUser(result.rows[0]);
      
      // STEP 1: Create default notification preferences
      console.log(`🔔 Creating default notification preferences for user: ${user.user_id}`);
      await this.createDefaultNotificationPreferences(client, user.user_id);
      
      // STEP 2: Create welcome notification
      console.log(`🔔 Creating welcome notification for user: ${user.user_id}`);
      await this.createWelcomeNotification(client, user.user_id);
      
      // Commit the transaction
      await client.query('COMMIT');
      
      console.log(`✅ User ${user.user_id} created successfully with preferences and welcome notification`);
      return createdUser;
      
    } catch (error: any) {
      // Rollback on any error
      await client.query('ROLLBACK');
      console.error(`❌ Failed to create user ${user.user_id}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // Helper method to create default notification preferences
  private static async createDefaultNotificationPreferences(client: PoolClient, userId: string): Promise<void> {
    const defaultPreferences = [
      { 
        notification_type: 'system', 
        enabled: true,
        push_enabled: false,
        email_enabled: false,
        sms_enabled: false
      },
      { 
        notification_type: 'transaction', 
        enabled: true,
        push_enabled: false,
        email_enabled: false,
        sms_enabled: false
      },
      { 
        notification_type: 'security', 
        enabled: true,
        push_enabled: true,
        email_enabled: true,
        sms_enabled: true
      },
      { 
        notification_type: 'subscription', 
        enabled: true,
        push_enabled: false,
        email_enabled: false,
        sms_enabled: false
      },
      { 
        notification_type: 'wallet', 
        enabled: true,
        push_enabled: false,
        email_enabled: false,
        sms_enabled: false
      },
      { 
        notification_type: 'backup', 
        enabled: true,
        push_enabled: false,
        email_enabled: false,
        sms_enabled: false
      },
      { 
        notification_type: 'emergency', 
        enabled: true,
        push_enabled: true,
        email_enabled: true,
        sms_enabled: true
      },
      { 
        notification_type: 'promotion', 
        enabled: false,
        push_enabled: false,
        email_enabled: false,
        sms_enabled: false
      }
    ];

    for (const pref of defaultPreferences) {
      try {
        const query = `
          INSERT INTO notification_preferences (
            user_id, notification_type, enabled, email_enabled, push_enabled, sms_enabled
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, notification_type) 
          DO UPDATE SET 
            enabled = EXCLUDED.enabled,
            email_enabled = EXCLUDED.email_enabled,
            push_enabled = EXCLUDED.push_enabled,
            sms_enabled = EXCLUDED.sms_enabled,
            updated_at = CURRENT_TIMESTAMP
        `;
        
        await client.query(query, [
          userId,
          pref.notification_type,
          pref.enabled,
          pref.email_enabled,
          pref.push_enabled,
          pref.sms_enabled
        ]);
        
      } catch (error: any) {
        console.error(`⚠️ Failed to create preference ${pref.notification_type}:`, error.message);
        // Continue with other preferences
      }
    }
    
    console.log(`✅ Created ${defaultPreferences.length} default preferences for user: ${userId}`);
  }

  // Helper method to create welcome notification
  private static async createWelcomeNotification(client: PoolClient, userId: string): Promise<void> {
    try {
      const query = `
        INSERT INTO notifications (
          user_id, title, message, notification_type, priority, is_read, is_seen,
          metadata, sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      const welcomeMessage = "Welcome to K33P! 🎉 Your secure crypto wallet is ready. Start by setting up your wallet and exploring our features.";
      
      await client.query(query, [
        userId,
        'Welcome to K33P!',
        welcomeMessage,
        'system',
        'normal',
        false, // is_read
        false, // is_seen
        JSON.stringify({ type: 'welcome', action: 'setup_wallet' }),
        new Date()
      ]);
      
      console.log(`✅ Welcome notification created for user: ${userId}`);
      
    } catch (error: any) {
      console.error(`⚠️ Failed to create welcome notification:`, error.message);
      // Don't throw - we don't want to fail user creation because of notification
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
      // Validate image_number if being updated
      if (updates.image_number !== undefined && (updates.image_number < 1 || updates.image_number > 3)) {
        throw new Error('Image number must be 1, 2, or 3');
      }
      
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

    // NEW: Update image number
    static async updateImageNumber(userId: string, imageNumber: number): Promise<User | null> {
      if (imageNumber < 1 || imageNumber > 3) {
        throw new Error('Image number must be 1, 2, or 3');
      }
      
      const client = await pool.connect();
      try {
        const query = `
          UPDATE users 
          SET image_number = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2
          RETURNING *
        `;
        
        const result = await client.query(query, [imageNumber, userId]);
        return result.rows[0] ? this.parseUser(result.rows[0]) : null;
      } finally {
        client.release();
      }
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
      folders: safeJsonParse(row.folders),
      image_number: row.image_number ? parseInt(row.image_number) : 1 // Ensure it's a number
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
// NOTIFICATION MODEL
// ============================================================================

export class NotificationModel {
  // In models.ts - NotificationModel.create method
static async create(notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'>): Promise<Notification> {
  const client = await pool.connect();
  try {
    // Validate user exists before creating notification
    const userCheck = await client.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [notification.user_id]
    );
    
    if (userCheck.rows.length === 0) {
      /* throw new Error(`User ${notification.user_id} not found`); */
      console.warn(`⚠️ User ${notification.user_id} not found, but proceeding with notification`);
    }
    
    const query = `
      INSERT INTO notifications (
        user_id, title, message, notification_type, priority, is_read, is_seen,
        action_url, action_label, metadata, expires_at, scheduled_for, sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    // Ensure metadata is properly stringified
    const metadata = notification.metadata 
      ? (typeof notification.metadata === 'string' 
          ? notification.metadata 
          : JSON.stringify(notification.metadata))
      : '{}';
    
    const values = [
      notification.user_id,
      notification.title,
      notification.message,
      notification.notification_type,
      notification.priority,
      notification.is_read,
      notification.is_seen,
      notification.action_url,
      notification.action_label,
      metadata, // Use properly stringified metadata
      notification.expires_at,
      notification.scheduled_for,
      notification.sent_at || new Date()
    ];
    const result = await client.query(query, values);
    return this.parseNotification(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  } finally {
    client.release();
  }
}

  static async createFromDTO(dto: CreateNotificationDTO): Promise<Notification> {
    const notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'> = {
      user_id: dto.user_id,
      title: dto.title,
      message: dto.message,
      notification_type: dto.notification_type || 'system',
      priority: dto.priority || 'normal',
      is_read: false,
      is_seen: false,
      action_url: dto.action_url,
      action_label: dto.action_label,
      metadata: dto.metadata || {},
      expires_at: dto.expires_at,
      scheduled_for: dto.scheduled_for,
      sent_at: new Date()
    };
    
    return await this.create(notification);
  }

  static async findById(id: string): Promise<Notification | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM notifications WHERE id = $1 AND deleted_at IS NULL';
      const result = await client.query(query, [id]);
      return result.rows[0] ? this.parseNotification(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  static async findByUserId(userId: string, filter?: NotificationFilter): Promise<Notification[]> {
    const client = await pool.connect();
    try {
      console.log(`Finding notifications for user: ${userId}, filter:`, filter);
      
      let query = `
        SELECT * FROM notifications 
        WHERE user_id = $1 AND deleted_at IS NULL
      `;
      
      const params: any[] = [userId];
      let paramIndex = 2;
      
      // Apply filters if provided
      if (filter) {
        if (filter.is_read !== undefined) {
          query += ` AND is_read = $${paramIndex}`;
          params.push(filter.is_read);
          paramIndex++;
        }
        
        if (filter.is_seen !== undefined) {
          query += ` AND is_seen = $${paramIndex}`;
          params.push(filter.is_seen);
          paramIndex++;
        }
        
        if (filter.notification_type) {
          query += ` AND notification_type = $${paramIndex}`;
          params.push(filter.notification_type);
          paramIndex++;
        }
        
        if (filter.priority) {
          query += ` AND priority = $${paramIndex}`;
          params.push(filter.priority);
          paramIndex++;
        }
        
        if (filter.start_date) {
          query += ` AND created_at >= $${paramIndex}`;
          params.push(filter.start_date);
          paramIndex++;
        }
        
        if (filter.end_date) {
          query += ` AND created_at <= $${paramIndex}`;
          params.push(filter.end_date);
          paramIndex++;
        }
        
        // Always order by something
        const orderBy = filter.order_by || 'created_at';
        const orderDirection = filter.order_direction || 'DESC';
        query += ` ORDER BY ${orderBy} ${orderDirection}`;
        
        // Apply limit if provided
        if (filter.limit) {
          query += ` LIMIT $${paramIndex}`;
          params.push(filter.limit);
          paramIndex++;
        }
        
        // Apply offset if provided
        if (filter.offset) {
          query += ` OFFSET $${paramIndex}`;
          params.push(filter.offset);
          paramIndex++;
        }
      } else {
        // Default ordering if no filter
        query += ` ORDER BY created_at DESC`;
      }
      
      console.log('Final query:', query);
      console.log('Query params:', params);
      
      const result = await client.query(query, params);
      console.log(`Found ${result.rows.length} notifications for user ${userId}`);
      
      return result.rows.map(row => this.parseNotification(row));
    } catch (error) {
      console.error('Error in findByUserId:', error);
      return [];
    } finally {
      client.release();
    }
  }
  static async update(id: string, updates: Partial<Notification>): Promise<Notification | null> {
    const client = await pool.connect();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at')
        .map((key, index) => {
          if (key === 'metadata') {
            return `${key} = $${index + 2}::jsonb`;
          }
          // Handle special fields
          if (key === 'is_read' && updates.is_read === true) {
            return `${key} = $${index + 2}, read_at = CURRENT_TIMESTAMP`;
          }
          if (key === 'deleted_at' && updates.deleted_at === null) {
            return `${key} = NULL`;
          }
          return `${key} = $${index + 2}`;
        })
        .join(', ');
      
      if (!setClause) return null;
      
      const query = `
        UPDATE notifications 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
      `;
      
      const values = [id, ...Object.values(updates).filter((_, index) => {
        const key = Object.keys(updates)[index];
        return key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at';
      }).map((value, index) => {
        const key = Object.keys(updates).filter(k => k !== 'id' && k !== 'user_id' && k !== 'created_at' && k !== 'updated_at')[index];
        if (key === 'metadata') {
          return JSON.stringify(value);
        }
        return value;
      })];
      
      const result = await client.query(query, values);
      return result.rows[0] ? this.parseNotification(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  static async markAsRead(id: string): Promise<Notification | null> {
    return await this.update(id, { 
      is_read: true,
      is_seen: true // When read, also mark as seen
    });
  }

  static async markAsSeen(id: string): Promise<Notification | null> {
    return await this.update(id, { is_seen: true });
  }

  static async markAllAsRead(userId: string): Promise<number> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE notifications 
        SET is_read = true, is_seen = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL
        RETURNING id
      `;
      const result = await client.query(query, [userId]);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  static async markAllAsSeen(userId: string): Promise<number> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE notifications 
        SET is_seen = true, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_seen = false AND deleted_at IS NULL
        RETURNING id
      `;
      const result = await client.query(query, [userId]);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  static async delete(id: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE notifications 
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
      `;
      const result = await client.query(query, [id]);
      return (result.rowCount || 0) > 0;
    } finally {
      client.release();
    }
  }

  static async hardDelete(id: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const query = 'DELETE FROM notifications WHERE id = $1';
      const result = await client.query(query, [id]);
      return (result.rowCount || 0) > 0;
    } finally {
      client.release();
    }
  }

  static async deleteExpired(): Promise<number> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE notifications 
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE expires_at < CURRENT_TIMESTAMP AND deleted_at IS NULL
      `;
      const result = await client.query(query);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  static async getStats(userId: string): Promise<NotificationStats> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_read = false THEN 1 END) as unread,
          COUNT(CASE WHEN is_seen = false THEN 1 END) as unseen,
          COUNT(CASE WHEN priority = 'urgent' AND is_read = false THEN 1 END) as urgent_unread,
          MAX(created_at) as latest_notification
        FROM notifications 
        WHERE user_id = $1 AND deleted_at IS NULL
      `;
      const result = await client.query(query, [userId]);
      const row = result.rows[0];
      
      // Get counts by type
      const typeQuery = `
        SELECT notification_type, COUNT(*) as count
        FROM notifications 
        WHERE user_id = $1 AND deleted_at IS NULL AND is_read = false
        GROUP BY notification_type
      `;
      const typeResult = await client.query(typeQuery, [userId]);
      const byType: Record<string, number> = {};
      typeResult.rows.forEach((typeRow: any) => {
        byType[typeRow.notification_type] = parseInt(typeRow.count);
      });
      
      return {
        total: parseInt(row.total) || 0,
        unread: parseInt(row.unread) || 0,
        unseen: parseInt(row.unseen) || 0,
        urgent_unread: parseInt(row.urgent_unread) || 0,
        by_type: byType,
        latest_notification: row.latest_notification ? new Date(row.latest_notification) : undefined
      };
    } finally {
      client.release();
    }
  }

  static async createSystemNotification(userId: string, title: string, message: string, priority: Notification['priority'] = 'normal'): Promise<Notification> {
    return await this.createFromDTO({
      user_id: userId,
      title,
      message,
      notification_type: 'system',
      priority
    });
  }

  static async createTransactionNotification(userId: string, title: string, message: string, txHash?: string): Promise<Notification> {
    const metadata = txHash ? { transaction_hash: txHash } : {};
    return await this.createFromDTO({
      user_id: userId,
      title,
      message,
      notification_type: 'transaction',
      priority: 'high',
      metadata
    });
  }

  static async createSecurityNotification(userId: string, title: string, message: string): Promise<Notification> {
    return await this.createFromDTO({
      user_id: userId,
      title,
      message,
      notification_type: 'security',
      priority: 'urgent'
    });
  }

  private static parseNotification(row: any): Notification {
    try {
      return {
        ...row,
        metadata: row.metadata ? 
          (typeof row.metadata === 'string' 
            ? JSON.parse(row.metadata) 
            : row.metadata) 
          : {},
        expires_at: row.expires_at ? new Date(row.expires_at) : undefined,
        scheduled_for: row.scheduled_for ? new Date(row.scheduled_for) : undefined,
        sent_at: row.sent_at ? new Date(row.sent_at) : undefined,
        read_at: row.read_at ? new Date(row.read_at) : undefined,
        deleted_at: row.deleted_at ? new Date(row.deleted_at) : undefined
      };
    } catch (error) {
      console.error('Error parsing notification:', error, 'Row data:', row);
      return {
        ...row,
        metadata: {},
        expires_at: row.expires_at ? new Date(row.expires_at) : undefined,
        scheduled_for: row.scheduled_for ? new Date(row.scheduled_for) : undefined,
        sent_at: row.sent_at ? new Date(row.sent_at) : undefined,
        read_at: row.read_at ? new Date(row.read_at) : undefined,
        deleted_at: row.deleted_at ? new Date(row.deleted_at) : undefined
      };
    }
  }
}

// ============================================================================
// NOTIFICATION PREFERENCES MODEL
// ============================================================================

export class NotificationPreferenceModel {
  static async create(preference: Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationPreference> {
    const client = await pool.connect();
    try {
      // First check if the user exists
      const userCheck = await client.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [preference.user_id]
      );
      
      if (userCheck.rows.length === 0) {
        console.warn(`⚠️ User ${preference.user_id} not found in users table - cannot create preference`);
        throw new Error(`User ${preference.user_id} not found`);
      }
      
      const query = `
        INSERT INTO notification_preferences (
          user_id, notification_type, enabled, email_enabled, push_enabled, sms_enabled,
          quiet_hours_start, quiet_hours_end
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, notification_type) 
        DO UPDATE SET 
          enabled = EXCLUDED.enabled,
          email_enabled = EXCLUDED.email_enabled,
          push_enabled = EXCLUDED.push_enabled,
          sms_enabled = EXCLUDED.sms_enabled,
          quiet_hours_start = EXCLUDED.quiet_hours_start,
          quiet_hours_end = EXCLUDED.quiet_hours_end,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const values = [
        preference.user_id,
        preference.notification_type,
        preference.enabled,
        preference.email_enabled,
        preference.push_enabled,
        preference.sms_enabled,
        preference.quiet_hours_start,
        preference.quiet_hours_end
      ];
      const result = await client.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating notification preference:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByUserId(userId: string): Promise<NotificationPreference[]> {
    const client = await pool.connect();
    try {
      console.log(`Finding notification preferences for user: ${userId}`);
      const query = 'SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY notification_type';
      const result = await client.query(query, [userId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async update(userId: string, notificationType: string, updates: Partial<NotificationPreference>): Promise<NotificationPreference | null> {
    const client = await pool.connect();
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'user_id' && key !== 'notification_type' && key !== 'created_at' && key !== 'updated_at')
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');
      
      if (!setClause) return null;
      
      const query = `
        UPDATE notification_preferences 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND notification_type = $2
        RETURNING *
      `;
      
      const values = [userId, notificationType, ...Object.values(updates).filter((_, index) => {
        const key = Object.keys(updates)[index];
        return key !== 'id' && key !== 'user_id' && key !== 'notification_type' && key !== 'created_at' && key !== 'updated_at';
      })];
      
      const result = await client.query(query, values);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async setDefaultPreferences(userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      console.log(`🔍 [DEBUG] Setting default preferences for user: ${userId}`);
      
      // First, check if user exists
      const userCheck = await client.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        console.warn(`⚠️ [DEBUG] User ${userId} not found in users table`);
        throw new Error(`User ${userId} not found`);
      }
      
      console.log(`✅ [DEBUG] User ${userId} exists, proceeding...`);
      
      const defaultPreferences = [
        { 
          notification_type: 'system', 
          enabled: true,
          push_enabled: false,
          email_enabled: false,
          sms_enabled: false
        },
        { 
          notification_type: 'transaction', 
          enabled: true,
          push_enabled: false,
          email_enabled: false,
          sms_enabled: false
        },
        { 
          notification_type: 'security', 
          enabled: true,
          push_enabled: true,
          email_enabled: true,
          sms_enabled: true
        },
        { 
          notification_type: 'subscription', 
          enabled: true,
          push_enabled: false,
          email_enabled: false,
          sms_enabled: false
        },
        { 
          notification_type: 'wallet', 
          enabled: true,
          push_enabled: false,
          email_enabled: false,
          sms_enabled: false
        },
        { 
          notification_type: 'backup', 
          enabled: true,
          push_enabled: false,
          email_enabled: false,
          sms_enabled: false
        },
        { 
          notification_type: 'emergency', 
          enabled: true,
          push_enabled: true,
          email_enabled: true,
          sms_enabled: true
        },
        { 
          notification_type: 'promotion', 
          enabled: false,
          push_enabled: false,
          email_enabled: false,
          sms_enabled: false
        }
      ];
  
      for (const pref of defaultPreferences) {
        try {
          const query = `
            INSERT INTO notification_preferences (
              user_id, notification_type, enabled, email_enabled, push_enabled, sms_enabled
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id, notification_type) 
            DO UPDATE SET 
              enabled = EXCLUDED.enabled,
              email_enabled = EXCLUDED.email_enabled,
              push_enabled = EXCLUDED.push_enabled,
              sms_enabled = EXCLUDED.sms_enabled,
              updated_at = CURRENT_TIMESTAMP
          `;
          
          await client.query(query, [
            userId,
            pref.notification_type,
            pref.enabled,
            pref.email_enabled,
            pref.push_enabled,
            pref.sms_enabled
          ]);
          
          console.log(`✅ [DEBUG] Created/updated preference: ${pref.notification_type}`);
        } catch (prefError: any) {
          console.error(`❌ [DEBUG] Failed to create preference ${pref.notification_type}:`, prefError.message);
          // Continue with other preferences
        }
      }
      
      console.log(`✅ [DEBUG] Default preferences set for user: ${userId}`);
      
    } catch (error: any) {
      console.error(`❌ [DEBUG] Error setting default preferences for user ${userId}:`, error.message);
      throw error; // Re-throw to be handled by the route
    } finally {
      client.release();
    }
  }

  static async isNotificationAllowed(
    userId: string, 
    notificationType: string, 
    channel: 'push' | 'email' | 'sms' | 'in_app' = 'in_app'
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      // First check if user exists
      const userCheck = await client.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        console.warn(`⚠️ User ${userId} not found - cannot check notification permissions`);
        return false;
      }
      
      const query = `
        SELECT enabled, push_enabled, email_enabled, sms_enabled
        FROM notification_preferences 
        WHERE user_id = $1 AND notification_type = $2
      `;
      const result = await client.query(query, [userId, notificationType]);
      
      if (result.rows.length === 0) {
        // If no preference exists, create default and check
        try {
          await this.setDefaultPreferences(userId);
          // Re-query after creating defaults
          const newResult = await client.query(query, [userId, notificationType]);
          if (newResult.rows.length === 0) {
            return true; // Default to allow if still no preference
          }
          
          const pref = newResult.rows[0];
          return this.checkChannelPermission(pref, channel);
        } catch (error) {
          console.error('Failed to set default preferences:', error);
          return true; // Default to allow in-app if preference creation fails
        }
      }
      
      const pref = result.rows[0];
      return this.checkChannelPermission(pref, channel);
    } finally {
      client.release();
    }
  }
  
  // Helper method to check specific channel permission
  private static checkChannelPermission(
    preference: any, 
    channel: 'push' | 'email' | 'sms' | 'in_app'
  ): boolean {
    // First check if notifications are enabled at all
    if (!preference.enabled) {
      return false;
    }
    
    // Check specific channel
    switch (channel) {
      case 'push':
        return preference.push_enabled === true;
      case 'email':
        return preference.email_enabled === true;
      case 'sms':
        return preference.sms_enabled === true;
      case 'in_app':
      default:
        return true; // In-app notifications are always allowed if enabled=true
    }
  }
  static async getDeliveryChannels(
    userId: string, 
    notificationType: string
  ): Promise<Array<'push' | 'email' | 'sms' | 'in_app'>> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT enabled, push_enabled, email_enabled, sms_enabled
        FROM notification_preferences 
        WHERE user_id = $1 AND notification_type = $2
      `;
      const result = await client.query(query, [userId, notificationType]);
      
      if (result.rows.length === 0) {
        return ['in_app']; // Default to in-app only
      }
      
      const pref = result.rows[0];
      const channels: Array<'push' | 'email' | 'sms' | 'in_app'> = [];
      
      if (pref.enabled) {
        channels.push('in_app'); // Always include in-app if enabled
        
        if (pref.push_enabled) channels.push('push');
        if (pref.email_enabled) channels.push('email');
        if (pref.sms_enabled) channels.push('sms');
      }
      
      return channels;
    } finally {
      client.release();
    }
  }

  static async getQuietHours(userId: string): Promise<{ start: string; end: string } | null> {
    const client = await pool.connect();
    try {
      // Get any preference with quiet hours set
      const query = `
        SELECT quiet_hours_start, quiet_hours_end 
        FROM notification_preferences 
        WHERE user_id = $1 AND quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL
        LIMIT 1
      `;
      const result = await client.query(query, [userId]);
      
      if (result.rows.length > 0) {
        return {
          start: result.rows[0].quiet_hours_start,
          end: result.rows[0].quiet_hours_end
        };
      }
      
      return null;
    } finally {
      client.release();
    }
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
  static async runImageNumberMigration(): Promise<void> {
    const client = await pool.connect();
    try {
      console.log('🔄 Running image_number migration...');
      
      // Check if image_number column exists
      const checkColumn = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'image_number'
      `;
      const columnExists = await client.query(checkColumn);
      
      if (!columnExists.rows.length) {
        // Add image_number column
        const addColumn = `
          ALTER TABLE users 
          ADD COLUMN image_number INTEGER DEFAULT 1 CHECK (image_number IN (1, 2, 3))
        `;
        await client.query(addColumn);
        console.log('✅ Added image_number column to users table');
      } else {
        console.log('✅ image_number column already exists');
      }
      
      console.log('🎉 image_number migration completed successfully!');
      
    } catch (error) {
      console.error('❌ image_number migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Add this method to DatabaseManager class:

  static async runNotificationMigration(): Promise<void> {
    const client = await pool.connect();
    try {
      console.log('🔄 Running notification table migration...');
      
      // Check if notifications table exists
      const checkTable = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'notifications'
        );
      `;
      const tableExists = await client.query(checkTable);
      
      if (!tableExists.rows[0].exists) {
        // Create notifications table
        const createTable = `
          CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            notification_type VARCHAR(50) NOT NULL DEFAULT 'system' CHECK (notification_type IN (
                'system', 'transaction', 'security', 'subscription', 'wallet', 'backup', 'emergency', 'promotion'
            )),
            priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
            is_read BOOLEAN DEFAULT FALSE,
            is_seen BOOLEAN DEFAULT FALSE,
            action_url TEXT,
            action_label VARCHAR(100),
            metadata JSONB DEFAULT '{}'::jsonb,
            expires_at TIMESTAMPTZ,
            scheduled_for TIMESTAMPTZ,
            sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
          );
        `;
        await client.query(createTable);
        console.log('✅ Created notifications table');
        
        // Create notification_preferences table WITHOUT default quiet hours
        const createPreferencesTable = `
          CREATE TABLE notification_preferences (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id VARCHAR(50) NOT NULL,
            notification_type VARCHAR(50) NOT NULL,
            enabled BOOLEAN DEFAULT TRUE,
            email_enabled BOOLEAN DEFAULT FALSE,
            push_enabled BOOLEAN DEFAULT TRUE,
            sms_enabled BOOLEAN DEFAULT FALSE,
            quiet_hours_start TIME, -- CHANGED: No default, optional
            quiet_hours_end TIME,   -- CHANGED: No default, optional
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            UNIQUE(user_id, notification_type)
          );
        `;
        await client.query(createPreferencesTable);
        console.log('✅ Created notification_preferences table (quiet hours optional)');
        
        // Create indexes
        const createIndexes = `
          CREATE INDEX idx_notifications_user_id ON notifications(user_id);
          CREATE INDEX idx_notifications_is_read ON notifications(is_read);
          CREATE INDEX idx_notifications_is_seen ON notifications(is_seen);
          CREATE INDEX idx_notifications_notification_type ON notifications(notification_type);
          CREATE INDEX idx_notifications_priority ON notifications(priority);
          CREATE INDEX idx_notifications_created_at ON notifications(created_at);
          CREATE INDEX idx_notifications_expires_at ON notifications(expires_at);
          CREATE INDEX idx_notifications_scheduled_for ON notifications(scheduled_for);
          CREATE INDEX idx_notifications_deleted_at ON notifications(deleted_at) WHERE deleted_at IS NOT NULL;
          
          CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
          CREATE INDEX idx_notification_preferences_enabled ON notification_preferences(enabled);
        `;
        await client.query(createIndexes);
        console.log('✅ Created notification indexes');
        
        // Create triggers
        const createTriggers = `
          CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            
          CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `;
        await client.query(createTriggers);
        console.log('✅ Created notification triggers');
        
        // Create view
        const createView = `
          CREATE OR REPLACE VIEW user_notification_summary AS
          SELECT 
              u.user_id,
              u.email,
              u.name,
              u.username,
              COUNT(n.id) as total_notifications,
              COUNT(CASE WHEN n.is_read = false THEN 1 END) as unread_count,
              COUNT(CASE WHEN n.is_seen = false THEN 1 END) as unseen_count,
              COUNT(CASE WHEN n.priority = 'urgent' AND n.is_read = false THEN 1 END) as urgent_unread_count,
              MAX(n.created_at) as latest_notification_time
          FROM users u
          LEFT JOIN notifications n ON u.user_id = n.user_id AND n.deleted_at IS NULL
          GROUP BY u.user_id, u.email, u.name, u.username;
        `;
        await client.query(createView);
        console.log('✅ Created user_notification_summary view');
      } else {
        console.log('✅ Notifications table already exists');
        
        // Check if we need to alter existing table to remove defaults
        const checkColumnDefaults = `
          SELECT column_default 
          FROM information_schema.columns 
          WHERE table_name = 'notification_preferences' 
          AND column_name IN ('quiet_hours_start', 'quiet_hours_end')
        `;
        const columnDefaults = await client.query(checkColumnDefaults);
        
        if (columnDefaults.rows.length > 0) {
          console.log('🔄 Updating existing notification_preferences table to remove quiet hour defaults...');
          
          // Remove defaults from quiet_hours columns
          const alterTable = `
            ALTER TABLE notification_preferences 
            ALTER COLUMN quiet_hours_start DROP DEFAULT,
            ALTER COLUMN quiet_hours_end DROP DEFAULT;
          `;
          await client.query(alterTable);
          console.log('✅ Removed default values from quiet_hours columns');
          
          // Update existing rows to set quiet_hours to NULL where they have defaults
          const updateExistingRows = `
            UPDATE notification_preferences 
            SET quiet_hours_start = NULL, quiet_hours_end = NULL
            WHERE quiet_hours_start = '22:00:00' AND quiet_hours_end = '07:00:00';
          `;
          const result = await client.query(updateExistingRows);
          console.log(`✅ Updated ${result.rowCount} rows to remove default quiet hours`);
        }
      }
      
      console.log('🎉 Notification migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Notification migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  

  // Update runAllMigrations to include image_number migration
  static async runAllMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting all database migrations...\n');
      
      // 1. Initialize database schema
      await this.initializeDatabase();
      console.log('');
      
      // 2. Run image_number migration
      await this.runImageNumberMigration();
      console.log('');
      
      // 3. Run auth methods migration
      await this.runAuthMethodsMigration();
      console.log('');
      
      // 4. Run payment and subscription migration
      await this.runPaymentMigration();
      console.log('');
      
      // 5. Run notification migration
      await this.runNotificationMigration();
      console.log('');
      
      // 6. Migrate data from JSON files
      await this.migrateFromJSON();
      console.log('');
      
      // 7. Check final database health
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