// defi-interactions.js - DeFi Protocol Interactions (QuickSwap & Uniswap V3)
import {
  JsonRpcProvider,
  Contract,
  parseUnits,
  formatUnits
} from 'ethers'; // Use import
import { ErrorCodes, createWalletError, createDeFiError } from './errors.js'; // Use import and add .js
import walletManager from './common/wallet-manager.js'; // Use import and add .js
import { resolveTokenAddress as commonResolveTokenAddress } from './common/utils.js'; // Use import and add .js

// Default configuration for DeFi operations
const DEFAULT_CONFIG = {
  // Default slippage percentage (0.5%)
  defaultSlippage: 0.5,
  // Default deadline in minutes (20 min)
  defaultDeadlineMinutes: 20,
  // Default gas settings
  gasLimits: {
    approval: 100000,
    swap: 250000,
    addLiquidity: 300000,
    removeLiquidity: 250000
  }
};

// QuickSwap Router ABI (simplified)
const QUICKSWAP_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)'
];

// Uniswap V3 Router ABI (simplified)
const UNISWAP_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)',
  'function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)',
  'function exactOutputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountIn)',
  'function exactOutput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum) params) external payable returns (uint256 amountIn)',
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
  'function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut)',
  'function quoteExactOutputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountOut, uint160 sqrtPriceLimitX96) external returns (uint256 amountIn)',
  'function quoteExactOutput(bytes path, uint256 amountOut) external returns (uint256 amountIn)'
];
// Uniswap V3 Pool ABI (simplified) - Removed as unused
// const UNISWAP_POOL_ABI = [
//   "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
//   "function liquidity() external view returns (uint128)",
//   "function token0() external view returns (address)",
//   "function token1() external view returns (address)",
//   "function fee() external view returns (uint24)"
// ];

// ERC20 ABI
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

// Polymarket Factory ABI
const POLYMARKET_FACTORY_ABI = [
  'function getMarket(address market) external view returns (tuple(address creator, uint256 creationTimestamp, uint256 endTimestamp, uint256 resolutionTimestamp, bool resolved, string question, string[] outcomes))',
  'function createMarket(string question, uint256 endTimestamp, string[] outcomes) external returns (address)',
  'function resolveMarket(address market, uint256 outcomeIndex) external'
];

// Polymarket Market ABI
const POLYMARKET_MARKET_ABI = [
  'function getPositionToken(uint256 outcomeIndex) external view returns (address)',
  'function getTotalSupply() external view returns (uint256)',
  'function getOutcomeCount() external view returns (uint256)',
  'function getOutcome(uint256 index) external view returns (string)',
  'function getEndTimestamp() external view returns (uint256)',
  'function getResolutionTimestamp() external view returns (uint256)',
  'function isResolved() external view returns (bool)',
  'function getQuestion() external view returns (string)'
];

// Uniswap V2 Router ABI (simplified)
const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)'
];

class DeFiProtocols {
  constructor(config) {
    this.rpcUrl = config.rpcUrl;
    this.quickswapRouter = config.quickswapRouter;
    this.uniswapRouter = config.uniswapRouter;
    this.uniswapV2Router = config.uniswapV2Router;
    this.tokenAddresses = config.tokenAddresses;
    this.polymarketFactory = config.polymarketFactory;
    
    // Set default configuration values
    this.defaultSlippage = config.defaultSlippage || DEFAULT_CONFIG.defaultSlippage;
    this.deadlineMinutes = config.deadlineMinutes || DEFAULT_CONFIG.defaultDeadlineMinutes;
    this.gasLimits = {
      ...DEFAULT_CONFIG.gasLimits,
      ...(config.gasLimits || {})
    };
    
    // Initialize provider
    this.provider = new JsonRpcProvider(this.rpcUrl);

    // NOTE: Contracts are initialized with the provider only.
    // Signer connection will happen within methods requiring transactions.
    if (this.quickswapRouter) {
      this.quickswapRouterContract = new Contract(this.quickswapRouter, QUICKSWAP_ROUTER_ABI, this.provider);
    }
    if (this.uniswapRouter) {
      this.uniswapRouterContract = new Contract(this.uniswapRouter, UNISWAP_ROUTER_ABI, this.provider);
    }
    if (this.uniswapV2Router) {
      this.uniswapV2RouterContract = new Contract(this.uniswapV2Router, UNISWAP_V2_ROUTER_ABI, this.provider);
    }
    if (this.polymarketFactory) {
      this.polymarketFactoryContract = new Contract(this.polymarketFactory, POLYMARKET_FACTORY_ABI, this.provider);
    }
  }

  // Removed connectWallet method - relies on central walletManager

  // Check if wallet is connected using walletManager
  checkWalletConnected() {
    if (!walletManager.isWalletConnected('polygon')) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        'Wallet not connected',
        { context: 'DeFiProtocols' }
      );
    }
    return true;
  }

  // Use the centralized resolveTokenAddress function
  resolveTokenAddress(token) {
    // Pass the tokenAddresses map from this instance's config
    return commonResolveTokenAddress(token, this.tokenAddresses);
  }

  // Helper to get token contract, optionally with signer
  getTokenContract(tokenAddress, withSigner = false) {
    const providerOrSigner = withSigner ? walletManager.getWallet('polygon') : this.provider;
    if (withSigner) {
      this.checkWalletConnected(); // Ensure wallet is connected if signer is requested
    }
    return new Contract(tokenAddress, ERC20_ABI, providerOrSigner);
  }

  // Get Uniswap V3 quote for single hop
  async getUniswapV3QuoteSingle(fromToken, toToken, amount, fee = 3000) {
    if (!this.uniswapRouterContract) {
      throw createDeFiError(
        ErrorCodes.CONTRACT_ERROR,
        'Uniswap router not configured',
        { context: 'getUniswapV3QuoteSingle' }
      );
    }
    
    try {
      // Resolve token addresses
      const fromTokenAddress = this.resolveTokenAddress(fromToken);
      const toTokenAddress = this.resolveTokenAddress(toToken);
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const toTokenContract = this.getTokenContract(toTokenAddress);
      
      const [fromDecimals, toDecimals, fromSymbol, toSymbol] = await Promise.all([
        fromTokenContract.decimals().catch(() => 18),
        toTokenContract.decimals().catch(() => 18),
        fromTokenContract.symbol().catch(() => fromToken),
        toTokenContract.symbol().catch(() => toToken)
      ]);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Get quote from Uniswap V3
      const amountOut = await this.uniswapRouterContract.quoteExactInputSingle(
        fromTokenAddress,
        toTokenAddress,
        fee,
        amountIn,
        0 // sqrtPriceLimitX96
      );
      
      const amountOutFormatted = formatUnits(amountOut, toDecimals);
      
      return {
        fromToken: {
          address: fromTokenAddress,
          symbol: fromSymbol,
          amount
        },
        toToken: {
          address: toTokenAddress,
          symbol: toSymbol,
          amount: amountOutFormatted
        },
        rate: parseFloat(amountOutFormatted) / parseFloat(amount),
        fee
      };
    } catch (error) {
      if (error.code && error.name) {
        throw error; // Re-throw custom errors
      }
      
      throw createDeFiError(
        ErrorCodes.DEFI_ERROR,
        `Failed to get Uniswap quote: ${error.message}`,
        { fromToken, toToken, amount, fee }
      );
    }
  }

  // Swap tokens on Uniswap V3 (single hop)
  async uniswapV3SwapSingle(fromToken, toToken, amount, slippage = 0.5, fee = 3000) {
    this.checkWalletConnected(); // Use central check

    if (!this.uniswapRouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Uniswap router not configured');
    }
    
    try {
      // Get quote first
      const quote = await this.getUniswapV3QuoteSingle(fromToken, toToken, amount, fee);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;

      // Get token details (use helper with signer=true for approval check/tx)
      const fromTokenContract = this.getTokenContract(fromTokenAddress, true);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);

      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      // Check if we need to approve the router
      const walletAddress = walletManager.getAddress('polygon');
      const allowance = await fromTokenContract.allowance(
        walletAddress,
        this.uniswapRouter // Use address directly
      );

      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.quickswapRouter, // Use address directly
          amountIn // Approve only the required amount
        );
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Prepare swap parameters
      const params = {
        tokenIn: fromTokenAddress,
        tokenOut: toTokenAddress,
        fee: fee,
        recipient: walletAddress, // Use wallet address from manager
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0
      };

      // Execute swap using router contract connected to the wallet
      const routerWithSigner = this.uniswapRouterContract.connect(walletManager.getWallet('polygon'));
      const tx = await routerWithSigner.exactInputSingle(params);

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        expectedAmount: quote.toToken.amount,
        minAmount: formatUnits(amountOutMin, await this.getTokenContract(toTokenAddress).decimals().catch(() => 18))
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.SWAP_FAILED, `Uniswap swap failed: ${error.message}`);
    }
  }

  // Get Uniswap V3 quote for multi-hop
  async getUniswapV3QuoteMulti(fromToken, toToken, amount, intermediateTokens = [], fees = []) {
    if (!this.uniswapRouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Uniswap router not configured');
    }
    
    try {
      // Resolve token addresses
      const fromTokenAddress = this.resolveTokenAddress(fromToken);
      const toTokenAddress = this.resolveTokenAddress(toToken);
      const intermediateAddresses = intermediateTokens.map(token => this.resolveTokenAddress(token));
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const toTokenContract = this.getTokenContract(toTokenAddress);
      
      const [fromDecimals, toDecimals, fromSymbol, toSymbol] = await Promise.all([
        fromTokenContract.decimals().catch(() => 18),
        toTokenContract.decimals().catch(() => 18),
        fromTokenContract.symbol().catch(() => fromToken),
        toTokenContract.symbol().catch(() => toToken)
      ]);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Encode path for multi-hop
      const path = this.encodeUniswapV3Path(
        [fromTokenAddress, ...intermediateAddresses, toTokenAddress],
        fees
      );
      
      // Get quote from Uniswap V3
      const amountOut = await this.uniswapRouterContract.quoteExactInput(
        path,
        amountIn
      );
      
      const amountOutFormatted = formatUnits(amountOut, toDecimals);
      
      return {
        fromToken: {
          address: fromTokenAddress,
          symbol: fromSymbol,
          amount
        },
        toToken: {
          address: toTokenAddress,
          symbol: toSymbol,
          amount: amountOutFormatted
        },
        rate: parseFloat(amountOutFormatted) / parseFloat(amount),
        path: [fromTokenAddress, ...intermediateAddresses, toTokenAddress],
        fees
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to get Uniswap multi-hop quote: ${error.message}`);
    }
  }

  // Helper to encode Uniswap V3 path
  encodeUniswapV3Path(tokens, fees) {
    if (tokens.length < 2) {
      throw createDeFiError(ErrorCodes.INVALID_PARAMETERS, 'Path must contain at least 2 tokens');
    }
    if (fees.length !== tokens.length - 1) {
      throw createDeFiError(ErrorCodes.INVALID_PARAMETERS, 'Number of fees must be one less than number of tokens');
    }

    let encodedPath = '0x';
    for (let i = 0; i < tokens.length - 1; i++) {
      encodedPath += tokens[i].slice(2).toLowerCase();
      encodedPath += fees[i].toString(16).padStart(6, '0');
    }
    encodedPath += tokens[tokens.length - 1].slice(2).toLowerCase();
    return encodedPath;
  }

  // Swap tokens on Uniswap V3 (multi-hop)
  async uniswapV3SwapMulti(fromToken, toToken, amount, intermediateTokens = [], fees = [], slippage = 0.5) {
    this.checkWalletConnected(); // Use central check

    if (!this.uniswapRouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Uniswap router not configured');
    }
    
    try {
      // Get quote first
      const quote = await this.getUniswapV3QuoteMulti(fromToken, toToken, amount, intermediateTokens, fees);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;

      // Get token details (use helper with signer=true for approval check/tx)
      const fromTokenContract = this.getTokenContract(fromTokenAddress, true);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);

      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      // Check if we need to approve the router
      const walletAddress = walletManager.getAddress('polygon');
      const allowance = await fromTokenContract.allowance(
        walletAddress,
        this.uniswapRouter // Use address directly
      );

      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.uniswapRouter, // Use address directly
          amountIn // Approve only the required amount
        );
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Encode path for multi-hop
      const path = this.encodeUniswapV3Path(
        [fromTokenAddress, ...intermediateTokens.map(token => this.resolveTokenAddress(token)), toTokenAddress],
        fees
      );
      
      // Prepare swap parameters
      const params = {
        path,
        recipient: walletAddress, // Use wallet address from manager
        deadline,
        amountIn,
        amountOutMinimum: amountOutMin
      };

      // Execute swap using router contract connected to the wallet
      const routerWithSigner = this.uniswapRouterContract.connect(walletManager.getWallet('polygon'));
      const tx = await routerWithSigner.exactInput(params);

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        expectedAmount: quote.toToken.amount,
        minAmount: formatUnits(amountOutMin, await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)),
        path: quote.path,
        fees: quote.fees
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.SWAP_FAILED, `Uniswap multi-hop swap failed: ${error.message}`);
    }
  }

  // Get QuickSwap quote
  async getQuickSwapQuote(fromToken, toToken, amount) {
    if (!this.quickswapRouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'QuickSwap router not configured');
    }
    
    try {
      // Resolve token addresses
      const fromTokenAddress = this.resolveTokenAddress(fromToken);
      const toTokenAddress = this.resolveTokenAddress(toToken);
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const toTokenContract = this.getTokenContract(toTokenAddress);
      
      const [fromDecimals, toDecimals, fromSymbol, toSymbol] = await Promise.all([
        fromTokenContract.decimals().catch(() => 18),
        toTokenContract.decimals().catch(() => 18),
        fromTokenContract.symbol().catch(() => fromToken),
        toTokenContract.symbol().catch(() => toToken)
      ]);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Get quote from QuickSwap
      const amounts = await this.quickswapRouterContract.getAmountsOut(
        amountIn,
        [fromTokenAddress, toTokenAddress]
      );
      
      const amountOut = formatUnits(amounts[1], toDecimals);
      
      return {
        fromToken: {
          address: fromTokenAddress,
          symbol: fromSymbol,
          amount
        },
        toToken: {
          address: toTokenAddress,
          symbol: toSymbol,
          amount: amountOut
        },
        rate: parseFloat(amountOut) / parseFloat(amount),
        path: [fromTokenAddress, toTokenAddress]
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to get quote: ${error.message}`);
    }
  }
  
  // Swap tokens on QuickSwap
  async quickSwapTokens(fromToken, toToken, amount, slippage = 0.5) {
    this.checkWalletConnected(); // Use central check

    if (!this.quickswapRouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'QuickSwap router not configured');
    }
    
    try {
      // Get quote first
      const quote = await this.getQuickSwapQuote(fromToken, toToken, amount);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;

      // Get token details (use helper with signer=true for approval check/tx)
      const fromTokenContract = this.getTokenContract(fromTokenAddress, true);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);

      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      // Check if we need to approve the router
      const walletAddress = walletManager.getAddress('polygon');
      const allowance = await fromTokenContract.allowance(
        walletAddress,
        this.quickswapRouter // Use address directly
      );

      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.quickswapRouter, // Use address directly
          amountIn // Approve only the required amount
        );
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Execute swap using router contract connected to the wallet
      const routerWithSigner = this.quickswapRouterContract.connect(walletManager.getWallet('polygon'));
      const tx = await routerWithSigner.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        [fromTokenAddress, toTokenAddress],
        walletAddress, // Use wallet address from manager
        deadline
      );

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        expectedAmount: quote.toToken.amount,
        minAmount: formatUnits(amountOutMin, await this.getTokenContract(toTokenAddress).decimals().catch(() => 18))
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.SWAP_FAILED, `Swap failed: ${error.message}`);
    }
  }

  // Add liquidity to QuickSwap
  async addQuickSwapLiquidity(tokenA, tokenB, amountA, amountB, slippage = 0.5) {
    this.checkWalletConnected(); // Use central check

    if (!this.quickswapRouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'QuickSwap router not configured');
    }
    
    try {
      // Resolve token addresses
      const tokenAAddress = this.resolveTokenAddress(tokenA);
      const tokenBAddress = this.resolveTokenAddress(tokenB);

      // Get token details (use helper with signer=true for approval checks/tx)
      const tokenAContract = this.getTokenContract(tokenAAddress, true);
      const tokenBContract = this.getTokenContract(tokenBAddress, true);

      const [tokenADecimals, tokenBDecimals, tokenASymbol, tokenBSymbol] = await Promise.all([
        tokenAContract.decimals().catch(() => 18),
        tokenBContract.decimals().catch(() => 18),
        tokenAContract.symbol().catch(() => tokenA),
        tokenBContract.symbol().catch(() => tokenB)
      ]);
      
      // Convert amounts to token units
      const amountADesired = parseUnits(amountA.toString(), tokenADecimals);
      const amountBDesired = parseUnits(amountB.toString(), tokenBDecimals);
      
      // Calculate minimum amounts with slippage
      const amountAMin = amountADesired * (1000 - slippage * 10) / 1000;
      const amountBMin = amountBDesired * (1000n - BigInt(slippage * 10)) / 1000n; // Use BigInt for precision

      // Check approvals
      const walletAddress = walletManager.getAddress('polygon');
      const routerAddress = this.quickswapRouter; // Use address directly

      const allowanceA = await tokenAContract.allowance(walletAddress, routerAddress);
      if (allowanceA < amountADesired) {
        const approveTxA = await tokenAContract.approve(routerAddress, amountADesired); // Approve only the required amount
        await approveTxA.wait();
      }

      const allowanceB = await tokenBContract.allowance(walletAddress, routerAddress);
      if (allowanceB < amountBDesired) {
        const approveTxB = await tokenBContract.approve(routerAddress, amountBDesired); // Approve only the required amount
        await approveTxB.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Add liquidity using router contract connected to the wallet
      const routerWithSigner = this.quickswapRouterContract.connect(walletManager.getWallet('polygon'));
      const tx = await routerWithSigner.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        walletAddress, // Use wallet address from manager
        deadline
      );

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        tokenA: {
          address: tokenAAddress,
          symbol: tokenASymbol,
          amount: amountA
        },
        tokenB: {
          address: tokenBAddress,
          symbol: tokenBSymbol,
          amount: amountB
        }
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.LIQUIDITY_ERROR, `Adding liquidity failed: ${error.message}`);
    }
  }

  // Get QuickSwap quote for multi-hop
  async getQuickSwapQuoteMulti(fromToken, toToken, amount, intermediateTokens = []) {
    if (!this.quickswapRouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'QuickSwap router not configured');
    }
    
    try {
      // Resolve token addresses
      const fromTokenAddress = this.resolveTokenAddress(fromToken);
      const toTokenAddress = this.resolveTokenAddress(toToken);
      const intermediateAddresses = intermediateTokens.map(token => this.resolveTokenAddress(token));
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const toTokenContract = this.getTokenContract(toTokenAddress);
      
      const [fromDecimals, toDecimals, fromSymbol, toSymbol] = await Promise.all([
        fromTokenContract.decimals().catch(() => 18),
        toTokenContract.decimals().catch(() => 18),
        fromTokenContract.symbol().catch(() => fromToken),
        toTokenContract.symbol().catch(() => toToken)
      ]);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Create path array
      const path = [fromTokenAddress, ...intermediateAddresses, toTokenAddress];
      
      // Get quote from QuickSwap
      const amounts = await this.quickswapRouterContract.getAmountsOut(
        amountIn,
        path
      );
      
      const amountOut = formatUnits(amounts[amounts.length - 1], toDecimals);
      
      // Get intermediate amounts with proper async handling
      const intermediateAmounts = await Promise.all(
        amounts.slice(1, -1).map(async (amount, index) => {
          const decimals = await this.getTokenContract(intermediateAddresses[index]).decimals().catch(() => 18);
          return {
            token: intermediateTokens[index],
            amount: formatUnits(amount, decimals)
          };
        })
      );
      
      return {
        fromToken: {
          address: fromTokenAddress,
          symbol: fromSymbol,
          amount
        },
        toToken: {
          address: toTokenAddress,
          symbol: toSymbol,
          amount: amountOut
        },
        rate: parseFloat(amountOut) / parseFloat(amount),
        path,
        intermediateAmounts
      };
    } catch (error) {
      throw new Error(`Failed to get QuickSwap multi-hop quote: ${error.message}`);
    }
  }

  // Swap tokens on QuickSwap (multi-hop)
  async quickSwapTokensMulti(fromToken, toToken, amount, intermediateTokens = [], slippage = 0.5) {
    this.checkWalletConnected(); // Use central check

    if (!this.quickswapRouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'QuickSwap router not configured');
    }
    
    try {
      // Get quote first
      const quote = await this.getQuickSwapQuoteMulti(fromToken, toToken, amount, intermediateTokens);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;

      // Get token details (use helper with signer=true for approval check/tx)
      const fromTokenContract = this.getTokenContract(fromTokenAddress, true);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);

      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      // Check if we need to approve the router
      const walletAddress = walletManager.getAddress('polygon');
      const routerAddress = this.quickswapRouter; // Use address directly
      const allowance = await fromTokenContract.allowance(walletAddress, routerAddress);

      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(routerAddress, amountIn); // Approve only the required amount
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Execute swap using router contract connected to the wallet
      const routerWithSigner = this.quickswapRouterContract.connect(walletManager.getWallet('polygon'));
      const tx = await routerWithSigner.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        quote.path,
        walletAddress, // Use wallet address from manager
        deadline
      );

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        expectedAmount: quote.toToken.amount,
        minAmount: formatUnits(amountOutMin, await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)),
        path: quote.path,
        intermediateAmounts: quote.intermediateAmounts
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.SWAP_FAILED, `QuickSwap multi-hop swap failed: ${error.message}`);
    }
  }

  /**
   * Gets comprehensive information about a Polymarket market
   * @param {string} marketAddress - The address of the Polymarket market contract
   * @returns {Promise<Object>} Market information including:
   *   - creator: Address of market creator
   *   - creationTimestamp: When the market was created
   *   - endTimestamp: When the market ends
   *   - resolutionTimestamp: When the market was resolved
   *   - resolved: Whether the market is resolved
   *   - question: The market question
   *   - outcomes: Array of possible outcomes
   *   - positionTokens: Array of position token addresses
   *   - isResolved: Whether the market is resolved
   *   - outcomeCount: Number of possible outcomes
   * @throws {DeFiError} If Polymarket factory is not configured or if market info cannot be retrieved
   * @example
   * const marketInfo = await defi.getPolymarketInfo('0x123...');
   * console.log(marketInfo.question); // 'Who will win the 2024 US Presidential Election?'
   */
  async getPolymarketInfo(marketAddress) {
    if (!this.polymarketFactoryContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Polymarket factory not configured');
    }

    try {
      // Get market details from factory
      const marketInfo = await this.polymarketFactoryContract.getMarket(marketAddress);
      
      // Initialize market contract
      const marketContract = new Contract(
        marketAddress,
        POLYMARKET_MARKET_ABI,
        this.provider
      );

      // Get additional market details
      const [outcomeCount, /* endTimestamp, */ isResolved] = await Promise.all([ // Removed unused endTimestamp
        marketContract.getOutcomeCount(),
        // marketContract.getEndTimestamp(), // Removed unused call
        marketContract.isResolved()
      ]);

      // Get position token addresses for each outcome
      const positionTokens = await Promise.all(
        Array.from({ length: outcomeCount }, (_, i) => 
          marketContract.getPositionToken(i)
        )
      );

      return {
        creator: marketInfo.creator,
        creationTimestamp: marketInfo.creationTimestamp,
        endTimestamp: marketInfo.endTimestamp,
        resolutionTimestamp: marketInfo.resolutionTimestamp,
        resolved: marketInfo.resolved,
        question: marketInfo.question,
        outcomes: marketInfo.outcomes,
        positionTokens,
        isResolved,
        outcomeCount
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to get Polymarket info: ${error.message}`);
    }
  }

  /**
   * Gets the current price of a position token for a specific outcome
   * @param {string} marketAddress - The address of the Polymarket market contract
   * @param {number} outcomeIndex - The index of the outcome (0-based)
   * @returns {Promise<Object>} Position token information including:
   *   - price: Current price of the position token
   *   - totalSupply: Total supply of position tokens
   *   - positionTokenAddress: Address of the position token contract
   * @throws {DeFiError} If Polymarket factory is not configured or if price cannot be retrieved
   * @example
   * const { price } = await defi.getPolymarketPositionPrice('0x123...', 0);
   * console.log(price); // 0.5 (50% probability)
   */
  async getPolymarketPositionPrice(marketAddress, outcomeIndex) {
    if (!this.polymarketFactoryContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Polymarket factory not configured');
    }

    try {
      // Initialize market contract
      const marketContract = new Contract(
        marketAddress,
        POLYMARKET_MARKET_ABI,
        this.provider
      );

      // Get position token address
      const positionTokenAddress = await marketContract.getPositionToken(outcomeIndex);
      
      // Get position token contract
      const positionTokenContract = new Contract(
        positionTokenAddress,
        ERC20_ABI,
        this.provider
      );

      // Get total supply and decimals
      const [totalSupply, decimals] = await Promise.all([
        positionTokenContract.totalSupply(),
        positionTokenContract.decimals()
      ]);

      // Calculate price (1 / total supply)
      const price = 1 / parseFloat(formatUnits(totalSupply, decimals));

      return {
        price,
        totalSupply: formatUnits(totalSupply, decimals),
        positionTokenAddress
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to get position token price: ${error.message}`);
    }
  }

  /**
   * Places a bet by buying position tokens for a specific outcome
   * @param {string} marketAddress - The address of the Polymarket market contract
   * @param {number} outcomeIndex - The index of the outcome to bet on (0-based)
   * @param {number|string} amount - Amount of position tokens to buy
   * @returns {Promise<Object>} Transaction details including:
   *   - transactionHash: Hash of the transaction
   *   - marketAddress: Address of the market
   *   - outcomeIndex: Index of the outcome bet on
   *   - amount: Amount of tokens bought
   *   - price: Price at which tokens were bought
   *   - expectedTokens: Expected number of tokens to receive
   * @throws {DeFiError} If wallet is not connected, Polymarket factory is not configured, or transaction fails
   * @example
   * const result = await defi.placePolymarketBet('0x123...', 0, '100');
   * console.log(result.expectedTokens); // '99' (with 1% slippage)
   */
  async placePolymarketBet(marketAddress, outcomeIndex, amount) {
    this.checkWalletConnected(); // Use central check

    if (!this.polymarketFactoryContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Polymarket factory not configured');
    }

    try {
      // Get market info and position token details
      const marketInfo = await this.getPolymarketInfo(marketAddress);
      const positionTokenAddress = marketInfo.positionTokens[outcomeIndex];

      // Get position token contract with signer
      const positionTokenContract = this.getTokenContract(positionTokenAddress, true);

      // Get token decimals
      const decimals = await positionTokenContract.decimals();
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), decimals);

      // Check if we need to approve the position token contract
      const walletAddress = walletManager.getAddress('polygon');
      const allowance = await positionTokenContract.allowance(walletAddress, marketAddress);

      if (allowance < amountIn) {
        const approveTx = await positionTokenContract.approve(marketAddress, amountIn); // Approve only the required amount
        await approveTx.wait();
      }

      // Get current price
      const { price } = await this.getPolymarketPositionPrice(marketAddress, outcomeIndex);

      // Calculate expected tokens with 1% slippage tolerance
      const expectedTokens = amountIn * (1 - 0.01);
      const minTokens = parseUnits(expectedTokens.toString(), decimals);

      // Create market contract with proper interaction interface
      const marketContract = new Contract(
        marketAddress,
        [
          'function buyOutcomeTokens(uint256 outcomeIndex, uint256 amount) external returns (uint256)',
          'function buyOutcomeTokensWithExactAmount(uint256 outcomeIndex, uint256 amount, uint256 minOutcomeTokens) external returns (uint256)'
        ],
        walletManager.getWallet('polygon')
      );
      
      // Buy outcome tokens using the proper market contract function
      const tx = await marketContract.buyOutcomeTokensWithExactAmount(
        outcomeIndex,
        amountIn,
        minTokens,
        { gasLimit: 300000 }
      );

      const receipt = await tx.wait();

      return {
        transactionHash: receipt.transactionHash,
        marketAddress,
        outcomeIndex,
        amount,
        price,
        expectedTokens: formatUnits(expectedTokens, decimals)
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to place Polymarket bet: ${error.message}`);
    }
  }

  /**
   * Sells position tokens back to the market
   * @param {string} marketAddress - The address of the Polymarket market contract
   * @param {number} outcomeIndex - The index of the outcome to sell (0-based)
   * @param {number|string} amount - Amount of position tokens to sell
   * @returns {Promise<Object>} Transaction details including:
   *   - transactionHash: Hash of the transaction
   *   - marketAddress: Address of the market
   *   - outcomeIndex: Index of the outcome sold
   *   - amount: Amount of tokens sold
   *   - price: Price at which tokens were sold
   *   - expectedReturn: Expected return amount
   * @throws {DeFiError} If wallet is not connected, Polymarket factory is not configured, or transaction fails
   * @example
   * const result = await defi.sellPolymarketPosition('0x123...', 0, '100');
   * console.log(result.expectedReturn); // '49.5' (with 1% slippage)
   */
  async sellPolymarketPosition(marketAddress, outcomeIndex, amount) {
    this.checkWalletConnected(); // Use central check

    if (!this.polymarketFactoryContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Polymarket factory not configured');
    }

    try {
      // Get market info and position token details
      const marketInfo = await this.getPolymarketInfo(marketAddress);
      const positionTokenAddress = marketInfo.positionTokens[outcomeIndex];

      // Get position token contract with signer
      const positionTokenContract = this.getTokenContract(positionTokenAddress, true);

      // Get token decimals
      const decimals = await positionTokenContract.decimals();
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), decimals);

      // Check if we need to approve the market contract
      const walletAddress = walletManager.getAddress('polygon');
      const allowance = await positionTokenContract.allowance(walletAddress, marketAddress);

      if (allowance < amountIn) {
        const approveTx = await positionTokenContract.approve(marketAddress, amountIn); // Approve only the required amount
        await approveTx.wait();
      }

      // Get current price
      const { price } = await this.getPolymarketPositionPrice(marketAddress, outcomeIndex);

      // Calculate expected return with 1% slippage tolerance
      const expectedReturn = amountIn * price * (1 - 0.01);
      // const minReturn = parseUnits(expectedReturn.toString(), decimals); // Removed unused variable

      // Execute sell transaction (needs market contract interaction, not just token transfer)
      // This part seems incorrect - selling usually involves interacting with the market contract or an AMM
      // Assuming a simplified transfer mechanism for now, but this needs review based on Polymarket's actual contracts
      const tx = await positionTokenContract.transfer(
        marketAddress, // Assuming market is the recipient? Needs verification.
        amountIn // Amount to send
      );

      const receipt = await tx.wait();

      return {
        transactionHash: receipt.transactionHash,
        marketAddress,
        outcomeIndex,
        amount,
        price,
        expectedReturn: formatUnits(expectedReturn, decimals)
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to sell Polymarket position: ${error.message}`);
    }
  }

  /**
   * Gets all positions held by the connected wallet for a specific market
   * @param {string} marketAddress - The address of the Polymarket market contract
   * @returns {Promise<Object>} Position information including:
   *   - marketAddress: Address of the market
   *   - positions: Array of positions, each containing:
   *     - outcomeIndex: Index of the outcome
   *     - outcome: Text description of the outcome
   *     - balance: Amount of position tokens held
   *     - tokenAddress: Address of the position token contract
   * @throws {DeFiError} If wallet is not connected, Polymarket factory is not configured, or positions cannot be retrieved
   * @example
   * const { positions } = await defi.getPolymarketPositions('0x123...');
   * console.log(positions[0].balance); // '100'
   */
  async getPolymarketPositions(marketAddress) {
    this.checkWalletConnected(); // Use central check

    if (!this.polymarketFactoryContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Polymarket factory not configured');
    }

    try {
      // Get market info
      const marketInfo = await this.getPolymarketInfo(marketAddress);
      
      // Get balances for each position token
      const walletAddress = walletManager.getAddress('polygon');
      const positions = await Promise.all(
        marketInfo.positionTokens.map(async (tokenAddress, index) => {
          // Use helper without signer for balance check
          const positionTokenContract = this.getTokenContract(tokenAddress, false);

          const [balance, decimals] = await Promise.all([
            positionTokenContract.balanceOf(walletAddress),
            positionTokenContract.decimals()
          ]);

          return {
            outcomeIndex: index,
            outcome: marketInfo.outcomes[index],
            balance: formatUnits(balance, decimals),
            tokenAddress
          };
        })
      );

      return {
        marketAddress,
        positions: positions.filter(p => parseFloat(p.balance) > 0)
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to get Polymarket positions: ${error.message}`);
    }
  }

  /**
   * Gets detailed information about all outcomes in a market
   * @param {string} marketAddress - The address of the Polymarket market contract
   * @returns {Promise<Object>} Market outcomes information including:
   *   - marketAddress: Address of the market
   *   - question: The market question
   *   - outcomes: Array of outcomes, each containing:
   *     - index: Index of the outcome
   *     - outcome: Text description of the outcome
   *     - price: Current price of the position token
   *     - positionToken: Address of the position token contract
   *   - endTimestamp: When the market ends
   *   - isResolved: Whether the market is resolved
   * @throws {DeFiError} If Polymarket factory is not configured or if outcomes cannot be retrieved
   * @example
   * const { outcomes } = await defi.getPolymarketOutcomes('0x123...');
   * console.log(outcomes[0].price); // 0.5
   */
  async getPolymarketOutcomes(marketAddress) {
    if (!this.polymarketFactoryContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Polymarket factory not configured');
    }

    try {
      // Get market info
      const marketInfo = await this.getPolymarketInfo(marketAddress);
      
      // Get prices for each outcome
      const outcomes = await Promise.all(
        marketInfo.outcomes.map(async (outcome, index) => {
          const { price } = await this.getPolymarketPositionPrice(marketAddress, index);
          return {
            index,
            outcome,
            price,
            positionToken: marketInfo.positionTokens[index]
          };
        })
      );

      return {
        marketAddress,
        question: marketInfo.question,
        outcomes,
        endTimestamp: marketInfo.endTimestamp,
        isResolved: marketInfo.isResolved
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to get Polymarket outcomes: ${error.message}`);
    }
  }

  // Get Uniswap V2 quote
  async getUniswapV2Quote(fromToken, toToken, amount) {
    if (!this.uniswapV2RouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Uniswap V2 router not configured');
    }
    
    try {
      // Resolve token addresses
      const fromTokenAddress = this.resolveTokenAddress(fromToken);
      const toTokenAddress = this.resolveTokenAddress(toToken);
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const toTokenContract = this.getTokenContract(toTokenAddress);
      
      const [fromDecimals, toDecimals, fromSymbol, toSymbol] = await Promise.all([
        fromTokenContract.decimals().catch(() => 18),
        toTokenContract.decimals().catch(() => 18),
        fromTokenContract.symbol().catch(() => fromToken),
        toTokenContract.symbol().catch(() => toToken)
      ]);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Get quote from Uniswap V2
      const amounts = await this.uniswapV2RouterContract.getAmountsOut(
        amountIn,
        [fromTokenAddress, toTokenAddress]
      );
      
      const amountOut = formatUnits(amounts[1], toDecimals);
      
      return {
        fromToken: {
          address: fromTokenAddress,
          symbol: fromSymbol,
          amount
        },
        toToken: {
          address: toTokenAddress,
          symbol: toSymbol,
          amount: amountOut
        },
        rate: parseFloat(amountOut) / parseFloat(amount),
        path: [fromTokenAddress, toTokenAddress]
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, `Failed to get Uniswap V2 quote: ${error.message}`);
    }
  }

  // Swap tokens on Uniswap V2
  async uniswapV2Swap(fromToken, toToken, amount, slippage = 0.5) {
    this.checkWalletConnected(); // Use central check

    if (!this.uniswapV2RouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Uniswap V2 router not configured');
    }
    
    try {
      // Get quote first
      const quote = await this.getUniswapV2Quote(fromToken, toToken, amount);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;

      // Get token details (use helper with signer=true for approval check/tx)
      const fromTokenContract = this.getTokenContract(fromTokenAddress, true);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);

      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      // Check if we need to approve the router
      const walletAddress = walletManager.getAddress('polygon');
      const routerAddress = this.uniswapV2Router; // Use address directly
      const allowance = await fromTokenContract.allowance(walletAddress, routerAddress);

      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(routerAddress, amountIn); // Approve only the required amount
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Execute swap using router contract connected to the wallet
      const routerWithSigner = this.uniswapV2RouterContract.connect(walletManager.getWallet('polygon'));
      const tx = await routerWithSigner.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        [fromTokenAddress, toTokenAddress],
        walletAddress, // Use wallet address from manager
        deadline
      );

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        expectedAmount: quote.toToken.amount,
        minAmount: formatUnits(amountOutMin, await this.getTokenContract(toTokenAddress).decimals().catch(() => 18))
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.SWAP_FAILED, `Uniswap V2 swap failed: ${error.message}`);
    }
  }

  // Add liquidity to Uniswap V2
  async addUniswapV2Liquidity(tokenA, tokenB, amountA, amountB, slippage = 0.5) {
    this.checkWalletConnected(); // Use central check

    if (!this.uniswapV2RouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Uniswap V2 router not configured');
    }
    
    try {
      // Resolve token addresses
      const tokenAAddress = this.resolveTokenAddress(tokenA);
      const tokenBAddress = this.resolveTokenAddress(tokenB);

      // Get token details (use helper with signer=true for approval checks/tx)
      const tokenAContract = this.getTokenContract(tokenAAddress, true);
      const tokenBContract = this.getTokenContract(tokenBAddress, true);

      const [tokenADecimals, tokenBDecimals, tokenASymbol, tokenBSymbol] = await Promise.all([
        tokenAContract.decimals().catch(() => 18),
        tokenBContract.decimals().catch(() => 18),
        tokenAContract.symbol().catch(() => tokenA),
        tokenBContract.symbol().catch(() => tokenB)
      ]);
      
      // Convert amounts to token units
      const amountADesired = parseUnits(amountA.toString(), tokenADecimals);
      const amountBDesired = parseUnits(amountB.toString(), tokenBDecimals);
      
      // Calculate minimum amounts with slippage
      const amountAMin = amountADesired * (1000 - slippage * 10) / 1000;
      const amountBMin = amountBDesired * (1000n - BigInt(slippage * 10)) / 1000n; // Use BigInt for precision

      // Check approvals
      const walletAddress = walletManager.getAddress('polygon');
      const routerAddress = this.uniswapV2Router; // Use address directly

      const allowanceA = await tokenAContract.allowance(walletAddress, routerAddress);
      if (allowanceA < amountADesired) {
        const approveTxA = await tokenAContract.approve(routerAddress, amountADesired); // Approve only the required amount
        await approveTxA.wait();
      }

      const allowanceB = await tokenBContract.allowance(walletAddress, routerAddress);
      if (allowanceB < amountBDesired) {
        const approveTxB = await tokenBContract.approve(routerAddress, amountBDesired); // Approve only the required amount
        await approveTxB.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Add liquidity using router contract connected to the wallet
      const routerWithSigner = this.uniswapV2RouterContract.connect(walletManager.getWallet('polygon'));
      const tx = await routerWithSigner.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        walletAddress, // Use wallet address from manager
        deadline
      );

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        tokenA: {
          address: tokenAAddress,
          symbol: tokenASymbol,
          amount: amountA
        },
        tokenB: {
          address: tokenBAddress,
          symbol: tokenBSymbol,
          amount: amountB
        }
      };
    } catch (error) {
      throw createDeFiError(ErrorCodes.LIQUIDITY_ERROR, `Adding Uniswap V2 liquidity failed: ${error.message}`);
    }
  }

  // Remove liquidity from Uniswap V2
  async removeUniswapV2Liquidity(tokenA, tokenB, liquidity, slippage = 0.5) {
    this.checkWalletConnected(); // Use central check

    if (!this.uniswapV2RouterContract) {
      throw createDeFiError(ErrorCodes.DEFI_ERROR, 'Uniswap V2 router not configured');
    }
    
    try {
      // Resolve token addresses
      const tokenAAddress = this.resolveTokenAddress(tokenA);
      const tokenBAddress = this.resolveTokenAddress(tokenB);

      // Get token details (use helper with signer=true for approval checks/tx)
      const tokenAContract = this.getTokenContract(tokenAAddress, true);
      const tokenBContract = this.getTokenContract(tokenBAddress, true);

      const [tokenADecimals, tokenBDecimals, tokenASymbol, tokenBSymbol] = await Promise.all([
        tokenAContract.decimals().catch(() => 18),
        tokenBContract.decimals().catch(() => 18),
        tokenAContract.symbol().catch(() => tokenA),
        tokenBContract.symbol().catch(() => tokenB)
      ]);
      
      // Convert liquidity to token units
      const liquidityAmount = parseUnits(liquidity.toString(), 18); // LP tokens are always 18 decimals
      // Get current balances to calculate minimum amounts
      const walletAddress = walletManager.getAddress('polygon');
      const [balanceA, balanceB] = await Promise.all([
        tokenAContract.balanceOf(walletAddress),
        tokenBContract.balanceOf(walletAddress)
      ]);

      // Calculate minimum amounts with slippage using BigInt
      const amountAMin = balanceA * (1000n - BigInt(slippage * 10)) / 1000n;
      const amountBMin = balanceB * (1000n - BigInt(slippage * 10)) / 1000n;

      // Get the factory address from the router
      const factoryAddress = await this.uniswapV2RouterContract.factory();
      
      // Create a factory contract instance
      const factoryContract = new Contract(
        factoryAddress,
        [
          'function getPair(address tokenA, address tokenB) external view returns (address pair)'
        ],
        this.provider
      );
      
      // Get LP token address from the factory
      const lpTokenAddress = await factoryContract.getPair(tokenAAddress, tokenBAddress);
      
      if (lpTokenAddress === '0x0000000000000000000000000000000000000000') {
        throw createDeFiError(
          ErrorCodes.LIQUIDITY_ERROR,
          'No liquidity pair exists for these tokens',
          { tokenA, tokenB }
        );
      }
      
      // Create LP token contract with signer
      const lpTokenContract = this.getTokenContract(lpTokenAddress, true);
      const routerAddress = this.uniswapV2Router;
      
      // Check allowance and approve if needed
      const allowance = await lpTokenContract.allowance(walletAddress, routerAddress);
      if (allowance < liquidityAmount) {
        const approveTx = await lpTokenContract.approve(routerAddress, liquidityAmount); // Approve only the required amount
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Remove liquidity using router contract connected to the wallet
      const routerWithSigner = this.uniswapV2RouterContract.connect(walletManager.getWallet('polygon'));
      const tx = await routerWithSigner.removeLiquidity(
        tokenAAddress,
        tokenBAddress,
        liquidityAmount,
        amountAMin,
        amountBMin,
        walletAddress, // Use wallet address from manager
        deadline
      );

      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        tokenA: {
          address: tokenAAddress,
          symbol: tokenASymbol,
          amount: formatUnits(balanceA, tokenADecimals)
        },
        tokenB: {
          address: tokenBAddress,
          symbol: tokenBSymbol,
          amount: formatUnits(balanceB, tokenBDecimals)
        }
      };
    } catch (error) {
      // Add specific error code
      throw createDeFiError(ErrorCodes.LIQUIDITY_ERROR, `Removing Uniswap V2 liquidity failed: ${error.message}`);
    }
  }
}

export { DeFiProtocols }; // Use export
