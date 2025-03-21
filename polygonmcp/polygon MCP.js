// polygon MCP.js - Main Polygon MCP Implementation
const { 
  JsonRpcProvider, 
  Wallet, 
  Contract, 
  Interface,
  formatUnits,
  parseUnits,
  isAddress
} = require('ethers');
const { MaticPOSClient } = require('@maticnetwork/maticjs');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { TransactionSimulator } = require('./transaction-simulation');
const { ContractTemplates } = require('./contract-templates');
const { ErrorCodes, createWalletError, createTransactionError } = require('./errors');
const { z } = require('zod');

// Standard ERC20 ABI
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// Standard ERC721 ABI
const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)"
];

// Standard ERC1155 ABI
const ERC1155_ABI = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] memory accounts, uint256[] memory ids) view returns (uint256[] memory)",
  "function uri(uint256 id) view returns (string)",
  "function isApprovedForAll(address account, address operator) view returns (bool)"
];

// Standard token addresses for Polygon network
const DEFAULT_TOKEN_ADDRESSES = {
  'WMATIC': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
};

class PolygonMCPServer {
  constructor(config) {
    this.rpcUrl = config.rpcUrl;
    this.explorerApiKey = config.explorerApiKey;
    this.tokenAddresses = config.tokenAddresses || DEFAULT_TOKEN_ADDRESSES;
    
    // Initialize MCP Server
    this.mcpServer = new McpServer({
      name: "polygon-mcp-server",
      version: "1.0.0"
    });
    
    // Initialize providers
    this.provider = new JsonRpcProvider(this.rpcUrl);
    this.parentProvider = new JsonRpcProvider(config.parentRpcUrl);
    
    // Initialize MaticPOSClient for bridge operations
    this.maticClient = new MaticPOSClient({
      network: 'mainnet', // or 'testnet' based on your needs
      version: 'v1',
      maticProvider: this.provider,
      parentProvider: this.parentProvider,
      posRootChainManager: config.posRootChainManager,
      parentDefaultOptions: { confirmations: 2, from: config.rootChainAddress },
      maticDefaultOptions: { confirmations: 2, from: config.childChainAddress }
    });
    
    // Initialize transaction simulator
    this.simulator = new TransactionSimulator({
      rpcUrl: this.rpcUrl,
      explorerApiKey: this.explorerApiKey,
      tokenAddresses: this.tokenAddresses
    });
    
    // Initialize contract templates
    this.contractTemplates = new ContractTemplates({
      rpcUrl: this.rpcUrl,
      explorerApiKey: this.explorerApiKey
    });

    // Register MCP tools
    this.registerMCPTools();
  }

  // Register MCP tools
  registerMCPTools() {
    // Register bridge operations as tools
    this.mcpServer.tool(
      "deposit-eth",
      {
        amount: z.string().describe("Amount of ETH to deposit")
      },
      async ({ amount }) => {
        const result = await this.depositETH(amount);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      }
    );

    this.mcpServer.tool(
      "withdraw-eth",
      {
        amount: z.string().describe("Amount of ETH to withdraw")
      },
      async ({ amount }) => {
        const result = await this.withdrawETH(amount);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }]
        };
      }
    );

    // Register token operations as tools
    this.mcpServer.tool(
      "get-token-balance",
      {
        token: z.string().describe("Token symbol or address"),
        address: z.string().describe("Address to check balance for")
      },
      async ({ token, address }) => {
        const balance = await this.getTokenBalance(token, address);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(balance)
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
  
  // Connect wallet for operations
  connectWallet(privateKey) {
    if (!privateKey) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        "Private key is required to connect wallet",
        { context: "PolygonMCPServer.connectWallet" }
      );
    }
    this.wallet = new Wallet(privateKey, this.provider);
    this.simulator.connectWallet(privateKey);
  }
  
  // Check if wallet is connected
  checkWalletConnected() {
    if (!this.wallet) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        "Wallet not connected",
        { context: "PolygonMCPServer" }
      );
    }
    return true;
  }
  
  // Helper to resolve token address from symbol or address
  resolveTokenAddress(token) {
    if (isAddress(token)) {
      return token;
    }
    
    const upperToken = token.toUpperCase();
    if (this.tokenAddresses[upperToken]) {
      return this.tokenAddresses[upperToken];
    }
    
    throw createTransactionError(
      ErrorCodes.INVALID_ADDRESS,
      `Unknown token: ${token}`,
      { token }
    );
  }
  
  // Bridge operations
  async depositETH(amount) {
    this.checkWalletConnected();
    
    try {
      const tx = await this.maticClient.depositEther(amount, {
        from: this.wallet.address,
        gasLimit: 500000
      });
      
      return {
        txHash: tx.transactionHash,
        status: 'pending'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `Deposit failed: ${error.message}`,
        { amount }
      );
    }
  }
  
  async withdrawETH(amount) {
    this.checkWalletConnected();
    
    try {
      const tx = await this.maticClient.withdrawEther(amount, {
        from: this.wallet.address,
        gasLimit: 500000
      });
      
      return {
        txHash: tx.transactionHash,
        status: 'pending'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `Withdrawal failed: ${error.message}`,
        { amount }
      );
    }
  }
  
  async depositToken(token, amount) {
    this.checkWalletConnected();
    
    try {
      const tokenAddress = this.resolveTokenAddress(token);
      const tx = await this.maticClient.depositERC20ForUser(
        tokenAddress,
        this.wallet.address,
        amount,
        {
          from: this.wallet.address,
          gasLimit: 500000
        }
      );
      
      return {
        txHash: tx.transactionHash,
        status: 'pending'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `Token deposit failed: ${error.message}`,
        { token, amount }
      );
    }
  }
  
  async withdrawToken(token, amount) {
    this.checkWalletConnected();
    
    try {
      const tokenAddress = this.resolveTokenAddress(token);
      const tx = await this.maticClient.withdrawERC20(
        tokenAddress,
        amount,
        {
          from: this.wallet.address,
          gasLimit: 500000
        }
      );
      
      return {
        txHash: tx.transactionHash,
        status: 'pending'
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.BRIDGE_ERROR,
        `Token withdrawal failed: ${error.message}`,
        { token, amount }
      );
    }
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
          "Token ID is required",
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
          "Token ID is required",
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
          "Token IDs must be a non-empty array",
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
