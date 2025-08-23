# Clerk JWT Integration with Supabase Setup Guide

## Overview

This guide explains how to configure Clerk JWT authentication with Supabase RLS policies for the QuickBooks integration system.

## Prerequisites

- Clerk account and application
- Supabase project
- Access to both dashboards

## Step 1: Configure Clerk JWT Template

### 1.1 Access Clerk Dashboard

1. Go to your Clerk Dashboard
2. Navigate to **JWT Templates**
3. Click **New Template**
4. Name it `supabase`

### 1.2 Configure JWT Claims

Add the following claims to your JWT template:

```json
{
  "sub": "{{user.id}}",
  "email": "{{user.primary_email_address.email_address}}",
  "clerk_user_id": "{{user.id}}",
  "iat": "{{issued_at}}",
  "exp": "{{expires_at}}",
  "aud": "YOUR_SUPABASE_PROJECT_URL"
}
```

### 1.3 Get Your Clerk Public Key

1. In Clerk Dashboard, go to **API Keys**
2. Click **Show JWT public key**
3. Copy the RSA public key (including BEGIN/END markers)

## Step 2: Configure Supabase

### 2.1 Update JWT Secret in Supabase

Run this SQL in Supabase SQL Editor:

```sql
-- Update with your actual Clerk public key
UPDATE auth.jwt_secrets 
SET 
  secret = '-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA... (your key here)
-----END PUBLIC KEY-----',
  issuer = 'https://your-clerk-instance.clerk.accounts.dev',
  audience = ARRAY['YOUR_SUPABASE_PROJECT_URL']
WHERE is_active = true;
```

### 2.2 Enable Required Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2.3 Run Migration Scripts

Execute the migration scripts in order:

1. `001_clerk_jwt_infrastructure.sql` - Sets up JWT validation and tables
2. `002_migration_strategy.sql` - Handles data migration and RLS enablement

## Step 3: Environment Configuration

### 3.1 Frontend Environment Variables

Update your `.env` file:

```env
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CLERK_FRONTEND_API=https://your-instance.clerk.accounts.dev

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# QuickBooks
VITE_QBO_CLIENT_ID=your_qbo_client_id
VITE_QBO_REDIRECT_URI=http://localhost:5173/callback
VITE_QBO_API_BASE_URL=http://localhost:3001/api/quickbooks
```

### 3.2 Backend Environment Variables

For your server (if separate):

```env
# Supabase (Service Key for backend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ... (service role key)

# Clerk (for backend validation if needed)
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_KEY=-----BEGIN PUBLIC KEY-----...
```

## Step 4: Frontend Integration

### 4.1 Setup Clerk Provider

```tsx
// main.tsx or App.tsx
import { ClerkProvider } from '@clerk/clerk-react';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      {/* Your app */}
    </ClerkProvider>
  );
}
```

### 4.2 Use Supabase with Clerk JWT

```tsx
// In your components
import { useQBOServices } from './lib/supabase-clerk';

function MyComponent() {
  const { services, isLoaded, isSignedIn } = useQBOServices();
  
  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Please sign in</div>;
  
  // Use services
  const handleStoreToken = async () => {
    const result = await services.tokens.storeToken({
      realm_id: 'company123',
      access_token: 'token...',
      refresh_token: 'refresh...',
      expires_at: new Date(Date.now() + 3600000),
      company_name: 'My Company',
    });
    
    console.log('Token stored:', result);
  };
  
  return <button onClick={handleStoreToken}>Store Token</button>;
}
```

## Step 5: Testing RLS Policies

### 5.1 Test User Isolation

```sql
-- As a superuser, verify RLS is working
SET LOCAL "request.jwt.claim" = '{"sub": "user_123", "clerk_user_id": "user_123"}';
SELECT * FROM qbo_tokens; -- Should only see user_123's tokens

SET LOCAL "request.jwt.claim" = '{"sub": "user_456", "clerk_user_id": "user_456"}';
SELECT * FROM qbo_tokens; -- Should only see user_456's tokens
```

### 5.2 Test Single-Admin Constraint

```sql
-- Try to insert duplicate realm_id with different user
-- This should fail due to RLS policy
SET LOCAL "request.jwt.claim" = '{"sub": "user_456", "clerk_user_id": "user_456"}';
INSERT INTO qbo_tokens (realm_id, clerk_user_id, access_token, refresh_token, expires_at)
VALUES ('existing_realm', 'user_456', 'token', 'refresh', NOW() + INTERVAL '1 hour');
-- Should fail if realm already has user_123 as admin
```

### 5.3 Validate Migration

```sql
-- Run validation function
SELECT * FROM validate_rls_implementation();
```

## Step 6: Migration Execution

### 6.1 Backup Database

```bash
pg_dump your_database > backup_before_rls.sql
```

### 6.2 Execute Migration

```sql
BEGIN;
  -- Run migration
  SELECT execute_rls_migration();
  
  -- Check results
  SELECT * FROM validate_rls_implementation();
  
  -- If all tests pass:
  COMMIT;
  -- If any issues:
  -- ROLLBACK;
```

### 6.3 Cleanup Migration Functions

After successful migration:

```sql
DROP FUNCTION IF EXISTS auth.migration_bypass();
DROP POLICY IF EXISTS "migration_bypass_users" ON users;
DROP POLICY IF EXISTS "migration_bypass_qbo_tokens" ON qbo_tokens;
DROP POLICY IF EXISTS "migration_bypass_assessments" ON user_assessments;
```

## Step 7: Monitoring & Troubleshooting

### 7.1 Monitor Admin Changes

```sql
-- View recent admin changes
SELECT * FROM qbo_admin_changes 
ORDER BY created_at DESC 
LIMIT 10;
```

### 7.2 Check Token Status

```sql
-- Check expired tokens
SELECT realm_id, clerk_user_id, expires_at 
FROM qbo_tokens 
WHERE expires_at < NOW();
```

### 7.3 Debug RLS Issues

```sql
-- Check current user context
SELECT auth.clerk_user_id();

-- Check JWT claims
SELECT auth.jwt();

-- Test RLS policies
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM qbo_tokens;
```

## Common Issues & Solutions

### Issue 1: JWT Validation Fails

**Symptom**: `auth.clerk_user_id()` returns NULL

**Solution**:
1. Verify Clerk public key is correctly set in `auth.jwt_secrets`
2. Check JWT token is being passed in Authorization header
3. Verify token hasn't expired

### Issue 2: RLS Policy Blocks Legitimate Access

**Symptom**: User can't see their own data

**Solution**:
1. Check `clerk_id` in users table matches JWT `sub` claim
2. Verify RLS policies are correctly defined
3. Test with `SET LOCAL` to simulate user context

### Issue 3: Admin Transfer Not Working

**Symptom**: `store_qbo_token` fails for realm transfer

**Solution**:
1. Verify the function has SECURITY DEFINER
2. Check that previous admin's token is not locked
3. Review `qbo_admin_changes` for history

### Issue 4: Performance Degradation

**Symptom**: Queries slower after RLS enablement

**Solution**:
1. Ensure indexes exist on `clerk_user_id` and `realm_id`
2. Analyze query plans with EXPLAIN
3. Consider materialized views for complex queries

## Security Best Practices

1. **Never expose service keys in frontend code**
2. **Always validate JWT signatures**
3. **Implement token refresh before expiration**
4. **Log all admin changes for audit trail**
5. **Use HTTPS for all API calls**
6. **Implement rate limiting on RPC functions**
7. **Regular security audits of RLS policies**

## Maintenance Tasks

### Weekly
- Review `qbo_admin_changes` for suspicious activity
- Check for expired tokens that need cleanup

### Monthly
- Analyze query performance with pg_stat_statements
- Review and optimize slow queries
- Update JWT secrets if needed

### Quarterly
- Full RLS policy audit
- Security penetration testing
- Database performance tuning

## Support Resources

- [Clerk Documentation](https://clerk.dev/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT.io Debugger](https://jwt.io/) - For testing JWT tokens