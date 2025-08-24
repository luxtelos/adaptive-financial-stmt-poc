import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

const reportLogger = logger.child('ReportGeneration');

export interface MonthlyReportRequest {
  month: number;
  year: number;
  realmId: string;
  token: string;
}

export interface MonthlyReportData {
  plMTD?: any;
  plQTD?: any;
  balanceSheet?: any;
  cashFlow?: any;
  ar?: any;
  ap?: any;
  metadata?: {
    month: number;
    year: number;
    quarter: number;
    generatedAt: string;
  };
}

export interface ReportGenerationResult {
  success: boolean;
  data?: {
    rawData: MonthlyReportData;
    llmReport?: string;
    detailedAnalysis?: string;
    pdfUrl?: string;
    pdfBlob?: Blob;
  };
  error?: string;
}

class ReportGenerationService {
  private n8nMonthlyReportUrl: string;
  private perplexityApiKey: string;
  private perplexityModel: string;
  private pdfApiUrl: string;
  private systemPrompt: string;

  constructor() {
    // Use proxy for n8n monthly report to avoid CORS
    const n8nUrl = import.meta.env.VITE_N8N_QBO_API_MNTHLY_STMT || '';
    const isDev = import.meta.env.DEV;
    
    if (isDev && n8nUrl.includes('n8n-1-102-1-c1zi.onrender.com')) {
      // Convert to proxied URL for local development
      this.n8nMonthlyReportUrl = n8nUrl.replace(
        'https://n8n-1-102-1-c1zi.onrender.com/webhook',
        '/proxy/n8n'
      );
      reportLogger.debug('Using proxied n8n URL for development:', this.n8nMonthlyReportUrl);
    } else {
      // In production, use the direct URL (Netlify will handle via redirects if needed)
      this.n8nMonthlyReportUrl = n8nUrl;
    }
    
    this.perplexityApiKey = import.meta.env.VITE_PERPLEXITY_API_KEY || '';
    this.perplexityModel = import.meta.env.VITE_PERPLEXITY_MODEL || 'sonar-reasoning-pro';
    
    // PDF API works without proxy - use direct URL
    this.pdfApiUrl = import.meta.env.VITE_PDF_API_URL || '';
    
    // Load system prompt
    this.systemPrompt = '';
    this.loadSystemPrompt();
  }

  private async loadSystemPrompt() {
    try {
      const response = await fetch('/prompt.txt');
      if (response.ok) {
        this.systemPrompt = await response.text();
        reportLogger.debug('System prompt loaded successfully');
      } else {
        throw new Error(`Failed to load prompt.txt: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      reportLogger.error('CRITICAL: Failed to load system prompt from public/prompt.txt', error);
      throw new Error('System prompt from public/prompt.txt is required. No fallback allowed.');
    }
  }

  /**
   * Fetch monthly financial data from n8n webhook
   */
  async fetchMonthlyData(request: MonthlyReportRequest): Promise<MonthlyReportData | null> {
    // Get QBO API base URL from environment
    const qboApiBaseUrl = import.meta.env.VITE_QBO_API_BASE_URL || 'https://sandbox-quickbooks.api.intuit.com';
    
    reportLogger.info('Fetching monthly data', { 
      month: request.month, 
      year: request.year,
      qboApiBaseUrl 
    });
    reportLogger.time('fetchMonthlyData');

    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        realmId: request.realmId,
        token: request.token,
        month: request.month.toString(),
        year: request.year.toString(),
        baseUrl: qboApiBaseUrl
      });
      
      const url = `${this.n8nMonthlyReportUrl}?${queryParams.toString()}`;
      
      reportLogger.debug('Fetching from n8n webhook', { url });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        reportLogger.error('n8n webhook failed', { 
          status: response.status, 
          statusText: response.statusText,
          errorBody: errorText 
        });
        throw new Error(`n8n webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Check if response has content
      const responseText = await response.text();
      if (!responseText) {
        reportLogger.error('n8n webhook returned empty response');
        throw new Error('n8n webhook returned empty response');
      }

      let rawData;
      try {
        rawData = JSON.parse(responseText);
      } catch (parseError) {
        reportLogger.error('Failed to parse n8n webhook response', { 
          responseText: responseText.substring(0, 500),
          error: parseError 
        });
        throw new Error(`Invalid JSON response from n8n webhook: ${parseError}`);
      }

      // Handle array response from n8n - merge all objects into single data structure
      let data: MonthlyReportData = {};
      
      if (Array.isArray(rawData)) {
        reportLogger.debug('Processing array response from n8n', { itemCount: rawData.length });
        
        // Merge all array items into a single object
        rawData.forEach((item, index) => {
          reportLogger.debug(`Processing array item ${index}`, { keys: Object.keys(item) });
          Object.assign(data, item);
        });
      } else {
        // Handle single object response (backwards compatibility)
        data = rawData;
      }
      
      reportLogger.debug('Monthly data received', { 
        hasPlMTD: !!data.plMTD,
        hasPlQTD: !!data.plQTD,
        hasBalanceSheet: !!data.balanceSheet,
        hasCashFlow: !!data.cashFlow,
        hasAR: !!data.ar,
        hasAP: !!data.ap
      });

      // Add metadata
      const quarter = Math.ceil(request.month / 3);
      const enrichedData: MonthlyReportData = {
        ...data,
        metadata: {
          month: request.month,
          year: request.year,
          quarter,
          generatedAt: new Date().toISOString()
        }
      };

      reportLogger.timeEnd('fetchMonthlyData');
      return enrichedData;

    } catch (error) {
      reportLogger.error('Failed to fetch monthly data', error);
      reportLogger.timeEnd('fetchMonthlyData');
      throw error;
    }
  }

  /**
   * Extract thinking content and clean report
   */
  private extractAndCleanReport(content: string): { cleanReport: string; detailedAnalysis: string } {
    // Extract content within thinking tags for detailed analysis
    const thinkingMatches = content.match(/<think(?:ing)?>[^]*?<\/think(?:ing)?>/gi);
    let detailedAnalysis = '';
    
    if (thinkingMatches) {
      // Remove the tags but keep the content for detailed analysis
      detailedAnalysis = thinkingMatches
        .map(match => match.replace(/<\/?think(?:ing)?>/gi, ''))
        .join('\n\n')
        .trim();
    }
    
    // Remove content within <think> or <thinking> tags (including the tags themselves)
    const cleanReport = content.replace(/<think(?:ing)?>[^]*?<\/think(?:ing)?>/gi, '').trim();
    
    return { cleanReport, detailedAnalysis };
  }

  /**
   * Process data through Perplexity LLM
   */
  async processWithLLM(data: MonthlyReportData): Promise<{ report: string; analysis: string }> {
    reportLogger.info('Processing data with Perplexity LLM');
    reportLogger.time('processWithLLM');

    try {
      // Prepare the data for LLM
      const context = {
        month: data.metadata?.month,
        year: data.metadata?.year,
        financialData: {
          profitLoss: {
            mtd: data.plMTD,
            qtd: data.plQTD
          },
          balanceSheet: data.balanceSheet,
          cashFlow: data.cashFlow,
          receivables: data.ar,
          payables: data.ap
        }
      };

      const userPrompt = `Generate a monthly financial report for ${this.getMonthName(data.metadata?.month || 1)} ${data.metadata?.year}. 
      
Financial Data:
${JSON.stringify(context, null, 2)}

Please analyze this data and create a comprehensive report following the structure provided in the system prompt.`;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.perplexityApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.perplexityModel,
          messages: [
            {
              role: 'system',
              content: this.systemPrompt || (() => {
                throw new Error('System prompt not loaded from public/prompt.txt. Cannot proceed without prompt.');
              })()
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 8000
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API failed: ${response.status}`);
      }

      const result = await response.json();
      const rawContent = result.choices[0].message.content;
      
      // Extract thinking content and clean report
      const { cleanReport, detailedAnalysis } = this.extractAndCleanReport(rawContent);
      
      reportLogger.debug('LLM processing complete', { 
        originalLength: rawContent.length,
        cleanedLength: cleanReport.length,
        analysisLength: detailedAnalysis.length,
        tokensUsed: result.usage?.total_tokens 
      });
      
      reportLogger.timeEnd('processWithLLM');
      return { report: cleanReport, analysis: detailedAnalysis };

    } catch (error) {
      reportLogger.error('Failed to process with LLM', error);
      reportLogger.timeEnd('processWithLLM');
      throw error;
    }
  }

  /**
   * Generate PDF from report
   */
  async generatePDF(report: string, metadata?: any): Promise<Blob> {
    reportLogger.info('Generating PDF report');
    reportLogger.time('generatePDF');

    try {
      reportLogger.debug('Sending report to PDF API', {
        url: this.pdfApiUrl,
        reportLength: report.length,
        reportPreview: report.substring(0, 100)
      });
      
      // Send the raw markdown/text report directly to the n8n PDF API
      const response = await fetch(this.pdfApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Accept': 'application/pdf'
        },
        body: report // Send raw text report, not HTML
      });

      if (!response.ok) {
        const errorText = await response.text();
        reportLogger.error('PDF API error response', { 
          status: response.status, 
          errorText,
          contentType: response.headers.get('content-type')
        });
        throw new Error(`PDF generation failed: ${response.status} - ${errorText}`);
      }

      // Check the content type
      const contentType = response.headers.get('content-type');
      reportLogger.debug('PDF response headers', { 
        contentType,
        contentLength: response.headers.get('content-length')
      });

      // Try to get response as ArrayBuffer first for better compatibility
      const arrayBuffer = await response.arrayBuffer();
      reportLogger.debug('Received response', { 
        contentType,
        bufferSize: arrayBuffer.byteLength
      });
      
      // Check if response might be JSON with base64 PDF
      let finalPdfBlob: Blob;
      
      if (contentType && contentType.includes('application/json')) {
        // Convert ArrayBuffer to string to parse JSON
        const text = new TextDecoder().decode(arrayBuffer);
        try {
          const jsonResponse = JSON.parse(text);
          reportLogger.debug('JSON response received', { 
            hasData: !!jsonResponse.data,
            hasPdf: !!jsonResponse.pdf,
            hasBase64: !!jsonResponse.base64,
            keys: Object.keys(jsonResponse)
          });
          
          // Try different possible field names for the PDF data
          const base64Data = jsonResponse.data || jsonResponse.pdf || jsonResponse.base64 || jsonResponse.content;
          
          if (base64Data) {
            // Convert base64 to blob
            const binaryString = atob(base64Data.replace(/^data:application\/pdf;base64,/, ''));
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            finalPdfBlob = new Blob([bytes], { type: 'application/pdf' });
            reportLogger.debug('Converted base64 to PDF blob', { size: finalPdfBlob.size });
          } else {
            throw new Error('JSON response does not contain PDF data');
          }
        } catch (parseError) {
          reportLogger.error('Failed to parse JSON response', { parseError });
          // Treat as binary PDF
          finalPdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
        }
      } else {
        // Response is binary PDF - use ArrayBuffer directly
        finalPdfBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
        reportLogger.debug('Created PDF blob from binary response', { 
          size: finalPdfBlob.size,
          type: finalPdfBlob.type
        });
      }
      
      // Verify the blob is valid
      if (finalPdfBlob.size === 0) {
        throw new Error('PDF generation returned empty blob');
      }
      
      reportLogger.debug('PDF generated successfully', { 
        size: finalPdfBlob.size,
        type: finalPdfBlob.type
      });
      
      reportLogger.timeEnd('generatePDF');
      return finalPdfBlob;

    } catch (error) {
      reportLogger.error('Failed to generate PDF', error);
      reportLogger.timeEnd('generatePDF');
      throw error;
    }
  }

  /**
   * REMOVED: saveReport method to maintain stateless architecture
   * Financial data from QuickBooks is NOT stored in the database
   * per architectural requirements - data exists only during active session
   */

  /**
   * Generate complete report (fetch data, process with LLM, generate PDF)
   */
  async generateCompleteReport(request: MonthlyReportRequest): Promise<ReportGenerationResult> {
    reportLogger.group(`Generating report for ${request.month}/${request.year}`);
    reportLogger.time('generateCompleteReport');

    try {
      // Step 1: Fetch financial data
      reportLogger.info('Step 1: Fetching financial data');
      const rawData = await this.fetchMonthlyData(request);
      if (!rawData) {
        throw new Error('No financial data received');
      }

      // Step 2: Process with LLM
      reportLogger.info('Step 2: Processing with LLM');
      const { report: llmReport, analysis: detailedAnalysis } = await this.processWithLLM(rawData);

      // Step 3: Generate PDF
      reportLogger.info('Step 3: Generating PDF');
      const pdfBlob = await this.generatePDF(llmReport, rawData.metadata);

      reportLogger.info('Report generation complete');
      reportLogger.timeEnd('generateCompleteReport');
      reportLogger.groupEnd();

      return {
        success: true,
        data: {
          rawData,
          llmReport,
          detailedAnalysis,
          pdfBlob
        }
      };

    } catch (error) {
      reportLogger.error('Report generation failed', error);
      reportLogger.timeEnd('generateCompleteReport');
      reportLogger.groupEnd();

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Format report as HTML for PDF generation
   */
  private formatReportAsHTML(report: string, metadata?: any): string {
    // Convert markdown to HTML with styling
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
    }
    h2 {
      color: #1e40af;
      margin-top: 30px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
    }
    h3 {
      color: #374151;
      margin-top: 20px;
    }
    .kpi-dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .kpi-item {
      border: 1px solid #e5e7eb;
      padding: 15px;
      border-radius: 8px;
      background: #f9fafb;
    }
    .kpi-value {
      font-size: 24px;
      font-weight: bold;
      color: #1e40af;
    }
    .kpi-label {
      font-size: 12px;
      color: #6b7280;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 10px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
    }
    .positive {
      color: #059669;
    }
    .negative {
      color: #dc2626;
    }
    .warning {
      color: #d97706;
    }
    .disclaimer {
      margin-top: 50px;
      padding: 15px;
      background-color: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 8px;
      font-size: 12px;
      color: #92400e;
    }
    .metadata {
      background-color: #f3f4f6;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  ${metadata ? `
  <div class="metadata">
    <strong>Report Period:</strong> ${this.getMonthName(metadata.month)} ${metadata.year}<br>
    <strong>Generated:</strong> ${new Date(metadata.generatedAt).toLocaleString()}<br>
    <strong>Quarter:</strong> Q${metadata.quarter} ${metadata.year}
  </div>
  ` : ''}
  
  ${this.markdownToHTML(report)}
  
  <div class="disclaimer">
    <strong>Disclaimer:</strong><br>
    All information in this financial report is presented for informational purposes only.
    The report should be reviewed for accuracy and signed off by a Certified Public
    Accountant (CPA) or the company's Chief Financial Officer (CFO) before any use.
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Simple markdown to HTML converter
   */
  private markdownToHTML(markdown: string): string {
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\* (.+)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  /**
   * Get month name from number
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
  }

  /**
   * Get default system prompt if file loading fails
   */
  private getDefaultSystemPrompt(): string {
    // NO FALLBACK - Must use prompt.txt only
    throw new Error('System prompt from public/prompt.txt is required. No fallback allowed.');
  }
}

// Export singleton instance
export const reportGenerationService = new ReportGenerationService();
export default reportGenerationService;