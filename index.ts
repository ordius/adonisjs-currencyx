/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
|
| Export values from the package entrypoint as you see fit.
|
*/

export { configure } from './configure.js'
export { stubsRoot } from './stubs/main.js'
export { defineConfig, defineExchange, exchanges } from './src/define_config.js'

// Types
export type {
  CurrencyCode,
  DatabaseConfig,
  CacheConfig,
  CurrencyConfig,
  CurrencyRecord,
  CurrencyExchanges,
  InferExchanges,
  ExchangeEntry,
  ExchangeFactory,
  ResolvedExchange,
  ServiceConfigProvider,
} from './src/types.js'

// Database Provider
export { DatabaseExchange } from './src/exchanges/database.js'

/**
 * Authoring surface for exchanges this package does not ship: subclass `BaseCurrencyExchange` and
 * register the result with `defineExchange()`. Re-exported here so an exchange only has to depend
 * on this package — `@mixxtor/currencyx-js` stays an implementation detail of the integration.
 */
export { BaseCurrencyExchange } from '@mixxtor/currencyx-js'
export type {
  ConversionResult,
  ConvertParams,
  CurrencyExchangeContract,
  ExchangeRatesParams,
  ExchangeRatesResult,
} from '@mixxtor/currencyx-js'
