// QBO API Response Types
export interface QBOProfitLossData {
  Header: {
    Time: string;
    ReportName: string;
    StartPeriod: string;
    EndPeriod: string;
    Currency: string;
  };
  Columns: {
    Column: Array<{
      ColTitle: string;
      ColType: string;
    }>;
  };
  Rows: {
    Row: Array<{
      group?: string;
      type?: string;
      ColData?: Array<{
        value: string;
        id?: string;
      }>;
      Summary?: {
        ColData: Array<{
          value: string;
        }>;
      };
      Rows?: {
        Row: Array<any>;
      };
    }>;
  };
}

export interface QBOBalanceSheetData {
  Header: {
    Time: string;
    ReportName: string;
    StartPeriod: string;
    EndPeriod: string;
    Currency: string;
  };
  Columns: {
    Column: Array<{
      ColTitle: string;
      ColType: string;
    }>;
  };
  Rows: {
    Row: Array<{
      group?: string;
      type?: string;
      ColData?: Array<{
        value: string;
        id?: string;
      }>;
      Summary?: {
        ColData: Array<{
          value: string;
        }>;
      };
      Rows?: {
        Row: Array<any>;
      };
    }>;
  };
}

export interface QBOCashFlowData {
  Header: {
    Time: string;
    ReportName: string;
    StartPeriod: string;
    EndPeriod: string;
    Currency: string;
  };
  Rows: {
    Row: Array<{
      group?: string;
      type?: string;
      ColData?: Array<{
        value: string;
      }>;
      Rows?: {
        Row: Array<any>;
      };
    }>;
  };
}

export interface QBOAgingReportData {
  Header: {
    Time: string;
    ReportName: string;
    ReportBasis: string;
    StartPeriod: string;
    EndPeriod: string;
  };
  Columns: {
    Column: Array<{
      ColTitle: string;
      ColType: string;
    }>;
  };
  Rows: {
    Row: Array<{
      ColData?: Array<{
        value: string;
        id?: string;
      }>;
      type?: string;
    }>;
  };
}

export interface QBOBudgetData {
  budgetId: string;
  name: string;
  startDate: string;
  endDate: string;
  budgetDetails: Array<{
    accountId: string;
    accountName: string;
    periods: Array<{
      date: string;
      amount: number;
    }>;
  }>;
}

// Aggregated JSON Structure for LLM Input
export interface FinancialDataForLLM {
  metadata: {
    companyName: string;
    companyId: string;
    reportGeneratedAt: string;
    reportPeriod: {
      start: string;
      end: string;
    };
    previousPeriod?: {
      start: string;
      end: string;
    };
    currency: string;
    industry?: string;
    companySize?: string;
  };
  
  financialStatements: {
    profitLoss: {
      current: ProfitLossStatement;
      previous?: ProfitLossStatement;
      variance?: VarianceAnalysis;
    };
    balanceSheet: {
      current: BalanceSheetStatement;
      previous?: BalanceSheetStatement;
      variance?: VarianceAnalysis;
    };
    cashFlow: {
      current: CashFlowStatement;
      previous?: CashFlowStatement;
      variance?: VarianceAnalysis;
    };
  };
  
  supplementaryReports: {
    accountsReceivable: AgingReport;
    accountsPayable: AgingReport;
    budgetVsActual?: BudgetVsActualReport;
  };
  
  calculatedMetrics: {
    liquidityRatios: {
      currentRatio: number;
      quickRatio: number;
      cashRatio: number;
      workingCapital: number;
    };
    profitabilityRatios: {
      grossProfitMargin: number;
      operatingMargin: number;
      netProfitMargin: number;
      returnOnAssets: number;
      returnOnEquity: number;
      ebitda: number;
      ebitdaMargin: number;
    };
    efficiencyRatios: {
      assetTurnover: number;
      inventoryTurnover: number;
      receivablesTurnover: number;
      payablesTurnover: number;
      cashConversionCycle: number;
    };
    leverageRatios: {
      debtToEquity: number;
      debtToAssets: number;
      interestCoverage: number;
      debtServiceCoverage: number;
    };
    growthMetrics: {
      revenueGrowthRate: number;
      profitGrowthRate: number;
      assetGrowthRate: number;
      customerGrowthRate?: number;
    };
  };
  
  trends: {
    monthlyRevenue: Array<{ month: string; amount: number }>;
    monthlyExpenses: Array<{ month: string; amount: number }>;
    monthlyProfit: Array<{ month: string; amount: number }>;
    monthlyCashFlow: Array<{ month: string; amount: number }>;
  };
  
  analysisContext: {
    reportType: 'comprehensive' | 'quarterly' | 'annual' | 'custom';
    focusAreas: string[];
    industryBenchmarks?: {
      [key: string]: number;
    };
    specialConsiderations?: string[];
  };
}

// Normalized Financial Statement Structures
export interface ProfitLossStatement {
  revenue: {
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  costOfGoodsSold: {
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
    }>;
  };
  grossProfit: number;
  operatingExpenses: {
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  operatingIncome: number;
  otherIncomeExpenses: {
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
    }>;
  };
  incomeBeforeTax: number;
  taxExpense: number;
  netIncome: number;
}

export interface BalanceSheetStatement {
  assets: {
    current: {
      total: number;
      cash: number;
      accountsReceivable: number;
      inventory: number;
      otherCurrentAssets: number;
    };
    nonCurrent: {
      total: number;
      propertyPlantEquipment: number;
      intangibleAssets: number;
      otherNonCurrentAssets: number;
    };
    totalAssets: number;
  };
  liabilities: {
    current: {
      total: number;
      accountsPayable: number;
      shortTermDebt: number;
      otherCurrentLiabilities: number;
    };
    nonCurrent: {
      total: number;
      longTermDebt: number;
      otherNonCurrentLiabilities: number;
    };
    totalLiabilities: number;
  };
  equity: {
    total: number;
    commonStock: number;
    retainedEarnings: number;
    otherEquity: number;
  };
}

export interface CashFlowStatement {
  operatingActivities: {
    netIncome: number;
    adjustments: Array<{
      item: string;
      amount: number;
    }>;
    workingCapitalChanges: {
      accountsReceivable: number;
      inventory: number;
      accountsPayable: number;
      other: number;
    };
    netCashFromOperations: number;
  };
  investingActivities: {
    capitalExpenditures: number;
    acquisitions: number;
    assetSales: number;
    otherInvesting: number;
    netCashFromInvesting: number;
  };
  financingActivities: {
    debtProceeds: number;
    debtRepayments: number;
    equityIssuance: number;
    dividendsPaid: number;
    otherFinancing: number;
    netCashFromFinancing: number;
  };
  netChangeInCash: number;
  beginningCash: number;
  endingCash: number;
}

export interface AgingReport {
  totalOutstanding: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90Days: number;
  details: Array<{
    customerOrVendor: string;
    totalAmount: number;
    current: number;
    pastDue: number;
    daysOutstanding: number;
  }>;
}

export interface BudgetVsActualReport {
  period: string;
  items: Array<{
    category: string;
    budgeted: number;
    actual: number;
    variance: number;
    variancePercentage: number;
  }>;
  summary: {
    totalBudgeted: number;
    totalActual: number;
    totalVariance: number;
    totalVariancePercentage: number;
  };
}

export interface VarianceAnalysis {
  amount: number;
  percentage: number;
  trend: 'increase' | 'decrease' | 'stable';
  significance: 'high' | 'medium' | 'low';
}

// LLM Response Structure
export interface LLMAnalysisResponse {
  choice: {
    executiveSummary: {
      overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
      keyHighlights: string[];
      criticalIssues: string[];
      immediateActions: string[];
    };
    
    financialPerformanceSnapshot: {
      revenueAnalysis: {
        trend: string;
        growthRate: number;
        keyDrivers: string[];
        concerns: string[];
      };
      profitabilityAnalysis: {
        margins: {
          gross: number;
          operating: number;
          net: number;
        };
        trend: string;
        insights: string[];
      };
      costStructure: {
        majorCategories: Array<{
          category: string;
          percentage: number;
          trend: string;
        }>;
        optimizationOpportunities: string[];
      };
    };
    
    cashFlowAnalysis: {
      operatingCashFlow: {
        amount: number;
        trend: string;
        quality: 'strong' | 'adequate' | 'weak';
        insights: string[];
      };
      freeCashFlow: {
        amount: number;
        trend: string;
        uses: string[];
      };
      liquidityPosition: {
        currentRatio: number;
        quickRatio: number;
        daysOfCashOnHand: number;
        assessment: string;
      };
    };
    
    revenueMetrics: {
      topRevenueStreams: Array<{
        source: string;
        amount: number;
        percentage: number;
        growth: number;
      }>;
      customerConcentration: {
        risk: 'high' | 'medium' | 'low';
        details: string;
      };
      seasonality: {
        pattern: string;
        impact: string;
      };
      forecast: {
        nextQuarter: number;
        nextYear: number;
        assumptions: string[];
      };
    };
    
    expenseReview: {
      majorExpenses: Array<{
        category: string;
        amount: number;
        percentageOfRevenue: number;
        trend: string;
        benchmark: string;
      }>;
      costSavingOpportunities: Array<{
        area: string;
        potentialSaving: number;
        implementation: string;
        priority: 'high' | 'medium' | 'low';
      }>;
      unusualItems: Array<{
        item: string;
        amount: number;
        explanation: string;
      }>;
    };
    
    kpiDashboard: {
      financialKPIs: Array<{
        metric: string;
        value: number | string;
        benchmark: number | string;
        status: 'above' | 'meets' | 'below';
        trend: 'improving' | 'stable' | 'declining';
      }>;
      operationalKPIs: Array<{
        metric: string;
        value: number | string;
        target: number | string;
        achievement: number;
      }>;
    };
    
    workingCapitalLiquidity: {
      workingCapital: {
        amount: number;
        trend: string;
        daysWorkingCapital: number;
      };
      cashConversionCycle: {
        days: number;
        components: {
          daysInventory: number;
          daysReceivables: number;
          daysPayables: number;
        };
        improvement: string;
      };
      creditManagement: {
        receivablesTurnover: number;
        badDebtRatio: number;
        recommendations: string[];
      };
    };
    
    yearOverYearAnalysis: {
      revenueGrowth: {
        percentage: number;
        dollarAmount: number;
        drivers: string[];
      };
      expenseGrowth: {
        percentage: number;
        dollarAmount: number;
        drivers: string[];
      };
      profitGrowth: {
        percentage: number;
        dollarAmount: number;
        marginChange: number;
      };
      balanceSheetChanges: {
        assetGrowth: number;
        liabilityGrowth: number;
        equityGrowth: number;
        keyChanges: string[];
      };
    };
    
    budgetVsActual: {
      overallVariance: {
        amount: number;
        percentage: number;
        assessment: string;
      };
      majorVariances: Array<{
        category: string;
        budgeted: number;
        actual: number;
        variance: number;
        explanation: string;
        correctionNeeded: boolean;
      }>;
      forecastAccuracy: {
        score: number;
        improvements: string[];
      };
    };
    
    forwardOutlook: {
      shortTermOutlook: {
        timeframe: string;
        assessment: string;
        opportunities: string[];
        risks: string[];
      };
      longTermProjections: {
        timeframe: string;
        revenueProjection: number;
        profitProjection: number;
        assumptions: string[];
        scenarios: Array<{
          scenario: string;
          probability: number;
          impact: string;
        }>;
      };
      strategicRecommendations: Array<{
        recommendation: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        timeframe: string;
        expectedImpact: string;
        implementation: string;
      }>;
      investmentPriorities: Array<{
        area: string;
        requiredInvestment: number;
        expectedROI: number;
        paybackPeriod: string;
      }>;
    };
    
    riskAssessment: {
      financialRisks: Array<{
        risk: string;
        severity: 'high' | 'medium' | 'low';
        likelihood: 'high' | 'medium' | 'low';
        mitigation: string;
      }>;
      operationalRisks: Array<{
        risk: string;
        impact: string;
        mitigation: string;
      }>;
    };
    
    taxOptimization: {
      currentEffectiveRate: number;
      opportunities: Array<{
        strategy: string;
        potentialSaving: number;
        implementation: string;
        compliance: string;
      }>;
    };
  };
  
  metadata: {
    analysisTimestamp: string;
    modelUsed: string;
    confidenceScore: number;
    dataQuality: 'high' | 'medium' | 'low';
    limitations: string[];
  };
}

// PDF Generation Data Structure
export interface PDFReportData {
  header: {
    companyName: string;
    reportTitle: string;
    reportPeriod: string;
    generatedDate: string;
    logo?: string;
  };
  
  sections: Array<{
    title: string;
    content: PDFSectionContent;
    pageBreak?: boolean;
  }>;
  
  footer: {
    disclaimer?: string;
    confidentiality?: string;
    pageNumbers: boolean;
  };
  
  styling: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    fontSize: {
      header: number;
      subheader: number;
      body: number;
      footer: number;
    };
  };
}

export type PDFSectionContent = 
  | TextContent
  | TableContent
  | ChartContent
  | MetricCardContent
  | ListContent
  | MixedContent;

export interface TextContent {
  type: 'text';
  text: string;
  style?: 'normal' | 'bold' | 'italic' | 'heading';
}

export interface TableContent {
  type: 'table';
  headers: string[];
  rows: Array<Array<string | number>>;
  styling?: {
    headerBackground?: string;
    alternateRows?: boolean;
  };
}

export interface ChartContent {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'waterfall';
  data: any;
  options?: any;
}

export interface MetricCardContent {
  type: 'metricCard';
  metrics: Array<{
    label: string;
    value: string | number;
    change?: number;
    changeType?: 'increase' | 'decrease';
    icon?: string;
  }>;
}

export interface ListContent {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface MixedContent {
  type: 'mixed';
  components: Array<PDFSectionContent>;
}

// UI Component Data Structures
export interface DashboardData {
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    cashBalance: number;
    revenueGrowth: number;
    profitMargin: number;
  };
  
  charts: {
    revenueChart: ChartData;
    expenseChart: ChartData;
    cashFlowChart: ChartData;
    profitTrendChart: ChartData;
  };
  
  kpis: Array<{
    name: string;
    value: number | string;
    target?: number | string;
    trend: 'up' | 'down' | 'stable';
    status: 'good' | 'warning' | 'critical';
  }>;
  
  alerts: Array<{
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    action?: string;
  }>;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
  }>;
  options?: any;
}

export interface ReportSection {
  id: string;
  title: string;
  icon?: string;
  expanded: boolean;
  content: {
    summary?: string;
    details?: Array<{
      label: string;
      value: string | number;
      subItems?: Array<{
        label: string;
        value: string | number;
      }>;
    }>;
    chart?: ChartData;
    table?: TableContent;
    insights?: string[];
    recommendations?: string[];
  };
}