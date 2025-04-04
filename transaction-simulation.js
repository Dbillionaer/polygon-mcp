// transaction-simulation.js - Transaction Simulation and Analysis
import { 
  JsonRpcProvider, 
  Contract, 
  Interface,
  formatUnits,
  formatEther,
  parseUnits,
  isAddress
} from 'ethers';
import { ErrorCodes, createTransactionError, createWalletError } from './errors.js'; // Use import and add .js
import { defaultLogger } from './logger.js'; // Use import and add .js
import walletManager from './common/wallet-manager.js'; // Use import and add .js
import { resolveTokenAddress as commonResolveTokenAddress } from './common/utils.js'; // Use import and add .js
import { ERC20_ABI, ERC20_TRANSFER_SIGNATURE } from './common/constants.js'; // Use import and add .js

export class TransactionSimulator { // Add export
  constructor(config) {
    this.rpcUrl = config.rpcUrl;
    this.explorerApiKey = config.explorerApiKey;
    this.tokenAddresses = config.tokenAddresses;
    
    // Initialize provider
    this.provider = new JsonRpcProvider(this.rpcUrl);
  }

  // Removed redundant connectWallet method - relies on central walletManager

  // Check if wallet is connected using walletManager
  checkWalletConnected() {
    if (!walletManager.isWalletConnected('polygon')) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        'Wallet not connected',
        { context: 'TransactionSimulator' }
      );
    }
    return true;
  }

  // Use the centralized resolveTokenAddress function
  resolveTokenAddress(token) {
    // Pass the tokenAddresses map from this instance's config
    return commonResolveTokenAddress(token, this.tokenAddresses);
  }

  // Simulate a transaction using eth_call
  async simulateTransaction(transaction) {
    try {
      // Clone the transaction to avoid modifying the original
      const txToSimulate = { ...transaction };
      
      // If from address is not provided, use the connected wallet
      if (!txToSimulate.from && walletManager.isWalletConnected('polygon')) {
        txToSimulate.from = walletManager.getAddress('polygon');
      }
      
      // If gas limit is not provided, estimate it
      if (!txToSimulate.gasLimit) {
        try {
          const gasEstimate = await this.provider.estimateGas(txToSimulate);
          // Convert to BigInt if it's not already
          const gasEstimateBigInt = BigInt(gasEstimate);
          // Add 20% buffer
          txToSimulate.gasLimit = gasEstimateBigInt * 120n / 100n;
        } catch (error) {
          // If gas estimation fails, use a default value
          txToSimulate.gasLimit = 300000n;
          defaultLogger.warn(`Gas estimation failed: ${error.message}. Using default value.`);
        }
      }
      
      // If gas price is not provided, get it from the network
      if (!txToSimulate.gasPrice && !txToSimulate.maxFeePerGas) {
        const feeData = await this.provider.getFeeData();
        if (feeData.maxFeePerGas) {
          txToSimulate.maxFeePerGas = BigInt(feeData.maxFeePerGas);
          txToSimulate.maxPriorityFeePerGas = BigInt(feeData.maxPriorityFeePerGas);
        } else {
          txToSimulate.gasPrice = BigInt(feeData.gasPrice);
        }
      }
      
      // Initialize simulation result
      const simulationResult = {
        success: true,
        gasUsed: '0',
        logs: [],
        tokenTransfers: [],
        contractInteractions: [],
        errorMessage: null,
        stateChanges: []
      };
      
      // Get the current block number for state comparison
      const blockNumber = await this.provider.getBlockNumber();
      
      // Perform eth_call to simulate the transaction
      try {
        // Create a copy of the transaction for eth_call
        const callTx = { ...txToSimulate };
        
        // Execute the transaction via eth_call
        await this.provider.call(callTx, blockNumber);
        
        // If we get here, the call was successful
        simulationResult.success = true;
      } catch (error) {
        // The call failed, but we can still extract useful information
        simulationResult.success = false;
        simulationResult.errorMessage = error.message;
        
        // Check if this is a revert with a reason
        if (error.data) {
          try {
            // Try to decode the revert reason
            const decodedError = error.data.toString();
            if (decodedError.includes('revert')) {
              simulationResult.errorMessage = `Transaction would revert: ${decodedError}`;
            }
          } catch (decodeError) {
            // Ignore decoding errors
          }
        }
      }
      
      // Estimate gas usage more accurately
      try {
        const gasEstimate = await this.provider.estimateGas(txToSimulate);
        simulationResult.gasUsed = gasEstimate.toString();
      } catch (error) {
        // If gas estimation fails, the transaction would likely fail
        simulationResult.gasUsed = txToSimulate.gasLimit?.toString() || '0';
        if (!simulationResult.errorMessage) {
          simulationResult.errorMessage = `Gas estimation failed: ${error.message}`;
        }
      }
      
      // Detect token transfers and contract interactions
      await this.detectTokenTransfers(txToSimulate, simulationResult);
      
      // If this is a contract creation, add it to the contract interactions
      if (!txToSimulate.to && txToSimulate.data) {
        // This is a contract creation
        const creationCode = txToSimulate.data;
        
        // Calculate the contract address that would be created
        // This uses a simplified version of the address calculation
        const nonce = await this.provider.getTransactionCount(txToSimulate.from);
        const addressBuffer = Buffer.from(
          this.provider.network.chainId + txToSimulate.from.slice(2).toLowerCase() + nonce.toString(16).padStart(64, '0'),
          'hex'
        );
        
        // Use keccak256 hash of the buffer and take the last 20 bytes
        const estimatedAddress = '0x' + addressBuffer.slice(-20).toString('hex');
        
        simulationResult.contractInteractions.push({
          type: 'creation',
          bytecode: creationCode.length > 64 ? creationCode.substring(0, 64) + '...' : creationCode,
          estimatedAddress,
          constructorArgs: this.extractConstructorArgs(creationCode)
        });
      }
      
      // Add gas cost estimation
      const gasPrice = txToSimulate.gasPrice || txToSimulate.maxFeePerGas || parseUnits('50', 'gwei');
      const gasCost = BigInt(simulationResult.gasUsed) * BigInt(gasPrice);
      
      simulationResult.gasCost = {
        wei: gasCost.toString(),
        gwei: formatUnits(gasCost, 'gwei'),
        ether: formatEther(gasCost)
      };
      
      return simulationResult;
    } catch (error) {
      return {
        success: false,
        errorMessage: error.message,
        gasUsed: '0',
        logs: [],
        tokenTransfers: [],
        contractInteractions: []
      };
    }
  }
  
  // Analyze a transaction hash
  async analyzeTransaction(txHash) {
    try {
      // Get transaction details
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        throw new Error(`Transaction not found: ${txHash}`);
      }
      
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      // For a real implementation, this would analyze the transaction logs
      // to extract token transfers, contract interactions, etc.
      
      // For demonstration, we'll return basic transaction details
      const result = {
        hash: txHash,
        from: tx.from,
        to: tx.to || 'Contract Creation',
        value: {
          wei: tx.value.toString(),
          ether: formatEther(tx.value)
        },
        gasUsed: receipt ? receipt.gasUsed.toString() : 'Pending',
        gasPrice: {
          wei: tx.gasPrice.toString(),
          gwei: formatUnits(tx.gasPrice, 'gwei')
        },
        status: receipt ? (receipt.status ? 'Success' : 'Failed') : 'Pending',
        blockNumber: receipt ? receipt.blockNumber : 'Pending',
        timestamp: 'Unknown', // Would get block timestamp in real implementation
        logs: receipt ? receipt.logs.length : 0
      };
      
      // Calculate gas cost
      if (receipt) {
        const gasCost = BigInt(receipt.gasUsed) * BigInt(tx.gasPrice);
        result.gasCost = {
          wei: gasCost.toString(),
          gwei: formatUnits(gasCost, 'gwei'),
          ether: formatEther(gasCost)
        };
      }
      
      return result;
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.TRANSACTION_FAILED,
        `Analysis failed: ${error.message}`,
        { txHash }
      );
    }
  }
  
  // Extract constructor arguments from contract creation bytecode
  extractConstructorArgs(bytecode) {
    try {
      // This is a simplified implementation
      // In a real implementation, you would need to parse the ABI to know the types
      if (!bytecode || bytecode.length <= 2) {
        return [];
      }
      
      // Try to find the constructor arguments by looking for the metadata hash
      // This is a heuristic and may not work for all contracts
      const metadataLength = 43; // 0x + 42 chars for CBOR encoded metadata hash
      const possibleArgs = bytecode.slice(bytecode.length - metadataLength);
      
      return {
        raw: possibleArgs,
        decoded: 'Constructor arguments detection requires ABI'
      };
    } catch (error) {
      return {
        raw: 'Unknown',
        error: error.message
      };
    }
  }
  
  // Detect token transfers in a transaction
  async detectTokenTransfers(transaction, simulationResult) {
    // Check for ERC20 transfers
    if (transaction.to && transaction.data && transaction.data.startsWith(ERC20_TRANSFER_SIGNATURE)) {
      await this.detectERC20Transfer(transaction, simulationResult);
    }
    
    // Check for other common token operations
    // In a real implementation, you would check for other signatures like transferFrom, etc.
    
    return simulationResult;
  }
  
  // Detect ERC20 token transfers
  async detectERC20Transfer(transaction, simulationResult) {
    const tokenAddress = transaction.to;
    
    try {
      // Decode the transfer data
      const iface = new Interface(ERC20_ABI);
      const decodedData = iface.parseTransaction({ data: transaction.data });
      
      if (decodedData.name === 'transfer') {
        const to = decodedData.args[0];
        const amount = decodedData.args[1];
        
        // Get token details
        let symbol = 'Unknown';
        let decimals = 18;
        
        try {
          const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
          symbol = await tokenContract.symbol().catch(() => 'Unknown');
          decimals = await tokenContract.decimals().catch(() => 18);
        } catch (error) {
          defaultLogger.warn(`Failed to get token details: ${error.message}`);
        }
        
        simulationResult.tokenTransfers.push({
          token: tokenAddress,
          symbol,
          from: transaction.from,
          to,
          amount: formatUnits(amount, decimals),
          rawAmount: amount.toString(),
          type: 'ERC20'
        });
      }
    } catch (error) {
      defaultLogger.warn(`Failed to decode ERC20 transfer: ${error.message}`);
    }
  }
  
  // Get token balance changes for an address by analyzing events
  async getTokenBalanceChanges(address, fromBlock, toBlock) {
    if (!address || !isAddress(address)) {
      throw createTransactionError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid address provided',
        { address }
      );
    }
    
    // Convert block parameters to numbers
    fromBlock = fromBlock ? parseInt(fromBlock) : 'latest';
    toBlock = toBlock ? parseInt(toBlock) : 'latest';
    
    const changes = [];
    const tokens = Object.entries(this.tokenAddresses);
    
    // For each token, check for Transfer events involving the address
    for (const [symbol, tokenAddress] of tokens) {
      try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
        
        // Get token decimals
        const decimals = await tokenContract.decimals().catch(() => 18);
        
        // Create filter for Transfer events where the address is sender or receiver
        const filterFrom = tokenContract.filters.Transfer(address, null);
        const filterTo = tokenContract.filters.Transfer(null, address);
        
        // Get events
        const eventsFrom = await tokenContract.queryFilter(filterFrom, fromBlock, toBlock);
        const eventsTo = await tokenContract.queryFilter(filterTo, fromBlock, toBlock);
        
        // Calculate total change
        let totalChange = 0n;
        
        // Outgoing transfers (negative)
        for (const event of eventsFrom) {
          totalChange -= BigInt(event.args.value);
        }
        
        // Incoming transfers (positive)
        for (const event of eventsTo) {
          totalChange += BigInt(event.args.value);
        }
        
        // Only add tokens with changes
        if (totalChange !== 0n) {
          const changeFormatted = formatUnits(totalChange, decimals);
          changes.push({
            token: tokenAddress,
            symbol,
            change: changeFormatted,
            changeType: totalChange > 0n ? 'increase' : 'decrease',
            fromBlock,
            toBlock,
            events: {
              outgoing: eventsFrom.length,
              incoming: eventsTo.length
            }
          });
        }
      } catch (error) {
        defaultLogger.warn(`Failed to get balance changes for ${symbol}: ${error.message}`);
      }
    }
    
    return {
      address,
      fromBlock,
      toBlock,
      changes
    };
  }
  
  // Estimate gas for a transaction
  async estimateGas(transaction) {
    try {
      // Clone the transaction to avoid modifying the original
      const txToEstimate = { ...transaction };
      
      // If from address is not provided, use the connected wallet
      if (!txToEstimate.from && walletManager.isWalletConnected('polygon')) {
        txToEstimate.from = walletManager.getAddress('polygon');
      }
      
      // Estimate gas
      const gasEstimate = await this.provider.estimateGas(txToEstimate);
      
      // Add 20% buffer
      const gasLimit = BigInt(gasEstimate) * 120n / 100n;
      
      return {
        gasEstimate: gasEstimate.toString(),
        gasLimit: gasLimit.toString(),
        recommendedGasLimit: gasLimit.toString()
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.TRANSACTION_FAILED,
        `Gas estimation failed: ${error.message}`,
        { transaction }
      );
    }
  }
}

// module.exports = { TransactionSimulator }; // Remove CJS export
