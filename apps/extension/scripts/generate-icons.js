/**
 * Generate PNG icons from SVG source files for the browser extension.
 * Chrome does not support SVG icons — PNG is required.
 * Firefox supports SVG fine, but PNG works everywhere.
 *
 * Usage: node scripts/generate-icons.js
 * Output: public/icons/icon16.png, icon48.png, icon128.png, icon-off16.png, etc.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

async function generate() {
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const svgActive = fs.readFileSync(path.join(ICONS_DIR, 'icon.svg'));
  const svgOff = fs.readFileSync(path.join(ICONS_DIR, 'icon-off.svg'));

  const sizes = [16, 48, 128];

  // Active icon (blue book)
  for (const size of sizes) {
    await sharp(svgActive)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon${size}.png`));
    console.log(`  Created icon${size}.png (${size}x${size})`);
  }

  // Disabled icon (gray book)
  for (const size of sizes) {
    await sharp(svgOff)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-off${size}.png`));
    console.log(`  Created icon-off${size}.png (${size}x${size})`);
  }

  console.log('Done! PNG icons generated in', ICONS_DIR);
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
