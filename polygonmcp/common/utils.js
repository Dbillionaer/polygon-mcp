// utils.js - Common utility functions
const ethers = require('ethers'); // Add require for ethers
const { isAddress } = ethers; // Destructure isAddress
const { createTransactionError, ErrorCodes } = require('../errors');

/**
 * Resolves a token symbol or address to a checksummed address.
 * @param {string} token - Token symbol (e.g., 'USDC') or address.
 * @param {Object} tokenAddresses - A map of uppercase token symbols to addresses.
 * @returns {string} The checksummed token address.
 * @throws {TransactionError} If the token is unknown or invalid.
 */
function resolveTokenAddress(token, tokenAddresses) {
  if (!token || typeof token !== 'string') {
    throw createTransactionError(
      ErrorCodes.INVALID_PARAMETERS,
      'Token symbol or address is required',
      { token }
    );
  }

  if (isAddress(token)) {
    // Return checksummed address if it's already an address
    return ethers.getAddress(token);
  }

  const upperToken = token.toUpperCase();
  if (tokenAddresses && tokenAddresses[upperToken]) {
    // Return checksummed address from the map
    return ethers.getAddress(tokenAddresses[upperToken]);
  }

  throw createTransactionError(
    ErrorCodes.INVALID_ADDRESS,
    `Unknown token symbol: ${token}`,
    { token }
  );
}

module.exports = {
  resolveTokenAddress,
};
