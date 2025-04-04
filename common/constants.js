// constants.js - Shared constants and ABIs
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)'
];

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] memory accounts, uint256[] memory ids) view returns (uint256[] memory)',
  'function uri(uint256 id) view returns (string)',
  'function isApprovedForAll(address account, address operator) view returns (bool)'
];

// Network-specific token addresses
const NETWORK_TOKEN_ADDRESSES = {
  // Mainnet token addresses (using POL, formerly MATIC)
  'mainnet': {
    'WPOL': process.env.WPOL_MAINNET || '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Sam address as WMATIC
    'WETH': process.env.WETH_MAINNET || '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    'USDC': process.env.USDC_MAINNET || '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'USDT': process.env.USDT_MAINNET || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'DAI': process.env.DAI_MAINNET || '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
  },
  // Amoy testnet token addresses (using POL)
  'amoy': {
    'WPOL': process.env.WPOL_AMOY || '0x0000000000000000000000000000000000000000',
    'WETH': process.env.WETH_AMOY || '0x0000000000000000000000000000000000000000',
    'USDC': process.env.USDC_AMOY || '0x0000000000000000000000000000000000000000',
    'USDT': process.env.USDT_AMOY || '0x0000000000000000000000000000000000000000',
    'DAI': process.env.DAI_AMOY || '0x0000000000000000000000000000000000000000'
  }
};

// Default to mainnet addresses for backward compatibility
const DEFAULT_TOKEN_ADDRESSES = NETWORK_TOKEN_ADDRESSES['mainnet'];

// ERC20 transfer function signature
const ERC20_TRANSFER_SIGNATURE = '0xa9059cbb';

export {
  ERC20_ABI,
  ERC721_ABI,
  ERC1155_ABI,
  DEFAULT_TOKEN_ADDRESSES,
  NETWORK_TOKEN_ADDRESSES,
  ERC20_TRANSFER_SIGNATURE
};
