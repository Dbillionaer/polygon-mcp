// defi-interactions.js - DeFi Protocol Interactions (QuickSwap & Uniswap V3)
const { 
  JsonRpcProvider, 
  Wallet, 
  Contract, 
  parseUnits,
  formatUnits,
  MaxUint256
} = require('ethers');

// QuickSwap Router ABI (simplified)
const QUICKSWAP_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)"
];

// Uniswap V3 Router ABI (simplified)
const UNISWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
  "function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)",
  "function exactOutputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountIn)",
  "function exactOutput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum) params) external payable returns (uint256 amountIn)",
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
  "function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut)",
  "function quoteExactOutputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountOut, uint160 sqrtPriceLimitX96) external returns (uint256 amountIn)",
  "function quoteExactOutput(bytes path, uint256 amountOut) external returns (uint256 amountIn)"
];

// Uniswap V3 Pool ABI (simplified)
const UNISWAP_POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)"
];

// ERC20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Polymarket Factory ABI
const POLYMARKET_FACTORY_ABI = [
  "function getMarket(address market) external view returns (tuple(address creator, uint256 creationTimestamp, uint256 endTimestamp, uint256 resolutionTimestamp, bool resolved, string question, string[] outcomes))",
  "function createMarket(string question, uint256 endTimestamp, string[] outcomes) external returns (address)",
  "function resolveMarket(address market, uint256 outcomeIndex) external"
];

// Polymarket Market ABI
const POLYMARKET_MARKET_ABI = [
  "function getPositionToken(uint256 outcomeIndex) external view returns (address)",
  "function getTotalSupply() external view returns (uint256)",
  "function getOutcomeCount() external view returns (uint256)",
  "function getOutcome(uint256 index) external view returns (string)",
  "function getEndTimestamp() external view returns (uint256)",
  "function getResolutionTimestamp() external view returns (uint256)",
  "function isResolved() external view returns (bool)",
  "function getQuestion() external view returns (string)"
];

// Uniswap V2 Router ABI (simplified)
const UNISWAP_V2_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
  "function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)"
];

class DeFiProtocols {
  constructor(config) {
    this.rpcUrl = config.rpcUrl;
    this.quickswapRouter = config.quickswapRouter;
    this.uniswapRouter = config.uniswapRouter;
    this.uniswapV2Router = config.uniswapV2Router;
    this.tokenAddresses = config.tokenAddresses;
    this.polymarketFactory = config.polymarketFactory;
    
    // Initialize provider
    this.provider = new JsonRpcProvider(this.rpcUrl);
    
    // Initialize QuickSwap router contract
    if (this.quickswapRouter) {
      this.quickswapRouterContract = new Contract(
        this.quickswapRouter,
        QUICKSWAP_ROUTER_ABI,
        this.provider
      );
    }

    // Initialize Uniswap V3 router contract
    if (this.uniswapRouter) {
      this.uniswapRouterContract = new Contract(
        this.uniswapRouter,
        UNISWAP_ROUTER_ABI,
        this.provider
      );
    }

    // Initialize Uniswap V2 router contract
    if (this.uniswapV2Router) {
      this.uniswapV2RouterContract = new Contract(
        this.uniswapV2Router,
        UNISWAP_V2_ROUTER_ABI,
        this.provider
      );
    }

    // Initialize Polymarket factory contract
    if (this.polymarketFactory) {
      this.polymarketFactoryContract = new Contract(
        this.polymarketFactory,
        POLYMARKET_FACTORY_ABI,
        this.provider
      );
    }
  }
  
  // Connect wallet for operations
  connectWallet(privateKey) {
    this.wallet = new Wallet(privateKey, this.provider);
    
    // Update QuickSwap router contract with signer
    if (this.quickswapRouterContract) {
      this.quickswapRouterContract = this.quickswapRouterContract.connect(this.wallet);
    }

    // Update Uniswap V3 router contract with signer
    if (this.uniswapRouterContract) {
      this.uniswapRouterContract = this.uniswapRouterContract.connect(this.wallet);
    }

    // Update Uniswap V2 router contract with signer
    if (this.uniswapV2RouterContract) {
      this.uniswapV2RouterContract = this.uniswapV2RouterContract.connect(this.wallet);
    }
  }
  
  // Helper to resolve token address from symbol or address
  resolveTokenAddress(token) {
    if (typeof token === 'string' && token.match(/^0x[a-fA-F0-9]{40}$/)) {
      return token;
    }
    
    const upperToken = token.toUpperCase();
    if (this.tokenAddresses[upperToken]) {
      return this.tokenAddresses[upperToken];
    }
    
    throw new Error(`Unknown token: ${token}`);
  }
  
  // Helper to get token contract
  getTokenContract(tokenAddress) {
    return new Contract(
      tokenAddress,
      ERC20_ABI,
      this.wallet || this.provider
    );
  }

  // Get Uniswap V3 quote for single hop
  async getUniswapV3QuoteSingle(fromToken, toToken, amount, fee = 3000) {
    if (!this.uniswapRouterContract) {
      throw new Error("Uniswap router not configured");
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
      throw new Error(`Failed to get Uniswap quote: ${error.message}`);
    }
  }

  // Swap tokens on Uniswap V3 (single hop)
  async uniswapV3SwapSingle(fromToken, toToken, amount, slippage = 0.5, fee = 3000) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.uniswapRouterContract) {
      throw new Error("Uniswap router not configured");
    }
    
    try {
      // Get quote first
      const quote = await this.getUniswapV3QuoteSingle(fromToken, toToken, amount, fee);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      
      // Check if we need to approve the router
      const allowance = await fromTokenContract.allowance(
        this.wallet.address,
        this.uniswapRouterContract.address
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.uniswapRouterContract.address,
          MaxUint256 // Approve max amount
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
        recipient: this.wallet.address,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0
      };
      
      // Execute swap
      const tx = await this.uniswapRouterContract.exactInputSingle(params);
      
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        expectedAmount: quote.toToken.amount,
        minAmount: formatUnits(amountOutMin, await this.getTokenContract(toTokenAddress).decimals().catch(() => 18))
      };
    } catch (error) {
      throw new Error(`Uniswap swap failed: ${error.message}`);
    }
  }

  // Get Uniswap V3 quote for multi-hop
  async getUniswapV3QuoteMulti(fromToken, toToken, amount, intermediateTokens = [], fees = []) {
    if (!this.uniswapRouterContract) {
      throw new Error("Uniswap router not configured");
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
      throw new Error(`Failed to get Uniswap multi-hop quote: ${error.message}`);
    }
  }

  // Helper to encode Uniswap V3 path
  encodeUniswapV3Path(tokens, fees) {
    if (tokens.length < 2) {
      throw new Error("Path must contain at least 2 tokens");
    }
    if (fees.length !== tokens.length - 1) {
      throw new Error("Number of fees must be one less than number of tokens");
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
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.uniswapRouterContract) {
      throw new Error("Uniswap router not configured");
    }
    
    try {
      // Get quote first
      const quote = await this.getUniswapV3QuoteMulti(fromToken, toToken, amount, intermediateTokens, fees);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      
      // Check if we need to approve the router
      const allowance = await fromTokenContract.allowance(
        this.wallet.address,
        this.uniswapRouterContract.address
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.uniswapRouterContract.address,
          MaxUint256 // Approve max amount
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
        recipient: this.wallet.address,
        deadline,
        amountIn,
        amountOutMinimum: amountOutMin
      };
      
      // Execute swap
      const tx = await this.uniswapRouterContract.exactInput(params);
      
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
      throw new Error(`Uniswap multi-hop swap failed: ${error.message}`);
    }
  }

  // Get QuickSwap quote
  async getQuickSwapQuote(fromToken, toToken, amount) {
    if (!this.quickswapRouterContract) {
      throw new Error("QuickSwap router not configured");
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
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }
  
  // Swap tokens on QuickSwap
  async quickSwapTokens(fromToken, toToken, amount, slippage = 0.5) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.quickswapRouterContract) {
      throw new Error("QuickSwap router not configured");
    }
    
    try {
      // Get quote first
      const quote = await this.getQuickSwapQuote(fromToken, toToken, amount);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      
      // Check if we need to approve the router
      const allowance = await fromTokenContract.allowance(
        this.wallet.address,
        this.quickswapRouterContract.address
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.quickswapRouterContract.address,
          MaxUint256 // Approve max amount
        );
        
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Execute swap
      const tx = await this.quickswapRouterContract.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        [fromTokenAddress, toTokenAddress],
        this.wallet.address,
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
      throw new Error(`Swap failed: ${error.message}`);
    }
  }
  
  // Add liquidity to QuickSwap
  async addQuickSwapLiquidity(tokenA, tokenB, amountA, amountB, slippage = 0.5) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.quickswapRouterContract) {
      throw new Error("QuickSwap router not configured");
    }
    
    try {
      // Resolve token addresses
      const tokenAAddress = this.resolveTokenAddress(tokenA);
      const tokenBAddress = this.resolveTokenAddress(tokenB);
      
      // Get token details
      const tokenAContract = this.getTokenContract(tokenAAddress);
      const tokenBContract = this.getTokenContract(tokenBAddress);
      
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
      const amountBMin = amountBDesired * (1000 - slippage * 10) / 1000;
      
      // Check if we need to approve the router for token A
      const allowanceA = await tokenAContract.allowance(
        this.wallet.address,
        this.quickswapRouterContract.address
      );
      
      if (allowanceA < amountADesired) {
        const approveTxA = await tokenAContract.approve(
          this.quickswapRouterContract.address,
          MaxUint256 // Approve max amount
        );
        
        await approveTxA.wait();
      }
      
      // Check if we need to approve the router for token B
      const allowanceB = await tokenBContract.allowance(
        this.wallet.address,
        this.quickswapRouterContract.address
      );
      
      if (allowanceB < amountBDesired) {
        const approveTxB = await tokenBContract.approve(
          this.quickswapRouterContract.address,
          MaxUint256 // Approve max amount
        );
        
        await approveTxB.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Add liquidity
      const tx = await this.quickswapRouterContract.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        this.wallet.address,
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
      throw new Error(`Adding liquidity failed: ${error.message}`);
    }
  }

  // Get QuickSwap quote for multi-hop
  async getQuickSwapQuoteMulti(fromToken, toToken, amount, intermediateTokens = []) {
    if (!this.quickswapRouterContract) {
      throw new Error("QuickSwap router not configured");
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
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.quickswapRouterContract) {
      throw new Error("QuickSwap router not configured");
    }
    
    try {
      // Get quote first
      const quote = await this.getQuickSwapQuoteMulti(fromToken, toToken, amount, intermediateTokens);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      
      // Check if we need to approve the router
      const allowance = await fromTokenContract.allowance(
        this.wallet.address,
        this.quickswapRouterContract.address
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.quickswapRouterContract.address,
          MaxUint256 // Approve max amount
        );
        
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Execute swap
      const tx = await this.quickswapRouterContract.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        quote.path,
        this.wallet.address,
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
      throw new Error(`QuickSwap multi-hop swap failed: ${error.message}`);
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
   * @throws {Error} If Polymarket factory is not configured or if market info cannot be retrieved
   * @example
   * const marketInfo = await defi.getPolymarketInfo("0x123...");
   * console.log(marketInfo.question); // "Who will win the 2024 US Presidential Election?"
   */
  async getPolymarketInfo(marketAddress) {
    if (!this.polymarketFactoryContract) {
      throw new Error("Polymarket factory not configured");
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
      const [outcomeCount, endTimestamp, isResolved] = await Promise.all([
        marketContract.getOutcomeCount(),
        marketContract.getEndTimestamp(),
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
      throw new Error(`Failed to get Polymarket info: ${error.message}`);
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
   * @throws {Error} If Polymarket factory is not configured or if price cannot be retrieved
   * @example
   * const { price } = await defi.getPolymarketPositionPrice("0x123...", 0);
   * console.log(price); // 0.5 (50% probability)
   */
  async getPolymarketPositionPrice(marketAddress, outcomeIndex) {
    if (!this.polymarketFactoryContract) {
      throw new Error("Polymarket factory not configured");
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
      throw new Error(`Failed to get position token price: ${error.message}`);
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
   * @throws {Error} If wallet is not connected, Polymarket factory is not configured, or transaction fails
   * @example
   * const result = await defi.placePolymarketBet("0x123...", 0, "100");
   * console.log(result.expectedTokens); // "99" (with 1% slippage)
   */
  async placePolymarketBet(marketAddress, outcomeIndex, amount) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }

    if (!this.polymarketFactoryContract) {
      throw new Error("Polymarket factory not configured");
    }

    try {
      // Get market info and position token details
      const marketInfo = await this.getPolymarketInfo(marketAddress);
      const positionTokenAddress = marketInfo.positionTokens[outcomeIndex];
      
      // Get position token contract
      const positionTokenContract = new Contract(
        positionTokenAddress,
        ERC20_ABI,
        this.wallet
      );

      // Get token decimals
      const decimals = await positionTokenContract.decimals();
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), decimals);

      // Check if we need to approve the position token contract
      const allowance = await positionTokenContract.allowance(
        this.wallet.address,
        marketAddress
      );

      if (allowance < amountIn) {
        const approveTx = await positionTokenContract.approve(
          marketAddress,
          MaxUint256
        );
        await approveTx.wait();
      }

      // Get current price
      const { price } = await this.getPolymarketPositionPrice(marketAddress, outcomeIndex);

      // Calculate expected tokens with 1% slippage tolerance
      const expectedTokens = amountIn * (1 - 0.01);
      const minTokens = parseUnits(expectedTokens.toString(), decimals);

      // Execute buy transaction
      const tx = await positionTokenContract.transferFrom(
        marketAddress,
        this.wallet.address,
        minTokens
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
      throw new Error(`Failed to place Polymarket bet: ${error.message}`);
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
   * @throws {Error} If wallet is not connected, Polymarket factory is not configured, or transaction fails
   * @example
   * const result = await defi.sellPolymarketPosition("0x123...", 0, "100");
   * console.log(result.expectedReturn); // "49.5" (with 1% slippage)
   */
  async sellPolymarketPosition(marketAddress, outcomeIndex, amount) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }

    if (!this.polymarketFactoryContract) {
      throw new Error("Polymarket factory not configured");
    }

    try {
      // Get market info and position token details
      const marketInfo = await this.getPolymarketInfo(marketAddress);
      const positionTokenAddress = marketInfo.positionTokens[outcomeIndex];
      
      // Get position token contract
      const positionTokenContract = new Contract(
        positionTokenAddress,
        ERC20_ABI,
        this.wallet
      );

      // Get token decimals
      const decimals = await positionTokenContract.decimals();
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), decimals);

      // Check if we need to approve the market contract
      const allowance = await positionTokenContract.allowance(
        this.wallet.address,
        marketAddress
      );

      if (allowance < amountIn) {
        const approveTx = await positionTokenContract.approve(
          marketAddress,
          MaxUint256
        );
        await approveTx.wait();
      }

      // Get current price
      const { price } = await this.getPolymarketPositionPrice(marketAddress, outcomeIndex);

      // Calculate expected return with 1% slippage tolerance
      const expectedReturn = amountIn * price * (1 - 0.01);
      const minReturn = parseUnits(expectedReturn.toString(), decimals);

      // Execute sell transaction
      const tx = await positionTokenContract.transfer(
        marketAddress,
        amountIn
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
      throw new Error(`Failed to sell Polymarket position: ${error.message}`);
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
   * @throws {Error} If wallet is not connected, Polymarket factory is not configured, or positions cannot be retrieved
   * @example
   * const { positions } = await defi.getPolymarketPositions("0x123...");
   * console.log(positions[0].balance); // "100"
   */
  async getPolymarketPositions(marketAddress) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }

    if (!this.polymarketFactoryContract) {
      throw new Error("Polymarket factory not configured");
    }

    try {
      // Get market info
      const marketInfo = await this.getPolymarketInfo(marketAddress);
      
      // Get balances for each position token
      const positions = await Promise.all(
        marketInfo.positionTokens.map(async (tokenAddress, index) => {
          const positionTokenContract = new Contract(
            tokenAddress,
            ERC20_ABI,
            this.provider
          );

          const [balance, decimals] = await Promise.all([
            positionTokenContract.balanceOf(this.wallet.address),
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
      throw new Error(`Failed to get Polymarket positions: ${error.message}`);
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
   * @throws {Error} If Polymarket factory is not configured or if outcomes cannot be retrieved
   * @example
   * const { outcomes } = await defi.getPolymarketOutcomes("0x123...");
   * console.log(outcomes[0].price); // 0.5
   */
  async getPolymarketOutcomes(marketAddress) {
    if (!this.polymarketFactoryContract) {
      throw new Error("Polymarket factory not configured");
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
      throw new Error(`Failed to get Polymarket outcomes: ${error.message}`);
    }
  }

  // Get Uniswap V2 quote
  async getUniswapV2Quote(fromToken, toToken, amount) {
    if (!this.uniswapV2RouterContract) {
      throw new Error("Uniswap V2 router not configured");
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
      throw new Error(`Failed to get Uniswap V2 quote: ${error.message}`);
    }
  }

  // Swap tokens on Uniswap V2
  async uniswapV2Swap(fromToken, toToken, amount, slippage = 0.5) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.uniswapV2RouterContract) {
      throw new Error("Uniswap V2 router not configured");
    }
    
    try {
      // Get quote first
      const quote = await this.getUniswapV2Quote(fromToken, toToken, amount);
      
      // Resolve token addresses
      const fromTokenAddress = quote.fromToken.address;
      const toTokenAddress = quote.toToken.address;
      
      // Get token details
      const fromTokenContract = this.getTokenContract(fromTokenAddress);
      const fromDecimals = await fromTokenContract.decimals().catch(() => 18);
      
      // Convert amount to token units
      const amountIn = parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      
      // Check if we need to approve the router
      const allowance = await fromTokenContract.allowance(
        this.wallet.address,
        this.uniswapV2RouterContract.address
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.uniswapV2RouterContract.address,
          MaxUint256 // Approve max amount
        );
        
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Execute swap
      const tx = await this.uniswapV2RouterContract.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        [fromTokenAddress, toTokenAddress],
        this.wallet.address,
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
      throw new Error(`Uniswap V2 swap failed: ${error.message}`);
    }
  }

  // Add liquidity to Uniswap V2
  async addUniswapV2Liquidity(tokenA, tokenB, amountA, amountB, slippage = 0.5) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.uniswapV2RouterContract) {
      throw new Error("Uniswap V2 router not configured");
    }
    
    try {
      // Resolve token addresses
      const tokenAAddress = this.resolveTokenAddress(tokenA);
      const tokenBAddress = this.resolveTokenAddress(tokenB);
      
      // Get token details
      const tokenAContract = this.getTokenContract(tokenAAddress);
      const tokenBContract = this.getTokenContract(tokenBAddress);
      
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
      const amountBMin = amountBDesired * (1000 - slippage * 10) / 1000;
      
      // Check if we need to approve the router for token A
      const allowanceA = await tokenAContract.allowance(
        this.wallet.address,
        this.uniswapV2RouterContract.address
      );
      
      if (allowanceA < amountADesired) {
        const approveTxA = await tokenAContract.approve(
          this.uniswapV2RouterContract.address,
          MaxUint256 // Approve max amount
        );
        
        await approveTxA.wait();
      }
      
      // Check if we need to approve the router for token B
      const allowanceB = await tokenBContract.allowance(
        this.wallet.address,
        this.uniswapV2RouterContract.address
      );
      
      if (allowanceB < amountBDesired) {
        const approveTxB = await tokenBContract.approve(
          this.uniswapV2RouterContract.address,
          MaxUint256 // Approve max amount
        );
        
        await approveTxB.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Add liquidity
      const tx = await this.uniswapV2RouterContract.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        this.wallet.address,
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
      throw new Error(`Adding Uniswap V2 liquidity failed: ${error.message}`);
    }
  }

  // Remove liquidity from Uniswap V2
  async removeUniswapV2Liquidity(tokenA, tokenB, liquidity, slippage = 0.5) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.uniswapV2RouterContract) {
      throw new Error("Uniswap V2 router not configured");
    }
    
    try {
      // Resolve token addresses
      const tokenAAddress = this.resolveTokenAddress(tokenA);
      const tokenBAddress = this.resolveTokenAddress(tokenB);
      
      // Get token details
      const tokenAContract = this.getTokenContract(tokenAAddress);
      const tokenBContract = this.getTokenContract(tokenBAddress);
      
      const [tokenADecimals, tokenBDecimals, tokenASymbol, tokenBSymbol] = await Promise.all([
        tokenAContract.decimals().catch(() => 18),
        tokenBContract.decimals().catch(() => 18),
        tokenAContract.symbol().catch(() => tokenA),
        tokenBContract.symbol().catch(() => tokenB)
      ]);
      
      // Convert liquidity to token units
      const liquidityAmount = parseUnits(liquidity.toString(), 18); // LP tokens are always 18 decimals
      
      // Get current balances to calculate minimum amounts
      const [balanceA, balanceB] = await Promise.all([
        tokenAContract.balanceOf(this.wallet.address),
        tokenBContract.balanceOf(this.wallet.address)
      ]);
      
      // Calculate minimum amounts with slippage
      const amountAMin = balanceA * (1000 - slippage * 10) / 1000;
      const amountBMin = balanceB * (1000 - slippage * 10) / 1000;
      
      // Check if we need to approve the router for LP tokens
      const lpTokenContract = this.getTokenContract(tokenAAddress); // Use token A contract for LP token
      const allowance = await lpTokenContract.allowance(
        this.wallet.address,
        this.uniswapV2RouterContract.address
      );
      
      if (allowance < liquidityAmount) {
        const approveTx = await lpTokenContract.approve(
          this.uniswapV2RouterContract.address,
          MaxUint256
        );
        
        await approveTx.wait();
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Remove liquidity
      const tx = await this.uniswapV2RouterContract.removeLiquidity(
        tokenAAddress,
        tokenBAddress,
        liquidityAmount,
        amountAMin,
        amountBMin,
        this.wallet.address,
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
      throw new Error(`Removing Uniswap V2 liquidity failed: ${error.message}`);
    }
  }
}

module.exports = { DeFiProtocols };
