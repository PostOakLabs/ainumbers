#!/usr/bin/env node
// gen-value-parity-pairs.mjs — estate-wide page↔kernel VALUE-parity candidate
// generator (VALUE-PARITY-PAIRGEN-1, 2026-09-05).
//
// WHY: the surface-parity gate (check-node-surface-parity.mjs) compares member
// SETS; identical fields carrying diverged VALUES pass it silently. That is the
// art-220 incident class (SURFACE-PARITY-CLASSIFICATION-2026-09-03: 40+ pairs
// "value-only" divergent). This script is a REPORT-ONLY CANDIDATE GENERATOR:
// it mines page↔kernel pairs by SHARED-CONSTANT DENSITY — the same enumeration
// scan method the CCPP pilot
// (workspace research/CHAIN-CONSISTENCY-PROPERTY-PILOT-1-REPORT-2026-09-02.md)
// used to mine kernel↔kernel families ("how many distinct four-to-seven-digit
// constants appear in two or more files") — and, per pair, diffs the extracted
// 4-to-7-digit constant sets between the page's own HTML and its kernel's
// source. Divergent constants are fix-row candidates for 7F/Tim triage, NOT
// fixes: this script edits no page and no kernel, is NOT wired into preflight
// or CI, and must not be (freeze-class: ci).
//
// SCOPE: every kernel in chaingraph/kernels/*.kernel.mjs; its page is looked
// up under chaingraph/<id>.html OR tools/<id>.html (the two page roots
// CANTON-GATE-1 established). Pairs are ranked by shared-constant density:
//   density = |page ∩ kernel| / min(|page set|, |kernel set|)
// A pair with density ≥ --min-density (default 0.15) AND ≥ --min-shared
// (default 5) shared constants is a VALUE-PARITY CANDIDATE: the two surfaces
// carry enough of the same numbers that a value drift on either side is
// invisible to field-set parity and dangerous.
//
// PER-PAIR VALUE DIFF: constants (distinct 4-to-7-digit integers, extracted
// from full source text exactly as the pilot's scan did) split three ways —
//   kernel_only : candidate stale/missing page values (kernel is truth)
//   page_only   : candidate page-only literals
//   shared      : agreeing (present both sides)
// Counts only; the report writer summarizes top offenders per pair.
//
// MUTATION ADEQUACY (item 4 of the row): `--selftest` copies ONE real
// kernel+page pair into a scratch dir, seeds ONE value divergence (changes a
// shared constant on the page copy only), re-runs the scanner over the
// scratch pair, and FAILS unless the seeded divergence is listed. Run:
//   node scripts/gen-value-parity-pairs.mjs --selftest
//
// USAGE:
//   node scripts/gen-value-parity-pairs.mjs                 # scan + print summary + --json out
//   node scripts/gen-value-parity-pairs.mjs --json out.json # machine pair list
//   node scripts/gen-value-parity-pairs.mjs --selftest      # seeded-divergence control

import { readdirSync, readFileSync, statSync, mkdirSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const REPO = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const KERNELS_DIR = join(REPO, 'chaingraph', 'kernels');
const PAGE_ROOTS = [join(REPO, 'chaingraph'), join(REPO, 'tools')];

// 4-to-7-digit standalone integers, not part of a longer digit run and not a
// fractional/decimal component. Full-text scan, per the CCPP pilot's method.
const CONST_RE = /(?<![\d.])\d{4,7}(?![\d.])/g;

// Years (19xx/20xx) are ubiquitous page chrome (dates, citations); the pilot's
// signal was REGULATORY CONSTANTS. Counting years swamps density with noise,
// so they are excluded from the SETS (recorded as excluded, never silent).
function isYear(n) { return (n >= 1900 && n <= 2099); }

function extractConstants(text) {
  const set = new Set();
  for (const m of text.matchAll(CONST_RE)) {
    const n = Number(m[0]);
    if (!isYear(n)) set.add(n);
  }
  return set;
}

function findPage(toolId) {
  for (const root of PAGE_ROOTS) {
    const p = join(root, `${toolId}.html`);
    try { if (statSync(p).isFile()) return p; } catch { /* try next root */ }
  }
  return null;
}

function scanPair(kernelPath, pagePath) {
  const kernelSet = extractConstants(readFileSync(kernelPath, 'utf8'));
  const pageSet = extractConstants(readFileSync(pagePath, 'utf8'));
  const shared = [...kernelSet].filter((c) => pageSet.has(c));
  const kernelOnly = [...kernelSet].filter((c) => !pageSet.has(c));
  const pageOnly = [...pageSet].filter((c) => !kernelSet.has(c));
  const denom = Math.min(kernelSet.size, pageSet.size);
  const density = denom === 0 ? 0 : shared.length / denom;
  return { kernelSet, pageSet, shared, kernelOnly, pageOnly, density };
}

function scanEstate() {
  const rows = [];
  for (const f of readdirSync(KERNELS_DIR)) {
    if (!f.endsWith('.kernel.mjs')) continue;
    const toolId = f.replace(/\.kernel\.mjs$/, '');
    const kernelPath = join(KERNELS_DIR, f);
    const pagePath = findPage(toolId);
    if (!pagePath) { rows.push({ toolId, page: null, scope: toolId.startsWith('art-') ? 'art-*' : 'non-art' }); continue; }
    const r = scanPair(kernelPath, pagePath);
    rows.push({
      toolId,
      page: pagePath,
      scope: toolId.startsWith('art-') ? 'art-*' : 'non-art',
      kernelConstants: r.kernelSet.size,
      pageConstants: r.pageSet.size,
      shared: r.shared.length,
      kernelOnly: r.kernelOnly.length,
      pageOnly: r.pageOnly.length,
      density: Number(r.density.toFixed(4)),
      sharedSample: r.shared.slice(0, 12),
      kernelOnlySample: r.kernelOnly.slice(0, 12),
      pageOnlySample: r.pageOnly.slice(0, 12),
    });
  }
  return rows;
}

// --- mutation-adequacy control: seed ONE value divergence, demand it back ---
function selftest() {
  const seedKernel = 'art-234-test-hoepa-high-cost.kernel.mjs';
  const seedPage = 'chaingraph/art-234-test-hoepa-high-cost.html';
  const scratch = join(tmpdir(), `vpp-selftest-${Date.now()}`);
  const kdir = join(scratch, 'kernels');
  const pdir = join(scratch, 'pages');
  mkdirSync(kdir, { recursive: true });
  mkdirSync(pdir, { recursive: true });

  const kText = readFileSync(join(KERNELS_DIR, seedKernel), 'utf8');
  const pPath = findPage('art-234-test-hoepa-high-cost');
  const pText = readFileSync(pPath, 'utf8');
  // 1380 is the 2026 HOEPA dollar floor carried by BOTH surfaces. Mutate the
  // PAGE copy only: 1380 -> 2917 (a constant the kernel does NOT carry), so
  // 1380 must surface as kernel-only and 2917 as page-only after the scan.
  if (!pText.includes('1380') || !kText.includes('1380')) { console.error('X selftest: seed constant 1380 absent from a fixture — fixture drifted'); process.exit(1); }
  const pMut = pText.replace(/1380/g, '2917');
  writeFileSync(join(kdir, seedKernel), kText);
  writeFileSync(join(pdir, basename(pPath)), pMut);

  const r = scanPair(join(kdir, seedKernel), join(pdir, basename(pPath)));
  const seededListed = r.kernelOnly.includes(1380) && r.pageOnly.includes(2917);
  const unmutated = scanPair(join(KERNELS_DIR, seedKernel), pPath);
  const cleanPair = unmutated.kernelOnly.includes(1380) === false;
  rmSync(scratch, { recursive: true, force: true });
  if (seededListed && cleanPair) {
    console.log('SELfTEST-OK: seeded divergence (page 1380 -> 2917) listed as kernel-only/page-only by the scanner; unmutated pair does not list it');
    return true;
  }
  console.error(`X selftest FAILED: seededListed=${seededListed} cleanPair=${cleanPair}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes('--selftest')) { selftest(); process.exit(0); }

const jsonOutIdx = args.indexOf('--json');
const jsonOut = jsonOutIdx >= 0 ? args[jsonOutIdx + 1] : null;
const minShared = 5;
const minDensity = 0.15;

const rows = scanEstate();
const paired = rows.filter((r) => r.page);
const unpaired = rows.filter((r) => !r.page);
const candidates = paired
  .filter((r) => r.shared >= minShared && r.density >= minDensity)
  // Tier 1 (art-220 class, LIVE): constants the kernel carries that the page
  // copy does not — a value the surfaces already disagree on, or a table
  // entry the page copy dropped. These outrank pure density.
  .sort((a, b) => ((b.kernelOnly > 0) - (a.kernelOnly > 0)) || b.density - a.density || b.shared - a.shared);

console.log(`scanned ${rows.length} kernels · paired ${paired.length} · pageless ${unpaired.length}`);
console.log(`value-parity candidates (shared>=${minShared} && density>=${minDensity}): ${candidates.length}`);
for (const c of candidates.slice(0, 25)) {
  console.log(`  ${c.toolId}  density=${c.density} shared=${c.shared} kernelOnly=${c.kernelOnly} pageOnly=${c.pageOnly} (${c.scope})`);
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ generatedBy: 'scripts/gen-value-parity-pairs.mjs (VALUE-PARITY-PAIRGEN-1)', minShared, minDensity, counts: { kernels: rows.length, paired: paired.length, pageless: unpaired.length, candidates: candidates.length }, candidates, unpaired: unpaired.map((u) => u.toolId) }, null, 2));
  console.log(`json written: ${jsonOut}`);
}
