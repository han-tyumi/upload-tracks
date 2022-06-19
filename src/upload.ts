import { BrowserType, Page } from "playwright";
import { path } from "zx";

import { min } from "./utils";

export const Providers = [
  "email",
  "username",
  "google",
  "facebook",
  "apple",
  "phone",
] as const;
export type Provider = typeof Providers[number];

export interface LoginParams {
  provider?: Provider;
  username: string;
  password: string;
}

export type LoginHandler = (page: Page, params: LoginParams) => Promise<void>;

const emailLogin: LoginHandler = async (page, { username, password }) => {
  await page.locator('[placeholder="Username or email"]').fill(username);

  await page
    .locator('[placeholder="Enter at least 6 characters"]')
    .fill(password);

  await page.locator("text=Log In").click();
};

async function login(page: Page, params: LoginParams) {
  const { provider = "email" } = params;
  switch (provider) {
    case "email":
    case "username":
      await emailLogin(page, params);
      break;
    default:
      throw new Error(`${provider} is not supported`);
  }
}

export const BaseLibraryUrl = `https://www.bandlab.com/library`;

export interface UploadTracksParams extends LoginParams {
  browserType: BrowserType;
  libraryPath?: string;
}

export interface Project {
  name: string;
  files: string[];
}

export async function uploadProjects(
  projects: Project[],
  { browserType, libraryPath = "", ...loginParams }: UploadTracksParams
) {
  const browser = await browserType.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const libraryUrl = path.join(BaseLibraryUrl, libraryPath);
  await page.goto(libraryUrl);
  await login(page, loginParams);
  await page.waitForNavigation({ url: libraryUrl });

  for (const { name, files } of projects) {
    await page.goto(libraryUrl);

    await page.locator('a:has-text("New")').click();
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("text=Import Audio/MIDI").click(),
    ]);
    await fileChooser.setFiles(files);

    await Promise.all(
      files.map((file) =>
        page.locator(`'${path.basename(file)}'`).waitFor({ timeout: min(5) })
      )
    );

    await page.locator('[placeholder="New Project"]').fill(name);
    await page.locator('button:has-text("Save")').click();
    await page.locator("text=Revision saved").waitFor({ timeout: min(5) });
  }

  await browser.close();
}
