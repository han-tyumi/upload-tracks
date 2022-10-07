import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import

import process from 'node:process'

import {keyboard} from '@nut-tree/nut-js'
import {cosmiconfig} from 'cosmiconfig'
import {toArray} from 'modern-async'
import {webkit} from 'playwright'
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

keyboard.config.autoDelayMs = 100

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
  .env('UT')

  .command(
    'bandlab <documents...>',
    "export and upload Logic Pro documents' tracks to BandLab",
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
        browserType: webkit,
        username,
        password,
        libraryPath,
      })
    },
  )

  .command(
    'soundtrap <documents...>',
    "export and upload Logic Pro documents' tracks to Soundtrap",
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
        browserType: webkit,
        username,
        password,
        folder,
        collaboratorEmails: collaboratorEmails?.map(String),
      })
    },
  )

  .command('export', 'handles exporting Logic Pro files', (yargs) =>
    yargs
      .command(
        'logic <documents...>',
        'export the tracks from a logic document',
        (yargs) =>
          yargs.positional('documents', {
            type: 'string',
            array: true,
            demandOption: true,
          }),
        async ({documents}) => {
          for (const document of documents) {
            await exportTracksFromLogic(document)
          }
        },
      )

      .command('cache', 'manage the exported tracks cache', (yargs) =>
        yargs
          .command(
            ['list', 'ls'],
            'list the currently cached exported tracks',
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
            'clear cached exported tracks',
            {},
            async () => {
              let hasData = false
              for await (const [
                projectFile,
                exportedTracksDir,
              ] of exportCache) {
                await logAction(
                  `removing '${exportedTracksDir}' for '${projectFile}'`,
                  async () => {
                    await fs.rm(exportedTracksDir, {
                      recursive: true,
                      force: true,
                    })
                    await exportCache.delete(projectFile)
                  },
                )
                hasData = true
              }

              if (!hasData) {
                console.log('export cache is empty')
              }
            },
          ),
      ),
  )

const explorer = cosmiconfig('ut')
const searchResult = await explorer.search()

await (searchResult?.config
  ? argv.config(searchResult.config)
  : argv.config('C', 'Path to config file', async (configPath) => {
      const result = await explorer.load(configPath)
      return result?.config as Record<string, unknown> | undefined
    })
).parse()
