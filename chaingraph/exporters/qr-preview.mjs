// qr-preview.mjs — dev aid: render qr.mjs output at a large, scannable size.
// Writes qr-preview.html (+ .svg) you open in a browser and scan from screen, then
// compare the decoded text to the URL printed below it. Validates the ENCODING
// (the PDF embeds the identical matrix, just smaller).
//
//   node repo/chaingraph/exporters/qr-preview.mjs            # default verify URL
//   node repo/chaingraph/exporters/qr-preview.mjs "any text" # custom payload
//
// Not imported by anything; safe to leave uncommitted.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qrMatrix } from './qr.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const text = process.argv[2] || ('https://ainumbers.co/chaingraph/verify?hash=' + 'a'.repeat(64));

const { modules, size, version } = qrMatrix(text);
const M = 10;          // px per module — big enough to scan from a monitor
const QUIET = 4;       // quiet zone (required by the spec)
const dim = (size + QUIET * 2) * M;

let rects = '';
for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
  if (modules[i][j]) rects += `<rect x="${(j + QUIET) * M}" y="${(i + QUIET) * M}" width="${M}" height="${M}"/>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">` +
  `<rect width="${dim}" height="${dim}" fill="#ffffff"/><g fill="#000000">${rects}</g></svg>`;

const html = `<!doctype html><meta charset="utf-8"><title>QR preview</title>` +
  `<body style="font-family:system-ui,sans-serif;text-align:center;padding:28px;background:#fff;color:#222">` +
  `${svg}<p style="max-width:640px;margin:18px auto;word-break:break-all">` +
  `QR v${version}, ${size}×${size} modules. Scan it — it should decode to:<br><b>${text}</b></p></body>`;

writeFileSync(join(here, 'qr-preview.html'), html);
writeFileSync(join(here, 'qr-preview.svg'), svg);
console.log(`Wrote qr-preview.html + qr-preview.svg (QR v${version}, ${size}x${size}).`);
console.log(`Open qr-preview.html, scan with your phone, and confirm it decodes to:\n  ${text}`);
