// polygon MCP.js - Main MCP Server Implementation
// Import specific modules from ethers v6
const { 
  JsonRpcProvider, 
  Wallet, 
  HDNodeWallet, 
  Contract, 
  Interface,
  isAddress,
  formatUnits,
  formatEther,
  parseUnits,
  parseEther
} = require('ethers');
const dotenv = require('dotenv');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { PolygonBridge } = require('./bridge-operations');
const { ContractTemplates } = require('./contract-templates');
const { DeFiProtocols } = require('./defi-interactions');
const { TransactionSimulator } = require('./transaction-simulation');
const { defaultLogger } = require('./logger');
const { 
  ErrorCodes, 
  createWalletError, 
  createNetworkError, 
  createTransactionError,
  createContractError,
  createBridgeError,
  createDeFiError,
  createSimulationError
} = require('./errors');
const {
  validateAddress,
  validateAmount,
  validateTokenSymbol,
  validateNetwork,
  validateTransactionHash,
  validatePercentage,
  validateRequiredParams
} = require('./validation');

// Load environment variables
dotenv.config();

// Initialize logger
const logger = defaultLogger;
logger.info('Initializing Polygon MCP Server');

// SECURITY WARNING: This server handles private keys and sensitive blockchain operations.
// In a production environment:
// 1. Never store private keys or seed phrases in code or environment variables
// 2. Use a secure key management system or hardware wallet integration
// 3. Implement proper authentication and authorization
// 4. Add rate limiting to prevent abuse
// 5. Add comprehensive logging and monitoring

// Define RPC endpoints with fallbacks
const RPC_ENDPOINTS = {
  mainnet: process.env.POLYGON_MAINNET_RPC || 'https://polygon-rpc.com',
  mumbai: process.env.POLYGON_MUMBAI_RPC || 'https://rpc-mumbai.maticvigil.com'
};

// Common token addresses
const TOKEN_ADDRESSES = {
  'POL': '0x0000000000000000000000000000000000001010', // Native POL (formerly MATIC)
  'MATIC': '0x0000000000000000000000000000000000001010', // Legacy name for backward compatibility
  'WPOL': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Wrapped POL (mainnet)
  'WMATIC': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Legacy name for backward compatibility
  'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // Wrapped ETH (mainnet)
  'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC (mainnet)
  'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT (mainnet)
  'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI (mainnet)
  // Mumbai testnet addresses
  'TEST_POL': '0x0000000000000000000000000000000000001010', // Native POL on Mumbai
  'TEST_MATIC': '0x0000000000000000000000000000000000001010', // Legacy name for backward compatibility
  'TEST_WPOL': '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889', // Wrapped POL on Mumbai
  'TEST_WMATIC': '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889', // Legacy name for backward compatibility
  'TEST_USDC': '0xe11A86849d99F524cAC3E7A0Ec1241828e332C62'  // USDC on Mumbai
};

// Protocol-specific addresses
const PROTOCOL_ADDRESSES = {
  mainnet: {
    quickswapRouter: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    aaveLendingPool: '0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf',
    posRootChainManager: '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77' // On Ethereum
  },
  mumbai: {
    quickswapRouter: '0x8954AfA98594b838bda56FE4C12a09D7739D179b',
    posRootChainManager: '0xBbD7CbFA79faee899Eaf900F13C9065bF03B1A74' // On Goerli
  }
};

// MCP Server class with proper MCP protocol integration
class PolygonMCPServer {
  constructor() {
    this.currentNetwork = process.env.DEFAULT_NETWORK || 'mumbai';
    this.walletConnected = false;
    
    // Initialize providers - updated for ethers v6
    this.providers = {
      mainnet: new JsonRpcProvider(RPC_ENDPOINTS.mainnet),
      mumbai: new JsonRpcProvider(RPC_ENDPOINTS.mumbai)
    };
    
    // Create HDWallet from seed phrase - updated for ethers v6
    if (process.env.SEED_PHRASE) {
      // HDNodeWallet.fromMnemonic returns a wallet directly in v6
      this.hdWallet = HDNodeWallet.fromPhrase(process.env.SEED_PHRASE);
      this.walletIndex = 0;
      
      // Derive default wallet
      this.connectWallet(0);
    }
    
    // Initialize protocol handlers
    this.initializeProtocolHandlers();
    
    // Register available tools
    this.registerTools();
    
    console.log(`Polygon MCP Server initialized on ${this.currentNetwork} network`);
  }
  
  // Initialize protocol handlers
  initializeProtocolHandlers() {
    // Bridge operations
    this.bridgeConfig = {
      rootRpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
      childRpcUrl: RPC_ENDPOINTS[this.currentNetwork],
      posRootChainManager: PROTOCOL_ADDRESSES[this.currentNetwork === 'mainnet' ? 'mainnet' : 'mumbai'].posRootChainManager,
      polygonApiUrl: 'https://apis.matic.network'
    };
    this.bridge = new PolygonBridge(this.bridgeConfig);
    
    // Contract templates
    this.templateConfig = {
      rpcUrl: RPC_ENDPOINTS[this.currentNetwork],
      explorerApiKey: process.env.POLYGONSCAN_API_KEY
    };
    this.contractTemplates = new ContractTemplates(this.templateConfig);
    
    // DeFi operations
    this.defiConfig = {
      rpcUrl: RPC_ENDPOINTS[this.currentNetwork],
      quickswapRouter: PROTOCOL_ADDRESSES[this.currentNetwork].quickswapRouter,
      aaveLendingPool: PROTOCOL_ADDRESSES[this.currentNetwork].aaveLendingPool,
      tokenAddresses: TOKEN_ADDRESSES
    };
    this.defi = new DeFiProtocols(this.defiConfig);
    
    // Transaction simulator
    this.simulatorConfig = {
      rpcUrl: RPC_ENDPOINTS[this.currentNetwork],
      explorerApiKey: process.env.POLYGONSCAN_API_KEY,
      tokenAddresses: TOKEN_ADDRESSES
    };
    this.simulator = new TransactionSimulator(this.simulatorConfig);
  }
  
  // Connect wallet for operations - updated for ethers v6
  connectWallet(index = 0) {
    try {
      if (!this.hdWallet) {
        throw createWalletError(
          ErrorCodes.WALLET_NOT_CONNECTED,
          "No seed phrase provided. Cannot connect wallet."
        );
      }
      
      // Derive wallet from HD path - in v6, we derive directly from the HDNodeWallet
      const path = `m/44'/60'/0'/0/${index}`;
      // In v6, we can derive directly from the HDNodeWallet
      const derivedWallet = this.hdWallet.derivePath(path);
      
      // Connect wallet to providers - updated for v6
      this.wallets = {
        mainnet: derivedWallet.connect(this.providers.mainnet),
        mumbai: derivedWallet.connect(this.providers.mumbai)
      };
      
      // Set current wallet
      this.wallet = this.wallets[this.currentNetwork];
      this.walletIndex = index;
      this.walletConnected = true;
      
      // Connect wallet to protocols
      if (this.defi) this.defi.connectWallet(derivedWallet.privateKey);
      if (this.contractTemplates) this.contractTemplates.connectWallet(derivedWallet.privateKey);
      if (this.simulator) this.simulator.connectWallet(derivedWallet.privateKey);
      if (this.bridge) this.bridge.connectWallet(derivedWallet.privateKey);
      
      logger.info('Wallet connected successfully', { 
        address: this.wallet.address,
        network: this.currentNetwork,
        index
      });
      
      return {
        address: this.wallet.address,
        path,
        network: this.currentNetwork
      };
    } catch (error) {
      logger.error('Failed to connect wallet', { error: error.message, index });
      throw error;
    }
  }
  
  // Switch network
  switchNetwork(network) {
    try {
      // Validate network
      network = validateNetwork(network);
      
      this.currentNetwork = network;
      
      // Update current wallet
      if (this.walletConnected) {
        this.wallet = this.wallets[network];
      }
      
      // Reinitialize protocol handlers
      this.initializeProtocolHandlers();
      
      logger.info('Switched network', { 
        network,
        connected: this.walletConnected,
        address: this.walletConnected ? this.wallet.address : null
      });
      
      return {
        network,
        providerUrl: RPC_ENDPOINTS[network],
        connected: this.walletConnected,
        address: this.walletConnected ? this.wallet.address : null
      };
    } catch (error) {
      logger.error('Failed to switch network', { 
        network, 
        error: error.message 
      });
      throw createNetworkError(
        ErrorCodes.INVALID_NETWORK,
        error.message,
        { network }
      );
    }
  }
  
  // Register available tools
  registerTools() {
    // This would integrate with the MCP protocol
    // In a real implementation, this would register handlers for each tool
    this.tools = {
      // Wallet tools
      'get-address': this.getAddress.bind(this),
      'get-testnet-matic': this.getTestnetMatic.bind(this),
      'list-balances': this.listBalances.bind(this),
      'transfer-funds': this.transferFunds.bind(this),
      
      // Contract tools
      'deploy-contract': this.deployContract.bind(this),
      'verify-contract': this.verifyContract.bind(this),
      'list-contract-templates': this.listContractTemplates.bind(this),
      
      // L2 Bridge tools
      'bridge-to-polygon': this.bridgeToPolygon.bind(this),
      'bridge-to-ethereum': this.bridgeToEthereum.bind(this),
      'check-bridge-status': this.checkBridgeStatus.bind(this),
      
      // DeFi tools
      'swap-tokens': this.swapTokens.bind(this),
      'get-swap-quote': this.getSwapQuote.bind(this),
      'add-liquidity': this.addLiquidity.bind(this),
      'aave-deposit': this.aaveDeposit.bind(this),
      'aave-withdraw': this.aaveWithdraw.bind(this),
      
      // Simulation tools
      'simulate-transaction': this.simulateTransaction.bind(this),
      
      // Network tools
      'get-gas-price': this.getGasPrice.bind(this),
      'switch-network': this.switchNetworkTool.bind(this)
    };
  }
  
  // Tool implementations
  
  // Wallet tools
  async getAddress() {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    return {
      address: this.wallet.address,
      network: this.currentNetwork,
      path: `m/44'/60'/0'/0/${this.walletIndex}`
    };
  }
  
  async getTestnetMatic() {
    if (this.currentNetwork !== 'mumbai') {
      throw new Error("This operation is only available on Mumbai testnet");
    }
    
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    // In real implementation, this would call a faucet API
    // For demonstration, we'll simulate a successful request
    return {
      success: true,
      address: this.wallet.address,
      amount: "1 POL",
      message: "Testnet POL sent! It should arrive in your wallet shortly.",
      faucetUsed: "Polygon Mumbai Faucet"
    };
  }
  
  async listBalances() {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    // Get native POL balance
    const nativeBalance = await this.wallet.getBalance();
    
    // Create result with native balance
    const balances = [
      {
        token: "POL",
        address: "0x0000000000000000000000000000000000001010",
        balance: formatEther(nativeBalance),
        symbol: "POL",
        decimals: 18,
        native: true
      }
    ];
    
    // Get ERC20 balances for common tokens
    const tokenList = this.currentNetwork === 'mainnet' 
      ? ['WMATIC', 'WETH', 'USDC', 'USDT', 'DAI']
      : ['TEST_WMATIC', 'TEST_USDC'];
    
    // ERC20 interface for balance checking - updated for ethers v6
    const erc20Interface = new Interface([
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ]);
    
    // Check each token balance
    for (const token of tokenList) {
      const tokenAddress = TOKEN_ADDRESSES[token];
      if (!tokenAddress) continue;
      
      try {
        // Create contract instance - updated for ethers v6
        const tokenContract = new Contract(
          tokenAddress,
          erc20Interface,
          this.wallet.provider
        );
        
        // Get token info
        const [balance, decimals, symbol] = await Promise.all([
          tokenContract.balanceOf(this.wallet.address),
          tokenContract.decimals().catch(() => 18),
          tokenContract.symbol().catch(() => token)
        ]);
        
        // Only add tokens with non-zero balance
        // In v6, BigNumber.isZero() is replaced with checking if the value equals 0n
        if (balance != 0n) {
          balances.push({
            token,
            address: tokenAddress,
            balance: formatUnits(balance, decimals),
            symbol,
            decimals,
            native: false
          });
        }
      } catch (error) {
        console.error(`Error checking ${token} balance:`, error);
      }
    }
    
    return {
      address: this.wallet.address,
      network: this.currentNetwork,
      balances
    };
  }
  
  async transferFunds({ destination, assetId, amount }) {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    if (!destination || !isAddress(destination)) {
      throw new Error("Invalid destination address");
    }
    
    if (!amount || isNaN(parseFloat(amount))) {
      throw new Error("Invalid amount");
    }
    
    // Check if we're transferring native POL/MATIC
    if (!assetId || assetId.toUpperCase() === 'POL' || assetId.toUpperCase() === 'MATIC') {
      // Transfer native POL - updated for ethers v6
      const tx = await this.wallet.sendTransaction({
        to: destination,
        value: parseEther(amount)
      });
      
      await tx.wait();
      
      return {
        success: true,
        hash: tx.hash,
        from: this.wallet.address,
        to: destination,
        amount,
        asset: 'POL',
        network: this.currentNetwork
      };
    } else {
      // Transfer ERC20 token
      let tokenAddress = assetId;
      
      // Check if assetId is a known token symbol
      if (TOKEN_ADDRESSES[assetId.toUpperCase()]) {
        tokenAddress = TOKEN_ADDRESSES[assetId.toUpperCase()];
      }
      
      if (!isAddress(tokenAddress)) {
        throw new Error(`Unknown token: ${assetId}`);
      }
      
      // ERC20 interface for transfer - updated for ethers v6
      const erc20Interface = new Interface([
        "function transfer(address to, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ]);
      
      // Create contract instance - updated for ethers v6
      const tokenContract = new Contract(
        tokenAddress,
        erc20Interface,
        this.wallet
      );
      
      // Get token info
      const decimals = await tokenContract.decimals().catch(() => 18);
      const symbol = await tokenContract.symbol().catch(() => assetId);
      
      // Execute transfer - updated for ethers v6
      const tx = await tokenContract.transfer(
        destination,
        parseUnits(amount, decimals)
      );
      
      await tx.wait();
      
      return {
        success: true,
        hash: tx.hash,
        from: this.wallet.address,
        to: destination,
        amount,
        asset: symbol,
        assetAddress: tokenAddress,
        network: this.currentNetwork
      };
    }
  }
  
  // Contract tools
  async deployContract({ constructorArgs, contractName, solidityInputJson, solidityVersion }) {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    // For real implementation, this would compile and deploy the contract
    // For demonstration, we'll use our ContractTemplates implementation
    
    // Parse the solidity input JSON
    const solInput = JSON.parse(solidityInputJson);
    
    // For demo purposes, if this is a known template, use that
    if (solInput.template) {
      const deployResult = await this.contractTemplates.deployFromTemplate(
        solInput.template,
        solInput.parameters || {},
        constructorArgs || []
      );
      
      return {
        success: true,
        address: deployResult.address,
        transaction: deployResult.transactionHash,
        contractName,
        network: this.currentNetwork
      };
    } else {
      // For custom contracts, extract the code from the input JSON
      const sources = solInput.sources || {};
      const mainSourceFile = Object.keys(sources)[0];
      const contractCode = sources[mainSourceFile]?.content;
      
      if (!contractCode) {
        throw new Error("No contract source code found in input JSON");
      }
      
      // Deploy using the contract templates module
      const deployResult = await this.contractTemplates.deployContract(
        contractName,
        contractCode,
        constructorArgs || []
      );
      
      return {
        success: true,
        address: deployResult.address,
        transaction: deployResult.transactionHash,
        contractName,
        network: this.currentNetwork
      };
    }
  }
  
  async verifyContract({ contractAddress, contractName, solidityInputJson, constructorArgs }) {
    // Updated for ethers v6
    if (!isAddress(contractAddress)) {
      throw new Error("Invalid contract address");
    }
    
    // Parse the solidity input JSON
    const solInput = JSON.parse(solidityInputJson);
    
    // For demo purposes, if this is a known template, use that
    if (solInput.template) {
      const template = await this.contractTemplates.getTemplate(solInput.template);
      const contract = this.contractTemplates.prepareContract(
        solInput.template,
        solInput.parameters || {}
      );
      
      const verifyResult = await this.contractTemplates.verifyContract(
        contractAddress,
        contractName || contract.name,
        contract.code,
        constructorArgs || []
      );
      
      return {
        success: true,
        result: verifyResult,
        message: "Verification submitted successfully",
        network: this.currentNetwork
      };
    } else {
      // For custom contracts, extract the code from the input JSON
      const sources = solInput.sources || {};
      const mainSourceFile = Object.keys(sources)[0];
      const contractCode = sources[mainSourceFile]?.content;
      
      if (!contractCode) {
        throw new Error("No contract source code found in input JSON");
      }
      
      const verifyResult = await this.contractTemplates.verifyContract(
        contractAddress,
        contractName,
        contractCode,
        constructorArgs || []
      );
      
      return {
        success: true,
        result: verifyResult,
        message: "Verification submitted successfully",
        network: this.currentNetwork
      };
    }
  }
  
  async listContractTemplates() {
    const templates = await this.contractTemplates.listTemplates();
    
    return {
      success: true,
      templates
    };
  }
  
  // L2 Bridge tools
  async bridgeToPolygon({ token, amount }) {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    // Determine if this is ETH or an ERC20
    if (!token || token.toUpperCase() === 'ETH') {
      const result = await this.bridge.depositETH(amount);
      
      return {
        success: true,
        ...result,
        message: "ETH deposit to Polygon initiated. It will be available on Polygon in about 7-8 minutes."
      };
    } else {
      // Get token address
      let tokenAddress = token;
      
      // Check if token is a known symbol
      if (isNaN(parseInt(token, 16))) {
        // This is likely a symbol, not an address
        // In a real implementation, we'd have a more comprehensive token list
        throw new Error(`Please provide the token address directly`);
      }
      
      // Updated for ethers v6
      if (!isAddress(tokenAddress)) {
        throw new Error(`Invalid token address: ${token}`);
      }
      
      const result = await this.bridge.depositERC20(tokenAddress, amount);
      
      return {
        success: true,
        ...result,
        message: "Token deposit to Polygon initiated. It will be available on Polygon in about 7-8 minutes."
      };
    }
  }
  
  async bridgeToEthereum({ token, amount }) {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    // Determine if this is POL/MATIC or an ERC20
    if (!token || token.toUpperCase() === 'POL' || token.toUpperCase() === 'MATIC') {
      // Use withdrawPOL for both POL and MATIC (for backward compatibility)
      const result = await this.bridge.withdrawPOL(amount);
      
      return {
        success: true,
        ...result,
        message: "POL withdrawal initiated. After checkpoint inclusion, you'll need to execute the exit transaction on Ethereum."
      };
    } else {
      // Get token address
      let tokenAddress = token;
      
      // Check if token is a known symbol
      if (TOKEN_ADDRESSES[token.toUpperCase()]) {
        tokenAddress = TOKEN_ADDRESSES[token.toUpperCase()];
      }
      
      // Updated for ethers v6
      if (!isAddress(tokenAddress)) {
        throw new Error(`Unknown token: ${token}`);
      }
      
      const result = await this.bridge.withdrawERC20(tokenAddress, amount);
      
      return {
        success: true,
        ...result,
        message: "Token withdrawal initiated. After checkpoint inclusion, you'll need to execute the exit transaction on Ethereum."
      };
    }
  }
  
  async checkBridgeStatus({ txHash, network }) {
    if (!txHash) {
      throw new Error("Transaction hash is required");
    }
    
    // Default to Ethereum network if not specified
    network = network || 'ethereum';
    
    const status = await this.bridge.trackBridgeTransaction(txHash, network);
    
    return {
      success: true,
      ...status
    };
  }
  
  // DeFi tools
  async getSwapQuote({ fromToken, toToken, amount }) {
    if (!fromToken || !toToken || !amount) {
      throw new Error("fromToken, toToken, and amount are required");
    }
    
    const quote = await this.defi.getQuickSwapQuote(fromToken, toToken, amount);
    
    return {
      success: true,
      ...quote,
      protocol: "QuickSwap"
    };
  }
  
  async swapTokens({ fromToken, toToken, amount, slippage }) {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    if (!fromToken || !toToken || !amount) {
      throw new Error("fromToken, toToken, and amount are required");
    }
    
    // Default slippage is 0.5%
    slippage = slippage || 0.5;
    
    const result = await this.defi.quickSwapTokens(fromToken, toToken, amount, slippage);
    
    return {
      success: true,
      ...result,
      protocol: "QuickSwap"
    };
  }
  
  async addLiquidity({ tokenA, tokenB, amountA, amountB, slippage }) {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    if (!tokenA || !tokenB || !amountA || !amountB) {
      throw new Error("tokenA, tokenB, amountA, and amountB are required");
    }
    
    // Default slippage is 0.5%
    slippage = slippage || 0.5;
    
    const result = await this.defi.addQuickSwapLiquidity(tokenA, tokenB, amountA, amountB, slippage);
    
    return {
      success: true,
      ...result,
      protocol: "QuickSwap"
    };
  }
  
  async aaveDeposit({ token, amount }) {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    if (!token || !amount) {
      throw new Error("token and amount are required");
    }
    
    if (this.currentNetwork !== 'mainnet') {
      throw new Error("Aave operations are only available on mainnet");
    }
    
    const result = await this.defi.aaveDeposit(token, amount);
    
    return {
      success: true,
      ...result,
      protocol: "Aave"
    };
  }
  
  async aaveWithdraw({ token, amount }) {
    if (!this.walletConnected) {
      throw new Error("Wallet not connected");
    }
    
    if (!token) {
      throw new Error("token is required");
    }
    
    // amount can be "all" to withdraw all
    amount = amount || "all";
    
    if (this.currentNetwork !== 'mainnet') {
      throw new Error("Aave operations are only available on mainnet");
    }
    
    const result = await this.defi.aaveWithdraw(token, amount);
    
    return {
      success: true,
      ...result,
      protocol: "Aave"
    };
  }
  
  // Simulation tools
  async simulateTransaction({ transaction }) {
    if (!transaction) {
      throw new Error("transaction data is required");
    }
    
    // If we have a wallet connected, set the from address
    if (this.walletConnected && !transaction.from) {
      transaction.from = this.wallet.address;
    }
    
    const result = await this.simulator.simulateTransaction(transaction);
    
    return {
      success: true,
      ...result,
      network: this.currentNetwork
    };
  }
  
  // Network tools - updated for ethers v6
  async getGasPrice() {
    const feeData = await this.providers[this.currentNetwork].getFeeData();
    
    return {
      success: true,
      network: this.currentNetwork,
      gasPrice: feeData.gasPrice ? formatUnits(feeData.gasPrice, 'gwei') : null,
      maxFeePerGas: feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 'gwei') : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null,
      // In v6, lastBaseFeePerGas is renamed to baseFeePerGas
      baseFeePerGas: feeData.baseFeePerGas ? formatUnits(feeData.baseFeePerGas, 'gwei') : null
    };
  }
  
  async switchNetworkTool({ network }) {
    if (!network || (network !== 'mainnet' && network !== 'mumbai')) {
      throw new Error("Invalid network. Use 'mainnet' or 'mumbai'");
    }
    
    return this.switchNetwork(network);
  }
  
  // Handle MCP requests with proper error handling
  async handleRequest(request) {
    const { tool, parameters } = request;
    
    // Check if the tool exists
    if (!this.tools[tool]) {
      logger.error('Unknown tool requested', { tool });
      throw new Error(`Unknown tool: ${tool}`);
    }
    
    try {
      logger.info('Executing tool', { tool, parameters });
      
      // Call the tool with parameters
      const result = await this.tools[tool](parameters || {});
      
      logger.info('Tool executed successfully', { 
        tool, 
        success: true,
        resultSummary: typeof result === 'object' ? 
          Object.keys(result).join(', ') : 
          'non-object result'
      });
      
      return {
        success: true,
        tool,
        result
      };
    } catch (error) {
      logger.error(`Error executing tool ${tool}:`, { 
        tool, 
        error: error.message,
        stack: error.stack,
        code: error.code || 'UNKNOWN_ERROR',
        details: error.details || {}
      });
      
      // Enhanced error handling with more details
      return {
        success: false,
        tool,
        error: error.message,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorDetails: error.details || {},
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // Initialize MCP protocol server
  async initializeMcpServer() {
    try {
      // Create MCP server instance
      this.mcpServer = new Server(
        {
          name: 'polygon-blockchain-server',
          version: '0.1.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
      
      // Register tools with MCP server
      for (const [toolName, toolFunction] of Object.entries(this.tools)) {
        this.mcpServer.registerTool(toolName, async (params) => {
          try {
            const result = await toolFunction(params);
            return { success: true, result };
          } catch (error) {
            console.error(`Error in tool ${toolName}:`, error);
            return { 
              success: false, 
              error: error.message,
              errorDetails: error.details || {}
            };
          }
        });
      }
      
      // Set up error handling
      this.mcpServer.onerror = (error) => {
        console.error('[MCP Server Error]', error);
      };
      
      return this.mcpServer;
    } catch (error) {
      console.error('Failed to initialize MCP server:', error);
      throw error;
    }
  }
}

// Create and export the MCP server
const mcpServer = new PolygonMCPServer();

// Export the server for module usage
module.exports = { mcpServer };

// If this script is run directly, start the server
if (require.main === module) {
  (async () => {
    try {
      // Initialize the MCP server
      const server = await mcpServer.initializeMcpServer();
      
      // Connect to stdio transport for MCP communication
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      logger.info("Polygon MCP Server running on stdio transport");
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info("Shutting down Polygon MCP Server...");
        await server.close();
        process.exit(0);
      });
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', { 
          error: error.message,
          stack: error.stack
        });
        // Keep the process running, but log the error
      });
      
      // Handle unhandled promise rejections
      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled promise rejection', { 
          reason: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined
        });
        // Keep the process running, but log the error
      });
    } catch (error) {
      logger.error("Failed to start Polygon MCP Server:", { 
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  })();
}
