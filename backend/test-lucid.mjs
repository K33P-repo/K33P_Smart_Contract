import { Lucid, Blockfrost } from 'lucid-cardano';

async function testLucid() {
  try {
    console.log('🔍 Testing Lucid with Blockfrost...');
    
    const lucid = await Lucid.new(
      new Blockfrost(
        'https://cardano-preprod.blockfrost.io/api/v0',
        'preprodZIx5fPLLilrrK99ISQoodwXkn5NAmzVR'
      ),
      'Preprod'
    );
    
    console.log('✅ Lucid initialized successfully');
    
    // Test getting protocol parameters
    const protocolParams = await lucid.provider.getProtocolParameters();
    console.log('✅ Protocol parameters:', protocolParams);
    
  } catch (error) {
    console.log('❌ Lucid Error:', error.message);
    console.log('❌ Stack:', error.stack);
  }
}

testLucid();
