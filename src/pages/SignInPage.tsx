import React, { useEffect, useState } from 'react'
import { SignIn, useUser } from '@clerk/clerk-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

interface QBTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  realm_id: string
}

export function SignInPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isSignedIn, user, isLoaded } = useUser()
  const [isProcessingTokens, setIsProcessingTokens] = useState(false)
  const redirectUrl = searchParams.get('redirect_url')
  
  // Extract QBO tokens from redirect URL if present
  const extractTokensFromRedirectUrl = (url: string | null): QBTokens | null => {
    if (!url) return null
    
    try {
      const decodedUrl = decodeURIComponent(url)
      const urlObj = new URL(decodedUrl, window.location.origin)
      const qbTokensParam = urlObj.searchParams.get('qb_tokens')
      
      if (qbTokensParam) {
        return JSON.parse(decodeURIComponent(qbTokensParam))
      }
    } catch (e) {
      console.error('Failed to extract tokens:', e)
    }
    return null
  }
  
  // Process QBO tokens after successful sign-in
  useEffect(() => {
    const processTokens = async () => {
      if (!isLoaded || !isSignedIn || !user || isProcessingTokens) return
      
      const tokens = extractTokensFromRedirectUrl(redirectUrl)
      if (!tokens) {
        // No tokens to process, just go to dashboard
        if (isSignedIn) {
          navigate('/dashboard')
        }
        return
      }
      
      setIsProcessingTokens(true)
      
      try {
        console.log('Processing QBO tokens after sign-in for user:', user.id)
        
        // Store tokens in Supabase
        const { data, error } = await supabase.rpc('store_qbo_tokens', {
          p_clerk_id: user.id,
          p_realm_id: tokens.realm_id,
          p_access_token: tokens.access_token,
          p_refresh_token: tokens.refresh_token,
          p_expires_in: tokens.expires_in,
          p_company_name: null
        })
        
        if (error) {
          console.error('Failed to store tokens:', error)
          // Still navigate to dashboard but with error state
          navigate('/dashboard?qbo_connection=failed')
        } else {
          console.log('Successfully stored QBO tokens')
          // Navigate to dashboard with success state
          navigate('/dashboard?qbo_connection=success')
        }
      } catch (error) {
        console.error('Error processing tokens:', error)
        navigate('/dashboard?qbo_connection=failed')
      } finally {
        setIsProcessingTokens(false)
      }
    }
    
    processTokens()
  }, [isLoaded, isSignedIn, user, redirectUrl, navigate, isProcessingTokens])
  
  // Determine the afterSignIn URL - if we have tokens, we'll handle them in useEffect
  const afterSignInUrl = '/dashboard'
  
  // Show loading state while processing tokens
  if (isProcessingTokens) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Connecting to QuickBooks</h2>
            <p className="text-gray-600 text-center">
              Setting up your QuickBooks connection...
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="glass-morphism border-0">
          <CardHeader className="text-center pb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-primary-600 to-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-white font-bold text-2xl">QA</span>
            </div>
            <CardTitle className="text-3xl font-bold text-gradient">
              QuickBooks Analyzer
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Professional financial analysis powered by AI for CPAs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignIn 
              appearance={{
                elements: {
                  formButtonPrimary: 'bg-primary-600 hover:bg-primary-700',
                  footerActionLink: 'text-primary-600 hover:text-primary-700',
                  card: 'shadow-none bg-transparent',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton: 'bg-white hover:bg-gray-50 border border-gray-300',
                  formFieldInput: 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
                },
              }}
              fallbackRedirectUrl={afterSignInUrl}
              forceRedirectUrl={afterSignInUrl}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}