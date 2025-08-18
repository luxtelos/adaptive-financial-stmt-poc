import { useState } from 'react'

interface Report {
  id: string
  type: string
  title: string
  description: string
  createdAt: string
  score?: number
}

export function useReports() {
  const [reportStatus, setReportStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [reportProgress, setReportProgress] = useState(0)
  const [availableReports, setAvailableReports] = useState<Report[]>([])

  const generateReport = async (reportType: string) => {
    try {
      setReportStatus('generating')
      setReportProgress(0)

      // Simulate AI report generation progress
      const progressInterval = setInterval(() => {
        setReportProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval)
            setReportStatus('success')
            
            // Add the new report to available reports
            const newReport: Report = {
              id: Date.now().toString(),
              type: reportType,
              title: getReportTitle(reportType),
              description: 'AI-generated financial analysis report',
              createdAt: new Date().toISOString(),
              score: Math.floor(Math.random() * 40) + 60 // Random score between 60-100
            }
            
            setAvailableReports(prev => [newReport, ...prev])
            return 100
          }
          return prev + 8
        })
      }, 400)

      // Mock API calls:
      // 1. Call webhook to send data to Perplexity Pro LLM
      // 2. Receive analyzed results
      console.log('Sending data to Perplexity Pro LLM via webhook...')
      
    } catch (error) {
      setReportStatus('error')
      console.error('Failed to generate report:', error)
    }
  }

  const downloadPDF = async (reportId: string) => {
    try {
      // Mock API call to webhook that converts report to PDF
      console.log('Converting report to PDF via webhook...')
      
      // Simulate PDF download
      const link = document.createElement('a')
      link.href = '#' // In real app, this would be the PDF blob URL
      link.download = `financial-report-${reportId}.pdf`
      link.click()
      
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  const getReportTitle = (type: string) => {
    switch (type) {
      case 'financial-health':
        return 'Financial Health Assessment'
      case 'cash-flow':
        return 'Cash Flow Analysis'
      case 'profitability':
        return 'Profitability Analysis'
      default:
        return 'Financial Report'
    }
  }

  return {
    reportStatus,
    reportProgress,
    availableReports,
    generateReport,
    downloadPDF
  }
}