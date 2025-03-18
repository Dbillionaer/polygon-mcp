# Polygon MCP Server

A Model Context Protocol (MCP) server for interacting with the Polygon blockchain network. This server provides tools for wallet operations, contract deployment, L2 bridging, DeFi interactions, and transaction simulation.

## Features

### Wallet Tools
- `get-address`: Retrieve the current wallet address
- `get-testnet-matic`: Request testnet POL from a faucet (Mumbai testnet only)
- `list-balances`: List token balances for the connected wallet
- `transfer-funds`: Transfer POL or ERC20 tokens to another address

### Contract Tools
- `deploy-contract`: Deploy a smart contract to the Polygon network
- `verify-contract`: Verify a deployed contract on Polygonscan
- `list-contract-templates`: List available contract templates for deployment
- Support for ERC20, ERC721, and ERC1155 token standards

### L2 Bridge Tools
- `bridge-to-polygon`: Bridge assets from Ethereum to Polygon
- `bridge-to-ethereum`: Bridge assets from Polygon back to Ethereum
- `check-bridge-status`: Check the status of a bridge transaction
- Support for both ETH and ERC20 token bridging

### DeFi Tools
- `swap-tokens`: Swap tokens using QuickSwap
- `get-swap-quote`: Get a price quote for a token swap
- `add-liquidity`: Add liquidity to a QuickSwap pool
- `aave-deposit`: Deposit assets into Aave lending protocol
- `aave-withdraw`: Withdraw assets from Aave lending protocol

### Simulation Tools
- `simulate-transaction`: Simulate a transaction to preview its effects
- Gas estimation with EIP-1559 support
- Token transfer detection and analysis
- Contract interaction simulation

### Network Tools
- `get-gas-price`: Get current gas prices on Polygon
- `switch-network`: Switch between Polygon Mainnet and Mumbai Testnet

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Polygon wallet private key (for signing transactions)
- RPC endpoints for Polygon Mainnet and Mumbai Testnet

### Installation

1. Clone the repository or download the source code
2. Install dependencies:

```bash
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

## MCP Integration

### Adding to MCP Settings

To use this server with Claude or other MCP-compatible systems, add it to your MCP settings configuration file:

For Cursor/Claude Dev:
```json
{
  "mcpServers": {
    "polygon": {
      "command": "node",
      "args": ["path/to/polygon MCP.js"],
      "env": {
        "POLYGON_MAINNET_RPC": "https://polygon-rpc.com",
        "POLYGON_MUMBAI_RPC": "https://rpc-mumbai.maticvigil.com",
        "ETHEREUM_RPC_URL": "https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY",
        "POLYGONSCAN_API_KEY": "YOUR_POLYGONSCAN_API_KEY",
        "PRIVATE_KEY": "your_private_key_here",
        "DEFAULT_NETWORK": "mumbai"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Technical Details

### Dependencies
- ethers v6.13.5 for Ethereum interactions
- @maticnetwork/maticjs v2.0.0 for Polygon bridge operations
- @maticnetwork/maticjs-web3 v1.0.0 for Web3 compatibility

### Key Features
- Full support for EIP-1559 gas fee mechanism
- BigInt support for large numbers
- Robust input validation
- Comprehensive error handling
- Structured logging system

## Security Considerations

This server handles private keys and sensitive blockchain operations. For production use:

1. Never store private keys in code or environment variables
2. Use a secure key management system or hardware wallet integration
3. Implement proper authentication and authorization
4. Add rate limiting to prevent abuse
5. Add comprehensive logging and monitoring

## Project Structure

- `polygon MCP.js` - Main server implementation
- `bridge-operations.js` - L2 bridge operations
- `contract-templates.js` - Contract deployment templates
- `defi-interactions.js` - DeFi protocol interactions
- `transaction-simulation.js` - Transaction simulation
- `logger.js` - Structured logging
- `errors.js` - Custom error handling
- `validation.js` - Input validation utilities

## License

MIT
