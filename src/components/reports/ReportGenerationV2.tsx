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

  // Helper function to normalize column titles
  const normalizeColumnTitle = (title: string) => {
    return title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  }

  // Function to extract table data from financial reports with dynamic column support
  const extractTableData = (reportData: any) => {
    if (!reportData) return []
    
    const tableRows: any[] = []
    
    // Check if this is a "No Report Data" case
    const hasNoData = reportData.headers?.Option?.some((opt: any) => 
      opt.Name === 'NoReportData' && opt.Value === 'true'
    )
    
    if (hasNoData) {
      tableRows.push({
        type: 'message',
        account: 'No data available for the selected period',
        amount: '',
        group: 'NoData',
        level: 0
      })
      return tableRows
    }
    
    // Get columns to determine structure
    const columns = reportData.columns?.Column || []
    
    // Helper function to extract row data based on column structure
    const extractRowData = (colData: any[], level: number = 0, type: string = 'data') => {
      const rowData: any = { type: type.toLowerCase(), level }
      
      // Map each column data to the appropriate key
      colData.forEach((col: any, index: number) => {
        const column = columns[index]
        if (column) {
          const columnKey = column.MetaData?.find((m: any) => m.Name === 'ColKey')?.Value || 
                           (column.ColTitle ? normalizeColumnTitle(column.ColTitle) : '') || 
                           `col_${index}`
          rowData[columnKey] = col.value || ''
        }
      })
      
      // For backward compatibility with simple 2-column reports
      if (columns.length <= 2) {
        rowData.account = colData[0]?.value || ''
        rowData.amount = colData[1]?.value || ''
      }
      
      return rowData
    }
    
    // Helper function to recursively process rows
    const processRows = (rows: any[], level: number = 0) => {
      rows.forEach((row: any) => {
        // Handle Header rows
        if (row.Header?.ColData) {
          tableRows.push(extractRowData(row.Header.ColData, level, 'header'))
        }
        
        // Handle direct ColData
        if (row.ColData) {
          const rowType = row.type || 'data'
          tableRows.push(extractRowData(row.ColData, level, rowType))
        }
        
        // Handle Summary rows
        if (row.Summary?.ColData) {
          tableRows.push(extractRowData(row.Summary.ColData, level, 'summary'))
        }
        
        // Handle nested rows
        if (row.Rows?.Row) {
          processRows(row.Rows.Row, level + 1)
        }
      })
    }
    
    // Extract rows from the report
    if (reportData.rows?.Row) {
      processRows(reportData.rows.Row)
    }
    
    return tableRows
  }

  // Function to extract multi-column table data (for AR/AP reports)
  const extractMultiColumnData = (reportData: any) => {
    if (!reportData) return []
    
    const tableRows: any[] = []
    const columns = reportData.columns?.Column || []
    
    if (reportData.rows?.Row) {
      reportData.rows.Row.forEach((row: any) => {
        const rowData: any = { type: row.type?.toLowerCase() || 'data' }
        
        // Extract data from ColData or Summary
        const colData = row.ColData || row.Summary?.ColData || []
        
        colData.forEach((col: any, index: number) => {
          const columnKey = columns[index]?.MetaData?.find((m: any) => m.Name === 'ColKey')?.Value || `col_${index}`
          rowData[columnKey] = col.value || ''
        })
        
        tableRows.push(rowData)
      })
    }
    
    return tableRows
  }

  const formatMoney = (value: string) => {
    if (!value || value === '' || value === '0.00') return '-'
    const num = parseFloat(value)
    if (isNaN(num)) return value
    
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Math.abs(num))

    return num < 0 ? `(${formatted})` : formatted
  }

  const getIndentation = (level: number) => {
    return 'pl-' + (level * 4)
  }

  const renderDataPreview = () => {
    if (!previewData) return null

    return (
      <div className="mt-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Financial Data Preview</h3>
            <p className="text-sm text-gray-600">
              {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRawData(!showRawData)}
            className="border-gray-300"
          >
            <CodeIcon className="h-4 w-4 mr-2" />
            {showRawData ? 'Tables' : 'JSON'}
          </Button>
        </div>

        {showRawData ? (
          <div className="bg-gray-900 rounded-md p-4 max-h-96 overflow-auto">
            <pre className="text-green-400 text-xs font-mono">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Profit & Loss MTD */}
            {previewData.plMTD && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900">Profit & Loss Statement (MTD)</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {previewData.plMTD.headers.StartPeriod} to {previewData.plMTD.headers.EndPeriod}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900">Account</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {extractTableData(previewData.plMTD).map((row, index) => (
                        <tr key={index} className={`
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          ${row.type === 'header' ? 'bg-gray-100 font-medium' : ''} 
                          ${row.type === 'summary' ? 'bg-gray-100 font-semibold border-t-2 border-gray-300' : ''}
                          hover:bg-gray-50 transition-colors
                        `}>
                          <td className={`py-3 px-6 text-sm text-gray-900 ${getIndentation(row.level)}`}>
                            <div className="flex items-center">
                              {row.level > 0 && <span className="text-gray-400 mr-2">—</span>}
                              {row.account}
                            </div>
                          </td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">
                            {formatMoney(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Profit & Loss QTD */}
            {previewData.plQTD && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900">Profit & Loss Statement (QTD)</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {previewData.plQTD.headers.StartPeriod} to {previewData.plQTD.headers.EndPeriod}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900">Account</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {extractTableData(previewData.plQTD).map((row, index) => (
                        <tr key={index} className={`
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          ${row.type === 'header' ? 'bg-gray-100 font-medium' : ''} 
                          ${row.type === 'summary' ? 'bg-gray-100 font-semibold border-t-2 border-gray-300' : ''}
                          hover:bg-gray-50 transition-colors
                        `}>
                          <td className={`py-3 px-6 text-sm text-gray-900 ${getIndentation(row.level)}`}>
                            <div className="flex items-center">
                              {row.level > 0 && <span className="text-gray-400 mr-2">—</span>}
                              {row.account}
                            </div>
                          </td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">
                            {formatMoney(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Balance Sheet */}
            {previewData.balanceSheet && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900">Balance Sheet</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    As of {previewData.balanceSheet.headers.EndPeriod}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900">Account</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {extractTableData(previewData.balanceSheet).map((row, index) => (
                        <tr key={index} className={`
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          ${row.type === 'header' ? 'bg-gray-100 font-medium' : ''} 
                          ${row.type === 'summary' ? 'bg-gray-100 font-semibold border-t-2 border-gray-300' : ''}
                          hover:bg-gray-50 transition-colors
                        `}>
                          <td className={`py-3 px-6 text-sm text-gray-900 ${getIndentation(row.level)}`}>
                            <div className="flex items-center">
                              {row.level > 0 && <span className="text-gray-400 mr-2">—</span>}
                              {row.account}
                            </div>
                          </td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">
                            {formatMoney(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cash Flow */}
            {previewData.cashFlow && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900">Cash Flow Statement</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {previewData.cashFlow.headers.StartPeriod} to {previewData.cashFlow.headers.EndPeriod}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900">Account</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {extractTableData(previewData.cashFlow).map((row, index) => (
                        <tr key={index} className={`
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          ${row.type === 'header' ? 'bg-gray-100 font-medium' : ''} 
                          ${row.type === 'summary' ? 'bg-gray-100 font-semibold border-t-2 border-gray-300' : ''}
                          hover:bg-gray-50 transition-colors
                        `}>
                          <td className={`py-3 px-6 text-sm text-gray-900 ${getIndentation(row.level)}`}>
                            <div className="flex items-center">
                              {row.level > 0 && <span className="text-gray-400 mr-2">—</span>}
                              {row.account}
                            </div>
                          </td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">
                            {formatMoney(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Aged Receivables */}
            {previewData.ar && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900">Aged Receivables</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    As of {previewData.ar.headers.EndPeriod}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900">Customer</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">Current</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">1-30</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">31-60</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">61-90</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">91+</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {extractMultiColumnData(previewData.ar).map((row, index) => (
                        <tr key={index} className={`
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          ${row.type === 'summary' ? 'bg-gray-100 font-semibold border-t-2 border-gray-300' : ''}
                          hover:bg-gray-50 transition-colors
                        `}>
                          <td className="py-3 px-6 text-sm text-gray-900">{row.col_0 || '—'}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row.current)}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row['0'])}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row['1'])}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row['2'])}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row['3'])}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono font-medium">{formatMoney(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Aged Payables */}
            {previewData.ap && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900">Aged Payables</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    As of {previewData.ap.headers.EndPeriod}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900">Vendor</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">Current</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">1-30</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">31-60</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">61-90</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">91+</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {extractMultiColumnData(previewData.ap).map((row, index) => (
                        <tr key={index} className={`
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                          ${row.type === 'summary' ? 'bg-gray-100 font-semibold border-t-2 border-gray-300' : ''}
                          hover:bg-gray-50 transition-colors
                        `}>
                          <td className="py-3 px-6 text-sm text-gray-900">{row.col_0 || '—'}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row.current)}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row['0'])}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row['1'])}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row['2'])}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono">{formatMoney(row['3'])}</td>
                          <td className="py-3 px-6 text-right text-sm text-gray-900 font-mono font-medium">{formatMoney(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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