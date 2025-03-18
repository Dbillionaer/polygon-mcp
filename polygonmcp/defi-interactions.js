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

class DeFiProtocols {
  constructor(config) {
    this.rpcUrl = config.rpcUrl;
    this.quickswapRouter = config.quickswapRouter;
    this.uniswapRouter = config.uniswapRouter;
    this.tokenAddresses = config.tokenAddresses;
    
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

    // Initialize Uniswap router contract
    if (this.uniswapRouter) {
      this.uniswapRouterContract = new Contract(
        this.uniswapRouter,
        UNISWAP_ROUTER_ABI,
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

    // Update Uniswap router contract with signer
    if (this.uniswapRouterContract) {
      this.uniswapRouterContract = this.uniswapRouterContract.connect(this.wallet);
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
        this.uniswapRouter
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.uniswapRouter,
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
        this.uniswapRouter
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.uniswapRouter,
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
        this.quickswapRouter
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.quickswapRouter,
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
        this.quickswapRouter
      );
      
      if (allowanceA < amountADesired) {
        const approveTxA = await tokenAContract.approve(
          this.quickswapRouter,
          MaxUint256 // Approve max amount
        );
        
        await approveTxA.wait();
      }
      
      // Check if we need to approve the router for token B
      const allowanceB = await tokenBContract.allowance(
        this.wallet.address,
        this.quickswapRouter
      );
      
      if (allowanceB < amountBDesired) {
        const approveTxB = await tokenBContract.approve(
          this.quickswapRouter,
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
        intermediateAmounts: amounts.slice(1, -1).map((amount, index) => ({
          token: intermediateTokens[index],
          amount: formatUnits(amount, await this.getTokenContract(intermediateAddresses[index]).decimals().catch(() => 18))
        }))
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
        this.quickswapRouter
      );
      
      if (allowance < amountIn) {
        const approveTx = await fromTokenContract.approve(
          this.quickswapRouter,
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
}

module.exports = { DeFiProtocols };
