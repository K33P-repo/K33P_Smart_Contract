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
    data?: string;
    createdAt: Date;
    lastUsed?: Date;
}
export interface Folder {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}
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
    quiet_hours_start?: string;
    quiet_hours_end?: string;
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
export declare class UserModel {
    static create(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
    static deleteUser(userId: string): Promise<boolean>;
    private static createDefaultNotificationPreferences;
    private static createWelcomeNotification;
    static findByUserId(userId: string): Promise<User | null>;
    static findByWalletAddress(walletAddress: string): Promise<User | null>;
    static update(userId: string, updates: Partial<User>): Promise<User | null>;
    static updatePin(userId: string, pinHash: string, authMethods?: AuthMethod[]): Promise<User | null>;
    static updateAuthMethods(userId: string, authMethods: AuthMethod[]): Promise<User | null>;
    static updateImageNumber(userId: string, imageNumber: number): Promise<User | null>;
    static addAuthMethod(userId: string, authMethod: AuthMethod): Promise<User | null>;
    static removeAuthMethod(userId: string, authType: AuthMethod['type']): Promise<User | null>;
    static addFolder(userId: string, folder: Omit<Folder, 'createdAt' | 'updatedAt'>): Promise<User | null>;
    static updateFolder(userId: string, folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>): Promise<User | null>;
    static removeFolder(userId: string, folderId: string): Promise<User | null>;
    static getAll(): Promise<User[]>;
    private static parseUser;
}
export declare class UserDepositModel {
    static create(deposit: Omit<UserDeposit, 'id' | 'timestamp'>): Promise<UserDeposit>;
    static findByUserAddress(userAddress: string): Promise<UserDeposit | null>;
    static findByUserId(userId: string): Promise<UserDeposit[]>;
    static update(userAddress: string, updates: Partial<UserDeposit>): Promise<UserDeposit | null>;
    static getAll(): Promise<UserDeposit[]>;
    static getUnverified(): Promise<UserDeposit[]>;
}
export declare class TransactionModel {
    static create(transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction>;
    static findByTxHash(txHash: string): Promise<Transaction | null>;
    static updateStatus(txHash: string, status: 'pending' | 'confirmed' | 'failed', confirmations?: number): Promise<Transaction | null>;
    static getAll(): Promise<Transaction[]>;
}
export declare class AuthDataModel {
    static create(authData: Omit<AuthData, 'id' | 'created_at'>): Promise<AuthData>;
    static findByUserIdAndType(userId: string, authType: 'phone' | 'pin' | 'biometric' | 'passkey'): Promise<AuthData | null>;
    static findByUserId(userId: string): Promise<AuthData[]>;
    static update(userId: string, authType: 'phone' | 'pin' | 'biometric' | 'passkey', updates: Partial<AuthData>): Promise<AuthData | null>;
    static upsert(authData: Omit<AuthData, 'id' | 'created_at'>): Promise<AuthData>;
    static deactivate(userId: string, authType: 'phone' | 'pin' | 'biometric' | 'passkey'): Promise<boolean>;
    static getAll(): Promise<AuthData[]>;
}
export declare class PaymentTransactionModel {
    static create(transaction: Omit<PaymentTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentTransaction>;
    static findByReference(reference: string): Promise<PaymentTransaction | null>;
    static findByUserId(userId: string): Promise<PaymentTransaction[]>;
    static findByPhone(phone: string): Promise<PaymentTransaction[]>;
    static update(reference: string, updates: Partial<PaymentTransaction>): Promise<PaymentTransaction | null>;
    static updateStatus(reference: string, status: string, additionalData?: Partial<PaymentTransaction>): Promise<PaymentTransaction | null>;
    static getAll(): Promise<PaymentTransaction[]>;
    static getByStatus(status: string): Promise<PaymentTransaction[]>;
}
export declare class SubscriptionModel {
    static create(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription>;
    static findByUserId(userId: string): Promise<Subscription | null>;
    static findBySubscriptionCode(subscriptionCode: string): Promise<Subscription | null>;
    static findByCustomerCode(customerCode: string): Promise<Subscription | null>;
    static update(userId: string, updates: Partial<Subscription>): Promise<Subscription | null>;
    static updateBySubscriptionCode(subscriptionCode: string, updates: Partial<Subscription>): Promise<Subscription | null>;
    static upsert(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription>;
    static activatePremium(userId: string, durationMonths?: number, subscriptionData?: Partial<Subscription>): Promise<Subscription>;
    static cancelSubscription(userId: string): Promise<Subscription | null>;
    static getExpiringSubscriptions(daysThreshold?: number): Promise<Subscription[]>;
    static getExpiredSubscriptions(): Promise<Subscription[]>;
    static getAll(): Promise<Subscription[]>;
    static getActiveSubscriptions(): Promise<Subscription[]>;
    static getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null>;
}
export declare class NotificationModel {
    static create(notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'>): Promise<Notification>;
    static createFromDTO(dto: CreateNotificationDTO): Promise<Notification>;
    static findById(id: string): Promise<Notification | null>;
    static findByUserId(userId: string, filter?: NotificationFilter): Promise<Notification[]>;
    static update(id: string, updates: Partial<Notification>): Promise<Notification | null>;
    static markAsRead(id: string): Promise<Notification | null>;
    static markAsSeen(id: string): Promise<Notification | null>;
    static markAllAsRead(userId: string): Promise<number>;
    static markAllAsSeen(userId: string): Promise<number>;
    static delete(id: string): Promise<boolean>;
    static hardDelete(id: string): Promise<boolean>;
    static deleteExpired(): Promise<number>;
    static getStats(userId: string): Promise<NotificationStats>;
    static createSystemNotification(userId: string, title: string, message: string, priority?: Notification['priority']): Promise<Notification>;
    static createTransactionNotification(userId: string, title: string, message: string, txHash?: string): Promise<Notification>;
    static createSecurityNotification(userId: string, title: string, message: string): Promise<Notification>;
    private static parseNotification;
}
export declare class NotificationPreferenceModel {
    static create(preference: Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationPreference>;
    static findByUserId(userId: string): Promise<NotificationPreference[]>;
    static update(userId: string, notificationType: string, updates: Partial<NotificationPreference>): Promise<NotificationPreference | null>;
    static setDefaultPreferences(userId: string): Promise<void>;
    static isNotificationAllowed(userId: string, notificationType: string, channel?: 'push' | 'email' | 'sms' | 'in_app'): Promise<boolean>;
    private static checkChannelPermission;
    static getDeliveryChannels(userId: string, notificationType: string): Promise<Array<'push' | 'email' | 'sms' | 'in_app'>>;
    static getQuietHours(userId: string): Promise<{
        start: string;
        end: string;
    } | null>;
}
export declare class DatabaseManager {
    static initializeDatabase(): Promise<void>;
    static migrateFromJSON(): Promise<void>;
    static runAuthMethodsMigration(): Promise<void>;
    static runSubscriptionMigration(): Promise<void>;
    static runPaymentMigration(): Promise<void>;
    static runImageNumberMigration(): Promise<void>;
    static runNotificationMigration(): Promise<void>;
    static runAllMigrations(): Promise<void>;
    static checkDatabaseHealth(): Promise<{
        users: number;
        usersWithAuthMethods: number;
        usersWithFolders: number;
        deposits: number;
        transactions: number;
        paymentTransactions: number;
        subscriptions: number;
        activeSubscriptions: number;
        healthy: boolean;
    }>;
}
//# sourceMappingURL=models.d.ts.map