import type {Page} from 'playwright'
import {firefox} from 'playwright'
import {path} from 'zx'

import {
  closedLogicDocuments,
  exportDocuments,
  exportTracksFromLogic,
} from '../export/index.js'
import type {LoginParameters} from '../upload/index.js'
import {uploadToBandLab} from '../upload/index.js'
import {commandModule} from '../utils.js'

type UploadDocumentsParameters = {
  libraryPath: string | undefined
  head?: boolean | undefined
  slow?: number | undefined
  pause?: boolean | undefined
  persistPage?: Page | true | undefined
} & LoginParameters

async function uploadDocuments(
  documents: string[],
  parameters: UploadDocumentsParameters,
) {
  const projects = await exportDocuments(documents, exportTracksFromLogic)
  return uploadToBandLab(projects, {
    browserType: firefox,
    ...parameters,
  })
}

async function uploadOpenedDocumentsOnClose(
  watchDirPaths: string[],
  parameters: UploadDocumentsParameters,
) {
  const documentGenerator = closedLogicDocuments(watchDirPaths)
  let {persistPage} = parameters

  for (;;) {
    console.log(`watching ${watchDirPaths.join(', ')} ...`)

    const {value: document} = await documentGenerator.next()
    if (!document) {
      return
    }

    const page = await uploadDocuments([document], parameters)
    if (persistPage && page) {
      persistPage = page
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
        head: {
          alias: ['h'],
          type: 'boolean',
        },
        slow: {
          alias: ['s'],
          type: 'number',
          default: 500,
        },
        pause: {
          alias: ['P'],
          type: 'boolean',
        },
        watch: {
          alias: ['w'],
          type: 'boolean',
        },
      }),

  async ({documents, watch, ...parameters}) => {
    if (watch) {
      await uploadOpenedDocumentsOnClose(
        documents.map((document) => path.resolve(document)),
        {
          ...parameters,
          persistPage: true,
        },
      )
      return
    }

    await uploadDocuments(documents, parameters)
  },
)
