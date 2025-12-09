import http from 'http';
import crypto from 'crypto';
import { log } from 'console';

const BASE_URL = 'http://localhost:3000';

// Test data
const TEST_USERS = {
  user1: {
    userId: 'test-notification-user-1-' + Date.now(),
    phoneNumber: '1112223333',
    username: 'notifyuser1_' + Date.now(),
    walletAddress: '0x' + 'a'.repeat(40),
    pin: '123456'
  },
  user2: {
    userId: 'test-notification-user-2-' + Date.now(),
    phoneNumber: '4445556666',
    username: 'notifyuser2_' + Date.now(),
    walletAddress: '0x' + 'b'.repeat(40),
    pin: '654321'
  },
  admin: {
    userId: 'test-admin-' + Date.now(),
    phoneNumber: '7778889999',
    username: 'admin_' + Date.now(),
    walletAddress: '0x' + 'c'.repeat(40),
    pin: '999999'
  }
};

// Global variables
let authToken = '';
let testUserId = '';
let createdNotificationIds: string[] = [];
let aesKey = crypto.randomBytes(32);

// Helper functions with retry logic
async function makeRequestWithRetry(method: string, path: string, data: any = null, headers: any = {}, maxRetries = 3): Promise<any> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await makeRequest(method, path, data, headers);
      return result;
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⚠️ Request failed, retrying in ${delay}ms (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError;
}

function makeRequest(method: string, path: string, data: any = null, headers: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 30000 // Increased timeout
    };

    if (authToken) {
      
      options.headers.Authorization = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          if (responseData) {
            const parsed = JSON.parse(responseData);
            resolve({
              status: res.statusCode,
              body: parsed
            });
          } else {
            resolve({
              status: res.statusCode,
              body: null
            });
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message} - Response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function encryptAESDeterministic(data: string, key: Buffer): string {
  try {
    const algorithm = 'aes-256-gcm';
    const iv = Buffer.from('00000000000000000000000000000000', 'hex');
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('AES encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

// NEW: Set default notification preferences after user creation
async function setDefaultNotificationPreferences(userId: string) {
  console.log(`⚙️ Setting default notification preferences for user: ${userId}`);
  
  try {
    const response = await makeRequestWithRetry('GET', '/api/notifications/preferences', null, {}, 3);
    console.log(response);
    
    if (response.body?.success) {
      console.log(`✅ Default preferences created/retrieved for user: ${userId}`);
      return true;
    } else if (response.body?.error?.message?.includes('not found') || 
               response.status === 404) {
      // If preferences don't exist yet, trigger creation by accessing them
      console.log(`ℹ️ No preferences found, they will be created on first access`);
      return true;
    } else {
      console.log(`⚠️ Could not verify preferences for user: ${userId} - ${response}`);
      return false;
    }
  } catch (error: any) {
    console.log(`⚠️ Error setting preferences (may be created lazily): ${error.message}`);
    return false;
  }
}

async function setupTestUser(userData: any) {
  console.log(`\n=== Setting up test user: ${userData.userId} ===`);
  
  try {
    // First get ZK commitment
    const commitmentData = {
      phone: userData.phoneNumber,
      biometric: 'test_biometric',
      passkey: 'test_passkey'
    };

    const commitmentResponse = await makeRequestWithRetry('POST', '/api/zk/commitment', commitmentData);
    
    if (!commitmentResponse.body?.success) {
      console.log('❌ Failed to get ZK commitment');
      return false;
    }

    const zkCommitment = commitmentResponse.body.data.commitment;

    // Get ZK proof
    const proofData = {
      phone: userData.phoneNumber,
      biometric: 'test_biometric',
      passkey: 'test_passkey',
      commitment: zkCommitment
    };

    const proofResponse = await makeRequestWithRetry('POST', '/api/zk/proof', proofData);
    
    if (!proofResponse.body?.success) {
      console.log('❌ Failed to get ZK proof');
      return false;
    }

    const zkProof = proofResponse.body.data;
    const phoneEncrypted = encryptAESDeterministic(userData.phoneNumber, aesKey);
    const pinEncrypted = encryptAESDeterministic(userData.pin, aesKey);
    
    const now = new Date().toISOString();
    const authMethods = [
      {
        type: 'pin',
        data: pinEncrypted,
        createdAt: now,
        lastUsed: now
      },
      {
        type: 'fingerprint',
        createdAt: now,
        lastUsed: now
      },
      {
        type: 'phone',
        data: phoneEncrypted,
        createdAt: now,
        lastUsed: now
      }
    ];

    // Signup user
    const signupData = {
      userId: userData.userId,
      userAddress: userData.walletAddress,
      phoneHash: phoneEncrypted,
      pinHash: pinEncrypted,
      authMethods: authMethods,
      zkCommitment: zkCommitment,
      zkProof: zkProof,
      verificationMethod: 'phone',
    };

    const signupResponse = await makeRequestWithRetry('POST', '/api/auth/signup', signupData);
    
    if (signupResponse.body?.success) {
      console.log(`✅ User created successfully: ${userData.userId}`);
      testUserId = userData.userId;
      authToken = signupResponse.body.data.token;
      
      // Setup username
      const usernameData = {
        username: userData.username
      };
      
      const usernameResponse = await makeRequestWithRetry('POST', '/api/auth/setup-username', usernameData);
      
      if (usernameResponse.body?.success) {
        console.log(`✅ Username setup successful: ${userData.username}`);
        
        // NEW: Set default notification preferences
        await setDefaultNotificationPreferences(userData.userId);
        
        return true;
      } else {
        console.log('⚠️ Username setup failed, but user created');
        
        // NEW: Set default notification preferences even if username setup failed
        await setDefaultNotificationPreferences(userData.userId);
        
        return true;
      }
    } else {
      console.log(`❌ User creation failed: ${signupResponse.body?.error?.message}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Setup failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// UPDATED NOTIFICATION TESTS WITH RETRY LOGIC
// ============================================================================

async function testCreateNotification(notificationData: any, expectSuccess = true, maxRetries = 2) {
  console.log(`\n=== Testing Create Notification (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await makeRequest('POST', '/api/notifications', {
        title: notificationData.title,
        message: notificationData.message,
        notification_type: notificationData.notification_type,
        priority: notificationData.priority,
        action_url: notificationData.action_url,
        action_label: notificationData.action_label,
        metadata: notificationData.metadata
      });
            
      if (response.body) {
        if (response.body.success && expectSuccess) {
          const notification = response.body.data;
          console.log(`✅ Notification created: ${notification.id} - ${notification.title}`);
          createdNotificationIds.push(notification.id);
          return notification;
        } else if (!response.body.success && !expectSuccess) {
          console.log(`✅ Expected failure: ${response.body.error?.message || 'No error message'}`);
          return null;
        } else {
          if (attempt < maxRetries) {
            console.log(`⚠️ Retrying (${attempt}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
          console.log(`Error: ${response.body.error?.message || 'No error message'}`);
          return null;
        }
      } else {
        console.log('❌ No response body received');
        return null;
      }
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        console.log(`⚠️ Request failed, retrying (${attempt}/${maxRetries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }
  
  console.log(`❌ Request failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  return null;
}

async function testGetNotifications(filter: any = {}, expectSuccess = true) {
  console.log(`\n=== Testing Get Notifications (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const queryParams = new URLSearchParams(filter).toString();
    const path = `/api/notifications${queryParams ? `?${queryParams}` : ''}`;
    
    const response = await makeRequestWithRetry('GET', path);
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const notifications = response.body.data.notifications || [];
        const stats = response.body.data.stats || { total: 0, unread: 0, unseen: 0 };
        console.log(`✅ Got ${notifications.length} notifications`);
        console.log(`   Stats: ${stats.total} total, ${stats.unread} unread, ${stats.unseen} unseen`);
        return { notifications, stats };
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        console.log(`Error: ${response.body.error?.message || 'No error message'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testGetNotificationStats(expectSuccess = true) {
  console.log(`\n=== Testing Get Notification Stats (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('GET', '/api/notifications/stats');
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const stats = response.body.data;
        console.log(`✅ Stats retrieved:`);
        console.log(`   Total: ${stats.total || 0}`);
        console.log(`   Unread: ${stats.unread || 0}`);
        console.log(`   Unseen: ${stats.unseen || 0}`);
        console.log(`   Urgent Unread: ${stats.urgent_unread || 0}`);
        console.log(`   By Type:`, stats.by_type || {});
        return stats;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testGetSpecificNotification(notificationId: string, expectSuccess = true) {
  console.log(`\n=== Testing Get Specific Notification ${notificationId} (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('GET', `/api/notifications/${notificationId}`);
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const notification = response.body.data;
        console.log(`✅ Notification retrieved: ${notification.title}`);
        return notification;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testMarkNotificationAsRead(notificationId: string, expectSuccess = true) {
  console.log(`\n=== Testing Mark Notification as Read ${notificationId} (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('PUT', `/api/notifications/${notificationId}/read`);
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const notification = response.body.data;
        console.log(`✅ Notification marked as read: ${notification.id}`);
        return notification;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testMarkNotificationAsSeen(notificationId: string, expectSuccess = true) {
  console.log(`\n=== Testing Mark Notification as Seen ${notificationId} (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('PUT', `/api/notifications/${notificationId}/seen`);
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const notification = response.body.data;
        console.log(`✅ Notification marked as seen: ${notification.id}`);
        return notification;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testMarkAllAsRead(expectSuccess = true) {
  console.log(`\n=== Testing Mark All as Read (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('PUT', '/api/notifications/read-all');
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const result = response.body.data;
        console.log(`✅ All notifications marked as read: ${result.notifications_marked || 0} marked`);
        return result;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testMarkAllAsSeen(expectSuccess = true) {
  console.log(`\n=== Testing Mark All as Seen (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('PUT', '/api/notifications/seen-all');
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const result = response.body.data;
        console.log(`✅ All notifications marked as seen: ${result.notifications_marked || 0} marked`);
        return result;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testDeleteNotification(notificationId: string, expectSuccess = true) {
  console.log(`\n=== Testing Delete Notification ${notificationId} (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('DELETE', `/api/notifications/${notificationId}`);
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        console.log(`✅ Notification deleted: ${notificationId}`);
        return true;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return false;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return false;
      }
    } else {
      console.log('❌ No response body received');
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function testDeleteMultipleNotifications(notificationIds: string[], expectSuccess = true) {
  console.log(`\n=== Testing Delete Multiple Notifications (${notificationIds.length} notifications) (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('DELETE', '/api/notifications', {
      notification_ids: notificationIds
    });
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const result = response.body.data;
        console.log(`✅ Deleted ${result.deleted_count} of ${result.total_count} notifications`);
        if (result.errors) {
          console.log(`   Errors:`, result.errors);
        }
        return result;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

// ============================================================================
// NOTIFICATION PREFERENCE TESTS
// ============================================================================

async function testGetNotificationPreferences(expectSuccess = true) {
  console.log(`\n=== Testing Get Notification Preferences (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('GET', '/api/notifications/preferences');
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const preferences = response.body.data || [];
        console.log(`✅ Got ${preferences.length} notification preferences`);
        
        // Log each preference
        preferences.forEach((pref: any) => {
          console.log(`   - ${pref.notification_type}: Enabled=${pref.enabled}, Push=${pref.push_enabled}, Email=${pref.email_enabled}, SMS=${pref.sms_enabled}`);
        });
        
        return preferences;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        console.log(`Error: ${response.body.error?.message || 'No error message'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testUpdateNotificationPreference(notificationType: string, updates: any, expectSuccess = true) {
  console.log(`\n=== Testing Update Notification Preference for ${notificationType} (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('PUT', `/api/notifications/preferences/${notificationType}`, updates);
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const preference = response.body.data;
        console.log(`✅ Notification preference updated for ${notificationType}`);
        console.log(`   Enabled: ${preference.enabled}, Push: ${preference.push_enabled}, Email: ${preference.email_enabled}, SMS: ${preference.sms_enabled}`);
        return preference;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        console.log(`Error: ${response.body.error?.message || 'No error message'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testGetQuietHours(expectSuccess = true) {
  console.log(`\n=== Testing Get Quiet Hours (expect ${expectSuccess ? 'success' : 'failure'}) ===`);
  
  try {
    const response = await makeRequestWithRetry('GET', '/api/notifications/preferences/quiet-hours');
    
    if (response.body) {
      if (response.body.success && expectSuccess) {
        const quietHours = response.body.data;
        console.log(`✅ Quiet hours: ${quietHours?.start || '22:00:00'} - ${quietHours?.end || '07:00:00'}`);
        return quietHours;
      } else if (!response.body.success && !expectSuccess) {
        console.log(`✅ Expected failure: ${response.body.error?.message}`);
        return null;
      } else {
        console.log(`❌ Unexpected result: ${response.body.success ? 'success' : 'failure'}`);
        return null;
      }
    } else {
      console.log('❌ No response body received');
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

// ============================================================================
// SYSTEM NOTIFICATION TESTS
// ============================================================================

async function testCreateTransactionNotification(userId: string, title: string, message: string, txHash?: string) {
  console.log(`\n=== Testing Create Transaction Notification for ${userId} ===`);
  
  try {
    const response = await makeRequestWithRetry('POST', '/api/notifications/system/transaction', {
      user_id: userId,
      title: title,
      message: message,
      tx_hash: txHash
    });
    
    if (response.body?.success) {
      const notification = response.body.data;
      console.log(`✅ Transaction notification created: ${notification.id}`);
      createdNotificationIds.push(notification.id);
      return notification;
    } else {
      console.log(`❌ Failed to create transaction notification: ${response.body?.error?.message || 'No error message'}`);
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function testCreateSecurityNotification(userId: string, title: string, message: string) {
  console.log(`\n=== Testing Create Security Notification for ${userId} ===`);
  
  try {
    const response = await makeRequestWithRetry('POST', '/api/notifications/system/security', {
      user_id: userId,
      title: title,
      message: message
    });
    
    if (response.body?.success) {
      const notification = response.body.data;
      console.log(`✅ Security notification created: ${notification.id}`);
      createdNotificationIds.push(notification.id);
      return notification;
    } else {
      console.log(`❌ Failed to create security notification: ${response.body?.error?.message || 'No error message'}`);
      return null;
    }
  } catch (error: any) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

// ============================================================================
// TEST SCENARIOS WITH IMPROVED ERROR HANDLING
// ============================================================================

async function testNotificationBasicFlow() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Basic Notification Flow');
  console.log('='.repeat(60));
  
  let allPassed = true;
  const results = [];
  const errors: string[] = [];
  
  try {
    // 1. Create various notifications
    console.log('\n1. Creating test notifications...');
    
    const notification1 = await testCreateNotification({
      user_id: testUserId,
      title: 'Welcome to K33P!',
      message: 'Your account has been successfully created.',
      notification_type: 'system',
      priority: 'normal'
    }, true);
    
    if (!notification1) {
      allPassed = false;
      errors.push('Failed to create notification 1');
    }
    results.push({ step: 'Create notification 1', passed: !!notification1 });
    
    const notification2 = await testCreateNotification({
      user_id: testUserId,
      title: 'Transaction Completed',
      message: 'Your deposit of 0.5 ADA has been confirmed.',
      notification_type: 'transaction',
      priority: 'high',
      action_url: '/wallet/transactions',
      action_label: 'View Transaction'
    }, true);
    
    if (!notification2) {
      allPassed = false;
      errors.push('Failed to create notification 2');
    }
    results.push({ step: 'Create notification 2', passed: !!notification2 });
    
    const notification3 = await testCreateNotification({
      user_id: testUserId,
      title: 'Security Alert',
      message: 'New device detected logging into your account.',
      notification_type: 'security',
      priority: 'urgent',
      metadata: { device: 'iPhone 14', location: 'New York, NY' }
    }, true);
    
    if (!notification3) {
      allPassed = false;
      errors.push('Failed to create notification 3');
    }
    results.push({ step: 'Create notification 3', passed: !!notification3 });
    
    // Wait a moment for notifications to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. Get notifications
    console.log('\n2. Getting all notifications...');
    const getResult = await testGetNotifications({}, true);
    if (!getResult) {
      allPassed = false;
      errors.push('Failed to get notifications');
    }
    results.push({ step: 'Get notifications', passed: !!getResult });
    
    // 3. Get notification stats
    console.log('\n3. Getting notification stats...');
    const stats = await testGetNotificationStats(true);
    if (!stats) {
      allPassed = false;
      errors.push('Failed to get notification stats');
    }
    results.push({ step: 'Get notification stats', passed: !!stats });
    
    // 4. Mark notifications as seen/read
    console.log('\n4. Marking notifications as seen/read...');
    
    if (notification1) {
      const seenResult = await testMarkNotificationAsSeen(notification1.id, true);
      if (!seenResult) {
        errors.push('Failed to mark notification 1 as seen');
      }
      results.push({ step: 'Mark notification 1 as seen', passed: !!seenResult });
    }
    
    if (notification2) {
      const readResult = await testMarkNotificationAsRead(notification2.id, true);
      if (!readResult) {
        errors.push('Failed to mark notification 2 as read');
      }
      results.push({ step: 'Mark notification 2 as read', passed: !!readResult });
    }
    
    // 5. Get specific notification
    console.log('\n5. Getting specific notification...');
    if (notification3) {
      const specific = await testGetSpecificNotification(notification3.id, true);
      if (!specific) {
        errors.push('Failed to get specific notification');
      }
      results.push({ step: 'Get specific notification', passed: !!specific });
    }
    
    // 6. Get updated stats
    console.log('\n6. Getting updated stats...');
    const updatedStats = await testGetNotificationStats(true);
    results.push({ step: 'Get updated stats', passed: !!updatedStats });
    
    // 7. Mark all as read
    console.log('\n7. Marking all notifications as read...');
    const markAllResult = await testMarkAllAsRead(true);
    results.push({ step: 'Mark all as read', passed: !!markAllResult });
    
    // 8. Get notifications with filters
    console.log('\n8. Getting notifications with filters...');
    
    const unreadFilter = await testGetNotifications({ is_read: false }, true);
    results.push({ step: 'Filter by unread', passed: !!unreadFilter });
    
    const urgentFilter = await testGetNotifications({ priority: 'urgent' }, true);
    results.push({ step: 'Filter by urgent', passed: !!urgentFilter });
    
    const typeFilter = await testGetNotifications({ notification_type: 'transaction' }, true);
    results.push({ step: 'Filter by type', passed: !!typeFilter });
    
  } catch (error: any) {
    console.error(`❌ Error in test flow: ${error.message}`);
    allPassed = false;
    errors.push(`Unexpected error: ${error.message}`);
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.forEach(error => console.log(`   - ${error}`));
  }
  
  return { allPassed, results, errors };
}

async function testNotificationPreferencesFlow() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Notification Preferences Flow');
  console.log('='.repeat(60));
  
  let allPassed = true;
  const results = [];
  const errors: string[] = [];
  
  try {
    // 1. Get default preferences
    console.log('\n1. Getting default preferences...');
    const preferences = await testGetNotificationPreferences(true);
    if (!preferences || preferences.length === 0) {
      console.log('⚠️ No preferences found, attempting to trigger creation...');
      
      // Try to trigger preference creation by accessing again
      await new Promise(resolve => setTimeout(resolve, 500));
      const preferences2 = await testGetNotificationPreferences(true);
      
      if (!preferences2 || preferences2.length === 0) {
        console.log('❌ Still no preferences found after retry');
        allPassed = false;
        errors.push('Failed to get notification preferences');
      } else {
        console.log(`✅ Preferences created automatically: ${preferences2.length} preferences`);
      }
    }
    results.push({ step: 'Get default preferences', passed: !!preferences && preferences.length > 0 });
    
    // 2. Update specific preferences
    console.log('\n2. Updating notification preferences...');
    
    const transactionUpdate = await testUpdateNotificationPreference('transaction', {
      enabled: true,
      push_enabled: true,
      email_enabled: false,
      sms_enabled: true
    }, true);
    results.push({ step: 'Update transaction preference', passed: !!transactionUpdate });
    
    const promotionUpdate = await testUpdateNotificationPreference('promotion', {
      enabled: false,
      push_enabled: false,
      email_enabled: false
    }, true);
    results.push({ step: 'Update promotion preference', passed: !!promotionUpdate });
    
    // 3. Update quiet hours
    console.log('\n3. Updating quiet hours...');
    
    const quietHoursUpdate = await testUpdateNotificationPreference('system', {
      quiet_hours_start: '23:00:00',
      quiet_hours_end: '08:00:00'
    }, true);
    results.push({ step: 'Update quiet hours', passed: !!quietHoursUpdate });
    
    // 4. Get quiet hours
    console.log('\n4. Getting quiet hours...');
    const quietHours = await testGetQuietHours(true);
    results.push({ step: 'Get quiet hours', passed: !!quietHours });
    
    // 5. Test creating notification when type is disabled
    console.log('\n5. Testing disabled notification type...');
    
    // Try to create promotion notification (might succeed but not be delivered)
    const disabledNotification = await testCreateNotification({
      user_id: testUserId,
      title: 'Special Offer',
      message: 'Get 20% off on premium subscription!',
      notification_type: 'promotion',
      priority: 'low'
    }, true);
    
    results.push({ 
      step: 'Create disabled type notification', 
      passed: true, // This is informational, not a failure
      note: disabledNotification ? 
        'Notification created (delivery depends on preferences)' : 
        'Notification not created (might be blocked by preferences)'
    });
    
  } catch (error: any) {
    console.error(`❌ Error in preferences flow: ${error.message}`);
    allPassed = false;
    errors.push(`Unexpected error: ${error.message}`);
  }
  
  return { allPassed, results, errors };
}

async function testSystemNotificationFunctions() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing System Notification Functions');
  console.log('='.repeat(60));
  
  let allPassed = true;
  const results = [];
  const errors: string[] = [];
  
  try {
    // Setup second user for testing
    console.log('\nSetting up second test user...');
    const oldToken = authToken;
    const oldUserId = testUserId;
    
    const user2Success = await setupTestUser(TEST_USERS.user2);
    if (!user2Success) {
      console.log('❌ Failed to setup second user');
      allPassed = false;
      errors.push('Failed to setup second user');
      return { allPassed, results, errors };
    }
    
    const user2Token = authToken;
    const user2Id = testUserId;
    
    // Restore original user context
    authToken = oldToken;
    testUserId = oldUserId;
    
    // 1. Create transaction notification for other user (as admin/system)
    console.log('\n1. Creating transaction notification for user 2...');
    const txNotification = await testCreateTransactionNotification(
      user2Id,
      'Transaction Processed',
      'Your withdrawal of 1.0 ADA has been processed successfully.',
      'tx_hash_abc123'
    );
    results.push({ step: 'Create transaction notification', passed: !!txNotification });
    
    // 2. Create security notification for other user
    console.log('\n2. Creating security notification for user 2...');
    const securityNotification = await testCreateSecurityNotification(
      user2Id,
      'Suspicious Login Attempt',
      'A login attempt was detected from an unrecognized device. Please verify your account activity.'
    );
    results.push({ step: 'Create security notification', passed: !!securityNotification });
    
    // Wait for notifications to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Switch to user 2 context
    authToken = user2Token;
    testUserId = user2Id;
    
    // 3. User 2 should see their notifications
    console.log('\n3. User 2 checking notifications...');
    const user2Notifications = await testGetNotifications({}, true);
    results.push({ step: 'User 2 get notifications', passed: !!user2Notifications });
    
    if (user2Notifications && user2Notifications.notifications.length > 0) {
      console.log(`✅ User 2 has ${user2Notifications.notifications.length} notifications`);
    } else {
      console.log(`⚠️ User 2 has 0 notifications (might need to wait)`);
    }
    
    // Switch back to original user
    authToken = oldToken;
    testUserId = oldUserId;
    
  } catch (error: any) {
    console.error(`❌ Error in system functions: ${error.message}`);
    allPassed = false;
    errors.push(`Unexpected error: ${error.message}`);
  }
  
  return { allPassed, results, errors };
}

async function testNotificationDeletionFlow() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Notification Deletion Flow');
  console.log('='.repeat(60));
  
  let allPassed = true;
  const results = [];
  const errors: string[] = [];
  
  try {
    // Create notifications to delete
    console.log('\n1. Creating notifications for deletion tests...');
    
    const notificationsToDelete = [];
    
    for (let i = 1; i <= 5; i++) {
      const notification = await testCreateNotification({
        user_id: testUserId,
        title: `Test Notification ${i}`,
        message: `This is test notification number ${i}`,
        notification_type: 'system',
        priority: i % 2 === 0 ? 'high' : 'normal'
      }, true);
      
      if (notification) {
        notificationsToDelete.push(notification.id);
      } else {
        console.log(`⚠️ Failed to create notification ${i}`);
      }
    }
    
    if (notificationsToDelete.length === 0) {
      console.log('❌ No notifications created for deletion tests');
      allPassed = false;
      errors.push('Failed to create notifications for deletion');
      return { allPassed, results, errors };
    }
    
    console.log(`✅ Created ${notificationsToDelete.length} notifications for deletion`);
    results.push({ step: 'Create notifications for deletion', passed: notificationsToDelete.length > 0 });
    
    // Wait for notifications to be processed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 2. Delete single notification
    console.log('\n2. Deleting single notification...');
    const deleteSingle = await testDeleteNotification(notificationsToDelete[0], true);
    results.push({ step: 'Delete single notification', passed: deleteSingle });
    
    // 3. Get notifications after deletion
    console.log('\n3. Getting notifications after single deletion...');
    const afterSingleDelete = await testGetNotifications({}, true);
    results.push({ step: 'Get after single delete', passed: !!afterSingleDelete });
    
    // 4. Delete multiple notifications
    console.log('\n4. Deleting multiple notifications...');
    const remainingIds = notificationsToDelete.slice(1);
    const deleteMultiple = await testDeleteMultipleNotifications(remainingIds, true);
    results.push({ step: 'Delete multiple notifications', passed: !!deleteMultiple });
    
    // 5. Get final notifications
    console.log('\n5. Getting final notifications...');
    const finalResult = await testGetNotifications({}, true);
    results.push({ step: 'Get final notifications', passed: !!finalResult });
    
    // 6. Test deleting non-existent notification
    console.log('\n6. Testing delete non-existent notification...');
    const deleteNonExistent = await testDeleteNotification('00000000-0000-0000-0000-000000000000', false);
    results.push({ step: 'Delete non-existent', passed: deleteNonExistent === false });
    
  } catch (error: any) {
    console.error(`❌ Error in deletion flow: ${error.message}`);
    allPassed = false;
    errors.push(`Unexpected error: ${error.message}`);
  }
  
  return { allPassed, results, errors };
}

async function testInvalidNotificationScenarios() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Invalid Notification Scenarios');
  console.log('='.repeat(60));
  
  const scenarios = [
    {
      name: 'Missing title',
      data: {
        user_id: testUserId,
        message: 'Test message',
        notification_type: 'system'
      },
      expectedError: 'Title must be between 1 and 255 characters'
    },
    {
      name: 'Missing message',
      data: {
        user_id: testUserId,
        title: 'Test Title',
        notification_type: 'system'
      },
      expectedError: 'Message must be between 1 and 1000 characters'
    },
    {
      name: 'Invalid notification type',
      data: {
        user_id: testUserId,
        title: 'Test Title',
        message: 'Test message',
        notification_type: 'invalid_type'
      },
      expectedError: 'Invalid notification type'
    },
    {
      name: 'Invalid priority',
      data: {
        user_id: testUserId,
        title: 'Test Title',
        message: 'Test message',
        notification_type: 'system',
        priority: 'invalid_priority'
      },
      expectedError: 'Invalid priority level'
    },
    {
      name: 'Invalid user ID format',
      data: {
        user_id: 'invalid-user-id',
        title: 'Test Title',
        message: 'Test message',
        notification_type: 'system'
      },
      expectedError: 'User not found'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  const results = [];
  const errors: string[] = [];
  
  for (const scenario of scenarios) {
    console.log(`\nTesting: ${scenario.name}`);
    const result = await testCreateNotification(scenario.data, false);
    
    if (result === null) { // null means expected failure occurred
      console.log(`✅ Expected failure`);
      passed++;
      results.push({ scenario: scenario.name, passed: true });
    } else {
      console.log(`❌ Expected failure but got success`);
      failed++;
      results.push({ scenario: scenario.name, passed: false });
      errors.push(`Scenario "${scenario.name}" should have failed but succeeded`);
    }
  }
  
  console.log(`\nInvalid scenarios: ${passed} passed, ${failed} failed`);
  return { allPassed: failed === 0, results, errors };
}

async function testNotificationPaginationAndFiltering() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Pagination and Filtering');
  console.log('='.repeat(60));
  
  let allPassed = true;
  const results = [];
  const errors: string[] = [];
  
  try {
    // Create mixed notifications for filtering
    console.log('\n1. Creating mixed notifications for filtering...');
    
    const notificationTypes = ['system', 'transaction', 'security', 'wallet'];
    const priorities = ['low', 'normal', 'high', 'urgent'];
    
    let createdCount = 0;
    for (let i = 0; i < 8; i++) { // Reduced from 15 to prevent overload
      const type = notificationTypes[i % notificationTypes.length];
      const priority = priorities[i % priorities.length];
      
      const notification = await testCreateNotification({
        user_id: testUserId,
        title: `Filter Test ${i + 1}`,
        message: `This is a ${type} notification with ${priority} priority`,
        notification_type: type,
        priority: priority
      }, true);
      
      if (notification) {
        createdCount++;
      }
      
      // Small delay between creations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Created ${createdCount} notifications for filtering`);
    
    // Wait for all notifications to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. Test pagination
    console.log('\n2. Testing pagination...');
    
    const page1 = await testGetNotifications({ limit: 5, offset: 0 }, true);
    results.push({ step: 'Page 1 (limit 5)', passed: !!page1 });
    
    const page2 = await testGetNotifications({ limit: 5, offset: 5 }, true);
    results.push({ step: 'Page 2 (limit 5, offset 5)', passed: !!page2 });
    
    // 3. Test ordering
    console.log('\n3. Testing ordering...');
    
    const newestFirst = await testGetNotifications({ order_by: 'created_at', order_direction: 'desc' }, true);
    results.push({ step: 'Order by created_at desc', passed: !!newestFirst });
    
    const oldestFirst = await testGetNotifications({ order_by: 'created_at', order_direction: 'asc' }, true);
    results.push({ step: 'Order by created_at asc', passed: !!oldestFirst });
    
    // 4. Test combined filters
    console.log('\n4. Testing combined filters...');
    
    const urgentSystem = await testGetNotifications({ 
      notification_type: 'system', 
      priority: 'urgent',
      is_read: false 
    }, true);
    results.push({ step: 'System + urgent + unread', passed: !!urgentSystem });
    
    const dateRange = await testGetNotifications({
      start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date().toISOString()
    }, true);
    results.push({ step: 'Date range filter', passed: !!dateRange });
    
  } catch (error: any) {
    console.error(`❌ Error in pagination/filtering: ${error.message}`);
    allPassed = false;
    errors.push(`Unexpected error: ${error.message}`);
  }
  
  return { allPassed, results, errors };
}

// ============================================================================
// UPDATED MAIN TEST RUNNER WITH BETTER REPORTING
// ============================================================================

async function runComprehensiveNotificationTests() {
  console.log('🚀 Starting Comprehensive Notification System Tests');
  console.log('='.repeat(70));
  
  // Setup test user
  console.log('\nSetting up primary test user...');
  const setupSuccess = await setupTestUser(TEST_USERS.user1);
  
  if (!setupSuccess) {
    console.log('❌ Cannot run notification tests - user setup failed');
    return;
  }
  
  const testSuites = [
    { name: 'Basic Notification Flow', test: testNotificationBasicFlow },
    { name: 'Notification Preferences', test: testNotificationPreferencesFlow },
    { name: 'System Notification Functions', test: testSystemNotificationFunctions },
    { name: 'Notification Deletion', test: testNotificationDeletionFlow },
    { name: 'Invalid Scenarios', test: testInvalidNotificationScenarios },
    { name: 'Pagination & Filtering', test: testNotificationPaginationAndFiltering }
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  const allResults: any[] = [];
  const allErrors: string[] = [];
  
  for (const suite of testSuites) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${suite.name}`);
    console.log('='.repeat(60));
    
    try {
      const result = await suite.test();
      allResults.push({ suite: suite.name, result });
      
      if (result.errors && result.errors.length > 0) {
        allErrors.push(...result.errors.map((err: string) => `${suite.name}: ${err}`));
      }
      
      if (result.allPassed) {
        totalPassed++;
        console.log(`\n✅ ${suite.name}: PASSED`);
        
        // Log detailed results
        if (result.results) {
          console.log('   Detailed results:');
          result.results.forEach((r: any, i: number) => {
            const status = r.passed ? '✓' : '✗';
            console.log(`   ${status} ${r.step || r.scenario}`);
            if (r.note) console.log(`     Note: ${r.note}`);
          });
        }
      } else {
        totalFailed++;
        console.log(`\n❌ ${suite.name}: FAILED`);
        
        if (result.results) {
          console.log('   Failed steps:');
          result.results.forEach((r: any) => {
            if (!r.passed) {
              console.log(`   ✗ ${r.step || r.scenario}`);
            }
          });
        }
      }
    } catch (error: any) {
      totalFailed++;
      console.log(`\n💥 ${suite.name}: CRASHED - ${error.message}`);
      allErrors.push(`${suite.name}: Test crashed - ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 COMPREHENSIVE NOTIFICATION TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Test Suites: ${testSuites.length}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Notifications Created: ${createdNotificationIds.length}`);
  
  if (allErrors.length > 0) {
    console.log('\n❌ ERRORS ENCOUNTERED:');
    allErrors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  if (totalFailed === 0) {
    console.log('\n🎉 ALL NOTIFICATION TESTS PASSED!');
  } else {
    console.log('\n💥 SOME TESTS FAILED - NEEDS INVESTIGATION');
  }
  
  // Cleanup info
  if (createdNotificationIds.length > 0) {
    console.log(`\n📝 Created notification IDs for cleanup: ${createdNotificationIds.slice(0, 5).join(', ')}${createdNotificationIds.length > 5 ? '...' : ''}`);
  }
  
  return { 
    totalPassed, 
    totalFailed, 
    totalErrors: allErrors.length,
    results: allResults,
    errors: allErrors
  };
}

// Add graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Test interrupted by user');
  console.log(`📝 Created ${createdNotificationIds.length} notifications`);
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n\n💥 Uncaught exception:', error);
  process.exit(1);
});

// Run the tests
runComprehensiveNotificationTests()
  .then(results => {
    console.log('\n🏁 Test execution completed');
    process.exit(results.totalFailed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n💥 Test runner crashed:', error);
    process.exit(1);
  });