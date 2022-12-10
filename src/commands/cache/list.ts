import {toArray} from 'modern-async'

import {projectCache} from '../../project.js'
import {commandModule} from '../../utils.js'

export default commandModule(
  {
    command: 'list',
    aliases: ['ls'],
    describe: 'List the currently cached exported project tracks',
  },

  undefined,

  async () => {
    const entries = await toArray(projectCache)
    if (entries.length <= 0) {
      console.log('no project exports cached')
      return
    }

    console.table(
      entries.map(([, {path, cachePath}]) => ({
        path,
        cachePath,
      })),
    )
  },
)
