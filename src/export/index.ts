import {path} from 'zx'

import type {Project} from '../project.js'

export type ProjectCreator = (projectPath: string) => Promise<Project> | Project

export async function createExportedProjects(
  projectPaths: string[],
  createProject: ProjectCreator,
) {
  return Promise.all(
    projectPaths.map((projectPath) => createProject(path.resolve(projectPath))),
  )
}

export * from './logic.js'
