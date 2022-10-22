import {firefox} from 'playwright'

import {exportDocuments, exportTracksFromLogic} from '../export/index.js'
import {uploadToBandLab} from '../upload/index.js'
import {commandModule} from '../utils.js'

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
