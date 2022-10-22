import puppeteer, { Page } from "puppeteer";

export type Project = {
  name: string;
  exportedFilePaths: string[];
};

export type LoginParameters = {
  username: string;
  password: string;
};

export const baseLibraryUrl = "https://www.bandlab.com/library";

export async function login(
  page: Page,
  { username, password }: LoginParameters,
): Promise<void> {
  await page.type('[placeholder="Username or email"]', username);
  await page
    .type('[placeholder="Enter at least 6 characters"]', password);

  await page.click("text=Log In");
}

export async function uploadTracks(
  loginParameters: LoginParameters,
  projects: Project[],
): Promise<void> {
  const browser = await puppeteer.launch({
    product: "chrome",
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto(baseLibraryUrl);
  await login(page, loginParameters);
}
