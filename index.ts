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
 * Authoring surface for exchanges this package does not ship. Two routes, both ending in a
 * `BaseCurrencyExchange` that `defineExchange()` registers:
 *
 * - `createExchange(spec)` — describe the request and the response shape, get the rest (cross
 *   rates, rebasing, filtering, result objects, error mapping) implemented for you.
 * - `BaseCurrencyExchange` — subclass it by hand when the spec cannot describe the API.
 *
 * Re-exported here so an exchange only has to depend on this package; `@mixxtor/currencyx-js`
 * stays an implementation detail of the integration.
 */
export { BaseCurrencyExchange, createExchange } from '@mixxtor/currencyx-js'
export type {
  ConversionResult,
  ConvertParams,
  CurrencyExchangeContract,
  ExchangeRatesParams,
  ExchangeRatesResult,
  ExchangeSpec,
  SpecExchange,
  FetchRatesContext,
  FetchRateContext,
  ConvertContext,
} from '@mixxtor/currencyx-js'

/**
 * Throw these from a spec callback to surface a typed failure on the result.
 */
export {
  CurrencyError,
  ApiError,
  RateLimitError,
  ValidationError,
  InvalidCurrencyError,
  ConfigurationError,
  TimeoutError,
} from '@mixxtor/currencyx-js'
