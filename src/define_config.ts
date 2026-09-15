import { exchanges as currencyExchanges } from '@mixxtor/currencyx-js'
import type {
  DatabaseConfig,
  ExchangeEntry,
  ExchangeFactory,
  ResolvedExchange,
  ServiceConfigProvider,
} from './types.js'
import { DatabaseExchange } from './exchanges/database.js'
import { configProvider } from '@adonisjs/core'
import type { ApplicationService, ConfigProvider } from '@adonisjs/core/types'

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
 * Register an exchange this package does not ship — your own class, a private service, a package
 * on a private registry. The resolver runs when the config is resolved (app boot), receives the
 * name it was registered under and the application, and may be async.
 *
 * Nothing else is needed to plug an exchange in: `InferExchanges` picks the name up from the
 * config, so `currency.use('...')` is typed, and the returned instance is what it hands back.
 *
 * @example
 * ```ts
 * // config/currency.ts
 * export default defineConfig({
 *   default: 'mx',
 *   exchanges: {
 *     mx: defineExchange(async (_name, app) => {
 *       const logger = await app.container.make('logger')
 *       return new MxExchange({ accessKey: env.get('MX_CURRENCY_API_KEY'), logger })
 *     }),
 *   },
 * })
 * ```
 */
export function defineExchange<Factory extends ExchangeFactory>(
  resolver: (name: string, app: ApplicationService) => Factory | Promise<Factory>
): ServiceConfigProvider<Factory> {
  return {
    type: 'provider',
    resolver: async (name, app) => resolver(name, app),
  }
}

/**
 * The config after every entry has been resolved to an exchange instance.
 */
type ResolvedConfig<Exchanges extends Record<string, ExchangeEntry>> = {
  default: keyof Exchanges
  exchanges: { [K in keyof Exchanges]: ResolvedExchange<Exchanges[K]> }
}

/**
 * Define currency configuration with type inference
 * Following AdonisJS pattern for better type safety
 */
export function defineConfig<Exchanges extends Record<string, ExchangeEntry>>(config: {
  default: keyof Exchanges
  exchanges: Exchanges
}): ConfigProvider<ResolvedConfig<Exchanges>> {
  return configProvider.create(async (app) => {
    const { exchanges: configuredExchanges, default: defaultExchange } = config

    /**
     * Configured exchanges, each resolved to an instance
     */
    const resolvedExchanges = {} as Record<string, ExchangeFactory>

    /**
     * An entry is either an instance (the bundled helpers return one), or a lazy
     * `ServiceConfigProvider` from `defineExchange()` — resolved here, with the app, so an exchange
     * can reach the container instead of being constructed while the config module is imported.
     * Thunks are left alone: the manager calls them itself.
     */
    for (const exchangeName of Object.keys(configuredExchanges)) {
      const entry = configuredExchanges[exchangeName]
      resolvedExchanges[exchangeName] = isServiceConfigProvider(entry)
        ? await entry.resolver(exchangeName, app)
        : (entry as ExchangeFactory)
    }

    return {
      default: defaultExchange,
      exchanges: resolvedExchanges,
    } as ResolvedConfig<Exchanges>
  })
}

/**
 * Narrow an entry to a lazy provider. Checked structurally rather than with `instanceof` so an
 * exchange package can be on a different copy of this dependency without breaking.
 */
function isServiceConfigProvider(entry: unknown): entry is ServiceConfigProvider<ExchangeFactory> {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'type' in entry &&
    (entry as { type: unknown }).type === 'provider' &&
    typeof (entry as { resolver?: unknown }).resolver === 'function'
  )
}
