import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/toaster'
import { DemoHeader } from './components/layout/Header'
import { Badge } from './components/ui/badge'
import { Spinner } from './components/ui/spinner'
import { ClerkProvider } from '@clerk/clerk-react'
import { clerkConfig } from './config/clerk'
import { SignInPage } from './pages/SignInPage'
import { SignUpPage } from './pages/SignUpPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import EulaPage from './pages/EulaPage'
import PrivacyPage from './pages/PrivacyPage'
import EulaAgreementPage from './pages/EulaAgreementPage'
import { useEulaAwareAuth } from './hooks/useEulaAwareAuth'
import EulaModal from './components/legal/EulaModal'
import { Header } from './components/layout/Header'
import Footer from './components/ui/Footer'

// Lazy load components that require authentication or external services
const AuthenticatedApp = lazy(() => import('./components/AuthenticatedApp'))

// Landing Page Component (No external dependencies)
function LandingPage() {
  const navigate = useNavigate()
  const {
    showEulaModal,
    isProcessing,
    eulaChecked,
    handleGetStarted,
    handleEulaAgree,
    handleEulaDisagree,
    handleEulaClose,
  } = useEulaAwareAuth()

  // Check if app is configured (but don't initialize services)
  const checkConfiguration = () => {
    const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    const isConfigured = 
      clerkKey && clerkKey !== 'pk_test_your_clerk_publishable_key' &&
      supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co' &&
      supabaseKey && supabaseKey !== 'your_supabase_anon_key'
    
    return isConfigured
  }

  const handleGetStartedClick = () => {
    if (!checkConfiguration()) {
      navigate('/setup')
      return
    }
    
    // Use the EULA-aware get started handler
    handleGetStarted()
  }

  // Default Landing Page
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="h-20 w-20 bg-gradient-to-br from-primary-600 to-primary-400 rounded-2xl flex items-center justify-center shadow-2xl">
                <span className="text-white font-bold text-3xl">QA</span>
              </div>
            </div>
            
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              QuickBooks Analyzer
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              AI-powered financial analysis for CPAs. Import QuickBooks data, 
              get intelligent insights, and generate professional reports in seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={handleGetStartedClick}
                className="px-8"
                disabled={isProcessing || !eulaChecked}
              >
                {isProcessing ? 'Processing...' : !eulaChecked ? 'Loading...' : 'Get Started'}
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/demo')}
                className="px-8"
                disabled={isProcessing}
              >
                Try Demo
              </Button>
            </div>

            <div className="mt-8 flex justify-center gap-4">
              <Badge variant="secondary">No Server Required</Badge>
              <Badge variant="secondary">Secure & Private</Badge>
              <Badge variant="secondary">AI-Powered</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>QuickBooks Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Seamlessly connect to QuickBooks Online and import financial reports with one click.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>AI Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Powered by Perplexity Pro LLM for comprehensive financial insights and recommendations.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>PDF Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Generate professional PDF reports ready for clients and stakeholders.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* EULA Modal */}
      <EulaModal
        isOpen={showEulaModal}
        onAgree={handleEulaAgree}
        onDisagree={handleEulaDisagree}
        onClose={handleEulaClose}
      />
    </div>
  )
}

// Setup Guide Component
function SetupGuide() {
  const navigate = useNavigate()
  const missingConfigs = []
  
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  if (!clerkKey || clerkKey === 'pk_test_your_clerk_publishable_key') {
    missingConfigs.push('VITE_CLERK_PUBLISHABLE_KEY')
  }
  
  if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
    missingConfigs.push('VITE_SUPABASE_URL')
  }
  
  if (!supabaseKey || supabaseKey === 'your_supabase_anon_key') {
    missingConfigs.push('VITE_SUPABASE_ANON_KEY')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Setup Required</CardTitle>
          <CardDescription>
            Configure the following to enable full functionality:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {missingConfigs.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Missing Configuration:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {missingConfigs.map(config => (
                    <li key={config} className="text-sm font-mono">{config}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Quick Setup:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Copy <code className="bg-gray-100 px-1 rounded">.env.example</code> to <code className="bg-gray-100 px-1 rounded">.env</code></li>
                <li>Add your API keys</li>
                <li>Restart the development server</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => navigate('/')} variant="outline">
                Back
              </Button>
              <Button onClick={() => navigate('/demo')}>
                Continue with Demo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Demo Mode Component (No external dependencies)
function DemoMode() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <DemoHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Demo Mode
          </h1>
          <p className="text-gray-600">
            Explore the interface without configuration
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>QuickBooks Connection</CardTitle>
              <CardDescription>
                Simulated in demo mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled className="w-full">
                Connect QuickBooks (Demo)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Analysis</CardTitle>
              <CardDescription>
                Requires configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled className="w-full">
                Generate Report (Demo)
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Sample Financial Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold">$125,000</p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Expenses</p>
                  <p className="text-2xl font-bold">$85,000</p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Net Income</p>
                  <p className="text-2xl font-bold text-green-600">$40,000</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button onClick={() => navigate('/')} variant="outline">
            Back to Home
          </Button>
        </div>
      </main>
    </div>
  )
}

// Main App Component
function App() {
  const clerkPubKey = clerkConfig.publishableKey;
  const isConfigured = clerkPubKey && clerkPubKey !== "pk_test_your_clerk_publishable_key";

  const AppLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );

  if (!isConfigured) {
    // If Clerk is NOT configured
    return (
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/setup" element={<SetupGuide />} />
            <Route path="/demo" element={<DemoMode />} />
            <Route path="/eula" element={<EulaPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/eula-agreement" element={<EulaAgreementPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
        <Toaster />
      </Router>
    );
  }

  //  If Clerk IS configured
  return (
    <Router>
      <ClerkProvider
        publishableKey={clerkPubKey}
        appearance={clerkConfig.appearance}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      >
        <AppLayout>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/setup" element={<SetupGuide />} />
            <Route path="/demo" element={<DemoMode />} />
            <Route path="/eula" element={<EulaPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/eula-agreement" element={<EulaAgreementPage />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route
              path="/dashboard/*"
              element={
                <Suspense
                  fallback={
                    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                      <Spinner size="xl" />
                    </div>
                  }
                >
                  <AuthenticatedApp />
                </Suspense>
              }
            />
            <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
            <Route
              path="/callback"
              element={
                <Suspense fallback={<Spinner size="xl" />}>
                  <AuthenticatedApp />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </ClerkProvider>
      <Toaster />
    </Router>
  );
}

export default App