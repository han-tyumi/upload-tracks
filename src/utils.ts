import path from 'node:path'
import process from 'node:process'

import type {Page} from 'playwright'
import type {CommandModule, ArgumentsCamelCase, CommandBuilder} from 'yargs'
import {$} from 'zx'

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

export type SuffixFunction = (segmentNumber: number) => string

export type SplitTrackParameters = {
  maxDuration: number
  suffix?: SuffixFunction
}

export async function splitTrack(
  filePath: string,
  parameters: SplitTrackParameters,
) {
  const {
    maxDuration: maxTrackLength,
    suffix = (segmentNumber) => ` Part ${segmentNumber}`,
  } = parameters

  const duration = await getTrackDuration(filePath)
  if (duration <= maxTrackLength) {
    return [filePath]
  }

  const {dir, name, ext} = path.parse(filePath)
  const segments = Math.ceil(duration / maxTrackLength)
  const segmentDuration = duration / segments

  const promises = []
  let start = 0
  for (let segment = 1; segment <= segments; segment += 1) {
    const end = start + segmentDuration
    promises.push(
      (async (segment, start, end) => {
        const newFilePath = path.join(dir, name + suffix(segment) + ext)
        await $`ffmpeg -i ${filePath} -acodec copy -ss ${start} -to ${end} ${newFilePath}`
        return newFilePath
      })(segment, start, end),
    )
    start = end
  }

  return Promise.all(promises)
}
