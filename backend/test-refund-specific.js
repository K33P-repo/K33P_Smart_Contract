import fetch from 'node-fetch';

const testRefund = async () => {
  const userAddress = 'addr_test1qz0fsl3fw5esrdpg4522k8w0z86h23pnnruux0yxxgz2kxht64h5wp0ct5wtlszngutru55cpczcpp6793qknrptlqpqsu88yt';
  
  console.log('Testing refund endpoint for address:', userAddress);
  
  try {
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
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Refund successful!');
    } else {
      console.log('❌ Refund failed:', data.message);
    }
    
  } catch (error) {
    console.error('Error testing refund:', error.message);
  }
};

testRefund();