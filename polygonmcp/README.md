# Polygon MCP Server

A Model Context Protocol (MCP) server for interacting with the Polygon blockchain network. This server provides tools for wallet operations, contract deployment, L2 bridging, DeFi interactions, and transaction simulation.

## Features

### Wallet Tools
- `get-address`: Retrieve the current wallet address
- `get-testnet-matic`: Request testnet POL from a faucet (Mumbai testnet only)
- `list-balances`: List token balances for the connected wallet, including POL
- `transfer-funds`: Transfer POL or ERC20 tokens to another address
- Enhanced wallet connection validation
- Improved error handling with detailed messages

### Contract Tools
- `deploy-contract`: Deploy a smart contract to the Polygon network
- `verify-contract`: Verify a deployed contract on Polygonscan
- `list-contract-templates`: List available contract templates for deployment
- Support for ERC20, ERC721, and ERC1155 token standards
- Comprehensive input parameter validation

### L2 Bridge Tools
- `bridge-to-polygon`: Bridge assets from Ethereum to Polygon
- `bridge-to-ethereum`: Bridge assets from Polygon back to Ethereum
- `check-bridge-status`: Check the status of a bridge transaction
- Support for both ETH and ERC20 token bridging
- Standardized MaticPOSClient initialization
- Enhanced error handling for bridge operations

### DeFi Tools
- QuickSwap DEX interactions:
  - `swap-tokens`: Swap tokens using QuickSwap
  - `get-swap-quote`: Get a price quote for a token swap
  - `add-liquidity`: Add liquidity to a QuickSwap pool
- Uniswap V2 interactions:
  - `uniswapV2Swap`: Execute token swaps
  - `getUniswapV2Quote`: Get price quotes for token swaps
  - `addUniswapV2Liquidity`: Add liquidity to V2 pools
  - `removeUniswapV2Liquidity`: Remove liquidity from V2 pools
- Uniswap V3 interactions:
  - `uniswapV3SwapSingle`: Execute single-hop swaps
  - `uniswapV3SwapMulti`: Execute multi-hop swaps
  - `getUniswapV3QuoteSingle`: Get quotes for single-hop swaps
  - `getUniswapV3QuoteMulti`: Get quotes for multi-hop swaps
- Polymarket prediction market interactions:
  - `getPolymarketInfo`: Get comprehensive market information
  - `getPolymarketPositionPrice`: Get position token prices
  - `placePolymarketBet`: Place bets by buying position tokens
  - `sellPolymarketPosition`: Sell position tokens back to market
  - `getPolymarketPositions`: Get user positions for a market
  - `getPolymarketOutcomes`: Get detailed market outcomes and prices
- Configurable slippage protection
- Customizable transaction deadlines
- Gas limit optimization

### Simulation Tools
- `simulate-transaction`: Simulate a transaction to preview its effects
- Gas estimation with EIP-1559 support
- Token transfer detection and analysis
- Contract interaction simulation
- Enhanced BigInt handling
- Improved error context

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

## Technical Details

### Dependencies
- @modelcontextprotocol/sdk v1.7.0 for MCP protocol interactions
- @maticnetwork/maticjs v3.6.0 for Polygon chain interactions
- ethers v6.13.5 for Ethereum interactions
- zod for runtime type validation
- axios for HTTP requests
- Additional utility packages for enhanced functionality

### Key Features
- Full support for POL (Polygon's native token)
- Full support for EIP-1559 gas fee mechanism
- BigInt support for large numbers
- Robust input validation
- Comprehensive error handling with detailed context
- Structured logging system
- Support for multiple DeFi protocols (QuickSwap, Uniswap V2, Uniswap V3, Polymarket)
- Configurable slippage protection
- Automatic token approvals
- Multi-hop trading support
- Enhanced security measures
- Improved error reporting

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
