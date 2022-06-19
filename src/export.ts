import { Key, keyboard } from "@nut-tree/nut-js";
import { watch } from "chokidar";
import { $, fs, os, path, sleep } from "zx";

import { log, sec, tap } from "./utils";

export async function exportTracks(file: string) {
  const dir = await log(
    "creating temp directory",
    fs.mkdtemp(path.join(os.tmpdir(), "export-tracks-"))
  );

  try {
    await log(`opening '${file}' in logic`, async () => {
      await $`open ${file} -a 'Logic Pro X.app'`;
      await sleep(sec(5));
    });

    await log(`selecting '${dir}'`, async () => {
      await tap(Key.LeftShift, Key.LeftSuper, Key.E);
      await sleep(sec(1));

      await keyboard.type(dir);
      await keyboard.type(Key.Enter);
      await sleep(sec(1));
    });

    await log("exporting all tracks", async () => {
      await keyboard.type(Key.Tab);
      await sleep(sec(1));
      await keyboard.type(Key.Enter);
      await sleep(sec(1));

      // files are added and then eventually unlinked in favor of the final files
      const files = new Set<string>();
      const watcher = watch(dir);
      watcher
        .on("add", (path, stats) => {
          if (stats && path.endsWith(".wav")) {
            files.add(path);
          }
        })
        .on("unlink", (path) => {
          files.delete(path);
        });

      // wait until all initial files are unlinked
      await sleep(sec(2));
      while (files.size > 0) {
        await sleep(sec(1));
      }
      await watcher.close();
    });

    await log("closing project", async () => {
      await tap(Key.LeftSuper, Key.W);
      await sleep(sec(0.5));
      await tap(Key.Enter);
    });
  } catch (error) {
    await log(`removing '${dir}'`, fs.rm(dir, { recursive: true }));
    throw error;
  }

  return dir;
}
