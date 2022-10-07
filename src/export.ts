import {kvsLocalStorage} from '@kvs/node-localstorage'
import {clipboard, Key, keyboard} from '@nut-tree/nut-js'
import {watch} from 'chokidar'
import convert from 'convert-units'
import {$, fs, os, path, sleep} from 'zx'

import type {Project} from './project.js'
import {logAction, tap} from './utils.js'

export const exportCache = await kvsLocalStorage<Record<string, string>>({
  name: 'export-tracks',
  version: 1,
})

export async function exportDocuments(documents: string[]) {
  const exports: Record<string, string> = {}

  for (const document of documents) {
    const {name} = path.parse(document)
    exports[name] = await exportTracks(document)
  }

  const projects = await Promise.all(
    Object.entries(exports).map(async ([name, directory]) => {
      const files = await fs.readdir(directory)
      const project: Project = {
        name,
        files: files.map((file) => path.join(directory, file)),
      }

      return project
    }),
  )

  return projects
}

export async function exportTracks(file: string) {
  const cachedDir = await exportCache.get(file)
  if (cachedDir) {
    console.log(`using cached export files at ${cachedDir}`)
    return cachedDir
  }

  const dir = await logAction(
    'creating temp directory',
    fs.mkdtemp(path.join(os.tmpdir(), 'export-tracks-')),
  )

  try {
    await logAction(`opening '${file}' in logic`, async () => {
      await $`open ${file} -a 'Logic Pro X.app'`
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

    await exportCache.set(file, dir)

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
