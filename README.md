# CurrencyX AdonisJS

> AdonisJS integration for CurrencyX.js with database provider and cache support. Seamlessly integrate currency conversion into your AdonisJS applications.

[![npm version](https://badge.fury.io/js/@mixxtor%2Fcurrencyx-adonisjs.svg)](https://badge.fury.io/js/@mixxtor%2Fcurrencyx-adonisjs)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![AdonisJS](https://img.shields.io/badge/AdonisJS-v6-purple.svg)](https://adonisjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🚀 **AdonisJS Integration** - Seamless integration with AdonisJS v6 framework
- 💾 **Database Exchange** - Store exchange rates in your database using Lucid ORM
- 🔄 **Multiple Exchanges** - Google Finance, Fixer.io, and database exchanges
- 📦 **Cache Support** - Built-in caching with AdonisJS Cache
- 🎯 **Type Safety** - Full TypeScript support with intelligent inference
- 🔧 **Easy Setup** - Simple configuration and installation
- 🌐 **Service Container** - Registered as AdonisJS service for dependency injection
- 🏗️ **Repository Pattern** - Clean architecture following AdonisJS patterns

## 📦 Installation

```bash
npm install @ordius/adonisjs-currencyx
```

## 🚀 Setup

### 1. Configure the package

```bash
node ace configure @ordius/adonisjs-currencyx
```

This will:

- Create `config/currency.ts` configuration file
- Create Currency model and migration stubs
- Register the service provider

### 2. Configure providers

Edit `config/currency.ts`:

```typescript
import env from '#start/env'
import { defineConfig, exchanges } from '@ordius/adonisjs-currencyx'

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Default Exchange
  |--------------------------------------------------------------------------
  */
  default: env.get('CURRENCY_PROVIDER', 'database') as 'database' | 'google' | 'fixer',

  /*
  |--------------------------------------------------------------------------
  | Exchange Configurations
  |--------------------------------------------------------------------------
  */
  exchanges: {
    /*
    |--------------------------------------------------------------------------
    | Database Exchange
    |--------------------------------------------------------------------------
    | Uses your local database to store and retrieve exchange rates.
    */
    database: exchanges.database({
      model: () => import('#models/currency'),
      base: 'USD',
      columns: {
        code: 'code',
        rate: 'exchange_rate',
      },
      // Cache configuration (optional)
      // cache: {
      //   service: () => import('@adonisjs/cache/services/main'),
      //   ttl: '1h',          // Cache TTL (human readable or milliseconds)
      //   keyPrefix: 'currency' // Cache key prefix
      // }
    }),

    /*
    |--------------------------------------------------------------------------
    | Google Finance Exchange
    |--------------------------------------------------------------------------
    | Free exchange using Google Finance API. No API key required.
    */
    google: exchanges.google({
      base: env.get('CURRENCY_BASE', 'USD'),
      timeout: 5000,
    }),

    /*
    |--------------------------------------------------------------------------
    | Fixer.io Exchange
    |--------------------------------------------------------------------------
    | Requires API key from fixer.io.
    */
    // fixer: exchanges.fixer({
    //   accessKey: env.get('FIXER_API_KEY'),
    //   base: env.get('CURRENCY_BASE', 'USD'),
    //   timeout: 10000
    // })
  },
})
```

### 3. Create Currency model

```bash
node ace make:model Currency
```

```typescript
// app/models/currency.ts
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Currency extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare exchange_rate: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

### 4. Create migration

```bash
node ace make:migration create_currencies_table
```

```typescript
// database/migrations/xxx_create_currencies_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'currencies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('code', 3).notNullable().unique()
      table.string('name').notNullable()
      table.decimal('exchange_rate', 15, 8).notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

### 5. Run migration

```bash
node ace migration:run
```

## 💡 Usage

### Basic Usage in Controllers

```typescript
// app/controllers/exchange_controller.ts
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import CurrencyService from '@ordius/adonisjs-currencyx/services/main'

@inject()
export default class ExchangeController {
  constructor(private currency: CurrencyService) {}

  async convert({ request, response }: HttpContext) {
    const { amount, from, to } = request.only(['amount', 'from', 'to'])

    const result = await this.currency.convert({
      amount: Number(amount),
      from,
      to,
    })

    if (result.success) {
      return response.json({
        success: true,
        data: {
          amount,
          from,
          to,
          result: result.result,
          rate: result.info.rate,
          timestamp: result.info.timestamp,
        },
      })
    }

    return response.status(400).json({
      success: false,
      error: result.error?.info,
    })
  }

  async getRates({ request, response }: HttpContext) {
    const { base, codes } = request.only(['base', 'codes'])

    const result = await this.currency.getExchangeRates({
      base,
      codes: codes.split(','),
    })

    if (result.success) {
      return response.json({
        success: true,
        data: result,
      })
    }

    return response.status(400).json({
      success: false,
      error: result.error?.info,
    })
  }
}
```

### Exchange Switching

```typescript
// Switch to different exchange at runtime
await this.currency.use('google')
const googleResult = await this.currency.convert({ amount: 100, from: 'USD', to: 'EUR' })

await this.currency.use('fixer')
const fixerResult = await this.currency.convert({ amount: 100, from: 'USD', to: 'EUR' })

await this.currency.use('database')
const dbResult = await this.currency.convert({ amount: 100, from: 'USD', to: 'EUR' })
```

### Database Exchange Usage

Seed your database with exchange rates:

```typescript
// database/seeders/currency_seeder.ts
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Currency from '#models/currency'

export default class extends BaseSeeder {
  async run() {
    const rates = [
      { code: 'USD', name: 'US Dollar', exchange_rate: 1.0 },
      { code: 'EUR', name: 'Euro', exchange_rate: 0.85 },
      { code: 'GBP', name: 'British Pound', exchange_rate: 0.73 },
      { code: 'JPY', name: 'Japanese Yen', exchange_rate: 110.0 },
      { code: 'CAD', name: 'Canadian Dollar', exchange_rate: 1.25 },
      { code: 'AUD', name: 'Australian Dollar', exchange_rate: 1.35 },
    ]

    for (const rate of rates) {
      await Currency.updateOrCreate({ code: rate.code }, rate)
    }
  }
}
```

Run the seeder:

```bash
node ace db:seed
```

### Caching

Enable caching for better performance:

```typescript
// config/currency.ts
database: exchanges.database({
  model: () => import('#models/currency'),
  base: 'USD',
  columns: {
    code: 'code',
    rate: 'exchange_rate',
  },
  cache: {
    service: () => import('@adonisjs/cache/services/main'), // AdonisJS cache service
    ttl: '1h', // Cache TTL (human readable or milliseconds)
    keyPrefix: 'currency', // Cache key prefix
  },
})
```

## 📚 API Reference

The AdonisJS integration provides the same API as the core CurrencyX.js package:

### Core Methods

```typescript
// Convert currency
const result = await currency.convert({
  amount: 100,
  from: 'USD',
  to: 'EUR',
})

// Get exchange rates
const rates = await currency.getExchangeRates({
  base: 'USD',
  codes: ['EUR', 'GBP', 'JPY'],
})
```

### Convenience Methods

```typescript
// Shorthand for getting rates
const rates = await currency.latestRates({ base: 'USD', codes: ['EUR', 'GBP'] })

// Get exchange rates with same API as core library
const rates = await currency.getExchangeRates({ base: 'USD', codes: ['EUR', 'GBP'] })
```

### Exchange Management

```typescript
// Switch exchanges
currency.use('google')

// Get current exchange
const current = currency.getCurrentExchange()

// List available exchanges
const exchanges = currency.getAvailableExchanges()
```

### Utility Methods

```typescript
// Format currency (object parameters)
const formatted = currency.formatCurrency({ amount: 1234.56, code: 'USD', locale: 'en-US' })

// Round values
const rounded = currency.round(123.456789, { precision: 2, direction: 'up' })

// Get supported currencies
const currencies = await currency.getSupportedCurrencies()

// Currency information utilities
const allCurrencies = currency.getList()
const usdInfo = currency.getByCode('USD')
const dollarCurrencies = currency.getBySymbol('$')
const usCurrency = currency.getByCountry('US')
const euroCurrencies = currency.filterByName('Euro')
const usCurrencies = currency.filterByCountry('US')

// Round money according to currency rules
const rounded = currency.roundMoney(123.456, 'USD')
```

## ⚙️ Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Default exchange
CURRENCY_PROVIDER=database

# Base currency
CURRENCY_BASE=USD

# Fixer.io API key (if using fixer exchange)
FIXER_API_KEY=your_api_key_here
```

### Exchange Configuration

#### Database Exchange

```typescript
database: exchanges.database({
  model: () => import('#models/currency'), // Your Currency model
  base: 'USD', // Base currency
  columns: {
    code: 'code', // Currency code column
    rate: 'exchange_rate', // Exchange rate column
  },
  cache: {
    // Optional caching
    service: () => import('@adonisjs/cache/services/main'), // AdonisJS cache service
    ttl: '1h', // Cache TTL (human readable or milliseconds)
    keyPrefix: 'currency', // Cache key prefix
  },
})
```

#### Google Finance Exchange

```typescript
google: exchanges.google({
  base: 'USD', // Base currency
  timeout: 5000, // Request timeout (optional)
})
```

#### Fixer.io Exchange

```typescript
fixer: exchanges.fixer({
  accessKey: 'your-api-key', // Required
  base: 'USD', // Base currency (default: 'USD' for this library)
  timeout: 10000, // Request timeout (optional)
})
```

## 🛡️ Error Handling

All methods return result objects with success indicators:

```typescript
const result = await currency.convert({
  amount: 100,
  from: 'USD',
  to: 'EUR',
})

if (result.success) {
  // Handle success
  console.log(`Converted: ${result.result}`)
  console.log(`Rate: ${result.info.rate}`)
  console.log(`Timestamp: ${result.info.timestamp}`)
} else {
  // Handle error
  console.error(`Error: ${result.error?.info}`)
  console.error(`Type: ${result.error?.type}`)
}
```

## 🧪 Testing

The package includes comprehensive tests. Run them with:

```bash
npm test
```

For development testing:

```bash
npm run quick:test
```

For test coverage:

```bash
npm run test
# Coverage report will be generated in ./coverage/
```

## 📋 Requirements

- **Node.js** >= 20.6.0
- **AdonisJS** >= 6.19.0
- **@adonisjs/lucid** >= 21.7.0 (for database provider)
- **@adonisjs/cache** >= 1.3.0 (optional, for caching)

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## 📄 License

MIT License - see [LICENSE.md](./LICENSE.md) file for details.

## 📦 Related Packages

- [@mixxtor/currencyx-js](https://www.npmjs.com/package/@mixxtor/currencyx-js) - Core currency conversion library

---

<div align="center">

**[Documentation](https://github.com/mixxtor/currencyx-adonisjs#readme)** • **[Issues](https://github.com/mixxtor/currencyx-adonisjs/issues)** • **[Contributing](./CONTRIBUTING.md)**

Made with ❤️ by [Mixxtor](https://github.com/mixxtor)

</div>
