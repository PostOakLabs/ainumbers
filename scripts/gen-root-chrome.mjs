#!/usr/bin/env node
/**
 * scripts/gen-root-chrome.mjs
 * Inject the canonical 4-column footer + its CSS into root-level pages
 * (index.html, start.html) between sentinels, from the chrome SSOT
 * (chaingraph/_page-chrome.mjs). Keeps root pages and node pages on ONE
 * footer template — no forked second footer.
 *
 * Sentinels (must already exist in each page):
 *   CSS  : "ROOT-FOOTER-CSS:START" … "ROOT-FOOTER-CSS:END"  (inside a <style> block)
 *   HTML : "ROOT-FOOTER:START"      … "ROOT-FOOTER:END"      (where <footer> lives)
 *
 * Usage:
 *   node scripts/gen-root-chrome.mjs           # write (default)
 *   node scripts/gen-root-chrome.mjs --check    # verify freshness, exit 1 on drift
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT_FOOTER, ROOT_FOOTER_CSS } from '../chaingraph/_page-chrome.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(__dir, '..');
const CHECK = process.argv.includes('--check');

const PAGES = [
  'index.html', 'start.html',
  'contact.html', 'convert.html', 'credits.html', 'methods.html',
  'security.html', 'suggest.html',
  'helm.html', 'sitemap.html', 'tools.html',
];

// Regions: [openMarker, closeMarker, payload]. Markers matched loosely so the
// human-readable "do not hand-edit" note on the START line is preserved.
function regions() {
  return [
    ['ROOT-FOOTER-CSS:START', 'ROOT-FOOTER-CSS:END', '\n' + ROOT_FOOTER_CSS + '\n'],
    ['ROOT-FOOTER:START',     'ROOT-FOOTER:END',     '\n' + ROOT_FOOTER + '\n'],
  ];
}

// Replace the text between the line carrying openTag and the line carrying
// closeTag (exclusive of the marker lines) with payload.
function inject(html, openTag, closeTag, payload) {
  const oIdx = html.indexOf(openTag);
  const cIdx = html.indexOf(closeTag);
  if (oIdx === -1 || cIdx === -1) {
    throw new Error(`missing sentinel ${openTag}/${closeTag}`);
  }
  // end of the START marker's line
  const oLineEnd = html.indexOf('\n', oIdx);
  // start of the END marker's line (walk back to previous newline)
  const cLineStart = html.lastIndexOf('\n', cIdx);
  if (oLineEnd === -1 || cLineStart === -1 || cLineStart < oLineEnd) {
    throw new Error(`malformed sentinel region ${openTag}`);
  }
  return html.slice(0, oLineEnd) + payload + html.slice(cLineStart);
}

let drift = false;
for (const page of PAGES) {
  const path = resolve(REPO, page);
  const original = readFileSync(path, 'utf-8');
  let html = original;
  for (const [o, c, payload] of regions()) {
    html = inject(html, o, c, payload);
  }
  if (html === original) {
    console.log(`  ok   ${page}`);
    continue;
  }
  if (CHECK) {
    console.error(`  DRIFT ${page} — run: node scripts/gen-root-chrome.mjs`);
    drift = true;
  } else {
    writeFileSync(path, html, 'utf-8');
    console.log(`  wrote ${page}`);
  }
}

if (CHECK && drift) {
  console.error('✗ gen-root-chrome: root footer out of sync with chrome SSOT');
  process.exit(1);
}
console.log(`✓ gen-root-chrome: ${PAGES.length} page(s) ${CHECK ? 'fresh' : 'generated'}`);
