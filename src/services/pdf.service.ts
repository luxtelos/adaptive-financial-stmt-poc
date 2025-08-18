import jsPDF from 'jspdf';

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL;
const PDF_SERVICE_API_KEY = import.meta.env.VITE_PDF_SERVICE_API_KEY;

// Helper to determine API path based on environment
const getPdfApiPath = (endpoint: string) => {
  // In production (Netlify), use the proxy path
  if (import.meta.env.PROD && PDF_SERVICE_URL) {
    return `/api/pdf${endpoint}`;
  }
  // For localhost development or if no external service configured
  return PDF_SERVICE_URL ? `${PDF_SERVICE_URL}${endpoint}` : null;
};

export class PDFService {
  // Convert markdown to PDF using webhook service or local generation
  static async convertMarkdownToPDF(markdown: string, title: string): Promise<string> {
    try {
      const pdfApiPath = getPdfApiPath('/convert');
      
      if (pdfApiPath) {
        // Use external PDF service if configured
        const response = await fetch(pdfApiPath, {
          method: 'POST',
          headers: {
            'Authorization': PDF_SERVICE_API_KEY ? `Bearer ${PDF_SERVICE_API_KEY}` : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: markdown,
            title,
            format: 'A4',
            styles: {
              fontFamily: 'Inter, sans-serif',
              primaryColor: '#3b82f6',
            },
          }),
        });

        if (!response.ok) {
          throw new Error('PDF service error');
        }

        const data = await response.json();
        
        // If service returns a URL, use it; otherwise assume it's base64
        if (data.pdfUrl) {
          return data.pdfUrl;
        } else if (data.pdfBase64) {
          const blob = this.base64ToBlob(data.pdfBase64, 'application/pdf');
          return URL.createObjectURL(blob);
        }
      }
      
      // Fallback to client-side PDF generation
      return this.generatePDFLocally(markdown, title);
    } catch (error) {
      console.error('Error converting to PDF via service, falling back to local:', error);
      return this.generatePDFLocally(markdown, title);
    }
  }

  // Convert base64 to blob
  private static base64ToBlob(base64: string, contentType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  // Generate PDF locally using jsPDF
  static async generatePDFLocally(content: string, title: string): Promise<string> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add title
    pdf.setFontSize(20);
    pdf.setTextColor(59, 130, 246); // Primary color
    pdf.text(title, 20, 20);

    // Process markdown content (simplified)
    const lines = content.split('\n');
    let yPosition = 40;
    const lineHeight = 7;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;

    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);

    for (const line of lines) {
      // Check if we need a new page
      if (yPosition + lineHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      // Process markdown formatting (simplified)
      let processedLine = line;
      
      // Headers
      if (line.startsWith('# ')) {
        pdf.setFontSize(18);
        pdf.setFont(undefined, 'bold');
        processedLine = line.replace('# ', '');
      } else if (line.startsWith('## ')) {
        pdf.setFontSize(16);
        pdf.setFont(undefined, 'bold');
        processedLine = line.replace('## ', '');
      } else if (line.startsWith('### ')) {
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        processedLine = line.replace('### ', '');
      } else {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'normal');
      }

      // Bold text
      processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '$1');
      
      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        processedLine = '• ' + processedLine.substring(2);
      }

      // Add text with word wrap
      const splitText = pdf.splitTextToSize(processedLine, 170);
      
      for (const textLine of splitText) {
        if (yPosition + lineHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(textLine, margin, yPosition);
        yPosition += lineHeight;
      }
    }

    // Add footer with timestamp
    const pageCount = pdf.getNumberOfPages();
    const timestamp = new Date().toLocaleString();
    
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${i} of ${pageCount} | Generated: ${timestamp}`,
        margin,
        pageHeight - 10
      );
    }

    // Convert to blob and create URL
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    return pdfUrl;
  }

  // Generate financial report PDF with charts
  static async generateFinancialReportPDF(
    reportData: any,
    analysis: string,
    companyName: string
  ): Promise<string> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;

    // Cover page
    pdf.setFillColor(59, 130, 246);
    pdf.rect(0, 0, pageWidth, 60, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text('Financial Analysis Report', pageWidth / 2, 25, { align: 'center' });
    
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'normal');
    pdf.text(companyName, pageWidth / 2, 40, { align: 'center' });
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.text(`Report Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, 80, { align: 'center' });

    // Executive Summary
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text('Executive Summary', margin, 30);
    
    // Add analysis content
    let yPosition = 45;
    const analysisLines = analysis.split('\n').slice(0, 10); // First 10 lines for summary
    
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    
    for (const line of analysisLines) {
      const splitText = pdf.splitTextToSize(line, pageWidth - (margin * 2));
      for (const textLine of splitText) {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(textLine, margin, yPosition);
        yPosition += 7;
      }
    }

    // Financial Data Section
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text('Financial Data', margin, 30);
    
    // Add table with financial data (simplified)
    yPosition = 45;
    pdf.setFontSize(10);
    
    if (reportData && typeof reportData === 'object') {
      const entries = Object.entries(reportData).slice(0, 20); // Limit to 20 entries
      
      for (const [key, value] of entries) {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        
        pdf.setFont(undefined, 'bold');
        pdf.text(key + ':', margin, yPosition);
        pdf.setFont(undefined, 'normal');
        pdf.text(String(value), margin + 60, yPosition);
        yPosition += 8;
      }
    }

    // Full Analysis Section
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text('Detailed Analysis', margin, 30);
    
    yPosition = 45;
    const fullAnalysisLines = analysis.split('\n');
    
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'normal');
    
    for (const line of fullAnalysisLines) {
      // Process headers
      if (line.startsWith('# ')) {
        pdf.setFontSize(16);
        pdf.setFont(undefined, 'bold');
      } else if (line.startsWith('## ')) {
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
      } else {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'normal');
      }
      
      const cleanLine = line.replace(/^#+\s*/, '');
      const splitText = pdf.splitTextToSize(cleanLine, pageWidth - (margin * 2));
      
      for (const textLine of splitText) {
        if (yPosition > pageHeight - margin - 10) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(textLine, margin, yPosition);
        yPosition += 7;
      }
      
      yPosition += 3; // Extra space between paragraphs
    }

    // Convert to blob and create URL
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    return pdfUrl;
  }

  // Download PDF from URL
  static downloadPDF(pdfUrl: string, filename: string) {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}