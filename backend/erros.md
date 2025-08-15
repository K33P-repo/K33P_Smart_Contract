✅ Fixed imports in /opt/render/project/src/backend/dist/middleware/auth.js
Processing /opt/render/project/src/backend/dist/middleware/error-handler.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/middleware/error-handler.js
Processing /opt/render/project/src/backend/dist/middleware/rate-limiter.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/middleware/rate-limiter.js
Processing /opt/render/project/src/backend/dist/routes/account-recovery.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/account-recovery.js
Processing /opt/render/project/src/backend/dist/routes/auth.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/auth.js
Processing /opt/render/project/src/backend/dist/routes/auto-refund-routes.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/auto-refund-routes.js
Processing /opt/render/project/src/backend/dist/routes/otp.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/otp.js
Processing /opt/render/project/src/backend/dist/routes/phone-management.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/phone-management.js
Processing /opt/render/project/src/backend/dist/routes/seed-phrase-routes.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/seed-phrase-routes.js
Processing /opt/render/project/src/backend/dist/routes/user-management.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/user-management.js
Processing /opt/render/project/src/backend/dist/routes/user-routes.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/user-routes.js
Processing /opt/render/project/src/backend/dist/routes/utxo.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/utxo.js
Processing /opt/render/project/src/backend/dist/routes/zk-postgres.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/zk-postgres.js
Processing /opt/render/project/src/backend/dist/routes/zk.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/routes/zk.js
Processing /opt/render/project/src/backend/dist/services/auto-refund-monitor.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/services/auto-refund-monitor.js
Processing /opt/render/project/src/backend/dist/services/enhanced-iagon-service.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/services/enhanced-iagon-service.js
Processing /opt/render/project/src/backend/dist/services/seed-phrase-storage.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/services/seed-phrase-storage.js
Processing /opt/render/project/src/backend/dist/services/storage-abstraction.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/services/storage-abstraction.js
Processing /opt/render/project/src/backend/dist/services/user-data-storage.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/services/user-data-storage.js
Processing /opt/render/project/src/backend/dist/services/zk-proof-service.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/services/zk-proof-service.js
Processing /opt/render/project/src/backend/dist/utils/firebase.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/utils/firebase.js
Processing /opt/render/project/src/backend/dist/utils/hash.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/utils/hash.js
Processing /opt/render/project/src/backend/dist/utils/iagon.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/utils/iagon.js
Processing /opt/render/project/src/backend/dist/utils/logger.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/utils/logger.js
Processing /opt/render/project/src/backend/dist/utils/lucid.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/utils/lucid.js
Processing /opt/render/project/src/backend/dist/utils/response-helpers.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/utils/response-helpers.js
Processing /opt/render/project/src/backend/dist/utils/zk.js...
✅ Fixed imports in /opt/render/project/src/backend/dist/utils/zk.js
✅ All imports fixed!
==> Uploading build...
==> Uploaded in 7.3s. Compression took 5.9s
==> Build successful 🎉
==> Deploying...
==> Running 'cd backend && npm start'
> k33p-backend-server@1.0.0 start
> node dist/k33p-backend-server.js
Environment variables:
IAGON_API_URL: https://gw.iagon.com/api/v2
IAGON_PERSONAL_ACCESS_TOKEN: [REDACTED]
NODE_ENV: production
Running in production mode - not loading mock database
Creating API client with: {
  url: 'https://gw.iagon.com/api/v2',
  hasToken: true,
  isValidUrl: true
}
Successfully created API client for production use
No Firebase credentials found. Firebase authentication will not work.
Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS environment variable.
info: UserDataStorageService initialized {"service":"k33p-backend","timestamp":"2025-08-15T14:38:46.725Z"}
info: UserDataStorageService initialized {"service":"k33p-backend","timestamp":"2025-08-15T14:38:46.726Z"}
info: Storage health monitoring started {"interval":60000,"service":"storage-abstraction","timestamp":"2025-08-15T14:38:50.698Z"}
✅ Database connection successful: 2025-08-15T14:38:51.085Z
✅ All required tables exist
🚀 Initializing Enhanced K33P Manager with Database...
✅ Database connection successful: 2025-08-15T14:38:51.704Z
✅ All required tables exist
❌ Failed to initialize Enhanced K33P Manager: Error: ENOENT: no such file or directory, open '/opt/render/project/src/backend/plutus.json'
    at Module.readFileSync (node:fs:442:20)
    at EnhancedK33PManagerDB.readFile (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:188:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async EnhancedK33PManagerDB.initialize (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:168:48)
    at async initializeK33P (file:///opt/render/project/src/backend/dist/k33p-backend-server.js:67:9)
    at async startServer (file:///opt/render/project/src/backend/dist/k33p-backend-server.js:486:9) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/opt/render/project/src/backend/plutus.json'
}
error: Failed to initialize K33P Manager with Database: ENOENT: no such file or directory, open '/opt/render/project/src/backend/plutus.json' {"code":"ENOENT","errno":-2,"path":"/opt/render/project/src/backend/plutus.json","service":"k33p-backend","stack":"Error: ENOENT: no such file or directory, open '/opt/render/project/src/backend/plutus.json'\n    at Module.readFileSync (node:fs:442:20)\n    at EnhancedK33PManagerDB.readFile (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:188:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async EnhancedK33PManagerDB.initialize (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:168:48)\n    at async initializeK33P (file:///opt/render/project/src/backend/dist/k33p-backend-server.js:67:9)\n    at async startServer (file:///opt/render/project/src/backend/dist/k33p-backend-server.js:486:9)","syscall":"open","timestamp":"2025-08-15T14:38:52.730Z"}
error: Failed to start server: ENOENT: no such file or directory, open '/opt/render/project/src/backend/plutus.json' {"code":"ENOENT","errno":-2,"path":"/opt/render/project/src/backend/plutus.json","service":"k33p-backend","stack":"Error: ENOENT: no such file or directory, open '/opt/render/project/src/backend/plutus.json'\n    at Module.readFileSync (node:fs:442:20)\n    at EnhancedK33PManagerDB.readFile (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:188:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async EnhancedK33PManagerDB.initialize (file:///opt/render/project/src/backend/dist/enhanced-k33p-manager-db.js:168:48)\n    at async initializeK33P (file:///opt/render/project/src/backend/dist/k33p-backend-server.js:67:9)\n    at async startServer (file:///opt/render/project/src/backend/dist/k33p-backend-server.js:486:9)","syscall":"open","timestamp":"2025-08-15T14:38:52.730Z"}
==> Exited with status 1
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
==> Running 'cd backend && npm start'