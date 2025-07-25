GET /api/health 200 0.854 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.24.121","service":"k33p-backend","timestamp":"2025-07-25T22:36:55.524Z","userAgent":"Render/1.0"}
GET /api/health 200 0.580 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.24.121","service":"k33p-backend","timestamp":"2025-07-25T22:37:00.523Z","userAgent":"Render/1.0"}
GET /api/health 200 0.601 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.24.121","service":"k33p-backend","timestamp":"2025-07-25T22:37:00.524Z","userAgent":"Render/1.0"}
GET /api/health 200 0.334 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.24.121","service":"k33p-backend","timestamp":"2025-07-25T22:37:05.523Z","userAgent":"Render/1.0"}
GET /api/health 200 0.642 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.24.121","service":"k33p-backend","timestamp":"2025-07-25T22:37:10.523Z","userAgent":"Render/1.0"}
GET /api/health 200 0.608 ms - 114
info: POST /api/zk/commitment {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-25T22:37:13.163Z","userAgent":"okhttp/4.12.0"}
POST /api/zk/commitment 200 3.661 ms - 427
info: 📨 Found 1 new incoming transactions {"service":"auto-refund-monitor","timestamp":"2025-07-25T22:37:13.183Z"}
info: 💰 Processing incoming transaction: 40c722fc562fd2e50655637757e65920d8645c05c523b85a3eaa2f5d5f46be6c {"service":"auto-refund-monitor","timestamp":"2025-07-25T22:37:13.183Z"}
info: 📍 From: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt {"service":"auto-refund-monitor","timestamp":"2025-07-25T22:37:13.183Z"}
info: 💵 Amount: 2 ADA {"service":"auto-refund-monitor","timestamp":"2025-07-25T22:37:13.188Z"}
info: POST /api/zk/proof {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-25T22:37:14.003Z","userAgent":"okhttp/4.12.0"}
POST /api/zk/proof 200 1.160 ms - 278
⚠️ Skipping ZK proof generation - no valid user deposit ID provided
⚠️ Skipping ZK proof generation for user auto_1753483034760 - no phone number provided
info: ✅ Created user record for automatic refund: auto_1753483034760 {"service":"auto-refund-monitor","timestamp":"2025-07-25T22:37:15.078Z"}
info: Generating ZK proof for data entry {"dataType":"deposit_creation","service":"k33p-backend","timestamp":"2025-07-25T22:37:15.239Z","userId":"auto_1753483034760"}
info: Data ZK proof generated and stored successfully {"commitment":"8786458543af6252c29e...","dataId":"b17bc5e4-344b-4515-894a-e7cb1ffa0026","dataType":"deposit_creation","service":"k33p-backend","timestamp":"2025-07-25T22:37:15.399Z","userId":"auto_1753483034760"}
✅ ZK proof generated for deposit creation: auto_1753483034760
info: GET /api/health {"ip":"::ffff:10.222.24.121","service":"k33p-backend","timestamp":"2025-07-25T22:37:15.523Z","userAgent":"Render/1.0"}
GET /api/health 200 0.665 ms - 114
🔍 Processing refund for user: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt
📊 Deposit found: true
📊 Deposit refunded status: false
💰 Processing refund to addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt...
info: POST /api/auth/signup {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-25T22:37:16.073Z","userAgent":"okhttp/4.12.0"}
=== SIGNUP DEBUG START ===
Request body: {
  "userId": "user_mdjeiw8q_ptn7d1",
  "userAddress": "addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt",
  "phoneNumber": "2347016401210",
  "commitment": "e8a3abcda160d74655dedc36de8c82331f84945f8028f022e0-e3d101b7"
}
Content-Type: application/json
Environment variables check:
- JWT_SECRET: SET
- JWT_EXPIRATION: 3600000
- BLOCKFROST_API_KEY: SET
Extracted fields: {
  userAddress: 'addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt',
  userId: 'user_mdjeiw8q_ptn7d1',
  phoneNumber: '2347016401210',
  senderWalletAddress: undefined,
  verificationMethod: 'phone',
  biometricType: undefined,
  walletAddress: undefined,
  phone: undefined,
  hasPasskey: false,
  hasBiometric: false,
  hasBiometricData: false
}
Final processed fields: {
  finalUserAddress: 'addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt',
  finalPhoneNumber: '2347016401210',
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
Failed to generate ZK proof for refund: Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/opt/render/project/src/backend/dist/services/zk-proof-service.js.js' imported from /opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:860:10)
    at defaultResolve (node:internal/modules/esm/resolve:984:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:685:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:634:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:617:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:273:38)
    at onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:577:36)
    at TracingChannel.tracePromise (node:diagnostics_channel:344:14)
    at ModuleLoader.import (node:internal/modules/esm/loader:576:21) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///opt/render/project/src/backend/dist/services/zk-proof-service.js.js'
}
Existing wallet user check completed, found: true
User already exists with this wallet address
POST /api/auth/signup 400 313.845 ms - 187
✅ Marked existing deposit as refunded: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt
⚠️ Skipping ZK proof generation - no valid user deposit ID provided
✅ Refund processed successfully: 9ee793e771ab96cc7be16a11ba2ee808922b99b4c484cf2289715516f27d22e1
info: ✅ Automatic refund processed successfully: 9ee793e771ab96cc7be16a11ba2ee808922b99b4c484cf2289715516f27d22e1 {"service":"auto-refund-monitor","timestamp":"2025-07-25T22:37:17.705Z"}
error: ❌ Error processing transaction 40c722fc562fd2e50655637757e65920d8645c05c523b85a3eaa2f5d5f46be6c: duplicate key value violates unique constraint "transactions_tx_hash_key" {"code":"23505","constraint":"transactions_tx_hash_key","detail":"Key (tx_hash)=(9ee793e771ab96cc7be16a11ba2ee808922b99b4c484cf2289715516f27d22e1) already exists.","file":"nbtinsert.c","length":283,"line":"666","name":"error","routine":"_bt_check_unique","schema":"public","service":"auto-refund-monitor","severity":"ERROR","stack":"error: duplicate key value violates unique constraint \"transactions_tx_hash_key\"\n    at /opt/render/project/src/backend/node_modules/pg/lib/client.js:545:17\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async TransactionModel.create (file:///opt/render/project/src/backend/dist/database/models.js:241:28)\n    at async DatabaseService.createTransaction (file:///opt/render/project/src/backend/dist/database/service.js:143:29)\n    at async AutoRefundMonitor.processIncomingTransaction (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:301:17)\n    at async AutoRefundMonitor.monitorAndProcessRefunds (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:128:17)\n    at async Timeout._onTimeout (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:84:17)","table":"transactions","timestamp":"2025-07-25T22:37:17.858Z"}
info: GET /api/health {"ip":"::ffff:10.222.24.121","service":"k33p-backend","timestamp":"2025-07-25T22:37:20.523Z","userAgent":"Render/1.0"}
GET /api/health 200 0.557 ms - 114
info: POST /api/refund {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-25T22:37:20.948Z","userAgent":"okhttp/4.12.0"}
info: 🔄 Processing immediate refund request {"headers":{"content-type":"application/json","user-agent":"okhttp/4.12.0"},"requestBody":{"userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt","walletAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"},"service":"k33p-backend","timestamp":"2025-07-25T22:37:20.956Z","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt","walletAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
info: 📊 User deposit lookup result {"depositFound":true,"depositRefunded":true,"depositVerified":false,"service":"k33p-backend","timestamp":"2025-07-25T22:37:21.111Z","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
info: 🔄 Calling k33pManager.processRefund {"service":"k33p-backend","timestamp":"2025-07-25T22:37:21.111Z","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt","walletAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
🔍 Processing refund for user: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt
📊 Deposit found: true
📊 Deposit refunded status: true
❌ Refund already processed for user: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt
info: 📊 Refund processing result Deposit has already been refunded {"service":"k33p-backend","success":false,"timestamp":"2025-07-25T22:37:21.263Z","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
error: ❌ Refund processing failed Deposit has already been refunded {"service":"k33p-backend","timestamp":"2025-07-25T22:37:21.264Z","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt","walletAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
POST /api/refund 400 315.852 ms - 102
info: GET /api/health {"ip":"::ffff:10.222.24.121","service":"k33p-backend","timestam