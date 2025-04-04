// logger.js - Structured logging for Polygon MCP Server
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`Created logs directory at: ${logsDir}`);
  }
} catch (error) {
  console.error(`Failed to create logs directory: ${error.message}`);
  // Fall back to console-only logging if directory creation fails
}

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Current log level (can be set via environment variable)
const currentLogLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

// Format timestamp
function formatTimestamp() {
  return new Date().toISOString();
}

// Format log entry
function formatLogEntry(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: formatTimestamp(),
    level,
    message,
    ...meta,
  }) + '\n';
}

// Write to log file
function writeToLogFile(content, filename) {
  const logPath = path.join(logsDir, filename);
  try {
    fs.appendFileSync(logPath, content);
  } catch (error) {
    console.error(`Failed to write to log file ${filename}: ${error.message}`);
    // Continue execution even if log writing fails
  }
}

// Console output with color
function consoleOutput(level, message, meta = {}) {
  const colors = {
    ERROR: '\x1b[31m', // Red
    WARN: '\x1b[33m',  // Yellow
    INFO: '\x1b[36m',  // Cyan
    DEBUG: '\x1b[90m', // Gray
    RESET: '\x1b[0m',  // Reset
  };
  
  const timestamp = formatTimestamp();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  
  console.log(
    `${colors[level]}[${timestamp}] [${level}]${colors.RESET} ${message} ${metaStr}`
  );
}

// Logger implementation
class Logger {
  constructor(options = {}) {
    this.service = options.service || 'polygon-mcp';
    this.logToConsole = options.console !== false;
    this.logToFile = options.file !== false;
  }
  
  // Log method (internal)
  log(level, message, meta = {}) {
    // Add service name to metadata
    const enrichedMeta = {
      service: this.service,
      ...meta,
    };
    
    // Check if we should log this level
    if (LOG_LEVELS[level] <= currentLogLevel) {
      // Console output
      if (this.logToConsole) {
        consoleOutput(level, message, enrichedMeta);
      }
      
      // File output
      if (this.logToFile) {
        const logEntry = formatLogEntry(level, message, enrichedMeta);
        writeToLogFile(logEntry, 'combined.log');
        
        // Also write to level-specific log file
        if (level === 'ERROR') {
          writeToLogFile(logEntry, 'error.log');
        }
      }
    }
  }
  
  // Public logging methods
  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }
  
  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }
  
  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }
  
  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }
}

// Create and export default logger instance
const defaultLogger = new Logger();

module.exports = {
  Logger,
  defaultLogger,
  LOG_LEVELS,
};
