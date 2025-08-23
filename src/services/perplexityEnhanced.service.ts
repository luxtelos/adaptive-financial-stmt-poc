import { FinancialDataForLLM, LLMAnalysisResponse } from '../types/financial.types';

export class PerplexityEnhancedService {
  private static readonly API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;
  private static readonly API_BASE_URL = import.meta.env.PROD 
    ? '/api/perplexity' 
    : 'https://api.perplexity.ai';
  
  /**
   * Main method to analyze financial data with Perplexity LLM
   */
  static async analyzeFinancialData(
    financialData: FinancialDataForLLM
  ): Promise<LLMAnalysisResponse> {
    try {
      const systemPrompt = this.generateSystemPrompt();
      const userPrompt = this.generateUserPrompt(financialData);
      
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'pplx-70b-online',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 8000,
          response_format: { type: 'json_object' }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse the JSON response
      const parsedResponse = JSON.parse(content);
      
      // Ensure response has the expected structure
      return this.validateAndFormatResponse(parsedResponse);
    } catch (error) {
      console.error('Error analyzing financial data:', error);
      throw error;
    }
  }
  
  /**
   * Generate system prompt for financial analysis
   */
  private static generateSystemPrompt(): string {
    return `You are an expert CPA and financial analyst with 20+ years of experience analyzing corporate financial statements. Your role is to provide comprehensive, actionable financial analysis that helps executives make informed decisions.

You must respond with a JSON object that contains a 'choice' key with the following structure:
{
  "choice": {
    "executiveSummary": {
      "overallHealth": "excellent|good|fair|poor|critical",
      "keyHighlights": ["string"],
      "criticalIssues": ["string"],
      "immediateActions": ["string"]
    },
    "financialPerformanceSnapshot": { ... },
    "cashFlowAnalysis": { ... },
    "revenueMetrics": { ... },
    "expenseReview": { ... },
    "kpiDashboard": { ... },
    "workingCapitalLiquidity": { ... },
    "yearOverYearAnalysis": { ... },
    "budgetVsActual": { ... },
    "forwardOutlook": { ... },
    "riskAssessment": { ... },
    "taxOptimization": { ... }
  },
  "metadata": { ... }
}

Analysis Guidelines:
1. Be specific and quantitative in your analysis
2. Provide actionable recommendations with clear implementation steps
3. Compare metrics to industry benchmarks when available
4. Identify both opportunities and risks
5. Use professional financial terminology appropriately
6. Prioritize insights by business impact
7. Consider seasonality and business cycles
8. Provide forward-looking guidance based on trends
9. Include tax optimization strategies where applicable
10. Format all percentages as numbers (e.g., 15.5 not "15.5%")
11. Format all currency amounts as numbers without symbols`;
  }
  
  /**
   * Generate user prompt with financial data
   */
  private static generateUserPrompt(data: FinancialDataForLLM): string {
    const prompt = `Analyze the following comprehensive financial data for ${data.metadata.companyName} and provide detailed insights:

COMPANY INFORMATION:
- Company: ${data.metadata.companyName}
- Report Period: ${data.metadata.reportPeriod.start} to ${data.metadata.reportPeriod.end}
- Industry: ${data.metadata.industry || 'Not specified'}
- Company Size: ${data.metadata.companySize || 'Not specified'}
- Currency: ${data.metadata.currency}

FINANCIAL STATEMENTS DATA:
${JSON.stringify(data.financialStatements, null, 2)}

SUPPLEMENTARY REPORTS:
${JSON.stringify(data.supplementaryReports, null, 2)}

CALCULATED METRICS:
${JSON.stringify(data.calculatedMetrics, null, 2)}

HISTORICAL TRENDS:
${JSON.stringify(data.trends, null, 2)}

ANALYSIS CONTEXT:
${JSON.stringify(data.analysisContext, null, 2)}

Please provide a comprehensive financial analysis following the JSON structure specified. Focus on:

1. Overall financial health assessment with specific reasoning
2. Revenue performance and growth drivers
3. Cost structure optimization opportunities
4. Cash flow quality and liquidity position
5. Working capital efficiency
6. Year-over-year performance changes
7. Budget variance analysis (if applicable)
8. Forward-looking projections and scenarios
9. Risk identification and mitigation strategies
10. Tax optimization opportunities

For each section, provide:
- Quantitative metrics and calculations
- Qualitative insights and interpretations
- Specific, actionable recommendations
- Priority levels for actions
- Expected impact of recommendations
- Implementation timelines

Ensure all numerical values are formatted as numbers, not strings with symbols.`;
    
    return prompt;
  }
  
  /**
   * Validate and format the LLM response
   */
  private static validateAndFormatResponse(response: any): LLMAnalysisResponse {
    // Ensure the response has the expected structure
    if (!response.choice) {
      throw new Error('Invalid response structure from LLM');
    }
    
    // Set defaults for missing fields
    const formattedResponse: LLMAnalysisResponse = {
      choice: {
        executiveSummary: response.choice.executiveSummary || {
          overallHealth: 'fair',
          keyHighlights: [],
          criticalIssues: [],
          immediateActions: []
        },
        
        financialPerformanceSnapshot: response.choice.financialPerformanceSnapshot || {
          revenueAnalysis: {
            trend: 'stable',
            growthRate: 0,
            keyDrivers: [],
            concerns: []
          },
          profitabilityAnalysis: {
            margins: { gross: 0, operating: 0, net: 0 },
            trend: 'stable',
            insights: []
          },
          costStructure: {
            majorCategories: [],
            optimizationOpportunities: []
          }
        },
        
        cashFlowAnalysis: response.choice.cashFlowAnalysis || {
          operatingCashFlow: {
            amount: 0,
            trend: 'stable',
            quality: 'adequate',
            insights: []
          },
          freeCashFlow: {
            amount: 0,
            trend: 'stable',
            uses: []
          },
          liquidityPosition: {
            currentRatio: 0,
            quickRatio: 0,
            daysOfCashOnHand: 0,
            assessment: ''
          }
        },
        
        revenueMetrics: response.choice.revenueMetrics || {
          topRevenueStreams: [],
          customerConcentration: { risk: 'medium', details: '' },
          seasonality: { pattern: '', impact: '' },
          forecast: { nextQuarter: 0, nextYear: 0, assumptions: [] }
        },
        
        expenseReview: response.choice.expenseReview || {
          majorExpenses: [],
          costSavingOpportunities: [],
          unusualItems: []
        },
        
        kpiDashboard: response.choice.kpiDashboard || {
          financialKPIs: [],
          operationalKPIs: []
        },
        
        workingCapitalLiquidity: response.choice.workingCapitalLiquidity || {
          workingCapital: { amount: 0, trend: 'stable', daysWorkingCapital: 0 },
          cashConversionCycle: {
            days: 0,
            components: { daysInventory: 0, daysReceivables: 0, daysPayables: 0 },
            improvement: ''
          },
          creditManagement: {
            receivablesTurnover: 0,
            badDebtRatio: 0,
            recommendations: []
          }
        },
        
        yearOverYearAnalysis: response.choice.yearOverYearAnalysis || {
          revenueGrowth: { percentage: 0, dollarAmount: 0, drivers: [] },
          expenseGrowth: { percentage: 0, dollarAmount: 0, drivers: [] },
          profitGrowth: { percentage: 0, dollarAmount: 0, marginChange: 0 },
          balanceSheetChanges: {
            assetGrowth: 0,
            liabilityGrowth: 0,
            equityGrowth: 0,
            keyChanges: []
          }
        },
        
        budgetVsActual: response.choice.budgetVsActual || {
          overallVariance: { amount: 0, percentage: 0, assessment: '' },
          majorVariances: [],
          forecastAccuracy: { score: 0, improvements: [] }
        },
        
        forwardOutlook: response.choice.forwardOutlook || {
          shortTermOutlook: {
            timeframe: '3 months',
            assessment: '',
            opportunities: [],
            risks: []
          },
          longTermProjections: {
            timeframe: '12 months',
            revenueProjection: 0,
            profitProjection: 0,
            assumptions: [],
            scenarios: []
          },
          strategicRecommendations: [],
          investmentPriorities: []
        },
        
        riskAssessment: response.choice.riskAssessment || {
          financialRisks: [],
          operationalRisks: []
        },
        
        taxOptimization: response.choice.taxOptimization || {
          currentEffectiveRate: 0,
          opportunities: []
        }
      },
      
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        modelUsed: 'pplx-70b-online',
        confidenceScore: response.metadata?.confidenceScore || 0.85,
        dataQuality: response.metadata?.dataQuality || 'high',
        limitations: response.metadata?.limitations || []
      }
    };
    
    return formattedResponse;
  }
  
  /**
   * Get comparative analysis between periods
   */
  static async getComparativeAnalysis(
    currentData: FinancialDataForLLM,
    previousData: FinancialDataForLLM
  ): Promise<any> {
    const systemPrompt = `You are an expert financial analyst specializing in period-over-period comparative analysis. Provide detailed insights on changes, trends, and variances between financial periods.`;
    
    const userPrompt = `Compare the following two financial periods and provide comprehensive variance analysis:

CURRENT PERIOD:
${JSON.stringify(currentData, null, 2)}

PREVIOUS PERIOD:
${JSON.stringify(previousData, null, 2)}

Provide analysis including:
1. Key metric changes and growth rates
2. Trend identification and trajectory
3. Variance explanations
4. Performance drivers
5. Areas of concern
6. Improvement recommendations`;
    
    const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pplx-70b-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 4000
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  /**
   * Get industry-specific insights
   */
  static async getIndustryBenchmarkAnalysis(
    financialData: FinancialDataForLLM,
    industry: string
  ): Promise<any> {
    const systemPrompt = `You are an expert financial analyst with deep knowledge of the ${industry} industry. Provide industry-specific analysis and benchmarking.`;
    
    const userPrompt = `Analyze this company's financial performance in the context of the ${industry} industry:

${JSON.stringify(financialData, null, 2)}

Provide:
1. Industry benchmark comparisons
2. Competitive positioning assessment
3. Industry-specific KPIs analysis
4. Market trend impact analysis
5. Regulatory considerations
6. Growth opportunities specific to ${industry}
7. Industry-specific risks and mitigation strategies`;
    
    const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pplx-70b-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 3000
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  /**
   * Get scenario analysis
   */
  static async getScenarioAnalysis(
    financialData: FinancialDataForLLM,
    scenarios: Array<{ name: string; assumptions: string[] }>
  ): Promise<any> {
    const systemPrompt = `You are an expert financial analyst specializing in scenario planning and financial modeling. Provide detailed scenario analysis with quantitative projections.`;
    
    const userPrompt = `Based on the following financial data, provide scenario analysis for the specified scenarios:

CURRENT FINANCIAL DATA:
${JSON.stringify(financialData, null, 2)}

SCENARIOS TO ANALYZE:
${JSON.stringify(scenarios, null, 2)}

For each scenario, provide:
1. Financial impact projections
2. Key metrics under each scenario
3. Risk assessment
4. Mitigation strategies
5. Probability assessment
6. Decision recommendations`;
    
    const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pplx-70b-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  /**
   * Get executive briefing
   */
  static async getExecutiveBriefing(
    llmAnalysis: LLMAnalysisResponse
  ): Promise<string> {
    const systemPrompt = `You are preparing an executive briefing for C-suite executives and board members. Be concise, focus on strategic insights, and use executive-appropriate language.`;
    
    const userPrompt = `Based on this comprehensive financial analysis, prepare a concise executive briefing:

${JSON.stringify(llmAnalysis.choice.executiveSummary, null, 2)}
${JSON.stringify(llmAnalysis.choice.forwardOutlook.strategicRecommendations, null, 2)}

Create a 1-page executive briefing that includes:
1. One-sentence financial health summary
2. Top 3 achievements
3. Top 3 concerns requiring attention
4. 5 strategic priorities with expected impact
5. Key decisions needed
6. Risk factors to monitor

Format in clear, bullet-pointed markdown.`;
    
    const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pplx-70b-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1500
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}