/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
|
| Export values from the package entrypoint as you see fit.
|
*/

export { configure } from './configure.ts'
export { stubsRoot } from './stubs/main.ts'
export { defineConfig, exchanges } from './src/define_config.ts'

// Types
export type {
  CurrencyCode,
  DatabaseConfig,
  CacheConfig,
  CurrencyConfig,
  CurrencyRecord,
  CurrencyExchanges,
  InferExchanges,
} from './src/types.ts'

// Database Provider
export { DatabaseExchange } from './src/exchanges/database.ts'
