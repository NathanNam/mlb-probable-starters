// Generates the favicon set and the share image from scripts/brand/ sources.
//
//   npm i --no-save puppeteer-core
//   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/brand/make.mjs
//
// Writes src/app/apple-icon.png (180), src/app/favicon.ico (16/32/48) and
// public/og.png (1200x630). src/app/icon.svg is the hand-drawn source.

import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const chrome =
  process.env.CHROME ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome");

const svg = await readFile(join(root, "src/app/icon.svg"), "utf8");
const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  userDataDir: await mkdtemp(join(tmpdir(), "brand-")),
});
const page = await browser.newPage();

async function renderIcon(size, { background = "transparent", inset = 0 } = {}) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const pad = Math.round(size * inset);
  await page.setContent(
    `<html><body style="margin:0;background:${background}">` +
      `<img src="${svgUrl}" style="display:block;width:${size - 2 * pad}px;height:${size - 2 * pad}px;margin:${pad}px"></body></html>`
  );
  return page.screenshot({ type: "png", omitBackground: background === "transparent" });
}

// Apple touch icon: iOS rounds the corners itself, so fill the square.
await writeFile(join(root, "src/app/apple-icon.png"), await renderIcon(180, { background: "#d9c8a2", inset: 0.1 }));

// favicon.ico with PNG-encoded 16, 32 and 48 px images.
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await renderIcon(s));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
await writeFile(join(root, "src/app/favicon.ico"), Buffer.concat([header, ...pngs]));

// Share image.
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(root, "scripts/brand/og.html")).href, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
await writeFile(join(root, "public/og.png"), await page.screenshot({ type: "png" }));

await browser.close();
console.log("Wrote src/app/apple-icon.png, src/app/favicon.ico, public/og.png");
