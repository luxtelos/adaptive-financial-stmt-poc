import {
  QBOProfitLossData,
  QBOBalanceSheetData,
  QBOCashFlowData,
  QBOAgingReportData,
  QBOBudgetData,
  FinancialDataForLLM,
  ProfitLossStatement,
  BalanceSheetStatement,
  CashFlowStatement,
  AgingReport,
  BudgetVsActualReport,
  LLMAnalysisResponse,
  DashboardData,
  ReportSection,
  PDFReportData,
  ChartData,
  TableContent,
  MetricCardContent
} from '../types/financial.types';

export class DataTransformService {
  /**
   * Transform QBO API responses into normalized format for LLM
   */
  static transformQBOToLLMInput(
    qboData: {
      profitLoss: QBOProfitLossData;
      balanceSheet: QBOBalanceSheetData;
      cashFlow: QBOCashFlowData;
      arAging: QBOAgingReportData;
      apAging: QBOAgingReportData;
      budget?: QBOBudgetData;
      previousProfitLoss?: QBOProfitLossData;
      previousBalanceSheet?: QBOBalanceSheetData;
    },
    companyInfo: {
      name: string;
      id: string;
      industry?: string;
      size?: string;
    }
  ): FinancialDataForLLM {
    // Transform P&L
    const currentPL = this.transformProfitLoss(qboData.profitLoss);
    const previousPL = qboData.previousProfitLoss 
      ? this.transformProfitLoss(qboData.previousProfitLoss) 
      : undefined;
    
    // Transform Balance Sheet
    const currentBS = this.transformBalanceSheet(qboData.balanceSheet);
    const previousBS = qboData.previousBalanceSheet 
      ? this.transformBalanceSheet(qboData.previousBalanceSheet) 
      : undefined;
    
    // Transform Cash Flow
    const currentCF = this.transformCashFlow(qboData.cashFlow);
    
    // Transform Aging Reports
    const arAging = this.transformAgingReport(qboData.arAging);
    const apAging = this.transformAgingReport(qboData.apAging);
    
    // Transform Budget if available
    const budgetVsActual = qboData.budget 
      ? this.transformBudgetVsActual(qboData.budget, currentPL) 
      : undefined;
    
    // Calculate financial metrics
    const metrics = this.calculateFinancialMetrics(currentPL, currentBS, currentCF);
    
    // Calculate trends
    const trends = this.calculateTrends(qboData);
    
    return {
      metadata: {
        companyName: companyInfo.name,
        companyId: companyInfo.id,
        reportGeneratedAt: new Date().toISOString(),
        reportPeriod: {
          start: qboData.profitLoss.Header.StartPeriod,
          end: qboData.profitLoss.Header.EndPeriod
        },
        previousPeriod: previousPL ? {
          start: qboData.previousProfitLoss!.Header.StartPeriod,
          end: qboData.previousProfitLoss!.Header.EndPeriod
        } : undefined,
        currency: qboData.profitLoss.Header.Currency || 'USD',
        industry: companyInfo.industry,
        companySize: companyInfo.size
      },
      
      financialStatements: {
        profitLoss: {
          current: currentPL,
          previous: previousPL,
          variance: previousPL ? this.calculateVariance(currentPL.netIncome, previousPL.netIncome) : undefined
        },
        balanceSheet: {
          current: currentBS,
          previous: previousBS,
          variance: previousBS ? this.calculateVariance(currentBS.assets.totalAssets, previousBS.assets.totalAssets) : undefined
        },
        cashFlow: {
          current: currentCF,
          variance: undefined // Calculate if previous period available
        }
      },
      
      supplementaryReports: {
        accountsReceivable: arAging,
        accountsPayable: apAging,
        budgetVsActual
      },
      
      calculatedMetrics: metrics,
      trends,
      
      analysisContext: {
        reportType: 'comprehensive',
        focusAreas: [
          'profitability',
          'liquidity',
          'operational efficiency',
          'growth',
          'risk management'
        ],
        industryBenchmarks: companyInfo.industry ? this.getIndustryBenchmarks(companyInfo.industry) : undefined,
        specialConsiderations: []
      }
    };
  }
  
  /**
   * Transform QBO Profit & Loss to normalized format
   */
  private static transformProfitLoss(qboData: QBOProfitLossData): ProfitLossStatement {
    const extractValue = (row: any): number => {
      if (row.ColData && row.ColData.length > 0) {
        return parseFloat(row.ColData[0].value.replace(/[^0-9.-]/g, '')) || 0;
      }
      if (row.Summary && row.Summary.ColData) {
        return parseFloat(row.Summary.ColData[0].value.replace(/[^0-9.-]/g, '')) || 0;
      }
      return 0;
    };
    
    // Parse QBO rows structure - this is simplified, actual implementation needs careful mapping
    let revenue = { total: 0, breakdown: [] as any[] };
    let cogs = { total: 0, breakdown: [] as any[] };
    let opex = { total: 0, breakdown: [] as any[] };
    let otherIncome = { total: 0, breakdown: [] as any[] };
    let taxes = 0;
    
    // Traverse QBO row structure (simplified example)
    qboData.Rows.Row.forEach(row => {
      if (row.group === 'Income') {
        revenue.total = extractValue(row);
        if (row.Rows?.Row) {
          row.Rows.Row.forEach(subRow => {
            const value = extractValue(subRow);
            revenue.breakdown.push({
              category: subRow.ColData?.[0]?.value || 'Other',
              amount: value,
              percentage: 0 // Calculate after
            });
          });
        }
      } else if (row.group === 'COGS') {
        cogs.total = extractValue(row);
      } else if (row.group === 'Expenses') {
        opex.total = extractValue(row);
        if (row.Rows?.Row) {
          row.Rows.Row.forEach(subRow => {
            const value = extractValue(subRow);
            opex.breakdown.push({
              category: subRow.ColData?.[0]?.value || 'Other',
              amount: value,
              percentage: 0
            });
          });
        }
      }
    });
    
    // Calculate percentages
    revenue.breakdown = revenue.breakdown.map(item => ({
      ...item,
      percentage: revenue.total > 0 ? (item.amount / revenue.total) * 100 : 0
    }));
    
    opex.breakdown = opex.breakdown.map(item => ({
      ...item,
      percentage: revenue.total > 0 ? (item.amount / revenue.total) * 100 : 0
    }));
    
    const grossProfit = revenue.total - cogs.total;
    const operatingIncome = grossProfit - opex.total;
    const incomeBeforeTax = operatingIncome + otherIncome.total;
    const netIncome = incomeBeforeTax - taxes;
    
    return {
      revenue,
      costOfGoodsSold: cogs,
      grossProfit,
      operatingExpenses: opex,
      operatingIncome,
      otherIncomeExpenses: otherIncome,
      incomeBeforeTax,
      taxExpense: taxes,
      netIncome
    };
  }
  
  /**
   * Transform QBO Balance Sheet to normalized format
   */
  private static transformBalanceSheet(qboData: QBOBalanceSheetData): BalanceSheetStatement {
    // Similar extraction logic as P&L
    const extractValue = (row: any): number => {
      if (row.ColData && row.ColData.length > 0) {
        return parseFloat(row.ColData[0].value.replace(/[^0-9.-]/g, '')) || 0;
      }
      return 0;
    };
    
    // Initialize structure
    const assets = {
      current: {
        total: 0,
        cash: 0,
        accountsReceivable: 0,
        inventory: 0,
        otherCurrentAssets: 0
      },
      nonCurrent: {
        total: 0,
        propertyPlantEquipment: 0,
        intangibleAssets: 0,
        otherNonCurrentAssets: 0
      },
      totalAssets: 0
    };
    
    const liabilities = {
      current: {
        total: 0,
        accountsPayable: 0,
        shortTermDebt: 0,
        otherCurrentLiabilities: 0
      },
      nonCurrent: {
        total: 0,
        longTermDebt: 0,
        otherNonCurrentLiabilities: 0
      },
      totalLiabilities: 0
    };
    
    const equity = {
      total: 0,
      commonStock: 0,
      retainedEarnings: 0,
      otherEquity: 0
    };
    
    // Parse QBO balance sheet structure (simplified)
    qboData.Rows.Row.forEach(row => {
      if (row.group === 'Asset') {
        assets.totalAssets = extractValue(row);
      } else if (row.group === 'Liability') {
        liabilities.totalLiabilities = extractValue(row);
      } else if (row.group === 'Equity') {
        equity.total = extractValue(row);
      }
    });
    
    return { assets, liabilities, equity };
  }
  
  /**
   * Transform QBO Cash Flow to normalized format
   */
  private static transformCashFlow(qboData: QBOCashFlowData): CashFlowStatement {
    // Simplified transformation
    return {
      operatingActivities: {
        netIncome: 0,
        adjustments: [],
        workingCapitalChanges: {
          accountsReceivable: 0,
          inventory: 0,
          accountsPayable: 0,
          other: 0
        },
        netCashFromOperations: 0
      },
      investingActivities: {
        capitalExpenditures: 0,
        acquisitions: 0,
        assetSales: 0,
        otherInvesting: 0,
        netCashFromInvesting: 0
      },
      financingActivities: {
        debtProceeds: 0,
        debtRepayments: 0,
        equityIssuance: 0,
        dividendsPaid: 0,
        otherFinancing: 0,
        netCashFromFinancing: 0
      },
      netChangeInCash: 0,
      beginningCash: 0,
      endingCash: 0
    };
  }
  
  /**
   * Transform Aging Report
   */
  private static transformAgingReport(qboData: QBOAgingReportData): AgingReport {
    const extractValue = (value: string): number => {
      return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
    };
    
    let totalOutstanding = 0;
    let current = 0;
    let days1to30 = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let over90Days = 0;
    const details: any[] = [];
    
    // Parse aging buckets from column headers and rows
    const columns = qboData.Columns.Column;
    qboData.Rows.Row.forEach(row => {
      if (row.ColData && row.type !== 'Section') {
        const customerName = row.ColData[0]?.value || '';
        const amounts = row.ColData.slice(1).map(col => extractValue(col.value));
        
        if (amounts.length >= 5) {
          current += amounts[0];
          days1to30 += amounts[1];
          days31to60 += amounts[2];
          days61to90 += amounts[3];
          over90Days += amounts[4];
          
          const total = amounts.reduce((sum, val) => sum + val, 0);
          totalOutstanding += total;
          
          details.push({
            customerOrVendor: customerName,
            totalAmount: total,
            current: amounts[0],
            pastDue: total - amounts[0],
            daysOutstanding: 0 // Calculate based on weighted average
          });
        }
      }
    });
    
    return {
      totalOutstanding,
      current,
      days1to30,
      days31to60,
      days61to90,
      over90Days,
      details
    };
  }
  
  /**
   * Transform Budget vs Actual
   */
  private static transformBudgetVsActual(
    budget: QBOBudgetData,
    actual: ProfitLossStatement
  ): BudgetVsActualReport {
    const items: any[] = [];
    let totalBudgeted = 0;
    let totalActual = 0;
    
    // Map budget items to actual P&L categories
    budget.budgetDetails.forEach(budgetItem => {
      const actualAmount = this.findActualAmount(budgetItem.accountName, actual);
      const budgetedAmount = budgetItem.periods.reduce((sum, p) => sum + p.amount, 0);
      
      totalBudgeted += budgetedAmount;
      totalActual += actualAmount;
      
      items.push({
        category: budgetItem.accountName,
        budgeted: budgetedAmount,
        actual: actualAmount,
        variance: actualAmount - budgetedAmount,
        variancePercentage: budgetedAmount !== 0 
          ? ((actualAmount - budgetedAmount) / budgetedAmount) * 100 
          : 0
      });
    });
    
    return {
      period: `${budget.startDate} to ${budget.endDate}`,
      items,
      summary: {
        totalBudgeted,
        totalActual,
        totalVariance: totalActual - totalBudgeted,
        totalVariancePercentage: totalBudgeted !== 0 
          ? ((totalActual - totalBudgeted) / totalBudgeted) * 100 
          : 0
      }
    };
  }
  
  /**
   * Calculate comprehensive financial metrics
   */
  private static calculateFinancialMetrics(
    pl: ProfitLossStatement,
    bs: BalanceSheetStatement,
    cf: CashFlowStatement
  ) {
    return {
      liquidityRatios: {
        currentRatio: bs.liabilities.current.total > 0 
          ? bs.assets.current.total / bs.liabilities.current.total 
          : 0,
        quickRatio: bs.liabilities.current.total > 0 
          ? (bs.assets.current.total - bs.assets.current.inventory) / bs.liabilities.current.total 
          : 0,
        cashRatio: bs.liabilities.current.total > 0 
          ? bs.assets.current.cash / bs.liabilities.current.total 
          : 0,
        workingCapital: bs.assets.current.total - bs.liabilities.current.total
      },
      
      profitabilityRatios: {
        grossProfitMargin: pl.revenue.total > 0 
          ? (pl.grossProfit / pl.revenue.total) * 100 
          : 0,
        operatingMargin: pl.revenue.total > 0 
          ? (pl.operatingIncome / pl.revenue.total) * 100 
          : 0,
        netProfitMargin: pl.revenue.total > 0 
          ? (pl.netIncome / pl.revenue.total) * 100 
          : 0,
        returnOnAssets: bs.assets.totalAssets > 0 
          ? (pl.netIncome / bs.assets.totalAssets) * 100 
          : 0,
        returnOnEquity: bs.equity.total > 0 
          ? (pl.netIncome / bs.equity.total) * 100 
          : 0,
        ebitda: pl.operatingIncome, // Simplified - add D&A
        ebitdaMargin: pl.revenue.total > 0 
          ? (pl.operatingIncome / pl.revenue.total) * 100 
          : 0
      },
      
      efficiencyRatios: {
        assetTurnover: bs.assets.totalAssets > 0 
          ? pl.revenue.total / bs.assets.totalAssets 
          : 0,
        inventoryTurnover: bs.assets.current.inventory > 0 
          ? pl.costOfGoodsSold.total / bs.assets.current.inventory 
          : 0,
        receivablesTurnover: bs.assets.current.accountsReceivable > 0 
          ? pl.revenue.total / bs.assets.current.accountsReceivable 
          : 0,
        payablesTurnover: bs.liabilities.current.accountsPayable > 0 
          ? pl.costOfGoodsSold.total / bs.liabilities.current.accountsPayable 
          : 0,
        cashConversionCycle: 0 // Calculate based on above
      },
      
      leverageRatios: {
        debtToEquity: bs.equity.total > 0 
          ? bs.liabilities.totalLiabilities / bs.equity.total 
          : 0,
        debtToAssets: bs.assets.totalAssets > 0 
          ? bs.liabilities.totalLiabilities / bs.assets.totalAssets 
          : 0,
        interestCoverage: 0, // Need interest expense
        debtServiceCoverage: 0 // Need debt service details
      },
      
      growthMetrics: {
        revenueGrowthRate: 0, // Calculate with previous period
        profitGrowthRate: 0,
        assetGrowthRate: 0,
        customerGrowthRate: undefined
      }
    };
  }
  
  /**
   * Calculate trends from historical data
   */
  private static calculateTrends(qboData: any) {
    // Simplified - would need historical data
    return {
      monthlyRevenue: [],
      monthlyExpenses: [],
      monthlyProfit: [],
      monthlyCashFlow: []
    };
  }
  
  /**
   * Calculate variance between periods
   */
  private static calculateVariance(current: number, previous: number) {
    const amount = current - previous;
    const percentage = previous !== 0 ? (amount / previous) * 100 : 0;
    
    return {
      amount,
      percentage,
      trend: amount > 0 ? 'increase' as const : amount < 0 ? 'decrease' as const : 'stable' as const,
      significance: Math.abs(percentage) > 20 ? 'high' as const : 
                   Math.abs(percentage) > 10 ? 'medium' as const : 'low' as const
    };
  }
  
  /**
   * Get industry benchmarks
   */
  private static getIndustryBenchmarks(industry: string): Record<string, number> {
    // Industry-specific benchmarks - would come from database
    const benchmarks: Record<string, Record<string, number>> = {
      'technology': {
        grossMargin: 70,
        operatingMargin: 25,
        currentRatio: 2.0,
        debtToEquity: 0.5
      },
      'retail': {
        grossMargin: 35,
        operatingMargin: 10,
        currentRatio: 1.5,
        debtToEquity: 1.0
      },
      'manufacturing': {
        grossMargin: 30,
        operatingMargin: 15,
        currentRatio: 1.8,
        debtToEquity: 0.8
      }
    };
    
    return benchmarks[industry.toLowerCase()] || benchmarks['technology'];
  }
  
  /**
   * Find actual amount for budget comparison
   */
  private static findActualAmount(accountName: string, pl: ProfitLossStatement): number {
    // Map account names to P&L categories
    const revenueItem = pl.revenue.breakdown.find(item => 
      item.category.toLowerCase().includes(accountName.toLowerCase())
    );
    if (revenueItem) return revenueItem.amount;
    
    const expenseItem = pl.operatingExpenses.breakdown.find(item => 
      item.category.toLowerCase().includes(accountName.toLowerCase())
    );
    if (expenseItem) return expenseItem.amount;
    
    return 0;
  }
  
  /**
   * Parse LLM response and structure for UI
   */
  static parseLLMResponse(llmResponse: LLMAnalysisResponse): ReportSection[] {
    const sections: ReportSection[] = [
      {
        id: 'executive-summary',
        title: 'Executive Summary',
        icon: 'briefcase',
        expanded: true,
        content: {
          summary: llmResponse.choice.executiveSummary.keyHighlights.join(' '),
          details: [
            {
              label: 'Overall Health',
              value: llmResponse.choice.executiveSummary.overallHealth
            }
          ],
          insights: llmResponse.choice.executiveSummary.keyHighlights,
          recommendations: llmResponse.choice.executiveSummary.immediateActions
        }
      },
      
      {
        id: 'financial-performance',
        title: 'Financial Performance Snapshot',
        icon: 'chart-line',
        expanded: false,
        content: {
          details: [
            {
              label: 'Revenue Growth',
              value: `${llmResponse.choice.financialPerformanceSnapshot.revenueAnalysis.growthRate}%`,
              subItems: llmResponse.choice.financialPerformanceSnapshot.revenueAnalysis.keyDrivers.map(driver => ({
                label: driver,
                value: ''
              }))
            },
            {
              label: 'Gross Margin',
              value: `${llmResponse.choice.financialPerformanceSnapshot.profitabilityAnalysis.margins.gross}%`
            },
            {
              label: 'Operating Margin',
              value: `${llmResponse.choice.financialPerformanceSnapshot.profitabilityAnalysis.margins.operating}%`
            },
            {
              label: 'Net Margin',
              value: `${llmResponse.choice.financialPerformanceSnapshot.profitabilityAnalysis.margins.net}%`
            }
          ],
          insights: llmResponse.choice.financialPerformanceSnapshot.profitabilityAnalysis.insights
        }
      },
      
      {
        id: 'cash-flow',
        title: 'Cash Flow Analysis',
        icon: 'dollar-sign',
        expanded: false,
        content: {
          details: [
            {
              label: 'Operating Cash Flow',
              value: this.formatCurrency(llmResponse.choice.cashFlowAnalysis.operatingCashFlow.amount)
            },
            {
              label: 'Free Cash Flow',
              value: this.formatCurrency(llmResponse.choice.cashFlowAnalysis.freeCashFlow.amount)
            },
            {
              label: 'Current Ratio',
              value: llmResponse.choice.cashFlowAnalysis.liquidityPosition.currentRatio.toFixed(2)
            },
            {
              label: 'Quick Ratio',
              value: llmResponse.choice.cashFlowAnalysis.liquidityPosition.quickRatio.toFixed(2)
            }
          ],
          summary: llmResponse.choice.cashFlowAnalysis.liquidityPosition.assessment,
          insights: llmResponse.choice.cashFlowAnalysis.operatingCashFlow.insights
        }
      },
      
      {
        id: 'revenue-metrics',
        title: 'Revenue Metrics',
        icon: 'trending-up',
        expanded: false,
        content: {
          table: {
            type: 'table',
            headers: ['Revenue Stream', 'Amount', 'Percentage', 'Growth'],
            rows: llmResponse.choice.revenueMetrics.topRevenueStreams.map(stream => [
              stream.source,
              this.formatCurrency(stream.amount),
              `${stream.percentage}%`,
              `${stream.growth}%`
            ])
          },
          details: [
            {
              label: 'Customer Concentration Risk',
              value: llmResponse.choice.revenueMetrics.customerConcentration.risk
            },
            {
              label: 'Next Quarter Forecast',
              value: this.formatCurrency(llmResponse.choice.revenueMetrics.forecast.nextQuarter)
            }
          ]
        }
      },
      
      {
        id: 'expense-review',
        title: 'Expense Review',
        icon: 'receipt',
        expanded: false,
        content: {
          table: {
            type: 'table',
            headers: ['Category', 'Amount', '% of Revenue', 'Trend'],
            rows: llmResponse.choice.expenseReview.majorExpenses.map(expense => [
              expense.category,
              this.formatCurrency(expense.amount),
              `${expense.percentageOfRevenue}%`,
              expense.trend
            ])
          },
          recommendations: llmResponse.choice.expenseReview.costSavingOpportunities.map(
            opp => `${opp.area}: Save ${this.formatCurrency(opp.potentialSaving)} - ${opp.implementation}`
          )
        }
      },
      
      {
        id: 'kpi-dashboard',
        title: 'KPI Dashboard',
        icon: 'gauge',
        expanded: false,
        content: {
          details: llmResponse.choice.kpiDashboard.financialKPIs.map(kpi => ({
            label: kpi.metric,
            value: kpi.value.toString(),
            subItems: [
              { label: 'Benchmark', value: kpi.benchmark.toString() },
              { label: 'Status', value: kpi.status },
              { label: 'Trend', value: kpi.trend }
            ]
          }))
        }
      },
      
      {
        id: 'working-capital',
        title: 'Working Capital & Liquidity',
        icon: 'wallet',
        expanded: false,
        content: {
          details: [
            {
              label: 'Working Capital',
              value: this.formatCurrency(llmResponse.choice.workingCapitalLiquidity.workingCapital.amount)
            },
            {
              label: 'Cash Conversion Cycle',
              value: `${llmResponse.choice.workingCapitalLiquidity.cashConversionCycle.days} days`
            },
            {
              label: 'Days Inventory',
              value: `${llmResponse.choice.workingCapitalLiquidity.cashConversionCycle.components.daysInventory} days`
            },
            {
              label: 'Days Receivables',
              value: `${llmResponse.choice.workingCapitalLiquidity.cashConversionCycle.components.daysReceivables} days`
            },
            {
              label: 'Days Payables',
              value: `${llmResponse.choice.workingCapitalLiquidity.cashConversionCycle.components.daysPayables} days`
            }
          ],
          recommendations: llmResponse.choice.workingCapitalLiquidity.creditManagement.recommendations
        }
      },
      
      {
        id: 'year-over-year',
        title: 'Year-over-Year Analysis',
        icon: 'calendar',
        expanded: false,
        content: {
          details: [
            {
              label: 'Revenue Growth',
              value: `${llmResponse.choice.yearOverYearAnalysis.revenueGrowth.percentage}%`
            },
            {
              label: 'Expense Growth',
              value: `${llmResponse.choice.yearOverYearAnalysis.expenseGrowth.percentage}%`
            },
            {
              label: 'Profit Growth',
              value: `${llmResponse.choice.yearOverYearAnalysis.profitGrowth.percentage}%`
            }
          ],
          insights: [
            ...llmResponse.choice.yearOverYearAnalysis.revenueGrowth.drivers,
            ...llmResponse.choice.yearOverYearAnalysis.balanceSheetChanges.keyChanges
          ]
        }
      },
      
      {
        id: 'budget-vs-actual',
        title: 'Budget vs. Actual',
        icon: 'target',
        expanded: false,
        content: {
          details: [
            {
              label: 'Overall Variance',
              value: this.formatCurrency(llmResponse.choice.budgetVsActual.overallVariance.amount)
            },
            {
              label: 'Variance Percentage',
              value: `${llmResponse.choice.budgetVsActual.overallVariance.percentage}%`
            }
          ],
          table: {
            type: 'table',
            headers: ['Category', 'Budget', 'Actual', 'Variance'],
            rows: llmResponse.choice.budgetVsActual.majorVariances.map(variance => [
              variance.category,
              this.formatCurrency(variance.budgeted),
              this.formatCurrency(variance.actual),
              this.formatCurrency(variance.variance)
            ])
          }
        }
      },
      
      {
        id: 'forward-outlook',
        title: 'Forward Outlook',
        icon: 'eye',
        expanded: false,
        content: {
          summary: llmResponse.choice.forwardOutlook.shortTermOutlook.assessment,
          details: [
            {
              label: 'Revenue Projection',
              value: this.formatCurrency(llmResponse.choice.forwardOutlook.longTermProjections.revenueProjection)
            },
            {
              label: 'Profit Projection',
              value: this.formatCurrency(llmResponse.choice.forwardOutlook.longTermProjections.profitProjection)
            }
          ],
          recommendations: llmResponse.choice.forwardOutlook.strategicRecommendations.map(
            rec => `${rec.priority.toUpperCase()}: ${rec.recommendation} - ${rec.expectedImpact}`
          ),
          insights: llmResponse.choice.forwardOutlook.shortTermOutlook.opportunities
        }
      }
    ];
    
    return sections;
  }
  
  /**
   * Prepare data for dashboard display
   */
  static prepareDashboardData(
    llmResponse: LLMAnalysisResponse,
    financialData: FinancialDataForLLM
  ): DashboardData {
    return {
      summary: {
        totalRevenue: financialData.financialStatements.profitLoss.current.revenue.total,
        totalExpenses: financialData.financialStatements.profitLoss.current.operatingExpenses.total,
        netIncome: financialData.financialStatements.profitLoss.current.netIncome,
        cashBalance: financialData.financialStatements.balanceSheet.current.assets.current.cash,
        revenueGrowth: llmResponse.choice.yearOverYearAnalysis.revenueGrowth.percentage,
        profitMargin: llmResponse.choice.financialPerformanceSnapshot.profitabilityAnalysis.margins.net
      },
      
      charts: {
        revenueChart: this.prepareRevenueChart(financialData),
        expenseChart: this.prepareExpenseChart(financialData),
        cashFlowChart: this.prepareCashFlowChart(financialData),
        profitTrendChart: this.prepareProfitTrendChart(financialData)
      },
      
      kpis: llmResponse.choice.kpiDashboard.financialKPIs.map(kpi => ({
        name: kpi.metric,
        value: kpi.value,
        target: kpi.benchmark,
        trend: kpi.trend === 'improving' ? 'up' as const : 
               kpi.trend === 'declining' ? 'down' as const : 'stable' as const,
        status: kpi.status === 'above' ? 'good' as const :
                kpi.status === 'below' ? 'critical' as const : 'warning' as const
      })),
      
      alerts: [
        ...llmResponse.choice.executiveSummary.criticalIssues.map(issue => ({
          type: 'error' as const,
          title: 'Critical Issue',
          message: issue,
          action: 'Review immediately'
        })),
        ...llmResponse.choice.executiveSummary.immediateActions.map(action => ({
          type: 'warning' as const,
          title: 'Action Required',
          message: action,
          action: 'Take action'
        }))
      ]
    };
  }
  
  /**
   * Prepare data for PDF generation
   */
  static preparePDFData(
    sections: ReportSection[],
    companyInfo: any,
    llmResponse: LLMAnalysisResponse
  ): PDFReportData {
    return {
      header: {
        companyName: companyInfo.name,
        reportTitle: 'Comprehensive Financial Analysis Report',
        reportPeriod: `${companyInfo.periodStart} to ${companyInfo.periodEnd}`,
        generatedDate: new Date().toLocaleDateString(),
        logo: companyInfo.logo
      },
      
      sections: sections.map(section => ({
        title: section.title,
        content: this.convertSectionToPDFContent(section),
        pageBreak: ['executive-summary', 'cash-flow', 'forward-outlook'].includes(section.id)
      })),
      
      footer: {
        disclaimer: 'This report is generated based on available financial data and AI analysis. Please consult with financial professionals for critical decisions.',
        confidentiality: 'Confidential - For internal use only',
        pageNumbers: true
      },
      
      styling: {
        primaryColor: '#1e40af',
        secondaryColor: '#3b82f6',
        fontFamily: 'Helvetica',
        fontSize: {
          header: 24,
          subheader: 18,
          body: 11,
          footer: 9
        }
      }
    };
  }
  
  /**
   * Convert section to PDF content format
   */
  private static convertSectionToPDFContent(section: ReportSection): any {
    const components: any[] = [];
    
    if (section.content.summary) {
      components.push({
        type: 'text',
        text: section.content.summary,
        style: 'normal'
      });
    }
    
    if (section.content.details) {
      const metrics: MetricCardContent = {
        type: 'metricCard',
        metrics: section.content.details.map(detail => ({
          label: detail.label,
          value: detail.value
        }))
      };
      components.push(metrics);
    }
    
    if (section.content.table) {
      components.push(section.content.table);
    }
    
    if (section.content.chart) {
      components.push({
        type: 'chart',
        chartType: 'bar',
        data: section.content.chart
      });
    }
    
    if (section.content.insights && section.content.insights.length > 0) {
      components.push({
        type: 'list',
        ordered: false,
        items: section.content.insights
      });
    }
    
    if (section.content.recommendations && section.content.recommendations.length > 0) {
      components.push({
        type: 'text',
        text: 'Recommendations:',
        style: 'bold'
      });
      components.push({
        type: 'list',
        ordered: true,
        items: section.content.recommendations
      });
    }
    
    return {
      type: 'mixed',
      components
    };
  }
  
  // Chart preparation methods
  private static prepareRevenueChart(data: FinancialDataForLLM): ChartData {
    return {
      labels: data.trends.monthlyRevenue.map(item => item.month),
      datasets: [{
        label: 'Monthly Revenue',
        data: data.trends.monthlyRevenue.map(item => item.amount),
        backgroundColor: '#3b82f6',
        borderColor: '#1e40af',
        borderWidth: 1
      }]
    };
  }
  
  private static prepareExpenseChart(data: FinancialDataForLLM): ChartData {
    const expenses = data.financialStatements.profitLoss.current.operatingExpenses.breakdown;
    return {
      labels: expenses.map(e => e.category),
      datasets: [{
        label: 'Operating Expenses',
        data: expenses.map(e => e.amount),
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
      }]
    };
  }
  
  private static prepareCashFlowChart(data: FinancialDataForLLM): ChartData {
    return {
      labels: ['Operating', 'Investing', 'Financing'],
      datasets: [{
        label: 'Cash Flow',
        data: [
          data.financialStatements.cashFlow.current.operatingActivities.netCashFromOperations,
          data.financialStatements.cashFlow.current.investingActivities.netCashFromInvesting,
          data.financialStatements.cashFlow.current.financingActivities.netCashFromFinancing
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#3b82f6']
      }]
    };
  }
  
  private static prepareProfitTrendChart(data: FinancialDataForLLM): ChartData {
    return {
      labels: data.trends.monthlyProfit.map(item => item.month),
      datasets: [{
        label: 'Monthly Profit',
        data: data.trends.monthlyProfit.map(item => item.amount),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true
      }]
    };
  }
  
  /**
   * Format currency for display
   */
  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}