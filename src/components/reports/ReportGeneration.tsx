import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { 
  ReloadIcon,
  FileTextIcon,
  DownloadIcon,
  MagicWandIcon,
  CheckCircledIcon,
  EyeOpenIcon
} from '@radix-ui/react-icons'
import { PerplexityService } from '../../services/perplexity.service'
import { PDFService } from '../../services/pdf.service'
import { supabase, FinancialReport } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'
import { useUser } from '@clerk/clerk-react'
import ReactMarkdown from 'react-markdown'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

interface ReportGenerationProps {
  financialData?: any
  companyId?: string
}

export function ReportGeneration({ financialData, companyId }: ReportGenerationProps) {
  const { user } = useUser()
  const { toast } = useToast()
  const [selectedReportType, setSelectedReportType] = useState('profit_loss')
  const [reportStatus, setReportStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [reportProgress, setReportProgress] = useState(0)
  const [availableReports, setAvailableReports] = useState<FinancialReport[]>([])
  const [selectedReport, setSelectedReport] = useState<FinancialReport | null>(null)
  const [showReportDialog, setShowReportDialog] = useState(false)

  useEffect(() => {
    if (companyId) {
      loadReports()
    }
  }, [companyId])

  const loadReports = async () => {
    if (!companyId) return

    const { data, error } = await supabase
      .from('financial_reports')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data && !error) {
      setAvailableReports(data)
    }
  }

  const handleGenerateReport = async () => {
    if (!financialData || !companyId) {
      toast({
        title: 'Error',
        description: 'Please import financial data first',
        variant: 'destructive',
      })
      return
    }

    setReportStatus('generating')
    setReportProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setReportProgress(prev => Math.min(prev + 15, 85))
      }, 500)

      // Generate AI analysis
      const analysis = await PerplexityService.analyzeFinancialReport(
        financialData,
        selectedReportType
      )

      clearInterval(progressInterval)
      setReportProgress(90)

      // Generate PDF
      const pdfUrl = await PDFService.generateFinancialReportPDF(
        financialData,
        analysis,
        user?.fullName || 'Company'
      )

      setReportProgress(95)

      // Calculate score based on analysis
      const score = calculateFinancialScore(financialData, selectedReportType)

      // Save report to database
      const { data: report, error } = await supabase
        .from('financial_reports')
        .insert({
          company_id: companyId,
          report_type: selectedReportType,
          period_start: new Date().toISOString(),
          period_end: new Date().toISOString(),
          raw_data: financialData,
          ai_analysis: analysis,
          pdf_url: pdfUrl,
          score: score,
          status: 'completed',
        })
        .select()
        .single()

      if (error) throw error

      setReportProgress(100)
      setReportStatus('success')
      
      // Reload reports
      await loadReports()

      toast({
        title: 'Report Generated',
        description: 'Your financial analysis report is ready',
        variant: 'success',
      })
    } catch (error) {
      console.error('Report generation error:', error)
      setReportStatus('error')
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate the report. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const calculateFinancialScore = (data: any, reportType: string): number => {
    // Simplified scoring logic - in production this would be more sophisticated
    let score = 70 // Base score

    if (data.netIncome > 0) score += 10
    if (data.cashFlow > 0) score += 10
    if (data.currentRatio > 1.5) score += 5
    if (data.debtToEquity < 1) score += 5

    return Math.min(100, Math.max(0, score))
  }

  const handleDownloadPDF = async (reportId: string) => {
    const report = availableReports.find(r => r.id === reportId)
    if (!report || !report.pdf_url) {
      toast({
        title: 'Error',
        description: 'PDF not available for this report',
        variant: 'destructive',
      })
      return
    }

    PDFService.downloadPDF(
      report.pdf_url,
      `financial-report-${report.report_type}-${new Date(report.created_at).toISOString().split('T')[0]}.pdf`
    )
  }

  const handleViewReport = (report: FinancialReport) => {
    setSelectedReport(report)
    setShowReportDialog(true)
  }

  const reportTypes = [
    {
      id: 'profit_loss',
      title: 'Profit & Loss Analysis',
      description: 'Comprehensive income statement analysis with revenue and expense insights'
    },
    {
      id: 'balance_sheet',
      title: 'Balance Sheet Analysis',
      description: 'Asset, liability, and equity position with financial ratios'
    },
    {
      id: 'cash_flow',
      title: 'Cash Flow Analysis',
      description: 'Cash flow patterns, liquidity analysis, and working capital management'
    },
    {
      id: 'trial_balance',
      title: 'Trial Balance Review',
      description: 'Account balances verification and audit preparation insights'
    }
  ]

  const getScoreColor = (score?: number) => {
    if (!score) return 'secondary'
    if (score >= 80) return 'success'
    if (score >= 60) return 'warning'
    return 'destructive'
  }

  return (
    <div className="space-y-6">
      {/* Report Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MagicWandIcon className="h-5 w-5 mr-2 text-primary-600" />
            AI-Powered Report Generation
          </CardTitle>
          <CardDescription>
            Generate intelligent financial reports using Perplexity Pro AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Select Report Type
              </label>
              <div className="space-y-2">
                {reportTypes.map((type) => (
                  <div key={type.id} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id={type.id}
                      name="reportType"
                      value={type.id}
                      checked={selectedReportType === type.id}
                      onChange={(e) => setSelectedReportType(e.target.value)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor={type.id} className="flex-1 cursor-pointer">
                      <div className="font-medium text-gray-900">{type.title}</div>
                      <div className="text-sm text-gray-500">{type.description}</div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {reportStatus === 'generating' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Generating report...</span>
                  <span className="text-sm text-gray-500">{reportProgress}%</span>
                </div>
                <Progress value={reportProgress} />
                <p className="text-sm text-gray-600">
                  AI is analyzing your financial data and generating insights...
                </p>
              </div>
            )}

            <Button 
              onClick={handleGenerateReport}
              disabled={reportStatus === 'generating' || !financialData}
              className="w-full"
              size="lg"
              variant={reportStatus === 'success' ? 'success' : 'default'}
            >
              {reportStatus === 'generating' ? (
                <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : reportStatus === 'success' ? (
                <CheckCircledIcon className="h-4 w-4 mr-2" />
              ) : (
                <MagicWandIcon className="h-4 w-4 mr-2" />
              )}
              {reportStatus === 'generating' ? 'Generating AI Analysis...' : 
               reportStatus === 'success' ? 'Report Generated Successfully' :
               !financialData ? 'Import Data First' : 'Generate AI Report'}
            </Button>

            {!financialData && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Please import financial data from QuickBooks before generating reports.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Reports */}
      {availableReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileTextIcon className="h-5 w-5 mr-2 text-primary-600" />
              Generated Reports
            </CardTitle>
            <CardDescription>
              View and download your generated financial analysis reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableReports.map((report) => (
                <div 
                  key={report.id} 
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {reportTypes.find(t => t.id === report.report_type)?.title || report.report_type}
                      </h4>
                      {report.score !== undefined && (
                        <Badge variant={getScoreColor(report.score)}>
                          Score: {report.score}/100
                        </Badge>
                      )}
                      <Badge variant={report.status === 'completed' ? 'success' : 'secondary'}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Generated on {new Date(report.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewReport(report)}
                    >
                      <EyeOpenIcon className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadPDF(report.id)}
                      disabled={!report.pdf_url}
                    >
                      <DownloadIcon className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report View Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReport && reportTypes.find(t => t.id === selectedReport.report_type)?.title}
            </DialogTitle>
            <DialogDescription>
              AI-powered financial analysis generated on {selectedReport && new Date(selectedReport.created_at).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {selectedReport?.ai_analysis && (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{selectedReport.ai_analysis}</ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}