// Generate icon.png (1024) + icon.ico (multi-res) from icon.svg.
// Run: node desktop/build-icon.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const ROOT = __dirname;
const SVG  = path.join(ROOT, 'icon.svg');
const PNG  = path.join(ROOT, 'icon.png');
const ICO  = path.join(ROOT, 'icon.ico');

async function main() {
  const svgBuf = fs.readFileSync(SVG);

  // 1) 1024x1024 PNG (for macOS/Linux + electron-builder fallback)
  await sharp(svgBuf, { density: 384 })
    .resize(1024, 1024)
    .png()
    .toFile(PNG);
  console.log('[icon] wrote', path.relative(process.cwd(), PNG));

  // 2) Multi-resolution ICO for Windows
  //    256 is required for high-DPI taskbar; rest cover legacy contexts.
  const sizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = await Promise.all(
    sizes.map((s) =>
      sharp(svgBuf, { density: Math.max(96, s) })
        .resize(s, s)
        .png()
        .toBuffer()
    )
  );
  const icoBuf = await pngToIco(pngBuffers);
  fs.writeFileSync(ICO, icoBuf);
  console.log('[icon] wrote', path.relative(process.cwd(), ICO), '(sizes:', sizes.join('/'), ')');
}

main().catch((e) => { console.error(e); process.exit(1); });
