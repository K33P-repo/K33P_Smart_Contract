@echo off
echo 🧪 Testing Deployed ZK Login Endpoint with curl
echo ================================================
echo 🌐 API URL: https://k33p-backend-0kyx.onrender.com/api
echo.

set API_URL=https://k33p-backend-0kyx.onrender.com/api
set WALLET_ADDRESS=addr_test1wznyv36t3a2rzfs4q6mvyu7nqlr4dxjwkmykkskafg54yzs735733999
set PHONE_NUMBER=0666866559900
set COMMITMENT=0957ca616a6c3f33876bf9707a2c06a2b3cf8c1cf3209c6a09
set USER_ID=user_meban3xo_e302qv

echo 🔐 Test 1: ZK Login with Wallet Address
echo ----------------------------------------
echo.

echo 📡 Sending wallet login request...
curl -X POST "%API_URL%/zk/login" ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json" ^
  -d "{\"walletAddress\":\"%WALLET_ADDRESS%\",\"proof\":{\"publicInputs\":{\"commitment\":\"%COMMITMENT%\"},\"isValid\":true,\"proof\":\"zk-proof-a9b09488404105414ebe83f4c9732d53-0957ca616a\",\"proofData\":{\"proof\":\"zk-proof-a9b09488404105414ebe83f4c9732d53-0957ca616a\",\"publicInputs\":{\"commitment\":\"%COMMITMENT%-5a353cd4\"},\"isValid\":true}},\"commitment\":\"%COMMITMENT%\"}" ^
  -w "\n📊 Response Status: %%{http_code}\n" ^
  -s

echo.
echo.
echo 🔐 Test 2: ZK Login with Phone Number
echo -------------------------------------
echo.

echo 📡 Sending phone login request...
curl -X POST "%API_URL%/zk/login" ^
  -H "Content-Type: application/json" ^
  -H "Accept: application/json" ^
  -d "{\"phone\":\"%PHONE_NUMBER%\",\"proof\":{\"publicInputs\":{\"commitment\":\"%COMMITMENT%\"},\"isValid\":true,\"proof\":\"zk-proof-a9b09488404105414ebe83f4c9732d53-0957ca616a\",\"proofData\":{\"proof\":\"zk-proof-a9b09488404105414ebe83f4c9732d53-0957ca616a\",\"publicInputs\":{\"commitment\":\"%COMMITMENT%-5a353cd4\"},\"isValid\":true}},\"commitment\":\"%COMMITMENT%\"}" ^
  -w "\n📊 Response Status: %%{http_code}\n" ^
  -s

echo.
echo.
echo 🏁 curl Test Complete
echo ====================
echo 📋 Test Summary:
echo    📊 User ID: %USER_ID%
echo    📱 Phone: %PHONE_NUMBER%
echo    💳 Wallet: %WALLET_ADDRESS%
echo    🔐 Commitment: %COMMITMENT%
echo    🌐 API: %API_URL%
echo.
echo 💡 Note: Both tests should return 200 status with JWT tokens
pause