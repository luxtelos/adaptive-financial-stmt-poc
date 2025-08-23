import React from 'react'
import { SignIn, SignUp, useUser, RedirectToSignIn } from '@clerk/clerk-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'

interface AuthWrapperProps {
  children: React.ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoaded, isSignedIn } = useUser()

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    )
  }

  if (!isSignedIn) {
    // Use RedirectToSignIn which handles the Clerk authentication flow properly
    return <RedirectToSignIn />
  }

  return <>{children}</>
}