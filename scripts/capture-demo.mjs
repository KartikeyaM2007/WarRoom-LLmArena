/**
 * Captures War Room demo screenshots and a short screen recording.
 * Requires: npm start running, Playwright browsers installed.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs", "demo", "screenshots");
const videoDir = path.join(root, "docs", "demo", "video");
const uiUrl = process.env.DEMO_UI_URL ?? "http://localhost:5173/";
const previewUrl =
  process.env.DEMO_PREVIEW_URL ?? "http://127.0.0.1:8787/preview/run-1780504578530/";

async function capture() {
  await mkdir(outDir, { recursive: true });
  await mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  console.log("Loading arena UI...");
  await page.goto(uiUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(outDir, "01-arena-overview.png"), fullPage: true });
  console.log("Captured 01-arena-overview.png");

  const registry = page.locator(".model-status-card");
  if (await registry.count()) {
    await registry.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await registry.screenshot({ path: path.join(outDir, "02-model-registry.png") });
    console.log("Captured 02-model-registry.png");
  }

  const prompt = page.locator(".prompt-card");
  if (await prompt.count()) {
    await prompt.scrollIntoViewIfNeeded();
    await prompt.screenshot({ path: path.join(outDir, "03-prompt-and-runtime.png") });
    console.log("Captured 03-prompt-and-runtime.png");
  }

  console.log("Recording UI walkthrough (scroll)...");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  for (let y = 0; y <= 1200; y += 200) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(500);
  }

  console.log("Capturing group chat (run arena first for best results)...");
  const runButton = page.getByRole("button", { name: /Run Agent Arena/i });
  if (await runButton.isEnabled()) {
    await runButton.click();
    await page.waitForTimeout(8000);
    const chat = page.locator(".chat-card");
    if (await chat.count()) {
      await chat.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await chat.screenshot({ path: path.join(outDir, "05-group-chat-debate.png") });
      console.log("Captured 05-group-chat-debate.png");
    }
  }

  console.log("Opening live preview...");
  const previewPage = await context.newPage();
  try {
    await previewPage.goto(previewUrl, { waitUntil: "networkidle", timeout: 15000 });
    await previewPage.waitForTimeout(2000);
    await previewPage.screenshot({ path: path.join(outDir, "04-live-preview-todo.png"), fullPage: false });
    console.log("Captured 04-live-preview-todo.png");
  } catch (error) {
    console.warn("Preview capture skipped:", error instanceof Error ? error.message : error);
  }

  await context.close();
  await browser.close();

  const { readdir, copyFile, rm, stat } = await import("node:fs/promises");
  const videos = (await readdir(videoDir)).filter((name) => name.endsWith(".webm") && name !== "warroom-demo.webm");
  let largest = null;
  let largestSize = 0;
  for (const name of videos) {
    const size = (await stat(path.join(videoDir, name))).size;
    if (size > largestSize) {
      largestSize = size;
      largest = name;
    }
  }
  if (largest) {
    await copyFile(path.join(videoDir, largest), path.join(videoDir, "warroom-demo.webm"));
    for (const name of videos) {
      await rm(path.join(videoDir, name), { force: true });
    }
    console.log("Saved video/warroom-demo.webm");
  }

  console.log(`\nDone. Screenshots: ${outDir}`);
  console.log(`Video: ${path.join(videoDir, "warroom-demo.webm")}`);
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
