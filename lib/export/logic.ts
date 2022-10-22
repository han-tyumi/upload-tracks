import $ from "dax";
import * as log from "log";
import { map } from "modern-async";
import plist from "simple-plist";

export const ProjectMetaDataPath = "Alternatives/000/MetaData.plist";
export const IgnoredAudioFilesRegexps = [
  /Smart Tempo Multitrack Set/,
];
export const ProjectMediaDirPath = "Media";
export const CachedDirPrefix = "uptrks";

export enum AudioFileExtension {
  MP3 = ".mp3",
  MP4 = ".mp4",
  WAV = ".wav",
  AAC = ".aac",
  M4A = ".m4a",
  OGG = ".ogg",
}

export type MetaData = {
  AudioFiles: string[];
  BeatsPerMinute: number;
  FrameRateIndex: number;
  HasARAPlugins: boolean;
  HasGrid: boolean;
  ImpulsResponsesFiles: string[];
  NumberOfTracks: number;
  PlaybackFiles: unknown[];
  QuicksamplerFiles: unknown[];
  SampleRate: number;
  SamplerInstrumentsFiles: unknown[];
  SignatureKey: number;
  SongGenderKey: string;
  SongKey: string;
  SongSignatureDenominator: number;
  SongSignatureNumerator: number;
  SurroundFormatIndex: number;
  SurroundModeIndex: number;
  UltrabeatFiles: unknown[];
  UnusedAudioFiles: unknown[];
  Version: number;
  isTimeCodeBased: boolean;
};

class MapCounter<K> {
  #map = new Map<K, number>();

  get size(): number {
    return this.#map.size;
  }

  count(item: K): number {
    return this.#map.get(item) ?? 0;
  }

  add(item: K, step = 1): number {
    const newCount = this.count(item) + step;
    if (newCount === 0) {
      this.#map.delete(item);
    } else {
      this.#map.set(item, newCount);
    }
    return newCount;
  }

  delete(item: K, step = 1): number {
    return this.add(item, -step);
  }
}

function arraysHaveSameValues(arr1: unknown[], arr2: unknown[]): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  }

  const counter = new MapCounter<unknown>();
  for (let i = 0; i < arr1.length; i++) {
    counter.add(arr1[i]);
    counter.delete(arr2[i]);
  }

  return counter.size === 0;
}

async function directoryHasFiles(
  dirPath: string,
  filePaths: string[],
): Promise<boolean> {
  try {
    const dirFileNames = await map(
      $.fs.walk(dirPath, {
        includeDirs: false,
        maxDepth: 1,
      }),
      ({ path }) => $.path.parse(path).name,
    );
    const fileNames = filePaths.map((path) => $.path.parse(path).name);
    return arraysHaveSameValues(dirFileNames, fileNames);
  } catch {
    return false;
  }
}

export async function exportTracks(
  projectDirPath: string,
  audioFileExtension: AudioFileExtension,
): Promise<string> {
  const metaDataPath = $.path.join(projectDirPath, ProjectMetaDataPath);
  const metaData = await new Promise<MetaData | undefined>(
    (resolve, reject) => {
      plist.readFile<MetaData>(metaDataPath, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    },
  );

  if (!metaData || metaData.AudioFiles.length <= 0) {
    throw new Error("AudioFiles not found");
  }

  const filePaths = metaData.AudioFiles
    .filter((audioFilePath) =>
      !IgnoredAudioFilesRegexps.some((regex) => regex.test(audioFilePath))
    )
    .map((audioFilePath) =>
      $.path.join(projectDirPath, ProjectMediaDirPath, audioFilePath)
    );

  const cachedDirPath = localStorage.getItem(projectDirPath);
  if (cachedDirPath) {
    if (
      await directoryHasFiles(cachedDirPath, filePaths)
    ) {
      log.info(
        `using cached dir for ${projectDirPath} at ${cachedDirPath}`,
      );
      return cachedDirPath;
    }

    log.warning(
      `removing invalid cached directory for ${projectDirPath} at ${cachedDirPath}`,
    );
    await $.fs.emptyDir(cachedDirPath);
    localStorage.removeItem(projectDirPath);
  }

  const dirPath = await Deno.makeTempDir({ prefix: CachedDirPrefix });

  try {
    await Promise.all(
      filePaths.map(async (path) => {
        const { name } = $.path.parse(path);
        const newPath = $.path.join(dirPath, name + audioFileExtension);
        const result = await $`ffmpeg -y -i ${path} ${newPath}`.quiet();
        if (result.code === 0) {
          log.debug(result.stdout);
        } else {
          log.error(result.stderr);
        }
      }),
    );
  } catch (error) {
    await Deno.remove(dirPath, { recursive: true });
    throw error;
  }

  localStorage.setItem(projectDirPath, dirPath);
  return dirPath;
}
