import { test } from '@japa/runner'
import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'
import { DatabaseExchange } from '../src/exchanges/database.js'

type Row = { code: string; exchange_rate: number | string; updated_at?: string }

/**
 * A model stand-in over a mutable table, so a test can change a rate between two reads and see
 * whether the exchange serves the table or its cache. `queries` counts the reads that reached it.
 */
function tableModel(rows: Row[]) {
  const state = { rows, queries: 0 }

  const query = () => {
    let codes: string[] | undefined
    const builder = {
      select: () => builder,
      whereIn: (_column: string, values: string[]) => {
        codes = values
        return builder
      },
      then(resolve: (value: Row[]) => void, reject: (error: unknown) => void) {
        state.queries++
        try {
          const result = state.rows.filter((row) => !codes || codes.includes(row.code))
          resolve(result.map((row) => ({ ...row })))
        } catch (error) {
          reject(error)
        }
      },
    }

    return builder
  }

  return { model: { query }, state }
}

function memoryCache() {
  return new BentoCache({
    default: 'memory',
    stores: { memory: bentostore().useL1Layer(memoryDriver({})) },
  })
}

function exchange(model: ReturnType<typeof tableModel>['model'], cache?: BentoCache<any>) {
  return new DatabaseExchange({
    model: () => Promise.resolve({ default: model }),
    base: 'USD',
    columns: { code: 'code', rate: 'exchange_rate' },
    cache: cache ? { service: () => cache, ttl: '1h', prefix: 'currency' } : undefined,
  } as any)
}

test.group('DatabaseExchange | cache invalidation', () => {
  test('clearCache works from an exchange that has not read anything yet', async ({ assert }) => {
    const { model, state } = tableModel([
      { code: 'USD', exchange_rate: 1 },
      { code: 'BTC', exchange_rate: 0 },
    ])
    const cache = memoryCache()

    // The web process: reads, and caches the stale 0.
    const web = exchange(model, cache)
    const stale = await web.latestRates()
    assert.equal(stale.rates.BTC, 0)

    // The sync process: writes the table, then clears through its own, never-used exchange.
    state.rows[1].exchange_rate = 0.000013
    await exchange(model, cache).clearCache()

    const fresh = await web.latestRates()
    assert.equal(fresh.rates.BTC, 0.000013)
  })

  test('clearCache drops the per-pair entries convert and getConvertRate cache', async ({
    assert,
  }) => {
    const { model, state } = tableModel([
      { code: 'USD', exchange_rate: 1 },
      { code: 'VND', exchange_rate: 25000 },
    ])
    const provider = exchange(model, memoryCache())

    assert.equal(await provider.getConvertRate('USD', 'VND'), 25000)

    state.rows[1].exchange_rate = 26000
    assert.equal(
      await provider.getConvertRate('USD', 'VND'),
      25000,
      'precondition: served from cache'
    )

    await provider.clearCache()
    assert.equal(await provider.getConvertRate('USD', 'VND'), 26000)
    const converted = await provider.convert({ amount: 2, from: 'USD', to: 'VND' })
    assert.equal(converted.result, 52000)
  })

  test('serves reads from the cache until it is cleared', async ({ assert }) => {
    const { model, state } = tableModel([{ code: 'USD', exchange_rate: 1 }])
    const provider = exchange(model, memoryCache())

    await provider.latestRates()
    await provider.latestRates()
    assert.equal(state.queries, 1)

    await provider.clearCache()
    await provider.latestRates()
    assert.equal(state.queries, 2)
  })

  test('accepts an already-namespaced cache provider as the service', async ({ assert }) => {
    const { model } = tableModel([{ code: 'USD', exchange_rate: 1 }])
    const scoped = memoryCache().namespace('app')

    const provider = new DatabaseExchange({
      model: () => Promise.resolve({ default: model }),
      base: 'USD',
      cache: { service: () => scoped, prefix: 'currency' },
    } as any)

    const result = await provider.latestRates()
    assert.equal(result.rates.USD, 1)
    await provider.clearCache()
  })

  test('clearCache is a no-op without a cache', async ({ assert }) => {
    const { model } = tableModel([{ code: 'USD', exchange_rate: 1 }])

    await exchange(model).clearCache()
    const result = await exchange(model).latestRates()
    assert.equal(result.rates.USD, 1)
  })
})

test.group('DatabaseExchange | latestRates base', () => {
  const rows = (): Row[] => [
    { code: 'USD', exchange_rate: 1 },
    { code: 'EUR', exchange_rate: 0.8 },
    { code: 'VND', exchange_rate: 25000 },
  ]

  test('returns the stored rates for the configured base', async ({ assert }) => {
    const result = await exchange(tableModel(rows()).model).latestRates()

    assert.equal(result.base, 'USD')
    assert.deepEqual(result.rates, { USD: 1, EUR: 0.8, VND: 25000 })
  })

  test('derives another base from the stored rates instead of only relabelling them', async ({
    assert,
  }) => {
    const result = await exchange(tableModel(rows()).model).latestRates({ base: 'EUR' })

    assert.isTrue(result.success)
    assert.equal(result.base, 'EUR')
    assert.equal(result.rates.EUR, 1)
    assert.closeTo(result.rates.USD, 1.25, 1e-12)
    assert.closeTo(result.rates.VND, 31250, 1e-9)
  })

  test('prices the configured base in a derived table even without a row for it', async ({
    assert,
  }) => {
    const table = rows().filter((row) => row.code !== 'USD')
    const result = await exchange(tableModel(table).model).latestRates({ base: 'EUR' })

    assert.closeTo(result.rates.USD, 1.25, 1e-12)
  })

  test('applies the code filter after deriving', async ({ assert }) => {
    const result = await exchange(tableModel(rows()).model).latestRates({
      base: 'EUR',
      codes: ['VND'],
    })

    assert.deepEqual(Object.keys(result.rates), ['VND'])
    assert.closeTo(result.rates.VND, 31250, 1e-9)
  })

  test('reports a base the table cannot price', async ({ assert }) => {
    const result = await exchange(tableModel(rows()).model).latestRates({ base: 'JPY' })

    assert.isFalse(result.success)
    assert.equal(result.error?.type, 'UNSUPPORTED_CURRENCY')
    assert.deepEqual(result.rates, {})
  })

  test('does not change the exchange base for later calls', async ({ assert }) => {
    const provider = exchange(tableModel(rows()).model)

    await provider.latestRates({ base: 'EUR' })
    const after = await provider.latestRates()

    assert.equal(provider.base, 'USD')
    assert.equal(after.rates.EUR, 0.8)
  })
})

test.group('DatabaseExchange | numeric columns', () => {
  test('returns numbers for decimal columns the driver hands back as strings', async ({
    assert,
  }) => {
    const { model } = tableModel([
      { code: 'USD', exchange_rate: '1.000000' },
      { code: 'BTC', exchange_rate: '0.0000130346' },
    ])
    const provider = exchange(model)

    const result = await provider.latestRates()
    assert.strictEqual(result.rates.BTC, 0.0000130346)
    assert.strictEqual(await provider.getConvertRate('BTC', 'USD'), 1 / 0.0000130346)
  })

  test('skips a rate that is not a number', async ({ assert }) => {
    const { model } = tableModel([
      { code: 'USD', exchange_rate: '1' },
      { code: 'XXX', exchange_rate: 'n/a' },
    ])

    const result = await exchange(model).latestRates()
    assert.deepEqual(result.rates, { USD: 1 })
  })
})
