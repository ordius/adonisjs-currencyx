import { exchanges as currencyExchanges } from '@mixxtor/currencyx-js'
import type { DatabaseConfig, ServiceConfigProvider, ExchangeFactory } from './types.js'
import { DatabaseExchange } from './exchanges/database.js'
import { configProvider } from '@adonisjs/core'
import type { ConfigProvider } from '@adonisjs/core/types'

/**
 * Define database exchange provider configuration
 * Returns a factory function to avoid eager instantiation
 */
function database(config: DatabaseConfig): DatabaseExchange {
  if (!config.model) {
    throw new Error('Database exchange requires a model')
  }

  const dbConfig = {
    model: config.model,
    base: config.base || 'USD',
    columns: {
      code: 'code',
      rate: 'exchange_rate',
      ...config.columns,
    },
    cache: config.cache,
  }

  return new DatabaseExchange(dbConfig)
}

/**
 * Exchange configuration helpers
 */
export const exchanges = {
  ...currencyExchanges,
  database,
} as const

/**
 * Helper to remap known exchange exchanges to factory functions
 */
type ResolvedConfig<Exchanges extends Record<string, ExchangeFactory>> = {
  default: keyof Exchanges
  exchanges: {
    [K in keyof Exchanges]: Exchanges[K] extends ServiceConfigProvider<infer A> ? A : Exchanges[K]
  }
}

/**
 * Define currency configuration with type inference
 * Following AdonisJS pattern for better type safety
 */
export function defineConfig<Exchanges extends Record<string, any>>(
  config: ResolvedConfig<Exchanges>
): ConfigProvider<ResolvedConfig<Exchanges>> {
  return configProvider.create(async (_app) => {
    const { exchanges: exchangesFactory, default: defaultExchange } = config
    const exchangesNames = Object.keys(exchangesFactory)

    /**
     * Configured exchanges
     */
    const exchangeExchanges = {} as Record<string, ExchangeFactory>

    /**
     * Looping over providers and resolving their config providers
     * to get factory functions
     */
    for (let providerName of exchangesNames) {
      const exchange = exchangesFactory[providerName]
      exchangeExchanges[providerName] = exchange
    }

    return {
      default: defaultExchange,
      exchanges: exchangeExchanges,
    } as ResolvedConfig<Exchanges>
  })
}
