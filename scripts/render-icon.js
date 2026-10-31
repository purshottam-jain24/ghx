// Renders build/icon.png (1024x1024) for electron-builder.
// Run with: npx electron scripts/render-icon.js
const path = require("path");
const fs = require("fs");
const { app, BrowserWindow } = require("electron");

const glyph = require("../desktop/renderer/icons").logo;

const html = `<!doctype html><html><body style="margin:0;background:transparent">
<div style="position:absolute;left:100px;top:100px;width:824px;height:824px;border-radius:186px;
  background:linear-gradient(135deg,#8b7bff 0%,#5b4bf0 55%,#3b82f6 100%);
  box-shadow:inset 0 4px 0 rgba(255,255,255,.22);display:grid;place-items:center">
  <svg width="520" height="520" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
</div></body></html>`;

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const image = await win.webContents.capturePage();
  const out = path.join(__dirname, "../build/icon.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, image.resize({ width: 1024, height: 1024 }).toPNG());
  console.log(`Wrote ${out}`);
  app.quit();
});
