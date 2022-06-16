import { Key, keyboard } from "@nut-tree/nut-js";

export const sec = (n: number) => n * 1000;
export const min = (n: number) => n * sec(60);

export const log = async <T>(
  action: string,
  promise: Promise<T> | (() => Promise<T>)
) => {
  process.stdout.write(`${action} ...`);
  try {
    const result = await (typeof promise === "function" ? promise() : promise);
    process.stdout.write(" done\n");
    return result;
  } catch (error) {
    process.stderr.write(" error\n");
    throw error;
  }
};

export const tap = async (...keys: Key[]) => {
  await keyboard.pressKey(...keys);
  await keyboard.releaseKey(...keys);
};
