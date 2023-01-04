import process from 'node:process'

import {cosmiconfigSync} from 'cosmiconfig'
import yargs from 'yargs'
import {$} from 'zx'

import bandlab from './commands/bandlab.js'
import soundtrap from './commands/soundtrap.js'
import cache from './commands/cache/index.js'
import export_ from './commands/export/index.js'

let killed = false
const setKilled = () => {
  killed = true
}

process.on('SIGINT', setKilled)
process.on('SIGQUIT', setKilled)
process.on('SIGTERM', setKilled)

$.verbose = false

const argv = yargs(process.argv.slice(2))
  .scriptName('ut')
  .env('UT')
  .fail(false)
  .command(bandlab)
  .command(soundtrap)
  .command(cache)
  .command(export_)
  .completion('completion', 'Generate completion script')
  .recommendCommands()
  .version()
  .help()
  .alias({
    h: 'help',
    v: 'version',
  })

const explorer = cosmiconfigSync('ut')
const searchResult = explorer.search()

try {
  await (searchResult?.config
    ? argv.config(searchResult.config)
    : argv.config('C', 'Path to config file', (configPath) => {
        const result = explorer.load(configPath)
        return result?.config as Record<string, unknown>
      })
  ).parse()
} catch (error: unknown) {
  if (!killed) {
    throw error
  }
}
