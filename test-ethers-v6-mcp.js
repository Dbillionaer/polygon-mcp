// test-ethers-v6-mcp.js - Test ethers.js v6 functionality in the MCP server context

// Import ethers.js v6 directly
const { 
  JsonRpcProvider, 
  Wallet, 
  HDNodeWallet, 
  isAddress,
  formatUnits,
  formatEther,
  parseUnits,
  parseEther
} = require('ethers');

console.log('Starting ethers.js v6 MCP test');

// Test ethers.js v6 functionality in MCP context
async function testEthersV6MCP() {
  try {
    console.log('\n--- Testing ethers.js v6 functionality for MCP ---');
    
    // Test provider initialization (similar to how MCP server initializes providers)
    console.log('\nTesting provider initialization:');
    const providers = {
      mainnet: new JsonRpcProvider('https://polygon-rpc.com'),
      ethereum: new JsonRpcProvider('https://eth.llamarpc.com') // Using Ethereum mainnet instead of Mumbai
    };
    console.log('Providers initialized successfully');
    
    // Test HD wallet functionality (similar to how MCP server initializes wallets)
    console.log('\nTesting HD wallet functionality:');
    const mnemonic = Wallet.createRandom().mnemonic?.phrase;
    if (!mnemonic) {
      throw new Error('Failed to generate mnemonic');
    }
    console.log('Generated mnemonic successfully');
    
    // Create HD wallet from mnemonic
    const hdWallet = HDNodeWallet.fromPhrase(mnemonic);
    console.log('Created HD wallet successfully');
    console.log(`HD wallet address: ${hdWallet.address}`);
    
    // Derive child wallet (similar to how MCP server derives wallets)
    console.log('\nTesting wallet derivation:');
    const derivedWallet = hdWallet.deriveChild(0);
    console.log('Derived wallet successfully');
    console.log(`Derived wallet address: ${derivedWallet.address}`);
    
    // Connect wallet to provider (similar to how MCP server connects wallets)
    console.log('\nTesting wallet connection to provider:');
    const connectedWallet = derivedWallet.connect(providers.ethereum);
    console.log('Connected wallet to provider successfully');
    
    // Test fee data retrieval (similar to how MCP server gets gas prices)
    console.log('\nTesting fee data retrieval:');
    const feeData = await providers.ethereum.getFeeData();
    console.log('Retrieved fee data successfully');
    console.log('Fee data:');
    console.log(`- Gas price: ${feeData.gasPrice ? formatUnits(feeData.gasPrice, 'gwei') : 'null'} gwei`);
    console.log(`- Max fee per gas: ${feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 'gwei') : 'null'} gwei`);
    console.log(`- Max priority fee per gas: ${feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : 'null'} gwei`);
    
    console.log('\nAll ethers.js v6 MCP tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error);
    return false;
  }
}

// Run the tests
testEthersV6MCP()
  .then((success) => {
    console.log('\nTests completed', success ? 'successfully' : 'with failures');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\nTests failed:', error.message);
    process.exit(1);
  });
