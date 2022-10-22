import {fs} from 'zx'

import {exportCache} from '../../export/index.js'
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
    for await (const [projectFile, exportedTracksDir] of exportCache) {
      await logAction(
        `removing '${exportedTracksDir}' for '${projectFile}'`,
        async () => {
          await fs.rm(exportedTracksDir, {
            recursive: true,
            force: true,
          })
        },
      )
      hasData = true
    }

    if (hasData) {
      await exportCache.clear()
    } else {
      console.log('export cache is empty')
    }
  },
)
