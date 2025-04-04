// config-manager.js - Centralized configuration management
import dotenv from 'dotenv';
import { defaultLogger } from '../logger.js'; // Use import and add .js
import { DEFAULT_TOKEN_ADDRESSES, NETWORK_TOKEN_ADDRESSES } from './constants.js'; // Use import and add .js

// Load environment variables
dotenv.config();

// Required environment variables - network-specific requirements will be checked dynamically
const REQUIRED_ENV_VARS = [
  'ETHEREUM_RPC_URL',
  'POLYGONSCAN_API_KEY'
];

// Network-specific required variables
const NETWORK_REQUIRED_VARS = {
  'mainnet': ['POLYGON_MAINNET_RPC'],
  'amoy': ['POLYGON_AMOY_RPC']
};

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
function validateEnv(network = 'mainnet') {
  // Validate common required variables
  const missing = REQUIRED_ENV_VARS.filter(
    varName => !process.env[varName]
  );

  // Validate network-specific required variables
  if (NETWORK_REQUIRED_VARS[network]) {
    const missingNetworkVars = NETWORK_REQUIRED_VARS[network].filter(
      varName => !process.env[varName]
    );
    missing.push(...missingNetworkVars);
  } else {
    defaultLogger.warn(`Unknown network: ${network}, using default requirements`);
  }

  if (missing.length > 0) {
    const missingVars = missing.join(', ');
    defaultLogger.error(`Missing required environment variables for ${network}: ${missingVars}`);
    throw new Error(`Missing required environment variables for ${network}: ${missingVars}`);
  }

  return true;
}

// Get the configuration for the application
function getConfig() {
  // Determine which network to use
  const defaultNetwork = process.env.DEFAULT_NETWORK || 'mainnet';

  // We don't validate in test environment
  if (process.env.NODE_ENV !== 'test') {
    try {
      validateEnv(defaultNetwork);
    } catch (error) {
      defaultLogger.warn(`Environment validation warning: ${error.message}`);
      // We'll continue with defaults where possible
    }
  }

  // Network-specific configurations
  const networkConfigs = {
    'mainnet': {
      rpcUrl: process.env.POLYGON_MAINNET_RPC || 'https://polygon-rpc.com',
      parentRpcUrl: process.env.ETHEREUM_MAINNET_RPC || process.env.ETHEREUM_RPC_URL,
      explorerUrl: 'https://polygonscan.com',
      explorerApiUrl: 'https://api.polygonscan.com/api',
      posRootChainManager: '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77',
      // DeFi protocol addresses for mainnet
      quickswapRouter: process.env.QUICKSWAP_ROUTER || '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      uniswapRouter: process.env.UNISWAP_V3_ROUTER || '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      uniswapV2Router: process.env.UNISWAP_V2_ROUTER || '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      // Token addresses for mainnet
      tokenAddresses: DEFAULT_TOKEN_ADDRESSES
    },
    'amoy': {
      rpcUrl: process.env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology',
      parentRpcUrl: process.env.ETHEREUM_SEPOLIA_RPC || process.env.ETHEREUM_RPC_URL, // Sepolia for Amoy
      explorerUrl: 'https://amoy.polygonscan.com',
      explorerApiUrl: 'https://api-amoy.polygonscan.com/api',
      posRootChainManager: process.env.POS_ROOT_CHAIN_MANAGER || '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77', // This should be updated for Amoy
      // DeFi protocol addresses for Amoy - these need to be updated with actual Amoy addresses
      quickswapRouter: process.env.QUICKSWAP_ROUTER || '0x0000000000000000000000000000000000000000',
      uniswapRouter: process.env.UNISWAP_V3_ROUTER || '0x0000000000000000000000000000000000000000',
      uniswapV2Router: process.env.UNISWAP_V2_ROUTER || '0x0000000000000000000000000000000000000000',
      // Token addresses for Amoy - these need to be updated with actual Amoy addresses
      tokenAddresses: {
        'WPOL': '0x0000000000000000000000000000000000000000', // Placeholder - update with actual Amoy addresses
        'WETH': '0x0000000000000000000000000000000000000000',
        'USDC': '0x0000000000000000000000000000000000000000',
        'USDT': '0x0000000000000000000000000000000000000000',
        'DAI': '0x0000000000000000000000000000000000000000'
      }
    }
  };

  // Get network-specific configuration
  const networkConfig = networkConfigs[defaultNetwork] || networkConfigs['mainnet'];

  // Build configuration from environment variables and defaults
  const config = {
    // Network info
    network: defaultNetwork,
    rpcUrl: networkConfig.rpcUrl,
    parentRpcUrl: networkConfig.parentRpcUrl,
    explorerUrl: networkConfig.explorerUrl,
    explorerApiUrl: networkConfig.explorerApiUrl,

    // API Keys
    explorerApiKey: process.env.POLYGONSCAN_API_KEY,

    // Bridge configuration
    posRootChainManager: process.env.POS_ROOT_CHAIN_MANAGER || networkConfig.posRootChainManager,
    rootChainAddress: process.env.ROOT_CHAIN_ADDRESS || DEFAULT_CONFIG.rootChainAddress,
    childChainAddress: process.env.CHILD_CHAIN_ADDRESS || DEFAULT_CONFIG.childChainAddress,

    // DeFi protocol addresses
    quickswapRouter: process.env.QUICKSWAP_ROUTER || networkConfig.quickswapRouter,
    uniswapRouter: process.env.UNISWAP_V3_ROUTER || networkConfig.uniswapRouter,
    uniswapV2Router: process.env.UNISWAP_V2_ROUTER || networkConfig.uniswapV2Router,
    polymarketFactory: process.env.POLYMARKET_FACTORY,

    // Default settings
    defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || DEFAULT_CONFIG.defaultSlippage),
    deadlineMinutes: parseInt(process.env.DEFAULT_DEADLINE_MINUTES || DEFAULT_CONFIG.deadlineMinutes, 10),
    defaultNetwork: defaultNetwork,

    // Gas limits
    gasLimits: { ...DEFAULT_CONFIG.gasLimits },

    // Token addresses (use network-specific addresses)
    tokenAddresses: NETWORK_TOKEN_ADDRESSES[defaultNetwork] || DEFAULT_TOKEN_ADDRESSES
  };

  return config;
}

// Export functions and constants individually
export {
  validateEnv,
  getConfig,
  DEFAULT_CONFIG
};
