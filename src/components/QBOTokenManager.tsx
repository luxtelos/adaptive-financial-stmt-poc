/**
 * QBO Token Manager Component
 * 
 * Component for managing QuickBooks OAuth tokens with Supabase integration
 */

import React, { useState, useEffect } from 'react';
import { useQBOServices, QBOToken, QBOAdminChange } from '../lib/supabase-clerk';
import { useQuickBooks } from '../hooks/useQuickBooks';

interface TokenManagerProps {
  onTokenStored?: (success: boolean) => void;
  onError?: (error: Error) => void;
}

export const QBOTokenManager: React.FC<TokenManagerProps> = ({
  onTokenStored,
  onError,
}) => {
  const { 
    isLoaded, 
    isSignedIn, 
    userId,
    syncUser,
    getToken,
    revokeToken,
    getAdminChanges 
  } = useQBOServices();
  
  const {
    isConnected,
    currentToken,
    realmId,
    lastSync,
    connectQuickBooks,
    disconnect
  } = useQuickBooks();

  const [adminChanges, setAdminChanges] = useState<QBOAdminChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdminHistory, setShowAdminHistory] = useState(false);

  // Sync user on mount
  useEffect(() => {
    if (isSignedIn && userId) {
      syncUser().catch(console.error);
    }
  }, [isSignedIn, userId, syncUser]);

  const loadAdminHistory = async () => {
    if (!realmId) return;
    
    try {
      setLoading(true);
      const changes = await getAdminChanges(realmId);
      setAdminChanges(changes);
      setShowAdminHistory(true);
    } catch (error) {
      console.error('Failed to load admin history:', error);
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect QuickBooks?')) {
      return;
    }
    
    try {
      setLoading(true);
      await disconnect();
      onTokenStored?.(false);
    } catch (error) {
      console.error('Failed to disconnect:', error);
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const getTokenStatus = () => {
    if (!currentToken) return { status: 'disconnected', color: '#6c757d' };
    
    const expiresAt = new Date(currentToken.expires_at);
    const now = new Date();
    
    if (expiresAt <= now) {
      return { status: 'expired', color: '#dc3545' };
    }
    
    const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursLeft < 24) {
      return { status: 'expiring soon', color: '#ffc107' };
    }
    
    return { status: 'active', color: '#28a745' };
  };

  // Handle loading states
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading authentication...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Please sign in to manage QuickBooks connections</div>
      </div>
    );
  }

  const status = getTokenStatus();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">QuickBooks Connection</h2>
        <p className="text-gray-600 text-sm">User ID: {userId}</p>
      </div>

      {/* Connection Status Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Connection Status</h3>
            <div className="flex items-center gap-2">
              <span 
                className="inline-block px-3 py-1 rounded-full text-white text-sm font-medium"
                style={{ backgroundColor: status.color }}
              >
                {status.status.toUpperCase()}
              </span>
              {isConnected && currentToken && (
                <span className="text-gray-500 text-sm">
                  Company: {currentToken.company_name || 'Unknown'}
                </span>
              )}
            </div>
          </div>
          
          {!isConnected ? (
            <button
              onClick={connectQuickBooks}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect QuickBooks
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disconnect
            </button>
          )}
        </div>

        {isConnected && currentToken && (
          <div className="border-t pt-4 mt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Realm ID:</span>
                <p className="font-mono text-xs mt-1">{currentToken.realm_id}</p>
              </div>
              <div>
                <span className="text-gray-500">Environment:</span>
                <p className="mt-1">Production</p>
              </div>
              <div>
                <span className="text-gray-500">Connected:</span>
                <p className="mt-1">{new Date(currentToken.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-gray-500">Expires:</span>
                <p className="mt-1">{new Date(currentToken.expires_at).toLocaleString()}</p>
              </div>
              {lastSync && (
                <div className="col-span-2">
                  <span className="text-gray-500">Last Sync:</span>
                  <p className="mt-1">{new Date(lastSync).toLocaleString()}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={loadAdminHistory}
                disabled={loading}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                View Admin History
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Getting Started</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Click "Connect QuickBooks" to begin the authorization process</li>
            <li>Log in to your QuickBooks account</li>
            <li>Authorize the application to access your company data</li>
            <li>You'll be redirected back here once connected</li>
          </ol>
        </div>
      )}

      {/* Admin History Modal */}
      {showAdminHistory && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowAdminHistory(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Admin Change History</h3>
            
            <div className="space-y-3">
              {adminChanges.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No admin changes recorded</p>
              ) : (
                adminChanges.map((change) => (
                  <div key={change.id} className="border-b pb-3 last:border-b-0">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-gray-500">
                        {new Date(change.changed_at).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      {change.previous_clerk_id && (
                        <p>
                          <span className="text-gray-500">Previous Admin:</span>{' '}
                          <span className="font-mono text-xs">{change.previous_clerk_id}</span>
                        </p>
                      )}
                      <p>
                        <span className="text-gray-500">New Admin:</span>{' '}
                        <span className="font-mono text-xs">{change.new_clerk_id}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <button 
              onClick={() => setShowAdminHistory(false)}
              className="mt-6 w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-4">
            <div className="text-center">Loading...</div>
          </div>
        </div>
      )}
    </div>
  );
};