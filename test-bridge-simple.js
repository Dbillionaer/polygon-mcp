// test-bridge-simple.js - Simple test script for Polygon Bridge initialization

// Import the PolygonBridge class
const { PolygonBridge } = require('./bridge-operations');
const { Wallet } = require('ethers');

// Test bridge initialization
try {
  console.log('Starting simple Polygon Bridge test');
  
  // Create bridge configuration
  const bridgeConfig = {
    rootRpcUrl: 'https://eth.llamarpc.com', // Ethereum mainnet
    childRpcUrl: 'https://polygon-rpc.com', // Polygon mainnet
    posRootChainManager: '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77', // Mainnet POS Root Chain Manager
    polygonApiUrl: 'https://apis.matic.network'
  };
  
  console.log('Initializing PolygonBridge...');
  
  // Initialize bridge
  const bridge = new PolygonBridge(bridgeConfig);
  
  console.log('PolygonBridge initialized successfully!');
  
  // Create a random wallet for testing
  const randomWallet = Wallet.createRandom();
  console.log('Created random wallet with address:', randomWallet.address);
  
  // Connect wallet to bridge
  bridge.connectWallet(randomWallet.privateKey);
  console.log('Wallet connected successfully!');
  
  console.log('All initialization tests passed!');
  process.exit(0);
} catch (error) {
  console.error('Test failed:', error.message);
  console.error(error);
  process.exit(1);
}
