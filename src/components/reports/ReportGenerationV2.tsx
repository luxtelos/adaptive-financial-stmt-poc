import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Alert, AlertDescription } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Spinner } from '../ui/spinner'
import { Progress } from '../ui/progress'
import { 
  FileTextIcon, 
  DownloadIcon, 
  CheckCircledIcon,
  ExclamationTriangleIcon,
  RocketIcon,
  ReloadIcon,
  EyeOpenIcon,
  CodeIcon,
  CalendarIcon
} from '@radix-ui/react-icons'
import { useToast } from '../../hooks/useToast'
import { useQuickBooks } from '../../hooks/useQuickBooks'
import reportGenerationService, { MonthlyReportData, ReportGenerationResult } from '../../services/report-generation.service'
import { logger } from '../../lib/logger'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import ReactMarkdown from 'react-markdown'

const componentLogger = logger.child('ReportGenerationV2')

interface ReportGenerationProps {
  companyId?: string
  onReportGenerated?: (report: any) => void
}

export function ReportGenerationV2({ companyId, onReportGenerated }: ReportGenerationProps) {
  const { toast } = useToast()
  const { 
    isConnected, 
    currentToken,
    realmId 
  } = useQuickBooks()
  
  // State management
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [previewData, setPreviewData] = useState<MonthlyReportData | null>(null)
  const [showDataPreview, setShowDataPreview] = useState(false)
  const [showRawData, setShowRawData] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<ReportGenerationResult | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)

  // Initialize with current month/year
  useEffect(() => {
    const now = new Date()
    setSelectedMonth((now.getMonth() + 1).toString())
    setSelectedYear(now.getFullYear().toString())
  }, [])

  // Generate month options
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: new Date(2024, i, 1).toLocaleString('default', { month: 'long' })
  }))

  // Generate year options (last 3 years)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => ({
    value: (currentYear - i).toString(),
    label: (currentYear - i).toString()
  }))

  const handlePreviewData = async () => {
    if (!selectedMonth || !selectedYear) {
      toast({
        title: 'Select Period',
        description: 'Please select month and year',
        variant: 'destructive',
      })
      return
    }

    if (!currentToken) {
      toast({
        title: 'No Connection',
        description: 'QuickBooks connection required',
        variant: 'destructive',
      })
      return
    }

    setIsLoadingPreview(true)
    componentLogger.info('Fetching data preview', { month: selectedMonth, year: selectedYear })
    
    try {
      const data = await reportGenerationService.fetchMonthlyData({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        realmId: currentToken.realm_id,
        token: currentToken.access_token
      })
      
      if (data) {
        setPreviewData(data)
        setShowDataPreview(true)
        componentLogger.debug('Preview data loaded successfully')
        
        toast({
          title: 'Data Retrieved',
          description: 'Financial data ready for review',
        })
      }
    } catch (error) {
      componentLogger.error('Failed to fetch preview data', error)
      toast({
        title: 'Fetch Failed',
        description: 'Failed to retrieve financial data from QuickBooks',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!previewData) {
      toast({
        title: 'No Data',
        description: 'Please preview data first',
        variant: 'destructive',
      })
      return
    }

    if (!currentToken) {
      toast({
        title: 'No Connection',
        description: 'QuickBooks connection required',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)
    componentLogger.group('Report Generation')
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => Math.min(prev + 10, 90))
    }, 500)
    
    try {
      const result = await reportGenerationService.generateCompleteReport({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        realmId: currentToken.realm_id,
        token: currentToken.access_token
      })
      
      clearInterval(progressInterval)
      setGenerationProgress(100)
      
      if (result.success && result.data) {
        setGeneratedReport(result)
        setPdfBlob(result.data.pdfBlob || null)
        
        // REMOVED: Database storage to maintain stateless architecture
        // Financial data is NOT stored - exists only during active session
        
        componentLogger.info('Report generated successfully')
        toast({
          title: 'Report Generated',
          description: 'Your comprehensive financial report is ready',
        })
        
        if (onReportGenerated) {
          onReportGenerated(result.data)
        }
      } else {
        throw new Error(result.error || 'Report generation failed')
      }
    } catch (error) {
      clearInterval(progressInterval)
      componentLogger.error('Report generation failed', error)
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate report',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
      componentLogger.groupEnd()
    }
  }

  const handleViewPDF = (openInNewTab = false) => {
    if (!pdfBlob) {
      toast({
        title: 'No PDF Available',
        description: 'Please generate a report first',
        variant: 'destructive',
      })
      return
    }

    componentLogger.info('Opening PDF viewer', { openInNewTab })
    
    if (openInNewTab) {
      const url = URL.createObjectURL(pdfBlob)
      window.open(url, '_blank')
      // Clean up the URL after a delay to ensure it opens
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else {
      setShowPdfViewer(true)
    }
  }

  const handleDownloadPDF = () => {
    if (!pdfBlob) {
      toast({
        title: 'No PDF Available',
        description: 'Please generate a report first',
        variant: 'destructive',
      })
      return
    }

    componentLogger.info('Downloading PDF report')
    
    const url = URL.createObjectURL(pdfBlob)
    const element = document.createElement('a')
    element.setAttribute('href', url)
    element.setAttribute('download', `financial-report-${selectedYear}-${selectedMonth}.pdf`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(url)
    
    toast({
      title: 'Download Started',
      description: 'Your report is being downloaded',
    })
  }

  const renderDataPreview = () => {
    if (!previewData) return null

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">
            Data Preview - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </h4>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRawData(!showRawData)}
            >
              <CodeIcon className="h-4 w-4 mr-1" />
              {showRawData ? 'Hide' : 'Show'} Raw
            </Button>
          </div>
        </div>
        
        {!showRawData ? (
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between">
                <span className="text-gray-600">P&L MTD:</span>
                <Badge variant={previewData.plMTD ? "default" : "secondary"}>
                  {previewData.plMTD ? 'Available' : 'Missing'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">P&L QTD:</span>
                <Badge variant={previewData.plQTD ? "default" : "secondary"}>
                  {previewData.plQTD ? 'Available' : 'Missing'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Balance Sheet:</span>
                <Badge variant={previewData.balanceSheet ? "default" : "secondary"}>
                  {previewData.balanceSheet ? 'Available' : 'Missing'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cash Flow:</span>
                <Badge variant={previewData.cashFlow ? "default" : "secondary"}>
                  {previewData.cashFlow ? 'Available' : 'Missing'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">AR Aging:</span>
                <Badge variant={previewData.ar ? "default" : "secondary"}>
                  {previewData.ar ? 'Available' : 'Missing'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">AP Aging:</span>
                <Badge variant={previewData.ap ? "default" : "secondary"}>
                  {previewData.ap ? 'Available' : 'Missing'}
                </Badge>
              </div>
            </div>
            {previewData.metadata && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Period: {previewData.metadata.month}/{previewData.metadata.year} | 
                  Quarter: Q{previewData.metadata.quarter} |
                  Retrieved: {new Date(previewData.metadata.generatedAt).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-60 overflow-auto">
            <pre className="text-xs text-gray-600">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <FileTextIcon className="mr-2" />
                Monthly Financial Report Generation
              </CardTitle>
              <CardDescription>
                Generate comprehensive AI-powered financial reports from QuickBooks data
              </CardDescription>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Period Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Month</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                onClick={handlePreviewData}
                disabled={!isConnected || isLoadingPreview || !selectedMonth || !selectedYear}
                className="w-full"
                size="lg"
                variant={showDataPreview ? "outline" : "default"}
              >
                {isLoadingPreview ? (
                  <>
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Data...
                  </>
                ) : (
                  <>
                    <EyeOpenIcon className="mr-2" />
                    {showDataPreview ? 'Refresh Data' : 'Preview Financial Data'}
                  </>
                )}
              </Button>

              {/* Data Preview */}
              {showDataPreview && previewData && renderDataPreview()}

              {/* Generate Report Button */}
              {previewData && (
                <Button 
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full"
                  variant="outline"
                >
                  {isGenerating ? (
                    <>
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <RocketIcon className="mr-2" />
                      Generate AI Report
                    </>
                  )}
                </Button>
              )}

              {/* Generation Progress */}
              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={generationProgress} />
                  <p className="text-xs text-center text-gray-500">
                    {generationProgress < 30 && 'Fetching financial data...'}
                    {generationProgress >= 30 && generationProgress < 70 && 'Analyzing with AI...'}
                    {generationProgress >= 70 && generationProgress < 90 && 'Generating PDF...'}
                    {generationProgress >= 90 && 'Finalizing report...'}
                  </p>
                </div>
              )}

              {/* Success State */}
              {generatedReport?.success && pdfBlob && (
                <div className="space-y-3">
                  <Alert className="border-green-500 bg-green-50">
                    <CheckCircledIcon className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Report generated successfully!
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleViewPDF(false)}
                        className="flex-1"
                        variant="outline"
                      >
                        <EyeOpenIcon className="mr-2" />
                        View PDF
                      </Button>
                      <Button 
                        onClick={handleDownloadPDF}
                        className="flex-1"
                        variant="default"
                      >
                        <DownloadIcon className="mr-2" />
                        Download
                      </Button>
                    </div>
                    <Button 
                      onClick={() => handleViewPDF(true)}
                      className="w-full"
                      variant="outline"
                      size="sm"
                    >
                      Open PDF in New Tab
                    </Button>
                  </div>
                </div>
              )}

              {/* LLM Report Preview */}
              {generatedReport?.data?.llmReport && (
                <div className="mt-4 p-4 bg-white border rounded-lg max-h-96 overflow-auto">
                  <h4 className="text-sm font-semibold mb-2">Report Preview</h4>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{generatedReport.data.llmReport}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Detailed Analysis Section */}
              {generatedReport?.data?.detailedAnalysis && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg max-h-64 overflow-auto">
                  <h4 className="text-sm font-semibold mb-2 text-gray-700">Detailed Financial Analysis</h4>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                    {generatedReport.data.detailedAnalysis}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF Viewer Dialog */}
      <Dialog open={showPdfViewer} onOpenChange={setShowPdfViewer}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Financial Report - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </DialogTitle>
            <DialogDescription>
              Comprehensive financial analysis generated by AI
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfBlob ? (
              <iframe 
                src={URL.createObjectURL(pdfBlob)}
                className="w-full h-full border-0"
                title="Financial Report PDF"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Spinner size="xl" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}