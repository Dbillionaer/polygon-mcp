// defi-interactions.js - DeFi Protocol Interactions
const ethers = require('ethers');

// QuickSwap Router ABI (simplified)
const QUICKSWAP_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)"
];

// Aave Lending Pool ABI (simplified)
const AAVE_LENDING_POOL_ABI = [
  "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
  "function getUserAccountData(address user) external view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"
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
    this.aaveLendingPool = config.aaveLendingPool;
    this.tokenAddresses = config.tokenAddresses;
    
    // Initialize provider
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    
    // Initialize contracts
    if (this.quickswapRouter) {
      this.quickswapRouterContract = new ethers.Contract(
        this.quickswapRouter,
        QUICKSWAP_ROUTER_ABI,
        this.provider
      );
    }
    
    if (this.aaveLendingPool) {
      this.aaveLendingPoolContract = new ethers.Contract(
        this.aaveLendingPool,
        AAVE_LENDING_POOL_ABI,
        this.provider
      );
    }
  }
  
  // Connect wallet for operations
  connectWallet(privateKey) {
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Update contracts with signer
    if (this.quickswapRouterContract) {
      this.quickswapRouterContract = this.quickswapRouterContract.connect(this.wallet);
    }
    
    if (this.aaveLendingPoolContract) {
      this.aaveLendingPoolContract = this.aaveLendingPoolContract.connect(this.wallet);
    }
  }
  
  // Helper to resolve token address from symbol or address
  resolveTokenAddress(token) {
    if (ethers.utils.isAddress(token)) {
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
    return new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      this.wallet || this.provider
    );
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
      const amountIn = ethers.utils.parseUnits(amount.toString(), fromDecimals);
      
      // Get quote from QuickSwap
      const amounts = await this.quickswapRouterContract.getAmountsOut(
        amountIn,
        [fromTokenAddress, toTokenAddress]
      );
      
      const amountOut = ethers.utils.formatUnits(amounts[1], toDecimals);
      
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
      const amountIn = ethers.utils.parseUnits(amount.toString(), fromDecimals);
      
      // Calculate minimum amount out with slippage
      const amountOutMin = ethers.utils.parseUnits(
        (parseFloat(quote.toToken.amount) * (1 - slippage / 100)).toFixed(18),
        await this.getTokenContract(toTokenAddress).decimals().catch(() => 18)
      );
      
      // Check if we need to approve the router
      const allowance = await fromTokenContract.allowance(
        this.wallet.address,
        this.quickswapRouter
      );
      
      if (allowance.lt(amountIn)) {
        const approveTx = await fromTokenContract.approve(
          this.quickswapRouter,
          ethers.constants.MaxUint256 // Approve max amount
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
        minAmount: ethers.utils.formatUnits(amountOutMin, await this.getTokenContract(toTokenAddress).decimals().catch(() => 18))
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
      const amountADesired = ethers.utils.parseUnits(amountA.toString(), tokenADecimals);
      const amountBDesired = ethers.utils.parseUnits(amountB.toString(), tokenBDecimals);
      
      // Calculate minimum amounts with slippage
      const amountAMin = amountADesired.mul(1000 - slippage * 10).div(1000);
      const amountBMin = amountBDesired.mul(1000 - slippage * 10).div(1000);
      
      // Check if we need to approve the router for token A
      const allowanceA = await tokenAContract.allowance(
        this.wallet.address,
        this.quickswapRouter
      );
      
      if (allowanceA.lt(amountADesired)) {
        const approveTxA = await tokenAContract.approve(
          this.quickswapRouter,
          ethers.constants.MaxUint256 // Approve max amount
        );
        
        await approveTxA.wait();
      }
      
      // Check if we need to approve the router for token B
      const allowanceB = await tokenBContract.allowance(
        this.wallet.address,
        this.quickswapRouter
      );
      
      if (allowanceB.lt(amountBDesired)) {
        const approveTxB = await tokenBContract.approve(
          this.quickswapRouter,
          ethers.constants.MaxUint256 // Approve max amount
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
  
  // Deposit to Aave
  async aaveDeposit(token, amount) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.aaveLendingPoolContract) {
      throw new Error("Aave lending pool not configured");
    }
    
    try {
      // Resolve token address
      const tokenAddress = this.resolveTokenAddress(token);
      
      // Get token details
      const tokenContract = this.getTokenContract(tokenAddress);
      const decimals = await tokenContract.decimals().catch(() => 18);
      const symbol = await tokenContract.symbol().catch(() => token);
      
      // Convert amount to token units
      const amountInTokenUnits = ethers.utils.parseUnits(amount.toString(), decimals);
      
      // Check if we need to approve the lending pool
      const allowance = await tokenContract.allowance(
        this.wallet.address,
        this.aaveLendingPool
      );
      
      if (allowance.lt(amountInTokenUnits)) {
        const approveTx = await tokenContract.approve(
          this.aaveLendingPool,
          ethers.constants.MaxUint256 // Approve max amount
        );
        
        await approveTx.wait();
      }
      
      // Deposit to Aave
      const tx = await this.aaveLendingPoolContract.deposit(
        tokenAddress,
        amountInTokenUnits,
        this.wallet.address,
        0 // referral code (not used anymore)
      );
      
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        token: {
          address: tokenAddress,
          symbol,
          amount
        }
      };
    } catch (error) {
      throw new Error(`Deposit failed: ${error.message}`);
    }
  }
  
  // Withdraw from Aave
  async aaveWithdraw(token, amount) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.aaveLendingPoolContract) {
      throw new Error("Aave lending pool not configured");
    }
    
    try {
      // Resolve token address
      const tokenAddress = this.resolveTokenAddress(token);
      
      // Get token details
      const tokenContract = this.getTokenContract(tokenAddress);
      const decimals = await tokenContract.decimals().catch(() => 18);
      const symbol = await tokenContract.symbol().catch(() => token);
      
      // Handle "all" amount
      let amountInTokenUnits;
      if (amount === "all") {
        // For a real implementation, this would get the aToken balance
        // For demonstration, we'll just use a large number
        amountInTokenUnits = ethers.constants.MaxUint256;
      } else {
        amountInTokenUnits = ethers.utils.parseUnits(amount.toString(), decimals);
      }
      
      // Withdraw from Aave
      const tx = await this.aaveLendingPoolContract.withdraw(
        tokenAddress,
        amountInTokenUnits,
        this.wallet.address
      );
      
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        token: {
          address: tokenAddress,
          symbol,
          amount: amount === "all" ? "all" : amount
        }
      };
    } catch (error) {
      throw new Error(`Withdrawal failed: ${error.message}`);
    }
  }
}

module.exports = { DeFiProtocols };
