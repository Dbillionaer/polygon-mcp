// errors.js - Custom error classes for Polygon MCP Server

// Error codes
const ErrorCodes = {
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  
  // Wallet errors
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  RPC_ERROR: 'RPC_ERROR',
  INVALID_NETWORK: 'INVALID_NETWORK',
  
  // Transaction errors
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TRANSACTION_REJECTED: 'TRANSACTION_REJECTED',
  TRANSACTION_TIMEOUT: 'TRANSACTION_TIMEOUT',
  
  // Contract errors
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  DEPLOYMENT_FAILED: 'DEPLOYMENT_FAILED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  
  // Bridge errors
  BRIDGE_ERROR: 'BRIDGE_ERROR',
  BRIDGE_TIMEOUT: 'BRIDGE_TIMEOUT',
  
  // DeFi errors
  DEFI_ERROR: 'DEFI_ERROR',
  SWAP_FAILED: 'SWAP_FAILED',
  LIQUIDITY_ERROR: 'LIQUIDITY_ERROR',
  LENDING_ERROR: 'LENDING_ERROR',
  
  // Simulation errors
  SIMULATION_FAILED: 'SIMULATION_FAILED',
};

/**
 * Base error class for Polygon MCP Server
 */
class PolygonMCPError extends Error {
  /**
   * Create a new PolygonMCPError
   * @param {string} code - Error code from ErrorCodes
   * @param {string} message - Human-readable error message
   * @param {Object} details - Additional error details
   */
  constructor(code = ErrorCodes.UNKNOWN_ERROR, message = 'An unknown error occurred', details = {}) {
    super(message);
    this.name = 'PolygonMCPError';
    this.code = code;
    this.details = details;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Convert error to JSON representation
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Error for wallet-related issues
 */
class WalletError extends PolygonMCPError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'WalletError';
  }
}

/**
 * Error for network-related issues
 */
class NetworkError extends PolygonMCPError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'NetworkError';
  }
}

/**
 * Error for transaction-related issues
 */
class TransactionError extends PolygonMCPError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'TransactionError';
  }
}

/**
 * Error for contract-related issues
 */
class ContractError extends PolygonMCPError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'ContractError';
  }
}

/**
 * Error for bridge-related issues
 */
class BridgeError extends PolygonMCPError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'BridgeError';
  }
}

/**
 * Error for DeFi-related issues
 */
class DeFiError extends PolygonMCPError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'DeFiError';
  }
}

/**
 * Error for simulation-related issues
 */
class SimulationError extends PolygonMCPError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'SimulationError';
  }
}

/**
 * Create a wallet error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {WalletError} Wallet error instance
 */
function createWalletError(code, message, details = {}) {
  return new WalletError(code, message, details);
}

/**
 * Create a network error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {NetworkError} Network error instance
 */
function createNetworkError(code, message, details = {}) {
  return new NetworkError(code, message, details);
}

/**
 * Create a transaction error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {TransactionError} Transaction error instance
 */
function createTransactionError(code, message, details = {}) {
  return new TransactionError(code, message, details);
}

/**
 * Create a contract error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {ContractError} Contract error instance
 */
function createContractError(code, message, details = {}) {
  return new ContractError(code, message, details);
}

/**
 * Create a bridge error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {BridgeError} Bridge error instance
 */
function createBridgeError(code, message, details = {}) {
  return new BridgeError(code, message, details);
}

/**
 * Create a DeFi error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {DeFiError} DeFi error instance
 */
function createDeFiError(code, message, details = {}) {
  return new DeFiError(code, message, details);
}

/**
 * Create a simulation error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {SimulationError} Simulation error instance
 */
function createSimulationError(code, message, details = {}) {
  return new SimulationError(code, message, details);
}

module.exports = {
  ErrorCodes,
  PolygonMCPError,
  WalletError,
  NetworkError,
  TransactionError,
  ContractError,
  BridgeError,
  DeFiError,
  SimulationError,
  createWalletError,
  createNetworkError,
  createTransactionError,
  createContractError,
  createBridgeError,
  createDeFiError,
  createSimulationError,
};
