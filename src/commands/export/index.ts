import {commandModule} from '../../utils.js'

import logic from './logic.js'

export default commandModule(
  {command: 'export', describe: 'Export Desktop DAW projects'},

  (yargs) => yargs.command(logic),
)
