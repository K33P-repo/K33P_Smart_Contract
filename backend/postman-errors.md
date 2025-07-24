info: GET /api/health {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:34.567Z","userAgent":"PostmanRuntime/7.39.1"}
GET /api/health 200 0.821 ms - 114
info: GET /api/status {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:35.995Z","userAgent":"PostmanRuntime/7.39.1"}
GET /api/status 200 1.022 ms - 249
info: GET /api/version {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:37.521Z","userAgent":"PostmanRuntime/7.39.1"}
GET /api/version 200 0.729 ms - 215
info: GET /api/health {"ip":"::ffff:10.222.26.34","service":"k33p-backend","timestamp":"2025-07-24T15:12:37.708Z","userAgent":"Render/1.0"}
GET /api/health 200 0.650 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.26.34","service":"k33p-backend","timestamp":"2025-07-24T15:12:37.709Z","userAgent":"Render/1.0"}
GET /api/health 200 0.421 ms - 114
info: GET /api/deposit-address {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:39.037Z","userAgent":"PostmanRuntime/7.39.1"}
GET /api/deposit-address 200 1.067 ms - 178

info: POST /api/auth/signup {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:42.020Z","userAgent":"PostmanRuntime/7.39.1"}
=== SIGNUP DEBUG START ===
Request body: {
  "phoneNumber": "+1234567890",
  "userId": "test_user_5f6d7070-66fc-4b61-85e4-164aa5f0602e",
  "userAddress": "addr_test1qztest123456789abcdef",
  "verificationMethod": "phone",
  "pin": "1234",
  "biometricType": "fingerprint"
}
Content-Type: application/json
Environment variables check:
- JWT_SECRET: SET
- JWT_EXPIRATION: 3600000
- BLOCKFROST_API_KEY: SET
Extracted fields: {
  userAddress: 'addr_test1qztest123456789abcdef',
  userId: 'test_user_5f6d7070-66fc-4b61-85e4-164aa5f0602e',
  phoneNumber: '+1234567890',
  senderWalletAddress: undefined,
  verificationMethod: 'phone',
  biometricType: 'fingerprint',
  walletAddress: undefined,
  phone: undefined,
  hasPasskey: false,
  hasBiometric: false,
  hasBiometricData: false
}
Final processed fields: {
  finalUserAddress: 'addr_test1qztest123456789abcdef',
  finalPhoneNumber: '+1234567890',
  hasFinalBiometricData: false
}
Step 1: Hashing phone...
Phone hash created successfully
Step 2: Hashing biometric data...
Biometric hash created: false
Step 3: Hashing passkey...
Passkey hash created: false
Step 4: Checking existing user by phone...
Existing user check completed, found: false
Step 5: Checking existing user by wallet address...
Existing wallet user check completed, found: false
Step 6: Generating ZK commitment...
ZK commitment generated successfully
Step 7: Generating ZK proof...
ZK proof generated, valid: true
Step 8: Creating user in storage...
warn: storeUser attempt 1 failed {"attempt":1,"error":"column \"sender_wallet_address\" of relation \"users\" does not exist","maxAttempts":3,"service":"storage-abstraction","timestamp":"2025-07-24T15:12:42.487Z"}
info: GET /api/health {"ip":"::ffff:10.222.26.34","service":"k33p-backend","timestamp":"2025-07-24T15:12:42.707Z","userAgent":"Render/1.0"}
GET /api/health 200 0.562 ms - 114
warn: storeUser attempt 2 failed {"attempt":2,"error":"column \"sender_wallet_address\" of relation \"users\" does not exist","maxAttempts":3,"service":"storage-abstraction","timestamp":"2025-07-24T15:12:43.642Z"}
warn: storeUser attempt 3 failed {"attempt":3,"error":"column \"sender_wallet_address\" of relation \"users\" does not exist","maxAttempts":3,"service":"storage-abstraction","timestamp":"2025-07-24T15:12:45.796Z"}
error: Failed to store user {"error":"column \"sender_wallet_address\" of relation \"users\" does not exist","service":"storage-abstraction","storage":"postgresql","timestamp":"2025-07-24T15:12:45.797Z","userId":"test_user_5f6d7070-66fc-4b61-85e4-164aa5f0602e"}
Failed to create user: column "sender_wallet_address" of relation "users" does not exist
POST /api/auth/signup 500 3777.574 ms - 104
info: POST /api/auth/login {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:47.222Z","userAgent":"PostmanRuntime/7.39.1"}
POST /api/auth/login 400 0.721 ms - 42
info: GET /api/health {"ip":"::ffff:10.222.26.34","service":"k33p-backend","timestamp":"2025-07-24T15:12:47.707Z","userAgent":"Render/1.0"}
GET /api/health 200 0.600 ms - 114
info: POST /api/auth/logout {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:48.682Z","userAgent":"PostmanRuntime/7.39.1"}
POST /api/auth/logout 401 1.168 ms - 25
info: GET /api/auth/me {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:50.144Z","userAgent":"PostmanRuntime/7.39.1"}
GET /api/auth/me 401 1.397 ms - 25
info: POST /api/auth/verify-wallet {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:51.562Z","userAgent":"PostmanRuntime/7.39.1"}
POST /api/auth/verify-wallet 401 0.789 ms - 25
info: GET /api/health {"ip":"::ffff:10.222.26.34","service":"k33p-backend","timestamp":"2025-07-24T15:12:52.708Z","userAgent":"Render/1.0"}
GET /api/health 200 0.795 ms - 114
info: POST /api/zk/commitment {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:53.018Z","userAgent":"PostmanRuntime/7.39.1"}
POST /api/zk/commitment 200 0.776 ms - 427
info: POST /api/zk/proof {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:54.431Z","userAgent":"PostmanRuntime/7.39.1"}
POST /api/zk/proof 200 0.823 ms - 236
info: POST /api/zk/verify {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:55.830Z","userAgent":"PostmanRuntime/7.39.1"}
Error in verifyZkProof: Invalid proof object
POST /api/zk/verify 200 2.962 ms - 121
info: POST /api/user/profile {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:57.273Z","userAgent":"PostmanRuntime/7.39.1"}
POST /api/user/profile 404 155.836 ms - 91
info: GET /api/health {"ip":"::ffff:10.222.26.34","service":"k33p-backend","timestamp":"2025-07-24T15:12:57.708Z","userAgent":"Render/1.0"}
GET /api/health 200 0.544 ms - 114
info: GET /api/user/profile {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:12:58.883Z","userAgent":"PostmanRuntime/7.39.1"}
GET /api/user/profile 404 0.660 ms - 136
info: GET /api/user/addr_test1vqymx67q572k8z5ln0850m35a6amuw25wg09slrwuv9g0vq7zup5x/status {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-24T15:13:00.316Z","userAgent":"PostmanRuntime/7.39.1"}
GET /api/user/addr_test1vqymx67q572k8z5ln0850m35a6amuw25wg09slrwuv9g0vq7zup5x/status 404 158.904 ms - 83
info: GET /api/health {"ip":"::ffff:10.222.26.34","service":"k33p-backend","timestamp":"2025-07-24T15:13:02.707Z","userAgent":"Render/1.0"}
GET /api/health 200 0.698 ms - 114