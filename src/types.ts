import { type CacheOptions, type CacheProvider } from '@adonisjs/cache/types'
import { type ApplicationService, type ConfigProvider } from '@adonisjs/core/types'
import { type LucidModel } from '@adonisjs/lucid/types/model'
import type BaseCurrencyService from '@mixxtor/currencyx-js'
import type { CurrencyExchanges, CurrencyExchangeInstance } from '@mixxtor/currencyx-js'

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
   * The AdonisJS cache service, or any cache provider derived from it (`cache.namespace('x')`,
   * a specific store).
   * @requires @adonisjs/cache
   */
  service: () => Promise<{ default: CacheProvider }> | CacheProvider

  /**
   * Namespace every cached entry of this exchange lives under — the rate list and the per-pair
   * lookups — which is what lets `clearCache()` drop all of them at once.
   * @default 'currency'
   */
  prefix?: string

  /**
   * How long cached rates are served before the table is read again.
   * @default '1h'
   */
  ttl?: number | string
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
 * The configured exchanges as a type literal, one entry per name with that exchange's own type.
 *
 * `CurrencyExchanges` is an interface (augmented from the app's config), and an interface has no
 * implicit index signature, so it cannot be handed to `CurrencyService<…>` as-is. Mapping it over
 * its own keys keeps each name's type. The `Record<keyof CurrencyExchanges,
 * CurrencyExchanges[keyof CurrencyExchanges]>` this replaces gave every name the union of all
 * exchanges, so `currency.use('database')` could not reach `clearCache()` without a cast.
 */
export type ConfiguredExchanges = { [Name in keyof CurrencyExchanges]: CurrencyExchanges[Name] }

/**
 * The currency manager exported by `services/main`, typed per configured exchange name.
 */
export interface CurrencyService extends BaseCurrencyService<ConfiguredExchanges> {}

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
