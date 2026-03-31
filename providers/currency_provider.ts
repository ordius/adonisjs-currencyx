/**
 * @ordius/adonisjs-currencyx
 *
 * (c) Mixxtor
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ApplicationService } from '@adonisjs/core/types'
import type CurrencyService from '@mixxtor/currencyx-js'
import { createCurrency } from '@mixxtor/currencyx-js'
import type { CurrencyConfig } from '../src/types.js'
import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@adonisjs/core/exceptions'

/**
 * Extend AdonisJS container bindings with currency service
 */
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'currency.manager': CurrencyService
  }
}

export default class CurrencyProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register currency service
   */
  async register() {
    this.app.container.singleton('currency.manager', async () => {
      const currencyConfigProvider = this.app.config.get<CurrencyConfig>('currency')

      if (!currencyConfigProvider) {
        throw new RuntimeException(
          'Currency configuration not found. Make sure you have a "config/currency.ts" file with "defineConfig" export'
        )
      }

      const config = await configProvider.resolve<CurrencyConfig>(this.app, currencyConfigProvider)
      if (!config) {
        throw new RuntimeException(
          'Invalid "config/currency.ts" file. Make sure you are using the "defineConfig" method'
        )
      }

      // Create currency service with all providers
      return createCurrency(config)
    })
  }

  /**
   * Boot the provider
   */
  async boot() {
    // Nothing to boot
  }

  /**
   * Shutdown the provider
   */
  async shutdown() {
    // Nothing to shutdown
  }
}
