import {exportDocuments, exportTracksFromLogic} from '../../export/index.js'
import {commandModule} from '../../utils.js'

export default commandModule(
  {
    command: 'logic <documents...>',
    describe: 'Export all tracks from a Logic Pro document',
  },

  (yargs) =>
    yargs.positional('documents', {
      type: 'string',
      array: true,
      demandOption: true,
    }),

  async ({documents}) => {
    await exportDocuments(documents, exportTracksFromLogic)
  },
)
