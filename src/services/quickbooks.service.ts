/**
 * QuickBooks Online API Service
 * 
 * Handles all QBO API interactions with automatic token refresh,
 * retry logic, and error handling for a stateless architecture
 * where n8n manages the OAuth flow.
 */

import { QBOToken, QBOTokenService, QBOError } from '../lib/supabase-clerk'

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface QBOApiConfig {
  baseUrl: string
  sandboxUrl: string
  isSandbox: boolean
  apiVersion: string
  minorVersion: string
}

export interface QBOApiRequest {
  endpoint: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  queryParams?: Record<string, string>
  headers?: Record<string, string>
}

export interface QBOApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    detail?: any
  }
  headers?: Headers
}

export interface TokenRefreshRequest {
  realmId: string
  refreshToken: string
}

export interface TokenRefreshResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in?: number
}

export interface QBOCompanyInfo {
  CompanyName: string
  LegalName?: string
  CompanyAddr?: any
  CustomerCommunicationAddr?: any
  LegalAddr?: any
  PrimaryPhone?: any
  CompanyStartDate?: string
  FiscalYearStartMonth?: string
  Country?: string
  Email?: any
  WebAddr?: any
  SupportedLanguages?: string
  NameValue?: any[]
  domain?: string
  sparse?: boolean
  Id?: string
  SyncToken?: string
  MetaData?: {
    CreateTime?: string
    LastUpdatedTime?: string
  }
}

// =====================================================
// TOKEN MANAGER
// =====================================================

export class QBOTokenManager {
  private tokenCache: Map<string, QBOToken> = new Map()
  private refreshPromises: Map<string, Promise<QBOToken>> = new Map()
  
  constructor(
    private tokenService: QBOTokenService,
    private userId: string,
    private n8nWebhookUrl?: string // Optional n8n webhook for token refresh
  ) {}

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidToken(realmId: string): Promise<string> {
    // Check cache first
    const cached = this.tokenCache.get(realmId)
    if (cached && !this.isExpiringSoon(cached)) {
      return cached.access_token
    }

    // Check if refresh is already in progress
    const existingRefresh = this.refreshPromises.get(realmId)
    if (existingRefresh) {
      const refreshed = await existingRefresh
      return refreshed.access_token
    }

    // Get token from database
    const token = await this.tokenService.getToken(this.userId, realmId) as QBOToken
    if (!token) {
      throw new QBOError('No token found for realm', 'TOKEN_NOT_FOUND', { realmId })
    }

    // Check if token needs refresh
    if (this.isExpiringSoon(token)) {
      const refreshPromise = this.refreshToken(token)
      this.refreshPromises.set(realmId, refreshPromise)
      
      try {
        const refreshed = await refreshPromise
        this.tokenCache.set(realmId, refreshed)
        return refreshed.access_token
      } finally {
        this.refreshPromises.delete(realmId)
      }
    }

    // Token is valid, cache and return
    this.tokenCache.set(realmId, token)
    return token.access_token
  }

  /**
   * Check if token is expiring soon (within 5 minutes)
   */
  private isExpiringSoon(token: QBOToken): boolean {
    const expiresAt = new Date(token.expires_at).getTime()
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    return expiresAt - now <= fiveMinutes
  }

  /**
   * Refresh token using n8n webhook or direct API
   */
  private async refreshToken(token: QBOToken): Promise<QBOToken> {
    console.log('Refreshing QBO token for realm:', token.realm_id)

    if (this.n8nWebhookUrl) {
      // Use n8n webhook for token refresh
      return this.refreshViaWebhook(token)
    } else {
      // Direct refresh (requires backend implementation)
      return this.refreshDirectly(token)
    }
  }

  /**
   * Refresh token via n8n webhook
   */
  private async refreshViaWebhook(token: QBOToken): Promise<QBOToken> {
    if (!this.n8nWebhookUrl) {
      throw new QBOError('n8n webhook URL not configured', 'WEBHOOK_NOT_CONFIGURED')
    }

    const response = await fetch(this.n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'refresh_token',
        realm_id: token.realm_id,
        refresh_token: token.refresh_token,
        user_id: this.userId
      })
    })

    if (!response.ok) {
      throw new QBOError(
        'Failed to refresh token via webhook',
        'WEBHOOK_REFRESH_FAILED',
        { status: response.status }
      )
    }

    const refreshData: TokenRefreshResponse = await response.json()

    // Store refreshed token in Supabase
    const success = await this.tokenService.refreshToken(
      this.userId,
      token.realm_id,
      refreshData.access_token,
      refreshData.refresh_token,
      refreshData.expires_in
    )

    if (!success) {
      throw new QBOError('Failed to store refreshed token', 'STORE_TOKEN_FAILED')
    }

    // Return updated token object
    return {
      ...token,
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token,
      expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
      expires_in: refreshData.expires_in,
      updated_at: new Date().toISOString()
    }
  }

  /**
   * Direct token refresh (requires backend with client secret)
   */
  private async refreshDirectly(token: QBOToken): Promise<QBOToken> {
    // This would typically be handled by your backend
    // since it requires the client secret
    throw new QBOError(
      'Direct token refresh not implemented. Use n8n webhook or implement backend endpoint.',
      'NOT_IMPLEMENTED'
    )
  }

  /**
   * Revoke token via n8n webhook
   */
  async revokeToken(realmId: string): Promise<void> {
    // Clear from cache
    this.tokenCache.delete(realmId)
    
    // Revoke in database
    await this.tokenService.revokeToken(this.userId, realmId)

    // Optionally notify n8n to revoke with QBO
    if (this.n8nWebhookUrl) {
      try {
        await fetch(this.n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'revoke_token',
            realm_id: realmId,
            user_id: this.userId
          })
        })
      } catch (error) {
        console.error('Failed to revoke token via webhook:', error)
      }
    }
  }

  /**
   * Clear token cache
   */
  clearCache(realmId?: string): void {
    if (realmId) {
      this.tokenCache.delete(realmId)
    } else {
      this.tokenCache.clear()
    }
  }
}

// =====================================================
// QBO API CLIENT
// =====================================================

export class QBOApiClient {
  private config: QBOApiConfig
  private tokenManager: QBOTokenManager
  private requestQueue: Map<string, Promise<any>> = new Map()

  constructor(
    tokenManager: QBOTokenManager,
    config?: Partial<QBOApiConfig>
  ) {
    this.tokenManager = tokenManager
    this.config = {
      baseUrl: 'https://quickbooks.api.intuit.com',
      sandboxUrl: 'https://sandbox-quickbooks.api.intuit.com',
      isSandbox: config?.isSandbox ?? false,
      apiVersion: config?.apiVersion ?? 'v3',
      minorVersion: config?.minorVersion ?? '65',
      ...config
    }
  }

  /**
   * Get base URL for API calls
   */
  private getBaseUrl(): string {
    return this.config.isSandbox ? this.config.sandboxUrl : this.config.baseUrl
  }

  /**
   * Build full API URL
   */
  private buildUrl(realmId: string, endpoint: string, queryParams?: Record<string, string>): string {
    const baseUrl = this.getBaseUrl()
    let url = `${baseUrl}/${this.config.apiVersion}/company/${realmId}/${endpoint}`
    
    // Add minor version
    const params = new URLSearchParams({
      minorversion: this.config.minorVersion,
      ...queryParams
    })
    
    const queryString = params.toString()
    if (queryString) {
      url += `?${queryString}`
    }
    
    return url
  }

  /**
   * Make authenticated API request with retry logic
   */
  async request<T = any>(
    realmId: string,
    request: QBOApiRequest
  ): Promise<QBOApiResponse<T>> {
    const maxRetries = 3
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get valid token
        const accessToken = await this.tokenManager.getValidToken(realmId)

        // Build request
        const url = this.buildUrl(realmId, request.endpoint, request.queryParams)
        const headers: HeadersInit = {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...request.headers
        }

        // Make request
        const response = await fetch(url, {
          method: request.method || 'GET',
          headers,
          body: request.body ? JSON.stringify(request.body) : undefined
        })

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          console.log(`Rate limited. Retrying after ${delay}ms...`)
          await this.delay(delay)
          continue
        }

        // Handle unauthorized (token might be invalid)
        if (response.status === 401 && attempt < maxRetries) {
          console.log('Token invalid, clearing cache and retrying...')
          this.tokenManager.clearCache(realmId)
          continue
        }

        // Parse response
        const contentType = response.headers.get('content-type')
        let data: any

        if (contentType?.includes('application/json')) {
          data = await response.json()
        } else if (contentType?.includes('application/pdf')) {
          data = await response.blob()
        } else {
          data = await response.text()
        }

        // Handle API errors
        if (!response.ok) {
          const error = data?.Fault?.Error?.[0] || data?.Fault || data
          return {
            success: false,
            error: {
              code: error?.code || response.status.toString(),
              message: error?.Message || error?.message || response.statusText,
              detail: error?.Detail || error
            },
            headers: response.headers
          }
        }

        return {
          success: true,
          data,
          headers: response.headers
        }

      } catch (error) {
        lastError = error
        console.error(`API request failed (attempt ${attempt}/${maxRetries}):`, error)
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await this.delay(delay)
        }
      }
    }

    return {
      success: false,
      error: {
        code: 'REQUEST_FAILED',
        message: lastError?.message || 'Request failed after retries',
        detail: lastError
      }
    }
  }

  /**
   * Helper method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // =====================================================
  // COMMON QBO API OPERATIONS
  // =====================================================

  /**
   * Get company info
   */
  async getCompanyInfo(realmId: string): Promise<QBOApiResponse<QBOCompanyInfo>> {
    return this.request<{ CompanyInfo: QBOCompanyInfo }>(realmId, {
      endpoint: 'companyinfo/1'
    }).then(response => ({
      ...response,
      data: response.data?.CompanyInfo
    }))
  }

  /**
   * Query entities using QBO query language
   */
  async query<T = any>(
    realmId: string,
    query: string
  ): Promise<QBOApiResponse<T>> {
    return this.request<{ QueryResponse: T }>(realmId, {
      endpoint: 'query',
      queryParams: { query }
    }).then(response => ({
      ...response,
      data: response.data?.QueryResponse
    }))
  }

  /**
   * Get entity by ID
   */
  async getById<T = any>(
    realmId: string,
    entityType: string,
    id: string
  ): Promise<QBOApiResponse<T>> {
    return this.request<T>(realmId, {
      endpoint: `${entityType.toLowerCase()}/${id}`
    })
  }

  /**
   * Create entity
   */
  async create<T = any>(
    realmId: string,
    entityType: string,
    data: any
  ): Promise<QBOApiResponse<T>> {
    return this.request<T>(realmId, {
      endpoint: entityType.toLowerCase(),
      method: 'POST',
      body: data
    })
  }

  /**
   * Update entity
   */
  async update<T = any>(
    realmId: string,
    entityType: string,
    data: any
  ): Promise<QBOApiResponse<T>> {
    return this.request<T>(realmId, {
      endpoint: entityType.toLowerCase(),
      method: 'POST',
      body: data
    })
  }

  /**
   * Delete entity (sparse update)
   */
  async delete(
    realmId: string,
    entityType: string,
    id: string,
    syncToken: string
  ): Promise<QBOApiResponse<any>> {
    return this.request(realmId, {
      endpoint: `${entityType.toLowerCase()}?operation=delete`,
      method: 'POST',
      body: {
        Id: id,
        SyncToken: syncToken
      }
    })
  }

  /**
   * Batch operations
   */
  async batch(
    realmId: string,
    operations: Array<{
      bId: string
      operation: 'create' | 'update' | 'query' | 'delete'
      entity?: string
      data?: any
      query?: string
    }>
  ): Promise<QBOApiResponse<any>> {
    const batchRequest = {
      BatchItemRequest: operations.map(op => {
        const item: any = { bId: op.bId }
        
        if (op.operation === 'query') {
          item.Query = op.query
        } else {
          item[op.entity!] = op.data
          if (op.operation === 'delete') {
            item.operation = 'delete'
          }
        }
        
        return item
      })
    }

    return this.request(realmId, {
      endpoint: 'batch',
      method: 'POST',
      body: batchRequest
    })
  }

  /**
   * Get report
   */
  async getReport(
    realmId: string,
    reportType: string,
    params?: Record<string, string>
  ): Promise<QBOApiResponse<any>> {
    return this.request(realmId, {
      endpoint: `reports/${reportType}`,
      queryParams: params
    })
  }

  /**
   * Download PDF
   */
  async downloadPdf(
    realmId: string,
    entityType: string,
    id: string
  ): Promise<QBOApiResponse<Blob>> {
    return this.request<Blob>(realmId, {
      endpoint: `${entityType.toLowerCase()}/${id}/pdf`,
      headers: {
        'Accept': 'application/pdf'
      }
    })
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

export function createQBOApiClient(
  tokenService: QBOTokenService,
  userId: string,
  config?: {
    n8nWebhookUrl?: string
    isSandbox?: boolean
    apiVersion?: string
    minorVersion?: string
  }
): QBOApiClient {
  const tokenManager = new QBOTokenManager(
    tokenService,
    userId,
    config?.n8nWebhookUrl
  )

  return new QBOApiClient(tokenManager, {
    isSandbox: config?.isSandbox,
    apiVersion: config?.apiVersion,
    minorVersion: config?.minorVersion
  })
}

// =====================================================
// REACT HOOK
// =====================================================

import { useMemo } from 'react'
import { useQBOServices } from '../lib/supabase-clerk'

export function useQBOApiClient(config?: {
  n8nWebhookUrl?: string
  isSandbox?: boolean
}) {
  const { services, userId, isSignedIn } = useQBOServices()

  const client = useMemo(() => {
    if (!services || !userId || !isSignedIn) {
      return null
    }

    return createQBOApiClient(services.tokens, userId, {
      n8nWebhookUrl: config?.n8nWebhookUrl || import.meta.env.VITE_N8N_WEBHOOK_URL,
      isSandbox: config?.isSandbox ?? import.meta.env.VITE_QBO_SANDBOX === 'true'
    })
  }, [services, userId, isSignedIn, config?.n8nWebhookUrl, config?.isSandbox])

  return client
}