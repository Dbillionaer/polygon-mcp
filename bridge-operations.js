// bridge-operations.js - Polygon Bridge Operations
const ethers = require('ethers');

// ABI for POS Portal contracts
const POS_ROOT_CHAIN_MANAGER_ABI = [
  "function depositEtherFor(address user) payable",
  "function depositFor(address user, address rootToken, bytes calldata depositData)",
  "function exit(bytes calldata inputData)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

class PolygonBridge {
  constructor(config) {
    this.rootRpcUrl = config.rootRpcUrl;
    this.childRpcUrl = config.childRpcUrl;
    this.posRootChainManager = config.posRootChainManager;
    this.polygonApiUrl = config.polygonApiUrl;
    
    // Initialize providers
    this.rootProvider = new ethers.providers.JsonRpcProvider(this.rootRpcUrl);
    this.childProvider = new ethers.providers.JsonRpcProvider(this.childRpcUrl);
    
    // Initialize contracts
    this.rootChainManagerContract = new ethers.Contract(
      this.posRootChainManager,
      POS_ROOT_CHAIN_MANAGER_ABI,
      this.rootProvider
    );
  }
  
  // Connect wallet for operations
  connectWallet(privateKey) {
    this.rootWallet = new ethers.Wallet(privateKey, this.rootProvider);
    this.childWallet = new ethers.Wallet(privateKey, this.childProvider);
    
    // Update contract with signer
    this.rootChainManagerContract = this.rootChainManagerContract.connect(this.rootWallet);
  }
  
  // Deposit ETH to Polygon
  async depositETH(amount) {
    if (!this.rootWallet) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Convert amount to wei
      const amountWei = ethers.utils.parseEther(amount.toString());
      
      // Deposit ETH to Polygon
      const tx = await this.rootChainManagerContract.depositEtherFor(
        this.rootWallet.address,
        { value: amountWei }
      );
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        amount: ethers.utils.formatEther(amountWei),
        status: "Deposit initiated"
      };
    } catch (error) {
      throw new Error(`ETH deposit failed: ${error.message}`);
    }
  }
  
  // Deposit ERC20 to Polygon
  async depositERC20(tokenAddress, amount) {
    if (!this.rootWallet) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Create token contract instance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.rootWallet
      );
      
      // Get token decimals
      const decimals = await tokenContract.decimals();
      
      // Convert amount to token units
      const amountInTokenUnits = ethers.utils.parseUnits(amount.toString(), decimals);
      
      // Check allowance
      const allowance = await tokenContract.allowance(
        this.rootWallet.address,
        this.posRootChainManager
      );
      
      // Approve if needed
      if (allowance.lt(amountInTokenUnits)) {
        const approveTx = await tokenContract.approve(
          this.posRootChainManager,
          amountInTokenUnits
        );
        
        await approveTx.wait();
      }
      
      // Prepare deposit data
      const depositData = ethers.utils.defaultAbiCoder.encode(
        ['uint256'],
        [amountInTokenUnits]
      );
      
      // Deposit tokens to Polygon
      const tx = await this.rootChainManagerContract.depositFor(
        this.rootWallet.address,
        tokenAddress,
        depositData
      );
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        tokenAddress,
        amount: amount.toString(),
        status: "Deposit initiated"
      };
    } catch (error) {
      throw new Error(`ERC20 deposit failed: ${error.message}`);
    }
  }
  
  // Withdraw POL (formerly MATIC) from Polygon to Ethereum
  async withdrawPOL(amount) {
    if (!this.childWallet) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Convert amount to wei
      const amountWei = ethers.utils.parseEther(amount.toString());
      
      // Create RootChainManager contract on Polygon
      const predicate = "0xdD6596F2029e6233DEFfaCa316e6A95217d4Dc34"; // POL predicate
      
      // Burn POL on Polygon
      const tx = await this.childWallet.sendTransaction({
        to: predicate,
        value: amountWei,
        gasLimit: 300000
      });
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        amount: ethers.utils.formatEther(amountWei),
        status: "Withdrawal initiated, waiting for checkpoint"
      };
    } catch (error) {
      throw new Error(`POL withdrawal failed: ${error.message}`);
    }
  }
  
  // Withdraw MATIC from Polygon to Ethereum (legacy name for backward compatibility)
  async withdrawMATIC(amount) {
    // Call the new withdrawPOL function for backward compatibility
    return this.withdrawPOL(amount);
  }
  
  // Withdraw ERC20 from Polygon to Ethereum
  async withdrawERC20(tokenAddress, amount) {
    if (!this.childWallet) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Create token contract instance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function withdraw(uint256 amount)",
          "function decimals() view returns (uint8)"
        ],
        this.childWallet
      );
      
      // Get token decimals
      const decimals = await tokenContract.decimals();
      
      // Convert amount to token units
      const amountInTokenUnits = ethers.utils.parseUnits(amount.toString(), decimals);
      
      // Burn tokens on Polygon
      const tx = await tokenContract.withdraw(amountInTokenUnits);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: receipt.from,
        tokenAddress,
        amount: amount.toString(),
        status: "Withdrawal initiated, waiting for checkpoint"
      };
    } catch (error) {
      throw new Error(`ERC20 withdrawal failed: ${error.message}`);
    }
  }
  
  // Track bridge transaction status
  async trackBridgeTransaction(txHash, network) {
    try {
      // For a real implementation, this would query the Polygon API
      // to get the status of a bridge transaction
      
      // For demonstration, we'll return a simulated status
      const statuses = [
        "Initiated",
        "CheckpointSubmitted",
        "CheckpointConfirmed",
        "ExitAvailable",
        "ExitCompleted"
      ];
      
      // Simulate a random status
      const randomStatus = statuses[Math.floor(Math.random() * 3)];
      
      return {
        transactionHash: txHash,
        network,
        status: randomStatus,
        timestamp: new Date().toISOString(),
        details: `Transaction is in ${randomStatus} state`
      };
    } catch (error) {
      throw new Error(`Failed to track transaction: ${error.message}`);
    }
  }
}

module.exports = { PolygonBridge };
