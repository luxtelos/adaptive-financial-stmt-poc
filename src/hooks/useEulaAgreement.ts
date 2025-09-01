import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { EulaStorage } from '../utils/eulaStorage'
import logger from '../lib/logger'

export interface UseEulaAgreementReturn {
  hasAgreed: boolean
  isLoading: boolean
  recordAgreement: () => Promise<boolean>
  checkAgreement: () => Promise<void>
}

export const useEulaAgreement = (): UseEulaAgreementReturn => {
  const { user, isLoaded } = useUser()
  const [hasAgreed, setHasAgreed] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const checkAgreement = async () => {
    if (!isLoaded) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      
      if (user?.id) {
        // User is signed in, check local storage
        const localAgreed = EulaStorage.hasAcceptedCurrentEula(user.id)
        setHasAgreed(localAgreed)
        logger.debug(`EULA agreement status for user ${user.id}: ${localAgreed}`)
        
        // Migrate any global acceptance to user-specific
        EulaStorage.migrateToUserSpecific(user.id)
      } else {
        // User not signed in, check global local storage only
        const globalAgreed = EulaStorage.hasAcceptedCurrentEula()
        setHasAgreed(globalAgreed)
        logger.debug(`Global EULA agreement status: ${globalAgreed}`)
      }
    } catch (error) {
      logger.error('Error checking EULA agreement:', error)
      // Fall back to local storage check
      const userId = user?.id
      const fallbackAgreed = EulaStorage.hasAcceptedCurrentEula(userId)
      setHasAgreed(fallbackAgreed)
    } finally {
      setIsLoading(false)
    }
  }

  const recordAgreement = async (): Promise<boolean> => {
    try {
      if (user?.id) {
        // User is signed in, record in local storage
        EulaStorage.markEulaAccepted(user.id)
        setHasAgreed(true)
        logger.info(`EULA agreement recorded for user ${user.id}`)
        return true
      } else {
        // User not signed in, record globally in local storage
        EulaStorage.markEulaAccepted()
        setHasAgreed(true)
        logger.info('EULA agreement recorded globally in local storage')
        return true
      }
    } catch (error) {
      logger.error('Error recording EULA agreement:', error)
      return false
    }
  }

  // Check agreement status when user loads
  useEffect(() => {
    checkAgreement()
  }, [isLoaded, user?.id])

  return {
    hasAgreed,
    isLoading,
    recordAgreement,
    checkAgreement
  }
}