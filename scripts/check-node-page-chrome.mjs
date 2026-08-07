#!/usr/bin/env node
/**
 * scripts/check-node-page-chrome.mjs
 * Permanent CI gate: every chaingraph/art-*.html that has been chrome-normalized
 * must carry exactly one canonical <nav> and one canonical <footer> + the CSS marker.
 *
 * Pages listed in KNOWN_SKIPS have pre-existing HTML quirks (body-embedded <footer>
 * elements or no chaingraph.json entry) that require manual follow-up — they are
 * excluded from the gate rather than allowed to fail CI in perpetuity.
 *
 * Exit 0 = all assertions pass. Exit 1 = one or more failures (lists offenders).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV_REQUIRED_TOKENS, FOOTER_REQUIRED_TOKENS, CSS_MARKER, SPEC_VERSION } from '../chaingraph/_page-chrome.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(__dir, '..');
const CG    = resolve(REPO, 'chaingraph');

// All pages now normalized — no skips.
const KNOWN_SKIPS = new Set();

const files = readdirSync(CG).filter(f => /^art-\d+.*\.html$/.test(f)).sort();

const failures = [];

for (const filename of files) {
  if (KNOWN_SKIPS.has(filename)) continue;

  const html = readFileSync(resolve(CG, filename), 'utf-8');

  // ── count checks ──
  const navOpens  = (html.match(/<nav[^>]*>/g) || []).length;
  const navCloses = (html.match(/<\/nav>/g)   || []).length;
  const ftrOpens  = (html.match(/<footer[^>]*>/g) || []).length;
  const ftrCloses = (html.match(/<\/footer>/g)    || []).length;

  if (navOpens !== 1 || navCloses !== 1) {
    failures.push(`${filename}: nav count (${navOpens}/${navCloses})`);
    continue;
  }
  if (ftrOpens !== 1 || ftrCloses !== 1) {
    failures.push(`${filename}: footer count (${ftrOpens}/${ftrCloses})`);
    continue;
  }

  // ── extract nav block for token checks ──
  const navM = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/);
  if (!navM) { failures.push(`${filename}: nav block not extractable`); continue; }
  const navBlock = navM[0];

  // ── extract footer block for token checks ──
  const ftrM = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/);
  if (!ftrM) { failures.push(`${filename}: footer block not extractable`); continue; }
  const ftrBlock = ftrM[0];

  // ── NAV required tokens ──
  for (const tok of NAV_REQUIRED_TOKENS) {
    if (!navBlock.includes(tok)) {
      failures.push(`${filename}: nav missing "${tok}"`);
    }
  }

  // ── breadcrumb: must have ART-NN · <display_name> pattern in canonical span ──
  const bcSpan = navBlock.match(/<span style="color:var\(--gold\)">(ART-\d+ · [^<]+)<\/span>/);
  if (!bcSpan) {
    failures.push(`${filename}: nav-breadcrumb current span missing or malformed`);
  }

  // ── FOOTER required tokens ──
  for (const tok of FOOTER_REQUIRED_TOKENS) {
    if (!ftrBlock.includes(tok)) {
      failures.push(`${filename}: footer missing "${tok}"`);
    }
  }

  // ── footer spec-version label must track chaingraph.json's spec_version (the record) ──
  if (!ftrBlock.includes(`Spec v${SPEC_VERSION}`)) {
    failures.push(`${filename}: footer "Spec v" label stale — expected v${SPEC_VERSION}, run normalize-node-chrome.mjs --apply`);
  }

  // ── CSS marker ──
  if (!html.includes(CSS_MARKER)) {
    failures.push(`${filename}: missing CSS marker "${CSS_MARKER}"`);
  }
}

if (failures.length === 0) {
  console.log(`✓ check-node-page-chrome: all ${files.length - KNOWN_SKIPS.size} active pages pass (${KNOWN_SKIPS.size} known-skip excluded)`);
  process.exit(0);
} else {
  console.error(`✗ check-node-page-chrome: ${failures.length} failure(s):`);
  failures.forEach(f => console.error(`  ${f}`));
  process.exit(1);
}
