#!/usr/bin/env node
/**
 * scripts/normalize-hub-logo.mjs — HUB-LOGO-NORMALIZE-1
 *
 * Mechanical sweep that replaces the text-only "AINumbers.co" wordmark logo
 * in guides/*-hub.html hub pages (+ two root stragglers) with the canonical
 * SVG grid mark, sourced live from the chrome SSOT (chaingraph/_page-chrome.mjs
 * ::buildNav() — signature aria-label="AINumbers.co mark"), following the same
 * mechanical-normalizer shape as scripts/normalize-node-chrome.mjs.
 *
 * SCOPE — LOGO MARKUP ONLY (board/claimed/HUB-LOGO-NORMALIZE-1.md rail #3):
 *   the ONLY edit is inserting the canonical <svg> grid mark as the first
 *   child inside the existing <a class="logo">...</a> block, immediately
 *   after its opening tag. Nothing else in the anchor is touched — the
 *   existing wordmark markup (.logo-text/.logo-tag, an inline-styled sub-
 *   label span, or a bare .logo-name div with no sub-label) is left exactly
 *   as it was, so this one transform is correct for all observed sub-shapes
 *   without per-shape branching. No footer, no CSS, no nav links, no body
 *   content is ever touched.
 *
 * TARGET SET — re-derived from the gate's baseline (SO #34: never the audit
 * appendix): scripts/hub-chrome-baseline.json's logoMissing[] (45 files as of
 * 2026-08-22), PLUS the two root stragglers errata.html and euc-register.html
 * named in the row, included only if hasCanonicalLogo() (imported from
 * check-hub-chrome.mjs, the SAME predicate the gate uses) says they are still
 * text-only at run time — "ride along IF HUB-CHROME-GATE-1 has not already
 * canonicalized them."
 *
 * TWO ARIA VARIANTS, matching pre-existing sitewide precedent (both already
 * live on gen-root-chrome.mjs-canonicalized root pages about.html/mcp.html):
 *   - guides/*-hub.html: the <a class="logo"> anchor carries NO aria-label of
 *     its own, so the inserted SVG carries the SSOT's own
 *     aria-label="AINumbers.co mark" (26x26 — the size already used by 5 of
 *     the 7 hub pages that already carry a hand-rolled version of this same
 *     mark).
 *   - errata.html / euc-register.html: the <a class="logo"> anchor already
 *     carries aria-label="AINumbers.co home", so the inserted SVG carries
 *     aria-hidden="true" instead (28x28, matching about.html/mcp.html
 *     exactly) — avoids a double screen-reader announcement of the same
 *     brand name on one link.
 *
 * Usage:
 *   node scripts/normalize-hub-logo.mjs --dry-run   # report only, no write
 *   node scripts/normalize-hub-logo.mjs --apply     # write all target files
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNav } from '../chaingraph/_page-chrome.mjs';
import { hasCanonicalLogo } from './check-hub-chrome.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dir, '..');
const GUIDES = resolve(REPO, 'guides');
const BASELINE_PATH = resolve(__dir, 'hub-chrome-baseline.json');

const APPLY_MODE = process.argv.includes('--apply');

// ── derive the canonical SVG rect markup LIVE from the SSOT, never a
//    hand-retyped copy that could drift (same discipline normalize-node-
//    chrome.mjs uses by importing buildNav() itself). ──
const sampleNav = buildNav('x');
const svgMatch = sampleNav.match(/<svg[^>]*>[\s\S]*?<\/svg>/);
if (!svgMatch) throw new Error('normalize-hub-logo: could not extract canonical <svg> from buildNav() — SSOT shape changed');
const RECTS = svgMatch[0].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

const HUB_SVG  = `<svg width="26" height="26" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-label="AINumbers.co mark">${RECTS}</svg>`;
const ROOT_SVG = `<svg width="28" height="28" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${RECTS}</svg>`;

// ── target set ──
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const hubFiles = (baseline.logoMissing ?? []).slice().sort();

const rootCandidates = ['errata.html', 'euc-register.html'];
const rootFiles = rootCandidates.filter((f) => {
  const p = resolve(REPO, f);
  if (!existsSync(p)) return false;
  return !hasCanonicalLogo(readFileSync(p, 'utf8')); // still text-only → in scope
});

const changed = [];
const skipped = [];

function insertLogo(html, svg, indent) {
  // Scope to the <nav>…</nav> block ONLY — identical extraction to
  // hasCanonicalLogo() in check-hub-chrome.mjs — so a page's separate
  // footer .logo anchor (errata.html / euc-register.html both carry one,
  // out of scope per the row's "footers untouched" rail) is never matched.
  const navRe = /<nav[\s\S]*?<\/nav>/;
  const navM = html.match(navRe);
  if (!navM) return { html, ok: false, reason: 'no <nav>…</nav> block found' };
  const navBlock = navM[0];

  // Match the single site-chrome logo anchor's OPEN tag only (never .logo-name
  // / .logo-tag / .logo-ai / .logo-co, which all fail this exact-quote test).
  const openTagRe = /<a[^>]*\bclass="logo"[^>]*>/;
  const opensInNav = navBlock.match(new RegExp(openTagRe.source, 'g')) || [];
  if (opensInNav.length !== 1) return { html, ok: false, reason: `logo anchor count in <nav> ${opensInNav.length} (expected 1)` };

  const m = navBlock.match(openTagRe);
  const insertAt = m.index + m[0].length;
  const newNavBlock = navBlock.slice(0, insertAt) + `\n${indent}${svg}` + navBlock.slice(insertAt);

  const newHtml = html.slice(0, navM.index) + newNavBlock + html.slice(navM.index + navBlock.length);
  return { html: newHtml, ok: true };
}

function processFile(filename, dir, svg, indent) {
  const path = resolve(dir, filename);
  const original = readFileSync(path, 'utf-8');

  if (hasCanonicalLogo(original)) {
    skipped.push({ file: filename, reason: 'already canonical (has <svg> in .logo block) — no-op' });
    return;
  }

  const result = insertLogo(original, svg, indent);
  if (!result.ok) {
    skipped.push({ file: filename, reason: result.reason });
    return;
  }

  // Post-transform sanity: exactly one canonical logo now, gate predicate agrees.
  if (!hasCanonicalLogo(result.html)) {
    skipped.push({ file: filename, reason: 'post-transform check-hub-chrome hasCanonicalLogo() still false — aborted' });
    return;
  }

  if (APPLY_MODE) writeFileSync(path, result.html, 'utf-8');
  changed.push({ file: filename, applied: APPLY_MODE });
}

for (const f of hubFiles) processFile(f, GUIDES, HUB_SVG, '      ');
for (const f of rootFiles) processFile(f, REPO, ROOT_SVG, '      ');

console.log('\n=== normalize-hub-logo ===');
console.log(`Mode: ${APPLY_MODE ? 'APPLY (files written)' : 'DRY-RUN (no files written)'}`);
console.log(`\nHub targets (baseline)   : ${hubFiles.length}`);
console.log(`Root stragglers in scope : ${rootFiles.length}${rootFiles.length ? ' (' + rootFiles.join(', ') + ')' : ''}`);
console.log(`Changed                  : ${changed.length}`);
console.log(`Skipped                  : ${skipped.length}`);

if (changed.length) {
  console.log(`\n${APPLY_MODE ? 'Written' : 'Would write'}:`);
  changed.forEach((c) => console.log(`  ✓ ${c.file}`));
}
if (skipped.length) {
  console.log('\nSkipped (manual follow-up):');
  skipped.forEach((s) => console.log(`  SKIP ${s.file}: ${s.reason}`));
}
if (!APPLY_MODE && changed.length > 0) {
  console.log('\nRun with --apply to write all changes.');
}

// Non-zero exit if anything was skipped that SHOULD have been in scope (both
// target lists are supposed to be fully mechanical) — surfaces a shape this
// script did not anticipate instead of silently under-covering the sweep.
if (skipped.length > 0 && skipped.some((s) => !s.reason.includes('already canonical'))) {
  process.exitCode = 1;
}
