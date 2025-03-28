# Polygon MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js: v14+](https://img.shields.io/badge/Node.js-v14+-green.svg)](https://nodejs.org/)

A Model Context Protocol (MCP) server that provides seamless integration with the Polygon blockchain network. This server enables AI assistants to interact with Polygon through a standardized interface, offering comprehensive tools for wallet operations, smart contract deployment, L2 bridging, DeFi interactions, and transaction simulation.

## Table of Contents

- [Introduction](#introduction)
- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Security Considerations](#security-considerations)
- [License](#license)

## Introduction

Polygon is a Layer 2 scaling solution for Ethereum that provides faster and cheaper transactions while maintaining Ethereum's security. This MCP server allows AI assistants to interact with the Polygon network, enabling a wide range of blockchain operations through a simple, standardized interface.

The server acts as a bridge between AI systems and the Polygon blockchain, handling the complexities of blockchain interactions and providing a clean, easy-to-use API for common operations.

```
┌─────────────┐     ┌───────────────┐     ┌─────────────────┐
│             │     │               │     │                 │
│  AI System  ├─────┤  Polygon MCP  ├─────┤  Polygon Chain  │
│             │     │    Server     │     │                 │
└─────────────┘     └───────────────┘     └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Polygon wallet private key (for signing transactions)
- RPC endpoints for Polygon Mainnet and Mumbai Testnet

### Installation

1. Clone the repository or download the source code
2. Install dependencies:

```bash
cd polygonmcp
npm install
```

3. Create a `.env` file with the following variables:

```
# Network RPC endpoints
POLYGON_MAINNET_RPC=https://polygon-rpc.com
POLYGON_MUMBAI_RPC=https://rpc-mumbai.maticvigil.com
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# API Keys
POLYGONSCAN_API_KEY=YOUR_POLYGONSCAN_API_KEY

# Wallet (IMPORTANT: Use secure key management in production)
PRIVATE_KEY=your_private_key_here
DEFAULT_NETWORK=mumbai

# DeFi Configuration (Optional)
DEFAULT_SLIPPAGE=0.5
DEFAULT_DEADLINE_MINUTES=20
```

### Running the Server

Start the server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

### First Steps

1. **Check your wallet balance**:
   ```javascript
   const { PolygonMCPServer } = require('./polygon-mcp.js');
   const server = new PolygonMCPServer();
   
   async function checkBalance() {
     server.connectWallet(process.env.PRIVATE_KEY);
     const balances = await server.listBalances();
     console.log('Wallet balances:', balances);
   }
   
   checkBalance().catch(console.error);
   ```

2. **Get testnet MATIC** (Mumbai testnet only):
   ```javascript
   async function getTestMatic() {
     server.connectWallet(process.env.PRIVATE_KEY);
     const result = await server.getTestnetMatic();
     console.log('Faucet result:', result);
   }
   ```

3. **Simulate a transaction**:
   ```javascript
   async function simulateTransaction() {
     server.connectWallet(process.env.PRIVATE_KEY);
     const result = await server.simulateTransaction({
       to: '0x1234...', // Recipient address
       value: '0.01',    // Amount in MATIC
     });
     console.log('Simulation result:', result);
   }
   ```

## Features

### Wallet Operations

| Tool | Description | Example |
|------|-------------|---------|
| `get-address` | Retrieve the current wallet address | `const address = await server.getAddress()` |
| `get-testnet-matic` | Request testnet POL from a faucet (Mumbai testnet only) | `await server.getTestnetMatic()` |
| `list-balances` | List token balances for the connected wallet | `const balances = await server.listBalances()` |
| `transfer-funds` | Transfer POL or ERC20 tokens to another address | `await server.transferFunds('0x1234...', '0.1', 'MATIC')` |

The wallet manager provides:
- Enhanced wallet connection validation
- Support for multiple networks
- Improved error handling with detailed messages
- Secure private key management

### Smart Contract Operations

| Tool | Description | Example |
|------|-------------|---------|
| `deploy-contract` | Deploy a smart contract to Polygon | `await server.deployContract(name, code, args)` |
| `verify-contract` | Verify a deployed contract on Polygonscan | `await server.verifyContract(address, name, code, args)` |
| `list-contract-templates` | List available contract templates | `const templates = await server.listContractTemplates()` |

Supported contract types:
- ERC20 tokens
- ERC721 NFT collections
- ERC1155 multi-tokens
- Staking contracts
- Multisig wallets

### L2 Bridge Operations

| Tool | Description | Example |
|------|-------------|---------|
| `bridge-to-polygon` | Bridge assets from Ethereum to Polygon | `await server.bridgeToPolygon(token, amount)` |
| `bridge-to-ethereum` | Bridge assets from Polygon back to Ethereum | `await server.bridgeToEthereum(token, amount)` |
| `check-bridge-status` | Check the status of a bridge transaction | `const status = await server.checkBridgeStatus(txHash)` |

Features:
- Support for both ETH and ERC20 token bridging
- Standardized MaticPOSClient initialization
- Enhanced error handling for bridge operations
- Checkpoint monitoring

### DeFi Interactions

#### QuickSwap DEX

| Tool | Description | Example |
|------|-------------|---------|
| `swap-tokens` | Swap tokens using QuickSwap | `await server.swapTokens('MATIC', 'USDC', '10')` |
| `get-swap-quote` | Get a price quote for a token swap | `const quote = await server.getSwapQuote('MATIC', 'USDC', '10')` |
| `add-liquidity` | Add liquidity to a QuickSwap pool | `await server.addLiquidity('MATIC', 'USDC', '10', '20')` |

#### Uniswap V3

| Tool | Description | Example |
|------|-------------|---------|
| `uniswapV3SwapSingle` | Execute single-hop swaps | `await server.uniswapV3SwapSingle(tokenIn, tokenOut, amount, fee)` |
| `uniswapV3SwapMulti` | Execute multi-hop swaps | `await server.uniswapV3SwapMulti(path, amounts)` |
| `getUniswapV3QuoteSingle` | Get quotes for single-hop swaps | `const quote = await server.getUniswapV3QuoteSingle(tokenIn, tokenOut, amount, fee)` |
| `getUniswapV3QuoteMulti` | Get quotes for multi-hop swaps | `const quote = await server.getUniswapV3QuoteMulti(path, amount)` |

#### Polymarket Prediction Markets

| Tool | Description | Example |
|------|-------------|---------|
| `getPolymarketInfo` | Get market information | `const info = await server.getPolymarketInfo(marketId)` |
| `placePolymarketBet` | Place bets by buying position tokens | `await server.placePolymarketBet(marketId, outcome, amount)` |
| `getPolymarketPositions` | Get user positions for a market | `const positions = await server.getPolymarketPositions(marketId)` |

### Transaction Simulation

| Tool | Description | Example |
|------|-------------|---------|
| `simulate-transaction` | Simulate a transaction to preview its effects | `const result = await server.simulateTransaction(txParams)` |
| `estimate-gas` | Estimate gas for a transaction | `const gas = await server.estimateGas(txParams)` |

Features:
- Gas estimation with EIP-1559 support
- Token transfer detection and analysis
- Contract interaction simulation
- Enhanced BigInt handling
- Improved error context

### Network Tools

| Tool | Description | Example |
|------|-------------|---------|
| `get-gas-price` | Get current gas prices on Polygon | `const price = await server.getGasPrice()` |
| `switch-network` | Switch between Polygon Mainnet and Mumbai Testnet | `await server.switchNetwork('mainnet')` |

## Architecture

The Polygon MCP Server is built with a modular architecture that separates concerns and promotes maintainability:

```
┌─────────────────────────────────────────────────────────────┐
│                     Polygon MCP Server                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │             │  │             │  │                     │  │
│  │   Wallet    │  │  Contract   │  │  Transaction        │  │
│  │   Manager   │  │  Templates  │  │  Simulator          │  │
│  │             │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │             │  │             │  │                     │  │
│  │   Bridge    │  │    DeFi     │  │  Validation &       │  │
│  │ Operations  │  │ Interactions│  │  Error Handling     │  │
│  │             │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Wallet Manager**: Handles wallet connections, address management, and transaction signing
2. **Contract Templates**: Provides templates for common smart contracts and deployment functionality
3. **Transaction Simulator**: Simulates transactions to preview their effects before execution
4. **Bridge Operations**: Manages asset transfers between Ethereum and Polygon
5. **DeFi Interactions**: Interfaces with various DeFi protocols on Polygon
6. **Validation & Error Handling**: Ensures input validation and proper error reporting

### Data Flow

1. Client requests are received by the MCP server
2. Requests are validated and parameters are checked
3. The appropriate module handles the request
4. Blockchain interactions are performed via ethers.js
5. Results are formatted and returned to the client

## API Reference

### Wallet Operations

#### `connectWallet(privateKey)`
Connects a wallet using the provided private key.

**Parameters:**
- `privateKey` (string): The private key for the wallet

**Returns:** void

#### `getAddress()`
Gets the address of the connected wallet.

**Returns:** string - The wallet address

#### `listBalances()`
Lists all token balances for the connected wallet.

**Returns:** Object - Token balances with symbols as keys

#### `transferFunds(to, amount, token = 'MATIC')`
Transfers funds to another address.

**Parameters:**
- `to` (string): Recipient address
- `amount` (string): Amount to transfer
- `token` (string, optional): Token symbol (default: 'MATIC')

**Returns:** Object - Transaction receipt

### Contract Operations

#### `listContractTemplates()`
Lists available contract templates.

**Returns:** Array - List of available templates

#### `deployContract(name, code, constructorArgs)`
Deploys a contract to the Polygon network.

**Parameters:**
- `name` (string): Contract name
- `code` (string): Contract source code
- `constructorArgs` (Array): Constructor arguments

**Returns:** Object - Deployment result with contract address

#### `verifyContract(address, name, code, constructorArgs)`
Verifies a contract on Polygonscan.

**Parameters:**
- `address` (string): Contract address
- `name` (string): Contract name
- `code` (string): Contract source code
- `constructorArgs` (Array): Constructor arguments

**Returns:** Object - Verification result

### Bridge Operations

#### `bridgeToPolygon(token, amount)`
Bridges assets from Ethereum to Polygon.

**Parameters:**
- `token` (string): Token symbol or address
- `amount` (string): Amount to bridge

**Returns:** Object - Transaction receipt

#### `bridgeToEthereum(token, amount)`
Bridges assets from Polygon back to Ethereum.

**Parameters:**
- `token` (string): Token symbol or address
- `amount` (string): Amount to bridge

**Returns:** Object - Transaction receipt

#### `checkBridgeStatus(txHash)`
Checks the status of a bridge transaction.

**Parameters:**
- `txHash` (string): Transaction hash

**Returns:** Object - Bridge status

## Advanced Usage

### Combining Multiple Operations

```javascript
// Example: Swap tokens and then bridge to Ethereum
async function swapAndBridge() {
  // Connect wallet
  server.connectWallet(process.env.PRIVATE_KEY);
  
  // Swap MATIC to USDC
  const swapResult = await server.swapTokens('MATIC', 'USDC', '10');
  console.log('Swap result:', swapResult);
  
  // Wait for confirmation
  await server.provider.waitForTransaction(swapResult.hash);
  
  // Bridge USDC to Ethereum
  const bridgeResult = await server.bridgeToEthereum('USDC', '10');
  console.log('Bridge result:', bridgeResult);
}
```

### Custom Contract Deployment

```javascript
// Deploy a custom ERC20 token
async function deployCustomToken() {
  server.connectWallet(process.env.PRIVATE_KEY);
  
  // Get the ERC20 template
  const templates = await server.listContractTemplates();
  const erc20Template = templates.find(t => t.id === 'erc20');
  
  // Customize the template
  const customizedCode = erc20Template.code
    .replace('{{name}}', 'MyCustomToken')
    .replace('initialSupply * 10 ** decimals()', '1000000 * 10 ** 18');
  
  // Deploy the contract
  const result = await server.deployContract(
    'MyCustomToken',
    customizedCode,
    ['MyCustomToken', 'MCT', 1000000]
  );
  
  console.log('Contract deployed at:', result.address);
  
  // Verify the contract
  const verification = await server.verifyContract(
    result.address,
    'MyCustomToken',
    customizedCode,
    ['MyCustomToken', 'MCT', 1000000]
  );
  
  console.log('Verification result:', verification);
}
```

### Transaction Simulation for Security

```javascript
// Simulate a transaction before executing it
async function safeTransfer() {
  server.connectWallet(process.env.PRIVATE_KEY);
  
  const tx = {
    to: '0x1234...',
    value: ethers.utils.parseEther('1.0'),
    data: '0x'
  };
  
  // Simulate first
  const simulation = await server.simulateTransaction(tx);
  
  // Check for issues
  if (!simulation.success) {
    console.error('Transaction would fail:', simulation.errorMessage);
    return;
  }
  
  // Check gas costs
  console.log('Estimated gas cost:', simulation.gasCost.ether, 'MATIC');
  
  // Execute if simulation was successful
  const wallet = server.getWallet();
  const result = await wallet.sendTransaction(tx);
  console.log('Transaction sent:', result.hash);
}
```

## Troubleshooting

### Common Issues

#### "Wallet not connected" Error
Make sure you've called `connectWallet()` before any operation that requires a wallet.

```javascript
server.connectWallet(process.env.PRIVATE_KEY);
```

#### RPC Connection Issues
If you're experiencing RPC connection issues, try:
1. Checking your internet connection
2. Verifying your RPC endpoint URLs in the `.env` file
3. Using a different RPC provider

#### Insufficient Funds
For operations that require gas fees, ensure your wallet has enough MATIC:

```javascript
const balances = await server.listBalances();
console.log('MATIC balance:', balances.MATIC);
```

#### Transaction Failures
Use the transaction simulator to diagnose issues before sending:

```javascript
const simulation = await server.simulateTransaction(tx);
if (!simulation.success) {
  console.error('Transaction would fail:', simulation.errorMessage);
}
```

### Debugging

Enable debug logging by setting the environment variable:

```
DEBUG=polygon-mcp:*
```

## Contributing

Contributions are welcome! Here's how you can contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env.test` file with test credentials
4. Run tests: `npm test`
5. Run linting: `npm run lint`

## Security Considerations

This server handles private keys and sensitive blockchain operations. For production use:

1. Never store private keys in code or environment variables
2. Use a secure key management system or hardware wallet integration
3. Implement proper authentication and authorization
4. Add rate limiting to prevent abuse
5. Add comprehensive logging and monitoring
6. Validate all input parameters
7. Implement proper error handling
8. Use secure configuration management

## MCP Integration

### Adding to MCP Settings

To use this server with Claude or other MCP-compatible systems, add it to your MCP settings configuration file:

For Cursor/Claude Dev:
```json
{
  "mcpServers": {
    "polygon": {
      "command": "node",
      "args": ["path/to/polygon-mcp.js"],
      "env": {
        "POLYGON_MAINNET_RPC": "https://polygon-rpc.com",
        "POLYGON_MUMBAI_RPC": "https://rpc-mumbai.maticvigil.com",
        "ETHEREUM_RPC_URL": "https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY",
        "POLYGONSCAN_API_KEY": "YOUR_POLYGONSCAN_API_KEY",
        "PRIVATE_KEY": "your_private_key_here",
        "DEFAULT_NETWORK": "mumbai",
        "DEFAULT_SLIPPAGE": "0.5",
        "DEFAULT_DEADLINE_MINUTES": "20"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Project Structure

- `polygon-mcp.js` - Main server implementation
- `bridge-operations.js` - L2 bridge operations
- `contract-templates.js` - Contract deployment templates
- `defi-interactions.js` - DeFi protocol interactions
- `transaction-simulation.js` - Transaction simulation
- `logger.js` - Structured logging
- `errors.js` - Custom error handling
- `validation.js` - Input validation utilities
- `common/` - Shared utilities and constants
  - `config-manager.js` - Configuration management
  - `constants.js` - Shared constants
  - `wallet-manager.js` - Wallet management

## License

This project is licensed under the MIT License - see the LICENSE file for details.
