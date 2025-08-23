/**
 * Supabase Client with Clerk JWT Integration
 * 
 * This module provides a Supabase client that automatically includes
 * Clerk JWT tokens for authentication and RLS policy enforcement.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useAuth, useUser } from '@clerk/clerk-react';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface QBOToken {
  id: string;
  realm_id: string;
  user_clerk_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  expires_in: number;
  company_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}


export interface QBOAdminChange {
  id: string;
  realm_id: string;
  previous_clerk_id?: string;
  new_clerk_id: string;
  changed_at: string;
}

export interface StoreTokenResult {
  success: boolean;
  admin_changed: boolean;
  previous_admin?: string;
}

export interface SupabaseResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
}

// =====================================================
// SUPABASE CLIENT FACTORY
// =====================================================

/**
 * Creates a Supabase client with Clerk JWT token injection
 */
export function createSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  getToken: () => Promise<string | null>
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: async () => {
        const token = await getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// =====================================================
// REACT HOOK FOR SUPABASE WITH CLERK
// =====================================================

// Singleton instance to avoid multiple client warnings
let supabaseClientInstance: SupabaseClient | null = null;

export function useSupabaseWithClerk() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables not configured');
  }
  
  // Create standard client (no JWT needed since we pass clerk_id to RPC functions)
  // Use singleton to avoid multiple instances
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  
  return {
    client: supabaseClientInstance,
    isLoaded,
    isSignedIn,
    userId,
  };
}

// =====================================================
// QBO TOKEN SERVICE
// =====================================================

export class QBOTokenService {
  constructor(private client: SupabaseClient) {}
  
  /**
   * Store or update QBO token (handles admin changes atomically)
   */
  async storeToken(
    clerkUserId: string,
    params: {
      realm_id: string;
      access_token: string;
      refresh_token: string;
      expires_in?: number;
      company_name?: string;
    }
  ): Promise<StoreTokenResult> {
    const { data, error } = await this.client.rpc('store_qbo_tokens', {
      p_clerk_id: clerkUserId,
      p_access_token: params.access_token,
      p_refresh_token: params.refresh_token,
      p_realm_id: params.realm_id,
      p_company_name: params.company_name,
      p_expires_in: params.expires_in || 3600,
    });
    
    if (error) {
      throw new Error(`Failed to store token: ${error.message}`);
    }
    
    return data as StoreTokenResult;
  }
  
  /**
   * Get QBO token for a realm
   */
  async getToken(clerkUserId: string, realmId?: string): Promise<QBOToken | QBOToken[] | null> {
    const { data, error } = await this.client.rpc('get_qbo_token', {
      p_clerk_id: clerkUserId,
      p_realm_id: realmId || null,
    });
    
    if (error) {
      throw new Error(`Failed to get token: ${error.message}`);
    }
    
    const response = data as SupabaseResponse<QBOToken | QBOToken[]>;
    return response.success ? response.data || null : null;
  }
  
  /**
   * Sync Clerk user with Supabase
   */
  async syncUser(clerkUserId: string, email: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('sync_clerk_user', {
      p_clerk_id: clerkUserId,
      p_email: email,
    });
    
    if (error) {
      throw new Error(`Failed to sync user: ${error.message}`);
    }
    
    return (data as SupabaseResponse).success;
  }
  
  /**
   * Refresh OAuth tokens
   */
  async refreshToken(
    clerkUserId: string,
    realmId: string,
    newAccessToken: string,
    newRefreshToken: string,
    expiresIn?: number
  ): Promise<boolean> {
    const { data, error } = await this.client.rpc('refresh_qbo_token', {
      p_clerk_id: clerkUserId,
      p_realm_id: realmId,
      p_access_token: newAccessToken,
      p_refresh_token: newRefreshToken,
      p_expires_in: expiresIn || 3600,
    });
    
    if (error) {
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
    
    return (data as SupabaseResponse).success;
  }
  
  /**
   * Revoke QBO token
   */
  async revokeToken(clerkUserId: string, realmId?: string): Promise<number> {
    const { data, error } = await this.client.rpc('revoke_qbo_tokens', {
      p_clerk_id: clerkUserId,
      p_realm_id: realmId || null,
    });
    
    if (error) {
      throw new Error(`Failed to revoke token: ${error.message}`);
    }
    
    const response = data as SupabaseResponse;
    return response.count || 0;
  }
  
  /**
   * Check if token is expired
   */
  isTokenExpired(token: QBOToken): boolean {
    return new Date(token.expires_at) <= new Date();
  }
  
  /**
   * Get time until token expiration
   */
  getTokenExpirationTime(token: QBOToken): number {
    return new Date(token.expires_at).getTime() - Date.now();
  }
}


// =====================================================
// AUDIT LOG SERVICE
// =====================================================

export class AuditLogService {
  constructor(private client: SupabaseClient) {}
  
  /**
   * Get admin changes for a realm
   */
  async getAdminChanges(clerkUserId: string, realmId: string): Promise<QBOAdminChange[]> {
    const { data, error } = await this.client.rpc('get_admin_changes', {
      p_clerk_id: clerkUserId,
      p_realm_id: realmId,
    });
    
    if (error) {
      throw new Error(`Failed to get admin changes: ${error.message}`);
    }
    
    const response = data as SupabaseResponse<QBOAdminChange[]>;
    return response.success ? response.data || [] : [];
  }
}

// =====================================================
// COMBINED SERVICE FACTORY
// =====================================================

export class SupabaseQBOServices {
  public tokens: QBOTokenService;
  public audit: AuditLogService;
  
  constructor(client: SupabaseClient) {
    this.tokens = new QBOTokenService(client);
    this.audit = new AuditLogService(client);
  }
}

// =====================================================
// REACT HOOKS
// =====================================================

/**
 * Hook to use all QBO services with Clerk authentication
 */
export function useQBOServices() {
  const { client, isLoaded, isSignedIn, userId } = useSupabaseWithClerk();
  const { user } = useUser();
  
  if (!isLoaded) {
    return {
      services: null,
      isLoaded: false,
      isSignedIn: false,
      userId: null,
      syncUser: async () => false,
      storeToken: async () => ({ success: false, admin_changed: false }),
      getToken: async () => null,
      refreshToken: async () => false,
      revokeToken: async () => 0,
    };
  }
  
  if (!isSignedIn || !userId) {
    return {
      services: null,
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      syncUser: async () => false,
      storeToken: async () => ({ success: false, admin_changed: false }),
      getToken: async () => null,
      refreshToken: async () => false,
      revokeToken: async () => 0,
    };
  }
  
  const services = new SupabaseQBOServices(client);
  
  // Helper functions that automatically include clerk user ID
  const syncUser = async () => {
    const email = user?.emailAddresses?.[0]?.emailAddress || '';
    return services.tokens.syncUser(userId, email);
  };
  
  const storeToken = async (params: {
    realm_id: string;
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    company_name?: string;
  }) => {
    return services.tokens.storeToken(userId, params);
  };
  
  const getToken = async (realmId?: string) => {
    return services.tokens.getToken(userId, realmId);
  };
  
  const refreshToken = async (
    realmId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn?: number
  ) => {
    return services.tokens.refreshToken(userId, realmId, accessToken, refreshToken, expiresIn);
  };
  
  const revokeToken = async (realmId?: string) => {
    return services.tokens.revokeToken(userId, realmId);
  };
  
  const getAdminChanges = async (realmId: string) => {
    return services.audit.getAdminChanges(userId, realmId);
  };
  
  return {
    services,
    isLoaded: true,
    isSignedIn: true,
    userId,
    syncUser,
    storeToken,
    getToken,
    refreshToken,
    revokeToken,
    getAdminChanges,
  };
}

// =====================================================
// ERROR HANDLING
// =====================================================

export class QBOError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'QBOError';
  }
}

export function handleSupabaseError(error: any): never {
  if (error.code === 'PGRST301') {
    throw new QBOError('Authentication required', 'AUTH_REQUIRED', error);
  }
  
  if (error.code === 'PGRST204') {
    throw new QBOError('Access denied', 'ACCESS_DENIED', error);
  }
  
  if (error.code === '23505') {
    throw new QBOError('Resource already exists', 'DUPLICATE', error);
  }
  
  throw new QBOError(error.message || 'Unknown error', error.code, error);
}