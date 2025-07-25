=== SIGNUP DEBUG START ===
Request body: {
  "userId": "user_mdiv4coy_0dv9gr",
  "userAddress": "addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt",
  "phoneNumber": "2349160389347",
  "commitment": "9173ad417f969afaa3c62f8e56b3dea72e8204dc5da28074f4-a19e11c1"
}
Content-Type: application/json
Environment variables check:
- JWT_SECRET: SET
- JWT_EXPIRATION: 3600000
- BLOCKFROST_API_KEY: SET
Extracted fields: {
  userAddress: 'addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt',
  userId: 'user_mdiv4coy_0dv9gr',
  phoneNumber: '2349160389347',
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
  finalPhoneNumber: '2349160389347',
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
info: User stored successfully {"service":"storage-abstraction","storage":"postgresql","timestamp":"2025-07-25T13:34:05.155Z","userId":"user_mdiv4coy_0dv9gr"}
User created successfully, ID: 30d66b32-5aff-455e-a668-8c15bec0a8b9 Storage: postgresql
Step 8.1: Storing ZK proof using ZK Proof Service...
Failed to store ZK proof using ZK Proof Service: Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/opt/render/project/src/backend/dist/services/zk-proof-service.js.js' imported from /opt/render/project/src/backend/dist/routes/auth.js
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:860:10)
    at defaultResolve (node:internal/modules/esm/resolve:984:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:685:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:634:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:617:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:273:38)
Step 9: Generating JWT token...
    at onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:577:36)
    at TracingChannel.tracePromise (node:diagnostics_channel:344:14)
    at ModuleLoader.import (node:internal/modules/esm/loader:576:21) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///opt/render/project/src/backend/dist/services/zk-proof-service.js.js'
}
JWT token generated successfully
Step 10: Creating session...
Running in production mode - not saving mock database
Session created successfully
Step 11: Building response...
Response built successfully
=== SIGNUP DEBUG END ===
POST /api/auth/signup 201 534.246 ms - 682
info: POST /api/refund {"ip":"::1","service":"k33p-backend","timestamp":"2025-07-25T13:34:05.562Z","userAgent":"okhttp/4.12.0"}
info: 🔄 Processing immediate refund request {"headers":{"content-type":"application/json","user-agent":"okhttp/4.12.0"},"requestBody":{"userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt","walletAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"},"service":"k33p-backend","timestamp":"2025-07-25T13:34:05.565Z","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt","walletAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
info: 📊 User deposit lookup result {"depositFound":false,"service":"k33p-backend","timestamp":"2025-07-25T13:34:05.722Z","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
info: 🔄 Calling k33pManager.processRefund {"service":"k33p-backend","timestamp":"2025-07-25T13:34:05.722Z","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt","walletAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
🔍 Processing refund for user: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt
📊 Deposit found: false
💰 Processing refund to addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt...
📝 Creating new deposit record for refund tracking: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt
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
info: Generating ZK proof for user registration {"service":"k33p-backend","timestamp":"2025-07-25T13:34:07.001Z","userId":"refund_1753450446688"}
Error in generateZkCommitment: phoneHash is required
error: Failed to generate and store ZK proof {"error":"Failed to generate ZK commitment: phoneHash is required","service":"k33p-backend","timestamp":"2025-07-25T13:34:07.001Z","userId":"refund_1753450446688"}
Failed to generate ZK proof for user creation: Error: Failed to generate ZK commitment: phoneHash is required
    at generateZkCommitment (file:///opt/render/project/src/backend/dist/utils/zk.js:73:15)
    at ZKProofService.generateAndStoreUserZKProof (file:///opt/render/project/src/backend/dist/services/zk-proof-service.js:30:32)
    at DatabaseService.createUser (file:///opt/render/project/src/backend/dist/database/service.js:22:34)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async EnhancedK33PManagerDB.processRefund (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:470:25)
    at async file:///opt/render/project/src/backend/dist/k33p-backend-server.js:417:24
✅ Created user record for refund: refund_1753450446688
info: Generating ZK proof for data entry {"dataType":"deposit_creation","service":"k33p-backend","timestamp":"2025-07-25T13:34:07.166Z","userId":"refund_1753450446688"}
Error in generateZkProof: phone is required
info: Data ZK proof generated and stored successfully {"commitment":"a6fdaa765f45f173b3c5...","dataId":"090494ca-bdf6-4ba5-b065-eee108f4784f","dataType":"deposit_creation","service":"k33p-backend","timestamp":"2025-07-25T13:34:07.332Z","userId":"refund_1753450446688"}
✅ ZK proof generated for deposit creation: refund_1753450446688
✅ Created new deposit record for refund: refund_1753450446688
info: Generating ZK proof for data entry {"dataType":"transaction_creation","service":"k33p-backend","timestamp":"2025-07-25T13:34:07.491Z","userId":"tx_1753450447491"}
Error in generateZkProof: phone is required
info: GET /api/health {"ip":"::ffff:10.222.26.168","service":"k33p-backend","timestamp":"2025-07-25T13:34:07.644Z","userAgent":"Render/1.0"}
GET /api/health 200 0.452 ms - 114
error: Failed to generate and store data ZK proof {"dataType":"transaction_creation","error":"insert or update on table \"zk_proofs\" violates foreign key constraint \"zk_proofs_user_id_fkey\"","service":"k33p-backend","timestamp":"2025-07-25T13:34:07.647Z","userId":"tx_1753450447491"}
✅ Refund processed successfully: fbc363ed1e23259146da8bdd292073c543635bea222a3f62f36084d0a0296bef
Failed to generate ZK proof for transaction creation: error: insert or update on table "zk_proofs" violates foreign key constraint "zk_proofs_user_id_fkey"
    at /opt/render/project/src/backend/node_modules/pg/lib/client.js:545:17
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async ZKProofService.storeZKProofInDatabase (file:///opt/render/project/src/backend/dist/services/zk-proof-service.js:140:13)
    at async ZKProofService.generateAndStoreDataZKProof (file:///opt/render/project/src/backend/dist/services/zk-proof-service.js:105:13)
    at async DatabaseService.createTransaction (file:///opt/render/project/src/backend/dist/database/service.js:151:13)
    at async EnhancedK33PManagerDB.processRefund (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:498:13)
    at async file:///opt/render/project/src/backend/dist/k33p-backend-server.js:417:24 {
  length: 273,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(tx_1753450447491) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'zk_proofs',
  column: undefined,
  dataType: undefined,
  constraint: 'zk_proofs_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2608',
  routine: 'ri_ReportViolation'
}
info: 📊 Refund processing result Refund processed successfully {"service":"k33p-backend","success":true,"timestamp":"2025-07-25T13:34:07.648Z","txHash":"fbc363ed1e23259146da8bdd292073c543635bea222a3f62f36084d0a0296bef","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
info: ✅ Refund processed successfully {"service":"k33p-backend","timestamp":"2025-07-25T13:34:07.648Z","txHash":"fbc363ed1e23259146da8bdd292073c543635bea222a3f62f36084d0a0296bef","userAddress":"addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt"}
POST /api/refund 200 2087.180 ms - 179
info: GET /api/health {"ip":"::ffff:10.222.26.168","service":"k33p-backend","timestamp":"2025-07-25T13:34:12.643Z","userAgent":"Render/1.0"}
GET /api/health 200 0.463 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.26.168","service":"k33p-backend","timestamp":"2025-07-25T13:34:17.643Z","userAgent":"Render/1.0"}
GET /api/health 200 0.643 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.26.168","service":"k33p-backend","timestamp":"2025-07-25T13:34:22.643Z","userAgent":"Render/1.0"}
GET /api/health 200 0.510 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.26.168","service":"k33p-backend","timestamp":"2025-07-25T13:34:27.644Z","userAgent":"Render/1.0"}
GET /api/health 200 0.694 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.26.168","service":"k33p-backend","timestamp":"2025-07-25T13:34:27.645Z","userAgent":"Render/1.0"}
GET /api/health 200 0.311 ms - 114
info: GET /api/health {"ip":"::ffff:10.222.26.168","service":"k33p-backend","timestamp":"2025-07-25T13:34:32.644Z","userAgent":"Render/1.0"}
GET /api/health 200 0.657 ms - 114
info: 📨 Found 1 new incoming transactions {"service":"auto-refund-monitor","timestamp":"2025-07-25T13:34:34.820Z"}
info: 💰 Processing incoming transaction: ee5211e4af14e8f11d3efdd6b66212ace70da1a294dacfd252e0b3c346b4b663 {"service":"auto-refund-monitor","timestamp":"2025-07-25T13:34:34.820Z"}
info: 📍 From: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt {"service":"auto-refund-monitor","timestamp":"2025-07-25T13:34:34.821Z"}
info: 💵 Amount: 2 ADA {"service":"auto-refund-monitor","timestamp":"2025-07-25T13:34:34.821Z"}
info: Generating ZK proof for data entry {"dataType":"transaction_creation","service":"k33p-backend","timestamp":"2025-07-25T13:34:34.980Z","userId":"tx_1753450474980"}
Error in generateZkProof: phone is required
error: Failed to generate and store data ZK proof {"dataType":"transaction_creation","error":"insert or update on table \"zk_proofs\" violates foreign key constraint \"zk_proofs_user_id_fkey\"","service":"k33p-backend","timestamp":"2025-07-25T13:34:35.136Z","userId":"tx_1753450474980"}
Failed to generate ZK proof for transaction creation: error: insert or update on table "zk_proofs" violates foreign key constraint "zk_proofs_user_id_fkey"
    at /opt/render/project/src/backend/node_modules/pg/lib/client.js:545:17
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async ZKProofService.storeZKProofInDatabase (file:///opt/render/project/src/backend/dist/services/zk-proof-service.js:140:13)
    at async ZKProofService.generateAndStoreDataZKProof (file:///opt/render/project/src/backend/dist/services/zk-proof-service.js:105:13)
    at async DatabaseService.createTransaction (file:///opt/render/project/src/backend/dist/database/service.js:151:13)
    at async AutoRefundMonitor.saveProcessedTransaction (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:378:13)
    at async AutoRefundMonitor.processIncomingTransaction (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:252:13)
    at async AutoRefundMonitor.monitorAndProcessRefunds (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:117:17)
    at async Timeout._onTimeout (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:78:17) {
  length: 273,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(tx_1753450474980) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'zk_proofs',
  column: undefined,
  dataType: undefined,
  constraint: 'zk_proofs_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2608',
  routine: 'ri_ReportViolation'
}
🔍 Processing refund for user: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt
📊 Deposit found: true
📊 Deposit refunded status: false
💰 Processing refund to addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt...
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
✅ Marked existing deposit as refunded: addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt
info: Generating ZK proof for data entry {"dataType":"transaction_creation","service":"k33p-backend","timestamp":"2025-07-25T13:34:36.612Z","userId":"tx_1753450476612"}
Error in generateZkProof: phone is required
error: Failed to generate and store data ZK proof {"dataType":"transaction_creation","error":"insert or update on table \"zk_proofs\" violates foreign key constraint \"zk_proofs_user_id_fkey\"","service":"k33p-backend","timestamp":"2025-07-25T13:34:36.772Z","userId":"tx_1753450476612"}
✅ Refund processed successfully: 7cfa3cc0bb8ff67649281b986d4b2c8ecf80f828a2e4a7b6eaa1a4766b267926
Failed to generate ZK proof for transaction creation: error: insert or update on table "zk_proofs" violates foreign key constraint "zk_proofs_user_id_fkey"
    at /opt/render/project/src/backend/node_modules/pg/lib/client.js:545:17
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async ZKProofService.storeZKProofInDatabase (file:///opt/render/project/src/backend/dist/services/zk-proof-service.js:140:13)
    at async ZKProofService.generateAndStoreDataZKProof (file:///opt/render/project/src/backend/dist/services/zk-proof-service.js:105:13)
    at async DatabaseService.createTransaction (file:///opt/render/project/src/backend/dist/database/service.js:151:13)
    at async EnhancedK33PManagerDB.processRefund (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:498:13)
    at async AutoRefundMonitor.processAutomaticRefund (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:332:34)
    at async AutoRefundMonitor.processIncomingTransaction (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:260:34)
    at async AutoRefundMonitor.monitorAndProcessRefunds (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:117:17)
    at async Timeout._onTimeout (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:78:17) {
  length: 273,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(tx_1753450476612) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'zk_proofs',
  column: undefined,
  dataType: undefined,
  constraint: 'zk_proofs_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2608',
  routine: 'ri_ReportViolation'
}
info: ✅ Automatic refund processed successfully: 7cfa3cc0bb8ff67649281b986d4b2c8ecf80f828a2e4a7b6eaa1a4766b267926 {"service":"auto-refund-monitor","timestamp":"2025-07-25T13:34:36.776Z"}
error: ❌ Error processing transaction ee5211e4af14e8f11d3efdd6b66212ace70da1a294dacfd252e0b3c346b4b663: duplicate key value violates unique constraint "transactions_tx_hash_key" {"code":"23505","constraint":"transactions_tx_hash_key","detail":"Key (tx_hash)=(7cfa3cc0bb8ff67649281b986d4b2c8ecf80f828a2e4a7b6eaa1a4766b267926) already exists.","file":"nbtinsert.c","length":283,"line":"666","name":"error","routine":"_bt_check_unique","schema":"public","service":"auto-refund-monitor","severity":"ERROR","stack":"error: duplicate key value violates unique constraint \"transactions_tx_hash_key\"\n    at /opt/render/project/src/backend/node_modules/pg/lib/client.js:545:17\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async TransactionModel.create (file:///opt/render/project/src/backend/dist/database/models.js:241:28)\n    at async DatabaseService.createTransaction (file:///opt/render/project/src/backend/dist/database/service.js:137:29)\n    at async AutoRefundMonitor.processIncomingTransaction (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:264:17)\n    at async AutoRefundMonitor.monitorAndProcessRefunds (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:117:17)\n    at async Timeout._onTimeout (file:///opt/render/project/src/backend/dist/services/auto-refund-monitor.js:78:17)","table":"transactions","timestamp":"2025-07-25T13:34:36.931Z"}
info: GET /api/health {"ip":"::ffff:10.222.26.168","service":"k33p-backend","timestamp":"2025-07-25T13:34:37.645Z","userAgent":"Render/1.0"}