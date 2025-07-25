import fs from 'fs';
import path from 'path';
import { User, UserDeposit, Transaction } from './models.js';

// Get directory path for ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Mock database service that uses JSON files instead of PostgreSQL
export class MockDatabaseService {
  private static basePath = process.cwd();
  
  // Load mock data from JSON files
  private static loadMockData(filename: string): any[] {
    try {
      const filePath = path.join(this.basePath, filename);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.warn(`Warning: Could not load ${filename}:`, error);
      return [];
    }
  }

  // Save mock data to JSON files
  private static saveMockData(filename: string, data: any[]): void {
    try {
      const filePath = path.join(this.basePath, filename);
      // Custom replacer to handle BigInt values
      const replacer = (key: string, value: any) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      };
      fs.writeFileSync(filePath, JSON.stringify(data, replacer, 2));
    } catch (error) {
      console.error(`Error saving ${filename}:`, error);
    }
  }

  // User operations
  static async getAllUsers(): Promise<User[]> {
    const mockDb: any = this.loadMockData('dist/utils/mock-db.json');
    return (mockDb && mockDb.users) ? mockDb.users : [];
  }

  static async findUserByAddress(address: string): Promise<User | null> {
    const users = await this.getAllUsers();
    return users.find(user => user.wallet_address === address) || null;
  }

  static async findUserById(userId: string): Promise<User | null> {
    const users = await this.getAllUsers();
    return users.find(user => user.user_id === userId) || null;
  }

  // User deposit operations
  static async getAllUserDeposits(): Promise<UserDeposit[]> {
    return this.loadMockData('user-deposits.json');
  }

  static async findDepositByUserAddress(userAddress: string): Promise<UserDeposit | null> {
    const deposits = await this.getAllUserDeposits();
    return deposits.find(deposit => deposit.user_address === userAddress) || null;
  }

  static async findDepositsByUserId(userId: string): Promise<UserDeposit[]> {
    const deposits = await this.getAllUserDeposits();
    return deposits.filter(deposit => deposit.user_id === userId);
  }

  static async updateDepositRefundStatus(userAddress: string, refunded: boolean, refundTxHash?: string): Promise<boolean> {
    const deposits = await this.getAllUserDeposits();
    const depositIndex = deposits.findIndex(deposit => 
      deposit.user_address === userAddress
    );
    
    if (depositIndex !== -1) {
      deposits[depositIndex].refunded = refunded;
      if (refundTxHash) {
        deposits[depositIndex].refund_tx_hash = refundTxHash;
        deposits[depositIndex].refund_timestamp = new Date();
      }
      this.saveMockData('user-deposits.json', deposits);
      return true;
    }
    return false;
  }

  // Transaction operations
  static async getAllTransactions(): Promise<Transaction[]> {
    return this.loadMockData('transactions.json');
  }

  static async findTransactionByHash(txHash: string): Promise<Transaction | null> {
    const transactions = await this.getAllTransactions();
    return transactions.find(tx => tx.tx_hash === txHash) || null;
  }

  static async createTransaction(transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
    const transactions = await this.getAllTransactions();
    const newTransaction: Transaction = {
      id: `mock-tx-${Date.now()}`,
      ...transaction,
      created_at: new Date()
    };
    transactions.push(newTransaction);
    this.saveMockData('transactions.json', transactions);
    return newTransaction;
  }

  // Test connection (always returns true for mock)
  static async testConnection(): Promise<boolean> {
    console.log('✅ Mock database connection successful');
    return true;
  }

  // Initialize mock database (create empty files if they don't exist)
  static async initialize(): Promise<void> {
    console.log('📋 Initializing mock database...');
    
    // Ensure transactions.json exists
    if (!fs.existsSync(path.join(this.basePath, 'transactions.json'))) {
      this.saveMockData('transactions.json', []);
    }
    
    // Ensure user-deposits.json exists
    if (!fs.existsSync(path.join(this.basePath, 'user-deposits.json'))) {
      this.saveMockData('user-deposits.json', []);
    }
    
    console.log('✅ Mock database initialized successfully!');
  }

  // Additional methods to match DatabaseService interface
  static async getUserById(userId: string): Promise<User | null> {
    return this.findUserById(userId);
  }

  static async getDepositByUserAddress(userAddress: string): Promise<UserDeposit | null> {
    return this.findDepositByUserAddress(userAddress);
  }

  static async createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const users = await this.getAllUsers();
    const newUser: User = {
      id: `mock-user-${Date.now()}`,
      ...userData,
      created_at: new Date()
    };
    
    // Load existing mock db
    const mockDb: any = this.loadMockData('dist/utils/mock-db.json') || { users: [] };
    if (!mockDb.users) mockDb.users = [];
    
    mockDb.users.push(newUser);
    this.saveMockData('dist/utils/mock-db.json', mockDb);
    return newUser;
  }

  static async createDeposit(depositData: Omit<UserDeposit, 'id' | 'created_at'>): Promise<UserDeposit> {
    const deposits = await this.getAllUserDeposits();
    const newDeposit: UserDeposit = {
      id: `mock-deposit-${Date.now()}`,
      ...depositData,
      created_at: new Date()
    };
    deposits.push(newDeposit);
    this.saveMockData('user-deposits.json', deposits);
    return newDeposit;
  }

  static async updateDeposit(userAddress: string, updates: Partial<UserDeposit>): Promise<boolean> {
    const deposits = await this.getAllUserDeposits();
    const depositIndex = deposits.findIndex(deposit => 
      deposit.user_address === userAddress
    );
    
    if (depositIndex !== -1) {
      deposits[depositIndex] = { ...deposits[depositIndex], ...updates };
      this.saveMockData('user-deposits.json', deposits);
      return true;
    }
    return false;
  }

  static async markRefunded(userAddress: string, refundTxHash: string): Promise<boolean> {
    return this.updateDepositRefundStatus(userAddress, true, refundTxHash);
  }

  static async incrementVerificationAttempts(userAddress: string): Promise<boolean> {
    const deposits = await this.getAllUserDeposits();
    const depositIndex = deposits.findIndex(deposit => 
      deposit.user_address === userAddress
    );
    
    if (depositIndex !== -1) {
      deposits[depositIndex].verification_attempts = (deposits[depositIndex].verification_attempts || 0) + 1;
      this.saveMockData('user-deposits.json', deposits);
      return true;
    }
    return false;
  }

  static async markDepositAsVerified(userAddress: string, txHash: string): Promise<boolean> {
    return this.updateDeposit(userAddress, { verified: true, tx_hash: txHash });
  }

  static async getUnverifiedDeposits(): Promise<UserDeposit[]> {
    const deposits = await this.getAllUserDeposits();
    return deposits.filter(deposit => !deposit.verified);
  }
}

// Export a flag to indicate we're using mock database
export const USING_MOCK_DATABASE = true;