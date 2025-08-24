import { PDFReportData, ReportSection, LLMAnalysisResponse } from '../types/financial.types';

export class PDFEnhancedService {
  private static readonly PDF_API_URL = import.meta.env.VITE_PDF_API_URL;
  private static readonly PDF_API_KEY = import.meta.env.VITE_PDF_API_KEY;
  
  /**
   * Generate PDF from report sections
   */
  static async generatePDF(
    reportData: PDFReportData,
    sections: ReportSection[],
    llmAnalysis: LLMAnalysisResponse
  ): Promise<Blob> {
    try {
      const htmlContent = this.generateHTMLContent(reportData, sections, llmAnalysis);
      
      // Use PDFShift API or similar service
      const response = await fetch(this.PDF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${this.PDF_API_KEY}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: htmlContent,
          format: 'A4',
          margin: '20mm',
          landscape: false,
          use_print: true,
          sandbox: false,
          delay: 2000, // Wait for charts to render
          javascript: true,
          css: this.getPDFStyles(reportData.styling)
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to client-side PDF generation
      return this.generateClientSidePDF(reportData, sections, llmAnalysis);
    }
  }
  
  /**
   * Generate HTML content for PDF
   */
  private static generateHTMLContent(
    reportData: PDFReportData,
    sections: ReportSection[],
    llmAnalysis: LLMAnalysisResponse
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportData.header.reportTitle}</title>
  <style>${this.getPDFStyles(reportData.styling)}</style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  ${this.generateHeader(reportData.header)}
  ${this.generateExecutiveDashboard(llmAnalysis)}
  ${sections.map(section => this.generateSection(section, reportData.styling)).join('')}
  ${this.generateFooter(reportData.footer)}
  <script>${this.getChartScripts(sections)}</script>
</body>
</html>`;
  }
  
  /**
   * Generate PDF header
   */
  private static generateHeader(header: PDFReportData['header']): string {
    return `
<header class="report-header">
  ${header.logo ? `<img src="${header.logo}" alt="${header.companyName}" class="company-logo">` : ''}
  <div class="header-content">
    <h1>${header.companyName}</h1>
    <h2>${header.reportTitle}</h2>
    <div class="header-meta">
      <span>Period: ${header.reportPeriod}</span>
      <span>Generated: ${header.generatedDate}</span>
    </div>
  </div>
</header>
<div class="page-break"></div>`;
  }
  
  /**
   * Generate executive dashboard
   */
  private static generateExecutiveDashboard(llmAnalysis: LLMAnalysisResponse): string {
    const summary = llmAnalysis.choice.executiveSummary;
    const performance = llmAnalysis.choice.financialPerformanceSnapshot;
    
    return `
<section class="executive-dashboard">
  <h2>Executive Dashboard</h2>
  
  <div class="health-indicator">
    <div class="health-score ${summary.overallHealth}">
      <span class="label">Financial Health</span>
      <span class="value">${summary.overallHealth.toUpperCase()}</span>
    </div>
  </div>
  
  <div class="key-metrics">
    <div class="metric-card">
      <span class="metric-label">Revenue Growth</span>
      <span class="metric-value">${performance.revenueAnalysis.growthRate}%</span>
      <span class="metric-trend ${performance.revenueAnalysis.growthRate > 0 ? 'positive' : 'negative'}">
        ${performance.revenueAnalysis.growthRate > 0 ? '↑' : '↓'}
      </span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Gross Margin</span>
      <span class="metric-value">${performance.profitabilityAnalysis.margins.gross}%</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Operating Margin</span>
      <span class="metric-value">${performance.profitabilityAnalysis.margins.operating}%</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Net Margin</span>
      <span class="metric-value">${performance.profitabilityAnalysis.margins.net}%</span>
    </div>
  </div>
  
  <div class="highlights-issues">
    <div class="highlights">
      <h3>Key Highlights</h3>
      <ul>
        ${summary.keyHighlights.map(h => `<li>${h}</li>`).join('')}
      </ul>
    </div>
    <div class="issues">
      <h3>Critical Issues</h3>
      <ul>
        ${summary.criticalIssues.map(i => `<li class="issue">${i}</li>`).join('')}
      </ul>
    </div>
  </div>
  
  <div class="immediate-actions">
    <h3>Immediate Actions Required</h3>
    <ol>
      ${summary.immediateActions.map(a => `<li>${a}</li>`).join('')}
    </ol>
  </div>
</section>
<div class="page-break"></div>`;
  }
  
  /**
   * Generate section content
   */
  private static generateSection(section: ReportSection, styling: any): string {
    let content = `<section class="report-section" id="${section.id}">
      <h2>${section.title}</h2>`;
    
    if (section.content.summary) {
      content += `<p class="section-summary">${section.content.summary}</p>`;
    }
    
    if (section.content.details) {
      content += '<div class="details-grid">';
      section.content.details.forEach(detail => {
        content += `
          <div class="detail-item">
            <span class="detail-label">${detail.label}</span>
            <span class="detail-value">${detail.value}</span>
            ${detail.subItems ? `
              <div class="sub-items">
                ${detail.subItems.map(sub => `
                  <div class="sub-item">
                    <span>${sub.label}: ${sub.value}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>`;
      });
      content += '</div>';
    }
    
    if (section.content.table) {
      content += this.generateTable(section.content.table);
    }
    
    if (section.content.chart) {
      content += `<div class="chart-container">
        <canvas id="chart-${section.id}"></canvas>
      </div>`;
    }
    
    if (section.content.insights && section.content.insights.length > 0) {
      content += `
        <div class="insights">
          <h3>Key Insights</h3>
          <ul>
            ${section.content.insights.map(i => `<li>${i}</li>`).join('')}
          </ul>
        </div>`;
    }
    
    if (section.content.recommendations && section.content.recommendations.length > 0) {
      content += `
        <div class="recommendations">
          <h3>Recommendations</h3>
          <ol>
            ${section.content.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ol>
        </div>`;
    }
    
    content += '</section>';
    
    if (section.id === 'executive-summary' || section.id === 'cash-flow' || section.id === 'forward-outlook') {
      content += '<div class="page-break"></div>';
    }
    
    return content;
  }
  
  /**
   * Generate table HTML
   */
  private static generateTable(table: any): string {
    return `
<table class="data-table">
  <thead>
    <tr>
      ${table.headers.map((h: string) => `<th>${h}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${table.rows.map((row: any[]) => `
      <tr>
        ${row.map(cell => `<td>${cell}</td>`).join('')}
      </tr>
    `).join('')}
  </tbody>
</table>`;
  }
  
  /**
   * Generate footer
   */
  private static generateFooter(footer: PDFReportData['footer']): string {
    return `
<footer class="report-footer">
  ${footer.disclaimer ? `<p class="disclaimer">${footer.disclaimer}</p>` : ''}
  ${footer.confidentiality ? `<p class="confidentiality">${footer.confidentiality}</p>` : ''}
</footer>`;
  }
  
  /**
   * Get PDF styles
   */
  private static getPDFStyles(styling: PDFReportData['styling']): string {
    return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', ${styling.fontFamily}, sans-serif;
  font-size: ${styling.fontSize.body}px;
  line-height: 1.6;
  color: #1f2937;
  background: white;
}

.report-header {
  display: flex;
  align-items: center;
  padding: 40px;
  background: linear-gradient(135deg, ${styling.primaryColor} 0%, ${styling.secondaryColor} 100%);
  color: white;
  margin-bottom: 30px;
}

.company-logo {
  width: 80px;
  height: 80px;
  margin-right: 30px;
}

.header-content h1 {
  font-size: ${styling.fontSize.header}px;
  font-weight: 700;
  margin-bottom: 10px;
}

.header-content h2 {
  font-size: ${styling.fontSize.subheader}px;
  font-weight: 500;
  opacity: 0.95;
  margin-bottom: 15px;
}

.header-meta {
  display: flex;
  gap: 30px;
  font-size: 14px;
  opacity: 0.9;
}

.executive-dashboard {
  padding: 30px;
}

.health-indicator {
  text-align: center;
  margin: 30px 0;
}

.health-score {
  display: inline-block;
  padding: 20px 40px;
  border-radius: 10px;
  background: #f3f4f6;
}

.health-score.excellent { background: #10b981; color: white; }
.health-score.good { background: #3b82f6; color: white; }
.health-score.fair { background: #f59e0b; color: white; }
.health-score.poor { background: #ef4444; color: white; }
.health-score.critical { background: #991b1b; color: white; }

.health-score .label {
  display: block;
  font-size: 14px;
  margin-bottom: 5px;
}

.health-score .value {
  display: block;
  font-size: 24px;
  font-weight: 700;
}

.key-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin: 30px 0;
}

.metric-card {
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  text-align: center;
}

.metric-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 5px;
  text-transform: uppercase;
}

.metric-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.metric-trend {
  display: inline-block;
  margin-top: 5px;
  font-size: 18px;
}

.metric-trend.positive { color: #10b981; }
.metric-trend.negative { color: #ef4444; }

.highlights-issues {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin: 30px 0;
}

.highlights h3, .issues h3, .immediate-actions h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 15px;
  color: #1f2937;
}

.highlights ul, .issues ul {
  list-style: none;
  padding: 0;
}

.highlights li, .issues li {
  padding: 8px 0;
  padding-left: 25px;
  position: relative;
}

.highlights li:before {
  content: "✓";
  position: absolute;
  left: 0;
  color: #10b981;
  font-weight: bold;
}

.issues li:before {
  content: "⚠";
  position: absolute;
  left: 0;
  color: #ef4444;
}

.immediate-actions ol {
  padding-left: 20px;
}

.immediate-actions li {
  padding: 8px 0;
}

.report-section {
  padding: 30px;
  margin-bottom: 30px;
}

.report-section h2 {
  font-size: ${styling.fontSize.subheader}px;
  font-weight: 600;
  color: ${styling.primaryColor};
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid ${styling.secondaryColor};
}

.section-summary {
  font-size: 14px;
  color: #4b5563;
  margin-bottom: 20px;
  line-height: 1.8;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin: 20px 0;
}

.detail-item {
  padding: 15px;
  background: #f9fafb;
  border-radius: 6px;
  border-left: 3px solid ${styling.secondaryColor};
}

.detail-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 5px;
  text-transform: uppercase;
}

.detail-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.sub-items {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.sub-item {
  font-size: 12px;
  color: #6b7280;
  margin: 5px 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

.data-table thead {
  background: ${styling.primaryColor};
  color: white;
}

.data-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
}

.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}

.data-table tbody tr:nth-child(even) {
  background: #f9fafb;
}

.data-table tbody tr:hover {
  background: #f3f4f6;
}

.chart-container {
  margin: 30px 0;
  padding: 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.insights, .recommendations {
  margin: 30px 0;
  padding: 20px;
  background: #f0f9ff;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.insights h3, .recommendations h3 {
  color: #1e40af;
}

.insights ul, .recommendations ol {
  margin-top: 15px;
  padding-left: 20px;
}

.insights li, .recommendations li {
  margin: 8px 0;
  line-height: 1.6;
}

.report-footer {
  margin-top: 50px;
  padding: 20px;
  background: #f9fafb;
  border-top: 2px solid #e5e7eb;
  text-align: center;
}

.disclaimer, .confidentiality {
  font-size: ${styling.fontSize.footer}px;
  color: #6b7280;
  margin: 10px 0;
}

.page-break {
  page-break-after: always;
}

@media print {
  .page-break {
    page-break-after: always;
  }
  
  .report-section {
    page-break-inside: avoid;
  }
  
  .data-table {
    page-break-inside: avoid;
  }
}`;
  }
  
  /**
   * Generate chart scripts
   */
  private static getChartScripts(sections: ReportSection[]): string {
    const chartScripts: string[] = [];
    
    sections.forEach(section => {
      if (section.content.chart) {
        chartScripts.push(`
          new Chart(document.getElementById('chart-${section.id}'), {
            type: '${section.content.chart.datasets[0].backgroundColor ? 'bar' : 'line'}',
            data: ${JSON.stringify(section.content.chart)},
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top',
                },
                title: {
                  display: false
                }
              }
            }
          });
        `);
      }
    });
    
    return chartScripts.join('\n');
  }
  
  /**
   * Generate client-side PDF as fallback
   */
  private static async generateClientSidePDF(
    reportData: PDFReportData,
    sections: ReportSection[],
    llmAnalysis: LLMAnalysisResponse
  ): Promise<Blob> {
    // Import jsPDF dynamically
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add header
    doc.setFontSize(24);
    doc.setTextColor(reportData.styling.primaryColor);
    doc.text(reportData.header.companyName, 20, 30);
    
    doc.setFontSize(18);
    doc.text(reportData.header.reportTitle, 20, 40);
    
    doc.setFontSize(12);
    doc.setTextColor('#6b7280');
    doc.text(`Period: ${reportData.header.reportPeriod}`, 20, 50);
    doc.text(`Generated: ${reportData.header.generatedDate}`, 20, 57);
    
    // Add executive summary
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(reportData.styling.primaryColor);
    doc.text('Executive Summary', 20, 20);
    
    doc.setFontSize(11);
    doc.setTextColor('#1f2937');
    
    let yPosition = 35;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    
    // Add key highlights
    doc.setFont(undefined, 'bold');
    doc.text('Key Highlights:', 20, yPosition);
    yPosition += lineHeight;
    
    doc.setFont(undefined, 'normal');
    llmAnalysis.choice.executiveSummary.keyHighlights.forEach(highlight => {
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = 20;
      }
      const lines = doc.splitTextToSize(`• ${highlight}`, 170);
      lines.forEach((line: string) => {
        doc.text(line, 25, yPosition);
        yPosition += lineHeight;
      });
    });
    
    // Add sections
    sections.forEach(section => {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(reportData.styling.primaryColor);
      doc.text(section.title, 20, yPosition);
      yPosition += lineHeight * 1.5;
      
      doc.setFontSize(11);
      doc.setTextColor('#1f2937');
      
      if (section.content.summary) {
        const lines = doc.splitTextToSize(section.content.summary, 170);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 20, yPosition);
          yPosition += lineHeight;
        });
        yPosition += lineHeight;
      }
      
      if (section.content.table) {
        const tableData = section.content.table.rows;
        const tableHeaders = section.content.table.headers;
        
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 20;
        }
        
        (doc as any).autoTable({
          head: [tableHeaders],
          body: tableData,
          startY: yPosition,
          margin: { left: 20, right: 20 },
          styles: { fontSize: 10 },
          headStyles: { fillColor: reportData.styling.primaryColor }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }
    });
    
    // Add footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor('#6b7280');
      
      if (reportData.footer.pageNumbers) {
        doc.text(`Page ${i} of ${totalPages}`, 105, 285, { align: 'center' });
      }
      
      if (reportData.footer.confidentiality) {
        doc.text(reportData.footer.confidentiality, 105, 290, { align: 'center' });
      }
    }
    
    return doc.output('blob');
  }
  
  /**
   * REMOVED: Excel export not in scope - only PDF export is required
   */
}