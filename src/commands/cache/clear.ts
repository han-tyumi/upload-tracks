import {fs} from 'zx'

import {projectCache} from '../../project.js'
import {commandModule, logAction} from '../../utils.js'

export default commandModule(
  {
    command: 'clear',
    aliases: ['clr', 'clean', 'cln'],
    describe: 'Clear the cached exported project tracks',
  },

  undefined,

  async () => {
    let hasData = false
    try {
      for await (const [, {path, cachePath}] of projectCache) {
        await logAction(`removing '${cachePath}' for '${path}'`, async () => {
          await fs.rm(cachePath, {
            recursive: true,
            force: true,
          })
        })
        hasData = true
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message)
      } else {
        console.error(error)
      }
    }

    if (hasData) {
      await projectCache.clear()
    } else {
      console.log('export cache is empty')
    }
  },
)
