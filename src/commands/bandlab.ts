import type {Page} from 'playwright'
import {firefox} from 'playwright'
import {path} from 'zx'

import {
  closedLogicProjectPaths,
  createExportedProjects,
  createExportedLogicProject,
} from '../export/index.js'
import type {LoginParameters} from '../upload/index.js'
import {uploadToBandLab} from '../upload/index.js'
import {commandModule} from '../utils.js'

type UploadProjectsParameters = {
  libraryPath: string | undefined
  head?: boolean | undefined
  slow?: number | undefined
  pause?: boolean | undefined
  persistPage?: Page | true | undefined
} & LoginParameters

async function uploadProjects(
  projectPaths: string[],
  parameters: UploadProjectsParameters,
) {
  const projects = await createExportedProjects(
    projectPaths,
    createExportedLogicProject,
  )
  return uploadToBandLab(projects, {
    browserType: firefox,
    ...parameters,
  })
}

async function uploadOpenedProjectsOnClose(
  watchPaths: string[],
  parameters: UploadProjectsParameters,
) {
  const projectPathGenerator = closedLogicProjectPaths(watchPaths)
  let {persistPage} = parameters

  for (;;) {
    console.log(`watching ${watchPaths.join(', ')} ...`)

    const {value: projectPath} = await projectPathGenerator.next()
    if (!projectPath) {
      return
    }

    const page = await uploadProjects([projectPath], parameters)
    if (persistPage && page) {
      persistPage = page
    }
  }
}

export default commandModule(
  {
    command: 'bandlab <projectPaths...>',
    describe: 'Upload Logic Pro projects to BandLab',
  },

  (yargs) =>
    yargs
      .positional('projectPaths', {
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
          type: 'boolean',
        },
        slow: {
          alias: ['s'],
          type: 'number',
          default: 250,
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

  async ({projectPaths, watch, pause, head = pause, ...parameters}) => {
    const finalParameters = {pause, head, ...parameters}

    if (watch) {
      await uploadOpenedProjectsOnClose(
        projectPaths.map((projectPath) => path.resolve(projectPath)),
        {
          ...finalParameters,
          persistPage: true,
        },
      )
      return
    }

    await uploadProjects(projectPaths, finalParameters)
  },
)
