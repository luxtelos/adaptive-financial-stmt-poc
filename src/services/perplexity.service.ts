const PERPLEXITY_API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;

// Helper to determine API path based on environment
const getPerplexityApiPath = (endpoint: string) => {
  // In production (Netlify), use the proxy path
  if (import.meta.env.PROD) {
    return `/api/perplexity${endpoint}`;
  }
  // For localhost development, use direct API with CORS headers
  return `https://api.perplexity.ai${endpoint}`;
};

export class PerplexityService {
  // Analyze financial report with Perplexity Pro
  static async analyzeFinancialReport(reportData: any, reportType: string) {
    try {
      const prompt = this.generateFinancialPrompt(reportData, reportType);
      
      const response = await fetch(getPerplexityApiPath('/chat/completions'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'pplx-70b-online', // Perplexity Pro model
          messages: [
            {
              role: 'system',
              content: 'You are an expert CPA and financial analyst. Provide detailed, actionable insights from financial reports. Format your response in markdown with clear sections, bullet points, and tables where appropriate.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2, // Lower temperature for more consistent financial analysis
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error analyzing report with Perplexity:', error);
      throw error;
    }
  }

  // Generate specific prompts based on report type
  private static generateFinancialPrompt(reportData: any, reportType: string): string {
    const basePrompt = `Analyze the following ${reportType} financial report and provide:

1. **Executive Summary**: Key findings and overall financial health
2. **Financial Metrics Analysis**: 
   - Key ratios and their implications
   - Trend analysis
   - Industry benchmarks comparison
3. **Strengths**: Areas where the company is performing well
4. **Areas of Concern**: Potential issues that need attention
5. **Recommendations**: Specific actionable steps to improve financial performance
6. **Risk Assessment**: Identify and quantify financial risks
7. **Cash Flow Insights**: Analysis of cash position and liquidity
8. **Tax Optimization Opportunities**: Legal strategies to minimize tax burden

Report Data:
${JSON.stringify(reportData, null, 2)}

Please provide your analysis in a professional format suitable for presentation to executive management and board members.`;

    const specificPrompts: Record<string, string> = {
      profit_loss: `${basePrompt}

Additionally, focus on:
- Revenue growth trends and drivers
- Gross margin analysis
- Operating expense optimization opportunities
- EBITDA calculation and trends
- Net profit margin comparison to industry standards`,

      balance_sheet: `${basePrompt}

Additionally, focus on:
- Asset utilization efficiency
- Debt-to-equity ratio analysis
- Working capital management
- Current and quick ratios
- Return on assets (ROA) and return on equity (ROE)`,

      cash_flow: `${basePrompt}

Additionally, focus on:
- Operating cash flow trends
- Free cash flow analysis
- Cash conversion cycle
- Capital expenditure planning
- Dividend sustainability`,

      trial_balance: `${basePrompt}

Additionally, focus on:
- Account reconciliation issues
- Unusual balances or transactions
- Internal control recommendations
- Audit preparation insights
- Journal entry analysis`,
    };

    return specificPrompts[reportType] || basePrompt;
  }

  // Get comparative analysis between periods
  static async getComparativeAnalysis(
    currentPeriod: any,
    previousPeriod: any,
    reportType: string
  ) {
    try {
      const prompt = `Provide a detailed comparative analysis between two ${reportType} reports:

Current Period: ${JSON.stringify(currentPeriod, null, 2)}
Previous Period: ${JSON.stringify(previousPeriod, null, 2)}

Focus on:
1. **Period-over-Period Changes**: Calculate and explain significant variances
2. **Trend Analysis**: Identify positive and negative trends
3. **Performance Metrics**: Compare KPIs between periods
4. **Growth Rates**: Calculate and interpret growth rates
5. **Variance Analysis**: Explain major variances and their business impact
6. **Forecast**: Based on trends, provide a forecast for the next period
7. **Action Items**: Specific recommendations based on the comparison

Format as a professional financial analysis report with tables and charts descriptions.`;

      const response = await fetch(getPerplexityApiPath('/chat/completions'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'pplx-70b-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert CPA specializing in comparative financial analysis.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error getting comparative analysis:', error);
      throw error;
    }
  }

  // Get industry-specific insights
  static async getIndustryInsights(
    reportData: any,
    industry: string,
    companySize: string
  ) {
    try {
      const prompt = `Analyze this financial data in the context of the ${industry} industry for a ${companySize} company:

${JSON.stringify(reportData, null, 2)}

Provide:
1. **Industry Benchmarks**: Compare against ${industry} industry standards
2. **Competitive Position**: Assessment relative to competitors
3. **Industry-Specific Metrics**: Relevant KPIs for ${industry}
4. **Market Trends Impact**: How current ${industry} trends affect the finances
5. **Regulatory Considerations**: ${industry}-specific compliance and regulations
6. **Growth Opportunities**: ${industry}-specific expansion possibilities
7. **Risk Factors**: Industry-specific risks and mitigation strategies`;

      const response = await fetch(getPerplexityApiPath('/chat/completions'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'pplx-70b-online',
          messages: [
            {
              role: 'system',
              content: `You are an expert CPA with deep knowledge of the ${industry} industry.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error getting industry insights:', error);
      throw error;
    }
  }

  // Get financial health score
  static async getFinancialHealthScore(reportData: any) {
    try {
      const prompt = `Based on the following financial data, calculate a comprehensive financial health score (0-100) and provide detailed breakdown:

${JSON.stringify(reportData, null, 2)}

Provide:
1. **Overall Score**: A score from 0-100
2. **Score Breakdown**:
   - Liquidity Score (0-100)
   - Profitability Score (0-100)
   - Efficiency Score (0-100)
   - Leverage Score (0-100)
   - Growth Score (0-100)
3. **Score Justification**: Explain how each score was calculated
4. **Comparison**: How this score compares to industry averages
5. **Improvement Areas**: Specific actions to improve the score

Format the response as JSON with markdown explanations.`;

      const response = await fetch(getPerplexityApiPath('/chat/completions'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'pplx-70b-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert financial analyst specializing in financial health assessments.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calculating financial health score:', error);
      throw error;
    }
  }
}