# ADR-0008: Store Financial Data as JSONB in PostgreSQL

## Status
Accepted

## Context

### Business Requirements
The QuickBooks Analyzer needs to store complex, hierarchical financial data from various QuickBooks reports:
- Profit & Loss statements with nested categories
- Balance sheets with multi-level account structures
- Cash flow statements with various sections
- Aging reports with dynamic columns
- Custom fields that vary by company
- AI analysis results with flexible structure

### Technical Constraints
- Data structure varies significantly between companies
- QuickBooks API returns deeply nested JSON
- Need to query specific financial metrics
- Must support data evolution without migrations
- Require efficient storage and retrieval
- Need to maintain data integrity

## Decision

We will use PostgreSQL's JSONB data type to store financial report data, combining the flexibility of document storage with the power of relational database features.

### Database Schema

```sql
-- Financial reports storage
CREATE TABLE financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL, -- 'P&L', 'BalanceSheet', 'CashFlow', etc.
  report_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  raw_data JSONB NOT NULL,        -- Original QuickBooks response
  normalized_data JSONB,           -- Standardized structure
  metrics JSONB,                   -- Calculated metrics for quick access
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Indexes for common queries
  CONSTRAINT unique_report UNIQUE (company_id, report_type, period_start, period_end)
);

-- JSONB indexes for performance
CREATE INDEX idx_financial_reports_metrics ON financial_reports USING GIN (metrics);
CREATE INDEX idx_financial_reports_company ON financial_reports(company_id);
CREATE INDEX idx_financial_reports_date ON financial_reports(report_date);
CREATE INDEX idx_financial_reports_type ON financial_reports(report_type);

-- Specific JSON path indexes
CREATE INDEX idx_metrics_revenue ON financial_reports ((metrics->>'total_revenue'));
CREATE INDEX idx_metrics_net_income ON financial_reports ((metrics->>'net_income'));
```

### JSONB Structure Examples

```json
// normalized_data structure
{
  "revenue": {
    "total": 500000,
    "categories": [
      {
        "name": "Product Sales",
        "amount": 350000,
        "percentage": 70,
        "accounts": [
          {"id": "79", "name": "Product Revenue", "amount": 350000}
        ]
      }
    ]
  },
  "expenses": {
    "total": 350000,
    "categories": [/* ... */]
  },
  "net_income": 150000
}

// metrics structure for quick queries
{
  "total_revenue": 500000,
  "total_expenses": 350000,
  "net_income": 150000,
  "gross_margin": 0.60,
  "net_margin": 0.30,
  "expense_ratio": 0.70
}
```

## Alternatives Considered

### 1. Traditional Normalized Tables
- **Pros**: Strong schema, referential integrity, familiar SQL
- **Cons**: Complex migrations, rigid structure, many joins
- **Rejected**: Too inflexible for varied financial structures

### 2. MongoDB (Document Database)
- **Pros**: Native JSON, flexible schema, good for documents
- **Cons**: Separate database, less powerful queries, no transactions with PostgreSQL
- **Rejected**: Adds complexity, loses PostgreSQL benefits

### 3. PostgreSQL JSON (not JSONB)
- **Pros**: Stores exact JSON format
- **Cons**: No indexing, slower queries, larger storage
- **Rejected**: JSONB offers better performance

### 4. Separate Tables per Report Type
- **Pros**: Type-specific schemas, clear structure
- **Cons**: Many tables, complex maintenance, hard to query across
- **Rejected**: Too much complexity for marginal benefit

### 5. Key-Value Store (Redis)
- **Pros**: Very fast, simple structure
- **Cons**: No complex queries, memory limitations, no persistence guarantees
- **Rejected**: Lacks query capabilities needed

## Rationale

### Why JSONB?

1. **Flexibility**: Handles varying QuickBooks data structures without schema changes
2. **Performance**: Binary storage format with indexing support
3. **Query Power**: Rich operators for JSON data queries
4. **Compression**: Automatic compression reduces storage
5. **Validation**: Can enforce JSON schema if needed
6. **Evolution**: Easy to add new fields without migrations

### PostgreSQL + JSONB Benefits

```sql
-- Complex queries on JSON data
SELECT 
  company_id,
  report_date,
  metrics->>'total_revenue' AS revenue,
  metrics->>'net_income' AS net_income,
  (metrics->>'net_margin')::float * 100 AS margin_percentage
FROM financial_reports
WHERE 
  report_type = 'P&L'
  AND (metrics->>'total_revenue')::numeric > 100000
  AND report_date >= '2024-01-01'
ORDER BY (metrics->>'net_margin')::float DESC;

-- Aggregations across periods
SELECT 
  DATE_TRUNC('quarter', report_date) AS quarter,
  AVG((metrics->>'net_margin')::float) AS avg_margin,
  SUM((metrics->>'total_revenue')::numeric) AS total_revenue
FROM financial_reports
WHERE report_type = 'P&L'
GROUP BY quarter;
```

## Consequences

### Positive
- ✅ Flexible schema adapts to any QuickBooks data structure
- ✅ Single query retrieves complete report data
- ✅ No complex joins for nested data
- ✅ Easy to add new report types or fields
- ✅ Efficient storage with automatic compression
- ✅ Powerful JSON operators for complex queries
- ✅ Can index specific JSON paths for performance
- ✅ Maintains ACID properties of PostgreSQL

### Negative
- ❌ Less strict data validation than normalized schemas
- ❌ Potential for inconsistent data structure
- ❌ Larger storage than optimized relational design
- ❌ Learning curve for JSON operators
- ❌ Complex queries can be harder to optimize
- ❌ No foreign key constraints within JSON

## Implementation Details

### Data Storage Service

```typescript
class FinancialDataService {
  async storeReport(report: QuickBooksReport): Promise<void> {
    const normalized = this.normalizeReport(report);
    const metrics = this.calculateMetrics(normalized);
    
    await supabase.from('financial_reports').upsert({
      company_id: report.companyId,
      report_type: report.type,
      report_date: report.date,
      period_start: report.periodStart,
      period_end: report.periodEnd,
      raw_data: report.rawData,
      normalized_data: normalized,
      metrics: metrics
    });
  }
  
  private normalizeReport(report: any): any {
    // Transform QuickBooks structure to standard format
    return {
      revenue: this.extractRevenue(report),
      expenses: this.extractExpenses(report),
      net_income: this.calculateNetIncome(report)
    };
  }
}
```

### Query Patterns

```typescript
// Fetch reports with specific metrics
const highMarginReports = await supabase
  .from('financial_reports')
  .select('*')
  .eq('report_type', 'P&L')
  .gte('metrics->>net_margin', '0.25')
  .order('report_date', { ascending: false });

// Search within JSON structure
const reportsWithCategory = await supabase
  .from('financial_reports')
  .select('*')
  .contains('normalized_data', {
    revenue: {
      categories: [
        { name: 'Subscription Revenue' }
      ]
    }
  });
```

### Data Validation

```sql
-- Add check constraint for JSON structure
ALTER TABLE financial_reports
ADD CONSTRAINT valid_metrics CHECK (
  metrics ? 'total_revenue' AND
  metrics ? 'total_expenses' AND
  metrics ? 'net_income'
);

-- Function to validate report structure
CREATE OR REPLACE FUNCTION validate_report_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT (NEW.normalized_data ? 'revenue' AND NEW.normalized_data ? 'expenses') THEN
    RAISE EXCEPTION 'Invalid report structure';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_report
BEFORE INSERT OR UPDATE ON financial_reports
FOR EACH ROW EXECUTE FUNCTION validate_report_data();
```

### Performance Optimization

```sql
-- Materialized view for common aggregations
CREATE MATERIALIZED VIEW monthly_metrics AS
SELECT
  company_id,
  DATE_TRUNC('month', report_date) AS month,
  AVG((metrics->>'net_margin')::float) AS avg_margin,
  SUM((metrics->>'total_revenue')::numeric) AS total_revenue,
  SUM((metrics->>'total_expenses')::numeric) AS total_expenses
FROM financial_reports
WHERE report_type = 'P&L'
GROUP BY company_id, month;

CREATE INDEX idx_monthly_metrics ON monthly_metrics(company_id, month);
```

## Migration Strategy

### From JSONB to Relational (if needed)

```sql
-- Extract to normalized tables
CREATE TABLE revenue_items AS
SELECT
  id,
  company_id,
  report_date,
  (item->>'name')::text AS category_name,
  (item->>'amount')::numeric AS amount
FROM financial_reports,
  jsonb_array_elements(normalized_data->'revenue'->'categories') AS item;
```

## Monitoring and Maintenance

- Monitor JSONB column sizes
- Track query performance on JSON paths
- Regular VACUUM for JSONB toast tables
- Validate JSON structure consistency
- Monitor index usage and effectiveness

## Related ADRs

- [ADR-0002](0002-choose-supabase-database.md): PostgreSQL database choice
- [ADR-0009](0009-implement-row-level-security.md): Security for JSON data
- [ADR-0004](0004-use-perplexity-llm-analysis.md): Storing AI analysis results

## References

- [PostgreSQL JSON Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [JSONB Performance Tips](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)
- [When to use JSONB](https://www.citusdata.com/blog/2016/07/14/choosing-nosql-hstore-json-jsonb/)