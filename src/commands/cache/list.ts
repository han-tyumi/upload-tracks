import {toArray} from 'modern-async'

import {exportCache} from '../../export/index.js'
import {commandModule} from '../../utils.js'

export default commandModule(
  {
    command: 'list',
    aliases: ['ls'],
    describe: 'List the currently cached exported project tracks',
  },

  undefined,

  async () => {
    const entries = await toArray(exportCache)
    if (entries.length <= 0) {
      console.log('no project exports cached')
      return
    }

    console.table(
      entries.map(([projectFile, exportedTracksDir]) => ({
        projectFile,
        exportedTracksDir,
      })),
    )
  },
)
