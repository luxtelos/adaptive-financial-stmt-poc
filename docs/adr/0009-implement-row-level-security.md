# ADR-0009: Implement Row-Level Security for Multi-Tenancy

## Status
Accepted

## Context

### Business Requirements
The QuickBooks Analyzer serves multiple CPA firms and their clients, requiring strict data isolation:
- Each user can only access their own financial data
- CPA firms may have multiple users accessing shared client data
- Users may belong to multiple organizations
- Audit trail required for compliance
- Zero data leakage between tenants

### Security Requirements
- Prevent accidental data exposure through application bugs
- Database-level enforcement of access controls
- Support for user impersonation (for support)
- Compliance with SOC 2 and data privacy regulations
- Protection against SQL injection attacks

## Decision

We will implement PostgreSQL Row-Level Security (RLS) policies in Supabase to enforce data isolation at the database level, ensuring users can only access data they own or have been granted access to.

### RLS Implementation Strategy

```sql
-- Enable RLS on all tables containing user data
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbo_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Force RLS for all connections
ALTER TABLE financial_reports FORCE ROW LEVEL SECURITY;
```

## Alternatives Considered

### 1. Application-Level Security Only
- **Pros**: Flexible logic, easier debugging, familiar to developers
- **Cons**: Vulnerable to bugs, SQL injection, requires trust in all code
- **Rejected**: Insufficient security for financial data

### 2. Separate Databases per Tenant
- **Pros**: Complete isolation, easy backup/restore per tenant
- **Cons**: Complex management, expensive, difficult cross-tenant features
- **Rejected**: Doesn't scale cost-effectively

### 3. Schema-per-Tenant
- **Pros**: Good isolation, easier than separate databases
- **Cons**: Complex migrations, connection pool issues, PostgreSQL limitations
- **Rejected**: Operational complexity outweighs benefits

### 4. Tenant ID Column Without RLS
- **Pros**: Simple implementation, common pattern
- **Cons**: Relies on application code, vulnerable to mistakes
- **Rejected**: Not secure enough for financial data

### 5. Views with Security Definer
- **Pros**: Can implement complex logic
- **Cons**: Performance overhead, complex maintenance
- **Rejected**: RLS is more straightforward and performant

## Rationale

### Why Row-Level Security?

1. **Database-Level Enforcement**: Security enforced regardless of application code
2. **Zero Trust**: Even if application is compromised, data remains protected
3. **Automatic**: No need to remember WHERE clauses in queries
4. **Performance**: PostgreSQL optimizes RLS policies efficiently
5. **Audit Compliance**: Meets regulatory requirements for data isolation
6. **Supabase Integration**: Native support with auth.uid() function

## Implementation Details

### Basic RLS Policies

```sql
-- Users can only see their own financial reports
CREATE POLICY "Users can view own reports"
  ON financial_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON financial_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON financial_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON financial_reports FOR DELETE
  USING (auth.uid() = user_id);
```

### Organization-Based Access

```sql
-- Organization membership table
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'owner', 'admin', 'member', 'viewer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- RLS for organization data
CREATE POLICY "Organization members can view data"
  ON financial_reports FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = financial_reports.organization_id
    )
  );
```

### Role-Based Permissions

```sql
-- Function to check user role
CREATE OR REPLACE FUNCTION user_has_role(required_role VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin-only policy
CREATE POLICY "Admins can manage all reports"
  ON financial_reports FOR ALL
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));
```

### Audit Trail with RLS

```sql
-- Audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Users can only view their own audit logs
CREATE POLICY "Users view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert audit logs
CREATE POLICY "System inserts audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true); -- Allows trigger-based inserts
```

### Bypassing RLS for Admin Operations

```sql
-- Service role for administrative tasks
CREATE ROLE service_role_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role_admin;

-- Bypass RLS for service role
ALTER TABLE financial_reports OWNER TO service_role_admin;
GRANT ALL ON financial_reports TO authenticated;

-- Function for admin operations
CREATE OR REPLACE FUNCTION admin_delete_user_data(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only super admins can call this
  IF NOT user_has_role('super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Delete with elevated privileges
  DELETE FROM financial_reports WHERE user_id = target_user_id;
  DELETE FROM qbo_connections WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Consequences

### Positive
- ✅ Database-level security prevents data leaks
- ✅ Automatic enforcement on all queries
- ✅ Compliance with security regulations
- ✅ Protection against SQL injection
- ✅ No performance penalty with proper indexes
- ✅ Transparent to application code
- ✅ Audit trail for all access attempts

### Negative
- ❌ Complex policies can be hard to debug
- ❌ Testing requires careful user context setup
- ❌ Migrations must consider RLS policies
- ❌ Some ORMs have limited RLS support
- ❌ Batch operations become more complex
- ❌ Performance impact if policies are poorly written

## Testing Strategy

```typescript
// Test RLS policies
describe('Row Level Security', () => {
  it('should prevent cross-user data access', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    
    // User 1 creates a report
    const { data: report } = await supabase
      .auth.signIn(user1)
      .from('financial_reports')
      .insert({ /* ... */ });
    
    // User 2 tries to access it
    const { data, error } = await supabase
      .auth.signIn(user2)
      .from('financial_reports')
      .select()
      .eq('id', report.id);
    
    expect(data).toBeNull();
    expect(error).toBeDefined();
  });
});
```

## Performance Considerations

```sql
-- Indexes for RLS policy performance
CREATE INDEX idx_financial_reports_user_id ON financial_reports(user_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);

-- Analyze policy performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM financial_reports 
WHERE user_id = 'current-user-id';
```

## Monitoring and Maintenance

### Monitoring Queries

```sql
-- Check for RLS bypass attempts
SELECT 
  user_id,
  COUNT(*) as access_attempts,
  COUNT(CASE WHEN error_code = 'insufficient_privilege' THEN 1 END) as denied
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY user_id
HAVING COUNT(CASE WHEN error_code = 'insufficient_privilege' THEN 1 END) > 10;

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

## Migration and Rollback

### Enabling RLS on Existing Tables

```sql
-- Safe migration approach
BEGIN;
  -- Create policies first
  CREATE POLICY "temp_allow_all" ON financial_reports FOR ALL USING (true);
  
  -- Enable RLS
  ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
  
  -- Replace with real policies
  DROP POLICY "temp_allow_all" ON financial_reports;
  CREATE POLICY "Users can view own reports" ON financial_reports ...;
  
  -- Test before committing
  -- Run test queries here
COMMIT;
```

## Related ADRs

- [ADR-0002](0002-choose-supabase-database.md): PostgreSQL and Supabase choice
- [ADR-0003](0003-implement-clerk-authentication.md): Authentication integration
- [ADR-0008](0008-store-data-jsonb.md): Data storage patterns

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-Tenant Security Patterns](https://www.citusdata.com/blog/2018/08/22/multi-tenant-security/)