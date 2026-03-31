import type {
  CurrencyCode,
  ConversionResult,
  ExchangeRatesResult,
  ConvertParams,
  ExchangeRatesParams,
} from '@mixxtor/currencyx-js'
import { BaseCurrencyExchange } from '@mixxtor/currencyx-js'
import type { DatabaseConfig } from '../types.ts'
import type { CacheService } from '@adonisjs/cache/types'
import { PROVIDER_CURRENCY_MODEL } from '../symbols.ts'
import type { LucidModel } from '@adonisjs/lucid/types/model'

export class DatabaseExchange<Model extends LucidModel = LucidModel> extends BaseCurrencyExchange {
  declare [PROVIDER_CURRENCY_MODEL]: InstanceType<Model>

  readonly name = 'database'

  protected model?: Model
  private columns: NonNullable<DatabaseConfig<Model>['columns']>
  private configModel?: DatabaseConfig<Model>['model']
  private cache?: CacheService
  private cacheSetupPromise?: Promise<void>
  private config: DatabaseConfig<Model>

  #defaultCacheTTL: number | string = '1h' // in milliseconds or human-readable string (e.g., '1d')
  #defaultCacheKeyPrefix = 'currency'

  constructor(config: DatabaseConfig<Model>) {
    super()

    this.config = config
    this.columns = {
      code: config.columns?.code || 'code',
      rate: config.columns?.rate || 'exchange_rate',
      created_at: config.columns?.created_at || 'created_at',
      updated_at: config.columns?.updated_at || 'updated_at',
      ...config.columns,
    }

    this.base = config.base || 'USD'
    this.configModel = config.model

    // Validate configuration
    this.#validateConfig()
  }

  /**
   * Validate configuration to prevent runtime errors
   */
  #validateConfig(): void {
    if (!this.configModel) {
      throw new Error('Currency model configuration is required')
    }

    const cacheConfig = this.config.cache
    if (cacheConfig !== false && cacheConfig && !cacheConfig.service) {
      throw new Error('Cache service configuration is required when cache is enabled')
    }

    // Validate base currency format
    if (this.base && !/^[A-Z]{3}$/.test(this.base)) {
      console.warn(`Base currency '${this.base}' should be a 3-letter ISO currency code`)
    }
  }

  /**
   * Imports the model from the provider, returns and caches it
   * for further operations.
   */
  protected async getModel() {
    if (!this.configModel) {
      throw new Error('Currency model not configured')
    }

    if (this.model && !('hot' in import.meta)) {
      return this.model
    }

    const importedModel = await this.configModel()
    this.model = 'default' in importedModel ? importedModel.default : importedModel
    return this.model
  }

  /**
   * Imports the cache service from the provider, returns and caches it
   * for further operations.
   */
  protected async getCacheService() {
    const cacheConfig = this.config.cache
    if (cacheConfig === false || !cacheConfig || !cacheConfig.service) {
      throw new Error('Currency cache not configured')
    }

    if (this.cache && !('hot' in import.meta)) {
      return this.cache
    }

    const importedCache = await cacheConfig.service()
    this.cache = 'default' in importedCache ? importedCache.default : importedCache
    return this.cache
  }

  /**
   * Setup cache based on configuration (lazy initialization)
   */
  async #ensureCacheSetup(): Promise<void> {
    if (this.cacheSetupPromise) {
      return this.cacheSetupPromise
    }

    this.cacheSetupPromise = this.#setupCache().catch((error) => {
      // Reset the promise on error so it can be retried
      this.cacheSetupPromise = undefined
      throw error
    })
    return this.cacheSetupPromise
  }

  /**
   * Setup cache based on configuration
   */
  async #setupCache(): Promise<void> {
    const cacheConfig = this.config.cache
    if (cacheConfig === false || !cacheConfig) {
      return
    }

    try {
      this.cache = await this.getCacheService()
    } catch (error: any) {
      console.warn('Cache setup failed, continuing without cache:', error.message)
    }
  }

  /**
   * Convert currency using database rates
   */
  async convert(params: ConvertParams): Promise<ConversionResult> {
    // Input validation
    const { amount, from, to } = params
    if (!amount || amount <= 0) {
      return {
        success: false,
        query: { from, to, amount },
        info: { timestamp: Date.now() },
        date: new Date().toISOString(),
        error: { info: 'Invalid amount: must be greater than 0' },
      }
    }

    if (!from || !to) {
      return {
        success: false,
        query: { from, to, amount },
        info: { timestamp: Date.now() },
        date: new Date().toISOString(),
        error: { info: 'Invalid currency codes: from and to are required' },
      }
    }

    const result: ConversionResult = {
      success: false,
      query: { from, to, amount },
      info: { timestamp: Date.now(), rate: 1 },
      date: new Date().toISOString(),
      result: amount,
    }

    // Same currency conversion
    if (from === to) {
      result.success = true
      return result
    }

    try {
      const currencies = await this.#getCurrenciesByCodes([from, to])
      const fromCurrency = currencies?.find((c) => this.#getCurrencyCode(c) === from)
      const toCurrency = currencies?.find((c) => this.#getCurrencyCode(c) === to)

      if (!fromCurrency || !toCurrency) {
        return {
          ...result,
          error: {
            info: `Currency not found: ${!fromCurrency ? from : to}`,
          },
        }
      }

      const fromRate = this.#getCurrencyRate(fromCurrency)
      const toRate = this.#getCurrencyRate(toCurrency)
      const updatedAt =
        this.#getCurrencyUpdatedAt(fromCurrency) || this.#getCurrencyUpdatedAt(toCurrency)

      if (!fromRate || !toRate) {
        return {
          ...result,
          error: {
            info: 'Invalid exchange rates found in database',
          },
        }
      }

      // Conversion formula: amount * (1/fromCurrencyRate) * toCurrencyRate
      const convertRate = (1 / fromRate) * toRate
      const convertAmount = amount * convertRate

      result.success = true
      result.info.rate = convertRate
      result.result = convertAmount

      if (updatedAt) {
        const timestamp = new Date(updatedAt).getTime()
        result.info.timestamp = timestamp
        result.date = new Date(updatedAt).toISOString()
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error'
      return {
        success: false,
        query: { from, to, amount },
        info: { timestamp: Date.now() },
        date: new Date().toISOString(),
        error: {
          info: errorMessage,
          type: 'database_error',
        },
      }
    }
  }

  async #currencyList(useCache = true) {
    // Ensure cache is setup before using it
    await this.#ensureCacheSetup()

    const Model = await this.getModel()
    const query = Model.query().select(Object.values(this.columns))

    if (!useCache || !this.cache || !this.config.cache) {
      return await query
    }

    const { prefix = this.#defaultCacheKeyPrefix, ttl = this.#defaultCacheTTL } = this.config.cache

    return await this.cache.getOrSet({ key: prefix, factory: () => query, ttl })
  }

  /**
   * Get specific currencies by codes (optimized for targeted queries)
   */
  async #getCurrenciesByCodes(codes: string[], useCache = true): Promise<any[]> {
    if (!codes || codes.length === 0) {
      return this.#currencyList(useCache)
    }

    // Ensure cache is setup before using it
    await this.#ensureCacheSetup()

    const Model = await this.getModel()
    const query = Model.query()
      .select(Object.values(this.columns))
      .whereIn(this.columns.code, codes)

    if (!useCache || !this.cache || !this.config.cache) {
      return await query
    }

    const { prefix = this.#defaultCacheKeyPrefix, ttl = this.#defaultCacheTTL } = this.config.cache
    const cacheKey = `${prefix}_${codes.sort().join('_')}`

    return await this.cache.getOrSet({ key: cacheKey, factory: () => query, ttl })
  }

  /**
   * Helper method to get currency code from a record
   */
  #getCurrencyCode(record: any): string {
    return record[this.columns.code] as string
  }

  /**
   * Helper method to get currency rate from a record
   */
  #getCurrencyRate(record: any): number {
    return record[this.columns.rate] as number
  }

  /**
   * Helper method to get currency updated at from a record
   */
  #getCurrencyUpdatedAt(record: any): string | undefined {
    const updatedAtColumn = this.columns.updated_at || 'updated_at'
    return record[updatedAtColumn] as string | undefined
  }

  /**
   * Get latest rates (required abstract method)
   */
  async latestRates(
    params?: ExchangeRatesParams & { cache?: boolean }
  ): Promise<ExchangeRatesResult> {
    const { base = this.base, codes: currencyCodes, cache = true } = params || {}
    const result: ExchangeRatesResult = {
      success: false,
      timestamp: new Date().getTime(),
      date: new Date().toISOString(),
      base: base,
      rates: {} as Record<CurrencyCode, number>,
      error: undefined,
    }

    try {
      const currencies = await this.#currencyList(cache)

      if (!currencies || currencies.length === 0) {
        result.error = {
          info: 'No currencies found in database',
          type: 'database_error',
        }
        return result
      }

      let latestDate: Date | undefined

      for (const record of currencies) {
        const code = this.#getCurrencyCode(record)
        const rate = this.#getCurrencyRate(record)
        const updatedAt = this.#getCurrencyUpdatedAt(record)

        if (!code || rate === undefined || rate === null) {
          continue
        }

        // Filter by currency codes if specified
        if (!currencyCodes || currencyCodes.length === 0 || currencyCodes.includes(code)) {
          result.rates[code] = rate

          // Track the latest update date
          if (updatedAt) {
            const updatedAtDate = new Date(updatedAt)
            if (!latestDate || updatedAtDate > latestDate) {
              latestDate = updatedAtDate
            }
          }
        }
      }

      // Update result with latest date if found
      if (latestDate) {
        result.date = latestDate.toISOString()
        result.timestamp = latestDate.getTime()
      }

      result.success = Object.keys(result.rates).length > 0

      if (!result.success) {
        result.error = {
          info: currencyCodes?.length
            ? `No matching currencies found for codes: ${currencyCodes.join(', ')}`
            : 'No valid currencies found in database',
          type: 'database_error',
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error'
      result.error = {
        info: errorMessage,
        type: 'database_error',
      }
    }

    return result
  }

  /**
   * Clear the currency cache
   */
  async clearCache(): Promise<void> {
    if (!this.cache || !this.config.cache) {
      return
    }

    const { prefix = this.#defaultCacheKeyPrefix } = this.config.cache
    await this.cache.delete({ key: prefix })
  }

  /**
   * Refresh currency data from database
   */
  async refreshCurrencyData(): Promise<void> {
    await this.clearCache()
    // Pre-warm the cache
    await this.#currencyList(true)
  }

  /**
   * Get convert rate (required abstract method)
   */
  async getConvertRate(from: CurrencyCode, to: CurrencyCode): Promise<number | undefined> {
    try {
      const currencies = await this.#getCurrenciesByCodes([from, to])
      const fromCurrency = currencies?.find((c) => this.#getCurrencyCode(c) === from)
      const toCurrency = currencies?.find((c) => this.#getCurrencyCode(c) === to)

      if (!fromCurrency || !toCurrency) {
        return undefined
      }

      const fromRate = this.#getCurrencyRate(fromCurrency)
      const toRate = this.#getCurrencyRate(toCurrency)

      if (fromRate && toRate && fromRate > 0 && toRate > 0) {
        return (1 / fromRate) * toRate
      }

      return undefined
    } catch {
      return undefined
    }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    if (this.cacheSetupPromise) {
      try {
        await this.cacheSetupPromise
      } catch {
        // Ignore errors during cleanup
      }
      this.cacheSetupPromise = undefined
    }

    this.cache = undefined
    this.model = undefined
  }
}
