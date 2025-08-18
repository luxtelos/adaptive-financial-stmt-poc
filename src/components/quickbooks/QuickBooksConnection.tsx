import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { 
  CheckCircledIcon, 
  CrossCircledIcon, 
  ReloadIcon, 
  Link2Icon,
  DownloadIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons'
import { QuickBooksService } from '../../services/quickbooks.service'
import { useToast } from '../../hooks/useToast'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '../../lib/supabase'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

interface QuickBooksConnectionProps {
  onDataImported?: (data: any) => void
}

export function QuickBooksConnection({ onDataImported }: QuickBooksConnectionProps) {
  const { user } = useUser()
  const { toast } = useToast()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [importProgress, setImportProgress] = useState(0)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [reportType, setReportType] = useState('profit_loss')
  const [dateRange, setDateRange] = useState('last_month')
  const [companyInfo, setCompanyInfo] = useState<any>(null)

  useEffect(() => {
    checkConnection()
  }, [user])

  const checkConnection = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from('quickbooks_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data && !error) {
      setIsConnected(true)
      setConnectionId(data.id)
      setLastSync(data.last_sync)
      
      // Check if token is still valid
      const isValid = await QuickBooksService.checkConnectionStatus(data.id)
      if (!isValid) {
        await refreshToken(data.id, data.refresh_token)
      }
      
      // Get company info
      try {
        const info = await QuickBooksService.getCompanyInfo(data.id)
        setCompanyInfo(info)
      } catch (err) {
        console.error('Error fetching company info:', err)
      }
    }
  }

  const refreshToken = async (connId: string, refreshToken: string) => {
    try {
      const tokens = await QuickBooksService.refreshAccessToken(refreshToken)
      // Update tokens in database
      await supabase
        .from('quickbooks_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq('id', connId)
    } catch (error) {
      console.error('Error refreshing token:', error)
      setIsConnected(false)
    }
  }

  const handleConnect = () => {
    const state = crypto.randomUUID()
    localStorage.setItem('qbo_auth_state', state)
    const authUrl = QuickBooksService.getAuthorizationUrl(state)
    window.location.href = authUrl
  }

  const handleImportData = async () => {
    if (!connectionId) {
      toast({
        title: 'Error',
        description: 'No QuickBooks connection found',
        variant: 'destructive',
      })
      return
    }

    setImportStatus('importing')
    setImportProgress(0)

    try {
      // Calculate date range
      const endDate = new Date()
      let startDate = new Date()
      
      switch (dateRange) {
        case 'last_month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'last_quarter':
          startDate.setMonth(startDate.getMonth() - 3)
          break
        case 'last_year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
        case 'ytd':
          startDate = new Date(endDate.getFullYear(), 0, 1)
          break
      }

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const data = await QuickBooksService.importReports(
        connectionId,
        reportType,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )

      clearInterval(progressInterval)
      setImportProgress(100)
      setImportStatus('success')
      
      // Update last sync
      const now = new Date().toISOString()
      setLastSync(now)
      await supabase
        .from('quickbooks_connections')
        .update({ last_sync: now })
        .eq('id', connectionId)

      toast({
        title: 'Success',
        description: 'Financial data imported successfully',
        variant: 'success',
      })

      if (onDataImported) {
        onDataImported(data)
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportStatus('error')
      toast({
        title: 'Import Failed',
        description: 'Failed to import data from QuickBooks',
        variant: 'destructive',
      })
    }
  }

  const handleDisconnect = async () => {
    if (!connectionId) return

    try {
      await QuickBooksService.disconnect(connectionId)
      setIsConnected(false)
      setConnectionId(null)
      setCompanyInfo(null)
      toast({
        title: 'Disconnected',
        description: 'QuickBooks has been disconnected',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect QuickBooks',
        variant: 'destructive',
      })
    }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <div className="h-8 w-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                <span className="text-white font-bold text-xs">QB</span>
              </div>
              QuickBooks Online Integration
            </CardTitle>
            <CardDescription>
              {isConnected && companyInfo ? (
                <span className="flex items-center gap-2">
                  <InfoCircledIcon className="h-3 w-3" />
                  Connected to: {companyInfo.CompanyName}
                </span>
              ) : (
                'Connect your QuickBooks Online account to import financial data'
              )}
            </CardDescription>
          </div>
          <Badge variant={isConnected ? "success" : "secondary"}>
            {isConnected ? (
              <>
                <CheckCircledIcon className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <CrossCircledIcon className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!isConnected ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <InfoCircledIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Before connecting:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>Ensure you have admin access to your QuickBooks Online account</li>
                      <li>Your financial data will be securely encrypted</li>
                      <li>You can disconnect at any time</li>
                    </ul>
                  </div>
                </div>
              </div>
              <Button onClick={handleConnect} className="w-full" size="lg">
                <Link2Icon className="h-4 w-4 mr-2" />
                Connect to QuickBooks Online
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {lastSync && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last synced:</span>
                  <span className="font-medium">{new Date(lastSync).toLocaleString()}</span>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Report Type
                  </label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profit_loss">Profit & Loss</SelectItem>
                      <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                      <SelectItem value="cash_flow">Cash Flow</SelectItem>
                      <SelectItem value="trial_balance">Trial Balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Date Range
                  </label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="last_quarter">Last Quarter</SelectItem>
                      <SelectItem value="last_year">Last Year</SelectItem>
                      <SelectItem value="ytd">Year to Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {importStatus === 'importing' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Importing data...</span>
                    <span className="text-sm text-gray-500">{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleImportData} 
                  disabled={importStatus === 'importing'}
                  className="flex-1"
                  variant={importStatus === 'success' ? 'success' : 'default'}
                >
                  {importStatus === 'importing' ? (
                    <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                  ) : importStatus === 'success' ? (
                    <CheckCircledIcon className="h-4 w-4 mr-2" />
                  ) : (
                    <DownloadIcon className="h-4 w-4 mr-2" />
                  )}
                  {importStatus === 'importing' ? 'Importing...' : 
                   importStatus === 'success' ? 'Import Complete' : 
                   'Import Financial Data'}
                </Button>
                
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  size="icon"
                  title="Disconnect QuickBooks"
                >
                  <ExclamationTriangleIcon className="h-4 w-4" />
                </Button>
              </div>
              
              {importStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-800">
                    <CrossCircledIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Import failed. Please try again.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}