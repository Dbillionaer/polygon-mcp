// bridge-operations.js - Polygon Bridge Operations using @maticnetwork/maticjs
const { MaticPOSClient } = require('@maticnetwork/maticjs');
const { JsonRpcProvider, Wallet, parseEther, formatEther, parseUnits } = require('ethers');
const { ErrorCodes, createWalletError, createTransactionError } = require('./errors');

class PolygonBridge {
  constructor(config) {
    this.rootRpcUrl = config.rootRpcUrl;
    this.childRpcUrl = config.childRpcUrl;
    this.posRootChainManager = config.posRootChainManager;
    this.polygonApiUrl = config.polygonApiUrl;
    
    // Initialize providers
    this.rootProvider = new JsonRpcProvider(this.rootRpcUrl);
    this.childProvider = new JsonRpcProvider(this.childRpcUrl);
    
    // Initialize MaticPOSClient
    this.maticPOSClient = new MaticPOSClient({
      network: 'mainnet', // or 'testnet' based on your needs
      version: 'v1',
      maticProvider: this.childProvider,
      parentProvider: this.rootProvider,
      posRootChainManager: this.posRootChainManager,
      parentDefaultOptions: { confirmations: 2, from: config.rootChainAddress },
      maticDefaultOptions: { confirmations: 2, from: config.childChainAddress }
    });
  }
  
  // Connect wallet for operations
  connectWallet(privateKey) {
    if (!privateKey) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        "Private key is required to connect wallet",
        { context: "PolygonBridge.connectWallet" }
      );
    }
    this.rootWallet = new Wallet(privateKey, this.rootProvider);
    this.childWallet = new Wallet(privateKey, this.childProvider);
    
    // Recreate MaticPOSClient with wallet addresses
    this.maticPOSClient = new MaticPOSClient({
      network: 'mainnet',
      version: 'v1',
      maticProvider: this.childProvider,
      parentProvider: this.rootProvider,
      posRootChainManager: this.posRootChainManager,
      parentDefaultOptions: { confirmations: 2, from: this.rootWallet.address },
      maticDefaultOptions: { confirmations: 2, from: this.childWallet.address }
    });
  }
  
  // Deposit ETH to Polygon
  async depositETH(amount) {
    if (!this.rootWallet) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        "Wallet not connected",
        { context: "PolygonBridge.depositETH" }
      );
    }
    
    try {
      // Convert amount to wei
      const amountWei = parseEther(amount.toString());
      
      // Deposit ETH to Polygon using MaticPOSClient
      const tx = await this.maticPOSClient.depositEther(amountWei, {
        from: this.rootWallet.address,
        gasLimit: 300000
      });
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        amount: formatEther(amountWei),
        status: "Deposit initiated"
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `ETH deposit failed: ${error.message}`,
        { amount }
      );
    }
  }
  
  // Deposit ERC20 to Polygon
  async depositERC20(tokenAddress, amount) {
    if (!this.rootWallet) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        "Wallet not connected",
        { context: "PolygonBridge.depositERC20" }
      );
    }
    
    try {
      // Get token details
      const tokenContract = await this.maticPOSClient.getERC20Token(tokenAddress);
      const decimals = await tokenContract.decimals();
      
      // Convert amount to token units
      const amountInTokenUnits = parseUnits(amount.toString(), decimals);
      
      // Deposit tokens to Polygon using MaticPOSClient
      const tx = await this.maticPOSClient.depositERC20ForUser(
        tokenAddress,
        this.rootWallet.address,
        amountInTokenUnits,
        {
          from: this.rootWallet.address,
          gasLimit: 300000
        }
      );
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        tokenAddress,
        amount: amount.toString(),
        status: "Deposit initiated"
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `ERC20 deposit failed: ${error.message}`,
        { tokenAddress, amount }
      );
    }
  }
  
  // Withdraw POL (formerly MATIC) from Polygon to Ethereum
  async withdrawPOL(amount) {
    if (!this.childWallet) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        "Wallet not connected",
        { context: "PolygonBridge.withdrawPOL" }
      );
    }
    
    try {
      // Convert amount to wei
      const amountWei = parseEther(amount.toString());
      
      // Withdraw POL using MaticPOSClient
      const tx = await this.maticPOSClient.withdrawMatic(amountWei, {
        from: this.childWallet.address,
        gasLimit: 300000
      });
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        amount: formatEther(amountWei),
        status: "Withdrawal initiated, waiting for checkpoint"
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `POL withdrawal failed: ${error.message}`,
        { amount }
      );
    }
  }
  
  // Withdraw MATIC from Polygon to Ethereum (legacy name for backward compatibility)
  async withdrawMATIC(amount) {
    return this.withdrawPOL(amount);
  }
  
  // Withdraw ERC20 from Polygon to Ethereum
  async withdrawERC20(tokenAddress, amount) {
    if (!this.childWallet) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        "Wallet not connected",
        { context: "PolygonBridge.withdrawERC20" }
      );
    }
    
    try {
      // Get token details
      const tokenContract = await this.maticPOSClient.getERC20Token(tokenAddress);
      const decimals = await tokenContract.decimals();
      
      // Convert amount to token units
      const amountInTokenUnits = parseUnits(amount.toString(), decimals);
      
      // Withdraw tokens using MaticPOSClient
      const tx = await this.maticPOSClient.withdrawERC20(
        tokenAddress,
        amountInTokenUnits,
        {
          from: this.childWallet.address,
          gasLimit: 300000
        }
      );
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        tokenAddress,
        amount: amount.toString(),
        status: "Withdrawal initiated, waiting for checkpoint"
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `ERC20 withdrawal failed: ${error.message}`,
        { tokenAddress, amount }
      );
    }
  }
  
  // Track bridge transaction status
  async trackBridgeTransaction(txHash, network) {
    try {
      // Get transaction status using MaticPOSClient
      const status = await this.maticPOSClient.getTransactionStatus(txHash);
      
      return {
        transactionHash: txHash,
        network,
        status: status.status,
        timestamp: new Date().toISOString(),
        details: `Transaction is in ${status.status} state`,
        checkpoint: status.checkpoint,
        exitTransactionHash: status.exitTransactionHash
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `Failed to track transaction: ${error.message}`,
        { txHash, network }
      );
    }
  }
  
  // Get transaction status for a specific transaction
  async getTransactionStatus(txHash) {
    try {
      return await this.maticPOSClient.getTransactionStatus(txHash);
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `Failed to get transaction status: ${error.message}`,
        { txHash }
      );
    }
  }
  
  // Get checkpoint status for a specific transaction
  async getCheckpointStatus(txHash) {
    try {
      return await this.maticPOSClient.getCheckpointStatus(txHash);
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `Failed to get checkpoint status: ${error.message}`,
        { txHash }
      );
    }
  }
  
  // Get exit transaction hash for a specific transaction
  async getExitTransactionHash(txHash) {
    try {
      return await this.maticPOSClient.getExitTransactionHash(txHash);
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `Failed to get exit transaction hash: ${error.message}`,
        { txHash }
      );
    }
  }
}

module.exports = { PolygonBridge };
