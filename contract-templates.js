// contract-templates.js - Smart Contract Templates and Deployment
import { JsonRpcProvider, Interface, isAddress, ContractFactory } from 'ethers'; // Use import, add ContractFactory
import axios from 'axios'; // Use import
import { ErrorCodes, createTransactionError, createWalletError } from './errors.js'; // Use import and add .js
import { defaultLogger } from './logger.js'; // Use import and add .js
import walletManager from './common/wallet-manager.js'; // Use import andd add .js

// Basic ERC20 template
const ERC20_TEMPLATE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract {{name}} is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
`;

// Basic NFT template
const NFT_TEMPLATE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract {{name}} is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    string public baseURI;
    
    constructor(
        string memory name,
        string memory symbol,
        string memory _baseURI
    ) ERC721(name, symbol) {
        baseURI = _baseURI;
    }
    
    function mintNFT(address recipient, string memory tokenURI)
        public onlyOwner
        returns (uint256)
    {
        _tokenIds.increment();
        
        uint256 newItemId = _tokenIds.current();
        _mint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);
        
        return newItemId;
    }
    
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
    
    function setBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;
    }
}
`;

// Simple staking contract template
const STAKING_TEMPLATE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract {{name}} is Ownable, ReentrancyGuard {
    IERC20 public stakingToken;
    IERC20 public rewardToken;
    
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public balances;
    
    uint256 public totalSupply;
    
    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardRate
    ) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
        lastUpdateTime = block.timestamp;
    }
    
    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / totalSupply);
    }
    
    function earned(address account) public view returns (uint256) {
        return
            ((balances[account] *
                (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) +
            rewards[account];
    }
    
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
    
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        totalSupply += amount;
        balances[msg.sender] += amount;
        stakingToken.transferFrom(msg.sender, address(this), amount);
    }
    
    function withdraw(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        totalSupply -= amount;
        balances[msg.sender] -= amount;
        stakingToken.transfer(msg.sender, amount);
    }
    
    function getReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.transfer(msg.sender, reward);
        }
    }
    
    function setRewardRate(uint256 _rewardRate) external onlyOwner updateReward(address(0)) {
        rewardRate = _rewardRate;
    }
}
`;

// Multisig wallet template
const MULTISIG_TEMPLATE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract {{name}} {
    address[] public owners;
    uint public required;
    
    struct Transaction {
        address destination;
        uint value;
        bytes data;
        bool executed;
        mapping(address => bool) confirmations;
    }
    
    Transaction[] public transactions;
    
    event Confirmation(address indexed sender, uint indexed transactionId);
    event Submission(uint indexed transactionId);
    event Execution(uint indexed transactionId);
    event ExecutionFailure(uint indexed transactionId);
    
    modifier onlyOwner() {
        bool isOwner = false;
        for (uint i = 0; i < owners.length; i++) {
            if (owners[i] == msg.sender) {
                isOwner = true;
                break;
            }
        }
        require(isOwner, "Not an owner");
        _;
    }
    
    modifier txExists(uint transactionId) {
        require(transactionId < transactions.length, "Transaction does not exist");
        _;
    }
    
    modifier notExecuted(uint transactionId) {
        require(!transactions[transactionId].executed, "Transaction already executed");
        _;
    }
    
    modifier notConfirmed(uint transactionId) {
        require(!transactions[transactionId].confirmations[msg.sender], "Transaction already confirmed");
        _;
    }
    
    constructor(address[] memory _owners, uint _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required number of owners");
        
        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            owners.push(owner);
        }
        required = _required;
    }
    
    function submitTransaction(address destination, uint value, bytes memory data)
        public
        onlyOwner
        returns (uint transactionId)
    {
        transactionId = transactions.length;
        transactions.push();
        Transaction storage transaction = transactions[transactionId];
        transaction.destination = destination;
        transaction.value = value;
        transaction.data = data;
        transaction.executed = false;
        transaction.confirmations[msg.sender] = true;
        
        emit Submission(transactionId);
        emit Confirmation(msg.sender, transactionId);
    }
    
    function confirmTransaction(uint transactionId)
        public
        onlyOwner
        txExists(transactionId)
        notExecuted(transactionId)
        notConfirmed(transactionId)
    {
        transactions[transactionId].confirmations[msg.sender] = true;
        emit Confirmation(msg.sender, transactionId);
    }
    
    function executeTransaction(uint transactionId)
        public
        onlyOwner
        txExists(transactionId)
        notExecuted(transactionId)
    {
        Transaction storage transaction = transactions[transactionId];
        
        uint count = 0;
        for (uint i = 0; i < owners.length; i++) {
            if (transaction.confirmations[owners[i]])
                count += 1;
        }
        
        require(count >= required, "Not enough confirmations");
        
        transaction.executed = true;
        
        (bool success, ) = transaction.destination.call{value: transaction.value}(transaction.data);
        
        if (success)
            emit Execution(transactionId);
        else {
            emit ExecutionFailure(transactionId);
            transaction.executed = false;
        }
    }
    
    function getConfirmationCount(uint transactionId)
        public
        view
        txExists(transactionId)
        returns (uint count)
    {
        for (uint i = 0; i < owners.length; i++) {
            if (transactions[transactionId].confirmations[owners[i]])
                count += 1;
        }
    }
    
    function getTransactionCount(bool pending, bool executed)
        public
        view
        returns (uint count)
    {
        for (uint i = 0; i < transactions.length; i++) {
            if ((pending && !transactions[i].executed) ||
                (executed && transactions[i].executed))
                count += 1;
        }
    }
    
    function getOwners() public view returns (address[] memory) {
        return owners;
    }
    
    receive() external payable {}
}
`;

class ContractTemplates {
  constructor(config) {
    this.rpcUrl = config.rpcUrl;
    this.explorerApiKey = config.explorerApiKey;
    
    // Initialize provider
    this.provider = new JsonRpcProvider(this.rpcUrl);
    this.networkName = config.networkName || 'polygon'; // Store network name

    // Initialize templates
    this.templates = {
      erc20: {
        name: 'ERC20Token',
        code: ERC20_TEMPLATE,
        description: 'Standard ERC20 token with minting capability',
        parameters: {
          name: 'string',
          symbol: 'string',
          initialSupply: 'uint256'
        }
      },
      nft: {
        name: 'NFTCollection',
        code: NFT_TEMPLATE,
        description: 'ERC721 NFT collection with minting capability',
        parameters: {
          name: 'string',
          symbol: 'string',
          baseURI: 'string'
        }
      },
      staking: {
        name: 'StakingContract',
        code: STAKING_TEMPLATE,
        description: 'Simple staking contract with rewards',
        parameters: {
          stakingToken: 'address',
          rewardToken: 'address',
          rewardRate: 'uint256'
        }
      },
      multisig: {
        name: 'MultisigWallet',
        code: MULTISIG_TEMPLATE,
        description: 'Multi-signature wallet',
        parameters: {
          owners: 'address[]',
          required: 'uint256'
        }
      }
    };
  }

  // Removed redundant connectWallet method - relies on central walletManager

  // Check if wallet is connected using walletManager
  checkWalletConnected() {
    // Use the network name stored during construction
    if (!walletManager.isWalletConnected(this.networkName)) {
      throw createWalletError(
        ErrorCodes.WALLET_NOT_CONNECTED,
        `Wallet not connected for network: ${this.networkName}`,
        { context: 'ContractTemplates', network: this.networkName }
      );
    }
    return true;
  }
  
  // List available templates
  async listTemplates() {
    const templateList = [];
    
    for (const [id, template] of Object.entries(this.templates)) {
      templateList.push({
        id,
        name: template.name,
        description: template.description,
        parameters: template.parameters
      });
    }
    
    return templateList;
  }
  
  // Get template details
  async getTemplate(templateId) {
    const template = this.templates[templateId];
    
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    return {
      id: templateId,
      name: template.name,
      description: template.description,
      parameters: template.parameters,
      code: template.code
    };
  }
  
  // Prepare contract from template
  prepareContract(templateId, parameters) {
    const template = this.templates[templateId];
    
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    // Replace template name
    const code = template.code.replace(/{{name}}/g, parameters.name || template.name);
    
    // For a real implementation, this would do more sophisticated template processing
    // based on the parameters
    
    return {
      name: parameters.name || template.name,
      code
    };
  }
  
  // Compile a Solidity contract
  async compileContract(source, contractName) {
    try {
      // Import solc dynamically using ESM import()
      const solc = await import('solc');
      
      // Prepare input for the compiler
      const input = {
        language: 'Solidity',
        sources: {
          'contract.sol': {
            content: source
          }
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata']
            }
          },
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      };
      
      // Compile the contract
      const output = JSON.parse(solc.compile(JSON.stringify(input)));
      
      // Check for errors
      if (output.errors) {
        const errors = output.errors.filter(error => error.severity === 'error');
        if (errors.length > 0) {
          throw new Error(`Compilation errors: ${errors.map(e => e.message).join(', ')}`);
        }
        
        // Log warnings
        const warnings = output.errors.filter(error => error.severity === 'warning');
        for (const warning of warnings) {
          defaultLogger.warn(`Compilation warning: ${warning.message}`);
        }
      }
      
      // Get the contract
      const contractOutput = output.contracts['contract.sol'][contractName];
      if (!contractOutput) {
        throw new Error(`Contract ${contractName} not found in compiled output`);
      }
      
      return {
        abi: contractOutput.abi,
        bytecode: contractOutput.evm.bytecode.object,
        deployedBytecode: contractOutput.evm.deployedBytecode.object,
        metadata: contractOutput.metadata
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Compilation failed: ${error.message}`,
        { contractName }
      );
    }
  }
  
  // Deploy contract from template
  async deployFromTemplate(templateId, parameters, constructorArgs = []) {
    this.checkWalletConnected();
    
    try {
      // Prepare the contract from template
      const contract = this.prepareContract(templateId, parameters);
      
      // Compile the contract
      const compiledContract = await this.compileContract(contract.code, contract.name);
      
      // Deploy the contract
      const wallet = walletManager.getWallet(this.networkName); // Get wallet for deployment
      return await this.deployCompiledContract(
        contract.name,
        compiledContract.abi,
        compiledContract.bytecode,
        constructorArgs,
        wallet // Pass the wallet instance
      );
    } catch (error) {
      if (error.code && error.name) {
        throw error; // Re-throw our custom errors
      }
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Deployment failed: ${error.message}`,
        { templateId, parameters }
      );
    }
  }

  // Deploy a compiled contract
  async deployCompiledContract(contractName, abi, bytecode, constructorArgs = [], wallet) {
    // Wallet check is done before calling this or passed in
    if (!wallet) {
       this.checkWalletConnected(); // Ensure connected if not passed
       wallet = walletManager.getWallet(this.networkName);
    }

    try {
      // Create a contract factory using the provided wallet
      const factory = new ContractFactory(abi, '0x' + bytecode, wallet); // Use imported ContractFactory directly
      
      // Deploy the contract
      const deployTransaction = await factory.getDeployTransaction(...constructorArgs);
      
      // Estimate gas
      const gasEstimate = await this.provider.estimateGas({
        from: wallet.address,
        data: deployTransaction.data
      });
      
      // Add 20% buffer to gas estimate
      const gasLimit = BigInt(gasEstimate) * 120n / 100n;
      
      // Deploy with gas limit
      const tx = await wallet.sendTransaction({
        data: deployTransaction.data,
        gasLimit
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Get the contract address from the receipt
      const contractAddress = receipt.contractAddress;
      
      return {
        address: contractAddress,
        transactionHash: receipt.hash,
        contractName,
        abi,
        constructorArgs,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Contract deployment failed: ${error.message}`,
        { contractName }
      );
    }
  }
  
  // Deploy custom contract
  async deployContract(contractName, contractCode, constructorArgs = []) {
    this.checkWalletConnected(); // Ensure wallet is connected before starting

    try {
      // Compile the contract
      const compiledContract = await this.compileContract(contractCode, contractName);

      // Deploy the contract
      const wallet = walletManager.getWallet(this.networkName); // Get wallet for deployment
      return await this.deployCompiledContract(
        contractName,
        compiledContract.abi,
        compiledContract.bytecode,
        constructorArgs,
        wallet // Pass the wallet instance
      );
    } catch (error) {
      if (error.code && error.name) {
        throw error; // Re-throw our custom errors
      }
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Deployment failed: ${error.message}`,
        { contractName }
      );
    }
  }
  
  // Verify contract on block explorer
  async verifyContract(contractAddress, contractName, contractCode, constructorArgs = []) {
    if (!this.explorerApiKey) {
      throw createTransactionError(
        ErrorCodes.INVALID_PARAMETERS,
        'Explorer API key not provided',
        { context: 'ContractTemplates.verifyContract' }
      );
    }
    
    if (!isAddress(contractAddress)) {
      throw createTransactionError(
        ErrorCodes.INVALID_ADDRESS,
        'Invalid contract address',
        { contractAddress }
      );
    }
    
    try {
      // Compile the contract to get the exact bytecode and ABI
      const compiledContract = await this.compileContract(contractCode, contractName);
      
      // Prepare verification data
      const verificationData = {
        apikey: this.explorerApiKey,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: contractAddress,
        sourceCode: contractCode,
        codeformat: 'solidity-single-file',
        contractname: contractName,
        compilerversion: 'v0.8.20+commit.a1b79de6', // This should match the solc version
        optimizationUsed: 1,
        runs: 200,
        constructorArguments: this.encodeConstructorArgs(compiledContract.abi, constructorArgs)
      };
      
      // Call the Polygonscan API
      const response = await axios.post(
        'https://api.polygonscan.com/api',
        verificationData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (response.data.status === '1') {
        return {
          status: 'Verification submitted',
          guid: response.data.result,
          message: response.data.message
        };
      } else {
        throw new Error(`Verification API error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      throw createTransactionError(
        ErrorCodes.CONTRACT_ERROR,
        `Verification failed: ${error.message}`,
        { contractAddress, contractName }
      );
    }
  }
  
  // Encode constructor arguments for verification
  encodeConstructorArgs(abi, args) {
    try {
      // Find the constructor in the ABI
      const constructor = abi.find(item => item.type === 'constructor');
      
      if (!constructor || !constructor.inputs || constructor.inputs.length === 0) {
        // No constructor or no inputs
        return '';
      }
      
      // Create an interface to encode the constructor arguments
      const iface = new Interface([constructor]);
      
      // Encode the constructor arguments
      const encodedArgs = iface.encodeDeploy(args).slice(2); // Remove 0x prefix
      
      return encodedArgs;
    } catch (error) {
      defaultLogger.warn(`Failed to encode constructor args: ${error.message}`);
      return '';
    }
  }
}

export { ContractTemplates }; // Use export
