import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { 
  CheckCircledIcon,
  DownloadIcon,
  ReloadIcon,
  FileTextIcon,
  MagicWandIcon,
  EyeOpenIcon
} from '@radix-ui/react-icons'
import { useToast } from '../../hooks/useToast'
import { useUser } from '@clerk/clerk-react'
import ReactMarkdown from 'react-markdown'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'

interface ReportGenerationProps {
  companyId?: string
  onReportGenerated?: (report: any) => void
}

type WorkflowStep = 'idle' | 'importing' | 'processing' | 'viewing'

interface ImportedReport {
  name: string
  status: 'pending' | 'importing' | 'completed' | 'error'
  data?: any
}

const REPORT_TYPES = [
  { id: 'profit_loss', name: 'Profit & Loss Statement' },
  { id: 'balance_sheet', name: 'Balance Sheet' },
  { id: 'cash_flow', name: 'Cash Flow Statement' },
  { id: 'accounts_receivable', name: 'Accounts Receivable Aging' },
  { id: 'accounts_payable', name: 'Accounts Payable Aging' },
  { id: 'trial_balance', name: 'Trial Balance' },
  { id: 'general_ledger', name: 'General Ledger' },
  { id: 'customer_sales', name: 'Customer Sales Summary' },
  { id: 'vendor_expenses', name: 'Vendor Expenses Summary' },
  { id: 'inventory_valuation', name: 'Inventory Valuation Summary' }
]

export function ReportGeneration({ companyId, onReportGenerated }: ReportGenerationProps) {
  const { user } = useUser()
  const { toast } = useToast()
  
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('idle')
  const [importedReports, setImportedReports] = useState<ImportedReport[]>([])
  const [allReportsData, setAllReportsData] = useState<any>(null)
  const [llmAnalysis, setLlmAnalysis] = useState<any>(null)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [processingProgress, setProcessingProgress] = useState(0)

  const handleImportData = async () => {
    setWorkflowStep('importing')
    setImportProgress(0)
    
    // Initialize all reports as pending
    const reports = REPORT_TYPES.map(type => ({
      name: type.name,
      status: 'pending' as const,
      data: null
    }))
    setImportedReports(reports)

    try {
      // TODO: Replace with actual webhook call to backend
      // For now, simulate importing each report
      for (let i = 0; i < REPORT_TYPES.length; i++) {
        const updatedReports = [...reports]
        updatedReports[i].status = 'importing'
        setImportedReports([...updatedReports])
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500))
        
        updatedReports[i].status = 'completed'
        updatedReports[i].data = { 
          // Mock data for now
          reportType: REPORT_TYPES[i].id,
          companyId,
          timestamp: new Date().toISOString()
        }
        setImportedReports([...updatedReports])
        setImportProgress(((i + 1) / REPORT_TYPES.length) * 100)
      }

      // Combine all report data
      const combinedData = {
        companyId,
        timestamp: new Date().toISOString(),
        reports: reports.reduce((acc, report, index) => {
          acc[REPORT_TYPES[index].id] = report.data
          return acc
        }, {} as any)
      }
      
      setAllReportsData(combinedData)
      
      toast({
        title: 'Import Complete',
        description: 'All financial reports have been imported successfully',
      })

      // Automatically proceed to processing
      setTimeout(() => handleGenerateReport(combinedData), 1000)
      
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: 'Import Failed',
        description: 'Failed to import QuickBooks data. Please try again.',
        variant: 'destructive',
      })
      setWorkflowStep('idle')
    }
  }

  const handleGenerateReport = async (data: any) => {
    setWorkflowStep('processing')
    setProcessingProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90))
      }, 300)

      // TODO: Call Perplexity LLM API
      // For now, simulate the API call
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      clearInterval(progressInterval)
      setProcessingProgress(95)

      const mockAnalysis = {
        summary: "## Financial Health Analysis\n\nBased on the comprehensive analysis of your QuickBooks data, here are the key findings:\n\n### Key Metrics\n- **Revenue Growth**: Positive trend with 15% increase YoY\n- **Expense Management**: Well controlled with 8% reduction in operational costs\n- **Cash Flow**: Healthy positive cash flow maintained throughout the period\n\n### Recommendations\n1. Continue current expense management strategies\n2. Explore opportunities for revenue diversification\n3. Consider investing excess cash in growth initiatives",
        score: 85,
        timestamp: new Date().toISOString()
      }
      
      setLlmAnalysis(mockAnalysis)
      
      // TODO: Generate PDF using VITE_PDF_API_URL
      // For now, use a mock URL
      const mockPdfUrl = 'data:application/pdf;base64,mockpdfdata'
      setPdfUrl(mockPdfUrl)
      
      setProcessingProgress(100)
      setWorkflowStep('viewing')
      
      if (onReportGenerated) {
        onReportGenerated({
          data,
          analysis: mockAnalysis,
          pdfUrl: mockPdfUrl
        })
      }

      toast({
        title: 'Report Generated',
        description: 'Your financial analysis report is ready',
      })
      
    } catch (error) {
      console.error('Processing error:', error)
      toast({
        title: 'Processing Failed',
        description: 'Failed to generate report. Please try again.',
        variant: 'destructive',
      })
      setWorkflowStep('idle')
    }
  }

  const handleDownloadPdf = () => {
    if (pdfUrl) {
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `financial-report-${new Date().toISOString().split('T')[0]}.pdf`
      link.click()
    }
  }

  const handleReset = () => {
    setWorkflowStep('idle')
    setImportedReports([])
    setAllReportsData(null)
    setLlmAnalysis(null)
    setPdfUrl('')
    setImportProgress(0)
    setProcessingProgress(0)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Data Import & Report Generation
              </CardTitle>
              <CardDescription>
                Import all QuickBooks reports and generate AI-powered analysis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {workflowStep === 'idle' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-900">
                  Click below to import all financial reports from QuickBooks. This will fetch:
                  <ul className="list-disc list-inside mt-2">
                    <li>Profit & Loss, Balance Sheet, Cash Flow</li>
                    <li>Accounts Receivable/Payable Aging</li>
                    <li>Trial Balance, General Ledger</li>
                    <li>Customer/Vendor Summaries & more</li>
                  </ul>
                </div>
              </div>
              <Button 
                onClick={handleImportData}
                className="w-full"
                size="lg"
              >
                <DownloadIcon className="mr-2" />
                Import Data First
              </Button>
            </div>
          )}

          {workflowStep === 'importing' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importing Reports...</span>
                  <span>{Math.round(importProgress)}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {importedReports.map((report, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{report.name}</span>
                    <div className="flex items-center gap-2">
                      {report.status === 'pending' && (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                      {report.status === 'importing' && (
                        <Badge variant="default">
                          <ReloadIcon className="mr-1 animate-spin" />
                          Importing...
                        </Badge>
                      )}
                      {report.status === 'completed' && (
                        <Badge className="bg-success-600">
                          <CheckCircledIcon className="mr-1" />
                          Imported
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {workflowStep === 'processing' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <MagicWandIcon className="h-12 w-12 mx-auto mb-4 text-primary-600 animate-pulse" />
                <h3 className="text-lg font-semibold mb-2">Processing Your Data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  AI is analyzing your financial reports...
                </p>
                <Progress value={processingProgress} className="mb-2" />
                <span className="text-sm text-gray-500">{Math.round(processingProgress)}% Complete</span>
              </div>
            </div>
          )}

          {workflowStep === 'viewing' && llmAnalysis && (
            <div className="space-y-4">
              <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-success-700">
                  <CheckCircledIcon className="h-5 w-5" />
                  <span className="font-semibold">Report Generated Successfully</span>
                </div>
              </div>

              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{llmAnalysis.summary}</ReactMarkdown>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowPdfViewer(true)}
                  className="flex-1"
                >
                  <EyeOpenIcon className="mr-2" />
                  View PDF Report
                </Button>
                <Button 
                  onClick={handleDownloadPdf}
                  variant="outline"
                  className="flex-1"
                >
                  <DownloadIcon className="mr-2" />
                  Download PDF
                </Button>
              </div>

              <Button 
                onClick={handleReset}
                variant="outline"
                className="w-full"
              >
                <ReloadIcon className="mr-2" />
                Generate New Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPdfViewer} onOpenChange={setShowPdfViewer}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Financial Analysis Report</DialogTitle>
            <DialogDescription>
              Your comprehensive financial analysis report
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfUrl ? (
              <iframe 
                src={pdfUrl}
                className="w-full h-full border-0"
                title="Financial Report PDF"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading PDF...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}