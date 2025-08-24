import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { Header } from './layout/Header'
import { QuickBooksConnection } from './quickbooks/QuickBooksConnection'
import { ReportGenerationV2 } from './reports/ReportGenerationV2'
import { useQBOServices } from '../lib/supabase-clerk'
import { useQuickBooks } from '../hooks/useQuickBooks'
import { useToast } from '../hooks/use-toast'

// Main Dashboard Component
function Dashboard() {
  const { user } = useUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const [financialData, setFinancialData] = useState<any>(null)
  
  // Use the QBO services which include user sync
  const { syncUser } = useQBOServices()
  
  // Get QuickBooks connection status
  const { isConnected: isQBConnected } = useQuickBooks()

  // Single user sync on mount - prevents redundant calls
  useEffect(() => {
    if (user) {
      // Only sync once on initial mount
      syncUserData()
    }
  }, [user?.id]) // Only re-run if user ID changes (sign in/out)
  
  // Handle QBO connection status separately  
  useEffect(() => {
    // Check for connection status in URL params
    const connectionStatus = searchParams.get('qbo_connection')
    if (connectionStatus) {
      if (connectionStatus === 'success') {
        toast({
          title: 'QuickBooks Connected',
          description: 'Your QuickBooks account has been successfully connected.',
          variant: 'success',
        })
        // Sync user after successful QBO connection
        syncUserData()
      } else if (connectionStatus === 'failed') {
        toast({
          title: 'Connection Failed',
          description: 'Failed to connect your QuickBooks account. Please try again.',
          variant: 'destructive',
        })
      }
      // Remove the parameter from URL after showing the toast
      searchParams.delete('qbo_connection')
      setSearchParams(searchParams)
    }
  }, [searchParams, setSearchParams, toast])

  const syncUserData = async () => {
    if (!user) return

    try {
      // Sync user with Supabase using the RPC function
      const result = await syncUser()
      console.log('User synced:', result)
    } catch (error) {
      console.error('Failed to sync user:', error)
    }
  }

  const handleReportGenerated = (data: any) => {
    setFinancialData(data)
  }

  return (
    <div className="min-h-screen bg-gradient-bg">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-2">
            Financial Analysis Dashboard
          </h1>
          <p className="text-gray-600">
            Connect to QuickBooks (optional) to enable AI-powered financial report generation
          </p>
        </div>

        <div className="space-y-8">
          {/* QuickBooks Connection (Optional) */}
          <QuickBooksConnection />
          
          {/* Import Data & Generate Report - Only visible after QBO connection */}
          {isQBConnected && (
            <ReportGenerationV2 
              companyId={user?.id}
              onReportGenerated={handleReportGenerated}
            />
          )}
        </div>
      </main>
    </div>
  )
}

// Callback page for OAuth
function CallbackPage() {
  const { user } = useUser()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const { handleOAuthCallback } = useQuickBooks()

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const realmId = params.get('realmId')
    const state = params.get('state')
    const error = params.get('error')

    if (error) {
      setStatus('error')
      return
    }

    if (code && realmId && state && user) {
      try {
        // Use the handleOAuthCallback from useQuickBooks hook
        // which properly uses the RPC functions
        const result = await handleOAuthCallback(code, realmId, state)
        
        if (result.success) {
          setStatus('success')
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 2000)
        } else {
          setStatus('error')
        }
      } catch (error) {
        console.error('Callback error:', error)
        setStatus('error')
      }
    } else {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-lg">Connecting to QuickBooks...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-lg">Successfully connected! Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-600 text-5xl mb-4">✗</div>
            <p className="text-lg">Connection failed. Please try again.</p>
            <a href="/dashboard" className="text-primary-600 underline mt-4 inline-block">
              Return to Dashboard
            </a>
          </>
        )}
      </div>
    </div>
  )
}

// Authenticated App Component (ClerkProvider is now at App level)
function AuthenticatedApp() {
  const { isLoaded, isSignedIn } = useUser()

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/callback" element={<CallbackPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default AuthenticatedApp