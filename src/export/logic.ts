import {promisify} from 'node:util'
import plist from 'simple-plist'
import {$, fs, os, path, ProcessOutput} from 'zx'

import {logAction} from '../utils.js'

import type {TrackExporter} from './index.js'
import {exportCache} from './index.js'

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

export const logicDocumentExtension = '.logicx'

export const exportTracksFromLogic: TrackExporter = async (
  projectFile: string,
) => {
  const cachedDir = await exportCache.get(projectFile)
  if (cachedDir) {
    console.log(`using cached export files at ${cachedDir}`)
    return cachedDir
  }

  const metaDataPath = path.join(projectFile, 'Alternatives/000/MetaData.plist')
  const metaData: MetaData | undefined = await promisify(plist.readFile)(
    metaDataPath,
  )
  const files = metaData?.AudioFiles.filter(
    (audioFilePath) =>
      !audioFilePath.startsWith('Audio Files/Smart Tempo Multitrack Set '),
  ).map((audioFilePath) => path.join(projectFile, 'Media', audioFilePath))

  if (!files || files.length <= 0) {
    throw new Error('AudioFiles not found')
  }

  const dir = await logAction(
    'creating temp directory',
    fs.mkdtemp(path.join(os.tmpdir(), 'export-tracks-')),
  )

  try {
    await logAction(
      'converting tracks to WAV',
      Promise.all(
        files.map(async (file) => {
          const {name} = path.parse(file)
          const newFilePath = path.join(dir, `${name}.wav`)
          await $`ffmpeg -y -i ${file} ${newFilePath}`
        }),
      ),
    )
  } catch (error: unknown) {
    await logAction(`removing '${dir}'`, fs.rm(dir, {recursive: true}))
    throw error
  }

  await exportCache.set(projectFile, dir)
  return dir
}

export async function getOpenLogicDocument(documents: string[]) {
  try {
    // lsof returns a 1 exit code (error) in this case
    await $`lsof -F n +D ${documents} | grep ${logicDocumentExtension}`
    return
  } catch (error: unknown) {
    if (!(error instanceof ProcessOutput) || error.stderr) {
      return
    }

    const dirPath = error.stdout.split('\n').at(1)
    if (!dirPath) {
      return
    }

    const project = dirPath.slice(
      dirPath.indexOf('/'),
      dirPath.lastIndexOf(logicDocumentExtension) +
        logicDocumentExtension.length,
    )

    if (path.parse(project).name.startsWith('Untitled')) {
      return
    }

    return project
  }
}

export async function* closedLogicDocuments(watchDirPaths: string[]) {
  let lastOpenDocument: string | undefined

  for (;;) {
    const openDocument = await getOpenLogicDocument(watchDirPaths)

    if (lastOpenDocument && openDocument !== lastOpenDocument) {
      yield lastOpenDocument
    }

    lastOpenDocument = openDocument
  }
}
