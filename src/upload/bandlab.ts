import convert from 'convert-units'
import type {BrowserType, Page} from 'playwright'
import {path} from 'zx'

import {getLogicAudioFileName} from '../export/logic.js'
import type {Project} from '../project.js'
import {logAction, splitArray} from '../utils.js'

import type {LoginHandler, UploadTracksParameters} from './index.js'

// const maxFileUploadSize = convert(120).from('MB').to('B')
const maxFileDuration = convert(15).from('min').to('s')
const maxUploadedFiles = 5

// enum FileUploadExtensions {
//   MP3 = '.mp3',
//   MP4 = '.mp4',
//   WAV = '.wav',
//   AAC = '.aac',
//   M4A = '.m4a',
//   OGG = '.ogg',
// }

const login: LoginHandler = async (page, {username, password}) => {
  await page.locator('[placeholder="Username or email"]').fill(username)
  await page
    .locator('[placeholder="Enter at least 6 characters"]')
    .fill(password)

  await page.locator('text=Log In').click()
}

export const baseLibraryUrl = 'https://www.bandlab.com/library'

export type BandLabUploadParameters = {
  browserType: BrowserType
  libraryPath?: string | undefined
  head?: boolean | undefined
  slow?: number | undefined
  pause?: boolean | undefined
  persistPage?: Page | true | undefined
} & UploadTracksParameters

async function closeModals(page: Page) {
  try {
    for (;;) {
      await page.locator('.modal-close').first().click({timeout: 2000})
    }
  } catch {}
}

export async function uploadToBandLab(
  projects: Project[],
  {
    browserType,
    libraryPath = '',
    head,
    slow,
    pause,
    persistPage,
    ...loginParameters
  }: BandLabUploadParameters,
): Promise<Page | void> {
  await Promise.all(
    projects.map(async (project) => {
      if (!project.splitProjects) {
        await project.split(maxFileDuration)
        if (project.splitProjects) {
          await project.saveToCache()
        }
      }
    }),
  )

  const projectsToUpload = projects.flatMap(
    (project) => project.splitProjects ?? [project],
  )

  if (projectsToUpload.length <= 0) {
    return
  }

  const {browser, page} =
    persistPage && persistPage !== true
      ? (() => {
          const context = persistPage.context()
          const browser = context.browser()!
          return {browser, page: persistPage}
        })()
      : await logAction('opening browser', async () => {
          const browser = await browserType.launch({
            headless: !head,
            slowMo: slow ?? 0,
          })
          const context = await browser.newContext()
          const page = await context.newPage()
          return {browser, page}
        })

  if (pause) {
    await page.pause()
  }

  const libraryUrl = path.join(baseLibraryUrl, libraryPath)
  if (!persistPage || persistPage === true) {
    await logAction('logging in', async () => {
      await page.goto(libraryUrl)
      await login(page, loginParameters)
      await page.waitForURL(libraryUrl)
    })
  }

  let projectIndex = 0
  const totalProjects = projectsToUpload.length
  for (const {name, audioFilePaths} of projectsToUpload) {
    projectIndex += 1
    const projectCount = `[${projectIndex}/${totalProjects}]`

    await logAction(
      `${projectCount} creating new project for ${name}`,
      async () => {
        await page.goto(libraryUrl)
        await page.getByText('New').click()
        await page.waitForURL(/\/studio/, {waitUntil: 'networkidle'})
        await closeModals(page)
      },
    )

    const audioFilePathCount = audioFilePaths.length
    const groupedAudioFilePaths = splitArray(audioFilePaths, maxUploadedFiles)
    let filesUploaded = 0

    for (const audioFilePaths of groupedAudioFilePaths) {
      filesUploaded += audioFilePaths.length
      const uploadCount = `${projectCount} [${filesUploaded}/${audioFilePathCount}]`

      await logAction(
        `${uploadCount} uploading ${
          audioFilePaths.length
        } tracks: \n${audioFilePaths
          .map((audioFilePath) => ` - ${path.basename(audioFilePath)}`)
          .join('\n')}\n`,
        async () => {
          const fileChooserPromise = page.waitForEvent('filechooser')
          await page
            .locator('div')
            .filter({hasText: 'Drop a loop or an audio/MIDI/video file'})
            .nth(4)
            .click()
          const fileChooser = await fileChooserPromise
          await fileChooser.setFiles(audioFilePaths)

          await Promise.all(
            audioFilePaths.map(async (audioFilePath) =>
              page
                .getByText(path.basename(audioFilePath), {exact: true})
                .waitFor({timeout: convert(5).from('min').to('ms')}),
            ),
          )
        },
      )
    }

    const regions = page.locator('.mix-editor-region-name')
    const headers = page.locator('.mix-editor-track-header-name-input > input')

    const allRegions = await regions.all()
    for (const [index, region] of allRegions.entries()) {
      const renameCount = `${projectCount} [${index + 1}/${allRegions.length}]`
      const regionTextContent = await region.textContent()
      const regionName = regionTextContent?.trim() ?? 'Unknown'

      await logAction(
        `${renameCount} renaming ${regionName}'s track`,
        async () => {
          const trackName = getLogicAudioFileName(regionName)
          await headers.nth(index).fill(trackName)
        },
      )
    }

    await logAction(`${projectCount} saving ${name}`, async () => {
      await page.locator('[placeholder="New Project"]').fill(name)
      await page.locator('button:has-text("Save")').click()
      await page
        .locator('text=Project saved')
        .waitFor({timeout: convert(5).from('min').to('ms')})
    })
  }

  if (persistPage === undefined) {
    await logAction('closing browser', browser.close())
  } else {
    return page
  }
}
