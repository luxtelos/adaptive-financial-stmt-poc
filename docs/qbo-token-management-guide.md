# QuickBooks Online OAuth Token Management Guide

## Overview

This guide provides comprehensive implementation details for handling QuickBooks Online OAuth tokens in a stateless architecture where n8n manages the OAuth flow and the frontend stores tokens in Supabase.

## Architecture Components

### 1. Frontend (React + Vite)
- Initiates OAuth flow
- Handles OAuth callback
- Stores tokens in Supabase
- Makes QBO API calls with automatic token refresh

### 2. n8n (OAuth Handler)
- Manages OAuth authorization flow
- Exchanges authorization codes for tokens
- Handles token refresh requests
- Stores client secret securely

### 3. Supabase (Token Storage)
- Stores encrypted tokens
- Enforces Row Level Security (RLS)
- Tracks token ownership and admin changes
- Provides audit logging

## Implementation Flow

### Step 1: OAuth Initiation

```typescript
// Frontend: User clicks "Connect QuickBooks"
const connectQuickBooks = async () => {
  // Sync user with Supabase first
  await syncUser()
  
  // Generate state for CSRF protection
  const state = crypto.randomUUID()
  sessionStorage.setItem('qbo_oauth_state', state)
  
  // Redirect to n8n OAuth handler
  const n8nOAuthUrl = import.meta.env.VITE_N8N_OAUTH_URL
  const callbackUrl = `${window.location.origin}/oauth-callback`
  
  const url = new URL(n8nOAuthUrl)
  url.searchParams.append('callback_url', callbackUrl)
  url.searchParams.append('state', state)
  
  window.location.href = url.toString()
}
```

### Step 2: n8n OAuth Flow

n8n handles the OAuth flow with QuickBooks:

1. Receives OAuth initiation request
2. Redirects to QuickBooks authorization
3. Handles QuickBooks callback
4. Exchanges code for tokens
5. Redirects back to frontend with tokens

### Step 3: Frontend OAuth Callback

```typescript
// Frontend: Handle OAuth callback at /oauth-callback
const handleOAuthCallback = async () => {
  // Extract tokens from URL
  const searchParams = new URLSearchParams(window.location.search)
  const encodedTokens = searchParams.get('qb_tokens')
  const state = searchParams.get('state')
  
  // Verify state (CSRF protection)
  const savedState = sessionStorage.getItem('qbo_oauth_state')
  if (state !== savedState) {
    throw new Error('Invalid OAuth state')
  }
  
  // Decode tokens
  const tokenData = JSON.parse(decodeURIComponent(encodedTokens))
  
  // Store in Supabase
  const result = await storeToken({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    realm_id: tokenData.realm_id,
    company_name: tokenData.company_name
  })
  
  // Clean up
  sessionStorage.removeItem('qbo_oauth_state')
  
  // Redirect to dashboard
  if (result.success) {
    navigate('/dashboard')
  }
}
```

### Step 4: Token Storage in Supabase

Tokens are stored securely using Supabase RPC functions:

```sql
-- Store tokens with automatic admin change tracking
CALL store_qbo_tokens(
  p_clerk_id => 'user_123',
  p_access_token => 'encrypted_access_token',
  p_refresh_token => 'encrypted_refresh_token',
  p_realm_id => 'realm_123',
  p_company_name => 'Acme Corp',
  p_expires_in => 3600
);
```

### Step 5: Making QBO API Calls

The QBO API client handles token management automatically:

```typescript
// Initialize QBO API client
const qboClient = useQBOApiClient({
  n8nWebhookUrl: import.meta.env.VITE_N8N_WEBHOOK_URL
})

// Make API calls (token refresh handled automatically)
const companyInfo = await qboClient.getCompanyInfo(realmId)
const accounts = await qboClient.query(realmId, 
  "SELECT * FROM Account WHERE Active = true"
)
```

### Step 6: Automatic Token Refresh

The token manager handles refresh automatically:

```typescript
class QBOTokenManager {
  async getValidToken(realmId: string): Promise<string> {
    const token = await this.getTokenFromSupabase(realmId)
    
    // Check if token is expiring soon (within 5 minutes)
    if (this.isExpiringSoon(token)) {
      // Refresh via n8n webhook
      const refreshed = await this.refreshViaWebhook(token)
      
      // Store refreshed token
      await this.storeRefreshedToken(refreshed)
      
      return refreshed.access_token
    }
    
    return token.access_token
  }
}
```

### Step 7: Token Revocation

```typescript
// Disconnect QuickBooks
const disconnect = async () => {
  // Revoke tokens in Supabase
  await revokeToken(realmId)
  
  // Optionally notify n8n to revoke with QBO
  if (n8nWebhookUrl) {
    await fetch(n8nWebhookUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'revoke_token',
        realm_id: realmId
      })
    })
  }
}
```

## Security Best Practices

### 1. Token Encryption
- Tokens are encrypted at rest in Supabase
- Use environment variables for sensitive configuration
- Never expose tokens in client-side logs

### 2. CSRF Protection
- Generate unique state parameter for each OAuth flow
- Verify state parameter in callback
- Store state in sessionStorage (not localStorage)

### 3. Token Scope Management
- Request minimum required scopes
- Use `com.intuit.quickbooks.accounting` for read/write access
- Consider read-only scopes for reporting applications

### 4. Rate Limiting
- Implement exponential backoff for retries
- Cache tokens to minimize database queries
- Use request queuing to prevent concurrent refreshes

### 5. Audit Logging
- Track all token operations
- Log admin changes for compliance
- Monitor for suspicious activity

## Environment Configuration

### Frontend (.env)
```env
# n8n Integration
VITE_N8N_OAUTH_URL=https://n8n.example.com/webhook/qbo-oauth-init
VITE_N8N_WEBHOOK_URL=https://n8n.example.com/webhook/qbo-token-refresh

# QuickBooks Configuration
VITE_QUICKBOOKS_CLIENT_ID=your_client_id
VITE_QBO_SANDBOX=false

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### n8n Environment
```env
QBO_CLIENT_ID=your_client_id
QBO_CLIENT_SECRET=your_client_secret
N8N_BASE_URL=https://n8n.example.com
QBO_SANDBOX=false
```

## Error Handling

### Common Errors and Solutions

#### 1. Invalid Token
```typescript
if (response.status === 401) {
  // Clear cached token
  tokenManager.clearCache(realmId)
  // Retry with fresh token
  return retry()
}
```

#### 2. Token Expired
```typescript
if (error.code === 'TOKEN_EXPIRED') {
  // Automatic refresh via n8n
  const refreshed = await refreshToken()
  // Retry request
  return retry()
}
```

#### 3. Rate Limiting
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  await delay(retryAfter * 1000)
  return retry()
}
```

#### 4. Network Errors
```typescript
try {
  return await makeRequest()
} catch (error) {
  if (isNetworkError(error)) {
    // Exponential backoff
    await delay(Math.pow(2, attempt) * 1000)
    return retry()
  }
  throw error
}
```

## Testing Checklist

### OAuth Flow Testing
- [ ] Test successful OAuth authorization
- [ ] Test OAuth cancellation
- [ ] Test invalid state parameter
- [ ] Test expired authorization code

### Token Management Testing
- [ ] Test token storage in Supabase
- [ ] Test automatic token refresh
- [ ] Test token revocation
- [ ] Test concurrent token operations

### API Integration Testing
- [ ] Test successful API calls
- [ ] Test rate limiting handling
- [ ] Test error recovery
- [ ] Test request queuing

### Security Testing
- [ ] Verify CSRF protection
- [ ] Test token encryption
- [ ] Verify RLS policies
- [ ] Test audit logging

## Monitoring and Maintenance

### Key Metrics to Monitor
1. Token refresh success rate
2. API call success rate
3. Average response time
4. Token expiration warnings
5. Failed authentication attempts

### Maintenance Tasks
1. **Daily**: Monitor error logs
2. **Weekly**: Review token refresh patterns
3. **Monthly**: Audit admin changes
4. **Quarterly**: Review and rotate credentials

## Troubleshooting Guide

### Debug Checklist
1. Check browser console for errors
2. Verify environment variables
3. Check n8n workflow execution
4. Review Supabase logs
5. Test with QBO sandbox account

### Common Issues
1. **CORS errors**: Configure n8n webhook CORS
2. **Token not found**: Check Supabase RLS policies
3. **Refresh fails**: Verify n8n webhook URL
4. **API errors**: Check QBO API status

## Support Resources

- [QuickBooks API Documentation](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
- [n8n Documentation](https://docs.n8n.io)
- [Supabase Documentation](https://supabase.com/docs)
- [OAuth 2.0 Specification](https://oauth.net/2/)

## Conclusion

This implementation provides a secure, scalable solution for managing QuickBooks Online OAuth tokens in a stateless architecture. The combination of n8n for OAuth flow management, Supabase for secure token storage, and automatic token refresh ensures a seamless user experience while maintaining security best practices.