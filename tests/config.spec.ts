import { test } from '@japa/runner'
import { defineConfig, exchanges } from '../src/define_config.ts'

test.group('Configuration Helpers', () => {
  test('defineConfig should return a config provider', ({ assert }) => {
    const result = defineConfig({
      default: 'database' as const,
      exchanges: {
        database: {
          model: () => Promise.resolve({} as any),
        },
      },
    })

    // defineConfig returns a ConfigProvider, not the original config
    assert.equal(result.type, 'provider')
    assert.isFunction(result.resolver)
  })

  test('database helper should validate model requirement', ({ assert }) => {
    assert.throws(() => {
      exchanges.database({} as any)
    }, 'Database exchange requires a model')
  })

  test('database helper should set default columns and base currency', ({ assert }) => {
    const mockModel = () => Promise.resolve({} as any)

    // Create the actual provider instance
    const config = exchanges.database({ model: mockModel })
    assert.instanceOf(config, Object)
    assert.equal(config.constructor.name, 'DatabaseExchange')
    assert.equal(config.base, 'USD')

    // Check that provider has required methods
    assert.isFunction(config.convert)
    assert.isFunction(config.latestRates)
  })

  test('database helper should merge custom config', ({ assert }) => {
    const mockModel = () => Promise.resolve({} as any)

    // Create the actual provider instance
    const config = exchanges.database({
      model: mockModel,
      base: 'EUR',
      columns: {
        code: 'currency_code',
        rate: 'rate_value',
      },
      cache: false,
    })

    assert.instanceOf(config, Object)
    assert.equal(config.constructor.name, 'DatabaseExchange')
    assert.equal(config.base, 'EUR')

    // Check that provider has required methods
    assert.isFunction(config.convert)
    assert.isFunction(config.latestRates)
  })

  test('google helper should set defaults', ({ assert }) => {
    // Create the actual exchange instance
    const exchange = exchanges.google()
    assert.instanceOf(exchange, Object)
    assert.equal(exchange.constructor.name, 'GoogleFinanceExchange')

    // Check that exchange has required methods
    assert.isFunction(exchange.convert)
    assert.isFunction(exchange.latestRates)
  })

  test('google helper should accept custom config', ({ assert }) => {
    // Create the actual provider instance
    const exchange = exchanges.google({
      base: 'EUR',
      timeout: 10000,
    })

    assert.instanceOf(exchange, Object)
    assert.equal(exchange.constructor.name, 'GoogleFinanceExchange')

    // Check that exchange has required methods
    assert.isFunction(exchange.convert)
    assert.isFunction(exchange.latestRates)
  })

  test('fixer helper should require accessKey', ({ assert }) => {
    assert.throws(() => {
      exchanges.fixer({} as any)
    }, 'Fixer exchange requires an accessKey')
  })

  test('fixer helper should set defaults with accessKey', ({ assert }) => {
    // Create the actual provider instance
    const exchange = exchanges.fixer({ accessKey: 'test-key' })
    assert.instanceOf(exchange, Object)
    assert.equal(exchange.constructor.name, 'FixerExchange')

    // Check that exchange has required methods
    assert.isFunction(exchange.convert)
    assert.isFunction(exchange.latestRates)
  })

  test('exchanges object should contain all helpers', ({ assert }) => {
    assert.isFunction(exchanges.database)
    assert.isFunction(exchanges.google)
    assert.isFunction(exchanges.fixer)
  })
})
