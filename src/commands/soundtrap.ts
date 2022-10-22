import {firefox} from 'playwright'

import {exportDocuments, exportTracksFromLogic} from '../export/index.js'
import {uploadToSoundtrap} from '../upload/soundtrap.js'
import {commandModule} from '../utils.js'

export default commandModule(
  {
    command: 'soundtrap <documents...>',
    describe: 'Upload Logic Pro projects to Soundtrap',
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
