// contract-templates.js - Smart Contract Templates and Deployment
const ethers = require('ethers');
const axios = require('axios');

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
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    
    // Initialize templates
    this.templates = {
      erc20: {
        name: "ERC20Token",
        code: ERC20_TEMPLATE,
        description: "Standard ERC20 token with minting capability",
        parameters: {
          name: "string",
          symbol: "string",
          initialSupply: "uint256"
        }
      },
      nft: {
        name: "NFTCollection",
        code: NFT_TEMPLATE,
        description: "ERC721 NFT collection with minting capability",
        parameters: {
          name: "string",
          symbol: "string",
          baseURI: "string"
        }
      },
      staking: {
        name: "StakingContract",
        code: STAKING_TEMPLATE,
        description: "Simple staking contract with rewards",
        parameters: {
          stakingToken: "address",
          rewardToken: "address",
          rewardRate: "uint256"
        }
      },
      multisig: {
        name: "MultisigWallet",
        code: MULTISIG_TEMPLATE,
        description: "Multi-signature wallet",
        parameters: {
          owners: "address[]",
          required: "uint256"
        }
      }
    };
  }
  
  // Connect wallet for operations
  connectWallet(privateKey) {
    this.wallet = new ethers.Wallet(privateKey, this.provider);
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
    let code = template.code.replace(/{{name}}/g, parameters.name || template.name);
    
    // For a real implementation, this would do more sophisticated template processing
    // based on the parameters
    
    return {
      name: parameters.name || template.name,
      code
    };
  }
  
  // Deploy contract from template
  async deployFromTemplate(templateId, parameters, constructorArgs) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    try {
      const contract = this.prepareContract(templateId, parameters);
      
      // For a real implementation, this would compile the contract
      // and deploy it using the compiled bytecode and ABI
      
      // For demonstration, we'll simulate a deployment
      const deploymentResult = {
        address: "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        transactionHash: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        contractName: contract.name
      };
      
      return deploymentResult;
    } catch (error) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }
  
  // Deploy custom contract
  async deployContract(contractName, contractCode, constructorArgs) {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // For a real implementation, this would compile the contract
      // and deploy it using the compiled bytecode and ABI
      
      // For demonstration, we'll simulate a deployment
      const deploymentResult = {
        address: "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        transactionHash: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        contractName
      };
      
      return deploymentResult;
    } catch (error) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }
  
  // Verify contract on block explorer
  async verifyContract(contractAddress, contractName, contractCode, constructorArgs) {
    if (!this.explorerApiKey) {
      throw new Error("Explorer API key not provided");
    }
    
    try {
      // For a real implementation, this would call the block explorer API
      // to verify the contract
      
      // For demonstration, we'll simulate a verification
      return {
        status: "Verification submitted",
        guid: "verification-" + Math.random().toString(36).substring(2, 10)
      };
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }
}

module.exports = { ContractTemplates };
