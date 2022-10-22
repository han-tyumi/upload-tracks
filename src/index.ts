import process from 'node:process'

import {cosmiconfigSync} from 'cosmiconfig'
import yargs from 'yargs'
import {$} from 'zx'

import bandlab from './commands/bandlab.js'
import soundtrap from './commands/soundtrap.js'
import cache from './commands/cache/index.js'
import export_ from './commands/export/index.js'

$.verbose = false

const argv = yargs(process.argv.slice(2))
  .scriptName('ut')
  .env('UT')
  .completion('completion', 'Generate completion script')
  .recommendCommands()
  .version()
  .help()
  .command(bandlab)
  .command(soundtrap)
  .command(cache)
  .command(export_)

const explorer = cosmiconfigSync('ut')
const searchResult = explorer.search()

await (searchResult?.config
  ? argv.config(searchResult.config)
  : argv.config('C', 'Path to config file', (configPath) => {
      const result = explorer.load(configPath)
      return result?.config as Record<string, unknown>
    })
).parse()
