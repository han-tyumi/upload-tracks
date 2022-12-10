import {
  createExportedProjects,
  createExportedLogicProject,
} from '../../export/index.js'
import {commandModule} from '../../utils.js'

export default commandModule(
  {
    command: 'logic <projectPaths...>',
    describe: 'Export all tracks from a Logic Pro project',
  },

  (yargs) =>
    yargs.positional('projectPaths', {
      type: 'string',
      array: true,
      demandOption: true,
    }),

  async ({projectPaths}) => {
    await createExportedProjects(projectPaths, createExportedLogicProject)
  },
)
