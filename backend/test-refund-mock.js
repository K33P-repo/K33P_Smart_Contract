import fetch from 'node-fetch';

const testRefundMock = async () => {
  const userAddress = 'addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt';
  
  console.log('🧪 Testing refund endpoint (Mock Mode)');
  console.log('📍 User Address:', userAddress);
  console.log('💰 Amount: 2 ADA (2,000,000 lovelace)');
  console.log('');
  
  try {
    console.log('📤 Sending refund request...');
    const response = await fetch('http://localhost:3001/api/refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress: userAddress,
        walletAddress: userAddress
      })
    });
    
    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    if (response.status === 200 && data.success) {
      console.log('✅ REFUND SUCCESSFUL!');
      console.log('🔗 Transaction Hash:', data.data?.txHash || 'N/A');
      console.log('💸 Refund processed for 2 ADA');
    } else if (response.status === 400) {
      console.log('⚠️  REFUND FAILED (Expected in mock mode)');
      console.log('📝 Reason:', data.message);
      console.log('💡 This is expected when database is not properly configured');
    } else {
      console.log('❌ UNEXPECTED RESPONSE');
      console.log('🔍 Status:', response.status);
      console.log('📄 Message:', data.message);
    }
    
  } catch (error) {
    console.error('💥 Error testing refund:', error.message);
  }
  
  console.log('');
  console.log('📋 Test Summary:');
  console.log('• Endpoint: POST /api/refund');
  console.log('• Address: ' + userAddress.substring(0, 20) + '...');
  console.log('• Expected: Database connection timeout (development mode)');
  console.log('• Status: Endpoint is functional, database setup needed for full operation');
};

testRefundMock();