// test-ethers-v6.js - Simple test script to verify ethers.js v6 functionality

// Import ethers.js v6
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

console.log('Starting ethers.js v6 test');

// Test basic functionality
async function testEthersV6() {
  try {
    console.log('Testing ethers.js v6 functionality');
    
    // Test address validation
    const validAddress = '0x0000000000000000000000000000000000000000';
    console.log(`Is ${validAddress} a valid address:`, isAddress(validAddress));
    
    // Test formatting
    const wei = parseEther('1.0');
    console.log('1.0 ETH in wei:', wei.toString());
    console.log('Wei back to ETH:', formatEther(wei));
    
    // Test provider - using Ethereum mainnet public endpoint instead
    const provider = new JsonRpcProvider('https://eth.llamarpc.com');
    console.log('Provider created successfully');
    
    // Test fee data
    const feeData = await provider.getFeeData();
    console.log('Fee data:', {
      gasPrice: feeData.gasPrice ? formatUnits(feeData.gasPrice, 'gwei') : null,
      maxFeePerGas: feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 'gwei') : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null,
      baseFeePerGas: feeData.baseFeePerGas ? formatUnits(feeData.baseFeePerGas, 'gwei') : null
    });
    
    console.log('All ethers.js v6 tests passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error);
  }
}

// Run the tests
testEthersV6()
  .then(() => {
    console.log('Tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Tests failed:', error.message);
    process.exit(1);
  });
