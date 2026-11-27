#!/usr/bin/env node
/**
 * scripts/check-site-chrome.mjs — SITE-CHROME-GAPS-1 (2026-11-19)
 *
 * Permanent CI gate for the published-page surface NO other chrome gate covers:
 * tools/, research/, trust/, evidence/, disclosures/, attestations/, ledger/
 * and root pages. check-node-page-chrome.mjs covers chaingraph/*.html only;
 * check-hub-chrome.mjs covers guides/*-hub.html footers/logos; gen-root-chrome's
 * freshness check covers a fixed list of root-page FOOTER REGIONS only. A page
 * in a freshly published folder could therefore ship with no site nav and no
 * visible footer and every gate stayed green (measured 26 of 2,159 pages).
 *
 * INVARIANT (the audit's definition): exactly ONE site-chrome <nav> and ONE
 * rendered <footer> per published page. A class'd <nav class="…"> is in-body
 * content (a table of contents), never site chrome. A <footer> inside a
 * <script>, <style> or HTML comment is template text, never rendered chrome —
 * those are stripped before counting, so a print-template footer cannot pass.
 *
 * UNIVERSE comes from scripts/published-dirs.json (the shared manifest the
 * sitemap generator and verify_repo.py both read), cross-checked against
 * `git ls-files`, so this gate and the publisher cannot scope-drift. Enumerating
 * with git (never a filesystem walk) also avoids the .wt/ worktree fan-out.
 *
 * TWO ESCAPE HATCHES, BOTH SHRINK-ONLY:
 *   • scripts/site-chrome-exemptions.json — by-design chromeless pages, each
 *     with a stated reason. Adding an entry is a deliberate row-level decision.
 *   • scripts/site-chrome-baseline.json — a ratchet for known offenders. It is
 *     EMPTY at merge. A clean page that is still pinned is RED until the pin is
 *     REMOVED; a worse page is never absorbed by raising a pin.
 *
 * Usage: node scripts/check-site-chrome.mjs
 * Self-test: node scripts/check-site-chrome.selftest.mjs (RED/GREEN controls).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitSync } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..');
const EXEMPTIONS_PATH = resolve(HERE, 'site-chrome-exemptions.json');
const BASELINE_PATH = resolve(HERE, 'site-chrome-baseline.json');

/** Nav/footer counts in RENDERED markup: script, style and comments stripped. */
export function chromeState(html) {
  const scope = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  return {
    nav: (scope.match(/<nav(?![^>]*\bclass=)[^>]*>/g) || []).length,
    footer: (scope.match(/<footer\b[^>]*>/g) || []).length,
  };
}

/**
 * Verdict for one page. `pin` is { nav, footer } from the shrink-only baseline.
 * Returns { ok, reason }. Pure: the self-test drives it with in-memory fixtures.
 */
export function chromeVerdict(state, { exempt = false, pin = undefined } = {}) {
  if (exempt) return { ok: true, reason: 'exempt (reason in site-chrome-exemptions.json)' };
  const clean = state.nav === 1 && state.footer === 1;
  if (pin === undefined) {
    return clean
      ? { ok: true, reason: 'clean' }
      : { ok: false, reason: `nav=${state.nav} footer=${state.footer}` };
  }
  if (!pin || typeof pin.nav !== 'number' || typeof pin.footer !== 'number') {
    return { ok: false, reason: `illegal baseline pin ${JSON.stringify(pin)}` };
  }
  if (clean) {
    return { ok: false, reason: 'stale baseline pin — page is clean; REMOVE its entry (the ratchet tightens)' };
  }
  if (state.nav < pin.nav || state.footer < pin.footer) {
    return { ok: false, reason: 'stale baseline pin — page improved; REMOVE or tighten its entry' };
  }
  if (state.nav > pin.nav || state.footer > pin.footer) {
    return { ok: false, reason: 'new offender — the baseline never absorbs one (never raise a pin)' };
  }
  return { ok: true, reason: 'pinned (shrink-only)' };
}

/** Published .html universe, derived from the shared manifest + git's file list. */
export function publishedHtmlFiles(repo = REPO) {
  const manifest = JSON.parse(readFileSync(resolve(repo, 'scripts', 'published-dirs.json'), 'utf8'));
  const tracked = gitSync(['ls-files', '*.html'], { cwd: repo })
    .trim().split('\n').filter(Boolean);
  const excluded = new Set(manifest.recursiveExcludeSubdirs || []);
  const flat = new Set(manifest.flatDirs || []);
  const recursive = new Set(manifest.recursiveDirs || []);
  const root = new Set((manifest.rootPages || []).map((r) => r.path));
  return tracked.filter((p) => {
    if (!p.endsWith('.html')) return false;
    if ([...excluded].some((d) => p.startsWith(`${d}/`))) return false;
    const slash = p.indexOf('/');
    if (slash === -1) return root.has(p);
    const top = p.slice(0, slash);
    if (flat.has(top)) return p.lastIndexOf('/') === slash;
    return recursive.has(top);
  }).sort();
}

function main() {
  const exemptions = JSON.parse(readFileSync(EXEMPTIONS_PATH, 'utf8')).pages || {};
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).pages || {};
  const files = publishedHtmlFiles();
  const failures = [];
  let exempted = 0;
  let pinned = 0;
  for (const page of files) {
    const pin = Object.prototype.hasOwnProperty.call(baseline, page) ? baseline[page] : undefined;
    const exempt = Object.prototype.hasOwnProperty.call(exemptions, page);
    if (pin !== undefined) pinned++;
    if (exempt) exempted++;
    const verdict = chromeVerdict(chromeState(readFileSync(resolve(REPO, page), 'utf8')), { exempt, pin });
    if (!verdict.ok) failures.push(`${page}: ${verdict.reason}`);
  }
  if (failures.length) {
    console.error(`✗ check-site-chrome: ${failures.length} failure(s) of ${files.length} published page(s):`);
    failures.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }
  console.log(`✓ check-site-chrome: all ${files.length - exempted} covered page(s) pass (${exempted} exempt, ${pinned} pinned; baseline empty at merge).`);
}

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (IS_CLI) main();
