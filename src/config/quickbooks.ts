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
  authorizationUrl: import.meta.env.VITE_QBO_AUTH_BASE_URL,
  tokenUrl: import.meta.env.VITE_QBO_TOKEN_URL,
  revokeUrl: import.meta.env.VITE_QBO_REVOKE_URL,
};