import pool from './config.js';
// ============================================================================
// USER MODEL
// ============================================================================
export class UserModel {
    static async create(user) {
        const client = await pool.connect();
        try {
            const query = `
        INSERT INTO users (user_id, email, name, wallet_address, phone_hash, zk_commitment)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
            const values = [user.user_id, user.email, user.name, user.wallet_address, user.phone_hash, user.zk_commitment];
            const result = await client.query(query, values);
            return result.rows[0];
        }
        finally {
            client.release();
        }
    }
    static async findByUserId(userId) {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM users WHERE user_id = $1';
            const result = await client.query(query, [userId]);
            return result.rows[0] || null;
        }
        finally {
            client.release();
        }
    }
    static async findByWalletAddress(walletAddress) {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM users WHERE wallet_address = $1';
            const result = await client.query(query, [walletAddress]);
            return result.rows[0] || null;
        }
        finally {
            client.release();
        }
    }
    static async update(userId, updates) {
        const client = await pool.connect();
        try {
            const setClause = Object.keys(updates)
                .filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at')
                .map((key, index) => `${key} = $${index + 2}`)
                .join(', ');
            if (!setClause)
                return null;
            const query = `
        UPDATE users 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;
            const values = [userId, ...Object.values(updates).filter((_, index) => {
                    const key = Object.keys(updates)[index];
                    return key !== 'id' && key !== 'user_id' && key !== 'created_at';
                })];
            const result = await client.query(query, values);
            return result.rows[0] || null;
        }
        finally {
            client.release();
        }
    }
    static async getAll() {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM users ORDER BY created_at DESC';
            const result = await client.query(query);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
}
// ============================================================================
// USER DEPOSIT MODEL
// ============================================================================
export class UserDepositModel {
    static async create(deposit) {
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
        }
        finally {
            client.release();
        }
    }
    static async findByUserAddress(userAddress) {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM user_deposits WHERE user_address = $1 ORDER BY timestamp DESC LIMIT 1';
            const result = await client.query(query, [userAddress]);
            if (result.rows.length === 0)
                return null;
            const row = result.rows[0];
            return {
                ...row,
                amount: BigInt(row.amount)
            };
        }
        finally {
            client.release();
        }
    }
    static async findByUserId(userId) {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM user_deposits WHERE user_id = $1 ORDER BY timestamp DESC';
            const result = await client.query(query, [userId]);
            return result.rows.map(row => ({
                ...row,
                amount: BigInt(row.amount)
            }));
        }
        finally {
            client.release();
        }
    }
    static async update(userAddress, updates) {
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
            if (!setClause)
                return null;
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
            if (result.rows.length === 0)
                return null;
            const row = result.rows[0];
            return {
                ...row,
                amount: BigInt(row.amount)
            };
        }
        finally {
            client.release();
        }
    }
    static async getAll() {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM user_deposits ORDER BY timestamp DESC';
            const result = await client.query(query);
            return result.rows.map(row => ({
                ...row,
                amount: BigInt(row.amount)
            }));
        }
        finally {
            client.release();
        }
    }
    static async getUnverified() {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM user_deposits WHERE verified = false ORDER BY timestamp ASC';
            const result = await client.query(query);
            return result.rows.map(row => ({
                ...row,
                amount: BigInt(row.amount)
            }));
        }
        finally {
            client.release();
        }
    }
}
// ============================================================================
// TRANSACTION MODEL
// ============================================================================
export class TransactionModel {
    static async create(transaction) {
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
        }
        finally {
            client.release();
        }
    }
    static async findByTxHash(txHash) {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM transactions WHERE tx_hash = $1';
            const result = await client.query(query, [txHash]);
            if (result.rows.length === 0)
                return null;
            const row = result.rows[0];
            return {
                ...row,
                amount: BigInt(row.amount)
            };
        }
        finally {
            client.release();
        }
    }
    static async updateStatus(txHash, status, confirmations) {
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
            if (result.rows.length === 0)
                return null;
            const row = result.rows[0];
            return {
                ...row,
                amount: BigInt(row.amount)
            };
        }
        finally {
            client.release();
        }
    }
    static async getAll() {
        const client = await pool.connect();
        try {
            const query = 'SELECT * FROM transactions ORDER BY created_at DESC';
            const result = await client.query(query);
            return result.rows.map(row => ({
                ...row,
                amount: BigInt(row.amount)
            }));
        }
        finally {
            client.release();
        }
    }
}
// ============================================================================
// DATABASE MIGRATION AND INITIALIZATION
// ============================================================================
export class DatabaseManager {
    static async initializeDatabase() {
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
        }
        catch (error) {
            console.error('❌ Failed to initialize database schema:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async migrateFromJSON() {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            // Migrate user-deposits.json
            const depositsPath = path.join(__dirname, '../../user-deposits.json');
            if (fs.existsSync(depositsPath)) {
                const depositsData = JSON.parse(fs.readFileSync(depositsPath, 'utf8'));
                for (const deposit of depositsData) {
                    // Create user if not exists
                    const existingUser = await UserModel.findByUserId(deposit.userId);
                    if (!existingUser) {
                        await UserModel.create({
                            user_id: deposit.userId,
                            wallet_address: deposit.userAddress,
                            phone_hash: deposit.phoneHash
                        });
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
                    }
                }
                console.log(`✅ Migrated ${depositsData.length} deposits from JSON to database`);
            }
            // Migrate mock-db.json
            const mockDbPath = path.join(__dirname, '../utils/mock-db.json');
            if (fs.existsSync(mockDbPath)) {
                const mockData = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
                for (const user of mockData.users || []) {
                    const existingUser = await UserModel.findByUserId(user.id);
                    if (!existingUser) {
                        await UserModel.create({
                            user_id: user.id,
                            email: user.email,
                            name: user.name,
                            wallet_address: user.walletAddress,
                            phone_hash: user.phoneHash,
                            zk_commitment: user.zkCommitment
                        });
                    }
                }
                console.log(`✅ Migrated ${mockData.users?.length || 0} users from mock database`);
            }
        }
        catch (error) {
            console.error('❌ Failed to migrate data from JSON:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=models.js.map