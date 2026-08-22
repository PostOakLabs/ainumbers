#!/usr/bin/env node
/**
 * check-page-kernel-digest.mjs — page-to-kernel digest sentinel ratchet (PAGE-KERNEL-DIGEST-SENTINEL-1).
 *
 * THE HOLE THIS CLOSES. Every OpenChainGraph node page under `chaingraph/art-*.html` carries an
 * INLINE copy of its kernel's compute() so the page runs client-side with zero network calls
 * (CONTRACT §1.1). Nothing has ever checked that the inline copy still matches the kernel file.
 * `ART231-MAPR-REBUILD-1` corrected art-231's kernel from a nominal proxy to the statutory
 * actuarial rate and found the page still serving the old 1.0.0 proxy JS: the kernel was right and
 * the public calculator was wrong, with no gate anywhere in the estate able to see it. Tim's
 * 2026-08-22 ruling: that is a standing hole, not an art-231 quirk.
 *
 * WHAT IT CHECKS. A page declares the kernel digest it was built against with ONE sentinel:
 *
 *     <!--KERNEL-DIGEST-->sha256:<64 lowercase hex><!--/KERNEL-DIGEST-->
 *
 * The gate recomputes that kernel's digest FROM THE KERNEL SOURCE and compares. Mismatch fails.
 *
 * SO #34 (INDEPENDENT DERIVATION). Two separate disciplines are load-bearing here:
 *   1. The compared value is RECOMPUTED from the primary source (the kernel file), never read back
 *      out of the artifact under test (the page).
 *   2. The page does NOT name its own kernel. The gate derives the kernel path from the PAGE
 *      FILENAME (`chaingraph/art-X.html` -> `chaingraph/kernels/art-X.kernel.mjs`, the estate's
 *      existing 1:1 convention, 595/595 on origin/main f176057c). A sentinel that also carried a
 *      pointer could aim itself at a kernel it happens to match, which is self-attested provenance
 *      validated by a self-consistent checker.
 *
 * DIGEST DEFINITION — NOT HAND-ROLLED. `sourceDigest()` from `chaingraph/kernels/_buildid.mjs` is
 * the estate's single named source of truth for the §17 kernel_digest (LF-normalized UTF-8 bytes,
 * WebCrypto SHA-256, `sha256:` prefix). `gen-kernel-identity.mjs` stamps `compute_images[].image_id`
 * with it and `check-s18-digest-freshness.mjs` compares receipts against it. This gate imports and
 * calls that exact function. One digest definition, never a second canonicalization.
 *
 * MARKER STYLE — NOT A THIRD ONE. `<!--KERNEL-DIGEST-->value<!--/KERNEL-DIGEST-->` mirrors the
 * estate's existing machine-checked in-page value convention `<!--COUNT:key-->N<!--/COUNT-->`
 * (scripts/verify-counts.mjs SENTINEL_RE). Same delimiters, same open/close shape, same "a script
 * owns this value" contract. It lives in an HTML comment, so it is invisible to readers, excluded
 * from the copy-hallmarks visible-text scan, and changes no rendered output.
 *
 * RATCHET, NOT A SWITCH. Re-measured on origin/main f176057c: 595 node pages, ZERO carrying a
 * page-to-kernel build sentinel. A hard gate would red all 595 on day one, so unstamped pages are
 * shielded by `scripts/page-kernel-digest-baseline.json`, exactly as
 * `scripts/copy-hallmarks-baseline.json` shields unswept copy debt. Two properties make the
 * shield honest:
 *   - It shields ABSENCE ONLY. A baselined page that DOES carry a sentinel is checked in full, and
 *     a wrong value there FAILS. Shielding absence must never shield a wrong value.
 *   - Counts only go DOWN, under TWO independent locks:
 *       lock 1 — `--update` REFUSES to add a filename that is not already baselined (the additions
 *                check in planBaselineUpdate), so a newly published page can never be shielded by
 *                running the updater. A new page must carry the sentinel.
 *       lock 2 — the baseline carries `max_unstamped`, a ceiling written once at `--init` and
 *                lowered (never raised) by `--update`. The STRICT gate fails when
 *                `unstamped.length > max_unstamped`, so hand-editing entries back into the list
 *                reds CI too, not just running the updater.
 *     `--init` exists for the one-time bootstrap and hard-refuses once the baseline file exists, so
 *     regrowing the shield is never a routine command — it is a visible, additive, reviewable diff.
 *
 * Usage:
 *   node scripts/check-page-kernel-digest.mjs             strict (CI): exit 1 on any failing page
 *   node scripts/check-page-kernel-digest.mjs --summary   counts only, exit 0
 *   node scripts/check-page-kernel-digest.mjs --list      per-page state for every page, exit 0
 *   node scripts/check-page-kernel-digest.mjs --update    prune the baseline (shrink only; refuses to grow)
 *   node scripts/check-page-kernel-digest.mjs --init      one-time bootstrap; refuses if the baseline exists
 *   node scripts/check-page-kernel-digest.mjs --digest <page.html>   print the digest a page should carry
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE_DIR = resolve(REPO, 'chaingraph');
const KERNEL_DIR = resolve(REPO, 'chaingraph', 'kernels');
const BASELINE_PATH = resolve(HERE, 'page-kernel-digest-baseline.json');

// ── the sentinel ─────────────────────────────────────────────────────────────────────────────────
// Mirrors verify-counts.mjs's <!--COUNT:key-->N<!--/COUNT-->. Non-greedy, dotall so a stray newline
// inside the sentinel is still SEEN (and then rejected as malformed) rather than silently skipped.
export const SENTINEL_OPEN = '<!--KERNEL-DIGEST-->';
export const SENTINEL_CLOSE = '<!--/KERNEL-DIGEST-->';
const SENTINEL_RE = /<!--KERNEL-DIGEST-->([\s\S]*?)<!--\/KERNEL-DIGEST-->/g;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/** Every sentinel value in a page, in document order. Length > 1 is a hard failure (ambiguity). */
export function findSentinels(html) {
  return Array.from(String(html).matchAll(SENTINEL_RE)).map((m) => m[1]);
}

/** The kernel file a page must be checked against, derived from the PAGE filename alone. */
export function kernelFileForPage(pageRelOrName) {
  return basename(String(pageRelOrName)).replace(/\.html$/, '') + '.kernel.mjs';
}

// ── verdicts ─────────────────────────────────────────────────────────────────────────────────────
// Failing states are listed here once so the CLI, the summary and the self-test agree on what red is.
export const FAILING_STATES = new Set(['MISMATCH', 'MALFORMED', 'DUPLICATE', 'NO_KERNEL', 'UNSTAMPED_NEW']);

/**
 * Pure classifier — no disk, no clock, no globals, so the fixture self-test drives every branch.
 *   html             page source text
 *   recomputedDigest sourceDigest() over the kernel source, or null when the kernel file is absent
 *   baselined        is this page's path enumerated in the baseline?
 * Sentinel presence is evaluated BEFORE the baseline is consulted: the baseline shields ABSENCE only.
 */
export function classifyPage({ html, recomputedDigest = null, baselined = false }) {
  const found = findSentinels(html);

  if (found.length > 1) {
    return { state: 'DUPLICATE', declared: null, recomputed: recomputedDigest,
      detail: `${found.length} kernel-digest sentinels in one page; exactly one is allowed` };
  }

  if (found.length === 1) {
    const declared = found[0].trim();
    if (!DIGEST_RE.test(declared)) {
      return { state: 'MALFORMED', declared, recomputed: recomputedDigest,
        detail: 'sentinel value must be "sha256:" followed by 64 lowercase hex characters' };
    }
    if (recomputedDigest === null) {
      return { state: 'NO_KERNEL', declared, recomputed: null,
        detail: 'page declares a kernel digest but no kernel file exists for it' };
    }
    if (declared !== recomputedDigest) {
      return { state: 'MISMATCH', declared, recomputed: recomputedDigest,
        detail: 'the page was built against an earlier kernel revision; rebuild the page from the current kernel, then restamp' };
    }
    return { state: 'OK', declared, recomputed: recomputedDigest, detail: 'page matches the current kernel source' };
  }

  // No sentinel. Only here does the baseline matter.
  if (baselined) {
    return { state: 'SHIELDED', declared: null, recomputed: recomputedDigest,
      detail: 'no sentinel yet; enumerated in page-kernel-digest-baseline.json (legacy debt, burns down as pages are touched)' };
  }
  return { state: 'UNSTAMPED_NEW', declared: null, recomputed: recomputedDigest,
    detail: 'page is not in the baseline and carries no kernel-digest sentinel; a NEW page must be stamped' };
}

/**
 * Pure baseline updater — shrink-only. Returns { ok, additions, removals, next }.
 * ok === false when the current unstamped set contains a file the baseline does not already carry:
 * that is the counts-only-down refusal, and it is what stops a new page being shielded.
 */
export function planBaselineUpdate(currentUnstamped, baselineList) {
  const cur = [...new Set(currentUnstamped)].sort();
  const base = new Set(baselineList);
  const additions = cur.filter((f) => !base.has(f));
  const removals = [...base].filter((f) => !cur.includes(f)).sort();
  return { ok: additions.length === 0, additions, removals, next: cur };
}

export function loadBaseline(path = BASELINE_PATH) {
  if (!existsSync(path)) return { unstamped: [], max_unstamped: 0 };
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Lock 2: the shield may never hold more entries than its own recorded ceiling. */
export function baselineCeilingBreach(baselineObj) {
  const list = baselineObj?.unstamped ?? [];
  const ceiling = baselineObj?.max_unstamped;
  if (typeof ceiling !== 'number') return null;
  return list.length > ceiling
    ? `baseline holds ${list.length} shielded page(s) but its own max_unstamped ceiling is ${ceiling} (counts only go DOWN)`
    : null;
}

const BASELINE_COMMENT =
  'Ratchet shield for PAGE-KERNEL-DIGEST-SENTINEL-1: node pages that carry no <!--KERNEL-DIGEST--> sentinel yet. ' +
  'Counts only go DOWN under two locks: `--update` refuses to ADD an entry (so a NEW page can never be shielded), ' +
  'and max_unstamped is a ceiling the strict gate enforces against hand-edits. Prune with: ' +
  'node scripts/check-page-kernel-digest.mjs --update';

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {

const SUMMARY = process.argv.includes('--summary');
const LIST = process.argv.includes('--list');
const UPDATE = process.argv.includes('--update');
const INIT = process.argv.includes('--init');
const DIGEST_OF = process.argv.includes('--digest') ? process.argv[process.argv.indexOf('--digest') + 1] : null;

const { sourceDigest } = await import(pathToFileURL(resolve(KERNEL_DIR, '_buildid.mjs')).href);

// --digest: print what a page's sentinel should say. The stamping helper for whoever touches a page.
if (DIGEST_OF) {
  const kPath = resolve(KERNEL_DIR, kernelFileForPage(DIGEST_OF));
  if (!existsSync(kPath)) {
    console.error(`no kernel file for ${DIGEST_OF} (expected ${kPath})`);
    process.exit(1);
  }
  const d = await sourceDigest(readFileSync(kPath, 'utf8'));
  console.log(`${SENTINEL_OPEN}${d}${SENTINEL_CLOSE}`);
  process.exit(0);
}

const pages = readdirSync(PAGE_DIR).filter((f) => /^art-.*\.html$/.test(f)).sort();
const baselineObj = loadBaseline();
const baselineSet = new Set(baselineObj.unstamped ?? []);

const findings = [];
for (const file of pages) {
  const rel = `chaingraph/${file}`;
  const html = readFileSync(resolve(PAGE_DIR, file), 'utf8');
  const kPath = resolve(KERNEL_DIR, kernelFileForPage(file));
  const recomputed = existsSync(kPath) ? await sourceDigest(readFileSync(kPath, 'utf8')) : null;
  const verdict = classifyPage({ html, recomputedDigest: recomputed, baselined: baselineSet.has(rel) });
  findings.push({ rel, ...verdict });
}

const by = (s) => findings.filter((f) => f.state === s);
const stamped = findings.filter((f) => f.declared !== null);
const failures = findings.filter((f) => FAILING_STATES.has(f.state));
const unstampedNow = findings.filter((f) => f.declared === null && f.state !== 'DUPLICATE').map((f) => f.rel);

const trunc = (d) => (d ? d.slice(0, 14) + '…' + d.slice(-6) : '(none)');
const headline = `page↔kernel digest: ${pages.length} node page(s) | stamped ${stamped.length} (ok ${by('OK').length}) | unstamped: ${by('SHIELDED').length} shielded, ${by('UNSTAMPED_NEW').length} unbaselined`;

if (INIT) {
  if (existsSync(BASELINE_PATH)) {
    console.error('\n✗ --init REFUSED — scripts/page-kernel-digest-baseline.json already exists.');
    console.error('  The shield is bootstrapped exactly once. It shrinks with --update and never regrows.');
    process.exit(1);
  }
  const list = [...unstampedNow].sort();
  writeFileSync(BASELINE_PATH, JSON.stringify({ _comment: BASELINE_COMMENT, max_unstamped: list.length, unstamped: list }, null, 2) + '\n');
  console.log(`✓ baseline bootstrapped: ${list.length} unstamped page(s), ceiling ${list.length} → ${BASELINE_PATH}`);
  process.exit(0);
}

if (UPDATE) {
  const plan = planBaselineUpdate(unstampedNow, [...baselineSet]);
  if (!plan.ok) {
    console.error('\n✗ baseline update REFUSED — counts only go DOWN.');
    console.error(`  ${plan.additions.length} page(s) carry no kernel-digest sentinel and are not already baselined:`);
    for (const f of plan.additions) console.error(`    • ${f}`);
    console.error('  The baseline shields ENUMERATED LEGACY pages only. Stamp these pages instead:');
    console.error(`    node scripts/check-page-kernel-digest.mjs --digest ${plan.additions[0]}`);
    process.exit(1);
  }
  const prevCeiling = typeof baselineObj.max_unstamped === 'number' ? baselineObj.max_unstamped : plan.next.length;
  const next = {
    _comment: BASELINE_COMMENT,
    max_unstamped: Math.min(prevCeiling, plan.next.length), // lowered, never raised
    unstamped: plan.next,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`✓ baseline pruned: ${baselineSet.size} → ${plan.next.length} unstamped page(s) (${plan.removals.length} removed).`);
  if (plan.removals.length) for (const f of plan.removals) console.log(`    − ${f}`);
  process.exit(0);
}

if (SUMMARY || LIST) {
  console.log(headline);
  if (LIST) for (const f of findings) console.log(`  ${f.state.padEnd(14)} ${f.rel}  declared=${trunc(f.declared)} recomputed=${trunc(f.recomputed)}`);
  process.exit(0);
}

// Calibration note (advisory, never a refusal): if a meaningful number of pages are stamped and NONE
// of them match, the digest path is the likelier defect than 5+ simultaneously stale pages. Advisory
// on purpose — a hard refusal here would swallow the real message on a small stamped estate.
if (stamped.length >= 5 && by('OK').length === 0) {
  console.error('⚠ calibration note: every stamped page mismatches. Check the digest path before trusting these as real staleness.');
}

// Lock 2 on the ratchet: the shield may never hold more entries than its own recorded ceiling.
const breach = baselineCeilingBreach(baselineObj);
if (breach) {
  console.error(`\n✗ page-kernel digest baseline REGREW — ${breach}.`);
  console.error('  Entries are removed as pages are stamped; they are never added back. Stamp the page instead.');
  process.exit(1);
}

if (failures.length) {
  console.error(`\n✗ page↔kernel digest gate FAILED — ${failures.length} page(s):`);
  for (const f of failures) {
    console.error(`  • ${f.rel} [${f.state}] ${f.detail}`);
    if (f.state === 'MISMATCH' || f.state === 'MALFORMED' || f.state === 'NO_KERNEL') {
      console.error(`      page declares: ${f.declared}`);
      console.error(`      kernel is now: ${f.recomputed ?? '(no kernel file on disk)'}`);
      console.error(`      kernel source: chaingraph/kernels/${kernelFileForPage(f.rel)}`);
    }
    if (f.state === 'UNSTAMPED_NEW') {
      console.error(`      stamp it: node scripts/check-page-kernel-digest.mjs --digest ${f.rel}`);
      console.error('      then paste that sentinel into the page. The baseline shields legacy pages only and refuses to grow.');
    }
  }
  console.error(`\n${headline}`);
  process.exit(1);
}

console.log(`✓ ${headline}`);

} // IS_MAIN
