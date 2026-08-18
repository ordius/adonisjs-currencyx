import { type CacheOptions, type CacheService } from '@adonisjs/cache/types'
import { type ApplicationService, type ConfigProvider } from '@adonisjs/core/types'
import { type LucidModel } from '@adonisjs/lucid/types/model'
import type BaseCurrencyService from '@mixxtor/currencyx-js'
import type {
  CurrencyExchanges,
  CurrencyExchangeInstance,
  createCurrency,
} from '@mixxtor/currencyx-js'

export type { CurrencyExchanges, CurrencyCode } from '@mixxtor/currencyx-js'

/**
 * Database configuration for currency provider
 */
export interface DatabaseConfig<
  Model extends LucidModel = LucidModel,
  Cache extends CacheConfig | undefined | false = CacheConfig | undefined,
> {
  /**
   * The Lucid model to use for currency queries
   */
  model: () => Promise<{ default: Model }> | Model

  /**
   * Base currency - all exchange rates in database are relative to this currency
   * @default 'USD'
   * @example 'USD' // 1 USD = 0.85 EUR, 1 USD = 0.73 GBP
   */
  base?: string

  /**
   * Column mapping for the currency table
   */
  columns?: {
    /**
     * Currency code column (e.g., 'USD', 'EUR')
     * @default 'code'
     */
    code: string

    /**
     * Exchange rate column
     * @default 'exchange_rate'
     */
    rate: string

    /**
     * Created at column
     * @default 'created_at'
     */
    created_at?: string

    /**
     * Updated at column
     * @default 'updated_at'
     */
    updated_at?: string
  }

  /**
   * Cache configuration for this database provider
   * @default false
   */
  cache?: Cache | undefined | false
}

/**
 * Cache configuration for database provider
 */
export interface CacheConfig extends CacheOptions {
  /**
   * The AdonisJS cache service instance
   * @requires @adonisjs/cache
   */
  service: () => Promise<{ default: CacheService }> | CacheService
}

/**
 * Complete currency configuration for AdonisJS
 */
export interface CurrencyConfig<KnownExchanges extends CurrencyExchanges = CurrencyExchanges> {
  /**
   * Default provider to use
   */
  default: keyof KnownExchanges

  /**
   * Provider configurations
   */
  exchanges: Record<keyof KnownExchanges, CurrencyExchangeInstance>
}

/**
 * Infer the providers from the user config
 */
export type InferExchanges<
  T extends ConfigProvider<{ exchanges: Record<string, ExchangeFactory> }>,
> = Awaited<ReturnType<T['resolver']>>['exchanges']

// export type InferExchanges<T extends { exchanges: Record<string, BaseCurrencyExchange> }> = {
//   [K in keyof T['exchanges']]: any
// }

/**
 * Currency record interface for database queries
 */
export interface CurrencyRecord {
  [key: string]: any
  code?: string
  rate?: number
  updated_at?: Date
}

/**
 * Any exchange instance the config may hold — the bundled ones, a class a fork/package brings of
 * its own, or one built with `createExchange()`. The name is historical: it has always been the
 * *instance* type, never a factory.
 *
 * It is `CurrencyExchangeInstance` (the public surface) rather than the `BaseCurrencyExchange`
 * class type on purpose: a spec-built class reports the mapped surface — that is what makes it
 * concrete — so constraining to the class would have rejected exactly the exchanges
 * `createExchange()` exists to produce.
 */
export type ExchangeFactory = CurrencyExchangeInstance

/**
 * Main Currency Service Implementation
 */
export interface CurrencyService extends BaseCurrencyService<
  CurrencyExchanges extends Record<string, ReturnType<typeof createCurrency>>
    ? CurrencyExchanges
    : never
> {}

/**
 * Lazy exchange: a resolver run at config-resolution time with the exchange's own name and the
 * application, so an exchange can be built from the container (logger, cache, an HTTP client, or
 * anything else registered) instead of at module-import time.
 *
 * Build one with `defineExchange()` — that is the seam third-party exchanges plug into, and the
 * reason a private or app-specific exchange never needs to live in this package.
 */
export type ServiceConfigProvider<Factory extends ExchangeFactory> = {
  type: 'provider'
  resolver: (name: string, app: ApplicationService) => Promise<Factory>
}

/**
 * What an entry under `exchanges` may be: an instance, a thunk returning one (the manager calls
 * it), or a lazy `ServiceConfigProvider`.
 */
export type ExchangeEntry<Factory extends ExchangeFactory = ExchangeFactory> =
  Factory | (() => Factory) | ServiceConfigProvider<Factory>

/**
 * The instance an `ExchangeEntry` ends up as, which is what `currency.use('name')` hands back and
 * what `InferExchanges` reports.
 */
export type ResolvedExchange<Entry> =
  Entry extends ServiceConfigProvider<infer Factory>
    ? Factory
    : Entry extends () => infer Instance
      ? Instance
      : Entry
