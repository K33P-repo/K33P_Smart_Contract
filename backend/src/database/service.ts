import { UserModel, UserDepositModel, TransactionModel, User, UserDeposit, Transaction, AuthMethod } from './models.js';
import pool from './config.js';
import { ZKProofService } from '../services/zk-proof-service.js';

// ============================================================================
// DATABASE SERVICE
// ============================================================================

export class DatabaseService {
  
  // ============================================================================
  // USER OPERATIONS
  // ============================================================================
  
  async createUser(userData: {
    userId: string;
    email?: string;
    name?: string;
    walletAddress?: string;
    phoneNumber?: string;
    phoneHash?: string;
    zkCommitment?: string;
    pinHash?: string; 
    authMethods: AuthMethod[];  
    folders?: any[]; 
  }): Promise<User> {
    
    // Create default auth methods if not provided
    const defaultAuthMethods: AuthMethod[] = [
      {
        type: 'phone',
        createdAt: new Date()
      },
      {
        type: 'pin',
        data: userData.pinHash || 'pending-pin-setup',
        createdAt: new Date()
      },
      {
        type: 'fingerprint',
        createdAt: new Date()
      }
    ];

    const user = await UserModel.create({
      user_id: userData.userId,
      email: userData.email,
      name: userData.name,
      wallet_address: userData.walletAddress,
      phone_hash: userData.phoneHash,
      pin_hash: userData.pinHash,
      zk_commitment: userData.zkCommitment,
      auth_methods: userData.authMethods || defaultAuthMethods,  
      folders: userData.folders || []                            
    });
    
    try {
      if (userData.phoneNumber) {
        await ZKProofService.generateAndStoreUserZKProof(userData);
        console.log(`✅ ZK proof generated for user creation: ${userData.userId}`);
      } else {
        console.log(`⚠️ Skipping ZK proof generation for user ${userData.userId} - no phone number provided`);
      }
    } catch (zkError) {
      console.error('Failed to generate ZK proof for user creation:', zkError);
    }
    
    return user;
  }
  
  async getUserById(userId: string): Promise<User | null> {
    return await UserModel.findByUserId(userId);
  }
  
  async getUserByWalletAddress(walletAddress: string): Promise<User | null> {
    return await UserModel.findByWalletAddress(walletAddress);
  }
  
  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    return await UserModel.update(userId, updates);
  }
  
  async getAllUsers(): Promise<User[]> {
    return await UserModel.getAll();
  }
  
  // ============================================================================
  // DEPOSIT OPERATIONS
  // ============================================================================
  
  async createDeposit(depositData: {
    userAddress: string;
    userId: string;
    phoneHash: string;
    zkProof?: string;
    zkCommitment?: string;
    txHash?: string;
    amount: bigint;
    senderWalletAddress?: string;
    pinHash?: string;
    biometricHash?: string;
    biometricType?: 'fingerprint' | 'faceid' | 'voice' | 'iris';
    verificationMethod?: 'phone' | 'pin' | 'biometric';
  }): Promise<UserDeposit> {
    const deposit = await UserDepositModel.create({
      user_address: depositData.userAddress,
      user_id: depositData.userId,
      phone_hash: depositData.phoneHash,
      zk_proof: depositData.zkProof,
      zk_commitment: depositData.zkCommitment,
      tx_hash: depositData.txHash,
      amount: depositData.amount,
      refunded: false,
      signup_completed: false,
      verified: false,
      verification_attempts: 0,
      pin_hash: depositData.pinHash,
      biometric_hash: depositData.biometricHash,
      biometric_type: depositData.biometricType,
      verification_method: depositData.verificationMethod || 'phone',
      sender_wallet_address: depositData.senderWalletAddress
    });
    
    // Generate and store ZK proof for deposit creation
    try {
      await ZKProofService.generateAndStoreDataZKProof(
        depositData.userId,
        'deposit_creation',
        {
          userAddress: depositData.userAddress,
          amount: depositData.amount.toString(),
          phoneHash: depositData.phoneHash,
          txHash: depositData.txHash,
          verificationMethod: depositData.verificationMethod,
          timestamp: new Date().toISOString()
        }
      );
      console.log(`✅ ZK proof generated for deposit creation: ${depositData.userId}`);
    } catch (zkError) {
      console.error('Failed to generate ZK proof for deposit creation:', zkError);
      // Don't fail deposit creation if ZK proof generation fails
    }
    
    return deposit;
  }
  
  async getDepositByUserAddress(userAddress: string): Promise<UserDeposit | null> {
    return await UserDepositModel.findByUserAddress(userAddress);
  }
  
  async getDepositsByUserId(userId: string): Promise<UserDeposit[]> {
    return await UserDepositModel.findByUserId(userId);
  }
  
  async updateDeposit(userAddress: string, updates: Partial<UserDeposit>): Promise<UserDeposit | null> {
    return await UserDepositModel.update(userAddress, updates);
  }
  
  async getAllDeposits(): Promise<UserDeposit[]> {
    return await UserDepositModel.getAll();
  }
  
  async getUnverifiedDeposits(): Promise<UserDeposit[]> {
    return await UserDepositModel.getUnverified();
  }

  
  
  // ============================================================================
  // VERIFICATION OPERATIONS
  // ============================================================================
  
  async markDepositAsVerified(userAddress: string, txHash?: string): Promise<UserDeposit | null> {
    const updates: Partial<UserDeposit> = {
      verified: true,
      last_verification_attempt: new Date()
    };
    
    if (txHash) {
      updates.tx_hash = txHash;
    }
    
    return await this.updateDeposit(userAddress, updates);
  }

// In database/service.ts - update the markRefunded method
  
  async incrementVerificationAttempts(userAddress: string): Promise<UserDeposit | null> {
    const deposit = await this.getDepositByUserAddress(userAddress);
    if (!deposit) return null;
    
    return await this.updateDeposit(userAddress, {
      verification_attempts: deposit.verification_attempts + 1,
      last_verification_attempt: new Date()
    });
  }
  
  async markSignupCompleted(userAddress: string, txHash: string): Promise<UserDeposit | null> {
    return await this.updateDeposit(userAddress, {
      signup_completed: true,
      tx_hash: txHash
    });
  }
  
  async markRefunded(userAddress: string, refundTxHash: string): Promise<UserDeposit | null> {
    const updates: any = {
      refunded: true,
      refund_tx_hash: refundTxHash,
      refund_timestamp: new Date(),
      verified: false,
      signup_completed: false,
      verification_attempts: 0
    };
    
    // Only include fields that need to be cleared if they exist
    const deposit = await this.getDepositByUserAddress(userAddress);
    if (deposit?.tx_hash) {
      updates.tx_hash = undefined;
    }
    if (deposit?.last_verification_attempt) {
      updates.last_verification_attempt = undefined;
    }
    
    return await this.updateDeposit(userAddress, updates);
  }
  
  // ============================================================================
  // TRANSACTION OPERATIONS
  // ============================================================================
  
  async createTransaction(transactionData: {
    txHash: string;
    fromAddress: string;
    toAddress: string;
    amount: bigint;
    confirmations: number;
    blockTime?: Date;
    transactionType: 'deposit' | 'refund' | 'signup';
    status?: 'pending' | 'confirmed' | 'failed';
    userDepositId?: string;
  }): Promise<Transaction> {
    const transaction = await TransactionModel.create({
      tx_hash: transactionData.txHash,
      from_address: transactionData.fromAddress,
      to_address: transactionData.toAddress,
      amount: transactionData.amount,
      confirmations: transactionData.confirmations,
      block_time: transactionData.blockTime,
      transaction_type: transactionData.transactionType,
      status: transactionData.status || 'pending',
      user_deposit_id: transactionData.userDepositId
    });
    
    // Generate and store ZK proof for transaction creation
    try {
      // Only generate ZK proof if we have a valid user deposit ID that corresponds to an existing user
      if (transactionData.userDepositId) {
        // First check if the user exists in the database
        const existingUser = await this.getUserById(transactionData.userDepositId);
        if (existingUser) {
          await ZKProofService.generateAndStoreDataZKProof(
            transactionData.userDepositId,
            'transaction_creation',
            {
              txHash: transactionData.txHash,
              fromAddress: transactionData.fromAddress,
              toAddress: transactionData.toAddress,
              amount: transactionData.amount.toString(),
              transactionType: transactionData.transactionType,
              status: transactionData.status || 'pending',
              confirmations: transactionData.confirmations,
              timestamp: new Date().toISOString()
            }
          );
          console.log(`✅ ZK proof generated for transaction creation: ${transactionData.txHash}`);
        } else {
          console.log(`⚠️ Skipping ZK proof generation - user ${transactionData.userDepositId} not found in database`);
        }
      } else {
        console.log(`⚠️ Skipping ZK proof generation - no valid user deposit ID provided`);
      }
    } catch (zkError) {
      console.error('Failed to generate ZK proof for transaction creation:', zkError);
      // Don't fail transaction creation if ZK proof generation fails
    }
    
    return transaction;
  }
  
  async getTransactionByHash(txHash: string): Promise<Transaction | null> {
    return await TransactionModel.findByTxHash(txHash);
  }
  
  async updateTransactionStatus(
    txHash: string, 
    status: 'pending' | 'confirmed' | 'failed', 
    confirmations?: number
  ): Promise<Transaction | null> {
    return await TransactionModel.updateStatus(txHash, status, confirmations);
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await TransactionModel.getAll();
  }
  
  // ============================================================================
  // LEGACY COMPATIBILITY METHODS
  // ============================================================================
  
  /**
   * Load deposits in the format expected by the existing K33P manager
   * This maintains compatibility with existing code
   */
  async loadDeposits(): Promise<any[]> {
    const deposits = await this.getAllDeposits();
    return deposits.map(deposit => ({
      userAddress: deposit.user_address,
      userId: deposit.user_id,
      phoneHash: deposit.phone_hash,
      zkProof: deposit.zk_proof,
      zkCommitment: deposit.zk_commitment,
      txHash: deposit.tx_hash,
      amount: deposit.amount.toString(),
      timestamp: deposit.timestamp?.toISOString(),
      refunded: deposit.refunded,
      signupCompleted: deposit.signup_completed,
      verified: deposit.verified,
      verificationAttempts: deposit.verification_attempts,
      lastVerificationAttempt: deposit.last_verification_attempt?.toISOString(),
      pinHash: deposit.pin_hash,
      biometricHash: deposit.biometric_hash,
      biometricType: deposit.biometric_type,
      verificationMethod: deposit.verification_method,
      refundTxHash: deposit.refund_tx_hash,
      refundTimestamp: deposit.refund_timestamp?.toISOString(),
      senderWalletAddress: deposit.sender_wallet_address
    }));
  }
  
  /**
   * Save deposits in the format expected by the existing K33P manager
   * This maintains compatibility with existing code
   */
  async saveDeposits(deposits: any[]): Promise<void> {
    // This method is now a no-op since we save directly to database
    // But we keep it for compatibility
    console.log('saveDeposits called - data is automatically persisted to database');
  }
  
  /**
   * Find a deposit by user address (legacy format)
   */
  async findDepositByUserAddress(userAddress: string): Promise<any | null> {
    const deposit = await this.getDepositByUserAddress(userAddress);
    if (!deposit) return null;
    
    return {
      userAddress: deposit.user_address,
      userId: deposit.user_id,
      phoneHash: deposit.phone_hash,
      zkProof: deposit.zk_proof,
      zkCommitment: deposit.zk_commitment,
      txHash: deposit.tx_hash,
      amount: deposit.amount.toString(),
      timestamp: deposit.timestamp?.toISOString(),
      refunded: deposit.refunded,
      signupCompleted: deposit.signup_completed,
      verified: deposit.verified,
      verificationAttempts: deposit.verification_attempts,
      lastVerificationAttempt: deposit.last_verification_attempt?.toISOString(),
      pinHash: deposit.pin_hash,
      biometricHash: deposit.biometric_hash,
      biometricType: deposit.biometric_type,
      verificationMethod: deposit.verification_method,
      refundTxHash: deposit.refund_tx_hash,
      refundTimestamp: deposit.refund_timestamp?.toISOString(),
      senderWalletAddress: deposit.sender_wallet_address
    };
  }
  
  // ============================================================================
  // STATISTICS AND REPORTING
  // ============================================================================
  
  async getStatistics(): Promise<{
    totalUsers: number;
    totalDeposits: number;
    verifiedDeposits: number;
    refundedDeposits: number;
    completedSignups: number;
    totalDepositAmount: string;
    totalRefundAmount: string;
  }> {
    const client = await pool.connect();
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(ud.id) as total_deposits,
          COUNT(CASE WHEN ud.verified = true THEN 1 END) as verified_deposits,
          COUNT(CASE WHEN ud.refunded = true THEN 1 END) as refunded_deposits,
          COUNT(CASE WHEN ud.signup_completed = true THEN 1 END) as completed_signups,
          COALESCE(SUM(ud.amount), 0) as total_deposit_amount,
          COALESCE(SUM(CASE WHEN ud.refunded = true THEN ud.amount ELSE 0 END), 0) as total_refund_amount
        FROM users u
        LEFT JOIN user_deposits ud ON u.user_id = ud.user_id
      `;
      
      const result = await client.query(statsQuery);
      const stats = result.rows[0];
      
      return {
        totalUsers: parseInt(stats.total_users),
        totalDeposits: parseInt(stats.total_deposits),
        verifiedDeposits: parseInt(stats.verified_deposits),
        refundedDeposits: parseInt(stats.refunded_deposits),
        completedSignups: parseInt(stats.completed_signups),
        totalDepositAmount: stats.total_deposit_amount.toString(),
        totalRefundAmount: stats.total_refund_amount.toString()
      };
    } finally {
      client.release();
    }
  }
  
  // ============================================================================
  // CLEANUP AND MAINTENANCE
  // ============================================================================
  
  async cleanupOldRecords(daysOld: number = 30): Promise<number> {
    const client = await pool.connect();
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const query = `
        DELETE FROM user_deposits 
        WHERE timestamp < $1 
        AND refunded = true 
        AND signup_completed = false
      `;
      
      const result = await client.query(query, [cutoffDate]);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }


// Add this method to your DatabaseService class, before the createZKProof method:

async getUserByPhoneHash(phoneHash: string): Promise<any | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE phone_hash = $1',
      [phoneHash]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

// Then your existing createZKProof method:
async createZKProof(proofData: any): Promise<any> {
  const client = await pool.connect();
  try {
    const { user_id, commitment, proof, public_inputs, is_valid } = proofData;
    const result = await client.query(
      'INSERT INTO zk_proofs (user_id, commitment, proof, public_inputs, is_valid) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, commitment, proof, public_inputs, is_valid]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
}



// Export singleton instance
export const dbService = new DatabaseService();