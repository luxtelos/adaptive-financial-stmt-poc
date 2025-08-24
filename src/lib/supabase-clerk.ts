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

// Singleton instances to avoid multiple client warnings and share caches
let supabaseClientInstance: SupabaseClient | null = null;
let qboServicesInstance: SupabaseQBOServices | null = null;

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
  private syncCache = new Map<string, { timestamp: number; promise: Promise<boolean> }>();
  private tokenCache = new Map<string, { timestamp: number; promise: Promise<any> }>();
  
  // Use environment variables for configuration
  private readonly CACHE_TTL = 60000; // 1 minute cache for tokens
  private readonly TOKEN_REFRESH_THRESHOLD_MS = (parseInt(import.meta.env.VITE_QBO_TOKEN_REFRESH_THRESHOLD_HOURS || '12') * 60 * 60 * 1000);
  private readonly MAX_RETRIES = parseInt(import.meta.env.VITE_QBO_TOKEN_REFRESH_RETRY_MAX || '3');
  private readonly RETRY_BACKOFF_MS = parseInt(import.meta.env.VITE_QBO_TOKEN_REFRESH_BACKOFF_MS || '2000');
  
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
    // Clear cache when storing new token
    this.tokenCache.clear();
    
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
    // Check cache first to prevent redundant calls
    const cacheKey = `token_${clerkUserId}_${realmId || 'all'}`;
    const cached = this.tokenCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('Using cached token promise for user:', clerkUserId);
      return cached.promise;
    }
    
    // Create the promise for fetching token
    const tokenPromise = this.fetchToken(clerkUserId, realmId);
    
    // Cache the PROMISE immediately to prevent concurrent calls
    this.tokenCache.set(cacheKey, {
      timestamp: Date.now(),
      promise: tokenPromise
    });
    
    return tokenPromise;
  }
  
  private async fetchToken(clerkUserId: string, realmId?: string): Promise<QBOToken | QBOToken[] | null> {
    console.log('Fetching fresh token for user:', clerkUserId);
    const { data, error } = await this.client.rpc('get_qbo_token', {
      p_clerk_id: clerkUserId,
      p_realm_id: realmId || null,
    });
    
    if (error) {
      throw new Error(`Failed to get token: ${error.message}`);
    }
    
    const response = data as SupabaseResponse<QBOToken | QBOToken[]>;
    const result = response.success ? response.data || null : null;
    
    // Check if token needs refresh based on threshold
    if (result) {
      const tokens = Array.isArray(result) ? result : [result];
      for (const token of tokens) {
        if (this.needsRefresh(token)) {
          console.log(`Token for realm ${token.realm_id} needs refresh (expires in ${this.getTokenExpirationTime(token) / 1000 / 60} minutes)`);
          // Note: Actual refresh would be handled by the QBO service that uses this token
        }
      }
    }
    
    return result;
  }
  
  /**
   * Sync Clerk user with Supabase
   */
  async syncUser(clerkUserId: string, email: string): Promise<boolean> {
    // Check cache first to prevent redundant calls
    const cacheKey = `${clerkUserId}_${email}`;
    const cached = this.syncCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('Using cached sync result for user:', clerkUserId);
      return cached.promise;
    }
    
    // Create new sync promise
    const syncPromise = this.performSync(clerkUserId, email);
    
    // Cache the promise to prevent concurrent calls
    this.syncCache.set(cacheKey, {
      timestamp: Date.now(),
      promise: syncPromise
    });
    
    return syncPromise;
  }
  
  private async performSync(clerkUserId: string, email: string): Promise<boolean> {
    console.log('Performing actual sync for user:', clerkUserId);
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
   * Refresh OAuth tokens with retry logic
   */
  async refreshToken(
    clerkUserId: string,
    realmId: string,
    newAccessToken: string,
    newRefreshToken: string,
    expiresIn?: number
  ): Promise<boolean> {
    let lastError: Error | null = null;
    
    // Retry with exponential backoff
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // Clear token cache on refresh
        this.tokenCache.clear();
        
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
        
        console.log(`Token refreshed successfully for realm ${realmId}`);
        return (data as SupabaseResponse).success;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`Token refresh attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.MAX_RETRIES - 1) {
          // Wait with exponential backoff
          const delay = this.RETRY_BACKOFF_MS * Math.pow(2, attempt);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to refresh token after max retries');
  }
  
  /**
   * Revoke QBO token
   */
  async revokeToken(clerkUserId: string, realmId?: string): Promise<number> {
    // Clear cache when revoking token
    this.tokenCache.clear();
    
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
   * Check if token needs refresh based on threshold
   */
  needsRefresh(token: QBOToken): boolean {
    const timeUntilExpiry = this.getTokenExpirationTime(token);
    return timeUntilExpiry <= this.TOKEN_REFRESH_THRESHOLD_MS;
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
  
  // Use singleton instance to share cache across all components
  if (!qboServicesInstance) {
    qboServicesInstance = new SupabaseQBOServices(client);
  }
  const services = qboServicesInstance;
  
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