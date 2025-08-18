import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface FinancialData {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  revenueChange: number
  expenseChange: number
  netIncomeChange: number
  healthScore: number
  lastUpdated: string
  chartData: Array<{
    name: string
    revenue: number
    expenses: number
    profit: number
  }>
}

export function useFinancialData(companyId?: string) {
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) {
      setLoading(false)
      return
    }

    fetchFinancialData()
  }, [companyId])

  const fetchFinancialData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Mock data for demonstration - in real app this would come from Supabase
      // based on imported QuickBooks data
      const mockData: FinancialData = {
        totalRevenue: 125000,
        totalExpenses: 89000,
        netIncome: 36000,
        revenueChange: 12.5,
        expenseChange: 8.2,
        netIncomeChange: 22.1,
        healthScore: 78,
        lastUpdated: new Date().toISOString(),
        chartData: [
          { name: 'Jan', revenue: 18000, expenses: 12000, profit: 6000 },
          { name: 'Feb', revenue: 22000, expenses: 14000, profit: 8000 },
          { name: 'Mar', revenue: 19000, expenses: 13500, profit: 5500 },
          { name: 'Apr', revenue: 25000, expenses: 16000, profit: 9000 },
          { name: 'May', revenue: 21000, expenses: 15500, profit: 5500 },
          { name: 'Jun', revenue: 20000, expenses: 18000, profit: 2000 },
        ]
      }

      setData(mockData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, refetch: fetchFinancialData }
}