import React from 'react'
import { SignIn } from '@clerk/clerk-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="glass-morphism border-0">
          <CardHeader className="text-center pb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-primary-600 to-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-white font-bold text-2xl">QA</span>
            </div>
            <CardTitle className="text-3xl font-bold text-gradient">
              QuickBooks Analyzer
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Professional financial analysis powered by AI for CPAs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignIn 
              appearance={{
                elements: {
                  formButtonPrimary: 'bg-primary-600 hover:bg-primary-700',
                  footerActionLink: 'text-primary-600 hover:text-primary-700',
                  card: 'shadow-none bg-transparent',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton: 'bg-white hover:bg-gray-50 border border-gray-300',
                  formFieldInput: 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
                },
              }}
              fallbackRedirectUrl="/dashboard"
              forceRedirectUrl="/dashboard"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}