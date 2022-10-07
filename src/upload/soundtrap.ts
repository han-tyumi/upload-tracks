import convert from 'convert-units'

import type {Project} from '../project.js'
import {initiateFileChooser} from '../utils.js'

import type {LoginHandler, UploadTracksParameters} from '.'

export type SoundtrapUploadParameters = {
  folder: string | undefined
  collaboratorEmails: string[] | undefined
} & UploadTracksParameters

const login: LoginHandler = async (page, {username, password}) => {
  await page.locator('[aria-label="email"]').fill(username)
  await page.locator('[aria-label="password"]').fill(password)
  await page.locator('text=Remember me').click()
  await page.locator('#l_submit').click()
}

export async function uploadToSoundtrap(
  projects: Project[],
  {
    browserType,
    folder,
    collaboratorEmails = [],
    ...loginParameters
  }: SoundtrapUploadParameters,
) {
  const browser = await browserType.launch({headless: false})
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('https://www.soundtrap.com/studio/')
  await page.locator('text=Already have an account? Click here').click()
  await login(page, loginParameters)
  await page.waitForURL('https://www.soundtrap.com/studio/')

  let i = 0
  for (const {name, files} of projects) {
    await page.goto('https://www.soundtrap.com/studio/')

    await page.locator('.st-uix-dialog-content-container > .closer').click()
    switch (i) {
      case 0: {
        await page.locator('.st-dialog-footer > .btn').click()

        break
      }

      case 1: {
        await page
          .locator(
            'text=Patterns Beatmaker A new way to create cool drum beats. Later Try it now >> [aria-label="Close"]',
          )
          .click()

        break
      }

      case 2: {
        await page.locator('.content-container > .btn').click()

        break
      }
      // No default
    }

    const fileChooser = await initiateFileChooser(
      page,
      '[aria-label="Import file"]',
    )
    await fileChooser.setFiles(files)

    await page.locator('[aria-label="Change\\a name"]').click()
    await page.locator('.projecttitleedit').fill(name)

    await page.locator('button:has-text("Share") >> nth=1').click()

    const userSearchInput = page.locator('#user-search-input-field')
    await userSearchInput.waitFor({
      timeout: convert(10).from('min').to('ms'),
    })

    for (const email of collaboratorEmails) {
      await userSearchInput.type(email)
      await userSearchInput.press('Enter')
    }

    await page.locator('button.add-collaborator-invite-button').click()

    i++
  }

  await page.goto('https://www.soundtrap.com/home/creator/projects')

  await page
    .locator('st-dialog-container[role="dialog"] [aria-label="Close"]')
    .click()

  if (folder) {
    for (const {name} of projects) {
      const projectItem = page
        .locator('st-project-list-item', {
          has: page.locator(`.title__main >> text=/${name}/`),
        })
        .first()
      await projectItem.locator('[aria-label="Project actions"]').click()
      await page.locator('text=Move to folder').click()
      await page.locator(`div[role="menu"]:has-text("${folder}")`).click()
    }
  }

  await browser.close()
}
