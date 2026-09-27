#!/usr/bin/env node
/**
 * scripts/gen-node-footers.mjs — FOOTER-INFRA-COLUMN-1 (footer plan v2, decision D1(b))
 *
 * WHY: the canonical footer lives in ONE template (chaingraph/_page-chrome.mjs
 * buildFooter), but the ~690 top-level chaingraph/*.html pages carry a COPY of
 * it. Before this script nothing rewrote those copies after the template moved,
 * and no gate compared them to it (check-node-page-chrome.mjs checks structure
 * and the version label, not the links), so every template edit left the pages
 * behind and every node page built from a stale branch shipped a stale footer:
 * measured 2026-09-27, art-691, art-692, art-693 and verify.html had drifted.
 * Tim ruled D1 as (b) on 2026-09-27: make the footer copies a derived artifact
 * with ONE main-side writer, like every other shared generated surface (SO #35).
 * This script is that writer; scripts/derived-artifacts.mjs declares it, so a
 * footer change is a one-file template edit and main's regen carries it to
 * every page after merge.
 *
 * HOW: a thin wrapper over normalize-node-chrome.mjs's normalizeChrome() in
 * footer-only mode (nav, CSS and body stay byte-identical; the normalizer's own
 * guards apply). Scope = top-level chaingraph/*.html minus CHROME_EXEMPT minus
 * the pages pinned in scripts/node-page-chrome-baseline.json (their only footer
 * sits inside a <script> template literal, plan decision D4, unruled) minus the
 * GENERATOR_OWNED pages below, whose own generator renders the footer. Hubs,
 * chain pages and root pages are not this writer's: root pages belong to
 * gen-root-chrome.mjs and the generated map pages copy start.html.
 *
 * Exit codes: the write run exits 0 even when a page is skipped (it prints the
 * skip), so one odd page never stops main's whole regen pass; --check is the
 * alarm and exits 1 on any drifted footer or any skip outside the pinned set.
 *
 * Usage:
 *   node scripts/gen-node-footers.mjs             # write every drifted footer (main-side regen)
 *   node scripts/gen-node-footers.mjs --check     # exit 1 on drift or an unexpected skip
 *   node scripts/gen-node-footers.mjs --paths     # print the page list this writer owns
 *   node scripts/gen-node-footers.mjs --selftest  # RED on a mutated scratch copy, GREEN after a write
 *
 * Zero-dependency: node builtins only (STANDING ORDER #10). Deterministic: the
 * output is a pure function of the template and the page bytes (no wall clock).
 */
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CG = resolve(REPO, 'chaingraph');
const PAGE_CHROME = resolve(CG, '_page-chrome.mjs');
const BASELINE = resolve(REPO, 'scripts', 'node-page-chrome-baseline.json');

// scripts/derived-artifacts.mjs imports this file to declare the page list, and
// the assembler, the deploy checks and preflight all import derived-artifacts.mjs.
// So the list must NOT import chaingraph/_page-chrome.mjs, which parses
// chaingraph.json at load: a malformed chaingraph.json would then crash the
// assembler that exists to rebuild it. The exempt names are read from the
// template's source text instead, and every run cross-checks that reading
// against the real CHROME_EXEMPT export (exemptParseMatches below).
function exemptBasenames() {
  const src = readFileSync(PAGE_CHROME, 'utf8');
  const start = src.indexOf('export const CHROME_EXEMPT = new Map([');
  const end = src.indexOf('\n]);', start);
  if (start === -1 || end === -1) throw new Error('gen-node-footers: CHROME_EXEMPT block not found in chaingraph/_page-chrome.mjs');
  return new Set([...src.slice(start, end).matchAll(/^\s*\['([^']+\.html)',/gm)].map((m) => m[1]));
}

async function exemptParseMatches() {
  const { CHROME_EXEMPT } = await import(pathToFileURL(PAGE_CHROME).href);
  const parsed = exemptBasenames();
  const real = new Set(CHROME_EXEMPT.keys());
  const same = parsed.size === real.size && [...real].every((k) => parsed.has(k));
  if (!same) throw new Error(`gen-node-footers: CHROME_EXEMPT source parse (${[...parsed].join(', ')}) differs from the export (${[...real].join(', ')}); fix exemptBasenames()`);
}

/** Pages whose only footer lives inside a <script> (the pinned D4 set). */
export function pinnedScriptFooterPages() {
  if (!existsSync(BASELINE)) return new Set();
  const pages = JSON.parse(readFileSync(BASELINE, 'utf8')).pages || {};
  return new Set(Object.keys(pages));
}

/** Basenames this writer owns, sorted: the normalizer's own auto-scan set
 *  (top-level *.html minus CHROME_EXEMPT) minus the pinned pages. Empty in a
 *  checkout with no chaingraph/ (fixture repos). */
// Top-level chaingraph pages rendered WHOLE by their own generator, footer
// included (it imports buildFooter()), with a --check that is hard on a PR. A
// template edit regenerates them in that PR, so this writer leaves them to their
// single writer. Measured 2026-09-27: the only generator that embeds the footer
// and writes a top-level chaingraph page not already in CHROME_EXEMPT.
export const GENERATOR_OWNED = new Map([
  ['agentic-payments-map.html', 'rendered whole by scripts/gen-agentic-payments-map.mjs (buildFooter() embedded; --check hard in preflight)'],
]);

function ownedBasenames() {
  if (!existsSync(CG) || !existsSync(PAGE_CHROME)) return [];
  const exempt = exemptBasenames();
  const pinned = pinnedScriptFooterPages();
  return readdirSync(CG)
    .filter((f) => f.endsWith('.html'))
    .filter((f) => !exempt.has(f))
    .filter((f) => !pinned.has(f))
    .filter((f) => !GENERATOR_OWNED.has(f))
    .sort();
}

/** Repo-relative paths this writer may write; derived-artifacts.mjs declares
 *  exactly this list as the entry's `writes` and `artifacts`. */
export function nodeFooterPages() {
  return ownedBasenames().map((f) => `chaingraph/${f}`);
}

// normalize-node-chrome.mjs reads chaingraph.json at import, so it is loaded
// only when a run needs it, never when derived-artifacts.mjs imports this file.
async function normalizer() {
  return import(pathToFileURL(resolve(REPO, 'scripts', 'normalize-node-chrome.mjs')).href);
}

async function run({ apply, dir = CG, targets = ownedBasenames() }) {
  await exemptParseMatches();
  const { normalizeChrome } = await normalizer();
  return normalizeChrome({ dir, targets, apply, footerOnly: true });
}

function footerSpan(html) {
  const a = html.search(/<footer\b[^>]*>/i);
  const b = html.indexOf('</footer>', a);
  return a === -1 || b === -1 ? null : [a, b + '</footer>'.length];
}

async function selftest() {
  const fails = [];
  const sample = ownedBasenames().find((f) => /^art-\d+/.test(f));
  if (!sample) { console.error('selftest: no art page to sample'); process.exit(2); }
  const tmp = mkdtempSync(join(tmpdir(), 'gen-node-footers-'));
  try {
    copyFileSync(resolve(CG, sample), join(tmp, sample));
    const before = readFileSync(join(tmp, sample), 'utf8');

    // 1. A write brings the copy to the template, touching the footer only.
    await run({ apply: true, dir: tmp, targets: [sample] });
    const written = readFileSync(join(tmp, sample), 'utf8');
    const sb = footerSpan(before);
    const sw = footerSpan(written);
    if (!sb || !sw) fails.push('footer region not found');
    else {
      if (before.slice(0, sb[0]) !== written.slice(0, sw[0])) fails.push('write changed bytes before the footer');
      if (before.slice(sb[1]) !== written.slice(sw[1])) fails.push('write changed bytes after the footer');
    }

    // 2. GREEN: a fresh copy reads as fresh.
    const green = await run({ apply: false, dir: tmp, targets: [sample] });
    if (green.changed.length !== 0 || green.skipped.length !== 0) fails.push(`GREEN control: expected 0 drift, got ${green.changed.length} drift / ${green.skipped.length} skip`);

    // 3. RED: one mutated footer link reads as drift.
    const mutated = written.replace('>Infrastructure Map<', '>Infrastructure Mapp<');
    if (mutated === written) fails.push('RED control: mutation target not found in the footer');
    writeFileSync(join(tmp, sample), mutated);
    const red = await run({ apply: false, dir: tmp, targets: [sample] });
    if (red.changed.length !== 1) fails.push(`RED control: expected 1 drift, got ${red.changed.length}`);

    // 4. Idempotent: a second write of a fresh copy changes nothing.
    await run({ apply: true, dir: tmp, targets: [sample] });
    const once = readFileSync(join(tmp, sample), 'utf8');
    await run({ apply: true, dir: tmp, targets: [sample] });
    if (readFileSync(join(tmp, sample), 'utf8') !== once) fails.push('second write was not byte-identical');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (fails.length) {
    console.error(`✗ gen-node-footers selftest FAILED on ${sample}:`);
    fails.forEach((f) => console.error('    ' + f));
    process.exit(1);
  }
  console.log(`✓ gen-node-footers selftest: write is footer-only, fresh copy GREEN, mutated link RED, second write byte-identical (sample ${sample}).`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--paths')) { nodeFooterPages().forEach((p) => console.log(p)); return; }
  if (args.includes('--selftest')) { await selftest(); return; }

  const check = args.includes('--check');
  const pinned = pinnedScriptFooterPages();
  const result = await run({ apply: !check });
  const drift = result.changed.map((c) => c.file);
  const skips = result.skipped;

  if (check) {
    const problems = [];
    if (drift.length) problems.push(`${drift.length} page footer(s) differ from chaingraph/_page-chrome.mjs buildFooter(): ${drift.slice(0, 12).join(', ')}${drift.length > 12 ? ', …' : ''}`);
    if (skips.length) problems.push(`${skips.length} page(s) the normalizer refused: ${skips.map((s) => `${s.file} (${s.reason})`).join('; ')}`);
    if (problems.length) {
      console.error('✗ node footers are stale (FOOTER-INFRA-COLUMN-1). Main-side single writer: node scripts/gen-node-footers.mjs');
      problems.forEach((p) => console.error('    ' + p));
      process.exit(1);
    }
    console.log(`✓ node footers fresh: ${result.targets.length} page(s) match the template (${pinned.size} pinned footer-in-script page(s) excluded).`);
    return;
  }

  console.log(`gen-node-footers: wrote ${drift.length} of ${result.targets.length} page(s)${drift.length ? ': ' + drift.slice(0, 12).join(', ') + (drift.length > 12 ? ', …' : '') : ''}.`);
  if (skips.length) console.log(`gen-node-footers: skipped ${skips.length} (the --check gate reports these): ${skips.map((s) => s.file).join(', ')}`);
}

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (IS_CLI) main().catch((e) => { console.error(`gen-node-footers: ${e.stack || e.message}`); process.exit(1); });
