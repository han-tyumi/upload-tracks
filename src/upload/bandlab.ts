import convert from 'convert-units'
import type {BrowserType, Page} from 'playwright'
import {path} from 'zx'

import {getLogicAudioFileName} from '../export/logic.js'
import type {Project} from '../project.js'
import {initiateFileChooser, logAction} from '../utils.js'

import type {LoginHandler, UploadTracksParameters} from './index.js'

// const maxFileUploadSize = convert(120).from('MB').to('B')

const maxFileDuration = convert(15).from('min').to('s')

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

  const projectsToUpload = projects.flatMap((project) =>
    project.splitProjects ? project.splitProjects : [project],
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
      await page.waitForNavigation({url: libraryUrl})
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
        await page.locator('a:has-text("New")').click()
        await page.locator('.modal-close').click()
      },
    )

    let fileIndex = 0
    const totalFiles = audioFilePaths.length
    for (const file of audioFilePaths) {
      fileIndex += 1
      const fileCount = `${projectCount} [${fileIndex}/${totalFiles}]`

      const {base} = path.parse(file)
      const trackName = getLogicAudioFileName(file)

      await logAction(`${fileCount} uploading ${base}`, async () => {
        await page.getByText('Add Track').click()
        await page.getByText('Voice/AudioRecord with AutoPitch + Fx').click()
        await page.getByRole('textbox', {name: 'Voice/Audio'}).fill(trackName)
        await page.locator('.mix-editor-track-header-settings').last().click()
        const fileChooser = await initiateFileChooser(
          page,
          'text=Import from Disk',
        )
        await fileChooser.setFiles([file])
        await page
          .getByText(base, {exact: true})
          .waitFor({timeout: convert(5).from('min').to('ms')})
      })
    }

    await logAction(`${projectCount} saving ${name}`, async () => {
      await page.locator('[placeholder="New Project"]').fill(name)
      await page.locator('button:has-text("Save")').click()
      await page
        .locator('text=Revision saved')
        .waitFor({timeout: convert(5).from('min').to('ms')})
    })
  }

  if (persistPage === undefined) {
    await logAction('closing browser', browser.close())
  } else {
    return page
  }
}
