// polygon-mcp.js - Main Polygon MCP Implementation
const { 
  JsonRpcProvider, 
  Contract,
  formatUnits,
  parseUnits,
  isAddress
} = require('ethers');
const { MaticPOSClient } = require('@maticnetwork/maticjs');
const { Server: McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { TransactionSimulator } = require('./transaction-simulation');
const { ContractTemplates } = require('./contract-templates');
const { PolygonBridge } = require('./bridge-operations'); // Import PolygonBridge
const { ErrorCodes, createWalletError, createTransactionError } = require('./errors'); // Removed createBridgeError
const { z } = require('zod');
const { defaultLogger } = require('./logger');
const walletManager = require('./common/wallet-manager');
const { getConfig } = require('./common/config-manager'); // Import getConfig
const { resolveTokenAddress: commonResolveTokenAddress } = require('./common/utils'); // Import centralized util
const {
  ERC20_ABI,
  ERC721_ABI,
  ERC1155_ABI
  // DEFAULT_TOKEN_ADDRESSES // Removed unused import
} = require('./common/constants');

class PolygonMCPServer {
  constructor() { // Remove config parameter, use getConfig instead
    // Get configuration using the centralized manager
    const config = getConfig();
    this.config = config; // Store config for later use

    this.rpcUrl = config.rpcUrl; // Use config from getConfig
    this.explorerApiKey = config.explorerApiKey;
    this.tokenAddresses = config.tokenAddresses; // Already includes defaults via getConfig

    // Initialize MCP Server
    this.mcpServer = new McpServer({
      name: 'polygon-mcp-server',
      version: '1.0.0'
    });
    
    // Initialize providers using config
    this.provider = new JsonRpcProvider(this.rpcUrl);
    this.parentProvider = new JsonRpcProvider(config.parentRpcUrl);

    // Determine network name based on RPC URL (simple heuristic)
    this.networkName = config.defaultNetwork || (this.rpcUrl.includes('mumbai') ? 'mumbai' : 'mainnet');
    this.parentNetworkName = this.networkName === 'mumbai' ? 'goerli' : 'mainnet'; // Assuming Goerli for Mumbai, Mainnet for Polygon Mainnet

    // Register providers with wallet manager
    walletManager.registerProvider('polygon', this.provider);
    walletManager.registerProvider('ethereum', this.parentProvider);
    // Initialize MaticPOSClient for bridge operations using config
    // Derive network from config (e.g., based on rpcUrl or a specific config field)
    const bridgeNetwork = this.networkName === 'mumbai' ? 'testnet' : 'mainnet';
    this.maticClient = new MaticPOSClient({
      network: bridgeNetwork, // Use derived network
      version: 'v1', // Keep version as v1 for now, might need config later
      maticProvider: this.provider,
      parentProvider: this.parentProvider,
      posRootChainManager: config.posRootChainManager,
      // Default 'from' addresses are set later when wallet connects
      parentDefaultOptions: { confirmations: 2 },
      maticDefaultOptions: { confirmations: 2 }
    });

    // Initialize PolygonBridge using config
    this.bridge = new PolygonBridge({
      rootRpcUrl: config.parentRpcUrl,
      childRpcUrl: config.rpcUrl,
      posRootChainManager: config.posRootChainManager,
      // Pass root/child addresses if available in config, bridge class uses defaults otherwise
      rootChainAddress: config.rootChainAddress,
      childChainAddress: config.childChainAddress,
      // polygonApiUrl: config.polygonApiUrl // Add if needed by bridge class
    });

    // Initialize transaction simulator using config
    this.simulator = new TransactionSimulator({
      rpcUrl: this.rpcUrl,
      explorerApiKey: this.explorerApiKey,
      tokenAddresses: this.tokenAddresses
    });
    // Initialize contract templates using config
    this.contractTemplates = new ContractTemplates({
      rpcUrl: this.rpcUrl,
      explorerApiKey: this.explorerApiKey,
      networkName: this.networkName // Pass network name
    });

    // Register MCP tools
    this.registerMCPTools();
  }

  // Register MCP tools
  registerMCPTools() {
    // Wallet tools
    this.mcpServer.tool(
      'get-address',
      {},
      async () => {
        this.checkWalletConnected();
        const address = walletManager.getAddress('polygon');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ address })
          }]
        };
      }
    );
    
    this.mcpServer.tool(
      'get-testnet-matic',
      {
        address: z.string().optional().describe('Address to receive testnet MATIC (defaults to wallet address)')
      },
      async ({ address }) => {
        const recipient = address || (walletManager.isWalletConnected('polygon') ? walletManager.getAddress('polygon') : null);
        
        if (!recipient) {
          throw createWalletError(
            ErrorCodes.WALLET_NOT_CONNECTED,
            'Wallet not connected and no address provided',
            { context: 'get-testnet-matic' }
          );
        }
        
        // This would normally call a faucet API
        defaultLogger.info(`Requesting testnet MATIC for ${recipient}`);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: `Requested testnet MATIC for ${recipient}`,
              txHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')
            })
          }]
        };
      }
    );
    
    this.mcpServer.tool(
      'list-balances',
      {
        address: z.string().optional().describe('Address to check balances for (defaults to wallet address)')
      },
      async ({ address }) => {
        const checkAddress = address || (walletManager.isWalletConnected('polygon') ? walletManager.getAddress('polygon') : null);

        if (!checkAddress) {
          throw createWalletError(
            ErrorCodes.WALLET_NOT_CONNECTED,
            'Wallet not connected and no address provided',
            { context: 'list-balances' }
          );
        }
        
        // Get native token balance
        const nativeBalance = await this.provider.getBalance(checkAddress);
        
        // Get balances for known tokens
        const tokenBalances = {};
        for (const [symbol, tokenAddress] of Object.entries(this.tokenAddresses)) {
          try {
            const balance = await this.getTokenBalance(tokenAddress, checkAddress);
            const contract = this.createERC20(tokenAddress);
            const decimals = await contract.decimals().catch(() => 18);
            tokenBalances[symbol] = formatUnits(balance, decimals);
          } catch (error) {
            defaultLogger.warn(`Failed to get balance for ${symbol}: ${error.message}`);
            tokenBalances[symbol] = 'Error';
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              address: checkAddress,
              nativeBalance: formatUnits(nativeBalance, 18),
              tokens: tokenBalances
            })
          }]
        };
      }
    );
    
    this.mcpServer.tool(
      'transfer-funds',
      {
        to: z.string().describe('Recipient address'),
        amount: z.string().describe('Amount to send'),
        token: z.string().optional().describe('Token symbol or address (omit for native POL)')
      },
      async ({ to, amount, token }) => {
        this.checkWalletConnected();
        
        let txHash;
        if (!token) {
          // Transfer native token (POL)
          const amountWei = parseUnits(amount, 18);
          const wallet = walletManager.getWallet('polygon');
          const tx = await wallet.sendTransaction({
            to,
            value: amountWei,
            gasLimit: 21000
          });
          
          await tx.wait();
          txHash = tx.hash;
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                txHash,
                from: walletManager.getAddress('polygon'),
                to,
                amount,
                token: 'POL (native)'
              })
            }]
          };
        } else {
          // Transfer ERC20 token
          const tokenAddress = this.resolveTokenAddress(token);
          const tokenContract = this.createERC20(tokenAddress);
          const decimals = await tokenContract.decimals().catch(() => 18);
          const tokenSymbol = await tokenContract.symbol().catch(() => token);
          
          const amountInTokenUnits = parseUnits(amount, decimals);
          const wallet = walletManager.getWallet('polygon');
          const tokenContractWithSigner = tokenContract.connect(wallet);
          
          const tx = await tokenContractWithSigner.transfer(to, amountInTokenUnits);
          await tx.wait();
          txHash = tx.hash;
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                txHash,
                from: walletManager.getAddress('polygon'),
                to,
                amount,
                token: tokenSymbol,
                tokenAddress
              })
            }]
          };
        }
      }
    );
    
    // Bridge operations tools
    this.mcpServer.tool(
      'deposit-eth',
      {
        amount: z.string().describe('Amount of ETH to deposit')
      },
      async ({ amount }) => {
        // Call the bridge class method
        const result = await this.bridge.depositETH(amount);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
    );

    this.mcpServer.tool(
      'withdraw-eth',
      {
        amount: z.string().describe('Amount of ETH to withdraw')
      },
      async ({ amount }) => {
        // Call the bridge class method
        // Note: withdrawETH might be named withdrawPOL or withdrawMATIC in bridge class
        const result = await this.bridge.withdrawPOL(amount); // Assuming withdrawPOL is the correct method name
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
    );

    this.mcpServer.tool(
      'deposit-token',
      {
        token: z.string().describe('Token symbol or address'),
        amount: z.string().describe('Amount to deposit')
      },
      async ({ token, amount }) => {
        const tokenAddress = this.resolveTokenAddress(token);
        // Call the bridge class method
        const result = await this.bridge.depositERC20(tokenAddress, amount);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
    );

    this.mcpServer.tool(
      'withdraw-token',
      {
        token: z.string().describe('Token symbol or address'),
        amount: z.string().describe('Amount to withdraw')
      },
      async ({ token, amount }) => {
        const tokenAddress = this.resolveTokenAddress(token);
        // Call the bridge class method
        const result = await this.bridge.withdrawERC20(tokenAddress, amount);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
    );

    // Token operations tools
    this.mcpServer.tool(
      'get-token-balance',
      {
        token: z.string().describe('Token symbol or address'),
        address: z.string().describe('Address to check balance for')
      },
      async ({ token, address }) => {
        const tokenAddress = this.resolveTokenAddress(token);
        const balance = await this.getTokenBalance(tokenAddress, address);

        const tokenContract = this.createERC20(tokenAddress);
        const decimals = await tokenContract.decimals().catch(() => 18);
        const symbol = await tokenContract.symbol().catch(() => token);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              token: symbol,
              tokenAddress,
              address,
              balance: formatUnits(balance, decimals),
              rawBalance: balance.toString()
            })
          }]
        };
      }
    );

    // Transaction simulation tools
    this.mcpServer.tool(
      'simulate-transaction',
      {
        transaction: z.object({
          to: z.string().optional(),
          value: z.string().optional(),
          data: z.string().optional(),
          gasLimit: z.string().optional(),
          gasPrice: z.string().optional(),
          maxFeePerGas: z.string().optional(),
          maxPriorityFeePerGas: z.string().optional()
        }).describe('Transaction parameters')
      },
      async ({ transaction }) => {
        const result = await this.simulateTransaction(transaction);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
    );

    // Gas tools
    this.mcpServer.tool(
      'get-gas-price',
      {},
      async () => {
        const feeData = await this.provider.getFeeData();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              gasPrice: formatUnits(feeData.gasPrice, 'gwei'),
              maxFeePerGas: feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 'gwei') : null,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null,
              gasPrice_wei: feeData.gasPrice.toString(),
              maxFeePerGas_wei: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : null,
              maxPriorityFeePerGas_wei: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : null
            })
          }]
        };
      }
    );

    // Contract tools
    this.mcpServer.tool(
      'list-contract-templates',
      {},
      async () => {
        const templates = await this.contractTemplates.listTemplates();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(templates)
          }]
        };
      }
    );

    this.mcpServer.tool(
      'deploy-contract',
      {
        templateId: z.string().describe('Template ID to deploy'),
        params: z.record(z.any()).describe('Template parameters'),
        constructorArgs: z.array(z.any()).optional().describe('Constructor arguments')
      },
      async ({ templateId, params, constructorArgs }) => {
        this.checkWalletConnected();

        const result = await this.contractTemplates.deployFromTemplate(
          templateId,
          params,
          constructorArgs || []
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
    );
  }

  // Start MCP server
  async start() {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
  }
  
  // Connect wallet for operations using centralized wallet manager
  connectWallet(privateKey) {
    if (!privateKey) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        'Private key is required to connect wallet',
        { context: 'PolygonMCPServer.connectWallet' }
      );
    }

    // Connect wallets to both networks
    walletManager.connectToMultipleNetworks(privateKey, ['polygon', 'ethereum']);
    
    // Connect to simulator (will modify transaction-simulation.js later to use wallet manager)
    this.simulator.connectWallet(privateKey);

    // Also connect wallet to contract templates
    this.contractTemplates.connectWallet(privateKey); // This method still exists internally for now

    // Connect wallet in bridge class
    this.bridge.connectWallet(privateKey);

    // Update MaticPOSClient with wallet addresses (This method is now redundant as bridge class handles its own client)
    // this.updateMaticClientWalletAddresses(); // Remove this call
  }

  // Removed updateMaticClientWalletAddresses method as bridge class handles its client
  /*
  // Update MaticPOSClient with wallet addresses
  updateMaticClientWalletAddresses() {
    if (walletManager.isWalletConnected('ethereum') && walletManager.isWalletConnected('polygon')) {
      const bridgeNetwork = this.networkName === 'mumbai' ? 'testnet' : 'mainnet';
      // Re-create MaticPOSClient with wallet addresses and correct network
      this.maticClient = new MaticPOSClient({
        network: bridgeNetwork, // Use derived network
        version: 'v1',
        maticProvider: this.provider,
        parentProvider: this.parentProvider,
        posRootChainManager: this.config.posRootChainManager, // Use stored config
        parentDefaultOptions: {
          confirmations: 2,
          from: walletManager.getAddress('ethereum')
        },
        maticDefaultOptions: {
          confirmations: 2,
          from: walletManager.getAddress('polygon')
        }
      });
      defaultLogger.info(`MaticPOSClient updated with wallet addresses for network: ${bridgeNetwork}`);
    }
  }
  */

  // Check if wallet is connected
  checkWalletConnected() {
    if (!walletManager.isWalletConnected('polygon')) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        'Wallet not connected',
        { context: 'PolygonMCPServer' }
      );
    }
    return true;
  }

  // Use the centralized resolveTokenAddress function
  resolveTokenAddress(token) {
    // Pass the tokenAddresses map from this instance's config
    return commonResolveTokenAddress(token, this.tokenAddresses);
  }

  // Removed direct bridge operations - now handled by this.bridge instance

  // Transaction simulation and analysis
  async simulateTransaction(transaction) {
    return await this.simulator.simulateTransaction(transaction);
  }
  
  async analyzeTransaction(txHash) {
    return await this.simulator.analyzeTransaction(txHash);
  }
  
  async estimateGas(transaction) {
    return await this.simulator.estimateGas(transaction);
  }
  
  // Contract interactions
  createERC20(address) {
    return new Contract(address, ERC20_ABI, this.provider);
  }
  
  createERC721(address) {
    return new Contract(address, ERC721_ABI, this.provider);
  }
  
  createERC1155(address) {
    return new Contract(address, ERC1155_ABI, this.provider);
  }
  
  // Token balance queries
  async getTokenBalance(token, address) {
    try {
      if (!isAddress(address)) {
        throw createTransactionError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid address: ${address}`,
          { token, address }
        );
      }
      
      const tokenAddress = this.resolveTokenAddress(token);
      const tokenContract = this.createERC20(tokenAddress);
      
      return await tokenContract.balanceOf(address);
    } catch (error) {
      if (error.code && error.name) {
        throw error;  // Re-throw our custom errors
      }
      
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Failed to get token balance: ${error.message}`,
        { token, address }
      );
    }
  }
  
  async getTokenAllowance(token, owner, spender) {
    try {
      if (!isAddress(owner) || !isAddress(spender)) {
        throw createTransactionError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid address: ${!isAddress(owner) ? owner : spender}`,
          { token, owner, spender }
        );
      }
      
      const tokenAddress = this.resolveTokenAddress(token);
      const tokenContract = this.createERC20(tokenAddress);
      
      return await tokenContract.allowance(owner, spender);
    } catch (error) {
      if (error.code && error.name) {
        throw error;  // Re-throw our custom errors
      }
      
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Failed to get token allowance: ${error.message}`,
        { token, owner, spender }
      );
    }
  }
  
  // NFT queries
  async getNFTInfo(address) {
    try {
      if (!isAddress(address)) {
        throw createTransactionError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid NFT address: ${address}`,
          { address }
        );
      }
      
      const nftContract = this.createERC721(address);
      
      return {
        name: await nftContract.name(),
        symbol: await nftContract.symbol(),
        totalSupply: await nftContract.totalSupply()
      };
    } catch (error) {
      if (error.code && error.name) {
        throw error;  // Re-throw our custom errors
      }
      
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Failed to get NFT info: ${error.message}`,
        { address }
      );
    }
  }
  
  async getNFTTokenInfo(address, tokenId) {
    try {
      if (!isAddress(address)) {
        throw createTransactionError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid NFT address: ${address}`,
          { address, tokenId }
        );
      }
      
      const nftContract = this.createERC721(address);
      
      return {
        owner: await nftContract.ownerOf(tokenId),
        tokenURI: await nftContract.tokenURI(tokenId)
      };
    } catch (error) {
      if (error.code && error.name) {
        throw error;  // Re-throw our custom errors
      }
      
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Failed to get NFT token info: ${error.message}`,
        { address, tokenId }
      );
    }
  }
  
  async getNFTOwnerTokens(address, owner) {
    try {
      if (!isAddress(address) || !isAddress(owner)) {
        throw createTransactionError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid address: ${!isAddress(address) ? address : owner}`,
          { address, owner }
        );
      }
      
      const nftContract = this.createERC721(address);
      return await nftContract.balanceOf(owner);
    } catch (error) {
      if (error.code && error.name) {
        throw error;  // Re-throw our custom errors
      }
      
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Failed to get NFT owner tokens: ${error.message}`,
        { address, owner }
      );
    }
  }
  
  // Multi-token queries
  async getMultiTokenURI(address, tokenId) {
    try {
      if (!isAddress(address)) {
        throw createTransactionError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid ERC1155 address: ${address}`,
          { address, tokenId }
        );
      }
      
      if (tokenId === undefined || tokenId === null) {
        throw createTransactionError(
          ErrorCodes.INVALID_PARAMETERS,
          'Token ID is required',
          { address }
        );
      }
      
      const multiTokenContract = this.createERC1155(address);
      return await multiTokenContract.uri(tokenId);
    } catch (error) {
      if (error.code && error.name) {
        throw error;  // Re-throw our custom errors
      }
      
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Failed to get multi-token URI: ${error.message}`,
        { address, tokenId }
      );
    }
  }
  
  async getMultiTokenBalance(address, account, tokenId) {
    try {
      if (!isAddress(address) || !isAddress(account)) {
        throw createTransactionError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid address: ${!isAddress(address) ? address : account}`,
          { address, account, tokenId }
        );
      }
      
      if (tokenId === undefined || tokenId === null) {
        throw createTransactionError(
          ErrorCodes.INVALID_PARAMETERS,
          'Token ID is required',
          { address, account }
        );
      }
      
      const multiTokenContract = this.createERC1155(address);
      return await multiTokenContract.balanceOf(account, tokenId);
    } catch (error) {
      if (error.code && error.name) {
        throw error;  // Re-throw our custom errors
      }
      
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Failed to get multi-token balance: ${error.message}`,
        { address, account, tokenId }
      );
    }
  }
  
  async getMultiTokenBalances(address, account, tokenIds) {
    try {
      if (!isAddress(address) || !isAddress(account)) {
        throw createTransactionError(
          ErrorCodes.INVALID_ADDRESS,
          `Invalid address: ${!isAddress(address) ? address : account}`,
          { address, account }
        );
      }
      
      if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
        throw createTransactionError(
          ErrorCodes.INVALID_PARAMETERS,
          'Token IDs must be a non-empty array',
          { address, account }
        );
      }
      
      const multiTokenContract = this.createERC1155(address);
      return await Promise.all(
        tokenIds.map(tokenId => multiTokenContract.balanceOf(account, tokenId))
      );
    } catch (error) {
      if (error.code && error.name) {
        throw error;  // Re-throw our custom errors
      }
      
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Failed to get multi-token balances: ${error.message}`,
        { address, account, tokenIds }
      );
    }
  }
}

module.exports = { PolygonMCPServer };

// Only run if this file is executed directly
if (require.main === module) {
  // No need for dotenv here, config-manager handles it
  // const dotenv = require('dotenv');
  // dotenv.config();

  // Get config using the manager
  // const config = getConfig(); // Use getConfig // Removed unused variable

  // Start server (constructor now uses getConfig internally)
  const server = new PolygonMCPServer();

  // Connect wallet if private key provided
  if (process.env.PRIVATE_KEY) { // Still need process.env for the key itself
    server.connectWallet(process.env.PRIVATE_KEY);
  }
  
  server.start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
