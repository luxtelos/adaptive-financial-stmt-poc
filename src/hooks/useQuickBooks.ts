import { useState, useEffect, useCallback } from 'react'
import { useQBOServices, QBOToken } from '../lib/supabase-clerk'

export function useQuickBooks() {
  const [isConnected, setIsConnected] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [importProgress, setImportProgress] = useState(0)
  const [lastSync, setLastSync] = useState<string>()
  const [currentToken, setCurrentToken] = useState<QBOToken | null>(null)
  const [realmId, setRealmId] = useState<string>()
  
  const { 
    isLoaded, 
    isSignedIn, 
    syncUser, 
    storeToken, 
    getToken, 
    refreshToken, 
    revokeToken 
  } = useQBOServices()

  // Check for existing token on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!isLoaded || !isSignedIn) return
      
      try {
        // Sync user first
        await syncUser()
        
        // Get tokens
        const tokens = await getToken()
        if (tokens) {
          const tokenArray = Array.isArray(tokens) ? tokens : [tokens]
          const activeToken = tokenArray.find(t => t.is_active)
          
          if (activeToken) {
            setCurrentToken(activeToken)
            setIsConnected(true)
            setRealmId(activeToken.realm_id)
            setLastSync(activeToken.updated_at)
          }
        }
      } catch (error) {
        console.error('Failed to check QuickBooks connection:', error)
      }
    }
    
    checkConnection()
  }, [isLoaded, isSignedIn, syncUser, getToken])

  const connectQuickBooks = useCallback(async () => {
    try {
      if (!isSignedIn) {
        throw new Error('User must be signed in to connect QuickBooks')
      }
      
      // Sync user first
      await syncUser()
      
      // Initiate OAuth flow
      const clientId = import.meta.env.VITE_QUICKBOOKS_CLIENT_ID
      const redirectUri = `${window.location.origin}/quickbooks/callback`
      const scope = 'com.intuit.quickbooks.accounting'
      const state = crypto.randomUUID()
      
      // Store state in session storage for verification
      sessionStorage.setItem('qbo_oauth_state', state)
      
      // Build OAuth URL
      const authBaseUrl = import.meta.env.VITE_QBO_AUTH_BASE_URL
      if (!authBaseUrl) {
        throw new Error('QuickBooks OAuth URL not configured')
      }
      const authUrl = new URL(authBaseUrl)
      authUrl.searchParams.append('client_id', clientId)
      authUrl.searchParams.append('scope', scope)
      authUrl.searchParams.append('redirect_uri', redirectUri)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('state', state)
      
      // Redirect to QuickBooks OAuth
      window.location.href = authUrl.toString()
    } catch (error) {
      console.error('Failed to connect to QuickBooks:', error)
      throw error
    }
  }, [isSignedIn, syncUser])

  const handleOAuthCallback = useCallback(async (code: string, realmId: string, state: string) => {
    try {
      // Verify state
      const savedState = sessionStorage.getItem('qbo_oauth_state')
      if (state !== savedState) {
        throw new Error('Invalid OAuth state')
      }
      
      // Exchange code for tokens (this would be done server-side in production)
      // For now, mock the token exchange
      const mockTokens = {
        access_token: `mock_access_${code}`,
        refresh_token: `mock_refresh_${code}`,
        expires_in: 3600,
        realm_id: realmId,
        company_name: 'Mock Company'
      }
      
      // Store tokens in Supabase
      const result = await storeToken(mockTokens)
      
      if (result.success) {
        setIsConnected(true)
        setRealmId(realmId)
        setLastSync(new Date().toISOString())
        
        if (result.admin_changed) {
          console.log('Admin changed from:', result.previous_admin)
        }
      }
      
      // Clean up state
      sessionStorage.removeItem('qbo_oauth_state')
      
      return result
    } catch (error) {
      console.error('Failed to handle OAuth callback:', error)
      throw error
    }
  }, [storeToken])

  const importData = useCallback(async () => {
    try {
      if (!currentToken || !realmId) {
        throw new Error('No active QuickBooks connection')
      }
      
      setImportStatus('importing')
      setImportProgress(0)

      // Check if token needs refresh
      const expiresAt = new Date(currentToken.expires_at)
      const now = new Date()
      const needsRefresh = expiresAt <= now

      if (needsRefresh) {
        console.log('Token expired, refreshing...')
        // In production, this would call your backend to refresh
        const success = await refreshToken(
          realmId,
          `refreshed_${currentToken.access_token}`,
          currentToken.refresh_token,
          3600
        )
        
        if (!success) {
          throw new Error('Failed to refresh token')
        }
      }

      // Simulate data import progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval)
            setImportStatus('success')
            setLastSync(new Date().toISOString())
            return 100
          }
          return prev + 10
        })
      }, 500)

      // In production, this would call your backend to import data
      console.log('Importing QuickBooks data...', {
        realmId,
        tokenActive: currentToken.is_active
      })
      
    } catch (error) {
      setImportStatus('error')
      console.error('Failed to import data:', error)
      throw error
    }
  }, [currentToken, realmId, refreshToken])

  const disconnect = useCallback(async () => {
    try {
      if (!realmId) return
      
      const count = await revokeToken(realmId)
      console.log(`Revoked ${count} token(s)`)
      
      setIsConnected(false)
      setCurrentToken(null)
      setRealmId(undefined)
      setLastSync(undefined)
    } catch (error) {
      console.error('Failed to disconnect QuickBooks:', error)
      throw error
    }
  }, [realmId, revokeToken])

  return {
    isConnected,
    importStatus,
    importProgress,
    lastSync,
    realmId,
    currentToken,
    connectQuickBooks,
    handleOAuthCallback,
    importData,
    disconnect
  }
}