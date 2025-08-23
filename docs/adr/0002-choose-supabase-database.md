# ADR-0002: Choose Supabase for Database and Real-time Infrastructure

## Status
Accepted

## Date
2024-01-18

## Context

The QuickBooks Analyzer application requires a robust data persistence layer that can:

- Store and query complex financial data structures from QuickBooks
- Handle multi-tenant data isolation for different CPA firms and their clients
- Provide real-time synchronization for collaborative features
- Scale horizontally as user base grows
- Ensure data security and compliance with financial regulations
- Support flexible schema evolution as QuickBooks API changes
- Enable rapid development with minimal backend infrastructure
- Provide cost-effective hosting for a startup budget

Key requirements include:
- **Performance**: Sub-second query response for financial reports
- **Security**: SOC 2 compliance capability, encryption at rest and in transit
- **Flexibility**: Store varied QuickBooks data structures without rigid schemas
- **Multi-tenancy**: Strict data isolation between different CPA firms
- **Real-time**: Live updates when QuickBooks data changes
- **Developer Experience**: Quick setup and iteration cycles

## Decision

We will use Supabase as our database and backend infrastructure provider, leveraging:

- **PostgreSQL**: As the underlying database engine
- **Row Level Security (RLS)**: For multi-tenant data isolation
- **JSONB columns**: For flexible financial data storage
- **Real-time subscriptions**: For live data updates
- **Auto-generated APIs**: REST and GraphQL endpoints
- **Built-in authentication**: JWT-based auth integration

## Alternatives Considered

### 1. Firebase (Firestore)
**Pros:**
- Excellent real-time capabilities
- Strong offline support
- Simple NoSQL model
- Generous free tier
- Google Cloud integration

**Cons:**
- NoSQL limitations for complex financial queries
- No SQL joins for relational data
- Expensive at scale with financial data volumes
- Limited aggregation capabilities
- Vendor lock-in to Google Cloud
- Difficult to migrate away from proprietary structure

### 2. AWS RDS PostgreSQL with Custom Backend
**Pros:**
- Full control over database configuration
- Proven enterprise scalability
- Multiple availability zones
- Automated backups and point-in-time recovery
- Can optimize for specific workloads

**Cons:**
- Requires building entire backend API layer
- No built-in real-time capabilities
- Higher operational overhead
- More expensive for small-scale applications
- Longer development timeline
- Need to implement RLS manually

### 3. MongoDB Atlas
**Pros:**
- Flexible document model for varied QuickBooks data
- Built-in sharding for horizontal scaling
- Change streams for real-time updates
- Good for unstructured financial data
- Time-series collections for historical data

**Cons:**
- Lack of ACID transactions across documents
- Complex aggregation pipeline for financial reports
- No native Row Level Security
- Higher learning curve for SQL-experienced team
- Less mature ecosystem for financial applications

### 4. PlanetScale (MySQL)
**Pros:**
- Serverless MySQL with automatic scaling
- Git-like branching for schema changes
- Excellent performance with Vitess
- Non-blocking schema migrations

**Cons:**
- MySQL limitations vs PostgreSQL features
- No native JSONB support
- Limited real-time capabilities
- Foreign key constraints limitations
- Less suitable for complex financial queries

### 5. Hasura with PostgreSQL
**Pros:**
- Instant GraphQL APIs
- Excellent real-time subscriptions
- Fine-grained authorization
- Works with existing PostgreSQL

**Cons:**
- Additional service to manage
- GraphQL-only (no REST without additional work)
- Learning curve for GraphQL
- Requires separate PostgreSQL hosting

## Rationale

Supabase provides the optimal solution for our requirements:

1. **PostgreSQL Foundation**: Battle-tested relational database with JSONB support perfectly balances structure and flexibility for financial data

2. **Built-in Security**: Row Level Security (RLS) policies provide enterprise-grade multi-tenancy without custom middleware

3. **Developer Velocity**: Auto-generated APIs, real-time subscriptions, and authentication eliminate months of backend development

4. **Cost Efficiency**: Transparent pricing model scales predictably with usage, generous free tier for development

5. **Open Source**: Built on open-source technologies (PostgreSQL, PostgREST), avoiding vendor lock-in

6. **Financial Data Suitability**: 
   - ACID compliance for transaction integrity
   - Complex JOIN operations for financial reports
   - JSONB for flexible QuickBooks data structures
   - Materialized views for report optimization

7. **Operational Excellence**: Automated backups, point-in-time recovery, and monitoring included

## Consequences

### Positive Consequences

1. **Rapid Development**: REST APIs auto-generated from schema, saving 2-3 months of backend development
2. **Security by Default**: RLS policies ensure data isolation without application-layer checks
3. **Real-time Features**: WebSocket connections enable live financial dashboard updates
4. **Schema Flexibility**: JSONB columns handle varying QuickBooks response structures
5. **SQL Power**: Complex financial queries, aggregations, and window functions available
6. **Scalability Path**: Can scale to millions of records with read replicas and connection pooling
7. **Compliance Ready**: Infrastructure supports SOC 2, HIPAA compliance requirements
8. **Cost Predictable**: Usage-based pricing with no surprise costs

### Negative Consequences

1. **Service Dependency**: Reliance on Supabase's availability and performance
2. **Learning Curve**: Team needs to understand RLS policies and PostgreSQL features
3. **Migration Complexity**: Moving away requires migrating RLS policies to application layer
4. **Limited Customization**: Some advanced PostgreSQL extensions not available
5. **Connection Limits**: Pooling required for high concurrent user counts
6. **Regional Limitations**: Data residency limited to Supabase's available regions

## Implementation Considerations

### Database Schema Design
```sql
-- Example: Financial reports table with JSONB
CREATE TABLE financial_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  report_type TEXT NOT NULL,
  raw_data JSONB,        -- Flexible QuickBooks data
  ai_analysis TEXT,      -- Perplexity analysis results
  perplexity_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for JSONB queries
CREATE INDEX idx_raw_data_gin ON financial_reports 
  USING gin (raw_data);
```

### Row Level Security Implementation
```sql
-- Multi-tenant isolation
CREATE POLICY "Users see own company data" 
  ON financial_reports
  FOR SELECT 
  USING (company_id IN (
    SELECT id FROM companies 
    WHERE user_id = auth.jwt() ->> 'clerk_id'
  ));
```

### Real-time Subscriptions
```typescript
// Listen for report updates
const subscription = supabase
  .channel('report-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'financial_reports',
    filter: `company_id=eq.${companyId}`
  }, handleReportChange)
  .subscribe();
```

### Performance Optimizations
- Connection pooling with PgBouncer (built-in)
- Materialized views for complex report queries
- Partial indexes for common query patterns
- Table partitioning for historical data

### Security Measures
- Enable RLS on all tables
- Use service role key only in server-side functions
- Implement rate limiting for API calls
- Regular security audits of RLS policies
- Encrypted connections (SSL/TLS required)

## Related Decisions

- **ADR-0001**: React app uses Supabase JS client for data fetching
- **ADR-0003**: Clerk authentication integrates with Supabase RLS via JWTs
- **ADR-0006**: QuickBooks OAuth tokens stored securely in Supabase
- **ADR-0008**: JSONB storage strategy for financial data
- **ADR-0009**: RLS implementation for multi-tenancy

## Migration Strategy

If we need to migrate away from Supabase:
1. PostgreSQL database can be exported completely
2. RLS policies would move to application middleware
3. Real-time features would use WebSocket libraries
4. REST APIs would be implemented with Express/Fastify
5. Data remains in standard PostgreSQL format

## Performance Benchmarks

Expected performance metrics:
- Simple queries: < 50ms
- Complex financial reports: < 500ms
- Real-time updates: < 100ms latency
- API response time: < 200ms p95
- Concurrent connections: 10,000+ with pooling

## Cost Analysis

Monthly costs for expected usage:
- **Free Tier**: 0-500 users, 500MB database
- **Pro Tier ($25/month)**: 500-5,000 users, 8GB database
- **Team Tier ($599/month)**: 5,000-50,000 users, 100GB database
- Additional costs: Bandwidth ($0.09/GB), Storage ($0.125/GB/month)

## References

- [Supabase Architecture](https://supabase.com/docs/guides/architecture)
- [PostgreSQL JSONB Performance](https://www.postgresql.org/docs/current/datatype-json.html)
- [Row Level Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase vs Firebase Comparison](https://supabase.com/alternatives/supabase-vs-firebase)

## Review and Approval

- **Proposed by**: Technical Lead
- **Reviewed by**: Data Scientist, Operations Specialist
- **Approved by**: Project Stakeholders
- **Review Date**: 2024-01-18