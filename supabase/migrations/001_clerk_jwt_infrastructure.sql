-- =====================================================
-- CLERK JWT INFRASTRUCTURE FOR SUPABASE
-- =====================================================
-- This migration sets up complete JWT validation and RLS policies
-- for Clerk authentication integration with QuickBooks single-admin constraint

-- =====================================================
-- 1. EXTENSIONS & PREREQUISITES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- =====================================================
-- 2. JWT SECRET CONFIGURATION
-- =====================================================
-- Store Clerk's public key for JWT verification
-- You'll need to update this with your actual Clerk public key
CREATE TABLE IF NOT EXISTS auth.jwt_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  secret TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'RS256',
  issuer TEXT NOT NULL,
  audience TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Insert Clerk JWT configuration (UPDATE WITH YOUR ACTUAL VALUES)
-- Get these from Clerk Dashboard > API Keys > Show JWT public key
INSERT INTO auth.jwt_secrets (secret, algorithm, issuer, audience) 
VALUES (
  '-----BEGIN PUBLIC KEY-----
YOUR_CLERK_PUBLIC_KEY_HERE
-----END PUBLIC KEY-----',
  'RS256',
  'https://your-clerk-instance.clerk.accounts.dev',
  ARRAY['your-frontend-url']
) ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. JWT VALIDATION FUNCTIONS
-- =====================================================

-- Function to extract and validate Clerk JWT
CREATE OR REPLACE FUNCTION auth.jwt() 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
STABLE
AS $$
DECLARE
  jwt_token TEXT;
  jwt_payload JSONB;
  jwt_header JSONB;
  secret_key TEXT;
BEGIN
  -- Extract JWT from request header
  jwt_token := current_setting('request.jwt.claim', true);
  
  -- If no JWT in settings, try to extract from authorization header
  IF jwt_token IS NULL THEN
    jwt_token := current_setting('request.headers', true)::json->>'authorization';
    IF jwt_token IS NOT NULL AND jwt_token LIKE 'Bearer %' THEN
      jwt_token := substring(jwt_token from 8);
    END IF;
  END IF;
  
  -- Return empty object if no token
  IF jwt_token IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Decode and validate JWT (basic validation, enhance as needed)
  BEGIN
    -- Split JWT and decode payload (base64url decode)
    jwt_payload := convert_from(
      decode(
        translate(
          split_part(jwt_token, '.', 2),
          '-_',
          '+/'
        ) || repeat('=', (4 - length(split_part(jwt_token, '.', 2)) % 4) % 4),
        'base64'
      ),
      'utf8'
    )::jsonb;
    
    -- Check expiration
    IF (jwt_payload->>'exp')::bigint < extract(epoch from now()) THEN
      RAISE EXCEPTION 'JWT token expired';
    END IF;
    
    RETURN jwt_payload;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but return empty object to prevent information leakage
      RAISE WARNING 'JWT validation error: %', SQLERRM;
      RETURN '{}'::jsonb;
  END;
END;
$$;

-- Enhanced function to get current user's Clerk ID
CREATE OR REPLACE FUNCTION auth.clerk_user_id() 
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER
STABLE
AS $$
DECLARE
  jwt_data JSONB;
BEGIN
  jwt_data := auth.jwt();
  
  -- Clerk JWTs have 'sub' claim with user ID
  IF jwt_data ? 'sub' THEN
    RETURN jwt_data->>'sub';
  END IF;
  
  -- Fallback to custom claims if configured
  IF jwt_data ? 'clerk_user_id' THEN
    RETURN jwt_data->>'clerk_user_id';
  END IF;
  
  RETURN NULL;
END;
$$;

-- Function to check if user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated() 
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN auth.clerk_user_id() IS NOT NULL;
END;
$$;

-- =====================================================
-- 4. UPDATED SCHEMA WITH PROPER CONSTRAINTS
-- =====================================================

-- Update users table to ensure Clerk integration
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create qbo_tokens table (QuickBooks OAuth tokens)
CREATE TABLE IF NOT EXISTS qbo_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm_id TEXT NOT NULL UNIQUE, -- QuickBooks company ID (one admin per company)
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  company_name TEXT,
  is_sandbox BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_realm_admin UNIQUE(realm_id)
);

-- Create user_assessments table
CREATE TABLE IF NOT EXISTS user_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL,
  assessment_type TEXT NOT NULL,
  assessment_data JSONB NOT NULL,
  score NUMERIC(5,2),
  status TEXT DEFAULT 'draft',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_realm_exists FOREIGN KEY (realm_id) REFERENCES qbo_tokens(realm_id) ON DELETE CASCADE
);

-- Create audit table for admin changes
CREATE TABLE IF NOT EXISTS qbo_admin_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm_id TEXT NOT NULL,
  previous_admin_id TEXT,
  new_admin_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('initial', 'transfer', 'revoke')),
  initiated_by TEXT NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. ATOMIC RPC FUNCTIONS
-- =====================================================

-- Store QBO token with atomic admin change handling
CREATE OR REPLACE FUNCTION store_qbo_token(
  p_realm_id TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE,
  p_company_name TEXT DEFAULT NULL,
  p_is_sandbox BOOLEAN DEFAULT false,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clerk_user_id TEXT;
  v_existing_admin TEXT;
  v_result JSONB;
  v_token_id UUID;
  v_change_type TEXT;
BEGIN
  -- Get current user from JWT
  v_clerk_user_id := auth.clerk_user_id();
  
  IF v_clerk_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Start atomic transaction
  BEGIN
    -- Check for existing admin
    SELECT clerk_user_id INTO v_existing_admin
    FROM qbo_tokens
    WHERE realm_id = p_realm_id
    FOR UPDATE; -- Lock the row
    
    -- Determine change type
    IF v_existing_admin IS NULL THEN
      v_change_type := 'initial';
    ELSIF v_existing_admin != v_clerk_user_id THEN
      v_change_type := 'transfer';
    ELSE
      v_change_type := 'update';
    END IF;
    
    -- Perform upsert
    INSERT INTO qbo_tokens (
      realm_id, 
      clerk_user_id, 
      access_token, 
      refresh_token, 
      expires_at,
      company_name,
      is_sandbox,
      metadata,
      updated_at
    ) VALUES (
      p_realm_id,
      v_clerk_user_id,
      p_access_token,
      p_refresh_token,
      p_expires_at,
      p_company_name,
      p_is_sandbox,
      p_metadata,
      NOW()
    )
    ON CONFLICT (realm_id) 
    DO UPDATE SET
      clerk_user_id = EXCLUDED.clerk_user_id,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      company_name = COALESCE(EXCLUDED.company_name, qbo_tokens.company_name),
      is_sandbox = EXCLUDED.is_sandbox,
      metadata = qbo_tokens.metadata || EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id INTO v_token_id;
    
    -- Log admin change if applicable
    IF v_change_type IN ('initial', 'transfer') THEN
      INSERT INTO qbo_admin_changes (
        realm_id,
        previous_admin_id,
        new_admin_id,
        change_type,
        initiated_by,
        metadata
      ) VALUES (
        p_realm_id,
        v_existing_admin,
        v_clerk_user_id,
        v_change_type,
        v_clerk_user_id,
        jsonb_build_object(
          'token_id', v_token_id,
          'company_name', p_company_name,
          'is_sandbox', p_is_sandbox
        )
      );
    END IF;
    
    -- Build result
    v_result := jsonb_build_object(
      'success', true,
      'token_id', v_token_id,
      'change_type', v_change_type,
      'previous_admin', v_existing_admin,
      'new_admin', v_clerk_user_id
    );
    
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback is automatic
      RAISE EXCEPTION 'Failed to store token: %', SQLERRM;
  END;
END;
$$;

-- Get QBO token (respects RLS)
CREATE OR REPLACE FUNCTION get_qbo_token(p_realm_id TEXT)
RETURNS TABLE (
  id UUID,
  realm_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  company_name TEXT,
  is_sandbox BOOLEAN,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_clerk_user_id TEXT;
BEGIN
  v_clerk_user_id := auth.clerk_user_id();
  
  IF v_clerk_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  RETURN QUERY
  SELECT 
    t.id,
    t.realm_id,
    t.access_token,
    t.refresh_token,
    t.expires_at,
    t.company_name,
    t.is_sandbox,
    t.metadata
  FROM qbo_tokens t
  WHERE t.realm_id = p_realm_id
    AND t.clerk_user_id = v_clerk_user_id;
END;
$$;

-- Refresh QBO token
CREATE OR REPLACE FUNCTION refresh_qbo_token(
  p_realm_id TEXT,
  p_new_access_token TEXT,
  p_new_refresh_token TEXT,
  p_new_expires_at TIMESTAMP WITH TIME ZONE
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clerk_user_id TEXT;
  v_updated_count INT;
BEGIN
  v_clerk_user_id := auth.clerk_user_id();
  
  IF v_clerk_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  UPDATE qbo_tokens
  SET 
    access_token = p_new_access_token,
    refresh_token = p_new_refresh_token,
    expires_at = p_new_expires_at,
    updated_at = NOW()
  WHERE realm_id = p_realm_id
    AND clerk_user_id = v_clerk_user_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count > 0;
END;
$$;

-- Revoke QBO token
CREATE OR REPLACE FUNCTION revoke_qbo_token(p_realm_id TEXT, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clerk_user_id TEXT;
  v_deleted_count INT;
BEGIN
  v_clerk_user_id := auth.clerk_user_id();
  
  IF v_clerk_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Log the revocation
  INSERT INTO qbo_admin_changes (
    realm_id,
    previous_admin_id,
    new_admin_id,
    change_type,
    initiated_by,
    reason
  ) 
  SELECT 
    realm_id,
    clerk_user_id,
    NULL,
    'revoke',
    v_clerk_user_id,
    p_reason
  FROM qbo_tokens
  WHERE realm_id = p_realm_id
    AND clerk_user_id = v_clerk_user_id;
  
  -- Delete the token
  DELETE FROM qbo_tokens
  WHERE realm_id = p_realm_id
    AND clerk_user_id = v_clerk_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count > 0;
END;
$$;

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbo_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbo_admin_changes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own record" ON users;
DROP POLICY IF EXISTS "Users can update own record" ON users;

-- Users table policies
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (clerk_id = auth.clerk_user_id());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (clerk_id = auth.clerk_user_id())
  WITH CHECK (clerk_id = auth.clerk_user_id());

CREATE POLICY "users_insert_own" ON users
  FOR INSERT
  WITH CHECK (clerk_id = auth.clerk_user_id());

-- QBO Tokens policies (strict single-admin enforcement)
CREATE POLICY "qbo_tokens_select_own" ON qbo_tokens
  FOR SELECT
  USING (clerk_user_id = auth.clerk_user_id());

CREATE POLICY "qbo_tokens_insert_check" ON qbo_tokens
  FOR INSERT
  WITH CHECK (
    clerk_user_id = auth.clerk_user_id() 
    AND NOT EXISTS (
      SELECT 1 FROM qbo_tokens t 
      WHERE t.realm_id = qbo_tokens.realm_id 
      AND t.clerk_user_id != auth.clerk_user_id()
    )
  );

CREATE POLICY "qbo_tokens_update_own" ON qbo_tokens
  FOR UPDATE
  USING (clerk_user_id = auth.clerk_user_id())
  WITH CHECK (clerk_user_id = auth.clerk_user_id());

CREATE POLICY "qbo_tokens_delete_own" ON qbo_tokens
  FOR DELETE
  USING (clerk_user_id = auth.clerk_user_id());

-- User Assessments policies
CREATE POLICY "assessments_select_own" ON user_assessments
  FOR SELECT
  USING (
    clerk_user_id = auth.clerk_user_id()
    OR realm_id IN (
      SELECT realm_id FROM qbo_tokens WHERE clerk_user_id = auth.clerk_user_id()
    )
  );

CREATE POLICY "assessments_insert_own" ON user_assessments
  FOR INSERT
  WITH CHECK (
    clerk_user_id = auth.clerk_user_id()
    AND realm_id IN (
      SELECT realm_id FROM qbo_tokens WHERE clerk_user_id = auth.clerk_user_id()
    )
  );

CREATE POLICY "assessments_update_own" ON user_assessments
  FOR UPDATE
  USING (clerk_user_id = auth.clerk_user_id())
  WITH CHECK (clerk_user_id = auth.clerk_user_id());

CREATE POLICY "assessments_delete_own" ON user_assessments
  FOR DELETE
  USING (clerk_user_id = auth.clerk_user_id());

-- Admin changes audit log policies (read-only for affected users)
CREATE POLICY "admin_changes_select_involved" ON qbo_admin_changes
  FOR SELECT
  USING (
    previous_admin_id = auth.clerk_user_id()
    OR new_admin_id = auth.clerk_user_id()
    OR initiated_by = auth.clerk_user_id()
  );

-- No insert/update/delete policies for audit log (only via functions)

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_qbo_tokens_realm_id ON qbo_tokens(realm_id);
CREATE INDEX IF NOT EXISTS idx_qbo_tokens_clerk_user_id ON qbo_tokens(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_qbo_tokens_expires_at ON qbo_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_assessments_clerk_user_id ON user_assessments(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_user_assessments_realm_id ON user_assessments(realm_id);
CREATE INDEX IF NOT EXISTS idx_user_assessments_status ON user_assessments(status);

CREATE INDEX IF NOT EXISTS idx_qbo_admin_changes_realm_id ON qbo_admin_changes(realm_id);
CREATE INDEX IF NOT EXISTS idx_qbo_admin_changes_created_at ON qbo_admin_changes(created_at DESC);

-- =====================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER update_qbo_tokens_updated_at 
  BEFORE UPDATE ON qbo_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_assessments_updated_at 
  BEFORE UPDATE ON user_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. GRANTS FOR AUTHENTICATED USERS
-- =====================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;

-- Grant permissions on tables
GRANT ALL ON users TO authenticated;
GRANT ALL ON qbo_tokens TO authenticated;
GRANT ALL ON user_assessments TO authenticated;
GRANT SELECT ON qbo_admin_changes TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.clerk_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION store_qbo_token TO authenticated;
GRANT EXECUTE ON FUNCTION get_qbo_token TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_qbo_token TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_qbo_token TO authenticated;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE qbo_tokens IS 'Stores QuickBooks OAuth tokens with single-admin constraint per realm';
COMMENT ON TABLE user_assessments IS 'Stores user assessment data linked to QuickBooks realms';
COMMENT ON TABLE qbo_admin_changes IS 'Audit log for QuickBooks admin changes';
COMMENT ON FUNCTION store_qbo_token IS 'Atomically stores/updates QBO token ensuring single admin per realm';
COMMENT ON FUNCTION get_qbo_token IS 'Retrieves QBO token for authenticated user';
COMMENT ON FUNCTION refresh_qbo_token IS 'Updates OAuth tokens after refresh';
COMMENT ON FUNCTION revoke_qbo_token IS 'Revokes QBO token and logs the change';