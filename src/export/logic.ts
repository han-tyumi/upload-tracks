import {clipboard, Key, keyboard} from '@nut-tree/nut-js'
import {watch} from 'chokidar'
import convert from 'convert-units'
import {$, fs, os, path, sleep} from 'zx'

import {logAction, tap} from '../utils.js'

import type {TrackExporter} from '.'
import {exportCache} from '.'

export const exportTracksFromLogic: TrackExporter = async (
  projectFile: string,
) => {
  const cachedDir = await exportCache.get(projectFile)
  if (cachedDir) {
    console.log(`using cached export files at ${cachedDir}`)
    return cachedDir
  }

  const dir = await logAction(
    'creating temp directory',
    fs.mkdtemp(path.join(os.tmpdir(), 'export-tracks-')),
  )

  try {
    await logAction(`opening '${projectFile}' in logic`, async () => {
      await $`open ${projectFile} -a 'Logic Pro X.app'`
      await sleep(convert(5).from('s').to('ms'))
    })

    await logAction(`selecting '${dir}'`, async () => {
      await tap(Key.LeftShift, Key.LeftSuper, Key.E)
      await sleep(convert(1).from('s').to('ms'))

      const firstDirChar = dir.charAt(0)
      const restDir = dir.slice(1)
      await clipboard.copy(restDir)

      await keyboard.type(firstDirChar)
      await tap(Key.LeftSuper, Key.V)
      await keyboard.type(Key.Enter)
      await sleep(convert(1).from('s').to('ms'))
    })

    await logAction('exporting all tracks', async () => {
      await keyboard.type(Key.Tab)
      await sleep(convert(1).from('s').to('ms'))
      await keyboard.type(Key.Enter)
      await sleep(convert(1).from('s').to('ms'))

      // Files are added and then eventually unlinked in favor of the final files
      const files = new Set<string>()
      const watcher = watch(dir)
      watcher
        .on('add', (path, stats) => {
          if (stats && path.endsWith('.wav')) {
            files.add(path)
          }
        })
        .on('unlink', (path) => {
          files.delete(path)
        })

      // Wait until all initial files are unlinked
      await sleep(convert(2).from('s').to('ms'))
      while (files.size > 0) {
        await sleep(convert(1).from('s').to('ms'))
      }

      await watcher.close()
    })

    await exportCache.set(projectFile, dir)

    await logAction('closing project', async () => {
      await tap(Key.LeftSuper, Key.W)
      await sleep(convert(0.5).from('s').to('ms'))
      await tap(Key.Enter)
    })
  } catch (error: unknown) {
    await logAction(`removing '${dir}'`, fs.rm(dir, {recursive: true}))
    throw error
  }

  return dir
}
