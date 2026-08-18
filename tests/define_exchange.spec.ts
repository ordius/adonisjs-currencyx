import { test } from '@japa/runner'
import { configProvider } from '@adonisjs/core'
import type { ApplicationService } from '@adonisjs/core/types'
import {
  BaseCurrencyExchange,
  createExchange,
  defineConfig,
  defineExchange,
  exchanges,
} from '../index.js'
import type {
  ConversionResult,
  ConvertParams,
  ExchangeRatesParams,
  ExchangeRatesResult,
  InferExchanges,
} from '../index.js'
import { setupApp } from './helper.js'

/**
 * Stands in for an exchange a fork or a private package brings of its own — the case this seam
 * exists for, since a keyed service cannot ship inside a public package.
 */
class CustomExchange extends BaseCurrencyExchange {
  readonly name = 'custom'

  constructor(public marker: string) {
    super()
    this.base = 'EUR'
  }

  async latestRates(params?: ExchangeRatesParams): Promise<ExchangeRatesResult> {
    // `params?.base ?? this.base` rather than the `resolveBase()` helper, so this spec runs against
    // the currently released @mixxtor/currencyx-js as well as the next one.
    const base = params?.base ?? this.base
    return this.createExchangeRatesResult(base, { [base]: 1, USD: 1.1 })
  }

  async convert(params: ConvertParams): Promise<ConversionResult> {
    return this.createConversionResult(params.amount, params.from, params.to, params.amount, 1)
  }

  async getConvertRate(): Promise<number | undefined> {
    return 1
  }
}

test.group('defineExchange', () => {
  test('resolves a third-party exchange with its name and the app', async ({ assert }) => {
    const seen: { name?: string; sameApp?: boolean } = {}

    const config = defineConfig({
      default: 'custom' as const,
      exchanges: {
        custom: defineExchange(async (name, app) => {
          seen.name = name
          seen.sameApp = typeof app.container.make === 'function'
          return new CustomExchange('from-resolver')
        }),
      },
    })

    const app = await setupApp('web', { currency: config as any })
    const resolved = await configProvider.resolve<any>(app as unknown as ApplicationService, config)

    assert.equal(seen.name, 'custom')
    assert.isTrue(seen.sameApp)
    assert.instanceOf(resolved.exchanges.custom, CustomExchange)
    assert.equal(resolved.exchanges.custom.marker, 'from-resolver')
    assert.equal(resolved.default, 'custom')
  })

  test('the resolver runs only when the config is resolved', async ({ assert }) => {
    let built = 0

    const config = defineConfig({
      default: 'custom' as const,
      exchanges: {
        custom: defineExchange(() => {
          built++
          return new CustomExchange('lazy')
        }),
      },
    })

    assert.equal(built, 0, 'defineConfig must not build the exchange')

    const app = await setupApp('web', { currency: config as any })
    await configProvider.resolve<any>(app as unknown as ApplicationService, config)

    assert.equal(built, 1)
  })

  test('a registered exchange is usable through the manager', async ({ assert }) => {
    const config = defineConfig({
      default: 'custom' as const,
      exchanges: { custom: defineExchange(() => new CustomExchange('via-manager')) },
    })

    const app = await setupApp('web', { currency: config as any })
    const currency = await app.container.make('currency.manager')

    assert.equal(currency.getCurrentExchange(), 'custom')
    assert.deepEqual(currency.getAvailableExchanges(), ['custom'])

    // Base-scoping itself is asserted in @mixxtor/currencyx-js; here it only matters that a
    // registered exchange is the one the manager actually calls.
    const rates = await currency.latestRates()
    assert.equal(rates.base, 'EUR')
    assert.equal(rates.rates.USD, 1.1)
  })

  test('instances and bundled helpers still resolve unchanged', async ({ assert }) => {
    const config = defineConfig({
      default: 'custom' as const,
      exchanges: {
        custom: new CustomExchange('plain-instance'),
        database: exchanges.database({ model: () => Promise.resolve({} as any) }),
      },
    })

    const app = await setupApp('web', { currency: config as any })
    const resolved = await configProvider.resolve<any>(app as unknown as ApplicationService, config)

    assert.instanceOf(resolved.exchanges.custom, CustomExchange)
    assert.equal(resolved.exchanges.database.constructor.name, 'DatabaseExchange')
  })

  test('InferExchanges reports the resolved instance type', async ({ assert }) => {
    const config = defineConfig({
      default: 'custom' as const,
      exchanges: { custom: defineExchange(() => new CustomExchange('typed')) },
    })

    type Exchanges = InferExchanges<typeof config>

    // Compile-time assertion: the provider must infer to the instance, not to the provider object.
    const check: Exchanges['custom'] extends CustomExchange ? true : false = true
    assert.isTrue(check)
  })
})

test.group('createExchange re-export', () => {
  test('a spec-built exchange registers and resolves like any other', async ({ assert }) => {
    class SpecExchange extends createExchange<{ base?: 'EUR'; timeout?: number }>({
      name: 'spec',
      defaults: { base: 'EUR' },
      upstream: { base: 'EUR', supportsCodes: false },
      async fetchRates() {
        return { EUR: 1, USD: 1.1 }
      },
    }) {}

    const config = defineConfig({
      default: 'spec' as const,
      exchanges: { spec: defineExchange(() => new SpecExchange()) },
    })

    const app = await setupApp('web', { currency: config as any })
    const currency = await app.container.make('currency.manager')

    // `BaseCurrencyExchange` is abstract, so assert against the concrete class the spec produced.
    assert.instanceOf(currency.use('spec'), SpecExchange)
    assert.equal(currency.use('spec').name, 'spec')
    assert.equal(currency.getCurrentExchange(), 'spec')

    // the generated class does the rebasing the spec declared it needs
    const rates = await currency.latestRates({ base: 'USD' })
    assert.equal(rates.base, 'USD')
    assert.equal(rates.rates.USD, 1)
    assert.closeTo(rates.rates.EUR, 1 / 1.1, 1e-10)
  })
})
