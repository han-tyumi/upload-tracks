import process from 'node:process'

import type {Page} from 'playwright'
import type {CommandModule, ArgumentsCamelCase, CommandBuilder} from 'yargs'

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
