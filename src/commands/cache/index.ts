import {commandModule} from '../../utils.js'

import clear from './clear.js'
import list from './list.js'

export default commandModule(
  {
    command: 'cache',
    describe: 'Manage the exported project tracks cache',
  },

  (yargs) => yargs.command(list).command(clear),
)
