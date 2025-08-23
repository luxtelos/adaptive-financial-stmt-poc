# n8n OAuth Webhook Setup for QuickBooks Online

This guide explains how to set up n8n webhooks to handle QuickBooks Online OAuth flow in a stateless architecture.

## Architecture Overview

```
Frontend → n8n OAuth Init → QBO OAuth → n8n Callback → Frontend Callback
```

The flow works as follows:
1. Frontend initiates OAuth by redirecting to n8n webhook
2. n8n handles OAuth authorization with QBO (stores client secret securely)
3. QBO redirects back to n8n with authorization code
4. n8n exchanges code for tokens
5. n8n redirects to frontend with encoded tokens
6. Frontend stores tokens in Supabase

## n8n Workflow Setup

### 1. OAuth Initialization Webhook

Create a webhook node that handles OAuth initiation:

**Webhook URL**: `/webhook/qbo-oauth-init`

**Workflow Steps**:
1. **Webhook Node**: Receive OAuth request
   - Method: GET
   - Parameters: `callback_url`, `state`

2. **Set Node**: Build OAuth URL
   ```javascript
   {
     "authUrl": "https://appcenter.intuit.com/connect/oauth2",
     "params": {
       "client_id": "{{$env.QBO_CLIENT_ID}}",
       "scope": "com.intuit.quickbooks.accounting",
       "redirect_uri": "{{$env.N8N_BASE_URL}}/webhook/qbo-oauth-callback",
       "response_type": "code",
       "state": "{{$json.query.state}}_{{$json.query.callback_url}}"
     }
   }
   ```

3. **Respond to Webhook**: Redirect to QBO
   - Response Code: 302
   - Headers: `Location: {{authUrl}}?{{params}}`

### 2. OAuth Callback Webhook

Create a webhook to handle QBO callback:

**Webhook URL**: `/webhook/qbo-oauth-callback`

**Workflow Steps**:
1. **Webhook Node**: Receive QBO callback
   - Method: GET
   - Parameters: `code`, `realmId`, `state`

2. **Function Node**: Parse state
   ```javascript
   const stateData = $json.query.state.split('_');
   return {
     originalState: stateData[0],
     callbackUrl: stateData[1],
     code: $json.query.code,
     realmId: $json.query.realmId
   };
   ```

3. **HTTP Request Node**: Exchange code for tokens
   - URL: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
   - Method: POST
   - Authentication: Basic (Client ID & Secret)
   - Headers:
     ```
     Accept: application/json
     Content-Type: application/x-www-form-urlencoded
     ```
   - Body:
     ```
     grant_type=authorization_code
     code={{code}}
     redirect_uri={{$env.N8N_BASE_URL}}/webhook/qbo-oauth-callback
     ```

4. **Function Node**: Get company info (optional)
   ```javascript
   // Use the access token to fetch company info
   const accessToken = $json.access_token;
   const realmId = $input.first().json.realmId;
   
   // Make API call to get company info
   // This is optional but provides company name for better UX
   ```

5. **Function Node**: Encode tokens
   ```javascript
   const tokenData = {
     access_token: $json.access_token,
     refresh_token: $json.refresh_token,
     expires_in: $json.expires_in,
     realm_id: $input.first().json.realmId,
     company_name: $json.companyName || null
   };
   
   const encodedTokens = encodeURIComponent(JSON.stringify(tokenData));
   const callbackUrl = $input.first().json.callbackUrl;
   const state = $input.first().json.originalState;
   
   return {
     redirectUrl: `${callbackUrl}?qb_tokens=${encodedTokens}&state=${state}`
   };
   ```

6. **Respond to Webhook**: Redirect to frontend
   - Response Code: 302
   - Headers: `Location: {{redirectUrl}}`

### 3. Token Refresh Webhook

Create a webhook for token refresh:

**Webhook URL**: `/webhook/qbo-token-refresh`

**Workflow Steps**:
1. **Webhook Node**: Receive refresh request
   - Method: POST
   - Body: `{ "action": "refresh_token", "realm_id": "...", "refresh_token": "...", "user_id": "..." }`

2. **HTTP Request Node**: Refresh token
   - URL: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
   - Method: POST
   - Authentication: Basic (Client ID & Secret)
   - Body:
     ```
     grant_type=refresh_token
     refresh_token={{refresh_token}}
     ```

3. **Respond to Webhook**: Return new tokens
   ```json
   {
     "access_token": "{{new_access_token}}",
     "refresh_token": "{{new_refresh_token}}",
     "expires_in": {{expires_in}},
     "x_refresh_token_expires_in": {{x_refresh_token_expires_in}}
   }
   ```

### 4. Token Revocation Webhook (Optional)

Create a webhook for token revocation:

**Webhook URL**: `/webhook/qbo-token-revoke`

**Workflow Steps**:
1. **Webhook Node**: Receive revoke request
   - Method: POST
   - Body: `{ "action": "revoke_token", "realm_id": "...", "user_id": "..." }`

2. **HTTP Request Node**: Revoke token
   - URL: `https://developer.api.intuit.com/v2/oauth2/tokens/revoke`
   - Method: POST
   - Authentication: Basic (Client ID & Secret)
   - Body:
     ```
     token={{refresh_token}}
     ```

3. **Respond to Webhook**: Confirm revocation
   ```json
   {
     "success": true,
     "message": "Token revoked successfully"
   }
   ```

## Environment Variables in n8n

Set these environment variables in your n8n instance:

```bash
# QuickBooks OAuth Credentials
QBO_CLIENT_ID=your_client_id
QBO_CLIENT_SECRET=your_client_secret

# n8n Base URL
N8N_BASE_URL=https://your-n8n-instance.com

# Optional: Sandbox mode
QBO_SANDBOX=false
```

## Security Considerations

1. **HTTPS Only**: Always use HTTPS for webhook URLs
2. **State Validation**: Always validate the state parameter to prevent CSRF
3. **Token Storage**: Never log or expose tokens in n8n execution history
4. **Secret Management**: Store client secret securely in n8n environment variables
5. **Access Control**: Implement webhook authentication if needed
6. **Rate Limiting**: Add rate limiting to prevent abuse

## Frontend Integration

Configure your frontend with the n8n webhook URLs:

```env
VITE_N8N_OAUTH_URL=https://your-n8n-instance.com/webhook/qbo-oauth-init
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/qbo-token-refresh
```

The frontend will:
1. Redirect users to `VITE_N8N_OAUTH_URL` to start OAuth
2. Handle callback at `/oauth-callback` route
3. Extract and store tokens in Supabase
4. Use `VITE_N8N_WEBHOOK_URL` for token refresh

## Testing

1. **Test OAuth Flow**:
   - Click "Connect to QuickBooks" in frontend
   - Verify redirect to QBO authorization
   - Authorize and verify callback
   - Check tokens are stored in Supabase

2. **Test Token Refresh**:
   - Wait for token to near expiration
   - Make an API call
   - Verify automatic refresh

3. **Test Error Handling**:
   - Cancel OAuth authorization
   - Use invalid state parameter
   - Test with expired refresh token

## Troubleshooting

### Common Issues

1. **Invalid redirect_uri**:
   - Ensure n8n webhook URL matches QBO app settings
   - URL must be exact match including protocol

2. **State mismatch**:
   - Check state encoding/decoding
   - Verify session storage in frontend

3. **Token refresh fails**:
   - Check refresh token hasn't expired (90 days)
   - Verify client credentials

4. **CORS errors**:
   - Configure n8n webhook CORS settings
   - Use proper response headers

### Debug Tips

- Enable n8n execution logging
- Use browser dev tools to inspect redirects
- Check Supabase logs for token storage
- Monitor QBO API rate limits