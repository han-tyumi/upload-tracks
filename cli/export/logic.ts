import { Command, EnumType } from "cliffy";

import { AudioFileExtension, exportTracks } from "lib/export/logic.ts";

export default new Command()
  .description("Export tracks from Logic Pro.")
  .type("ext", new EnumType(AudioFileExtension))
  .option("-e, --ext <ext:ext>", "Audio file extension to export tracks as.", {
    default: AudioFileExtension.WAV,
  })
  .arguments("<project...>")
  .action(async ({ ext }, ...projectDirPaths) => {
    await Promise.all(
      projectDirPaths.map((projectDirPath) =>
        exportTracks(projectDirPath, ext)
      ),
    );
  });
