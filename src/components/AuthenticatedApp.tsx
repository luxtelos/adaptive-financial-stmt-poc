import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ClerkProvider, useUser } from '@clerk/clerk-react'
import { Header } from './layout/Header'
import { AuthWrapper } from './auth/AuthWrapper'
import { DashboardStats } from './dashboard/DashboardStats'
import { QuickBooksConnection } from './quickbooks/QuickBooksConnection'
import { ReportGeneration } from './reports/ReportGeneration'
import { FinancialChart } from './charts/FinancialChart'
import { useFinancialData } from '../hooks/useFinancialData'
import { getSupabase, Company } from '../lib/supabase'
import { clerkConfig } from '../config/clerk'

// Main Dashboard Component
function Dashboard() {
  const { user } = useUser()
  const [company, setCompany] = useState<Company | null>(null)
  const [financialData, setFinancialData] = useState<any>(null)
  const { data: chartData, loading: dataLoading } = useFinancialData(company?.id)
  const supabase = getSupabase()

  useEffect(() => {
    if (user && supabase) {
      loadOrCreateCompany()
    }
  }, [user])

  const loadOrCreateCompany = async () => {
    if (!user || !supabase) return

    // Check if user exists in Supabase
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', user.id)
      .single()

    if (!existingUser) {
      // Create user in Supabase
      await supabase.from('users').insert({
        clerk_id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        company_name: user.firstName || 'My Company',
      })
    }

    // Get or create company
    const { data: companies } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (companies) {
      setCompany(companies)
    } else {
      // Create default company
      const { data: newCompany } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          name: user.firstName || 'My Company',
          industry: 'General',
          quickbooks_connected: false,
        })
        .select()
        .single()
      
      if (newCompany) {
        setCompany(newCompany)
      }
    }
  }

  const handleReportGenerated = (data: any) => {
    setFinancialData(data)
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gradient-bg">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gradient mb-2">
              Financial Health Dashboard
            </h1>
            <p className="text-gray-600">
              AI-powered analysis of your QuickBooks data
            </p>
          </div>

          <DashboardStats />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <QuickBooksConnection companyId={company?.id} />
            <ReportGeneration 
              companyId={company?.id}
              onReportGenerated={handleReportGenerated}
            />
          </div>

          {chartData && (
            <div className="mt-8">
              <FinancialChart data={chartData} loading={dataLoading} />
            </div>
          )}
        </main>
      </div>
    </AuthWrapper>
  )
}

// Callback page for OAuth
function CallbackPage() {
  const { user } = useUser()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const supabase = getSupabase()

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

    const savedState = localStorage.getItem('qbo_auth_state')
    if (state !== savedState) {
      setStatus('error')
      return
    }

    if (code && realmId && user && supabase) {
      try {
        // Exchange code for tokens
        const { QuickBooksService } = await import('../services/quickbooks.service')
        const tokens = await QuickBooksService.exchangeCodeForTokens(code, realmId)
        
        // Get company
        const { data: companies } = await supabase
          .from('companies')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (companies) {
          // Save connection
          await QuickBooksService.saveConnection(
            user.id,
            companies.id,
            tokens,
            realmId
          )
          
          setStatus('success')
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 2000)
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

// Authenticated App Component with Clerk Provider
function AuthenticatedApp() {
  const clerkPubKey = clerkConfig.publishableKey

  // This component only loads when user clicks "Get Started" and config exists
  if (!clerkPubKey || clerkPubKey === 'pk_test_your_clerk_publishable_key') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h2>
          <p>Clerk is not properly configured.</p>
          <a href="/" className="text-primary-600 underline mt-4 inline-block">
            Return to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey} appearance={clerkConfig.appearance}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="/sign-in" element={<Dashboard />} />
        <Route path="/sign-up" element={<Dashboard />} />
      </Routes>
    </ClerkProvider>
  )
}

export default AuthenticatedApp