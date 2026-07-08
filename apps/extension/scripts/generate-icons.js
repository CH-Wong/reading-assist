/**
 * Generate placeholder PNG icons for the Chrome extension.
 * Chrome does not support SVG icons — PNG is required.
 * Firefox supports SVG fine, but PNG works everywhere.
 *
 * Usage: node scripts/generate-icons.js
 * Output: public/icons/icon16.png, icon48.png, icon128.png, icon-off16.png, etc.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

/** Create a minimal valid PNG file (solid color with optional text). */
function createPNG(size, r, g, b) {
  // --- PNG Signature ---
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // --- Raw pixel data (each row: filter byte + RGB * width) ---
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // 1 filter byte + RGB pixels
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const offset = 1 + x * 3;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);

  // --- Compress raw data ---
  const compressed = zlib.deflateSync(rawData);

  // --- IHDR chunk ---
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData[8] = 8;   // bit depth
  ihdrData[9] = 2;   // color type: RGB
  ihdrData[10] = 0;  // compression
  ihdrData[11] = 0;  // filter
  ihdrData[12] = 0;  // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // --- IDAT chunk ---
  const idat = createChunk('IDAT', compressed);

  // --- IEND chunk ---
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuf]);
}

/** CRC-32 implementation for PNG */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// --- Generate icons ---
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Active icon: blue (#4a6cf7)
const active = [
  { name: 'icon16.png', size: 16 },
  { name: 'icon48.png', size: 48 },
  { name: 'icon128.png', size: 128 },
];
for (const { name, size } of active) {
  fs.writeFileSync(path.join(ICONS_DIR, name), createPNG(size, 74, 108, 247));
  console.log(`  Created ${name} (${size}x${size})`);
}

// Disabled icon: gray (#9ca3af)
const disabled = [
  { name: 'icon-off16.png', size: 16 },
  { name: 'icon-off48.png', size: 48 },
  { name: 'icon-off128.png', size: 128 },
];
for (const { name, size } of disabled) {
  fs.writeFileSync(path.join(ICONS_DIR, name), createPNG(size, 156, 163, 175));
  console.log(`  Created ${name} (${size}x${size})`);
}

console.log('Done! PNG icons generated in', ICONS_DIR);
