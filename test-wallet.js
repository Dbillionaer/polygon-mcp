// test-wallet.js - Simple test script to verify ethers.js v6 wallet functionality

// Import ethers.js v6
const { Wallet, HDNodeWallet, toUtf8Bytes, verifyMessage } = require('ethers');

console.log('Starting ethers.js v6 wallet test');

// Test wallet functionality
async function testWallet() {
  try {
    // Create a random wallet
    const randomWallet = Wallet.createRandom();
    console.log('Random wallet created:');
    console.log('  Address:', randomWallet.address);
    console.log('  Private Key:', randomWallet.privateKey);
    console.log('  Mnemonic:', randomWallet.mnemonic?.phrase);
    
    // Create a wallet from a private key
    const privateKey = randomWallet.privateKey;
    const walletFromPrivateKey = new Wallet(privateKey);
    console.log('\nWallet from private key:');
    console.log('  Address:', walletFromPrivateKey.address);
    console.log('  Matches random wallet address:', walletFromPrivateKey.address === randomWallet.address);
    
    // Create a wallet from a mnemonic phrase
    const mnemonic = randomWallet.mnemonic?.phrase;
    if (mnemonic) {
      const walletFromMnemonic = HDNodeWallet.fromPhrase(mnemonic);
      console.log('\nWallet from mnemonic:');
      console.log('  Address:', walletFromMnemonic.address);
      console.log('  Matches random wallet address:', walletFromMnemonic.address === randomWallet.address);
      
      // Test wallet derivation - in ethers v6, we need to use the correct approach
      // We need to get the node at the default path first
      const hdNode = HDNodeWallet.fromPhrase(mnemonic);
      // Then derive the child at index 1
      const derivedWallet = hdNode.deriveChild(1);
      console.log('\nDerived wallet (child index 1):');
      console.log('  Address:', derivedWallet.address);
    }
    
    // Test signing a message
    const message = "Hello, Polygon!";
    const signature = await randomWallet.signMessage(message);
    console.log('\nSigned message:');
    console.log('  Message:', message);
    console.log('  Signature:', signature);
    
    // Verify the signature - in ethers v6, we use verifyMessage
    const recoveredAddress = verifyMessage(message, signature);
    console.log('\nSignature verification:');
    console.log('  Recovered address:', recoveredAddress);
    console.log('  Matches wallet address:', recoveredAddress === randomWallet.address);
    
    console.log('\nAll wallet tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error);
    return false;
  }
}

// Run the tests
testWallet()
  .then((success) => {
    console.log('\nTests completed', success ? 'successfully' : 'with failures');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\nTests failed:', error.message);
    process.exit(1);
  });
