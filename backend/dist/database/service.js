import { UserModel, UserDepositModel, TransactionModel } from './models.js';
import pool from './config.js';
// ============================================================================
// DATABASE SERVICE
// ============================================================================
export class DatabaseService {
    // ============================================================================
    // USER OPERATIONS
    // ============================================================================
    async createUser(userData) {
        return await UserModel.create({
            user_id: userData.userId,
            email: userData.email,
            name: userData.name,
            wallet_address: userData.walletAddress,
            phone_hash: userData.phoneHash,
            zk_commitment: userData.zkCommitment
        });
    }
    async getUserById(userId) {
        return await UserModel.findByUserId(userId);
    }
    async getUserByWalletAddress(walletAddress) {
        return await UserModel.findByWalletAddress(walletAddress);
    }
    async updateUser(userId, updates) {
        return await UserModel.update(userId, updates);
    }
    async getAllUsers() {
        return await UserModel.getAll();
    }
    // ============================================================================
    // DEPOSIT OPERATIONS
    // ============================================================================
    async createDeposit(depositData) {
        return await UserDepositModel.create({
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
    }
    async getDepositByUserAddress(userAddress) {
        return await UserDepositModel.findByUserAddress(userAddress);
    }
    async getDepositsByUserId(userId) {
        return await UserDepositModel.findByUserId(userId);
    }
    async updateDeposit(userAddress, updates) {
        return await UserDepositModel.update(userAddress, updates);
    }
    async getAllDeposits() {
        return await UserDepositModel.getAll();
    }
    async getUnverifiedDeposits() {
        return await UserDepositModel.getUnverified();
    }
    // ============================================================================
    // VERIFICATION OPERATIONS
    // ============================================================================
    async markDepositAsVerified(userAddress, txHash) {
        const updates = {
            verified: true,
            last_verification_attempt: new Date()
        };
        if (txHash) {
            updates.tx_hash = txHash;
        }
        return await this.updateDeposit(userAddress, updates);
    }
    async incrementVerificationAttempts(userAddress) {
        const deposit = await this.getDepositByUserAddress(userAddress);
        if (!deposit)
            return null;
        return await this.updateDeposit(userAddress, {
            verification_attempts: deposit.verification_attempts + 1,
            last_verification_attempt: new Date()
        });
    }
    async markSignupCompleted(userAddress, txHash) {
        return await this.updateDeposit(userAddress, {
            signup_completed: true,
            tx_hash: txHash
        });
    }
    async markRefunded(userAddress, refundTxHash) {
        return await this.updateDeposit(userAddress, {
            refunded: true,
            refund_tx_hash: refundTxHash,
            refund_timestamp: new Date()
        });
    }
    // ============================================================================
    // TRANSACTION OPERATIONS
    // ============================================================================
    async createTransaction(transactionData) {
        return await TransactionModel.create({
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
    }
    async getTransactionByHash(txHash) {
        return await TransactionModel.findByTxHash(txHash);
    }
    async updateTransactionStatus(txHash, status, confirmations) {
        return await TransactionModel.updateStatus(txHash, status, confirmations);
    }
    // ============================================================================
    // LEGACY COMPATIBILITY METHODS
    // ============================================================================
    /**
     * Load deposits in the format expected by the existing K33P manager
     * This maintains compatibility with existing code
     */
    async loadDeposits() {
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
    async saveDeposits(deposits) {
        // This method is now a no-op since we save directly to database
        // But we keep it for compatibility
        console.log('saveDeposits called - data is automatically persisted to database');
    }
    /**
     * Find a deposit by user address (legacy format)
     */
    async findDepositByUserAddress(userAddress) {
        const deposit = await this.getDepositByUserAddress(userAddress);
        if (!deposit)
            return null;
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
    async getStatistics() {
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
        }
        finally {
            client.release();
        }
    }
    // ============================================================================
    // CLEANUP AND MAINTENANCE
    // ============================================================================
    async cleanupOldRecords(daysOld = 30) {
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
        }
        finally {
            client.release();
        }
    }
}
// Export singleton instance
export const dbService = new DatabaseService();
//# sourceMappingURL=service.js.map