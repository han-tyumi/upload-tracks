import convert from 'convert-units'
import {some} from 'modern-async'
import type {BrowserType} from 'playwright'
import {$, path} from 'zx'

import type {Project} from '../project.js'
import {compressProjectFiles} from '../project.js'
import {initiateFileChooser, logAction} from '../utils.js'

import type {LoginHandler, UploadTracksParameters} from './index.js'

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
  const uploadableProjects: Project[] = []
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

    uploadableProjects.push(
      await compressProjectFiles(
        project,
        maxFileUploadSize,
        FileUploadExtensions.AAC,
      ),
    )
  }

  const {browser, page} = await logAction('opening browser', async () => {
    const browser = await browserType.launch()
    const context = await browser.newContext()
    const page = await context.newPage()
    return {browser, context, page}
  })

  const libraryUrl = path.join(baseLibraryUrl, libraryPath)
  await logAction('logging in', async () => {
    await page.goto(libraryUrl)
    await login(page, loginParameters)
    await page.waitForNavigation({url: libraryUrl})
  })

  let projectIndex = 0
  const totalProjects = uploadableProjects.length
  for (const {name, files} of uploadableProjects) {
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
    const totalFiles = files.length
    for (const file of files) {
      fileIndex += 1
      const fileCount = `${projectCount} [${fileIndex}/${totalFiles}]`

      const {base, name} = path.parse(file)
      const hashIndex = name.indexOf('#')
      const trackName = name.slice(0, hashIndex > 0 ? hashIndex : undefined)

      await logAction(`${fileCount} uploading ${base}`, async () => {
        const fileChooser = await initiateFileChooser(
          page,
          'text=Drop a loop or an audio/MIDI file',
        )
        await fileChooser.setFiles([file])
        await page.getByRole('textbox', {name: 'Track'}).fill(trackName)
        await page.getByText(base, {exact: true}).waitFor()
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

  await logAction('closing browser', browser.close())
}
