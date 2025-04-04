// bridge-operations.js - Polygon Bridge Operations using @maticnetwork/maticjs

// Import our MaticPOSClient wrapper
import MaticPOSClientWrapper from './common/matic-pos-client-wrapper.js';

import { JsonRpcProvider, parseEther, formatEther, parseUnits } from 'ethers';
import { ErrorCodes, createWalletError, createTransactionError } from './errors.js'; // Use import and add .js
import walletManager from './common/wallet-manager.js'; // Use import andd add .js

export class PolygonBridge { // Add export
  constructor(config) {
    this.rootRpcUrl = config.rootRpcUrl;
    this.childRpcUrl = config.childRpcUrl;
    this.posRootChainManager = config.posRootChainManager;
    this.polygonApiUrl = config.polygonApiUrl;

    // Initialize providers
    this.rootProvider = new JsonRpcProvider(this.rootRpcUrl);
    this.childProvider = new JsonRpcProvider(this.childRpcUrl);

    // Determine network from config or RPC URLs
    if (config.network) {
      // Use the network from config directly
      this.network = config.network;
    } else {
      // Determine network from RPC URLs as fallback
      const isAmoy = this.childRpcUrl.includes('amoy');
      const isSepolia = this.rootRpcUrl.includes('sepolia');

      if (isAmoy || isSepolia) {
        this.network = 'amoy';
      } else {
        this.network = 'mainnet';
      }
    }

    // Log the detected network
    console.log(`Bridge operating on network: ${this.network}`);

    // Store config for later initialization
    this.config = config;

    // MaticPOSClient will be initialized later
    this.maticPOSClient = null;

    // Flag to track initialization
    this.initialized = false;
  }

  // Initialize the MaticPOSClient
  async initialize() {
    if (this.initialized) return;

    console.log('Initializing MaticPOSClient...');
    console.log('Network:', this.network);
    console.log('Root provider:', this.rootProvider);
    console.log('Child provider:', this.childProvider);

    try {
      // Get network-specific configuration
      const networkConfig = this.getNetworkConfig();
      console.log('Using network configuration:', networkConfig);

      // Create a new instance with proper configuration
      this.maticPOSClient = new MaticPOSClientWrapper();
      console.log('Created new MaticPOSClientWrapper instance');

      // Initialize the MaticPOSClientWrapper with the network configuration
      await this.maticPOSClient.init({
        network: networkConfig.network,
        version: networkConfig.version,
        parent: {
          provider: this.rootProvider,
          defaultConfig: {
            from: walletManager.getAddressSafe('ethereum')
          }
        },
        child: {
          provider: this.childProvider,
          defaultConfig: {
            from: walletManager.getAddressSafe('polygon')
          }
        }
      });

      console.log(`MaticPOSClient initialized successfully for ${this.network}`);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize MaticPOSClient:', error);
      throw error;
    }
  }

  // Get network-specific configuration
  getNetworkConfig() {
    // Network-specific configurations
    const networkConfigs = {
      'mainnet': {
        network: 'mainnet',
        version: 'v1',
        parentChain: 'ethereum',
        childChain: 'polygon',
        rootChainAddress: this.config.rootChainAddress,
        rootChainManager: this.config.posRootChainManager,
        depositManagerAddress: '0x401F6c983eA34274ec46f84D70b31C151321188b' // Mainnet address
      },
      'amoy': {
        network: 'testnet',
        version: 'v1',
        parentChain: 'sepolia', // Amoy uses Sepolia as L1
        childChain: 'amoy',
        rootChainAddress: this.config.rootChainAddress,
        rootChainManager: this.config.posRootChainManager,
        // Note: The deposit manager address will be determined by the MaticPOSClient
        // based on the rootChainManager address
      },
      // Only mainnet and Amoy are supported
    };

    // Return the configuration for the current network or default to mainnet
    return networkConfigs[this.network] || networkConfigs['mainnet'];
  }

  // Connect wallet for operations using wallet manager
  async connectWallet(privateKey) {
    if (!privateKey) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        'Private key is required to connect wallet',
        { context: 'PolygonBridge.connectWallet' }
      );
    }

    // Register providers with wallet manager if needed
    if (!walletManager.providers.has('ethereum')) {
      walletManager.registerProvider('ethereum', this.rootProvider);
    }
    if (!walletManager.providers.has('polygon')) {
      walletManager.registerProvider('polygon', this.childProvider);
    }

    // Connect wallets to both networks
    walletManager.connectToMultipleNetworks(privateKey, ['ethereum', 'polygon']);

    // Recreate MaticPOSClient with wallet addresses
    await this.updateMaticPOSClient();
  }

  // Update MaticPOSClient with wallet addresses
  async updateMaticPOSClient() {
    // For MaticPOSClient, we always use ethereum and polygon as the network names
    // regardless of whether we're using mainnet or testnet
    const parentNetworkName = 'ethereum';
    const childNetworkName = 'polygon';

    console.log(`Updating MaticPOSClient with wallet addresses for ${parentNetworkName} and ${childNetworkName}`);

    // Check if wallets are connected for both networks
    if (!walletManager.isWalletConnected(parentNetworkName) || !walletManager.isWalletConnected(childNetworkName)) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        `Wallets not connected for both networks: ${parentNetworkName} and ${childNetworkName}`,
        { context: 'PolygonBridge.updateMaticPOSClient' }
      );
    }

    try {
      // Get network-specific configuration
      const networkConfig = this.getNetworkConfig();
      console.log('Using network configuration for update:', networkConfig);

      // Get wallet addresses
      const ethereumAddress = walletManager.getAddress('ethereum');
      const polygonAddress = walletManager.getAddress('polygon');
      console.log('Ethereum address:', ethereumAddress);
      console.log('Polygon address:', polygonAddress);

      // Create a new instance with proper configuration
      this.maticPOSClient = new MaticPOSClientWrapper();
      console.log('Created new MaticPOSClientWrapper instance');

      // Initialize the MaticPOSClientWrapper with the network configuration and wallet addresses
      await this.maticPOSClient.init({
        network: networkConfig.network,
        version: networkConfig.version,
        parent: {
          provider: this.rootProvider,
          defaultConfig: {
            from: ethereumAddress
          }
        },
        child: {
          provider: this.childProvider,
          defaultConfig: {
            from: polygonAddress
          }
        }
      });

      // Mark as initialized to prevent further initialization attempts
      console.log(`MaticPOSClient updated successfully for ${this.network}`);
      this.initialized = true;
      console.log('MaticPOSClient initialization complete');
    } catch (error) {
      console.error('Error updating MaticPOSClient:', error);
      throw error;
    }
  }

  // Check if wallet is connected for both networks and ensure initialization
  async checkWalletConnected() {
    if (!walletManager.isWalletConnected('ethereum') || !walletManager.isWalletConnected('polygon')) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        'Wallets not connected for both networks',
        { context: 'PolygonBridge' }
      );
    }

    // Ensure MaticPOSClient is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    return true;
  }

  // Deposit ETH to Polygon
  async depositETH(amount) {
    await this.checkWalletConnected();

    try {
      // Convert amount to wei
      const amountWei = parseEther(amount.toString());

      // Deposit ETH to Polygon using MaticPOSClient
      const tx = await this.maticPOSClient.depositEther(amountWei, {
        from: walletManager.getAddress('ethereum'),
        gasLimit: 300000
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        amount: formatEther(amountWei),
        status: 'Deposit initiated'
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
    await this.checkWalletConnected();

    try {
      // Get token details
      const tokenContract = await this.maticPOSClient.getERC20Token(tokenAddress);
      const decimals = await tokenContract.decimals();

      // Convert amount to token units
      const amountInTokenUnits = parseUnits(amount.toString(), decimals);

      // Deposit tokens to Polygon using MaticPOSClient
      const tx = await this.maticPOSClient.depositERC20ForUser(
        tokenAddress,
        walletManager.getAddress('ethereum'),
        amountInTokenUnits,
        {
          from: walletManager.getAddress('ethereum'),
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
        status: 'Deposit initiated'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `ERC20 deposit failed: ${error.message}`,
        { tokenAddress, amount }
      );
    }
  }

  // Withdraw POL (on Amoy) or MATIC (on Mainnet) from Polygon to Ethereum
  async withdrawPOL(amount) {
    await this.checkWalletConnected();

    try {
      // Convert amount to wei
      const amountWei = parseEther(amount.toString());

      // Withdraw POL using MaticPOSClient
      const tx = await this.maticPOSClient.withdrawMatic(amountWei, {
        from: walletManager.getAddress('polygon'),
        gasLimit: 300000
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        amount: formatEther(amountWei),
        status: `${this.network === 'amoy' ? 'POL' : 'MATIC'} withdrawal initiated, waiting for checkpoint`
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `${this.network === 'amoy' ? 'POL' : 'MATIC'} withdrawal failed: ${error.message}`,
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
    await this.checkWalletConnected();

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
          from: walletManager.getAddress('polygon'),
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
        status: 'Withdrawal initiated, waiting for checkpoint'
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

  // Get ERC20 token balance
  async getERC20Balance(tokenAddress, address) {
    if (!address) {
      address = walletManager.getAddress('polygon');
    }

    try {
      const provider = this.childProvider;
      const abi = ['function balanceOf(address) view returns (uint256)'];
      const { Contract } = await import('ethers');
      const contract = new Contract(tokenAddress, abi, provider);
      const balance = await contract.balanceOf(address);
      return formatEther(balance);
    } catch (error) {
      console.error(`Error getting ERC20 balance: ${error.message}`);
      throw createTransactionError(
        ErrorCodes.TRANSACTION_FAILED,
        `Failed to get ERC20 balance: ${error.message}`,
        { context: 'PolygonBridge.getERC20Balance' }
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

  // Get parameters for depositing ETH from Ethereum to Polygon
  async getDepositETHParams(amount) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Convert amount to wei
      const amountWei = parseEther(amount);

      // Return transaction parameters
      return {
        from: walletManager.getAddress('ethereum'),
        value: amountWei.toString(),
        gasLimit: 300000, // Estimated gas limit
        network: 'ethereum'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.TRANSACTION_FAILED,
        `Failed to get deposit ETH parameters: ${error.message}`,
        { context: 'PolygonBridge.getDepositETHParams' }
      );
    }
  }

  // Get parameters for depositing ERC20 tokens from Ethereum to Polygon
  async getDepositERC20Params(tokenAddress, amount) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Convert amount to wei
      const amountWei = parseEther(amount);

      // Return transaction parameters
      return {
        from: walletManager.getAddress('ethereum'),
        tokenAddress: tokenAddress,
        amount: amountWei.toString(),
        gasLimit: 300000, // Estimated gas limit
        network: 'ethereum'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.TRANSACTION_FAILED,
        `Failed to get deposit ERC20 parameters: ${error.message}`,
        { context: 'PolygonBridge.getDepositERC20Params' }
      );
    }
  }

  // Get parameters for withdrawing POL from Polygon to Ethereum
  async getWithdrawPOLParams(amount) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Convert amount to wei
      const amountWei = parseEther(amount);

      // Return transaction parameters
      return {
        from: walletManager.getAddress('polygon'),
        amount: amountWei.toString(),
        gasLimit: 300000, // Estimated gas limit
        network: 'polygon'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.TRANSACTION_FAILED,
        `Failed to get withdraw POL parameters: ${error.message}`,
        { context: 'PolygonBridge.getWithdrawPOLParams' }
      );
    }
  }

  // Get parameters for withdrawing ERC20 tokens from Polygon to Ethereum
  async getWithdrawERC20Params(tokenAddress, amount) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Convert amount to wei
      const amountWei = parseEther(amount);

      // Return transaction parameters
      return {
        from: walletManager.getAddress('polygon'),
        tokenAddress: tokenAddress,
        amount: amountWei.toString(),
        gasLimit: 300000, // Estimated gas limit
        network: 'polygon'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.TRANSACTION_FAILED,
        `Failed to get withdraw ERC20 parameters: ${error.message}`,
        { context: 'PolygonBridge.getWithdrawERC20Params' }
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

// module.exports = { PolygonBridge }; // Remove CJS export
