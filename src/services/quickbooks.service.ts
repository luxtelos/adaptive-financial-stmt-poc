import { supabase, QuickBooksConnection } from '../lib/supabase';

// QuickBooks configuration
const quickbooksConfig = {
  clientId: import.meta.env.VITE_QBO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_QBO_REDIRECT_URI || window.location.origin + '/callback',
  // External backend API for QuickBooks operations
  apiBaseUrl: import.meta.env.VITE_QBO_API_BASE_URL,
  scopes: [
    'com.intuit.quickbooks.accounting',
    'com.intuit.quickbooks.payment',
    'openid',
    'profile',
    'email'
  ]
};

// Helper to determine API path based on environment
const getApiPath = (endpoint: string) => {
  // In production (Netlify), use the proxy path
  // In development (localhost), use the actual API URL or proxy
  if (import.meta.env.PROD) {
    return `/api/quickbooks${endpoint}`;
  }
  // For localhost development
  return `${quickbooksConfig.apiBaseUrl}${endpoint}`;
};

export class QuickBooksService {
  // Generate OAuth URL for QuickBooks connection
  static getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: quickbooksConfig.clientId,
      scope: quickbooksConfig.scopes.join(' '),
      redirect_uri: quickbooksConfig.redirectUri,
      response_type: 'code',
      state,
    });

    // Use the external backend to generate the auth URL
    return `${quickbooksConfig.apiBaseUrl}/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens via external backend
  static async exchangeCodeForTokens(code: string, realmId: string) {
    try {
      const response = await fetch(getApiPath('/oauth/token'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          realmId,
          redirectUri: quickbooksConfig.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to exchange tokens: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  // Store QuickBooks connection in Supabase
  static async saveConnection(
    userId: string,
    companyId: string,
    tokens: any,
    realmId: string
  ): Promise<QuickBooksConnection | null> {
    const { data, error } = await supabase
      .from('quickbooks_connections')
      .upsert({
        user_id: userId,
        company_id: companyId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        realm_id: realmId,
        company_id_qb: realmId,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        last_sync: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving QuickBooks connection:', error);
      return null;
    }

    return data;
  }

  // Refresh access token via external backend
  static async refreshAccessToken(refreshToken: string) {
    try {
      const response = await fetch(getApiPath('/oauth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      return await response.json();
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  // Import reports from QuickBooks via external backend
  static async importReports(
    connectionId: string,
    reportType: string,
    startDate: string,
    endDate: string
  ) {
    try {
      // Get connection details from Supabase
      const { data: connection, error } = await supabase
        .from('quickbooks_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error || !connection) {
        throw new Error('Connection not found');
      }

      // Check if token needs refresh
      const expiresAt = new Date(connection.expires_at);
      let accessToken = connection.access_token;

      if (expiresAt <= new Date()) {
        const newTokens = await this.refreshAccessToken(connection.refresh_token);
        accessToken = newTokens.access_token;
        
        // Update tokens in Supabase
        await supabase
          .from('quickbooks_connections')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          })
          .eq('id', connectionId);
      }

      // Fetch report from external backend API
      const response = await fetch(getApiPath('/reports/import'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          realmId: connection.realm_id,
          reportType,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }

      const reportData = await response.json();

      // Store report in Supabase
      const { data: savedReport, error: saveError } = await supabase
        .from('reports')
        .insert({
          company_id: connection.company_id,
          report_type: reportType,
          report_data: reportData,
          period_start: startDate,
          period_end: endDate,
          source: 'quickbooks',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving report:', saveError);
      }

      return savedReport || reportData;
    } catch (error) {
      console.error('Error importing reports:', error);
      throw error;
    }
  }

  // Get company info from QuickBooks via external backend
  static async getCompanyInfo(connectionId: string) {
    try {
      const { data: connection, error } = await supabase
        .from('quickbooks_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error || !connection) {
        throw new Error('Connection not found');
      }

      const response = await fetch(getApiPath(`/company/${connection.realm_id}`), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${connection.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch company info');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching company info:', error);
      throw error;
    }
  }

  // Sync data from QuickBooks via external backend
  static async syncData(connectionId: string, dataTypes: string[]) {
    try {
      const { data: connection, error } = await supabase
        .from('quickbooks_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error || !connection) {
        throw new Error('Connection not found');
      }

      const response = await fetch(getApiPath('/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${connection.access_token}`,
        },
        body: JSON.stringify({
          realmId: connection.realm_id,
          dataTypes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync data');
      }

      const syncResult = await response.json();

      // Update last sync time in Supabase
      await supabase
        .from('quickbooks_connections')
        .update({
          last_sync: new Date().toISOString(),
        })
        .eq('id', connectionId);

      return syncResult;
    } catch (error) {
      console.error('Error syncing data:', error);
      throw error;
    }
  }

  // Disconnect QuickBooks via external backend
  static async disconnect(connectionId: string) {
    try {
      const { data: connection } = await supabase
        .from('quickbooks_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (connection) {
        // Revoke tokens via external backend
        await fetch(getApiPath('/oauth/revoke'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken: connection.refresh_token,
          }),
        });
      }

      // Delete connection from Supabase
      const { error } = await supabase
        .from('quickbooks_connections')
        .delete()
        .eq('id', connectionId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error disconnecting QuickBooks:', error);
      throw error;
    }
  }

  // Check connection status
  static async checkConnectionStatus(connectionId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('quickbooks_connections')
      .select('expires_at')
      .eq('id', connectionId)
      .single();

    if (error || !data) {
      return false;
    }

    const expiresAt = new Date(data.expires_at);
    return expiresAt > new Date();
  }

  // Get available report types
  static getAvailableReportTypes() {
    return [
      { value: 'profit_loss', label: 'Profit & Loss Statement' },
      { value: 'balance_sheet', label: 'Balance Sheet' },
      { value: 'cash_flow', label: 'Cash Flow Statement' },
      { value: 'trial_balance', label: 'Trial Balance' },
      { value: 'general_ledger', label: 'General Ledger' },
      { value: 'aged_receivables', label: 'Aged Receivables' },
      { value: 'aged_payables', label: 'Aged Payables' },
    ];
  }
}