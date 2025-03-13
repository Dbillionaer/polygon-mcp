// test-polygon-mcp.js - Simple test script for Polygon MCP Server
const { mcpServer } = require('./polygon MCP');
const { defaultLogger } = require('./logger');

// Configure logger
const logger = defaultLogger;

// Test function to run a series of tests
async function runTests() {
  logger.info('Starting Polygon MCP Server tests');
  
  try {
    // Test 1: Get wallet address
    logger.info('Test 1: Get wallet address');
    const addressResult = await mcpServer.tools['get-address']();
    logger.info('Wallet address result:', addressResult);
    
    // Test 2: Get gas price
    logger.info('Test 2: Get gas price');
    const gasPriceResult = await mcpServer.tools['get-gas-price']();
    logger.info('Gas price result:', gasPriceResult);
    
    // Test 3: List balances (should show POL)
    logger.info('Test 3: List balances');
    const balancesResult = await mcpServer.tools['list-balances']();
    logger.info('Balances result:', {
      success: true,
      address: balancesResult.address,
      networkName: balancesResult.network,
      balanceCount: balancesResult.balances.length,
      nativeToken: balancesResult.balances[0].token
    });
    
    // Test 4: List contract templates
    logger.info('Test 4: List contract templates');
    const templatesResult = await mcpServer.tools['list-contract-templates']();
    logger.info('Contract templates result:', {
      success: templatesResult.success,
      templateCount: templatesResult.templates ? templatesResult.templates.length : 0
    });
    
    // Test 5: Switch network
    logger.info('Test 5: Switch network');
    // Switch to mainnet
    const switchToMainnetResult = await mcpServer.tools['switch-network']({ network: 'mainnet' });
    logger.info('Switch to mainnet result:', switchToMainnetResult);
    
    // Switch back to mumbai
    const switchToMumbaiResult = await mcpServer.tools['switch-network']({ network: 'mumbai' });
    logger.info('Switch to mumbai result:', switchToMumbaiResult);
    
    logger.info('All tests completed successfully');
  } catch (error) {
    logger.error('Test failed:', { 
      error: error.message,
      stack: error.stack
    });
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runTests()
    .then(() => {
      logger.info('Tests completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Tests failed:', { 
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
}

module.exports = { runTests };
