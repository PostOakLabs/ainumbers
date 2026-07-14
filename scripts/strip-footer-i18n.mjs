#!/usr/bin/env node
/**
 * scripts/strip-footer-i18n.mjs
 * One-shot sweep (FOOTER-1 §F4): unwrap <span data-i18n="footer.*">TEXT</span>
 * to plain TEXT inside footers. I18N is retired; the footer strip is scoped
 * ONLY to footer.* keys — never touches other data-i18n residue in body content.
 *
 * Usage: node scripts/strip-footer-i18n.mjs [--apply]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dir, '..');
const APPLY = process.argv.includes('--apply');

const DIRS = ['tools', 'chaingraph', 'guides'];
const SPAN_RE = /<span data-i18n="footer\.[a-zA-Z0-9_]+">([^<]*)<\/span>/g;
const ATTR_RE = / data-i18n="footer\.[a-zA-Z0-9_]+"/g;
const FOOTER_RE = /<footer[^>]*>[\s\S]*?<\/footer>/g;

let filesChanged = 0;
let spansStripped = 0;

for (const dir of DIRS) {
  const full = resolve(REPO, dir);
  let names;
  try { names = readdirSync(full); } catch { continue; }
  for (const name of names) {
    if (!name.endsWith('.html')) continue;
    const path = resolve(full, name);
    const original = readFileSync(path, 'utf-8');
    let count = 0;
    // Scope strictly to <footer>...</footer> blocks — never touch nav/body data-i18n.
    const html = original.replace(FOOTER_RE, (block) => {
      let out = block.replace(SPAN_RE, (_, text) => { count++; return text; });
      out = out.replace(ATTR_RE, () => { count++; return ''; });
      return out;
    });
    if (count > 0) {
      filesChanged++;
      spansStripped += count;
      if (APPLY) writeFileSync(path, html, 'utf-8');
    }
  }
}

console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Files changed  : ${filesChanged}`);
console.log(`Spans stripped : ${spansStripped}`);
if (!APPLY) console.log('\nRun with --apply to write.');
