import type {BrowserType, Page} from 'playwright'

export type LoginParameters = {
  username: string
  password: string
}

export type LoginHandler = (
  page: Page,
  parameters: LoginParameters,
) => Promise<void>

export type UploadTracksParameters = {
  browserType: BrowserType
} & LoginParameters

export * from './bandlab.js'
export * from './soundtrap.js'
