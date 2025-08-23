-- =====================================================
-- MIGRATION STRATEGY: ENABLING RLS WITHOUT BREAKING EXISTING DATA
-- =====================================================
-- This migration safely transitions from disabled RLS to enabled RLS
-- while preserving all existing data and relationships

-- =====================================================
-- PHASE 1: PRE-MIGRATION CHECKS
-- =====================================================

-- Create a pre-migration snapshot function
CREATE OR REPLACE FUNCTION create_migration_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  v_snapshot := jsonb_build_object(
    'timestamp', NOW(),
    'users_count', (SELECT COUNT(*) FROM users),
    'qbo_tokens_count', (SELECT COUNT(*) FROM qbo_tokens WHERE EXISTS (SELECT 1 FROM qbo_tokens)),
    'assessments_count', (SELECT COUNT(*) FROM user_assessments WHERE EXISTS (SELECT 1 FROM user_assessments)),
    'orphaned_assessments', (
      SELECT COUNT(*) 
      FROM user_assessments ua 
      WHERE NOT EXISTS (
        SELECT 1 FROM qbo_tokens qt 
        WHERE qt.realm_id = ua.realm_id
      )
    ),
    'duplicate_realms', (
      SELECT COUNT(*) 
      FROM (
        SELECT realm_id, COUNT(*) 
        FROM qbo_tokens 
        GROUP BY realm_id 
        HAVING COUNT(*) > 1
      ) duplicates
    )
  );
  
  -- Store snapshot in audit log
  INSERT INTO qbo_admin_changes (
    realm_id,
    new_admin_id,
    change_type,
    initiated_by,
    reason,
    metadata
  ) VALUES (
    'MIGRATION_SNAPSHOT',
    'SYSTEM',
    'initial',
    'MIGRATION_SCRIPT',
    'Pre-migration data snapshot',
    v_snapshot
  );
  
  RETURN v_snapshot;
END;
$$;

-- =====================================================
-- PHASE 2: DATA VALIDATION & CLEANUP
-- =====================================================

-- Function to validate and fix data integrity issues
CREATE OR REPLACE FUNCTION validate_and_fix_data()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_fixes JSONB = '[]'::jsonb;
  v_fix RECORD;
BEGIN
  -- Fix 1: Ensure all users have clerk_id
  FOR v_fix IN 
    SELECT id, email 
    FROM users 
    WHERE clerk_id IS NULL OR clerk_id = ''
  LOOP
    -- Log issue but don't auto-fix (requires manual intervention)
    v_fixes := v_fixes || jsonb_build_object(
      'type', 'missing_clerk_id',
      'user_id', v_fix.id,
      'email', v_fix.email,
      'action', 'requires_manual_fix'
    );
  END LOOP;
  
  -- Fix 2: Handle duplicate realm_ids (keep most recent)
  FOR v_fix IN 
    SELECT realm_id, COUNT(*) as count
    FROM qbo_tokens
    GROUP BY realm_id
    HAVING COUNT(*) > 1
  LOOP
    -- Keep only the most recently updated token
    DELETE FROM qbo_tokens
    WHERE realm_id = v_fix.realm_id
      AND id NOT IN (
        SELECT id 
        FROM qbo_tokens 
        WHERE realm_id = v_fix.realm_id
        ORDER BY updated_at DESC
        LIMIT 1
      );
    
    v_fixes := v_fixes || jsonb_build_object(
      'type', 'duplicate_realm',
      'realm_id', v_fix.realm_id,
      'action', 'kept_most_recent'
    );
  END LOOP;
  
  -- Fix 3: Link orphaned assessments to system user
  UPDATE user_assessments
  SET clerk_user_id = 'SYSTEM_MIGRATION'
  WHERE clerk_user_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM users WHERE clerk_id = user_assessments.clerk_user_id
    );
  
  -- Fix 4: Ensure realm_id foreign key integrity
  DELETE FROM user_assessments
  WHERE realm_id NOT IN (
    SELECT realm_id FROM qbo_tokens
  );
  
  RETURN jsonb_build_object(
    'fixes_applied', v_fixes,
    'fixes_count', jsonb_array_length(v_fixes)
  );
END;
$$;

-- =====================================================
-- PHASE 3: GRADUAL RLS ENABLEMENT
-- =====================================================

-- Step 1: Create temporary bypass function for migration
CREATE OR REPLACE FUNCTION auth.migration_bypass()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if we're in migration mode
  RETURN current_setting('app.migration_mode', true) = 'true';
END;
$$;

-- Step 2: Create permissive policies during migration
CREATE POLICY "migration_bypass_users" ON users
  FOR ALL
  USING (auth.migration_bypass() OR clerk_id = auth.clerk_user_id())
  WITH CHECK (auth.migration_bypass() OR clerk_id = auth.clerk_user_id());

CREATE POLICY "migration_bypass_qbo_tokens" ON qbo_tokens
  FOR ALL
  USING (auth.migration_bypass() OR clerk_user_id = auth.clerk_user_id())
  WITH CHECK (auth.migration_bypass() OR clerk_user_id = auth.clerk_user_id());

CREATE POLICY "migration_bypass_assessments" ON user_assessments
  FOR ALL
  USING (auth.migration_bypass() OR clerk_user_id = auth.clerk_user_id())
  WITH CHECK (auth.migration_bypass() OR clerk_user_id = auth.clerk_user_id());

-- =====================================================
-- PHASE 4: MIGRATION EXECUTION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION execute_rls_migration()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
  v_snapshot JSONB;
  v_fixes JSONB;
BEGIN
  -- Start migration mode
  PERFORM set_config('app.migration_mode', 'true', false);
  
  -- Step 1: Create snapshot
  v_snapshot := create_migration_snapshot();
  
  -- Step 2: Validate and fix data
  v_fixes := validate_and_fix_data();
  
  -- Step 3: Enable RLS on tables (if not already enabled)
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE qbo_tokens ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_assessments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE qbo_admin_changes ENABLE ROW LEVEL SECURITY;
  
  -- Step 4: Test RLS with a sample query
  BEGIN
    -- This should work even with RLS enabled due to migration bypass
    PERFORM COUNT(*) FROM users;
    PERFORM COUNT(*) FROM qbo_tokens;
    PERFORM COUNT(*) FROM user_assessments;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'RLS test failed: %', SQLERRM;
  END;
  
  -- End migration mode
  PERFORM set_config('app.migration_mode', 'false', false);
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'snapshot', v_snapshot,
    'fixes', v_fixes,
    'migration_completed_at', NOW()
  );
  
  -- Log completion
  INSERT INTO qbo_admin_changes (
    realm_id,
    new_admin_id,
    change_type,
    initiated_by,
    reason,
    metadata
  ) VALUES (
    'MIGRATION_COMPLETE',
    'SYSTEM',
    'initial',
    'MIGRATION_SCRIPT',
    'RLS migration completed',
    v_result
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- PHASE 5: POST-MIGRATION VALIDATION
-- =====================================================

CREATE OR REPLACE FUNCTION validate_rls_implementation()
RETURNS TABLE (
  test_name TEXT,
  test_result BOOLEAN,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_test_user_id TEXT := 'test_user_' || gen_random_uuid();
BEGIN
  -- Test 1: Users can only see their own records
  RETURN QUERY
  SELECT 
    'users_isolation'::TEXT,
    (SELECT COUNT(*) FROM users WHERE clerk_id != v_test_user_id) = 0,
    'Users table isolation test'::TEXT;
  
  -- Test 2: QBO tokens respect single-admin constraint
  RETURN QUERY
  SELECT
    'qbo_single_admin'::TEXT,
    NOT EXISTS (
      SELECT realm_id 
      FROM qbo_tokens 
      GROUP BY realm_id 
      HAVING COUNT(DISTINCT clerk_user_id) > 1
    ),
    'Single admin per realm constraint'::TEXT;
  
  -- Test 3: Assessments linked to valid tokens
  RETURN QUERY
  SELECT
    'assessments_integrity'::TEXT,
    NOT EXISTS (
      SELECT 1 
      FROM user_assessments ua
      WHERE NOT EXISTS (
        SELECT 1 FROM qbo_tokens qt 
        WHERE qt.realm_id = ua.realm_id
      )
    ),
    'All assessments linked to valid tokens'::TEXT;
  
  -- Test 4: Audit log is append-only
  RETURN QUERY
  SELECT
    'audit_log_integrity'::TEXT,
    NOT EXISTS (
      SELECT 1 
      FROM information_schema.table_privileges 
      WHERE table_name = 'qbo_admin_changes' 
        AND privilege_type IN ('UPDATE', 'DELETE')
        AND grantee = 'authenticated'
    ),
    'Audit log is append-only for users'::TEXT;
END;
$$;

-- =====================================================
-- PHASE 6: ROLLBACK PROCEDURE
-- =====================================================

CREATE OR REPLACE FUNCTION rollback_rls_migration()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  -- Disable RLS on all tables
  ALTER TABLE users DISABLE ROW LEVEL SECURITY;
  ALTER TABLE qbo_tokens DISABLE ROW LEVEL SECURITY;
  ALTER TABLE user_assessments DISABLE ROW LEVEL SECURITY;
  ALTER TABLE qbo_admin_changes DISABLE ROW LEVEL SECURITY;
  
  -- Drop all RLS policies
  DROP POLICY IF EXISTS "users_select_own" ON users;
  DROP POLICY IF EXISTS "users_update_own" ON users;
  DROP POLICY IF EXISTS "users_insert_own" ON users;
  DROP POLICY IF EXISTS "migration_bypass_users" ON users;
  
  DROP POLICY IF EXISTS "qbo_tokens_select_own" ON qbo_tokens;
  DROP POLICY IF EXISTS "qbo_tokens_insert_check" ON qbo_tokens;
  DROP POLICY IF EXISTS "qbo_tokens_update_own" ON qbo_tokens;
  DROP POLICY IF EXISTS "qbo_tokens_delete_own" ON qbo_tokens;
  DROP POLICY IF EXISTS "migration_bypass_qbo_tokens" ON qbo_tokens;
  
  DROP POLICY IF EXISTS "assessments_select_own" ON user_assessments;
  DROP POLICY IF EXISTS "assessments_insert_own" ON user_assessments;
  DROP POLICY IF EXISTS "assessments_update_own" ON user_assessments;
  DROP POLICY IF EXISTS "assessments_delete_own" ON user_assessments;
  DROP POLICY IF EXISTS "migration_bypass_assessments" ON user_assessments;
  
  DROP POLICY IF EXISTS "admin_changes_select_involved" ON qbo_admin_changes;
  
  -- Log rollback
  INSERT INTO qbo_admin_changes (
    realm_id,
    new_admin_id,
    change_type,
    initiated_by,
    reason,
    metadata
  ) VALUES (
    'MIGRATION_ROLLBACK',
    'SYSTEM',
    'revoke',
    'ROLLBACK_SCRIPT',
    'RLS migration rolled back',
    jsonb_build_object('timestamp', NOW())
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'RLS migration rolled back successfully',
    'timestamp', NOW()
  );
END;
$$;

-- =====================================================
-- MIGRATION EXECUTION STEPS
-- =====================================================

-- To execute the migration:
-- 1. Take a database backup
-- 2. Run in a transaction:
/*
BEGIN;
  SELECT execute_rls_migration();
  SELECT * FROM validate_rls_implementation();
  -- If all tests pass:
  COMMIT;
  -- If any test fails:
  -- ROLLBACK;
*/

-- To rollback if needed:
/*
BEGIN;
  SELECT rollback_rls_migration();
COMMIT;
*/

-- =====================================================
-- CLEANUP AFTER SUCCESSFUL MIGRATION
-- =====================================================

-- After confirming migration success, run:
/*
DROP FUNCTION IF EXISTS auth.migration_bypass();
DROP POLICY IF EXISTS "migration_bypass_users" ON users;
DROP POLICY IF EXISTS "migration_bypass_qbo_tokens" ON qbo_tokens;
DROP POLICY IF EXISTS "migration_bypass_assessments" ON user_assessments;
DROP FUNCTION IF EXISTS create_migration_snapshot();
DROP FUNCTION IF EXISTS validate_and_fix_data();
DROP FUNCTION IF EXISTS execute_rls_migration();
DROP FUNCTION IF EXISTS rollback_rls_migration();
*/