import logger from '../lib/logger'

const EULA_VERSION = '1.0'
const EULA_STORAGE_KEY = 'quickbooks-analyzer-eula-acceptance'
const EULA_USER_PREFIX = 'eula_accepted_user_'

interface EulaAcceptance {
  version: string
  acceptedAt: string
  userId?: string
}

export class EulaStorage {
  /**
   * Check if current EULA version has been accepted
   * Can check globally or for specific user
   */
  static hasAcceptedCurrentEula(userId?: string): boolean {
    try {
      if (userId) {
        // Check for specific user
        const userKey = `${EULA_USER_PREFIX}${userId}`
        const stored = localStorage.getItem(userKey)
        if (!stored) return false

        const acceptance: EulaAcceptance = JSON.parse(stored)
        return acceptance.version === EULA_VERSION
      } else {
        // Check global acceptance (for non-authenticated users)
        const stored = localStorage.getItem(EULA_STORAGE_KEY)
        if (!stored) return false

        const acceptance: EulaAcceptance = JSON.parse(stored)
        return acceptance.version === EULA_VERSION
      }
    } catch (error) {
      logger.error('Error checking EULA acceptance:', error)
      return false
    }
  }

  /**
   * Mark EULA as accepted
   * Can mark globally or for specific user
   */
  static markEulaAccepted(userId?: string): void {
    try {
      const acceptance: EulaAcceptance = {
        version: EULA_VERSION,
        acceptedAt: new Date().toISOString(),
        userId
      }

      if (userId) {
        // Store for specific user
        const userKey = `${EULA_USER_PREFIX}${userId}`
        localStorage.setItem(userKey, JSON.stringify(acceptance))
        logger.debug(`EULA acceptance marked for user ${userId}`)
      } else {
        // Store globally (for non-authenticated users)
        localStorage.setItem(EULA_STORAGE_KEY, JSON.stringify(acceptance))
        logger.debug('EULA acceptance marked globally')
      }
    } catch (error) {
      logger.error('Error marking EULA acceptance:', error)
    }
  }

  /**
   * Clear EULA acceptance
   * Can clear globally or for specific user
   */
  static clearEulaAcceptance(userId?: string): void {
    try {
      if (userId) {
        // Clear for specific user
        const userKey = `${EULA_USER_PREFIX}${userId}`
        localStorage.removeItem(userKey)
        logger.debug(`EULA acceptance cleared for user ${userId}`)
      } else {
        // Clear global acceptance
        localStorage.removeItem(EULA_STORAGE_KEY)
        logger.debug('Global EULA acceptance cleared')
      }
    } catch (error) {
      logger.error('Error clearing EULA acceptance:', error)
    }
  }

  /**
   * Get EULA acceptance details
   */
  static getEulaAcceptance(userId?: string): EulaAcceptance | null {
    try {
      const key = userId ? `${EULA_USER_PREFIX}${userId}` : EULA_STORAGE_KEY
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      logger.error('Error getting EULA acceptance:', error)
      return null
    }
  }

  /**
   * Get current EULA version
   */
  static getCurrentVersion(): string {
    return EULA_VERSION
  }

  /**
   * Check if a different version was previously accepted
   */
  static hasPreviousVersionAccepted(userId?: string): boolean {
    const acceptance = this.getEulaAcceptance(userId)
    return acceptance !== null && acceptance.version !== EULA_VERSION
  }

  /**
   * Migrate user acceptance when they sign in
   * Copies global acceptance to user-specific if exists
   */
  static migrateToUserSpecific(userId: string): void {
    try {
      // Check if global acceptance exists but user-specific doesn't
      const globalAcceptance = this.getEulaAcceptance()
      const userAcceptance = this.getEulaAcceptance(userId)

      if (globalAcceptance && !userAcceptance) {
        // Copy global acceptance to user-specific
        this.markEulaAccepted(userId)
        // Optionally clear global acceptance
        this.clearEulaAcceptance()
        logger.debug(`EULA acceptance migrated to user ${userId}`)
      }
    } catch (error) {
      logger.error('Error migrating EULA acceptance:', error)
    }
  }
}