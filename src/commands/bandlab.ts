import {firefox} from 'playwright'
import {sleep} from 'zx'

import {
  exportDocuments,
  exportTracksFromLogic,
  getOpenLogicDocument,
} from '../export/index.js'
import type {LoginParameters} from '../upload/index.js'
import {uploadToBandLab} from '../upload/index.js'
import {commandModule} from '../utils.js'

type UploadDocumentsParameters = {
  libraryPath: string | undefined
} & LoginParameters

const watchInterval = 2 * 1000

async function uploadDocuments(
  documents: string[],
  {username, password, libraryPath}: UploadDocumentsParameters,
) {
  const projects = await exportDocuments(documents, exportTracksFromLogic)
  await uploadToBandLab(projects, {
    browserType: firefox,
    username,
    password,
    libraryPath,
  })
}

async function uploadOpenedDocumentsOnClose(
  watchDirPaths: string[],
  {username, password, libraryPath}: UploadDocumentsParameters,
) {
  let lastOpenDocument: string | undefined

  for (;;) {
    console.log(`watching ${watchDirPaths.join(', ')} ...`)

    for (;;) {
      const openDocument = await getOpenLogicDocument(watchDirPaths)

      if (lastOpenDocument && openDocument !== lastOpenDocument) {
        await uploadDocuments([lastOpenDocument], {
          username,
          password,
          libraryPath,
        })
        break
      }

      lastOpenDocument = openDocument

      await sleep(watchInterval)
    }
  }
}

export default commandModule(
  {
    command: 'bandlab <documents...>',
    describe: 'Upload Logic Pro projects to BandLab',
  },

  (yargs) =>
    yargs
      .positional('documents', {
        type: 'string',
        array: true,
        demandOption: true,
      })
      .options({
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
        libraryPath: {
          alias: ['library', 'l'],
          type: 'string',
        },
        watch: {
          alias: ['w'],
          type: 'boolean',
        },
      }),

  async ({documents, watch, ...parameters}) => {
    if (watch) {
      await uploadOpenedDocumentsOnClose(documents, parameters)
    }

    await uploadDocuments(documents, parameters)
  },
)
