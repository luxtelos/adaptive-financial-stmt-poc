# ADR-0010: Use Client-Side PDF Generation

## Status
Accepted

## Context

### Business Requirements
The QuickBooks Analyzer needs to generate professional PDF reports containing:
- Financial statements with complex formatting
- Charts and visualizations
- Tables with calculations
- Custom branding elements
- Multi-page layouts with headers/footers
- High-quality output suitable for client presentation

### Technical Constraints
- Reports contain sensitive financial data
- Need immediate generation without server round-trips
- Must work offline after data is loaded
- Consistent output across browsers
- File sizes must be reasonable (< 5MB typical)
- Support for various paper sizes (Letter, A4)

## Decision

We will implement client-side PDF generation using jsPDF with html2canvas for rendering complex HTML/CSS layouts, eliminating the need for server-side PDF generation infrastructure.

### Implementation Approach

```typescript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';

class PDFGenerator {
  async generateReport(reportData: FinancialReport): Promise<Blob> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add content
    this.addHeader(pdf, reportData);
    this.addFinancialStatements(pdf, reportData);
    this.addCharts(pdf, reportData);
    this.addFooter(pdf);
    
    return pdf.output('blob');
  }
}
```

## Alternatives Considered

### 1. Server-Side PDF Generation (Node.js + Puppeteer)
- **Pros**: Full browser rendering, consistent output, advanced features
- **Cons**: Infrastructure cost, latency, scaling challenges, data security
- **Rejected**: Adds complexity and cost without significant benefits

### 2. Cloud PDF Services (PDFShift, Documint)
- **Pros**: No infrastructure, advanced features, reliable
- **Cons**: Cost per document, data privacy concerns, internet dependency
- **Rejected**: Ongoing costs and data security issues

### 3. Server-Side Libraries (wkhtmltopdf, Prince)
- **Pros**: Powerful formatting, print-quality output
- **Cons**: Server requirements, licensing costs, deployment complexity
- **Rejected**: Infrastructure overhead not justified

### 4. React PDF
- **Pros**: React component approach, declarative API
- **Cons**: Limited styling, learning curve, less flexible
- **Rejected**: Too restrictive for complex financial reports

### 5. Canvas-Only Approach
- **Pros**: Complete control, pixel-perfect
- **Cons**: Complex implementation, no text selection, accessibility issues
- **Rejected**: Too much development effort

## Rationale

### Why Client-Side Generation?

1. **Data Privacy**: Sensitive financial data never leaves the client
2. **Instant Generation**: No network latency or server processing
3. **Offline Capability**: Works without internet after initial load
4. **Cost Effective**: No server infrastructure or per-document fees
5. **Scalability**: Processing scales with client devices
6. **Simplicity**: No backend PDF service to maintain

### Why jsPDF?

1. **Mature Library**: Battle-tested with large community
2. **Feature Rich**: Tables, images, charts, multi-page support
3. **Extensible**: Plugin system for additional functionality
4. **File Size**: Reasonable PDF sizes with compression
5. **Browser Support**: Works in all modern browsers

## Implementation Details

### PDF Generation Service

```typescript
export class FinancialPDFService {
  private readonly pdf: jsPDF;
  private currentY: number = 20;
  private readonly pageHeight: number = 297; // A4 height in mm
  private readonly margin: number = 20;
  
  async generateFinancialReport(
    reportData: ProcessedFinancialData,
    companyInfo: CompanyInfo
  ): Promise<Blob> {
    this.pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    // Add sections
    await this.addCoverPage(companyInfo);
    await this.addExecutiveSummary(reportData.summary);
    await this.addFinancialStatements(reportData.statements);
    await this.addCharts(reportData.charts);
    await this.addDetailedAnalysis(reportData.analysis);
    
    // Add page numbers
    this.addPageNumbers();
    
    return this.pdf.output('blob');
  }
  
  private async addFinancialStatements(statements: FinancialStatements) {
    // Profit & Loss
    this.addSectionHeader('Profit & Loss Statement');
    
    (this.pdf as any).autoTable({
      head: [['Account', 'Current Period', 'Previous Period', 'Change %']],
      body: statements.profitLoss.map(item => [
        item.account,
        this.formatCurrency(item.current),
        this.formatCurrency(item.previous),
        this.formatPercentage(item.change)
      ]),
      startY: this.currentY,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });
    
    this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;
  }
  
  private async addCharts(charts: ChartData[]) {
    for (const chart of charts) {
      // Render chart to canvas
      const canvas = await html2canvas(chart.element, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      // Add to PDF
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 170;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Check if need new page
      if (this.currentY + imgHeight > this.pageHeight - this.margin) {
        this.pdf.addPage();
        this.currentY = this.margin;
      }
      
      this.pdf.addImage(imgData, 'PNG', this.margin, this.currentY, imgWidth, imgHeight);
      this.currentY += imgHeight + 10;
    }
  }
  
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
}
```

### Chart Integration

```typescript
// Prepare charts for PDF
const prepareChartForPDF = async (chartRef: React.RefObject<HTMLDivElement>) => {
  if (!chartRef.current) return null;
  
  // Ensure chart is fully rendered
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Clone and prepare for PDF
  const clone = chartRef.current.cloneNode(true) as HTMLElement;
  clone.style.width = '800px';
  clone.style.height = '400px';
  clone.style.backgroundColor = 'white';
  
  document.body.appendChild(clone);
  const canvas = await html2canvas(clone, {
    scale: 2,
    logging: false
  });
  document.body.removeChild(clone);
  
  return canvas.toDataURL('image/png');
};
```

### Optimization Strategies

```typescript
// Compress images before adding to PDF
const compressImage = (dataUrl: string, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
};

// Split large reports into chunks
const generateLargeReport = async (data: LargeReportData) => {
  const chunks = [];
  const chunkSize = 50; // pages per chunk
  
  for (let i = 0; i < data.pages.length; i += chunkSize) {
    const chunk = data.pages.slice(i, i + chunkSize);
    const pdf = await generatePDFChunk(chunk);
    chunks.push(pdf);
  }
  
  return mergePDFs(chunks);
};
```

## Consequences

### Positive
- ✅ Complete data privacy - no server transmission
- ✅ Instant generation without network latency
- ✅ Works offline once app is loaded
- ✅ No infrastructure costs or maintenance
- ✅ Scales automatically with client devices
- ✅ Full control over formatting and layout
- ✅ No per-document costs

### Negative
- ❌ Processing burden on client devices
- ❌ Potential browser inconsistencies
- ❌ Limited by browser memory for large reports
- ❌ No server-side PDF archive
- ❌ Fonts limited to web-safe or embedded
- ❌ Complex layouts require more code
- ❌ Slower on low-end devices

## Performance Optimization

### Memory Management

```typescript
class PDFMemoryManager {
  private readonly MAX_IMAGE_SIZE = 1024 * 1024; // 1MB
  
  async optimizeForPDF(element: HTMLElement): Promise<string> {
    const canvas = await html2canvas(element, {
      scale: this.calculateOptimalScale(element),
      removeContainer: true,
      logging: false
    });
    
    // Convert to JPEG for smaller size
    let quality = 0.9;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    
    // Reduce quality if too large
    while (dataUrl.length > this.MAX_IMAGE_SIZE && quality > 0.3) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    
    return dataUrl;
  }
  
  private calculateOptimalScale(element: HTMLElement): number {
    const width = element.offsetWidth;
    if (width > 1200) return 1;
    if (width > 800) return 1.5;
    return 2;
  }
}
```

### Progressive Rendering

```typescript
const generatePDFProgressive = async (
  data: ReportData,
  onProgress: (progress: number) => void
) => {
  const pdf = new jsPDF();
  const sections = [
    { name: 'cover', weight: 10 },
    { name: 'summary', weight: 20 },
    { name: 'statements', weight: 40 },
    { name: 'analysis', weight: 30 }
  ];
  
  let completedWeight = 0;
  
  for (const section of sections) {
    await renderSection(pdf, data[section.name]);
    completedWeight += section.weight;
    onProgress(completedWeight);
  }
  
  return pdf.output('blob');
};
```

## Browser Compatibility

```typescript
// Feature detection and fallbacks
const checkPDFSupport = (): boolean => {
  try {
    new jsPDF();
    return true;
  } catch {
    return false;
  }
};

// Fallback to server-side generation
const generatePDFWithFallback = async (data: ReportData): Promise<Blob> => {
  if (checkPDFSupport()) {
    return generateClientSidePDF(data);
  } else {
    // Fallback to server API
    console.warn('Client-side PDF not supported, using server fallback');
    return generateServerSidePDF(data);
  }
};
```

## Testing Strategy

```typescript
describe('PDF Generation', () => {
  it('should generate consistent PDF output', async () => {
    const data = mockFinancialData();
    const pdf1 = await generatePDF(data);
    const pdf2 = await generatePDF(data);
    
    // Compare PDF metadata (size should be similar)
    expect(pdf1.size).toBeCloseTo(pdf2.size, -2);
  });
  
  it('should handle large datasets', async () => {
    const largeData = generateLargeDataset(1000); // 1000 rows
    const pdf = await generatePDF(largeData);
    
    expect(pdf.size).toBeLessThan(10 * 1024 * 1024); // < 10MB
  });
});
```

## Related ADRs

- [ADR-0001](0001-use-react-typescript-frontend.md): Frontend architecture for PDF generation
- [ADR-0004](0004-use-perplexity-llm-analysis.md): Content for PDF reports
- [ADR-0008](0008-store-data-jsonb.md): Data source for reports

## References

- [jsPDF Documentation](https://github.com/parallax/jsPDF)
- [html2canvas Documentation](https://html2canvas.hertzen.com/)
- [PDF Generation Best Practices](https://web.dev/rendering-on-the-web/)
- [Client-Side PDF Performance](https://medium.com/@atifazam/generate-pdf-on-the-client-side-with-jspdf)