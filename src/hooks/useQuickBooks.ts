import { useState, useEffect, useCallback } from 'react'
import { useQBOServices, QBOToken } from '../lib/supabase-clerk'
import { useQBOApiClient } from '../services/quickbooks.service'

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
  
  // Initialize QBO API client
  const qboClient = useQBOApiClient()

  // Check for existing token on mount with debounce
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    
    // Add small delay to batch multiple rapid mounts
    const timeoutId = setTimeout(async () => {
      try {
        // NOTE: syncUser is handled by AuthenticatedApp component
        // Get tokens directly without syncing to avoid redundant calls
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
    }, 100) // 100ms debounce
    
    return () => clearTimeout(timeoutId)
  }, [isLoaded, isSignedIn, getToken])

  const connectQuickBooks = useCallback(async () => {
    try {
      if (!isSignedIn) {
        throw new Error('User must be signed in to connect QuickBooks')
      }
      
      // Sync user first
      await syncUser()
      
      // Since n8n handles OAuth, we need the client ID to initiate the flow
      const clientId = import.meta.env.VITE_QBO_CLIENT_ID
      const redirectUri = import.meta.env.VITE_QBO_REDIRECT_URI // This points to n8n webhook
      const scope = import.meta.env.VITE_QBO_SCOPE || 'com.intuit.quickbooks.accounting'
      const state = crypto.randomUUID()
      
      if (!clientId) {
        throw new Error('QuickBooks Client ID not configured. Please add VITE_QBO_CLIENT_ID to your .env file')
      }
      
      if (!redirectUri) {
        throw new Error('QuickBooks redirect URI not configured. Please add VITE_QBO_REDIRECT_URI to your .env file')
      }
      
      // Store state in session storage for verification
      sessionStorage.setItem('qbo_oauth_state', state)
      
      // Build OAuth URL that redirects to n8n
      const authBaseUrl = import.meta.env.VITE_QBO_AUTH_BASE_URL || 'https://appcenter.intuit.com/connect/oauth2'
      const authUrl = new URL(authBaseUrl)
      authUrl.searchParams.append('client_id', clientId)
      authUrl.searchParams.append('scope', scope)
      authUrl.searchParams.append('redirect_uri', redirectUri)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('state', state)
      
      // Redirect to QuickBooks OAuth (which will then redirect to n8n)
      window.location.href = authUrl.toString()
    } catch (error) {
      console.error('Failed to connect to QuickBooks:', error)
      throw error
    }
  }, [isSignedIn, syncUser])

  const handleOAuthCallback = useCallback(async (tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
    realm_id: string
    company_name?: string
  }, state?: string) => {
    try {
      // Verify state if provided
      if (state) {
        const savedState = sessionStorage.getItem('qbo_oauth_state')
        if (state !== savedState) {
          throw new Error('Invalid OAuth state')
        }
      }
      
      // Store tokens in Supabase
      const result = await storeToken({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        realm_id: tokens.realm_id,
        company_name: tokens.company_name
      })
      
      if (result.success) {
        setIsConnected(true)
        setRealmId(tokens.realm_id)
        setLastSync(new Date().toISOString())
        
        // Update current token state
        const newToken: QBOToken = {
          id: crypto.randomUUID(),
          realm_id: tokens.realm_id,
          user_clerk_id: '',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          expires_in: tokens.expires_in,
          company_name: tokens.company_name,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setCurrentToken(newToken)
        
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
      if (!currentToken || !realmId || !qboClient) {
        throw new Error('No active QuickBooks connection')
      }
      
      setImportStatus('importing')
      setImportProgress(0)

      // Use the QBO API client to fetch data
      // The token refresh is handled automatically by the client
      const companyResponse = await qboClient.getCompanyInfo(realmId)
      
      if (!companyResponse.success) {
        throw new Error(companyResponse.error?.message || 'Failed to fetch company info')
      }

      setImportProgress(20)

      // Example: Fetch accounts
      const accountsResponse = await qboClient.query(realmId, 
        "SELECT * FROM Account WHERE Active = true MAXRESULTS 100"
      )
      
      setImportProgress(40)

      // Example: Fetch recent transactions
      const transactionsResponse = await qboClient.query(realmId,
        "SELECT * FROM Purchase WHERE TxnDate > '2024-01-01' MAXRESULTS 100"
      )

      setImportProgress(60)

      // Example: Fetch customers
      const customersResponse = await qboClient.query(realmId,
        "SELECT * FROM Customer WHERE Active = true MAXRESULTS 100"
      )

      setImportProgress(80)

      // Example: Fetch vendors
      const vendorsResponse = await qboClient.query(realmId,
        "SELECT * FROM Vendor WHERE Active = true MAXRESULTS 100"
      )

      setImportProgress(100)
      setImportStatus('success')
      setLastSync(new Date().toISOString())

      // Return imported data summary
      return {
        company: companyResponse.data,
        accounts: accountsResponse.data,
        transactions: transactionsResponse.data,
        customers: customersResponse.data,
        vendors: vendorsResponse.data
      }
      
    } catch (error) {
      setImportStatus('error')
      console.error('Failed to import data:', error)
      throw error
    }
  }, [currentToken, realmId, qboClient])

  const disconnect = useCallback(async () => {
    try {
      if (!realmId) return
      
      const count = await revokeToken(realmId)
      console.log(`Revoked ${count} token(s)`)
      
      // Immediately update state
      setIsConnected(false)
      setCurrentToken(null)
      setRealmId(undefined)
      setLastSync(undefined)
      
      // Force a re-check of connection status
      // This ensures the UI updates even if there's any caching
      setTimeout(async () => {
        const tokens = await getToken()
        if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
          setIsConnected(false)
          setCurrentToken(null)
        }
      }, 100)
    } catch (error) {
      console.error('Failed to disconnect QuickBooks:', error)
      throw error
    }
  }, [realmId, revokeToken, getToken])

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