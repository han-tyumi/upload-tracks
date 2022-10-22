import { Command, EnumType } from "cliffy";
import { LevelName, LogLevelNames } from "log/levels";
import * as log from "log";

import exportCommand from "./export/export.ts";
import bandlab from "./bandlab.ts";

export default new Command()
  .name("uptrks")
  .version("0.1.0")
  .description("Upload tracks from your desktop DAW to an online DAW.")
  .type("loglevel", new EnumType(LogLevelNames as LevelName[]))
  .globalOption(
    "-v, --loglevel <level:loglevel>",
    "Level of logging to output.",
    {
      default: "INFO" as LevelName,
      action: ({ loglevel }) => {
        log.setup({
          handlers: {
            default: new log.handlers.ConsoleHandler(loglevel),
          },
          loggers: {
            default: {
              level: loglevel,
            },
          },
        });
      },
    },
  )
  .command("export", exportCommand)
  .command("bandlab", bandlab);
