import { Command, EnumType } from "cliffy";

import { AudioFileExtension, exportTracks } from "lib/export/logic.ts";
import { uploadTracks } from "../lib/upload/bandlab.ts";

export default new Command()
  .description("Export tracks from Logic Pro then upload to Bandlab.")
  .type("ext", new EnumType(AudioFileExtension))
  .option("-e, --ext <ext:ext>", "Audio file extension to export tracks as.", {
    default: AudioFileExtension.WAV,
  })
  .option(
    "-U, --username <username:string>",
    "Your BandLab username or email.",
    { required: true },
  )
  .option(
    "-P, --password <password:string>",
    "Your BandLab password.",
    { required: true },
  )
  .arguments("<project...>")
  .action(async ({ ext, username, password }, ...projectDirPaths) => {
    // await Promise.all(
    //   projectDirPaths.map((projectDirPath) =>
    //     exportTracks(projectDirPath, ext)
    //   ),
    // );

    await uploadTracks({ username, password }, []);
  });
