import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { formatCurrency } from '../../lib/utils'

interface ChartData {
  name: string
  revenue: number
  expenses: number
  profit: number
}

interface FinancialChartProps {
  data: ChartData[]
  title: string
  description?: string
}

export function FinancialChart({ data, title, description }: FinancialChartProps) {
  const maxValue = Math.max(...data.map(d => Math.max(d.revenue, d.expenses)))
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-900">{item.name}</span>
                <span className="text-gray-600">
                  {formatCurrency(item.profit)}
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center">
                  <div className="w-16 text-xs text-gray-500">Revenue</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 ml-2">
                    <div 
                      className="bg-success-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(item.revenue / maxValue) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 text-xs text-gray-600 text-right ml-2">
                    {formatCurrency(item.revenue)}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-16 text-xs text-gray-500">Expenses</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 ml-2">
                    <div 
                      className="bg-error-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(item.expenses / maxValue) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 text-xs text-gray-600 text-right ml-2">
                    {formatCurrency(item.expenses)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}