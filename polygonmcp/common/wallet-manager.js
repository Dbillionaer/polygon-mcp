// wallet-manager.js - Centralized wallet management
const { Wallet } = require('ethers');
const { createWalletError, ErrorCodes } = require('../errors');
const { defaultLogger } = require('../logger');

class WalletManager {
  constructor() {
    this.wallets = new Map();
    this.providers = new Map();
  }
  
  /**
   * Register provider for a specific network
   * @param {string} network - Network identifier
   * @param {JsonRpcProvider} provider - Provider instance
   */
  registerProvider(network, provider) {
    this.providers.set(network, provider);
    defaultLogger.debug(`Provider registered for network: ${network}`);
  }
  
  /**
   * Connect wallet using private key
   * @param {string} privateKey - Private key for wallet
   * @param {string} network - Network identifier (e.g., 'ethereum', 'polygon')
   * @returns {Wallet} Connected wallet instance
   */
  connectWallet(privateKey, network) {
    if (!privateKey) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        "Private key is required to connect wallet",
        { context: `WalletManager.connectWallet(${network})` }
      );
    }
    
    const provider = this.providers.get(network);
    if (!provider) {
      throw createWalletError(
        ErrorCodes.INVALID_NETWORK,
        `No provider registered for network: ${network}`,
        { context: "WalletManager.connectWallet", network }
      );
    }
    
    try {
      const wallet = new Wallet(privateKey, provider);
      this.wallets.set(network, wallet);
      defaultLogger.info(`Wallet connected for network: ${network}`);
      return wallet;
    } catch (error) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        `Failed to connect wallet for network ${network}: ${error.message}`,
        { context: "WalletManager.connectWallet", network }
      );
    }
  }
  
  /**
   * Get connected wallet for a specific network
   * @param {string} network - Network identifier
   * @returns {Wallet} Connected wallet instance
   */
  getWallet(network) {
    if (!this.wallets.has(network)) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        `No wallet connected for network: ${network}`,
        { context: "WalletManager.getWallet", network }
      );
    }
    return this.wallets.get(network);
  }
  
  /**
   * Check if wallet is connected for a specific network
   * @param {string} network - Network identifier
   * @returns {boolean} True if wallet is connected
   */
  isWalletConnected(network) {
    return this.wallets.has(network);
  }
  
  /**
   * Get wallet address for a specific network
   * @param {string} network - Network identifier
   * @returns {string} Wallet address
   */
  getAddress(network) {
    const wallet = this.getWallet(network);
    return wallet.address;
  }
  
  /**
   * Connect same wallet to multiple networks
   * @param {string} privateKey - Private key for wallet
   * @param {string[]} networks - Array of network identifiers
   * @returns {Object} Map of network to wallet instances
   */
  connectToMultipleNetworks(privateKey, networks) {
    if (!Array.isArray(networks) || networks.length === 0) {
      throw createWalletError(
        ErrorCodes.INVALID_PARAMETERS,
        "At least one network must be specified",
        { context: "WalletManager.connectToMultipleNetworks" }
      );
    }
    
    const result = {};
    for (const network of networks) {
      result[network] = this.connectWallet(privateKey, network);
    }
    
    return result;
  }
}

// Export singleton instance
module.exports = new WalletManager();
