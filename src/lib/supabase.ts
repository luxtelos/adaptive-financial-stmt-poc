import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Types for our data structures
export interface User {
  id: string
  email: string
  clerk_id: string
  company_name?: string
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  user_id: string
  name: string
  industry: string
  quickbooks_connected: boolean
  created_at: string
  updated_at: string
}

export interface FinancialReport {
  id: string
  company_id: string
  report_type: 'profit_loss' | 'balance_sheet' | 'cash_flow' | 'trial_balance' | 'custom'
  period_start: string
  period_end: string
  raw_data: any
  ai_analysis?: string
  pdf_url?: string
  perplexity_response?: any
  score: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  created_at: string
  updated_at: string
}

export interface QuickBooksConnection {
  id: string
  company_id: string
  user_id: string
  access_token: string
  refresh_token: string
  realm_id: string
  company_id_qb: string
  expires_at: string
  connected_at: string
  last_sync: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata?: any
  created_at: string
}

// Lazy initialization of Supabase client
let supabaseInstance: SupabaseClient | null = null;

// Check if Supabase credentials are configured
export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return !!(url && key && url !== 'https://your-project.supabase.co' && key !== 'your_supabase_anon_key');
};

// Get or create Supabase client instance
export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
    return null;
  }

  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      return null;
    }
  }

  return supabaseInstance;
};

// Export a proxy object that lazy loads the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop, receiver) {
    const client = getSupabase();
    if (!client) {
      // Return mock functions that handle the missing client gracefully
      if (prop === 'from') {
        return () => ({
          select: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
          insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
          update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
          delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
          upsert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        });
      }
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          signIn: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
          signOut: () => Promise.resolve({ error: new Error('Supabase not configured') }),
          onAuthStateChange: () => ({ subscription: { unsubscribe: () => {} } }),
        };
      }
      return undefined;
    }
    return Reflect.get(client, prop, receiver);
  }
});