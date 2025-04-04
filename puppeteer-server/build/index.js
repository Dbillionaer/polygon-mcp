#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';
class PuppeteerServer {
    constructor() {
        this.browser = null;
        this.page = null;
        this.selectorConfig = {
            maxRetries: 3,
            initialDelay: 100,
            maxDelay: 2000,
            backoffFactor: 1.5,
            timeout: 30000,
            debug: true
        };
        this.server = new Server({
            name: 'puppeteer-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        // Error handling
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.closeBrowser();
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'findElement',
                    description: 'Find an element using multiple selector strategies and get detailed information',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            selector: {
                                type: 'string',
                                description: 'Primary selector to try (CSS, XPath, or text content)',
                            },
                            strategies: {
                                type: 'array',
                                description: 'Selector strategies to try: css, xpath, text, aria, id, name, class',
                                items: {
                                    type: 'string',
                                    enum: ['css', 'xpath', 'text', 'aria', 'id', 'name', 'class']
                                }
                            },
                            includeHtml: {
                                type: 'boolean',
                                description: 'Whether to include HTML of the found element',
                            },
                            includeContext: {
                                type: 'boolean',
                                description: 'Whether to include surrounding HTML context',
                            }
                        },
                        required: ['selector'],
                    },
                },
                {
                    name: 'navigate',
                    description: 'Navigate to a URL',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'URL to navigate to',
                            },
                            waitUntil: {
                                type: 'string',
                                description: 'When to consider navigation succeeded: load, domcontentloaded, networkidle0, networkidle2',
                                enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
                            },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'screenshot',
                    description: 'Take a screenshot of the current page',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            fullPage: {
                                type: 'boolean',
                                description: 'Whether to take a screenshot of the full page or just the viewport',
                            },
                            selector: {
                                type: 'string',
                                description: 'CSS selector of the element to screenshot (optional)',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'click',
                    description: 'Click on an element',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            selector: {
                                type: 'string',
                                description: 'CSS selector of the element to click',
                            },
                        },
                        required: ['selector'],
                    },
                },
                {
                    name: 'type',
                    description: 'Type text into an input field',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            selector: {
                                type: 'string',
                                description: 'CSS selector of the input field',
                            },
                            text: {
                                type: 'string',
                                description: 'Text to type',
                            },
                        },
                        required: ['selector', 'text'],
                    },
                },
                {
                    name: 'waitForSelector',
                    description: 'Wait for an element to appear on the page',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            selector: {
                                type: 'string',
                                description: 'CSS selector to wait for',
                            },
                            timeout: {
                                type: 'number',
                                description: 'Maximum time to wait in milliseconds',
                            },
                            visible: {
                                type: 'boolean',
                                description: 'Wait for element to be visible',
                            },
                            strategies: {
                                type: 'array',
                                description: 'Selector strategies to try',
                                items: {
                                    type: 'string',
                                    enum: ['css', 'xpath', 'text', 'aria', 'id', 'name', 'class']
                                }
                            },
                        },
                        required: ['selector'],
                    },
                },
                {
                    name: 'evaluate',
                    description: 'Execute JavaScript code in the browser context',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            code: {
                                type: 'string',
                                description: 'JavaScript code to execute',
                            },
                        },
                        required: ['code'],
                    },
                },
                {
                    name: 'getHtml',
                    description: 'Get the HTML content of the page or a specific element',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            selector: {
                                type: 'string',
                                description: 'CSS selector of the element (optional, defaults to entire page)',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'scrollTo',
                    description: 'Scroll to a specific position on the page',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            x: {
                                type: 'number',
                                description: 'X position to scroll to',
                            },
                            y: {
                                type: 'number',
                                description: 'Y position to scroll to',
                            },
                            selector: {
                                type: 'string',
                                description: 'CSS selector of element to scroll into view (alternative to x,y)',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'goBack',
                    description: 'Navigate back in browser history',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
                {
                    name: 'goForward',
                    description: 'Navigate forward in browser history',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
                {
                    name: 'reload',
                    description: 'Reload the current page',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
                {
                    name: 'pdf',
                    description: 'Generate a PDF of the current page',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            fullPage: {
                                type: 'boolean',
                                description: 'Whether to include the full page or just the viewport',
                            },
                            landscape: {
                                type: 'boolean',
                                description: 'Whether to use landscape orientation',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'close',
                    description: 'Close the browser',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'findElement':
                        return await this.findElement(args);
                    case 'navigate':
                        return await this.navigate(args);
                    case 'screenshot':
                        return await this.screenshot(args);
                    case 'click':
                        return await this.click(args);
                    case 'type':
                        return await this.type(args);
                    case 'waitForSelector':
                        return await this.waitForSelector(args);
                    case 'evaluate':
                        return await this.evaluate(args);
                    case 'getHtml':
                        return await this.getHtml(args);
                    case 'scrollTo':
                        return await this.scrollTo(args);
                    case 'goBack':
                        return await this.goBack();
                    case 'goForward':
                        return await this.goForward();
                    case 'reload':
                        return await this.reload();
                    case 'pdf':
                        return await this.generatePdf(args);
                    case 'close':
                        return await this.closeBrowser();
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                console.error(`Error in tool ${name}:`, error);
                if (error instanceof McpError) {
                    throw error;
                }
                throw new McpError(ErrorCode.InternalError, `Error executing ${name}: ${error.message}`);
            }
        });
    }
    async ensureBrowser() {
        if (!this.browser) {
            console.error('Launching browser...');
            this.browser = await puppeteer.launch({
                headless: false,
                defaultViewport: { width: 1280, height: 800 },
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            console.error('Browser launched');
            // Wait a bit for the browser to fully initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!this.page) {
            console.error('Creating new page...');
            this.page = await this.browser.newPage();
            console.error('New page created');
            // Wait for the page to be ready
            await this.page.evaluateHandle(() => document.body);
        }
        return this.page;
    }
    /**
     * Utility function to find an element using multiple selector strategies with retry mechanism
     */
    async findElementWithRetry(selector, strategies = ['css', 'xpath', 'text'], options = {}) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        const timeout = options.timeout || this.selectorConfig.timeout;
        const visible = options.visible !== undefined ? options.visible : true;
        let lastError = null;
        let debugInfo = [];
        // Try each strategy with retries
        for (const strategy of strategies) {
            let currentSelector = selector;
            // Convert selector based on strategy
            if (strategy === 'xpath' && !selector.startsWith('//') && !selector.startsWith('(//')) {
                currentSelector = `//*[contains(text(), "${selector}")]`;
            }
            else if (strategy === 'text') {
                currentSelector = `text/${selector}`;
            }
            else if (strategy === 'aria') {
                currentSelector = `[aria-label="${selector}"], [aria-labelledby="${selector}"]`;
            }
            else if (strategy === 'id') {
                currentSelector = `#${selector}`;
            }
            else if (strategy === 'name') {
                currentSelector = `[name="${selector}"]`;
            }
            else if (strategy === 'class') {
                currentSelector = `.${selector}`;
            }
            // Add debug info
            debugInfo.push(`Trying strategy: ${strategy} with selector: ${currentSelector}`);
            // Retry logic with exponential backoff
            for (let attempt = 0; attempt < this.selectorConfig.maxRetries; attempt++) {
                try {
                    let element = null;
                    if (strategy === 'xpath') {
                        const elements = await this.page.$x(currentSelector);
                        if (elements.length > 0) {
                            // Cast to ElementHandle<Element>
                            element = elements[0];
                        }
                    }
                    else if (strategy === 'text') {
                        // Use page.evaluate to find by text content
                        const elementId = await this.page.evaluate((text) => {
                            const elements = [...document.querySelectorAll('*')].filter(el => el.textContent && el.textContent.includes(text));
                            if (elements.length > 0) {
                                const id = `temp-id-${Date.now()}`;
                                elements[0].setAttribute('data-puppeteer-temp-id', id);
                                return id;
                            }
                            return null;
                        }, selector);
                        if (elementId) {
                            element = await this.page.$(`[data-puppeteer-temp-id="${elementId}"]`);
                            // Clean up the temporary attribute
                            await this.page.evaluate((id) => {
                                const el = document.querySelector(`[data-puppeteer-temp-id="${id}"]`);
                                if (el)
                                    el.removeAttribute('data-puppeteer-temp-id');
                            }, elementId);
                        }
                    }
                    else {
                        // CSS selector and other strategies
                        element = await this.page.$(currentSelector);
                    }
                    if (element) {
                        // Check visibility if required
                        if (visible) {
                            const isVisible = await this.page.evaluate((el) => {
                                const style = window.getComputedStyle(el);
                                return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                            }, element);
                            if (!isVisible) {
                                debugInfo.push(`Element found with ${strategy} but not visible`);
                                throw new Error(`Element found with ${strategy} but not visible`);
                            }
                        }
                        debugInfo.push(`Element found successfully with ${strategy} on attempt ${attempt + 1}`);
                        return element;
                    }
                }
                catch (error) {
                    lastError = error;
                    debugInfo.push(`Attempt ${attempt + 1} failed: ${error.message}`);
                    // Only delay if we have more attempts to go
                    if (attempt < this.selectorConfig.maxRetries - 1) {
                        const delay = Math.min(this.selectorConfig.initialDelay * Math.pow(this.selectorConfig.backoffFactor, attempt), this.selectorConfig.maxDelay);
                        debugInfo.push(`Waiting ${delay}ms before next attempt`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
        }
        // If we get here, all strategies and retries failed
        const errorMessage = `Failed to find element with selector: ${selector}. Debug info: ${debugInfo.join(' | ')}`;
        console.error(errorMessage);
        if (this.selectorConfig.debug && this.page) {
            // Take a debug screenshot to help diagnose the issue
            const debugScreenshot = await this.page.screenshot({ encoding: 'base64' });
            console.error('Debug screenshot taken');
            // Get page HTML for context
            const html = await this.page.content();
            console.error(`Page HTML context (first 500 chars): ${html.substring(0, 500)}...`);
        }
        throw new McpError(ErrorCode.InvalidRequest, errorMessage);
    }
    /**
     * New tool to help diagnose selector issues
     */
    async findElement(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Finding element with selector: ${args.selector}...`);
        const strategies = args.strategies || ['css', 'xpath', 'text', 'aria', 'id', 'name', 'class'];
        try {
            const element = await this.findElementWithRetry(args.selector, strategies);
            // Get element details
            const details = await this.page.evaluate((el) => {
                if (!el)
                    return null;
                const rect = el.getBoundingClientRect();
                return {
                    tagName: el.tagName,
                    id: el.id || '',
                    className: el.className || '',
                    textContent: el.textContent?.trim().substring(0, 100) || '',
                    attributes: Array.from(el.attributes || []).map(attr => `${attr.name}="${attr.value}"`),
                    position: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                    },
                    isVisible: window.getComputedStyle(el).display !== 'none' &&
                        window.getComputedStyle(el).visibility !== 'hidden',
                };
            }, element);
            // Get HTML if requested
            let html = '';
            if (args.includeHtml) {
                html = await this.page.evaluate((el) => el ? el.outerHTML : '', element);
            }
            // Get context if requested
            let context = '';
            if (args.includeContext) {
                context = await this.page.evaluate((el) => {
                    if (!el)
                        return '';
                    // Get parent and siblings for context
                    const parent = el.parentElement;
                    return parent ? parent.outerHTML : '';
                }, element);
            }
            // Take a screenshot highlighting the element
            await this.page.evaluate((el) => {
                if (!el)
                    return { originalOutline: '', originalBackground: '' };
                const originalOutline = el.style.outline;
                const originalBackground = el.style.background;
                el.style.outline = '3px solid red';
                el.style.background = 'rgba(255, 0, 0, 0.2)';
                return { originalOutline, originalBackground };
            }, element);
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            // Restore original styles
            await this.page.evaluate((el, styles) => {
                if (!el)
                    return;
                el.style.outline = styles.originalOutline;
                el.style.background = styles.originalBackground;
            }, element, { originalOutline: '', originalBackground: '' });
            return {
                content: [
                    {
                        type: 'text',
                        text: `Element found with selector: ${args.selector}\n\nDetails:\n${JSON.stringify(details, null, 2)}${args.includeHtml ? `\n\nHTML:\n${html}` : ''}${args.includeContext ? `\n\nContext:\n${context}` : ''}`,
                    },
                    {
                        type: 'image',
                        mimeType: 'image/png',
                        data: screenshot,
                    },
                ],
            };
        }
        catch (error) {
            // Take a screenshot of the current state to help diagnose the issue
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to find element with selector: ${args.selector}\n\nError: ${error.message}`,
                    },
                    {
                        type: 'image',
                        mimeType: 'image/png',
                        data: screenshot,
                    },
                ],
            };
        }
    }
    async navigate(args) {
        try {
            // Close any existing browser to start fresh
            if (this.browser) {
                await this.closeBrowser();
            }
            // Launch a new browser and page
            console.error('Launching browser...');
            this.browser = await puppeteer.launch({
                headless: false,
                defaultViewport: { width: 1280, height: 800 },
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            console.error('Browser launched');
            // Create a new page
            console.error('Creating new page...');
            this.page = await this.browser.newPage();
            console.error('New page created');
            // Navigate to the URL
            console.error(`Navigating to ${args.url}...`);
            await this.page.goto(args.url, {
                waitUntil: args.waitUntil || 'networkidle0',
                timeout: 60000 // Increase timeout to 60 seconds
            });
            console.error('Navigation complete');
            // Wait a bit for the page to stabilize
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Get page title and screenshot
            const title = await this.page.title();
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            return {
                content: [
                    {
                        type: 'text',
                        text: `Navigated to ${args.url}\nPage title: ${title}`,
                    },
                    {
                        type: 'image',
                        mimeType: 'image/png',
                        data: screenshot,
                    },
                ],
            };
        }
        catch (error) {
            console.error(`Error navigating to ${args.url}:`, error);
            // Try to take a screenshot if possible
            let screenshot = '';
            try {
                if (this.page) {
                    screenshot = await this.page.screenshot({ encoding: 'base64' });
                }
            }
            catch (screenshotError) {
                console.error('Failed to take error screenshot:', screenshotError);
            }
            throw new McpError(ErrorCode.InternalError, `Error navigating to ${args.url}: ${error.message}`);
        }
    }
    async screenshot(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error('Taking screenshot...');
        let screenshot;
        if (args.selector) {
            // Take screenshot of a specific element
            const elementHandle = await this.page.$(args.selector);
            if (!elementHandle) {
                throw new McpError(ErrorCode.InvalidRequest, `Element with selector "${args.selector}" not found`);
            }
            screenshot = await elementHandle.screenshot({ encoding: 'base64' });
        }
        else {
            // Take screenshot of the entire page or viewport
            screenshot = await this.page.screenshot({
                fullPage: args.fullPage,
                encoding: 'base64',
            });
        }
        console.error('Screenshot taken');
        return {
            content: [
                {
                    type: 'text',
                    text: args.selector
                        ? `Screenshot taken of element matching selector: ${args.selector}`
                        : 'Screenshot taken',
                },
                {
                    type: 'image',
                    mimeType: 'image/png',
                    data: screenshot,
                },
            ],
        };
    }
    async click(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Clicking on ${args.selector}...`);
        try {
            // Use the enhanced selector strategy
            const element = await this.findElementWithRetry(args.selector);
            // Get element details for better logging
            const details = await this.page.evaluate((el) => {
                if (!el)
                    return { tagName: 'unknown', id: '', className: '', textContent: '' };
                return {
                    tagName: el.tagName,
                    id: el.id || '',
                    className: el.className || '',
                    textContent: el.textContent?.trim().substring(0, 50) || '',
                };
            }, element);
            // Click the element
            await element.click();
            console.error(`Click complete on ${JSON.stringify(details)}`);
            // Take a screenshot after clicking to show the result
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            return {
                content: [
                    {
                        type: 'text',
                        text: `Clicked on element matching selector: ${args.selector}\nElement details: ${JSON.stringify(details)}`,
                    },
                    {
                        type: 'image',
                        mimeType: 'image/png',
                        data: screenshot,
                    },
                ],
            };
        }
        catch (error) {
            // Take a screenshot of the current state to help diagnose the issue
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            // Get page HTML for context
            const html = await this.page.content();
            const htmlPreview = html.substring(0, 500) + '...';
            throw new McpError(ErrorCode.InvalidRequest, `Failed to click element with selector: ${args.selector}. Error: ${error.message}\nPage HTML preview: ${htmlPreview}`);
        }
    }
    async type(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Typing "${args.text}" into ${args.selector}...`);
        try {
            // Use the enhanced selector strategy
            const element = await this.findElementWithRetry(args.selector);
            // Get element details for better logging
            const details = await this.page.evaluate((el) => {
                if (!el)
                    return { tagName: 'unknown', id: '', className: '', type: '', name: '' };
                return {
                    tagName: el.tagName,
                    id: el.id || '',
                    className: el.className || '',
                    type: el.getAttribute('type'),
                    name: el.getAttribute('name'),
                };
            }, element);
            // Clear the field first (if it's an input or textarea)
            await this.page.evaluate((el) => {
                if (!el)
                    return;
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.value = '';
                }
            }, element);
            // Click and type
            await element.click();
            await element.type(args.text);
            console.error(`Typing complete into ${JSON.stringify(details)}`);
            // Take a screenshot after typing to show the result
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            return {
                content: [
                    {
                        type: 'text',
                        text: `Typed "${args.text}" into element matching selector: ${args.selector}\nElement details: ${JSON.stringify(details)}`,
                    },
                    {
                        type: 'image',
                        mimeType: 'image/png',
                        data: screenshot,
                    },
                ],
            };
        }
        catch (error) {
            // Take a screenshot of the current state to help diagnose the issue
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            // Get available input fields for context
            const inputFields = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'))
                    .map(el => ({
                    tagName: el.tagName,
                    id: el.id || '',
                    className: el.className || '',
                    type: el.getAttribute('type'),
                    name: el.getAttribute('name'),
                    placeholder: el.getAttribute('placeholder'),
                }));
            });
            throw new McpError(ErrorCode.InvalidRequest, `Failed to type into element with selector: ${args.selector}. Error: ${error.message}\nAvailable input fields: ${JSON.stringify(inputFields)}`);
        }
    }
    async waitForSelector(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Waiting for selector ${args.selector}...`);
        try {
            // Use the enhanced selector strategy with retry
            const strategies = args.strategies || ['css', 'xpath', 'text', 'aria', 'id', 'name', 'class'];
            const element = await this.findElementWithRetry(args.selector, strategies, {
                timeout: args.timeout,
                visible: args.visible
            });
            // Get element details for better logging
            const details = await this.page.evaluate((el) => {
                if (!el)
                    return { tagName: 'unknown', id: '', className: '', textContent: '', position: { x: 0, y: 0, width: 0, height: 0 } };
                const rect = el.getBoundingClientRect();
                return {
                    tagName: el.tagName,
                    id: el.id || '',
                    className: el.className || '',
                    textContent: el.textContent?.trim().substring(0, 50) || '',
                    position: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                    },
                };
            }, element);
            console.error(`Selector found: ${JSON.stringify(details)}`);
            // Highlight the element in the screenshot
            await this.page.evaluate((el) => {
                if (!el)
                    return { originalOutline: '', originalBackground: '' };
                const originalOutline = el.style.outline;
                const originalBackground = el.style.background;
                el.style.outline = '3px solid green';
                el.style.background = 'rgba(0, 255, 0, 0.2)';
                return { originalOutline, originalBackground };
            }, element);
            // Take a screenshot to show the element
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            // Restore original styles
            await this.page.evaluate((el, styles) => {
                if (!el)
                    return;
                el.style.outline = styles.originalOutline;
                el.style.background = styles.originalBackground;
            }, element, { originalOutline: '', originalBackground: '' });
            return {
                content: [
                    {
                        type: 'text',
                        text: `Element matching selector "${args.selector}" found\nElement details: ${JSON.stringify(details)}`,
                    },
                    {
                        type: 'image',
                        mimeType: 'image/png',
                        data: screenshot,
                    },
                ],
            };
        }
        catch (error) {
            // Take a screenshot of the current state to help diagnose the issue
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            throw new McpError(ErrorCode.InvalidRequest, `Failed to wait for element with selector: ${args.selector}. Error: ${error.message}`);
        }
    }
    async evaluate(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Evaluating JavaScript code...`);
        const result = await this.page.evaluate(args.code);
        console.error('Evaluation complete');
        // Take a screenshot after evaluation
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        return {
            content: [
                {
                    type: 'text',
                    text: `JavaScript evaluation result: ${JSON.stringify(result, null, 2)}`,
                },
                {
                    type: 'image',
                    mimeType: 'image/png',
                    data: screenshot,
                },
            ],
        };
    }
    async getHtml(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Getting HTML content...`);
        let html;
        if (args.selector) {
            // Get HTML of a specific element
            html = await this.page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? element.outerHTML : 'Element not found';
            }, args.selector);
        }
        else {
            // Get HTML of the entire page
            html = await this.page.content();
        }
        console.error('HTML content retrieved');
        return {
            content: [
                {
                    type: 'text',
                    text: html,
                },
            ],
        };
    }
    async scrollTo(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Scrolling...`);
        try {
            if (args.selector) {
                // Use the enhanced selector strategy
                const element = await this.findElementWithRetry(args.selector);
                // Get element position for better logging
                const position = await this.page.evaluate((el) => {
                    if (!el)
                        return { x: 0, y: 0, width: 0, height: 0 };
                    const rect = el.getBoundingClientRect();
                    return {
                        x: rect.x + window.scrollX,
                        y: rect.y + window.scrollY,
                        width: rect.width,
                        height: rect.height,
                    };
                }, element);
                // Scroll element into view
                await element.evaluate((el) => {
                    if (!el)
                        return;
                    el.scrollIntoView({
                        block: 'center',
                        inline: 'center',
                    });
                });
                console.error(`Scrolled to element at position: ${JSON.stringify(position)}`);
            }
            else if (args.x !== undefined && args.y !== undefined) {
                // Scroll to specific coordinates
                await this.page.evaluate((x, y) => {
                    window.scrollTo(x, y);
                }, args.x, args.y);
                console.error(`Scrolled to position: (${args.x}, ${args.y})`);
            }
            else {
                // Default: scroll to top
                await this.page.evaluate(() => {
                    window.scrollTo(0, 0);
                });
                console.error('Scrolled to top of page');
            }
            // Take a screenshot after scrolling
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            // Get current scroll position
            const scrollPosition = await this.page.evaluate(() => {
                return {
                    x: window.scrollX,
                    y: window.scrollY,
                    maxX: document.documentElement.scrollWidth - window.innerWidth,
                    maxY: document.documentElement.scrollHeight - window.innerHeight,
                };
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: `Scrolled to ${args.selector ? `element "${args.selector}"` : args.x !== undefined && args.y !== undefined ? `position (${args.x}, ${args.y})` : 'top of page'}\nCurrent scroll position: ${JSON.stringify(scrollPosition)}`,
                    },
                    {
                        type: 'image',
                        mimeType: 'image/png',
                        data: screenshot,
                    },
                ],
            };
        }
        catch (error) {
            // Take a screenshot of the current state to help diagnose the issue
            const screenshot = await this.page.screenshot({ encoding: 'base64' });
            throw new McpError(ErrorCode.InvalidRequest, `Failed to scroll to ${args.selector ? `element "${args.selector}"` : args.x !== undefined && args.y !== undefined ? `position (${args.x}, ${args.y})` : 'top of page'}. Error: ${error.message}`);
        }
    }
    async goBack() {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Navigating back...`);
        await this.page.goBack();
        console.error('Navigation complete');
        const title = await this.page.title();
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        return {
            content: [
                {
                    type: 'text',
                    text: `Navigated back\nPage title: ${title}`,
                },
                {
                    type: 'image',
                    mimeType: 'image/png',
                    data: screenshot,
                },
            ],
        };
    }
    async goForward() {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Navigating forward...`);
        await this.page.goForward();
        console.error('Navigation complete');
        const title = await this.page.title();
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        return {
            content: [
                {
                    type: 'text',
                    text: `Navigated forward\nPage title: ${title}`,
                },
                {
                    type: 'image',
                    mimeType: 'image/png',
                    data: screenshot,
                },
            ],
        };
    }
    async reload() {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Reloading page...`);
        await this.page.reload();
        console.error('Reload complete');
        const title = await this.page.title();
        const screenshot = await this.page.screenshot({ encoding: 'base64' });
        return {
            content: [
                {
                    type: 'text',
                    text: `Page reloaded\nPage title: ${title}`,
                },
                {
                    type: 'image',
                    mimeType: 'image/png',
                    data: screenshot,
                },
            ],
        };
    }
    async generatePdf(args) {
        if (!this.page) {
            throw new McpError(ErrorCode.InvalidRequest, 'No page open. Call navigate first.');
        }
        console.error(`Generating PDF...`);
        const pdfBuffer = await this.page.pdf({
            format: 'A4',
            printBackground: true,
            landscape: args.landscape,
            margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        });
        console.error('PDF generated');
        return {
            content: [
                {
                    type: 'text',
                    text: 'PDF generated',
                },
                {
                    type: 'file',
                    mimeType: 'application/pdf',
                    data: pdfBuffer.toString('base64'),
                    filename: 'page.pdf',
                },
            ],
        };
    }
    async closeBrowser() {
        if (this.browser) {
            console.error('Closing browser...');
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.error('Browser closed');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: 'Browser closed',
                },
            ],
        };
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Puppeteer MCP server running on stdio');
    }
}
const server = new PuppeteerServer();
server.run().catch(console.error);
