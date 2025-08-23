import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { 
  CheckCircledIcon, 
  CrossCircledIcon, 
  Link2Icon,
  InfoCircledIcon
} from '@radix-ui/react-icons'
import { useToast } from '../../hooks/useToast'
import { useQuickBooks } from '../../hooks/useQuickBooks'

interface QuickBooksConnectionProps {
  companyId?: string
}

export function QuickBooksConnection({ companyId }: QuickBooksConnectionProps) {
  const { toast } = useToast()
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)
  const {
    isConnected,
    lastSync,
    currentToken,
    connectQuickBooks,
    disconnect
  } = useQuickBooks()

  const handleConnect = async () => {
    try {
      await connectQuickBooks()
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to QuickBooks. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect QuickBooks?')) {
      return
    }

    setIsDisconnecting(true)
    try {
      await disconnect()
      toast({
        title: 'Disconnected',
        description: 'QuickBooks has been disconnected',
      })
      // Force a small delay to ensure state updates
      setTimeout(() => {
        setIsDisconnecting(false)
      }, 100)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect QuickBooks',
        variant: 'destructive',
      })
      setIsDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Badge variant="outline" className="mr-2">Optional</Badge>
              QuickBooks Connection
            </CardTitle>
            <CardDescription>
              {isConnected && currentToken?.company_name ? (
                <span className="flex items-center gap-2 mt-2">
                  <InfoCircledIcon className="h-3 w-3" />
                  Connected to: {currentToken.company_name}
                </span>
              ) : (
                'Connect your QuickBooks Online account to enable automatic data import'
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge className="bg-success-600">
                <CheckCircledIcon className="mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <CrossCircledIcon className="mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isConnected && !isDisconnecting ? (
          <div className="space-y-4">
            {lastSync && (
              <div className="text-sm text-gray-600">
                Last synced: {new Date(lastSync).toLocaleString()}
              </div>
            )}
            {currentToken?.company_name && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-900">Company Information</div>
                <div className="text-sm text-gray-600 mt-1">{currentToken.company_name}</div>
                <div className="text-xs text-gray-500 mt-2">Realm ID: {currentToken.realm_id}</div>
              </div>
            )}
            <Button 
              onClick={handleDisconnect} 
              variant="outline"
              className="w-full"
              disabled={isDisconnecting}
            >
              <CrossCircledIcon className="mr-2" />
              Disconnect QuickBooks
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-900">
                <strong>Note:</strong> You'll be redirected to QuickBooks to authorize access to your financial data.
              </div>
            </div>
            <Button 
              onClick={handleConnect}
              className="w-full"
              size="lg"
            >
              <Link2Icon className="mr-2" />
              Connect to QuickBooks
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}