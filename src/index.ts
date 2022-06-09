import { Key, keyboard } from "@nut-tree/nut-js";
import yargs from "yargs";
import { $, sleep } from "zx";

const sec = (n: number) => n * 1000;

async function exportTracks(filePath: string) {
  await $`open ${filePath} -a 'Logic Pro X.app'`;
  await sleep(sec(1));
  await keyboard.type(Key.LeftShift, Key.LeftSuper, Key.E);
  await sleep(sec(1));
  await keyboard.type(Key.Enter);
}

async function main() {
  const { _: filePaths } = yargs(process.argv.slice(2)).string("_").parseSync();
  for (const filePath of filePaths) {
    await exportTracks(filePath);
  }
}

main();
