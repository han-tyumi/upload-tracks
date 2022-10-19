import process from 'node:process'

import {cosmiconfigSync} from 'cosmiconfig'
import {toArray} from 'modern-async'
import {firefox} from 'playwright'
import type {Options} from 'yargs'
import yargs from 'yargs'
import {$, fs} from 'zx'

import {
  exportDocuments,
  exportCache,
  exportTracksFromLogic,
} from './export/index.js'
import {uploadToBandLab, uploadToSoundtrap} from './upload/index.js'
import {logAction} from './utils.js'

$.verbose = false

const options = <T extends Record<string, Options>>(options: T) => options

const loginOptions = options({
  username: {
    alias: ['u', 'email', 'e'],
    type: 'string',
    demandOption: true,
  },
  password: {
    alias: ['p'],
    type: 'string',
    demandOption: true,
  },
})

const argv = yargs(process.argv.slice(2))
  .scriptName('ut')
  .env('UT')
  .completion('completion', 'Generate completion script')
  .recommendCommands()
  .version()
  .help()

  .command(
    'bandlab <documents...>',
    'Upload Logic Pro projects to BandLab',
    (yargs) =>
      yargs
        .positional('documents', {
          type: 'string',
          array: true,
          demandOption: true,
        })
        .options({
          ...loginOptions,
          libraryPath: {
            alias: ['library', 'l'],
            type: 'string',
          },
        }),
    async ({documents, username, password, libraryPath}) => {
      const projects = await exportDocuments(documents, exportTracksFromLogic)
      await uploadToBandLab(projects, {
        browserType: firefox,
        username,
        password,
        libraryPath,
      })
    },
  )

  .command(
    'soundtrap <documents...>',
    'Upload Logic Pro projects to Soundtrap',
    (yargs) =>
      yargs
        .positional('documents', {
          type: 'string',
          array: true,
          demandOption: true,
        })
        .options({
          ...loginOptions,
          folder: {
            alias: ['f'],
            type: 'string',
          },
          collaboratorEmails: {
            alias: ['c', 'collaborators'],
            type: 'array',
          },
        }),
    async ({documents, username, password, folder, collaboratorEmails}) => {
      const projects = await exportDocuments(documents, exportTracksFromLogic)
      await uploadToSoundtrap(projects, {
        browserType: firefox,
        username,
        password,
        folder,
        collaboratorEmails: collaboratorEmails?.map(String),
      })
    },
  )

  .command('export', 'Export Desktop DAW projects', (yargs) =>
    yargs.command(
      'logic <documents...>',
      'Export all tracks from a Logic Pro document',
      (yargs) =>
        yargs.positional('documents', {
          type: 'string',
          array: true,
          demandOption: true,
        }),
      async ({documents}) => {
        await exportDocuments(documents, exportTracksFromLogic)
      },
    ),
  )

  .command('cache', 'Manage the exported project tracks cache', (yargs) =>
    yargs
      .command(
        ['list', 'ls'],
        'List the currently cached exported project tracks',
        {},
        async () => {
          const entries = await toArray(exportCache)
          if (entries.length <= 0) {
            console.log('no project exports cached')
            return
          }

          console.table(
            entries.map(([projectFile, exportedTracksDir]) => ({
              projectFile,
              exportedTracksDir,
            })),
          )
        },
      )

      .command(
        ['clear', 'clr', 'clean', 'cln'],
        'Clear the cached exported project tracks',
        {},
        async () => {
          let hasData = false
          for await (const [projectFile, exportedTracksDir] of exportCache) {
            await logAction(
              `removing '${exportedTracksDir}' for '${projectFile}'`,
              async () => {
                await fs.rm(exportedTracksDir, {
                  recursive: true,
                  force: true,
                })
              },
            )
            hasData = true
          }

          if (hasData) {
            await exportCache.clear()
          } else {
            console.log('export cache is empty')
          }
        },
      ),
  )

const explorer = cosmiconfigSync('ut')
const searchResult = explorer.search()

await (searchResult?.config
  ? argv.config(searchResult.config)
  : argv.config('C', 'Path to config file', (configPath) => {
      const result = explorer.load(configPath)
      return result?.config as Record<string, unknown>
    })
).parse()
