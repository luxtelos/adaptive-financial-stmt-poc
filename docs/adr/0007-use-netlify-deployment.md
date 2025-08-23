# ADR-0007: Use Netlify for Deployment with API Proxies

## Status
Accepted

## Context

### Business Requirements
- Need reliable, scalable hosting for the React frontend
- Require automatic deployments from Git
- Must handle API proxy to avoid CORS issues
- Need global CDN for performance
- Require preview deployments for testing
- Support for environment-specific configurations

### Technical Constraints
- Frontend is a static React SPA
- Backend services are external (Supabase, QuickBooks, Perplexity)
- Need serverless functions for some operations
- Must support custom headers and redirects
- Require HTTPS with SSL certificates

## Decision

We will use Netlify for hosting and deployment of the QuickBooks Analyzer frontend application, leveraging its API proxy capabilities, serverless functions, and CI/CD features.

### Deployment Configuration

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"
  environment = { NODE_VERSION = "18" }

[build.environment]
  VITE_SUPABASE_URL = "${SUPABASE_URL}"
  VITE_SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}"
  VITE_CLERK_PUBLISHABLE_KEY = "${CLERK_PUBLISHABLE_KEY}"

[[redirects]]
  from = "/api/quickbooks/*"
  to = "${QUICKBOOKS_API_URL}/:splat"
  status = 200
  headers = {X-From = "Netlify"}

[[redirects]]
  from = "/api/perplexity/*"
  to = "https://api.perplexity.ai/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' *.clerk.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' *.supabase.co *.clerk.com"
```

## Alternatives Considered

### 1. Vercel
- **Pros**: Excellent Next.js support, serverless functions, preview deployments
- **Cons**: More expensive for bandwidth, less flexible redirects
- **Rejected**: Better suited for Next.js; we use Vite/React

### 2. AWS Amplify
- **Pros**: Deep AWS integration, powerful backend features
- **Cons**: Complex setup, AWS lock-in, steeper learning curve
- **Rejected**: Overcomplicated for our needs

### 3. GitHub Pages
- **Pros**: Free, simple, integrated with GitHub
- **Cons**: No serverless functions, limited features, no API proxy
- **Rejected**: Lacks required features

### 4. Cloudflare Pages
- **Pros**: Excellent performance, Workers for serverless
- **Cons**: Less mature ecosystem, complex Workers setup
- **Rejected**: Netlify offers better developer experience

### 5. Traditional VPS (DigitalOcean, Linode)
- **Pros**: Full control, predictable pricing
- **Cons**: Manual setup, maintenance overhead, no automatic scaling
- **Rejected**: Too much operational overhead

## Rationale

### Why Netlify?

1. **Developer Experience**: Git-based deployments with zero configuration
2. **API Proxy**: Built-in proxy eliminates CORS issues
3. **Performance**: Global CDN with 17+ edge locations
4. **Preview Deployments**: Automatic preview URLs for PRs
5. **Serverless Functions**: Easy Lambda functions for backend logic
6. **Form Handling**: Built-in form processing (useful for contact forms)
7. **Analytics**: Built-in analytics without cookies
8. **Split Testing**: A/B testing capabilities

### API Proxy Benefits

```javascript
// Without proxy (CORS issues)
fetch('https://api.perplexity.ai/chat/completions', {
  headers: {
    'Authorization': 'Bearer ' + apiKey // Exposes API key
  }
});

// With Netlify proxy
fetch('/api/perplexity/chat/completions', {
  // API key handled server-side
});
```

## Consequences

### Positive
- ✅ Zero DevOps overhead - automatic deployments
- ✅ Preview deployments for every PR
- ✅ Built-in SSL certificates and renewals
- ✅ API proxy solves CORS without backend changes
- ✅ Global CDN improves performance worldwide
- ✅ Automatic rollback capabilities
- ✅ Environment variable management UI
- ✅ Built-in analytics and monitoring

### Negative
- ❌ Vendor lock-in to Netlify's features
- ❌ Limited to 100GB bandwidth on free tier
- ❌ Serverless functions have 10-second timeout
- ❌ Build minutes limited (300/month free)
- ❌ Some advanced features require paid plans
- ❌ Less control than self-hosted solutions

## Implementation Details

### CI/CD Pipeline

```yaml
# Automated deployment flow
1. Developer pushes to GitHub
2. Netlify webhook triggers build
3. Install dependencies (npm ci)
4. Run build command (npm run build)
5. Deploy to CDN
6. Invalidate cache
7. Update DNS if needed
```

### Environment Management

```javascript
// vite.config.ts
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_SHA__: JSON.stringify(process.env.COMMIT_REF || 'local')
  }
});
```

### Serverless Functions

```typescript
// netlify/functions/sync-quickbooks.ts
import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  // Verify authentication
  const user = await verifyUser(event.headers.authorization);
  
  // Perform QuickBooks sync
  const result = await syncQuickBooksData(user.id);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};
```

### Performance Optimization

```toml
# Cache control headers
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

## Monitoring and Maintenance

### Key Metrics to Track
- Build success rate
- Deployment frequency
- Average build time
- Bandwidth usage
- Function invocations
- Error rates
- Core Web Vitals

### Alerts Configuration
- Build failures
- Bandwidth threshold (80% of limit)
- Function errors > 1%
- Response time > 3 seconds

## Cost Analysis

### Netlify Pricing Tiers

| Feature | Free | Pro ($19/month) | Business ($99/month) |
|---------|------|-----------------|---------------------|
| Bandwidth | 100GB | 1TB | 2TB |
| Build minutes | 300 | 1000 | 2000 |
| Concurrent builds | 1 | 3 | 5 |
| Team members | 1 | Unlimited | Unlimited |
| Functions | 125k/month | 500k/month | 2M/month |

### Estimated Monthly Costs
- Development phase: Free tier sufficient
- 100 active users: Pro tier ($19)
- 1000+ users: Business tier ($99)
- Enterprise: Custom pricing

## Migration Strategy

If migration from Netlify becomes necessary:

1. **Export environment variables**
2. **Update API endpoints** (remove proxy paths)
3. **Implement CORS handling** in backend
4. **Set up new CI/CD** pipeline
5. **Configure CDN** separately
6. **Update DNS** records

## Related ADRs

- [ADR-0001](0001-use-react-typescript-frontend.md): Frontend build process
- [ADR-0002](0002-choose-supabase-database.md): API endpoints configuration
- [ADR-0006](0006-implement-oauth-quickbooks.md): OAuth redirect configuration

## References

- [Netlify Documentation](https://docs.netlify.com/)
- [Netlify Proxy Documentation](https://docs.netlify.com/routing/redirects/rewrites-proxies/)
- [Netlify Functions Guide](https://docs.netlify.com/functions/overview/)
- [JAMstack Architecture](https://jamstack.org/)