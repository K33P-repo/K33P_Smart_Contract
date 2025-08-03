import { Lucid, Blockfrost } from 'lucid-cardano';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CONFIG = {
  network: "Preprod",
  blockfrostUrl: "https://cardano-preprod.blockfrost.io/api/v0",
  blockfrostApiKey: process.env.BLOCKFROST_API_KEY || "preprodbl7bIxYc2sbEeGAZyo2hpkjJwzOAQNtG"
};

async function testBlockfrostConnection() {
  try {
    console.log('🔍 Testing Blockfrost connection...');
    console.log('API Key:', CONFIG.blockfrostApiKey.substring(0, 10) + '...');
    console.log('URL:', CONFIG.blockfrostUrl);
    console.log('Network:', CONFIG.network);
    
    // Test direct API call first
    console.log('\n📡 Testing direct API call...');
    const response = await fetch(`${CONFIG.blockfrostUrl}/network`, {
      headers: {
        'project_id': CONFIG.blockfrostApiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const networkData = await response.json();
    console.log('✅ Direct API call successful:', networkData);
    
    // Test protocol parameters endpoint
    console.log('\n📡 Testing protocol parameters endpoint...');
    const paramsResponse = await fetch(`${CONFIG.blockfrostUrl}/epochs/latest/parameters`, {
      headers: {
        'project_id': CONFIG.blockfrostApiKey
      }
    });
    
    if (!paramsResponse.ok) {
      throw new Error(`HTTP ${paramsResponse.status}: ${paramsResponse.statusText}`);
    }
    
    const paramsData = await paramsResponse.json();
    console.log('✅ Protocol parameters call successful');
    console.log('Key parameters:', {
      min_fee_a: paramsData.min_fee_a,
      min_fee_b: paramsData.min_fee_b,
      max_tx_size: paramsData.max_tx_size,
      price_mem: paramsData.price_mem,
      price_step: paramsData.price_step
    });
    
    // Now test Lucid initialization
    console.log('\n🚀 Testing Lucid initialization...');
    const blockfrost = new Blockfrost(CONFIG.blockfrostUrl, CONFIG.blockfrostApiKey);
    
    // Test the blockfrost provider directly
    console.log('📡 Testing Blockfrost provider methods...');
    try {
      const protocolParams = await blockfrost.getProtocolParameters();
      console.log('✅ Blockfrost getProtocolParameters successful:', protocolParams);
    } catch (error) {
      console.error('❌ Blockfrost getProtocolParameters failed:', error.message);
      console.error('Stack:', error.stack);
      return;
    }
    
    const lucid = await Lucid.new(blockfrost, CONFIG.network);
    console.log('✅ Lucid initialization successful!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testBlockfrostConnection();