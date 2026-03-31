/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| The configure hook is called when someone runs "node ace configure <package>"
| command. You are free to perform any operations inside this function to
| configure the package.
|
| To make things easier, you have access to the underlying "ConfigureCommand"
| instance and you can use codemods to modify the source files.
|
*/

import type ConfigureCommand from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.ts'

export async function configure(command: ConfigureCommand) {
  const codemods = await command.createCodemods()

  /**
   * Publish config file
   */
  await codemods.makeUsingStub(stubsRoot, 'config/currency.stub', {})

  /**
   * Register provider
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@mixxtor/currencyx-adonisjs/currency_provider')
  })

  /**
   * Create currency model if it doesn't exist
   */
  const project = await codemods.getTsMorphProject()
  const modelExists = project?.getSourceFile('app/models/currency.ts')

  if (!modelExists) {
    await codemods.makeUsingStub(stubsRoot, 'models/currency.stub', {})
  }

  /**
   * Create migration if it doesn't exist
   */
  const migrationPattern = 'database/migrations/*_create_currencies_table.ts'
  const migrationFiles = project?.getSourceFiles(migrationPattern) || []
  const migrationExists = migrationFiles.length > 0

  if (!migrationExists) {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
    await codemods.makeUsingStub(stubsRoot, 'migrations/create_currencies_table.stub', {
      migration: {
        className: 'CreateCurrenciesTable',
        fileName: `${timestamp}_create_currencies_table.ts`,
      },
    })
  }
}
