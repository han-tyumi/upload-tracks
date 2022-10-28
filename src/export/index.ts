import {kvsLocalStorage} from '@kvs/node-localstorage'
import {fs, path} from 'zx'

import type {Project} from '../project.js'

export const exportCache = await kvsLocalStorage<Record<string, string>>({
  name: 'export-tracks',
  version: 1,
})

export type TrackExporter = (projectFile: string) => Promise<string>

export async function exportDocuments(
  documents: string[],
  exportTracks: TrackExporter,
) {
  const exports: Record<string, string> = {}

  for (const document of documents) {
    const absPath = path.resolve(document)
    const {name} = path.parse(absPath)

    try {
      exports[name] = await exportTracks(absPath)
    } catch (error: unknown) {
      console.error(error)
    }
  }

  const projects = await Promise.all(
    Object.entries(exports).map(async ([name, directory]) => {
      const files = await fs.readdir(directory)
      const project: Project = {
        name,
        files: files.map((file) => path.join(directory, file)),
      }

      return project
    }),
  )

  return projects
}

export * from './logic.js'
