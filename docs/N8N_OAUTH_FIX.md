# n8n OAuth Token Exchange Fix

## The Problem
The error `invalid_client` occurs because the QuickBooks token exchange endpoint requires proper client authentication.

## Solution for n8n HTTP Request Node

### Configure the HTTP Request node with these settings:

1. **Method**: POST
2. **URL**: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`

3. **Authentication**:
   - Type: **Generic Credential Type**
   - Credential Type: **HTTP Basic Auth**
   - Create new credentials with:
     - Username: `AB5I64mS6PXfDt1NRea83L9Vribuk8g40Mpc9vSUwynJYAFoGX` (your client_id)
     - Password: `[YOUR_CLIENT_SECRET]` (get from QuickBooks app)

4. **Headers**:
   ```
   Content-Type: application/x-www-form-urlencoded
   Accept: application/json
   ```

5. **Body** (Form URL Encoded):
   - grant_type: `authorization_code`
   - code: `{{ $json.query.code }}`
   - redirect_uri: `https://n8n-1-102-1-c1zi.onrender.com/webhook/3e4c9f5c-5037-4b7e-8572-fb19d0cc4a3b`

## Alternative: Manual Authorization Header

If Basic Auth doesn't work, use a manual Authorization header:

1. Create the base64 encoded string:
   ```bash
   echo -n "CLIENT_ID:CLIENT_SECRET" | base64
   ```

2. Add this header:
   ```
   Authorization: Basic [BASE64_ENCODED_STRING]
   ```

## Important Notes

1. **Client Secret**: You need to get this from your QuickBooks app at https://app.developer.intuit.com/
2. **Never expose the client_secret** in frontend code - that's why n8n handles it
3. **The redirect_uri** must match exactly what's registered in your QuickBooks app

## Complete n8n Workflow JSON Update

Update your HTTP Request node in the workflow to include proper authentication:

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpBasicAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/x-www-form-urlencoded"
        },
        {
          "name": "Accept",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "contentType": "application/x-www-form-urlencoded",
    "bodyParameters": {
      "parameters": [
        {
          "name": "grant_type",
          "value": "authorization_code"
        },
        {
          "name": "code",
          "value": "={{$json[\"query\"][\"code\"]}}"
        },
        {
          "name": "redirect_uri",
          "value": "https://n8n-1-102-1-c1zi.onrender.com/webhook/3e4c9f5c-5037-4b7e-8572-fb19d0cc4a3b"
        }
      ]
    }
  }
}
```

## Testing

After updating the n8n workflow:
1. Try the OAuth flow again from your app
2. The token exchange should now succeed
3. n8n will redirect back to your app with the tokens