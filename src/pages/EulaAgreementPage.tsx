import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Spinner } from '../components/ui/spinner'
import EulaContent from '../components/legal/EulaContent'
import { useEulaAgreement } from '../hooks/useEulaAgreement'

const EulaAgreementPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { recordAgreement } = useEulaAgreement()
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Get the redirect URL from state (where to go after agreement)
  const redirectTo = location.state?.redirectTo || '/sign-in'

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const hasReachedBottom = scrollTop + clientHeight >= scrollHeight - 10
    setIsScrolledToBottom(hasReachedBottom)
  }

  const handleAgree = async () => {
    setIsProcessing(true)
    try {
      const success = await recordAgreement()
      if (success) {
        // Navigate to the intended destination
        navigate(redirectTo)
      } else {
        // Show error - for now just alert, you might want a toast
        alert('Failed to record agreement. Please try again.')
      }
    } catch (error) {
      console.error('Error recording EULA agreement:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDisagree = () => {
    // Navigate back to home page
    navigate('/')
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="lg" />
            <h2 className="text-xl font-semibold">Recording Agreement</h2>
            <p className="text-gray-600 text-center">
              Please wait while we process your agreement...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="glass-morphism border-0 shadow-2xl">
            <CardHeader className="text-center pb-8">
              <div className="h-16 w-16 bg-gradient-to-br from-primary-600 to-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-white font-bold text-2xl">QA</span>
              </div>
              <CardTitle className="text-3xl font-bold text-gradient mb-2">
                End User License Agreement
              </CardTitle>
              <p className="text-gray-600">
                Please read and agree to the terms before continuing
              </p>
            </CardHeader>
            
            <CardContent className="px-8 pb-8">
              <div 
                className="max-h-96 overflow-y-auto bg-gray-50 p-6 rounded-lg border"
                onScroll={handleScroll}
              >
                <EulaContent headingLevel="h3" />
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    {!isScrolledToBottom && (
                      <span className="text-orange-600 font-medium">
                        📜 Please scroll to the bottom to continue
                      </span>
                    )}
                    {isScrolledToBottom && (
                      <span className="text-green-600 font-medium">
                        ✅ By clicking "I Agree", you accept the terms of this agreement
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={handleDisagree}
                    variant="outline"
                    className="px-8"
                    disabled={isProcessing}
                  >
                    I Disagree
                  </Button>
                  <Button
                    onClick={handleAgree}
                    disabled={!isScrolledToBottom || isProcessing}
                    className={`px-8 ${
                      isScrolledToBottom && !isProcessing
                        ? ""
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    I Agree & Continue
                  </Button>
                </div>
                
                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="text-sm text-gray-500 hover:text-gray-700"
                    disabled={isProcessing}
                  >
                    ← Back to Home
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default EulaAgreementPage