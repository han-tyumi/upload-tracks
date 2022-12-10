import {kvsLocalStorage} from '@kvs/node-localstorage'
import {some} from 'modern-async'
import {$, fs, os, path} from 'zx'

import type {SuffixFunction} from './utils.js'
import {getTrackDuration, logAction, splitTrack} from './utils.js'

export type ProjectParameters = {
  path: string
  cachePath?: string
  name?: string
  audioFilePaths?: string[]
}

export type CachedProject = Required<ProjectParameters> & {
  splitProjectPaths?: string[] | undefined
}

export const projectCache = await kvsLocalStorage<
  Record<string, CachedProject>
>({
  name: 'export-tracks',
  storeFilePath: path.join(os.homedir(), '.cache', 'kvs-node-localstorage'),
  version: 1,
})

export class Project {
  path: string
  cachePath: string
  name: string
  audioFilePaths: string[]
  splitProjects?: Project[] | undefined

  constructor({
    path: projectPath,
    cachePath = projectPath,
    name = path.parse(projectPath).name,
    audioFilePaths = [],
  }: ProjectParameters) {
    this.path = projectPath
    this.cachePath = cachePath
    this.name = name
    this.audioFilePaths = audioFilePaths
  }

  /**
   * @todo move out logs
   */
  async compressFiles(maxFileSize: number, fileExtension: string) {
    const compressedAudioFilePaths: string[] = []

    for (const filePath of this.audioFilePaths) {
      let {size} = await fs.stat(filePath)
      if (size <= maxFileSize) {
        compressedAudioFilePaths.push(filePath)
        continue
      }

      const {dir, name} = path.parse(filePath)
      const newFilePath = path.join(dir, name + fileExtension)

      await logAction(
        `converting '${filePath}' to '${fileExtension}'`,
        $`ffmpeg -y -i ${filePath} ${newFilePath}`,
      )
      ;({size} = await fs.stat(newFilePath))
      if (size <= maxFileSize) {
        await fs.remove(filePath)
        compressedAudioFilePaths.push(newFilePath)
      } else {
        console.log(`'${filePath}' still too large`)
        await fs.remove(newFilePath)
      }
    }

    return this
  }

  async split(
    maxDuration: number,
    suffix: SuffixFunction = (segment) => ` Part ${segment}`,
  ) {
    // makes sure we have files
    const [firstFile, ...remainingFiles] = this.audioFilePaths
    if (!firstFile) {
      this.splitProjects = undefined
      return this
    }

    // make sure tracks are all the same length and greater than max duration
    const firstTrackLength = await getTrackDuration(firstFile)
    if (
      firstTrackLength <= maxDuration ||
      (await some(
        remainingFiles,
        async (file) => (await getTrackDuration(file)) !== firstTrackLength,
      ))
    ) {
      this.splitProjects = undefined
      return this
    }

    const splitProjectAudioFilePaths = await Promise.all(
      this.audioFilePaths.map(async (file) =>
        splitTrack(file, {
          maxDuration,
          suffix,
        }),
      ),
    )

    this.splitProjects = []

    const promises = []
    for (const splitAudioFilePaths of splitProjectAudioFilePaths) {
      for (const [index, audioFilePath] of splitAudioFilePaths.entries()) {
        let splitProject = this.splitProjects[index]
        if (!splitProject) {
          const name = this.name + suffix(index + 1)
          const splitProjectPath = path.join(this.cachePath, name)
          splitProject = new Project({
            path: splitProjectPath,
            name,
          })
          this.splitProjects[index] = splitProject
        }

        promises.push(
          (async () => {
            const newAudioFilePath = path.join(
              splitProject.cachePath,
              path.basename(audioFilePath),
            )
            await fs.move(audioFilePath, newAudioFilePath)
            splitProject.audioFilePaths.push(newAudioFilePath)
          })(),
        )
      }
    }

    await Promise.all(promises)
    return this
  }

  async saveToCache() {
    await Promise.all([
      ...(this.splitProjects?.map(async (splitProject) =>
        splitProject.saveToCache(),
      ) ?? []),
      projectCache.set(this.path, {
        path: this.path,
        cachePath: this.cachePath,
        name: this.name,
        audioFilePaths: this.audioFilePaths,
        splitProjectPaths: this.splitProjects?.map((project) => project.path),
      }),
    ])
    return this
  }

  async loadFromCache() {
    const cachedProject = await projectCache.get(this.path)
    if (!cachedProject) {
      return
    }

    this.name = cachedProject.name
    this.cachePath = cachedProject.cachePath
    this.audioFilePaths = cachedProject.audioFilePaths

    if (cachedProject.splitProjectPaths) {
      this.splitProjects = []

      const splitProjects = await Promise.all(
        cachedProject.splitProjectPaths.map(async (splitProjectPath) =>
          new Project({path: splitProjectPath}).loadFromCache(),
        ),
      )

      for (const splitProject of splitProjects) {
        if (splitProject) {
          this.splitProjects.push(splitProject)
        }
      }
    }

    return this
  }
}
