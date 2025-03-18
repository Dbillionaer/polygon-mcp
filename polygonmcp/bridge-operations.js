// bridge-operations.js - Polygon Bridge Operations using @maticnetwork/maticjs
const { Web3ClientPlugin } = require('@maticnetwork/maticjs-web3');
const { MaticPOSClient } = require('@maticnetwork/maticjs');
const { JsonRpcProvider, Wallet, parseEther, formatEther, parseUnits } = require('ethers');

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
      parentDefaultOptions: { confirmations: 2 },
      maticDefaultOptions: { confirmations: 2 }
    });
  }
  
  // Connect wallet for operations
  connectWallet(privateKey) {
    this.rootWallet = new Wallet(privateKey, this.rootProvider);
    this.childWallet = new Wallet(privateKey, this.childProvider);
    
    // Update MaticPOSClient with signers
    this.maticPOSClient.setWallet(this.rootWallet, this.childWallet);
  }
  
  // Deposit ETH to Polygon
  async depositETH(amount) {
    if (!this.rootWallet) {
      throw new Error("Wallet not connected");
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
      throw new Error(`ETH deposit failed: ${error.message}`);
    }
  }
  
  // Deposit ERC20 to Polygon
  async depositERC20(tokenAddress, amount) {
    if (!this.rootWallet) {
      throw new Error("Wallet not connected");
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
      throw new Error(`ERC20 deposit failed: ${error.message}`);
    }
  }
  
  // Withdraw POL (formerly MATIC) from Polygon to Ethereum
  async withdrawPOL(amount) {
    if (!this.childWallet) {
      throw new Error("Wallet not connected");
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
      throw new Error(`POL withdrawal failed: ${error.message}`);
    }
  }
  
  // Withdraw MATIC from Polygon to Ethereum (legacy name for backward compatibility)
  async withdrawMATIC(amount) {
    return this.withdrawPOL(amount);
  }
  
  // Withdraw ERC20 from Polygon to Ethereum
  async withdrawERC20(tokenAddress, amount) {
    if (!this.childWallet) {
      throw new Error("Wallet not connected");
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
      throw new Error(`ERC20 withdrawal failed: ${error.message}`);
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
      throw new Error(`Failed to track transaction: ${error.message}`);
    }
  }
  
  // Get transaction status for a specific transaction
  async getTransactionStatus(txHash) {
    try {
      return await this.maticPOSClient.getTransactionStatus(txHash);
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }
  
  // Get checkpoint status for a specific transaction
  async getCheckpointStatus(txHash) {
    try {
      return await this.maticPOSClient.getCheckpointStatus(txHash);
    } catch (error) {
      throw new Error(`Failed to get checkpoint status: ${error.message}`);
    }
  }
  
  // Get exit transaction hash for a specific transaction
  async getExitTransactionHash(txHash) {
    try {
      return await this.maticPOSClient.getExitTransactionHash(txHash);
    } catch (error) {
      throw new Error(`Failed to get exit transaction hash: ${error.message}`);
    }
  }
}

module.exports = { PolygonBridge };
