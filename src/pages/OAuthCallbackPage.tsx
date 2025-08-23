import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '../lib/supabase'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2 } from 'lucide-react'

interface QBTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  realm_id: string
}

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, isLoaded } = useUser()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Wait for Clerk to load
        if (!isLoaded) {
          return
        }
        
        // Extract tokens from URL
        const qbTokensParam = searchParams.get('qb_tokens')
        const stateParam = searchParams.get('state')
        const errorParam = searchParams.get('error')
        
        // Handle OAuth errors
        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`)
        }

        if (!qbTokensParam) {
          throw new Error('No tokens received from QuickBooks')
        }

        if (!user) {
          // User not logged in - redirect to sign in with the full callback URL
          // The sign-in page will extract and process the tokens after authentication
          const returnUrl = encodeURIComponent(window.location.href)
          navigate(`/sign-in?redirect_url=${returnUrl}`)
          return
        }
        
        console.log('Processing OAuth callback for user:', user.id)

        // Decode the tokens
        let tokens: QBTokens
        try {
          tokens = JSON.parse(decodeURIComponent(qbTokensParam))
        } catch (e) {
          throw new Error('Invalid token format')
        }

        // Validate required fields
        if (!tokens.access_token || !tokens.refresh_token || !tokens.realm_id) {
          throw new Error('Missing required token fields')
        }

        // Calculate expiration time
        const expiresAt = new Date()
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in)

        // Store tokens in Supabase using RPC function
        console.log('Storing tokens for realm:', tokens.realm_id)
        const { data, error } = await supabase.rpc('store_qbo_tokens', {
          p_clerk_id: user.id,
          p_realm_id: tokens.realm_id,
          p_access_token: tokens.access_token,
          p_refresh_token: tokens.refresh_token,
          p_expires_in: tokens.expires_in,
          p_company_name: null // Will be fetched later
        })

        if (error) {
          console.error('Supabase error details:', error)
          console.error('Error code:', error.code)
          console.error('Error message:', error.message)
          console.error('Error details:', error.details)
          throw new Error(`Failed to store QuickBooks connection: ${error.message}`)
        }
        
        console.log('Successfully stored tokens, response:', data)

        // Fetch company info if needed (optional)
        try {
          const companyInfo = await fetchCompanyInfo(tokens.realm_id, tokens.access_token)
          if (companyInfo) {
            await supabase.rpc('update_company_info', {
              p_realm_id: tokens.realm_id,
              p_company_name: companyInfo.CompanyName,
              p_industry: companyInfo.IndustryType
            })
          }
        } catch (e) {
          console.warn('Could not fetch company info:', e)
        }

        setStatus('success')
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)

      } catch (error) {
        console.error('OAuth callback error:', error)
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
        setStatus('error')
      }
    }

    handleCallback()
  }, [searchParams, user, navigate, isLoaded])

  const fetchCompanyInfo = async (realmId: string, accessToken: string): Promise<any> => {
    // This will be implemented when QBO API integration is ready
    // For now, return null
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        {status === 'processing' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Connecting to QuickBooks</h2>
              <p className="text-gray-600 text-center">
                Please wait while we complete your QuickBooks connection...
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <Alert className="border-green-500 bg-green-50">
            <AlertDescription className="text-green-800">
              <div className="flex flex-col items-center space-y-2">
                <svg
                  className="h-8 w-8 text-green-600"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-semibold">Successfully Connected!</h3>
                <p className="text-sm">Redirecting to dashboard...</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {status === 'error' && (
          <Alert className="border-red-500 bg-red-50">
            <AlertDescription className="text-red-800">
              <div className="space-y-2">
                <h3 className="font-semibold">Connection Failed</h3>
                <p className="text-sm">{errorMessage}</p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-4 w-full bg-primary text-white rounded-md py-2 px-4 hover:bg-primary/90 transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}