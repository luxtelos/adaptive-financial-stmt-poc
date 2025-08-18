export const quickbooksConfig = {
  clientId: import.meta.env.VITE_QUICKBOOKS_CLIENT_ID,
  clientSecret: import.meta.env.VITE_QUICKBOOKS_CLIENT_SECRET,
  redirectUri: import.meta.env.VITE_QUICKBOOKS_REDIRECT_URI,
  environment: 'sandbox', // 'production' for live
  scopes: [
    'com.intuit.quickbooks.accounting',
    'com.intuit.quickbooks.payment',
    'openid',
    'profile',
    'email',
    'phone',
    'address',
  ],
  webhookUrl: import.meta.env.VITE_QUICKBOOKS_WEBHOOK_URL,
  authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
  tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
};