import process from 'node:process'

import type {Page} from 'playwright'
import type {CommandModule, ArgumentsCamelCase, CommandBuilder} from 'yargs'
import {$, path} from 'zx'

export const logAction = async <T>(
  action: string,
  promise: Promise<T> | (() => Promise<T>),
) => {
  process.stdout.write(`${action} ...`)
  try {
    const result = await (typeof promise === 'function' ? promise() : promise)
    process.stdout.write(' done\n')
    return result
  } catch (error: unknown) {
    process.stderr.write(' error\n')
    throw error
  }
}

export const initiateFileChooser = async (page: Page, selector: string) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator(selector).click(),
  ])
  return fileChooser
}

export function commandModule<T, U>(
  init: Pick<CommandModule, 'command' | 'aliases' | 'describe' | 'deprecated'>,
  builder?: CommandBuilder<T, U>,
  handler?: (args: ArgumentsCamelCase<U>) => void | Promise<void>,
) {
  const module: CommandModule<T, U> = {
    ...init,
    builder,
    // @ts-expect-error: type is incorrect
    handler,
  }
  return module
}

export async function getTrackDuration(filePath: string) {
  const {stdout: duration} =
    await $`ffprobe -v error -show_entries format=duration -of csv='p=0' -i ${filePath}`
  return Number.parseFloat(duration)
}

export type SuffixFunction = (segment: number) => string

export type SplitTrackParameters = {
  maxDuration: number
  directoryPath?: string
  suffix?: SuffixFunction
}

export async function splitTrack(
  audioFilePath: string,
  parameters: SplitTrackParameters,
) {
  const {
    maxDuration: maxTrackLength,
    directoryPath = '',
    suffix = (segmentNumber) => ` Part ${segmentNumber}`,
  } = parameters

  const duration = await getTrackDuration(audioFilePath)
  if (duration <= maxTrackLength) {
    return [audioFilePath]
  }

  const {dir, name, ext} = path.parse(audioFilePath)
  const newDirectoryPath = path.resolve(dir, directoryPath)
  const segments = Math.ceil(duration / maxTrackLength)
  const segmentDuration = duration / segments

  const promises = []
  let start = 0
  for (let segment = 1; segment <= segments; segment += 1) {
    const end = start + segmentDuration
    promises.push(
      (async (start) => {
        const newFilePath = path.join(
          newDirectoryPath,
          name + suffix(segment) + ext,
        )
        await $`ffmpeg -i ${audioFilePath} -acodec copy -ss ${start} -to ${end} ${newFilePath}`
        return newFilePath
      })(start),
    )
    start = end
  }

  return Promise.all(promises)
}

export const splitArray = <T>(array: T[], amount: number) => {
  const output = []

  for (let i = 0; i < array.length; i += amount) {
    output.push(array.slice(i, i + amount))
  }

  return output
}
