import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { CalendarIcon } from '@radix-ui/react-icons'
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatPercentage } from '../../lib/utils'

interface StatCardProps {
  title: string
  value: string
  change?: number
  changeType?: 'increase' | 'decrease'
  icon: React.ReactNode
  color?: 'default' | 'success' | 'warning' | 'error'
}

function StatCard({ title, value, change, changeType, icon, color = 'default' }: StatCardProps) {
  const colorClasses = {
    default: 'text-gray-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    error: 'text-error-600'
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={colorClasses[color]}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {change !== undefined && (
          <div className="flex items-center mt-1">
            {changeType === 'increase' ? (
              <TrendingUp className="h-4 w-4 text-success-600 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-error-600 mr-1" />
            )}
            <span className={`text-sm ${changeType === 'increase' ? 'text-success-600' : 'text-error-600'}`}>
              {formatPercentage(Math.abs(change))} from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface DashboardStatsProps {
  stats?: {
    totalRevenue: number
    revenueChange: number
    totalExpenses: number
    expenseChange: number
    netIncome: number
    netIncomeChange: number
    healthScore: number
    lastUpdated: string
  }
}

export function DashboardStats({ stats }: DashboardStatsProps = {}) {
  // Default stats when no data is available
  const defaultStats = {
    totalRevenue: 0,
    revenueChange: 0,
    totalExpenses: 0,
    expenseChange: 0,
    netIncome: 0,
    netIncomeChange: 0,
    healthScore: 0,
    lastUpdated: new Date().toISOString()
  }

  const displayStats = stats || defaultStats

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Revenue"
        value={formatCurrency(displayStats.totalRevenue)}
        change={displayStats.revenueChange}
        changeType={displayStats.revenueChange >= 0 ? 'increase' : 'decrease'}
        icon={<DollarSign className="h-4 w-4" />}
        color="success"
      />
      <StatCard
        title="Total Expenses"
        value={formatCurrency(displayStats.totalExpenses)}
        change={displayStats.expenseChange}
        changeType={displayStats.expenseChange >= 0 ? 'increase' : 'decrease'}
        icon={<TrendingDown className="h-4 w-4" />}
        color="error"
      />
      <StatCard
        title="Net Income"
        value={formatCurrency(displayStats.netIncome)}
        change={displayStats.netIncomeChange}
        changeType={displayStats.netIncomeChange >= 0 ? 'increase' : 'decrease'}
        icon={<TrendingUp className="h-4 w-4" />}
        color={displayStats.netIncome >= 0 ? 'success' : 'error'}
      />
      <StatCard
        title="Health Score"
        value={`${displayStats.healthScore}/100`}
        icon={<CalendarIcon className="h-4 w-4" />}
        color={displayStats.healthScore >= 80 ? 'success' : displayStats.healthScore >= 60 ? 'warning' : 'error'}
      />
    </div>
  )
}