private async evaluate(args: { code: string }) {
    if (!this.page) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No page open. Call navigate first.'
      );
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

  private async getHtml(args: { selector?: string }) {
    if (!this.page) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No page open. Call navigate first.'
      );
    }

    console.error(`Getting HTML content...`);
    let html: string;
    
    if (args.selector) {
      // Get HTML of a specific element
      html = await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? element.outerHTML : 'Element not found';
      }, args.selector);
    } else {
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

  private async scrollTo(args: { x?: number; y?: number; selector?: string }) {
    if (!this.page) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No page open. Call navigate first.'
      );
    }

    console.error(`Scrolling...`);
    
    try {
      if (args.selector) {
        // Use the enhanced selector strategy
        const element = await this.findElementWithRetry(args.selector);
        
        // Get element position for better logging
        const position = await this.page.evaluate((el: Element) => {
          if (!el) return { x: 0, y: 0, width: 0, height: 0 };
          const rect = el.getBoundingClientRect();
          return {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height,
          };
        }, element);
        
        // Scroll element into view
        await element.evaluate((el: Element) => {
          if (!el) return;
          el.scrollIntoView({
            block: 'center',
            inline: 'center',
          });
        });
        
        console.error(`Scrolled to element at position: ${JSON.stringify(position)}`);
      } else if (args.x !== undefined && args.y !== undefined) {
        // Scroll to specific coordinates
        await this.page.evaluate((x, y) => {
          window.scrollTo(x, y);
        }, args.x, args.y);
        
        console.error(`Scrolled to position: (${args.x}, ${args.y})`);
      } else {
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
    } catch (error) {
      // Take a screenshot of the current state to help diagnose the issue
      const screenshot = await this.page.screenshot({ encoding: 'base64' });
      
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to scroll to ${args.selector ? `element "${args.selector}"` : args.x !== undefined && args.y !== undefined ? `position (${args.x}, ${args.y})` : 'top of page'}. Error: ${(error as Error).message}`
      );
    }
  }

  private async goBack() {
    if (!this.page) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No page open. Call navigate first.'
      );
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

  private async goForward() {
    if (!this.page) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No page open. Call navigate first.'
      );
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

  private async reload() {
    if (!this.page) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No page open. Call navigate first.'
      );
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

  private async generatePdf(args: { fullPage?: boolean; landscape?: boolean }) {
    if (!this.page) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No page open. Call navigate first.'
      );
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

  private async closeBrowser() {
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
