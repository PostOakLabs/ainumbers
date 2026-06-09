#!/usr/bin/env node
/**
 * strip-lang-toggle.mjs — remove the deferred multilingual toggle from every
 * tool/guide/root HTML file, bringing the repo into line with CONTRACT §0/§1.1
 * (zero client storage; no lang-bar / setLang / ain_lang).
 *
 * It mirrors EXACTLY the edits applied by hand to the canonical template
 * tools/152-baas-provider-comparator.html on 2026-06-09:
 *   1. .lang-bar / .lang-inner / .lang-btn CSS rules         -> removed
 *   2. <div class="lang-bar">…</div></div> toggle UI          -> removed
 *   3. const TRANSLATIONS {…} + setLang() + auto-apply IIFE   -> removed
 *   4. <!-- ainumbers-universal-chrome-i18n … --> <script>…   -> removed
 *   5. <!-- ainumbers-per-tool-hero-i18n … --> <script>…      -> removed
 *   6. AIN-bridge t() reading ain_lang                        -> English-only
 *   7. AIN-bridge L = { en, es, fr, ar, pt, zh }              -> { en } only
 *
 * English chrome text is the default content of every data-i18n span, so the
 * pages render in English with none of this machinery.
 *
 * SAFETY: dry-run by default. Pass --write to apply. A file is only written if
 * the transformed output contains ZERO residual sessionStorage / setLang(/
 * class="lang-bar". Anything still dirty is reported as NEEDS MANUAL REVIEW and
 * left untouched, so a structurally-different file can never ship half-broken.
 *
 * Usage (from repo/):
 *   node scripts/strip-lang-toggle.mjs            # dry-run report
 *   node scripts/strip-lang-toggle.mjs --write    # apply
 *
 * After --write, re-verify and run the existing validators before pushing:
 *   rg -l "sessionStorage|setLang|class=\"lang-bar\"" tools guides *.html   # expect: nothing
 *   npm run lint:manifests && npm run test:ap2-exports
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');

// ── Transforms (each idempotent; order does not matter) ──────────────────────
const transforms = [
  // 1. lang-bar CSS rules (contiguous block ending at the .active,:hover rule)
  { name: 'css',
    re: /\.lang-bar\{[\s\S]*?\.lang-btn\.active,\.lang-btn:hover\{[^}]*\}\n?/g,
    to: '/* lang toggle removed — CONTRACT §1.1 */\n' },

  // 2. lang-bar toggle UI (buttons contain no nested <div>, so first </div></div> closes it)
  { name: 'html',
    re: /<div class="lang-bar">[\s\S]*?<\/div>\s*<\/div>\n?/g,
    to: '<!-- lang toggle removed — CONTRACT §1.1 -->\n' },

  // 3. TRANSLATIONS const + setLang() + auto-apply IIFE (anchored on the stable IIFE line)
  { name: 'translations',
    re: /const TRANSLATIONS = \{[\s\S]*?\n\(function\(\)\{try\{var s=sessionStorage\.getItem\('ain_lang'\);if\(s\)setLang\(s\);\}catch\(e\)\{\}\}\)\(\);\n?/g,
    to: '/* lang toggle (TRANSLATIONS/setLang) removed — CONTRACT §1.1 */\n' },

  // 4. universal-chrome-i18n injector block (stamped marker -> its closing </script>)
  { name: 'chrome-i18n',
    re: /<!-- ainumbers-universal-chrome-i18n[\s\S]*?<\/script>\n?/g,
    to: '<!-- chrome-i18n injector removed — CONTRACT §1.1 -->\n' },

  // 5. per-tool hero-i18n block (stamped marker -> its closing </script>)
  { name: 'hero-i18n',
    re: /<!-- ainumbers-per-tool-hero-i18n[\s\S]*?<\/script>\n?/g,
    to: '<!-- hero-i18n removed — CONTRACT §1.1 -->\n' },

  // 6. AIN-bridge t(): drop the ain_lang lookup, pin to English
  { name: 'bridge-t',
    re: /function t\(k\)\{var lg='en';try\{lg=sessionStorage\.getItem\('ain_lang'\)\|\|'en';\}catch\(e\)\{\}return \(L\[lg\]&&L\[lg\]\[k\]\)\|\|L\.en\[k\];\}/g,
    to: 'function t(k){return (L.en&&L.en[k])||k;}' },

  // 7. AIN-bridge L: keep only en{…}, drop es/fr/ar/pt/zh (anchored en{…} -> zh{…}\n};)
  { name: 'bridge-L',
    re: /(var L=\{\n en:\{[\s\S]*?\},)\n es:\{[\s\S]*?\n zh:\{[\s\S]*?\}\n\};/g,
    to: '$1\n};' },
];

// Anything matching this after transforms means the file is NOT clean.
const RESIDUAL = /sessionStorage|setLang\s*\(|class="lang-bar"|data-lang=/;

function htmlFiles() {
  const out = [];
  for (const dir of ['tools', 'guides']) {
    const d = join(REPO, dir);
    try {
      for (const f of readdirSync(d)) if (f.endsWith('.html')) out.push(join(d, f));
    } catch { /* dir may not exist */ }
  }
  for (const f of readdirSync(REPO))
    if (f.endsWith('.html') && statSync(join(REPO, f)).isFile()) out.push(join(REPO, f));
  return out;
}

let changed = 0, clean = 0, dirty = 0, untouched = 0;
const review = [];

for (const file of htmlFiles()) {
  const src = readFileSync(file, 'utf8');
  let out = src;
  const hits = [];
  for (const t of transforms) {
    const before = out;
    out = out.replace(t.re, t.to);
    if (out !== before) hits.push(t.name);
  }
  if (out === src) { untouched++; continue; }

  const residual = RESIDUAL.test(out);
  const rel = file.slice(REPO.length + 1);
  if (residual) {
    dirty++;
    review.push(rel);
    console.log(`✗ ${rel}  [${hits.join(', ')}]  — RESIDUAL toggle remains, NOT written`);
    continue;
  }
  clean++;
  console.log(`${WRITE ? '✓ wrote' : '· would clean'} ${rel}  [${hits.join(', ')}]`);
  if (WRITE) { writeFileSync(file, out); changed++; }
}

console.log(`\n${WRITE ? 'WROTE' : 'DRY-RUN'} — clean: ${clean}, needs-review: ${dirty}, unchanged: ${untouched}`);
if (review.length) {
  console.log('\nNEEDS MANUAL REVIEW (structurally different — handle by hand):');
  for (const r of review) console.log('  ' + r);
}
if (!WRITE) console.log('\nRe-run with --write to apply.');
process.exit(dirty ? 1 : 0);
