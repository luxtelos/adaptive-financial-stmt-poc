# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the QuickBooks Analyzer project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this structure:

- **Title**: ADR-XXXX: Brief description
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: The issue motivating this decision, and any context that influences or constrains the decision
- **Decision**: The change that we're proposing or have agreed to implement
- **Consequences**: What becomes easier or more difficult to do and any risks introduced by the change

## Index

1. [ADR-0001: Use React with TypeScript for Frontend](0001-use-react-typescript-frontend.md)
2. [ADR-0002: Choose Supabase for Database and Authentication](0002-choose-supabase-database.md)
3. [ADR-0003: Implement Clerk for User Authentication](0003-implement-clerk-authentication.md)
4. [ADR-0004: Use Perplexity Pro LLM for Financial Analysis](0004-use-perplexity-llm-analysis.md)
5. [ADR-0005: Adopt Component-Based Architecture with Radix UI](0005-adopt-component-architecture.md)
6. [ADR-0006: Implement OAuth 2.0 for QuickBooks Integration](0006-implement-oauth-quickbooks.md)
7. [ADR-0007: Use Netlify for Deployment with API Proxies](0007-use-netlify-deployment.md)
8. [ADR-0008: Store Financial Data as JSONB in PostgreSQL](0008-store-data-jsonb.md)
9. [ADR-0009: Implement Row-Level Security for Multi-Tenancy](0009-implement-row-level-security.md)
10. [ADR-0010: Use Client-Side PDF Generation](0010-client-side-pdf-generation.md)

## Creating a New ADR

When creating a new ADR:
1. Copy the template from `template.md`
2. Name the file with the pattern: `XXXX-brief-description.md`
3. Update this README with the new ADR in the index
4. Link related ADRs if applicable