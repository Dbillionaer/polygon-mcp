// wallet-manager.test.js - Tests for WalletManager
const walletManager = require('../common/wallet-manager');
const { JsonRpcProvider } = require('ethers');
const { ErrorCodes } = require('../errors');

// Mock ethers
jest.mock('ethers', () => {
  const originalModule = jest.requireActual('ethers');
  
  // Mock Wallet class
  const MockWallet = jest.fn().mockImplementation((privateKey, provider) => {
    return {
      address: '0xMockWalletAddress',
      privateKey,
      provider,
      connect: jest.fn().mockReturnThis()
    };
  });
  
  return {
    ...originalModule,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(1000000000000000000n)
    })),
    Wallet: MockWallet
  };
});

// Mock logger
jest.mock('../logger', () => ({
  defaultLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WalletManager', () => {
  let mockProvider;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockProvider = new JsonRpcProvider();
    walletManager.providers.clear();
    walletManager.wallets.clear();
    walletManager.registerProvider('ethereum', mockProvider);
    walletManager.registerProvider('polygon', mockProvider);
  });
  
  describe('connectWallet', () => {
    it('should throw an error if private key is not provided', () => {
      expect(() => {
        walletManager.connectWallet(null, 'ethereum');
      }).toThrow(ErrorCodes.WALLET_NOT_CONNECTED);
    });
    
    it('should throw an error if network has no registered provider', () => {
      expect(() => {
        walletManager.connectWallet('0xMockPrivateKey', 'unknown-network');
      }).toThrow(ErrorCodes.INVALID_NETWORK);
    });
    
    it('should connect wallet successfully', () => {
      const wallet = walletManager.connectWallet('0xMockPrivateKey', 'ethereum');
      expect(wallet).toBeDefined();
      expect(wallet.address).toBe('0xMockWalletAddress');
      
      // Verify the wallet was added to the map
      expect(walletManager.isWalletConnected('ethereum')).toBe(true);
      expect(walletManager.getWallet('ethereum')).toBe(wallet);
    });
  });
  
  describe('getWallet', () => {
    it('should throw an error if wallet is not connected', () => {
      expect(() => {
        walletManager.getWallet('ethereum');
      }).toThrow(ErrorCodes.WALLET_NOT_CONNECTED);
    });
    
    it('should return the connected wallet', () => {
      const wallet = walletManager.connectWallet('0xMockPrivateKey', 'ethereum');
      const retrievedWallet = walletManager.getWallet('ethereum');
      expect(retrievedWallet).toBe(wallet);
    });
  });
  
  describe('connectToMultipleNetworks', () => {
    it('should throw an error if networks array is empty', () => {
      expect(() => {
        walletManager.connectToMultipleNetworks('0xMockPrivateKey', []);
      }).toThrow(ErrorCodes.INVALID_PARAMETERS);
    });
    
    it('should connect to multiple networks', () => {
      const result = walletManager.connectToMultipleNetworks('0xMockPrivateKey', ['ethereum', 'polygon']);
      expect(result.ethereum).toBeDefined();
      expect(result.polygon).toBeDefined();
      expect(walletManager.isWalletConnected('ethereum')).toBe(true);
      expect(walletManager.isWalletConnected('polygon')).toBe(true);
    });
  });
  
  describe('getAddress', () => {
    it('should return wallet address', () => {
      walletManager.connectWallet('0xMockPrivateKey', 'ethereum');
      const address = walletManager.getAddress('ethereum');
      expect(address).toBe('0xMockWalletAddress');
    });
  });
});
