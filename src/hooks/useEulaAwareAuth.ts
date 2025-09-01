import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { EulaStorage } from '../utils/eulaStorage'
import logger from '../lib/logger'

export type AuthAction = 'signin' | 'signup' | 'dashboard'

export const useEulaAwareAuth = () => {
  const navigate = useNavigate()
  const { user, isLoaded } = useUser()
  const [showEulaModal, setShowEulaModal] = useState(false)
  const [pendingAuthAction, setPendingAuthAction] = useState<AuthAction | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [eulaChecked, setEulaChecked] = useState(false)
  const [hasAgreed, setHasAgreed] = useState(false)

  // Check EULA status when user state changes
  useEffect(() => {
    const checkEulaStatus = async () => {
      if (!isLoaded) return

      try {
        if (user?.id) {
          // User is signed in, check their specific EULA status
          const localAgreed = EulaStorage.hasAcceptedCurrentEula(user.id)
          
          if (localAgreed) {
            setHasAgreed(true)
            logger.debug(`EULA already agreed by user ${user.id}`)
          } else {
            setHasAgreed(false)
          }
          
          // Migrate any global acceptance to user-specific
          EulaStorage.migrateToUserSpecific(user.id)
        } else {
          // User not signed in, check global EULA acceptance
          const globalAgreed = EulaStorage.hasAcceptedCurrentEula()
          setHasAgreed(globalAgreed)
        }
      } catch (error) {
        logger.error('Error checking EULA status:', error)
        // Fall back to local storage check
        const fallbackAgreed = EulaStorage.hasAcceptedCurrentEula(user?.id)
        setHasAgreed(fallbackAgreed)
      } finally {
        setEulaChecked(true)
      }
    }

    checkEulaStatus()
  }, [user?.id, isLoaded])

  const handleAuthAction = useCallback((action: AuthAction) => {
    if (!eulaChecked) return // Wait for EULA check to complete

    // If user is already signed in, check their specific EULA status
    if (isLoaded && user) {
      if (hasAgreed) {
        // EULA already accepted by this user, navigate to dashboard
        navigate('/dashboard')
        return
      }
      // User signed in but no EULA acceptance, show modal
      setPendingAuthAction('dashboard') // Special case for signed-in users
      setShowEulaModal(true)
      return
    }

    // User not signed in, check global EULA acceptance
    if (hasAgreed) {
      // EULA already accepted globally, navigate directly to auth page
      navigate(action === 'signup' ? '/sign-up' : '/sign-in')
      return
    }

    // EULA not accepted, show modal first
    setPendingAuthAction(action)
    setShowEulaModal(true)
  }, [navigate, user, isLoaded, hasAgreed, eulaChecked])

  const handleEulaAgree = useCallback(async () => {
    setIsProcessing(true)
    
    try {
      if (isLoaded && user) {
        // User is signed in, record agreement in local storage
        EulaStorage.markEulaAccepted(user.id)
        logger.info(`EULA accepted by authenticated user ${user.id}`)
      } else {
        // User not signed in, mark globally for now
        EulaStorage.markEulaAccepted()
        logger.info('EULA accepted globally (user not authenticated)')
      }

      // Update local state
      setHasAgreed(true)

      // Close modal
      setShowEulaModal(false)

      // Navigate to the appropriate destination
      if (pendingAuthAction) {
        if (pendingAuthAction === 'dashboard') {
          navigate('/dashboard')
        } else {
          navigate(pendingAuthAction === 'signup' ? '/sign-up' : '/sign-in')
        }
      }

      // Reset state
      setPendingAuthAction(null)
    } catch (error) {
      logger.error('Error recording EULA agreement:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [navigate, pendingAuthAction, user, isLoaded])

  const handleEulaDisagree = useCallback(() => {
    // Clear any EULA acceptance (in case it was previously accepted)
    if (isLoaded && user) {
      EulaStorage.clearEulaAcceptance(user.id)
    } else {
      EulaStorage.clearEulaAcceptance()
    }

    // Close modal without proceeding with authentication
    setShowEulaModal(false)

    // Reset state
    setPendingAuthAction(null)
    
    logger.info('EULA disagreed, user redirected back')
  }, [user, isLoaded])

  const handleEulaClose = useCallback(() => {
    // Just close modal without any action
    setShowEulaModal(false)

    // Reset state
    setPendingAuthAction(null)
  }, [])

  // Helper function to check if Get Started should show EULA
  const shouldShowEulaForGetStarted = useCallback((): boolean => {
    if (!eulaChecked) return false // Wait for check to complete
    return !hasAgreed
  }, [hasAgreed, eulaChecked])

  // Helper function to handle Get Started button
  const handleGetStarted = useCallback(() => {
    if (!eulaChecked) return // Wait for EULA check to complete

    if (!hasAgreed) {
      // Show EULA modal
      setPendingAuthAction(isLoaded && user ? 'dashboard' : 'signin')
      setShowEulaModal(true)
    } else {
      // EULA already accepted, proceed directly
      if (isLoaded && user) {
        navigate('/dashboard')
      } else {
        navigate('/sign-in')
      }
    }
  }, [navigate, user, isLoaded, hasAgreed, eulaChecked])

  return {
    showEulaModal,
    pendingAuthAction,
    isProcessing,
    hasAgreed,
    eulaChecked,
    shouldShowEulaForGetStarted,
    handleAuthAction,
    handleGetStarted,
    handleEulaAgree,
    handleEulaDisagree,
    handleEulaClose,
  }
}