import {some} from 'modern-async'
import {$, fs, path} from 'zx'

import type {SuffixFunction} from './utils.js'
import {getTrackDuration, logAction, splitTrack} from './utils.js'

export type Project = {
  name: string
  files: string[]
}

export async function compressProjectFiles(
  {name, files}: Project,
  maxFileSize: number,
  compressedFileExtension: string,
) {
  const compressedProject: Project = {name, files: []}

  for (const filePath of files) {
    let {size} = await fs.stat(filePath)
    if (size <= maxFileSize) {
      compressedProject.files.push(filePath)
      continue
    }

    const {dir, name} = path.parse(filePath)
    const newFilePath = path.join(dir, name + compressedFileExtension)
    await logAction(
      `converting '${filePath}' to '${compressedFileExtension}'`,
      $`ffmpeg -y -i ${filePath} ${newFilePath}`,
    )
    ;({size} = await fs.stat(newFilePath))
    if (size <= maxFileSize) {
      await fs.remove(filePath)
      compressedProject.files.push(newFilePath)
    } else {
      console.log(`'${filePath}' still too large`)
      await fs.remove(newFilePath)
    }
  }

  return compressedProject
}

export type SplitProjectParameters = {
  maxDuration: number
  suffix?: SuffixFunction
}

export async function splitProject(
  project: Project,
  parameters: SplitProjectParameters,
) {
  const {maxDuration, suffix = (segmentNumber) => ` Part ${segmentNumber}`} =
    parameters

  // makes sure we have files
  const [firstFile, ...remainingFiles] = project.files
  if (!firstFile) {
    return [project]
  }

  // make sure tracks are all the same length
  const firstTrackLength = await getTrackDuration(firstFile)
  if (
    await some(
      remainingFiles,
      async (file) => (await getTrackDuration(file)) !== firstTrackLength,
    )
  ) {
    return [project]
  }

  const splitProjectFiles = await Promise.all(
    project.files.map(async (file) =>
      splitTrack(file, {
        maxDuration,
        suffix,
      }),
    ),
  )

  const projects: Project[] = []
  for (const splitFiles of splitProjectFiles) {
    for (const [index, file] of splitFiles.entries()) {
      const splitProject = projects[index] ?? {
        name: project.name + suffix(index + 1),
        files: [],
      }
      splitProject.files.push(file)
      projects[index] = splitProject
    }
  }

  return projects
}
