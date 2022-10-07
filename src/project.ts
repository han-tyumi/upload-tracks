import {$, fs, path} from 'zx'

import {logAction} from './utils.js'

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
