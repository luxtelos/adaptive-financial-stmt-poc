# ADR-0004: Use Perplexity Pro LLM for Financial Analysis

## Status
Accepted

## Date
2024-01-25

## Context

The QuickBooks Analyzer application aims to provide CPAs with intelligent, actionable insights from financial data beyond traditional reporting. The system needs to:

- Analyze complex financial statements and identify patterns, anomalies, and opportunities
- Generate natural language explanations of financial metrics and trends
- Provide industry-specific benchmarking and recommendations
- Answer ad-hoc questions about financial data in conversational format
- Produce professional narrative sections for reports
- Identify potential tax optimization opportunities
- Flag compliance issues and audit risks
- Generate forward-looking insights and projections

Key requirements for the AI component:
- **Accuracy**: High precision in financial calculations and interpretations
- **Reliability**: Consistent, deterministic responses for financial analysis
- **Context**: Ability to understand complex financial relationships
- **Compliance**: Appropriate disclaimers and risk warnings
- **Performance**: Response times under 10 seconds for report generation
- **Cost**: Predictable pricing model that scales with usage
- **Integration**: API-based integration with our tech stack

## Decision

We will use Perplexity Pro (pplx-70b-online model) as our primary LLM for financial analysis, with the following implementation:

- **Model Selection**: pplx-70b-online for high-quality financial analysis
- **Temperature Setting**: 0.2 for consistent, focused responses
- **Context Window**: 4,000 tokens for comprehensive analysis
- **API Integration**: Direct API calls with Netlify proxy for production
- **Response Format**: Structured markdown for easy parsing and display
- **Caching Strategy**: Cache similar queries for cost optimization

### Implementation Configuration:
```typescript
{
  model: 'pplx-70b-online',
  temperature: 0.2,  // Lower for financial accuracy
  max_tokens: 4000,
  system_prompt: 'Expert CPA and financial analyst providing actionable insights'
}
```

## Alternatives Considered

### 1. OpenAI GPT-4
**Pros:**
- Industry-leading language model
- Extensive financial training data
- 128K context window (GPT-4 Turbo)
- Function calling for structured outputs
- Strong reasoning capabilities
- Wide ecosystem support

**Cons:**
- Higher cost ($0.03/1K input tokens)
- No real-time web access
- Rate limiting concerns at scale
- Potential latency issues
- Training cutoff limitations
- Requires additional web search integration

### 2. Anthropic Claude 3
**Pros:**
- Excellent reasoning and analysis
- Strong safety and accuracy focus
- 200K context window
- Good at following complex instructions
- Constitutional AI reduces hallucinations

**Cons:**
- More expensive than Perplexity
- No native web search capability
- Limited availability in some regions
- Newer with less ecosystem support
- Longer response times for complex queries

### 3. Google Gemini Pro
**Pros:**
- Multimodal capabilities
- Good price-performance ratio
- Integration with Google services
- Large context window
- Fast inference times

**Cons:**
- Less specialized in financial analysis
- Inconsistent quality for complex reasoning
- Limited enterprise support
- API stability concerns
- Weaker structured output generation

### 4. Cohere Command
**Pros:**
- Cost-effective pricing
- RAG capabilities built-in
- Good for factual accuracy
- Enterprise-focused features
- Customization options

**Cons:**
- Smaller model less capable for complex analysis
- Limited financial domain expertise
- Smaller ecosystem
- Less sophisticated reasoning
- Weaker narrative generation

### 5. Custom Fine-tuned Model
**Pros:**
- Specialized for financial analysis
- Complete control over behavior
- No API costs after training
- Can include proprietary knowledge
- Predictable outputs

**Cons:**
- Expensive initial training ($100K+)
- Requires ML expertise
- Ongoing maintenance burden
- Limited to training data
- No real-time information
- Long development timeline (6-12 months)

### 6. Microsoft Azure OpenAI
**Pros:**
- Enterprise SLAs
- Data residency options
- Integration with Azure services
- Compliance certifications
- Dedicated capacity available

**Cons:**
- Complex setup and management
- Higher costs than direct OpenAI
- Same model limitations as OpenAI
- Requires Azure expertise
- Slower feature rollout

## Rationale

Perplexity Pro provides the optimal solution for our financial analysis needs:

1. **Real-time Information Access**:
   - Built-in web search for current market data
   - Access to latest regulatory changes
   - Industry benchmarking from recent reports
   - Critical for accurate financial analysis

2. **Financial Expertise**:
   - 70B parameter model trained on financial data
   - Understands accounting principles and terminology
   - Can interpret complex financial statements
   - Provides professional-grade analysis

3. **Cost Efficiency**:
   - $0.001 per 1,000 tokens (10x cheaper than GPT-4)
   - Predictable usage-based pricing
   - No fine-tuning costs
   - Includes web search capability

4. **Response Quality**:
   - Structured, professional outputs
   - Citations for factual claims
   - Balanced analysis with pros/cons
   - Appropriate financial disclaimers

5. **Integration Simplicity**:
   - RESTful API interface
   - Standard authentication
   - JSON response format
   - Minimal infrastructure requirements

6. **Performance**:
   - Average response time: 3-5 seconds
   - Consistent availability
   - No rate limiting for our usage
   - Parallel request capability

## Consequences

### Positive Consequences

1. **Enhanced Analysis Quality**: CPAs receive institutional-grade financial insights
2. **Time Savings**: Automated analysis reduces report preparation by 60-80%
3. **Competitive Advantage**: AI-powered insights differentiate from traditional tools
4. **Scalability**: Can handle thousands of concurrent analyses
5. **Current Information**: Real-time web access ensures up-to-date insights
6. **Cost Predictability**: Usage-based pricing aligns with business model
7. **Rapid Deployment**: API integration complete in weeks, not months
8. **Continuous Improvement**: Model updates without code changes

### Negative Consequences

1. **API Dependency**: Service availability affects core functionality
2. **Data Privacy**: Financial data processed by third-party service
3. **Limited Customization**: Cannot fine-tune model for specific needs
4. **Hallucination Risk**: Potential for incorrect financial interpretations
5. **Compliance Concerns**: Need disclaimers about AI-generated advice
6. **Cost Scaling**: High-volume usage could become expensive
7. **Vendor Lock-in**: Switching models requires prompt engineering changes

## Implementation Considerations

### API Integration Architecture
```typescript
// Service layer implementation
export class PerplexityService {
  static async analyzeFinancialReport(
    reportData: FinancialData,
    reportType: ReportType
  ): Promise<Analysis> {
    const prompt = this.generateFinancialPrompt(reportData, reportType);
    
    const response = await fetch('/api/perplexity/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pplx-70b-online',
        messages: [
          { role: 'system', content: FINANCIAL_ANALYST_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });
    
    return this.parseAnalysisResponse(response);
  }
}
```

### Prompt Engineering Strategy
```typescript
const FINANCIAL_ANALYST_PROMPT = `
You are an expert CPA and financial analyst. Provide detailed, 
actionable insights from financial reports. 

Guidelines:
- Use professional accounting terminology
- Cite specific metrics and calculations
- Identify trends and anomalies
- Suggest actionable recommendations
- Include appropriate disclaimers
- Format response in structured markdown
`;
```

### Error Handling and Fallbacks
- Retry logic with exponential backoff
- Fallback to cached responses for similar queries
- Graceful degradation to basic analysis
- User notification of AI limitations
- Manual override options for CPAs

### Data Privacy Measures
- Remove PII before sending to API
- Use company identifiers, not names
- Aggregate sensitive metrics
- Implement data retention policies
- Regular security audits

### Quality Assurance
- Validate numerical calculations
- Cross-reference with source data
- CPA review for initial deployments
- User feedback incorporation
- A/B testing of prompts

### Cost Optimization
- Cache frequent query patterns
- Batch similar analyses
- Implement token limits
- Monitor usage patterns
- Progressive enhancement based on tier

## Related Decisions

- **ADR-0001**: React frontend displays AI insights
- **ADR-0002**: Analysis results stored in Supabase
- **ADR-0007**: Netlify proxy handles API authentication
- **ADR-0008**: JSONB storage for AI response flexibility
- **ADR-0010**: PDF generation includes AI narratives

## Performance Metrics

Target metrics for AI analysis:
- Response time: < 5 seconds for standard reports
- Accuracy rate: > 95% for factual statements
- User satisfaction: > 4.5/5 rating
- Cost per analysis: < $0.10
- Availability: 99.9% uptime

## Risk Mitigation

1. **Hallucination Prevention**:
   - Low temperature setting (0.2)
   - Structured prompts with examples
   - Validation against source data
   - CPA review recommendations

2. **Compliance and Legal**:
   - Clear AI disclosure to users
   - Disclaimer about not being financial advice
   - Audit trail of AI interactions
   - Regular compliance reviews

3. **Service Disruption**:
   - Fallback to basic analysis
   - Cached responses for common queries
   - Manual analysis option
   - Alternative LLM provider ready

## Cost Analysis

Expected monthly costs based on usage:
- **Startup Phase** (100 users): $50-100/month
- **Growth Phase** (1,000 users): $500-1,000/month
- **Scale Phase** (10,000 users): $3,000-5,000/month

Cost breakdown:
- Average tokens per analysis: 2,000 input + 2,000 output
- Cost per analysis: $0.004
- Analyses per user per month: 10-20
- Total cost per user: $0.04-0.08/month

## Future Considerations

- **Multi-model Strategy**: Combine multiple LLMs for verification
- **Fine-tuning**: Create specialized model when volume justifies
- **Local Models**: Deploy open-source models for sensitive data
- **Regulatory Compliance**: Adapt to AI regulation changes
- **Advanced Features**: Vision capabilities for document analysis

## References

- [Perplexity API Documentation](https://docs.perplexity.ai)
- [LLM Evaluation for Financial Tasks](https://arxiv.org/abs/2311.10723)
- [Best Practices for LLM Applications](https://platform.openai.com/docs/guides/safety-best-practices)
- [Financial AI Compliance Guidelines](https://www.sec.gov/ai-compliance)

## Review and Approval

- **Proposed by**: Technical Lead, Data Scientist
- **Reviewed by**: Senior Business Analyst, Compliance Officer
- **Approved by**: Project Stakeholders
- **Review Date**: 2024-01-25