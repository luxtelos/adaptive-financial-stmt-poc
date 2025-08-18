-- Supabase Database Schema for QuickBooks Analyzer

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced with Clerk)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  quickbooks_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QuickBooks connections table
CREATE TABLE IF NOT EXISTS quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  company_id_qb TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial reports table
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  raw_data JSONB,
  ai_analysis TEXT,
  pdf_url TEXT,
  perplexity_response JSONB,
  score INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_quickbooks_connections_company_id ON quickbooks_connections(company_id);
CREATE INDEX idx_financial_reports_company_id ON financial_reports(company_id);
CREATE INDEX idx_financial_reports_status ON financial_reports(status);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.jwt() ->> 'clerk_id' = clerk_id);

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.jwt() ->> 'clerk_id' = clerk_id);

-- RLS Policies for companies table
CREATE POLICY "Users can view own companies" ON companies
  FOR SELECT USING (auth.jwt() ->> 'clerk_id' = user_id);

CREATE POLICY "Users can insert own companies" ON companies
  FOR INSERT WITH CHECK (auth.jwt() ->> 'clerk_id' = user_id);

CREATE POLICY "Users can update own companies" ON companies
  FOR UPDATE USING (auth.jwt() ->> 'clerk_id' = user_id);

CREATE POLICY "Users can delete own companies" ON companies
  FOR DELETE USING (auth.jwt() ->> 'clerk_id' = user_id);

-- RLS Policies for quickbooks_connections table
CREATE POLICY "Users can view own connections" ON quickbooks_connections
  FOR SELECT USING (auth.jwt() ->> 'clerk_id' = user_id);

CREATE POLICY "Users can manage own connections" ON quickbooks_connections
  FOR ALL USING (auth.jwt() ->> 'clerk_id' = user_id);

-- RLS Policies for financial_reports table
CREATE POLICY "Users can view own reports" ON financial_reports
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.jwt() ->> 'clerk_id'
    )
  );

CREATE POLICY "Users can manage own reports" ON financial_reports
  FOR ALL USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.jwt() ->> 'clerk_id'
    )
  );

-- RLS Policies for audit_logs table
CREATE POLICY "Users can view own logs" ON audit_logs
  FOR SELECT USING (auth.jwt() ->> 'clerk_id' = user_id);

CREATE POLICY "Users can insert own logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'clerk_id' = user_id);

-- Functions for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_reports_updated_at BEFORE UPDATE ON financial_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();