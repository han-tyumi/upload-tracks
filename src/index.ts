import "dotenv/config";

import { keyboard } from "@nut-tree/nut-js";
import yargs, { Options } from "yargs";
import { $, fs, path } from "zx";

import { exportTracks } from "./export";
import { Providers, uploadTracks } from "./upload";
import { log } from "./utils";

$.verbose = false;

keyboard.config.autoDelayMs = 50;

const options = <T extends Record<string, Options>>(options: T) => options;

const loginOptions = options({
  provider: {
    alias: ["P"],
    choices: Providers,
  },
  username: {
    alias: ["u", "email", "e"],
    type: "string",
    demandOption: true,
  },
  password: {
    alias: ["p"],
    type: "string",
    demandOption: true,
  },
  libraryPath: {
    alias: ["library", "l"],
    type: "string",
  },
});

const documentsPositional = (yargs: yargs.Argv<{}>) =>
  yargs.positional("documents", {
    type: "string",
    array: true,
    demandOption: true,
  });

async function main() {
  await yargs(process.argv.slice(2))
    .env()

    .command(
      "* <documents...>",
      "export and upload logic documents' tracks to BandLab",
      (yargs) => documentsPositional(yargs).options(loginOptions),
      async ({ documents, provider, username, password, libraryPath }) => {
        const exports: Record<string, string> = {};

        for (const document of documents) {
          const { name } = path.parse(document);
          exports[name] = await exportTracks(document);
        }

        for (const [name, directory] of Object.entries(exports)) {
          const files = (await fs.readdir(directory)).map((file) =>
            path.join(directory, file)
          );
          await uploadTracks(files, {
            provider,
            username,
            password,
            name,
            libraryPath,
          });
          await log(
            `removing '${directory}'`,
            fs.rm(directory, { recursive: true })
          );
        }
      }
    )

    .command(
      "export <documents...>",
      "export the tracks from a logic document",
      documentsPositional,
      async ({ documents }) => {
        for (const document of documents) {
          await exportTracks(document);
        }
      }
    )

    .command(
      "upload <name> <directory>",
      "upload a directory of wav files to BandLab",
      (yargs) =>
        yargs
          .positional("name", { type: "string", demandOption: true })
          .positional("directory", { type: "string", demandOption: true })
          .options(loginOptions),
      async ({
        name,
        directory,
        provider,
        username,
        password,
        libraryPath,
      }) => {
        const files = (await fs.readdir(directory)).map((file) =>
          path.join(directory, file)
        );

        const page = await uploadTracks(files, {
          provider,
          username,
          password,
          name,
          libraryPath,
        });

        await page.context().browser()?.close();
      }
    )

    .parse();
}

main();
