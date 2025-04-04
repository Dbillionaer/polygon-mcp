// polygon-mcp.js - Main Polygon MCP Implementation
import {
  JsonRpcProvider,
  Contract,
  formatUnits,
  parseUnits,
  isAddress
} from 'ethers';
// Removed MaticPOSClient import as it's handled by bridge-operations.js
import { createRequire } from 'module'; // Import createRequire
const require = createRequire(import.meta.url); // Create a local require function

// Import MCP SDK modules directly using Node.js resolution
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { TransactionSimulator } from './transaction-simulation.js'; // Add .js extension
import { ContractTemplates } from './contract-templates.js'; // Add .js extension
import { PolygonBridge } from './bridge-operations.js'; // Add .js extension
import { ErrorCodes, createWalletError, createTransactionError } from './errors.js'; // Add .js extension
import { z } from 'zod';
import { defaultLogger } from './logger.js'; // Add .js extension
import walletManager from './common/wallet-manager.js'; // Default export, add .js extension
import { getConfig } from './common/config-manager.js'; // Add .js extension
import { resolveTokenAddress as commonResolveTokenAddress } from './common/utils.js'; // Add .js extension
import {
  validateAddress,
  validateAmount,
  // validateTokenSymbol // Not strictly needed if resolveTokenAddress handles it
  // validateTransactionHash // Add if needed later
} from './validation.js'; // Add .js extension
import {
  ERC20_ABI,
  ERC721_ABI,
  ERC1155_ABI
  // DEFAULT_TOKEN_ADDRESSES // Removed unused import
} from './common/constants.js'; // Add .js extension
import 'dotenv/config'; // Load .env file for direct execution
import { fileURLToPath } from 'url'; // Needed for direct execution check
import path from 'path'; // Needed for direct execution check

export class PolygonMCPServer { // Add export
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

    // Use the network name from config
    this.networkName = config.defaultNetwork;
    console.log('Current network setting:', this.networkName);

    // Set parent network name based on the child network
    if (this.networkName === 'amoy') {
      this.parentNetworkName = 'sepolia';
      console.log('Amoy testnet detected, will also register sepolia network');
      // Register sepolia provider
      walletManager.registerProvider('sepolia', new JsonRpcProvider(config.parentRpcUrl));
    } else {
      // For mainnet
      this.parentNetworkName = 'mainnet';
      console.log('Polygon mainnet detected, using Ethereum mainnet as parent');
    }

    console.log('Parent RPC URL:', config.parentRpcUrl);

    // Register providers with wallet manager
    walletManager.registerProvider('polygon', this.provider);
    walletManager.registerProvider('ethereum', this.parentProvider);

    // No need to initialize MaticPOSClient here - the bridge class handles its own client

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
        console.log('get-address tool called');

        // Check if wallet is connected
        const isConnected = walletManager.isWalletConnected('polygon');
        console.log('Wallet connected:', isConnected);

        if (!isConnected) {
          console.error('Wallet not connected when get-address was called');
          throw createWalletError(
            ErrorCodes.WALLET_NOT_CONNECTED,
            'Wallet not connected',
            { context: 'get-address tool' }
          );
        }

        // Get the address
        const address = walletManager.getAddress('polygon');
        console.log('Retrieved address:', address);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ address })
          }]
        };
      }
    );

    this.mcpServer.tool(
      'get-testnet-pol',
      {
        address: z.string().optional().describe('Address to receive testnet POL (defaults to wallet address)')
      },
      async ({ address }) => {
        const recipient = address || (walletManager.isWalletConnected('polygon') ? walletManager.getAddress('polygon') : null);

        if (!recipient) {
          throw createWalletError(
            ErrorCodes.WALLET_NOT_CONNECTED,
            'Wallet not connected and no address provided',
            { context: 'get-testnet-pol' }
          );
        }

        // Provide faucet instructions instead of attempting direct interaction
        const faucetUrl = 'https://faucet.polygon.technology/'; // Main faucet supports multiple testnets
        const networkInfo = this.networkName === 'mainnet' ? 'Mainnet (Faucet not applicable)' : `Polygon ${this.networkName.charAt(0).toUpperCase() + this.networkName.slice(1)} Testnet`;

        defaultLogger.info(`Providing faucet instructions for ${recipient} on ${networkInfo}`);

        if (this.networkName === 'mainnet') {
           return {
             content: [{
               type: 'text',
               text: JSON.stringify({
                 status: 'info',
                 message: 'Faucet is not applicable for Polygon Mainnet. Testnet POL is for testing networks like Amoy.'
               })
             }]
           };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'manual_action_required',
              message: `Please visit the Polygon Faucet to request testnet POL for the ${networkInfo}.`,
              faucetUrl: faucetUrl,
              recipientAddress: recipient,
              instructions: `Go to ${faucetUrl}, select the '${this.networkName}' network, paste the address '${recipient}', and complete the request process.`
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
        let checkAddress = address;
        if (!checkAddress) {
          this.checkWalletConnected(); // Ensure wallet is connected if address is omitted
          checkAddress = walletManager.getAddress('polygon');
        } else {
          // Validate the provided address if it exists
          checkAddress = validateAddress(checkAddress, 'address');
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

        // Validate inputs
        const validatedTo = validateAddress(to, 'to');
        const validatedAmount = validateAmount(amount, 'amount'); // Basic validation, decimals handled later

        let txHash;
        if (!token) {
          // Transfer native token (POL)
          const amountWei = parseUnits(validatedAmount, 18); // Use validated amount
          const wallet = walletManager.getWallet('polygon');
          const tx = await wallet.sendTransaction({
            to: validatedTo, // Use validated address
            value: amountWei,
            gasLimit: 21000 // Consider making gas limit dynamic or configurable
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
                to: validatedTo, // Use validated address
                amount: validatedAmount, // Use validated amount
                token: 'POL (native)'
              })
            }]
          };
        } else {
          // Transfer ERC20 token
          // resolveTokenAddress already handles basic validation (non-empty string)
          const tokenAddress = this.resolveTokenAddress(token);
          const tokenContract = this.createERC20(tokenAddress);
          const decimals = await tokenContract.decimals().catch(() => 18);
          const tokenSymbol = await tokenContract.symbol().catch(() => token);

          // Parse validated amount using correct decimals
          const amountInTokenUnits = parseUnits(validatedAmount, decimals);
          const wallet = walletManager.getWallet('polygon');
          const tokenContractWithSigner = tokenContract.connect(wallet);

          const tx = await tokenContractWithSigner.transfer(validatedTo, amountInTokenUnits); // Use validated address
          await tx.wait();
          txHash = tx.hash;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                txHash,
                from: walletManager.getAddress('polygon'),
                to: validatedTo, // Use validated address
                amount: validatedAmount, // Use validated amount
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
        // Validate inputs
        const validatedAmount = validateAmount(amount, 'amount');
        // Call the bridge class method
        const result = await this.bridge.depositETH(validatedAmount);
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
        // Validate inputs
        const validatedAmount = validateAmount(amount, 'amount');
        // Call the bridge class method
        // Note: withdrawETH might be named withdrawPOL or withdrawMATIC in bridge class
        const result = await this.bridge.withdrawPOL(validatedAmount); // Assuming withdrawPOL is the correct method name
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
        // Validate inputs
        // resolveTokenAddress handles basic validation
        const tokenAddress = this.resolveTokenAddress(token);
        const validatedAmount = validateAmount(amount, 'amount');
        // Call the bridge class method
        const result = await this.bridge.depositERC20(tokenAddress, validatedAmount);
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
        // Validate inputs
        // resolveTokenAddress handles basic validation
        const tokenAddress = this.resolveTokenAddress(token);
        const validatedAmount = validateAmount(amount, 'amount');
        // Call the bridge class method
        const result = await this.bridge.withdrawERC20(tokenAddress, validatedAmount);
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
        // Validate inputs
        const validatedAddress = validateAddress(address, 'address');
        // resolveTokenAddress handles basic validation
        const tokenAddress = this.resolveTokenAddress(token);

        const balance = await this.getTokenBalance(tokenAddress, validatedAddress); // Use validated address

        const tokenContract = this.createERC20(tokenAddress);
        const decimals = await tokenContract.decimals().catch(() => 18);
        const symbol = await tokenContract.symbol().catch(() => token);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              token: symbol,
              tokenAddress,
              address: validatedAddress, // Use validated address
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

    // NFT/ERC1155 tools
    this.mcpServer.tool(
      'get-nft-info',
      {
        address: z.string().describe('Address of the ERC721 contract')
      },
      async ({ address }) => {
        const result = await this.getNFTInfo(address);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
    );

    this.mcpServer.tool(
      'get-nft-token-info',
      {
        address: z.string().describe('Address of the ERC721 contract'),
        tokenId: z.string().describe('ID of the token') // Assuming tokenId is passed as string
      },
      async ({ address, tokenId }) => {
        // Convert tokenId to appropriate type if necessary (e.g., BigInt)
        // For now, assuming the helper function handles string input or ethers.js handles it.
        const result = await this.getNFTTokenInfo(address, tokenId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result)
          }]
        };
      }
    );

    this.mcpServer.tool(
      'get-nft-owner-tokens',
      {
        address: z.string().describe('Address of the ERC721 contract'),
        owner: z.string().describe('Address of the owner')
      },
      async ({ address, owner }) => {
        const balance = await this.getNFTOwnerTokens(address, owner);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ balance: balance.toString() }) // Convert BigInt to string
          }]
        };
      }
    );

    this.mcpServer.tool(
      'get-multi-token-uri',
      {
        address: z.string().describe('Address of the ERC1155 contract'),
        tokenId: z.string().describe('ID of the token')
      },
      async ({ address, tokenId }) => {
        const uri = await this.getMultiTokenURI(address, tokenId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ uri })
          }]
        };
      }
    );

    this.mcpServer.tool(
      'get-multi-token-balance',
      {
        address: z.string().describe('Address of the ERC1155 contract'),
        account: z.string().describe('Address of the account holding the tokens'),
        tokenId: z.string().describe('ID of the token')
      },
      async ({ address, account, tokenId }) => {
        const balance = await this.getMultiTokenBalance(address, account, tokenId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ balance: balance.toString() }) // Convert BigInt to string
          }]
        };
      }
    );

    this.mcpServer.tool(
      'get-multi-token-balances',
      {
        address: z.string().describe('Address of the ERC1155 contract'),
        account: z.string().describe('Address of the account holding the tokens'),
        tokenIds: z.array(z.string()).describe('Array of token IDs')
      },
      async ({ address, account, tokenIds }) => {
        const balances = await this.getMultiTokenBalances(address, account, tokenIds);
        // Convert BigInt balances to strings for JSON serialization
        const stringBalances = balances.map(b => b.toString());
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ balances: stringBalances })
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
  async connectWallet(privateKey) {
    console.log('Connecting wallet...');

    if (!privateKey) {
      console.error('No private key provided');
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        'Private key is required to connect wallet',
        { context: 'PolygonMCPServer.connectWallet' }
      );
    }

    try {
      // Determine which networks to connect to based on the current network
      const network = this.config.defaultNetwork || 'mainnet';
      console.log(`Current network setting: ${network}`);

      // For now, we always connect to ethereum and polygon since that's what the wallet manager uses
      // In the future, we could make this more dynamic based on the network
      const networksToConnect = ['polygon', 'ethereum'];

      // We might also want to connect to sepolia for Amoy testnet
      if (network === 'amoy') {
        console.log('Amoy testnet detected, will also register sepolia network');
        // Register sepolia provider if needed
        if (!walletManager.providers.has('sepolia')) {
          walletManager.registerProvider('sepolia', new JsonRpcProvider(this.config.parentRpcUrl));
        }
      }

      // Connect wallets to networks
      console.log(`Connecting wallets to networks: ${networksToConnect.join(', ')}`);
      const wallets = walletManager.connectToMultipleNetworks(privateKey, networksToConnect);
      console.log('Wallets connected:', Object.keys(wallets));

      // Connect wallet in bridge class - this is the only connection needed now
      // as other components use wallet manager directly
      console.log('Connecting wallet to bridge...');
      await this.bridge.connectWallet(privateKey);
      console.log('Wallet connected to bridge');

      // Verify wallet connection
      const isPolygonConnected = walletManager.isWalletConnected('polygon');
      const isEthereumConnected = walletManager.isWalletConnected('ethereum');
      console.log('Wallet connection status - Polygon:', isPolygonConnected, 'Ethereum:', isEthereumConnected);

      if (isPolygonConnected) {
        const address = walletManager.getAddressSafe('polygon');
        console.log('Connected wallet address:', address || 'Not available');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  }

  // Check if wallet is connected
  checkWalletConnected() {
    console.log('Checking wallet connection...');

    // Determine which networks to check based on the current network
    const network = this.config.defaultNetwork || 'mainnet';
    console.log(`Current network setting: ${network}`);

    // For now, we always check polygon since that's the primary network
    // In the future, we could make this more dynamic based on the network
    const isPolygonConnected = walletManager.isWalletConnected('polygon');
    const isEthereumConnected = walletManager.isWalletConnected('ethereum');
    console.log('Wallet connection status - Polygon:', isPolygonConnected, 'Ethereum:', isEthereumConnected);

    // Check additional networks for testnet
    if (network === 'amoy') {
      const isSepoliaConnected = walletManager.isWalletConnected('sepolia');
      console.log('Sepolia wallet connection status:', isSepoliaConnected);
    }

    // We always require polygon wallet to be connected
    if (!isPolygonConnected) {
      console.error('Polygon wallet not connected');
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        'Wallet not connected',
        { context: 'PolygonMCPServer' }
      );
    }

    const address = walletManager.getAddressSafe('polygon');
    console.log('Connected wallet address:', address || 'Not available');

    return true;
  }

  // Use the centralized resolveTokenAddress function
  resolveTokenAddress(token) {
    // Pass the tokenAddresses map from this instance's config
    return commonResolveTokenAddress(token, this.tokenAddresses);
  }

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

// module.exports = { PolygonMCPServer }; // Remove CJS export

// Only run if this file is executed directly using ESM check
const currentFilePath = fileURLToPath(import.meta.url);
const entryPointPath = path.resolve(process.argv[1]);

if (currentFilePath === entryPointPath) {
  // dotenv is loaded via import 'dotenv/config' above

  // Self-executing async function to allow await in the top level
  (async () => {
    try {
      // Start server (constructor now uses getConfig internally)
      const server = new PolygonMCPServer();

      // Connect wallet if private key provided
      if (process.env.PRIVATE_KEY) { // Still need process.env for the key itself
        try {
          await server.connectWallet(process.env.PRIVATE_KEY);
          console.log('Wallet connected successfully');
        } catch (error) {
          console.error(`Error connecting wallet during startup: ${error.message}`);
          // Decide if server should still start or exit
          // process.exit(1);
        }
      } else {
        console.warn('PRIVATE_KEY not found in environment variables. Server starting without a connected wallet.');
      }

      await server.start();
      console.log('MCP server started successfully');
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  })();
}
