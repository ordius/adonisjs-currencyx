import { test } from '@japa/runner'
import { DatabaseExchange } from '../src/exchanges/database.ts'

/**
 * Simple in-memory currency repository for testing
 * Following AdonisJS recommended repository pattern instead of mocking models
 */
class InMemoryCurrencyRepository {
  private currencies: Array<{ code: string; exchange_rate: number }> = [
    { code: 'USD', exchange_rate: 1.0 },
    { code: 'EUR', exchange_rate: 0.85 },
    { code: 'GBP', exchange_rate: 0.73 },
  ]

  async findByCode(code: string) {
    return this.currencies.find((c) => c.code === code) || null
  }

  async getAll() {
    return this.currencies
  }
}

/**
 * Create a simple mock model that uses the repository
 */
function createSimpleMockModel() {
  const repository = new InMemoryCurrencyRepository()

  // Create a chainable query builder
  const createQueryBuilder = () => {
    let whereConditions: Array<{ column: string; value: string | string[] }> = []
    let limitValue: number | undefined

    const builder = {
      select: (_columns: string[]) => builder,
      where: (column: string, value: string) => {
        whereConditions.push({ column, value })
        return builder
      },
      whereIn: (column: string, values: string[]) => {
        whereConditions.push({ column, value: values })
        return builder
      },
      limit: (count: number) => {
        limitValue = count
        return builder
      },
      // Make the query builder thenable so it can be awaited directly
      then: async function (resolve: any, reject: any) {
        try {
          const result = await builder.exec()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      },
      first: async () => {
        const codeCondition = whereConditions.find((c) => c.column === 'code')
        if (codeCondition && typeof codeCondition.value === 'string') {
          return await repository.findByCode(codeCondition.value)
        }
        return null
      },
      exec: async () => {
        let results = await repository.getAll()

        // Apply where conditions
        for (const condition of whereConditions) {
          if (condition.column === 'code') {
            if (Array.isArray(condition.value)) {
              results = results.filter((c) => condition.value.includes(c.code))
            } else {
              results = results.filter((c) => c.code === condition.value)
            }
          }
        }

        // Apply limit
        if (limitValue) {
          results = results.slice(0, limitValue)
        }

        return results
      },
    }

    return builder
  }

  return {
    query: createQueryBuilder,
  }
}

test.group('DatabaseExchange Simple Tests', () => {
  test('should initialize with correct configuration', ({ assert }) => {
    const config = {
      model: () => Promise.resolve({ default: createSimpleMockModel() }),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseExchange(config as any)
    assert.equal(provider.base, 'USD')
  })

  test('should handle same currency conversion', async ({ assert }) => {
    const config = {
      model: () => Promise.resolve({ default: createSimpleMockModel() }),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseExchange(config as any)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.convert({ amount: 100, from: 'USD', to: 'USD' })

    assert.equal(result.success, true)
    assert.equal(result.query.amount, 100)
    assert.equal(result.query.from, 'USD')
    assert.equal(result.query.to, 'USD')
    assert.equal(result.result, 100)
    assert.equal(result.info.rate, 1)
  })

  test('should convert currency using cross rates', async ({ assert }) => {
    const config = {
      model: () => Promise.resolve({ default: createSimpleMockModel() }),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseExchange(config as any)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.convert({ amount: 100, from: 'USD', to: 'EUR' })

    assert.equal(result.success, true)
    assert.equal(result.query.amount, 100)
    assert.equal(result.query.from, 'USD')
    assert.equal(result.query.to, 'EUR')
    assert.equal(result.result, 85) // 100 * 0.85
    assert.equal(result.info.rate, 0.85)
  })

  test('should get exchange rates for base currency', async ({ assert }) => {
    const config = {
      model: () => Promise.resolve({ default: createSimpleMockModel() }),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseExchange(config as any)

    // Wait for model to load
    await new Promise((resolve) => setTimeout(resolve, 10))

    const result = await provider.latestRates({ base: 'USD', codes: ['USD', 'EUR'] })

    assert.equal(result.success, true)
    assert.equal(result.base, 'USD')
    assert.deepEqual(result.rates, {
      USD: 1.0,
      EUR: 0.85,
    })
  })

  test('should handle model loading error gracefully', async ({ assert }) => {
    const config = {
      model: () => Promise.reject(new Error('Model not found')),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
    }

    const provider = new DatabaseExchange(config as any)

    const result = await provider.convert({ amount: 100, from: 'USD', to: 'EUR' })

    // Should return error result instead of throwing
    assert.equal(result.success, false)
    assert.include(result.error?.info || '', 'Model not found')
  })
})
