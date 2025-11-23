# Changelog

All notable changes to this project will be documented in this file.

# [1.2.0](https://github.com/mixxtor/currencyx-adonisjs/compare/v1.1.0...v1.2.0) (2025-07-23)

### Features

- update DatabaseProvider to use new database_exchange module and adjust type exports ([32d5a27](https://github.com/mixxtor/currencyx-adonisjs/commit/32d5a27a3300932ac6d11b8116f8fcf996a7efcf))

# [1.1.0](https://github.com/mixxtor/currencyx-adonisjs/compare/v1.0.4...v1.1.0) (2025-07-22)

### Added

- Added main service for currency management with type inference.
- Created utility functions for defining currency configuration and managing database interactions.

### Refactor

- Implemented a new DatabaseProvider class for handling currency data with caching support.
- Updated tests to reflect changes in configuration and provider structure.
- Enhanced TypeScript definitions for better type safety and inference.
- Updated TypeScript configuration to support decorators and metadata.

### Features

- introduce CurrencyX AdonisJS integration with new database provider ([4fe38ca](https://github.com/mixxtor/currencyx-adonisjs/commit/4fe38ca68a5749043b9ae95548691e6a0fb022ee))

## [1.0.4](https://github.com/mixxtor/currencyx-adonisjs/compare/v1.0.3...v1.0.4) (2025-07-19)

### Refactor

- All helper functions (`google()`, `fixer()`, `database()`) now return fully initialized provider instances instead of configuration objects.
- Providers now properly inherit from their base classes, improving type safety and code clarity.
- The internal structure and API patterns are now consistent with the broader currencyx-js ecosystem.

### Fixed

- Fixed tests to check for provider instances instead of plain objects.
- Removed `baseCurrency` property from `DatabaseProvider` and replaced all references with `this.base`.
- Adjusted constructor and methods in `DatabaseProvider` to use the inherited `base` property.
- Removed unnecessary checks for private properties in tests.

## [1.0.3](https://github.com/mixxtor/currencyx-adonisjs/compare/currencyx-adonisjs-v1.0.2...currencyx-adonisjs-v1.0.3) (2025-07-19)

### Fixed

- Fixed stubs templates using `app.configPath()`, `app.modelPath()`, and `app.migrationsPath()`
- Export `CurrencyService` types from `@mixxtor/currencyx-js`
- Fixed currency provider service types from `@adonisjs/core/types`

## [1.0.2](https://github.com/mixxtor/currencyx-adonisjs/compare/currencyx-adonisjs-v1.0.1...currencyx-adonisjs-v1.0.2) (2025-07-19)

### Fixed

- Fixed stub exports with proper `to` attribute for AdonisJS v6 compatibility
- Fixed provider import path in configure script
- Added proper package.json exports for provider module
- Fixed "Missing 'to' attribute in stub exports" error during `node ace configure`
- Fixed "Cannot find module '@mixxtor/currencyx-adonisjs/currency_provider'" error

### Changed

- Updated stub templates to use `app.configPath()`, `app.modelPath()`, and `app.migrationPath()`
- Updated provider registration path to `@mixxtor/currencyx-adonisjs/providers/currency_provider`

## [1.0.0] - 2025-07-19

### Added

- Initial release of CurrencyX AdonisJS integration
- Database provider with Lucid ORM support
- Base currency concept with automatic cross-rate calculations
- Cache support with @adonisjs/cache integration
- Type-safe configuration with module augmentation
- Automatic model and migration generation via `node ace configure`
- Comprehensive test suite with 23 tests
- Support for real database schema with exchange_rate column
- Flexible cache configuration (false | CacheConfig)

### Features

- **Database Provider**: Full Lucid ORM integration for storing exchange rates
- **Service Provider**: Auto-registration with AdonisJS IoC container
- **Configuration**: AdonisJS-style config with environment validation
- **Type Safety**: Full TypeScript support with module augmentation
- **Cache Support**: Optional caching with @adonisjs/cache
- **Auto Setup**: Automatic model and migration generation
- **Well Tested**: Comprehensive test suite

### Technical Details

- Base currency support (default: USD)
- Column mapping for custom database schemas
- Cross-rate calculations (EUR → GBP = GBP_rate / EUR_rate)
- Error handling with graceful fallbacks
- Cache key pattern: `currency:rate:USD:EUR`
