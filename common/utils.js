// utils.js - Common utility function
import { isAddress, getAddress } from 'ethers'; // Use import
import { createTransactionError, ErrorCodes } from '../errors.js'; // Use import and add .js

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
    return getAddress(token); // Use imported getAddress directly
  }

  const upperToken = token.toUpperCase();
  if (tokenAddresses && tokenAddresses[upperToken]) {
    // Return checksummed address from the map
    return getAddress(tokenAddresses[upperToken]); // Use imported getAddress directly
  }

  throw createTransactionError(
    ErrorCodes.INVALID_ADDRESS,
    `Unknown token symbol: ${token}`,
    { token }
  );
}

export {
  resolveTokenAddress,
};
