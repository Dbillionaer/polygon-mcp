// validation.js - Input validation utilities for Polygon MCP Server
import { isAddress } from 'ethers';
import { ErrorCodes, createWalletError } from './errors.js'; // Use import and add .js

/**
 * Validate an Ethereum address
 * @param {string} address - The address to validate
 * @param {string} paramName - The parameter name for error messages
 * @returns {string} The validated address
 * @throws {WalletError} If the address is invalid
 */
function validateAddress(address, paramName = 'address') {
  if (!address) {
    throw createWalletError(
      ErrorCodes.INVALID_ADDRESS,
      `${paramName} is required`,
      { paramName }
    );
  }
  
  if (!isAddress(address)) {
    throw createWalletError(
      ErrorCodes.INVALID_ADDRESS,
      `Invalid Ethereum address: ${address}`,
      { paramName, address }
    );
  }
  
  return address;
}

/**
 * Validate a token amount
 * @param {string|number|bigint} amount - The amount to validate
 * @param {string} paramName - The parameter name for error messages
 * @param {Object} options - Validation options
 * @param {boolean} options.allowZero - Whether to allow zero amounts
 * @param {bigint} options.minValue - Minimum allowed value
 * @param {bigint} options.maxValue - Maximum allowed value
 * @returns {string} The validated amount as a string
 * @throws {Error} If the amount is invalid
 */
function validateAmount(amount, paramName = 'amount', options = {}) {
  const { allowZero = false, minValue = 0n, maxValue = BigInt(Number.MAX_SAFE_INTEGER) } = options;
  
  if (amount === undefined || amount === null) {
    throw new Error(`${paramName} is required`);
  }
  
  // Convert to BigInt
  let amountBigInt;
  try {
    amountBigInt = BigInt(amount);
  } catch (error) {
    throw new Error(`Invalid ${paramName}: ${amount}. Must be a valid number.`);
  }
  
  // Check if it's negative
  if (amountBigInt < 0n) {
    throw new Error(`Invalid ${paramName}: ${amount}. Cannot be negative.`);
  }
  
  // Check if it's zero
  if (amountBigInt === 0n && !allowZero) {
    throw new Error(`Invalid ${paramName}: ${amount}. Cannot be zero.`);
  }
  
  // Check min/max values
  if (amountBigInt < minValue) {
    throw new Error(`Invalid ${paramName}: ${amount}. Must be at least ${minValue}.`);
  }
  
  if (amountBigInt > maxValue) {
    throw new Error(`Invalid ${paramName}: ${amount}. Must be at most ${maxValue}.`);
  }
  
  return amountBigInt.toString();
}

/**
 * Validate a token symbol
 * @param {string} symbol - The token symbol to validate
 * @param {string} paramName - The parameter name for error messages
 * @returns {string} The validated symbol
 * @throws {Error} If the symbol is invalid
 */
function validateTokenSymbol(symbol, paramName = 'token') {
  if (!symbol) {
    throw new Error(`${paramName} is required`);
  }
  
  // Convert to string and trim
  const symbolStr = String(symbol).trim();
  
  // Check if it's a valid token symbol
  if (!/^[A-Za-z0-9._-]+$/.test(symbolStr)) {
    throw new Error(`Invalid ${paramName}: ${symbol}. Must contain only letters, numbers, and ._-`);
  }
  
  return symbolStr;
}

/**
 * Validate a network name
 * @param {string} network - The network name to validate
 * @param {string[]} allowedNetworks - List of allowed network names
 * @param {string} paramName - The parameter name for error messages
 * @returns {string} The validated network name
 * @throws {Error} If the network is invalid
 */
function validateNetwork(network, allowedNetworks = ['mainnet', 'mumbai'], paramName = 'network') {
  if (!network) {
    throw new Error(`${paramName} is required`);
  }
  
  // Convert to string, trim, and lowercase
  const networkStr = String(network).trim().toLowerCase();
  
  // Check if it's an allowed network
  if (!allowedNetworks.includes(networkStr)) {
    throw new Error(
      `Invalid ${paramName}: ${network}. Must be one of: ${allowedNetworks.join(', ')}`
    );
  }
  
  return networkStr;
}

/**
 * Validate a transaction hash
 * @param {string} txHash - The transaction hash to validate
 * @param {string} paramName - The parameter name for error messages
 * @returns {string} The validated transaction hash
 * @throws {Error} If the transaction hash is invalid
 */
function validateTransactionHash(txHash, paramName = 'txHash') {
  if (!txHash) {
    throw new Error(`${paramName} is required`);
  }
  
  // Convert to string and trim
  const txHashStr = String(txHash).trim();
  
  // Check if it's a valid transaction hash (0x followed by exactly 64 hexadecimal characters)
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHashStr)) {
    throw new Error(
      `Invalid ${paramName}: ${txHash}. Must be a valid Ethereum transaction hash (0x followed by 64 hexadecimal characters).`
    );
  }
  
  return txHashStr;
}

/**
 * Validate a percentage value
 * @param {string|number} percentage - The percentage to validate
 * @param {string} paramName - The parameter name for error messages
 * @param {Object} options - Validation options
 * @param {number} options.minValue - Minimum allowed value
 * @param {number} options.maxValue - Maximum allowed value
 * @returns {number} The validated percentage as a number
 * @throws {Error} If the percentage is invalid
 */
function validatePercentage(percentage, paramName = 'percentage', options = {}) {
  const { minValue = 0, maxValue = 100 } = options;
  
  if (percentage === undefined || percentage === null) {
    throw new Error(`${paramName} is required`);
  }
  
  // Convert to string and trim
  const percentageStr = String(percentage).trim();
  
  // Check if it's a valid number
  if (!/^-?\d*\.?\d+$/.test(percentageStr)) {
    throw new Error(`Invalid ${paramName}: ${percentage}. Must be a valid number.`);
  }
  
  // Parse as float
  const percentageFloat = parseFloat(percentageStr);
  
  // Check min/max values
  if (percentageFloat < minValue) {
    throw new Error(`Invalid ${paramName}: ${percentage}. Must be at least ${minValue}%.`);
  }
  
  if (percentageFloat > maxValue) {
    throw new Error(`Invalid ${paramName}: ${percentage}. Must be at most ${maxValue}%.`);
  }
  
  return percentageFloat;
}

/**
 * Validate required parameters
 * @param {Object} params - The parameters object
 * @param {string[]} requiredParams - List of required parameter names
 * @throws {Error} If any required parameter is missing
 */
function validateRequiredParams(params, requiredParams) {
  if (!params) {
    throw new Error('Parameters object is required');
  }
  
  for (const param of requiredParams) {
    if (params[param] === undefined || params[param] === null) {
      throw new Error(`Parameter '${param}' is required`);
    }
  }
}

export {
  validateAddress,
  validateAmount,
  validateTokenSymbol,
  validateNetwork,
  validateTransactionHash,
  validatePercentage,
  validateRequiredParams,
};
