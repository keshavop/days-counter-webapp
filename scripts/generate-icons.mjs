// Renders public/icons/icon.svg into the PNG sizes the PWA manifest and iOS need.
// Usage: npm run icons   (needs Playwright + Chromium available)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const svg = readFileSync(new URL("../public/icons/icon.svg", import.meta.url), "utf8");

const targets = [
  { file: "icon-192.png", size: 192, pad: 0, bg: "transparent" },
  { file: "icon-512.png", size: 512, pad: 0, bg: "transparent" },
  { file: "apple-touch-icon.png", size: 180, pad: 0, bg: "#c2410c" },
  // Maskable: keep the artwork inside the 80% safe zone on a full-bleed background.
  { file: "icon-maskable-512.png", size: 512, pad: 0.12, bg: "#c2410c" },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:${t.bg};display:flex;align-items:center;justify-content:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: new URL(`../public/icons/${t.file}`, import.meta.url).pathname, omitBackground: t.bg === "transparent" });
  console.log("wrote", t.file);
}
await browser.close();
