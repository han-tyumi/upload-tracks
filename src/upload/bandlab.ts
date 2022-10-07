import convert from 'convert-units'
import {some} from 'modern-async'
import type {BrowserType} from 'playwright'
import {$, path} from 'zx'

import type {Project} from '../project.js'
import {compressProjectFiles} from '../project.js'
import {initiateFileChooser} from '../utils.js'

import type {LoginHandler, UploadTracksParameters} from '.'

const maxFileUploadSize = convert(120).from('MB').to('B')

const maxFileDuration = convert(15).from('min').to('s')

enum FileUploadExtensions {
  MP3 = '.mp3',
  MP4 = '.mp4',
  WAV = '.wav',
  AAC = '.aac',
  M4A = '.m4a',
  OGG = '.ogg',
}

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
  libraryPath: string | undefined
} & UploadTracksParameters

export async function uploadToBandLab(
  projects: Project[],
  {browserType, libraryPath = '', ...loginParameters}: BandLabUploadParameters,
) {
  const uploadableProject: Project[] = []
  for (const project of projects) {
    if (
      await some(project.files, async (file) => {
        const {stdout: duration} =
          await $`ffprobe -v error -show_entries format=duration -of csv='p=0' -i ${file}`
        return Number.parseFloat(duration) > maxFileDuration
      })
    ) {
      console.log(`${project.name} is too long; skipping upload`)
      continue
    }

    uploadableProject.push(
      await compressProjectFiles(
        project,
        maxFileUploadSize,
        FileUploadExtensions.AAC,
      ),
    )
  }

  const browser = await browserType.launch({headless: false})
  const context = await browser.newContext()
  const page = await context.newPage()

  const libraryUrl = path.join(baseLibraryUrl, libraryPath)
  await page.goto(libraryUrl)
  await login(page, loginParameters)
  await page.waitForNavigation({url: libraryUrl})

  for (const {name, files} of uploadableProject) {
    await page.goto(libraryUrl)

    await page.locator('a:has-text("New")').click()
    const fileChooser = await initiateFileChooser(page, 'text=Import File')
    await fileChooser.setFiles(files)

    await Promise.all(
      files.map(async (file) =>
        page
          .locator(`'${path.basename(file)}'`)
          .waitFor({timeout: convert(5).from('min').to('ms')}),
      ),
    )

    await page.locator('[placeholder="New Project"]').fill(name)
    await page.locator('button:has-text("Save")').click()
    await page
      .locator('text=Revision saved')
      .waitFor({timeout: convert(5).from('min').to('ms')})
  }

  await browser.close()
}
