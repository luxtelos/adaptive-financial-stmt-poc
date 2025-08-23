import { QuickBooksService } from './quickbooks.service';
import { DataTransformService } from './dataTransform.service';
import { PerplexityEnhancedService } from './perplexityEnhanced.service';
import { PDFEnhancedService } from './pdfEnhanced.service';
import { supabase } from '../lib/supabase';
import {
  FinancialDataForLLM,
  LLMAnalysisResponse,
  ReportSection,
  DashboardData,
  PDFReportData
} from '../types/financial.types';

export class ReportOrchestratorService {
  /**
   * Main orchestration method for generating comprehensive financial reports
   */
  static async generateComprehensiveReport(
    connectionId: string,
    reportPeriod: {
      start: string;
      end: string;
      previousStart?: string;
      previousEnd?: string;
    },
    options: {
      includePreviousPeriod?: boolean;
      includeBudget?: boolean;
      generatePDF?: boolean;
      generateExcel?: boolean;
      industryBenchmarks?: boolean;
      scenarioAnalysis?: boolean;
    } = {}
  ) {
    try {
      console.log('Starting comprehensive report generation...');
      
      // Step 1: Fetch data from QuickBooks
      console.log('Step 1: Fetching data from QuickBooks...');
      const qboData = await this.fetchQuickBooksData(
        connectionId,
        reportPeriod,
        options.includePreviousPeriod
      );
      
      // Step 2: Get company information
      console.log('Step 2: Getting company information...');
      const companyInfo = await this.getCompanyInfo(connectionId);
      
      // Step 3: Transform QBO data to LLM input format
      console.log('Step 3: Transforming data for LLM analysis...');
      const llmInputData = DataTransformService.transformQBOToLLMInput(
        qboData,
        companyInfo
      );
      
      // Step 4: Get LLM analysis
      console.log('Step 4: Getting AI-powered financial analysis...');
      const llmAnalysis = await PerplexityEnhancedService.analyzeFinancialData(
        llmInputData
      );
      
      // Step 5: Get additional analyses if requested
      let additionalAnalyses: any = {};
      
      if (options.industryBenchmarks && companyInfo.industry) {
        console.log('Step 5a: Getting industry benchmark analysis...');
        additionalAnalyses.industryBenchmarks = await PerplexityEnhancedService
          .getIndustryBenchmarkAnalysis(llmInputData, companyInfo.industry);
      }
      
      if (options.scenarioAnalysis) {
        console.log('Step 5b: Running scenario analysis...');
        additionalAnalyses.scenarios = await this.runScenarioAnalysis(
          llmInputData,
          llmAnalysis
        );
      }
      
      // Step 6: Parse LLM response into UI sections
      console.log('Step 6: Parsing analysis for UI display...');
      const reportSections = DataTransformService.parseLLMResponse(llmAnalysis);
      
      // Step 7: Prepare dashboard data
      console.log('Step 7: Preparing dashboard data...');
      const dashboardData = DataTransformService.prepareDashboardData(
        llmAnalysis,
        llmInputData
      );
      
      // Step 8: Store report in database
      console.log('Step 8: Storing report in database...');
      const savedReport = await this.saveReport({
        connectionId,
        reportPeriod,
        llmInputData,
        llmAnalysis,
        reportSections,
        dashboardData,
        additionalAnalyses
      });
      
      // Step 9: Generate PDF if requested
      let pdfUrl: string | undefined;
      if (options.generatePDF) {
        console.log('Step 9: Generating PDF report...');
        pdfUrl = await this.generatePDFReport(
          reportSections,
          companyInfo,
          llmAnalysis,
          savedReport.id
        );
      }
      
      // Step 10: Generate Excel if requested
      let excelUrl: string | undefined;
      if (options.generateExcel) {
        console.log('Step 10: Generating Excel report...');
        excelUrl = await this.generateExcelReport(
          llmInputData,
          llmAnalysis,
          savedReport.id
        );
      }
      
      console.log('Report generation completed successfully!');
      
      return {
        success: true,
        reportId: savedReport.id,
        dashboardData,
        reportSections,
        llmAnalysis,
        additionalAnalyses,
        pdfUrl,
        excelUrl,
        metadata: {
          generatedAt: new Date().toISOString(),
          period: reportPeriod,
          company: companyInfo
        }
      };
      
    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      throw error;
    }
  }
  
  /**
   * Fetch all required data from QuickBooks
   */
  private static async fetchQuickBooksData(
    connectionId: string,
    period: any,
    includePrevious: boolean = false
  ) {
    // Fetch current period reports
    const [profitLoss, balanceSheet, cashFlow, arAging, apAging] = await Promise.all([
      QuickBooksService.importReports(connectionId, 'profit_loss', period.start, period.end),
      QuickBooksService.importReports(connectionId, 'balance_sheet', period.start, period.end),
      QuickBooksService.importReports(connectionId, 'cash_flow', period.start, period.end),
      QuickBooksService.importReports(connectionId, 'aged_receivables', period.start, period.end),
      QuickBooksService.importReports(connectionId, 'aged_payables', period.start, period.end)
    ]);
    
    let previousProfitLoss, previousBalanceSheet;
    
    // Fetch previous period if requested
    if (includePrevious && period.previousStart && period.previousEnd) {
      [previousProfitLoss, previousBalanceSheet] = await Promise.all([
        QuickBooksService.importReports(connectionId, 'profit_loss', period.previousStart, period.previousEnd),
        QuickBooksService.importReports(connectionId, 'balance_sheet', period.previousStart, period.previousEnd)
      ]);
    }
    
    // Fetch budget data if available
    const budget = await this.fetchBudgetData(connectionId, period);
    
    return {
      profitLoss: profitLoss.report_data,
      balanceSheet: balanceSheet.report_data,
      cashFlow: cashFlow.report_data,
      arAging: arAging.report_data,
      apAging: apAging.report_data,
      budget,
      previousProfitLoss: previousProfitLoss?.report_data,
      previousBalanceSheet: previousBalanceSheet?.report_data
    };
  }
  
  /**
   * Get company information
   */
  private static async getCompanyInfo(connectionId: string) {
    // Get from QuickBooks
    const qboCompanyInfo = await QuickBooksService.getCompanyInfo(connectionId);
    
    // Get additional info from database
    const { data: dbCompanyInfo } = await supabase
      .from('companies')
      .select('*')
      .eq('quickbooks_connection_id', connectionId)
      .single();
    
    return {
      id: dbCompanyInfo?.id || qboCompanyInfo.CompanyInfo.Id,
      name: qboCompanyInfo.CompanyInfo.CompanyName,
      industry: dbCompanyInfo?.industry || this.inferIndustry(qboCompanyInfo),
      size: dbCompanyInfo?.size || this.inferCompanySize(qboCompanyInfo),
      address: qboCompanyInfo.CompanyInfo.CompanyAddr,
      fiscalYearStart: qboCompanyInfo.CompanyInfo.FiscalYearStartMonth,
      logo: dbCompanyInfo?.logo_url
    };
  }
  
  /**
   * Fetch budget data
   */
  private static async fetchBudgetData(connectionId: string, period: any) {
    // This would fetch budget data from QuickBooks or a separate budget system
    // For now, return null if not available
    try {
      const { data } = await supabase
        .from('budgets')
        .select('*')
        .eq('connection_id', connectionId)
        .gte('start_date', period.start)
        .lte('end_date', period.end)
        .single();
      
      return data;
    } catch {
      return null;
    }
  }
  
  /**
   * Run scenario analysis
   */
  private static async runScenarioAnalysis(
    financialData: FinancialDataForLLM,
    baseAnalysis: LLMAnalysisResponse
  ) {
    const scenarios = [
      {
        name: 'Best Case',
        assumptions: [
          '20% revenue growth',
          '5% cost reduction',
          'Improved collection cycle by 10 days'
        ]
      },
      {
        name: 'Base Case',
        assumptions: [
          '10% revenue growth',
          'Costs remain stable',
          'Collection cycle unchanged'
        ]
      },
      {
        name: 'Worst Case',
        assumptions: [
          '5% revenue decline',
          '10% cost increase',
          'Collection cycle extends by 15 days'
        ]
      }
    ];
    
    return await PerplexityEnhancedService.getScenarioAnalysis(
      financialData,
      scenarios
    );
  }
  
  /**
   * Save report to database
   */
  private static async saveReport(reportData: any) {
    const { data, error } = await supabase
      .from('financial_reports')
      .insert({
        connection_id: reportData.connectionId,
        report_type: 'comprehensive',
        period_start: reportData.reportPeriod.start,
        period_end: reportData.reportPeriod.end,
        input_data: reportData.llmInputData,
        llm_analysis: reportData.llmAnalysis,
        report_sections: reportData.reportSections,
        dashboard_data: reportData.dashboardData,
        additional_analyses: reportData.additionalAnalyses,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Generate PDF report
   */
  private static async generatePDFReport(
    sections: ReportSection[],
    companyInfo: any,
    llmAnalysis: LLMAnalysisResponse,
    reportId: string
  ) {
    // Prepare PDF data
    const pdfData: PDFReportData = DataTransformService.preparePDFData(
      sections,
      companyInfo,
      llmAnalysis
    );
    
    // Generate PDF
    const pdfBlob = await PDFEnhancedService.generatePDF(
      pdfData,
      sections,
      llmAnalysis
    );
    
    // Upload to storage
    const fileName = `reports/${reportId}/financial-report-${new Date().toISOString()}.pdf`;
    const { data, error } = await supabase.storage
      .from('reports')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        cacheControl: '3600'
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('reports')
      .getPublicUrl(fileName);
    
    // Update report record with PDF URL
    await supabase
      .from('financial_reports')
      .update({ pdf_url: publicUrl })
      .eq('id', reportId);
    
    return publicUrl;
  }
  
  /**
   * Generate Excel report
   */
  private static async generateExcelReport(
    financialData: FinancialDataForLLM,
    llmAnalysis: LLMAnalysisResponse,
    reportId: string
  ) {
    // Generate Excel
    const excelBlob = await PDFEnhancedService.generateExcel(
      financialData,
      llmAnalysis
    );
    
    // Upload to storage
    const fileName = `reports/${reportId}/financial-report-${new Date().toISOString()}.xlsx`;
    const { data, error } = await supabase.storage
      .from('reports')
      .upload(fileName, excelBlob, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        cacheControl: '3600'
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('reports')
      .getPublicUrl(fileName);
    
    // Update report record with Excel URL
    await supabase
      .from('financial_reports')
      .update({ excel_url: publicUrl })
      .eq('id', reportId);
    
    return publicUrl;
  }
  
  /**
   * Get executive briefing
   */
  static async getExecutiveBriefing(reportId: string): Promise<string> {
    // Fetch report from database
    const { data: report, error } = await supabase
      .from('financial_reports')
      .select('llm_analysis')
      .eq('id', reportId)
      .single();
    
    if (error || !report) {
      throw new Error('Report not found');
    }
    
    // Generate executive briefing
    return await PerplexityEnhancedService.getExecutiveBriefing(
      report.llm_analysis
    );
  }
  
  /**
   * Refresh report with latest data
   */
  static async refreshReport(reportId: string) {
    // Fetch existing report
    const { data: existingReport, error } = await supabase
      .from('financial_reports')
      .select('*')
      .eq('id', reportId)
      .single();
    
    if (error || !existingReport) {
      throw new Error('Report not found');
    }
    
    // Generate new report with same parameters
    return await this.generateComprehensiveReport(
      existingReport.connection_id,
      {
        start: existingReport.period_start,
        end: existingReport.period_end
      },
      {
        includePreviousPeriod: true,
        generatePDF: true,
        generateExcel: true
      }
    );
  }
  
  /**
   * Infer industry from company data
   */
  private static inferIndustry(companyInfo: any): string {
    // Logic to infer industry from company data
    // This would use business type, SIC codes, or other indicators
    return 'technology'; // Default
  }
  
  /**
   * Infer company size
   */
  private static inferCompanySize(companyInfo: any): string {
    // Logic to infer company size from revenue, employees, etc.
    return 'small'; // Default
  }
}