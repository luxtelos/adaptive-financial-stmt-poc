import React from 'react'
import { Button } from '../ui/button'
import { GearIcon, PersonIcon, ExitIcon, DashboardIcon, FileTextIcon } from '@radix-ui/react-icons'
import { cn } from '../../lib/utils'
import { useUser, useClerk } from '@clerk/clerk-react'
import { Badge } from '../ui/badge'

// Header for Demo Mode (without Clerk)
export function DemoHeader() {
  return (
    <header className="bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-br from-primary-600 to-primary-400 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">QA</span>
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gradient">
                  QuickBooks Analyzer
                </h1>
                <p className="text-xs text-gray-500">Demo Mode</p>
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-6">
            <a href="/dashboard" className="flex items-center text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
              <DashboardIcon className="h-4 w-4 mr-1.5" />
              Dashboard
            </a>
            <a href="#reports" className="flex items-center text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
              <FileTextIcon className="h-4 w-4 mr-1.5" />
              Reports
            </a>
            <Badge variant="secondary" className="ml-2">
              Demo
            </Badge>
          </nav>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-1.5">
              <div className="h-8 w-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white font-medium">
                D
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  Demo User
                </p>
                <p className="text-xs text-gray-500">
                  demo@example.com
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => window.location.href = '/'}
              title="Exit Demo"
            >
              <ExitIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

// Original Header (with Clerk)
export function Header() {
  const { user } = useUser()
  const { signOut } = useClerk()
  
  return (
    <header className="bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-br from-primary-600 to-primary-400 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">QA</span>
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gradient">
                  QuickBooks Analyzer
                </h1>
                <p className="text-xs text-gray-500">Powered by AI</p>
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-6">
            <a href="/dashboard" className="flex items-center text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
              <DashboardIcon className="h-4 w-4 mr-1.5" />
              Dashboard
            </a>
            <a href="#reports" className="flex items-center text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors">
              <FileTextIcon className="h-4 w-4 mr-1.5" />
              Reports
            </a>
            <Badge variant="secondary" className="ml-2">
              Beta
            </Badge>
          </nav>

          <div className="flex items-center space-x-4">
            {user && (
              <>
                <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-1.5">
                  <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                    {user.firstName?.charAt(0) || user.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">
                      {user.fullName || user.firstName || 'User'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user.emailAddresses[0]?.emailAddress}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => signOut()}
                  title="Sign Out"
                >
                  <ExitIcon className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}