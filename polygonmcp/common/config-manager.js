// config-manager.js - Centralized configuration management
const dotenv = require('dotenv');
const { defaultLogger } = require('../logger');
const { DEFAULT_TOKEN_ADDRESSES } = require('./constants');

// Load environment variables
dotenv.config();

// Required environment variables
const REQUIRED_ENV_VARS = [
  'POLYGON_MAINNET_RPC',
  'ETHEREUM_RPC_URL',
  'POLYGONSCAN_API_KEY'
];

// Default configurations
const DEFAULT_CONFIG = {
  // Bridge configuration
  posRootChainManager: '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77',
  rootChainAddress: '0x0000000000000000000000000000000000000000',
  childChainAddress: '0x0000000000000000000000000000000000000000',
  
  // DeFi configuration
  defaultSlippage: 0.5,
  deadlineMinutes: 20,
  
  // Gas limits for various operations
  gasLimits: {
    approval: 100000,
    swap: 250000,
    addLiquidity: 300000,
    removeLiquidity: 250000,
    bridgeDeposit: 500000,
    bridgeWithdraw: 500000
  }
};

// Validate required environment variables
function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter(
    varName => !process.env[varName]
  );
  
  if (missing.length > 0) {
    const missingVars = missing.join(', ');
    defaultLogger.error(`Missing required environment variables: ${missingVars}`);
    throw new Error(`Missing required environment variables: ${missingVars}`);
  }
  
  return true;
}

// Get the configuration for the application
function getConfig() {
  // We don't validate in test environment
  if (process.env.NODE_ENV !== 'test') {
    try {
      validateEnv();
    } catch (error) {
      defaultLogger.warn(`Environment validation warning: ${error.message}`);
      // We'll continue with defaults where possible
    }
  }
  
  // Build configuration from environment variables and defaults
  const config = {
    // Network RPCs
    rpcUrl: process.env.POLYGON_MAINNET_RPC || 'https://polygon-rpc.com',
    mumbaiRpcUrl: process.env.POLYGON_MUMBAI_RPC || 'https://rpc-mumbai.maticvigil.com',
    parentRpcUrl: process.env.ETHEREUM_RPC_URL,
    
    // API Keys
    explorerApiKey: process.env.POLYGONSCAN_API_KEY,
    
    // Bridge configuration
    posRootChainManager: process.env.POS_ROOT_CHAIN_MANAGER || DEFAULT_CONFIG.posRootChainManager,
    rootChainAddress: process.env.ROOT_CHAIN_ADDRESS || DEFAULT_CONFIG.rootChainAddress,
    childChainAddress: process.env.CHILD_CHAIN_ADDRESS || DEFAULT_CONFIG.childChainAddress,
    
    // DeFi protocol addresses
    quickswapRouter: process.env.QUICKSWAP_ROUTER,
    uniswapRouter: process.env.UNISWAP_V3_ROUTER,
    uniswapV2Router: process.env.UNISWAP_V2_ROUTER,
    polymarketFactory: process.env.POLYMARKET_FACTORY,
    
    // Default settings
    defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || DEFAULT_CONFIG.defaultSlippage),
    deadlineMinutes: parseInt(process.env.DEFAULT_DEADLINE_MINUTES || DEFAULT_CONFIG.deadlineMinutes, 10),
    defaultNetwork: process.env.DEFAULT_NETWORK || 'mumbai',
    
    // Gas limits
    gasLimits: { ...DEFAULT_CONFIG.gasLimits },
    
    // Token addresses (merge defaults with any overrides from env)
    tokenAddresses: DEFAULT_TOKEN_ADDRESSES
  };
  
  return config;
}

module.exports = {
  validateEnv,
  getConfig,
  DEFAULT_CONFIG
};
