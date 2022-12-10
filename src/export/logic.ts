import {promisify} from 'node:util'
import plist from 'simple-plist'
import {$, fs, os, path, ProcessOutput} from 'zx'

import {Project} from '../project.js'
import {logAction} from '../utils.js'

import type {ProjectCreator} from './index.js'

type MetaData = {
  AudioFiles: string[]
  BeatsPerMinute: number
  FrameRateIndex: number
  HasARAPlugins: boolean
  HasGrid: boolean
  ImpulsResponsesFiles: string[]
  NumberOfTracks: number
  PlaybackFiles: unknown[]
  QuicksamplerFiles: unknown[]
  SampleRate: number
  SamplerInstrumentsFiles: unknown[]
  SignatureKey: number
  SongGenderKey: string
  SongKey: string
  SongSignatureDenominator: number
  SongSignatureNumerator: number
  SurroundFormatIndex: number
  SurroundModeIndex: number
  UltrabeatFiles: unknown[]
  UnusedAudioFiles: unknown[]
  Version: number
  isTimeCodeBased: boolean
}

export const logicProjectExtension = '.logicx'

export const getLogicAudioFileName = (filePath: string) => {
  const {name} = path.parse(filePath)
  const hashIndex = name.indexOf('#')
  const trackName = name.slice(0, hashIndex > 0 ? hashIndex : undefined)
  return trackName
}

export const createExportedLogicProject: ProjectCreator = async (
  projectPath: string,
) => {
  const cachedProject = await new Project({path: projectPath}).loadFromCache()
  if (cachedProject) {
    return cachedProject
  }

  const metaDataPath = path.join(projectPath, 'Alternatives/000/MetaData.plist')
  const metaData: MetaData | undefined = await promisify(plist.readFile)(
    metaDataPath,
  )

  const audioFileNames = new Set<string>()
  const audioFilePaths = metaData?.AudioFiles.filter(
    (audioFilePath) =>
      !audioFilePath.startsWith('Audio Files/Smart Tempo Multitrack Set '),
  ).map((audioFilePath) => {
    const name = getLogicAudioFileName(audioFilePath)
    if (audioFileNames.has(name)) {
      throw new Error(`found multiple ${name} tracks`)
    }

    audioFileNames.add(name)
    return path.join(projectPath, 'Media', audioFilePath)
  })

  if (!audioFilePaths || audioFilePaths.length <= 0) {
    throw new Error('audio files not found')
  }

  const cachePath = await logAction(
    'creating temp directory',
    fs.mkdtemp(path.join(os.tmpdir(), 'export-tracks-')),
  )

  let newAudioFilePaths: string[] = []
  try {
    newAudioFilePaths = await logAction(
      'converting tracks to WAV',
      Promise.all(
        audioFilePaths.map(async (audioFilePath) => {
          const {name} = path.parse(audioFilePath)
          const newAudioFilePath = path.join(cachePath, `${name}.wav`)
          await $`ffmpeg -y -i ${audioFilePath} ${newAudioFilePath}`
          return newAudioFilePath
        }),
      ),
    )
  } catch (error: unknown) {
    await logAction(
      `removing '${cachePath}'`,
      fs.rm(cachePath, {recursive: true}),
    )
    throw error
  }

  return new Project({
    path: projectPath,
    cachePath,
    audioFilePaths: newAudioFilePaths,
  }).saveToCache()
}

export async function getOpenLogicProjectPath(projectPaths: string[]) {
  try {
    // lsof returns a 1 exit code (error) in this case
    await $`lsof -F n +D ${projectPaths} | grep ${logicProjectExtension}`
    return
  } catch (error: unknown) {
    if (!(error instanceof ProcessOutput) || error.stderr) {
      return
    }

    const directoryPath = error.stdout.split('\n').at(1)
    if (!directoryPath) {
      return
    }

    const projectPath = directoryPath.slice(
      directoryPath.indexOf('/'),
      directoryPath.lastIndexOf(logicProjectExtension) +
        logicProjectExtension.length,
    )

    if (path.parse(projectPath).name.startsWith('Untitled')) {
      return
    }

    return projectPath
  }
}

export async function* closedLogicProjectPaths(watchPaths: string[]) {
  let lastOpenProjectPath: string | undefined

  for (;;) {
    const openProjectPath = await getOpenLogicProjectPath(watchPaths)

    if (lastOpenProjectPath && openProjectPath !== lastOpenProjectPath) {
      yield lastOpenProjectPath
    }

    lastOpenProjectPath = openProjectPath
  }
}
