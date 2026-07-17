#!/usr/bin/env node
/**
 * scripts/check-no-copyright-year.mjs
 * Permanent gate: no reader-facing page may carry a hardcoded "© 2024" /
 * "&copy; 2024" copyright-year splash. The footer license line is the
 * license/promise trio only (CC BY 4.0 · Zero PII · Client-side only) — no
 * year, no company name — sourced from chaingraph/_page-chrome.mjs.
 *
 * Scans repo *.html plus the page generators that emit footers.
 * Exit 0 = clean. Exit 1 = offenders listed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(__dir, '..');

const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'archive']);
const RE = /(?:©|&copy;)\s*2024/;

// Generators that emit reader-facing footers (kept in sync with the SSOT line).
const EXTRA = [
  'chaingraph/vm/scripts/gen-kernel-vm-html.mjs',
  'scripts/gen-wave22-tools.mjs',
];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
}

const files = [];
walk(REPO, files);
for (const rel of EXTRA) files.push(resolve(REPO, rel));

const offenders = [];
for (const f of files) {
  try {
    if (RE.test(readFileSync(f, 'utf-8'))) offenders.push(f.replace(REPO + '\\', '').replace(REPO + '/', ''));
  } catch { /* missing EXTRA file — ignore */ }
}

if (offenders.length === 0) {
  console.log(`✓ check-no-copyright-year: ${files.length} files clean (no "© 2024" splash)`);
  process.exit(0);
}
console.error(`✗ check-no-copyright-year: ${offenders.length} file(s) carry a "© 2024" copyright-year splash:`);
offenders.forEach(o => console.error(`  ${o}`));
console.error('Fix: drop the year+company prefix; keep the CC BY 4.0 · Zero PII · Client-side only trio.');
process.exit(1);
