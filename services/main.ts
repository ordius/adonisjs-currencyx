/*
 * @ordius/adonisjs-currencyx
 *
 * (c) Mixxtor
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import app from '@adonisjs/core/services/app'
import type { CurrencyService } from '../src/types.js'

/**
 * Currency service with full type inference
 *
 * Usage:
 * ```ts
 * import currency from '@ordius/adonisjs-currencyx/services/currency'
 *
 * // Direct usage - no type casting needed
 * const rates = await currency.latestRates()
 *
 * // Provider switching with type inference
 * const googleProvider = currency.use('google')  // Only configured providers
 * const rates = await googleProvider.latestRates()
 * ```
 */

/**
 * Typed per exchange name: `currency.use('database')` is the `DatabaseExchange` itself, so its own
 * methods (`clearCache()`, `refreshCurrencyData()`) are reachable without a cast.
 */
let currency: CurrencyService

await app.booted(async () => {
  currency = await app.container.make('currency.manager')
})

export { currency as default }
