import process from 'node:process'

import type {Key} from '@nut-tree/nut-js'
import {keyboard} from '@nut-tree/nut-js'
import type {Page} from 'playwright'

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

export const tap = async (...keys: Key[]) => {
  await keyboard.pressKey(...keys)
  await keyboard.releaseKey(...keys)
}

export const initiateFileChooser = async (page: Page, selector: string) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator(selector).click(),
  ])
  return fileChooser
}
