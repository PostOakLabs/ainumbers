#!/usr/bin/env node
/**
 * scripts/check-generator-coverage.mjs — SSOT-GATES-1 §G2.5
 *
 * A meta-gate that checks the gates: the "generator has a --check flag but
 * nothing ever calls it" bug shipped 3 times in one session (generate-okf.mjs,
 * gen-start-index.mjs, gen-kernel-vm-html.mjs — see SSOT-GATES-1-BUILD-SPEC.md
 * §G1). This scans the repo's zero-dependency generator scripts and:
 *
 *   1. HARD-FAILS (exit 1) if any generator that supports `--check` is not
 *      referenced by name anywhere in scripts/preflight.mjs — the exact
 *      failure mode above.
 *   2. WARNS (never hard-fails) on any generator-shaped file (writes output
 *      via writeFileSync) that has no `--check` support at all. A baseline
 *      file (scripts/generator-check-baseline.json, same shield-and-burn-down
 *      pattern as scripts/dead-link-baseline.json) tracks the currently-known
 *      gaps so new ones are visible in the WARN output instead of blending in.
 *
 * Heuristic (deliberately simple, same rigor as check-manifest-parity.mjs's
 * narrow-field-diff pattern — a string search, not an AST parse):
 *   - "generator-shaped" = file source contains `writeFileSync` (it produces
 *     committed output) and/or supports `--check` (below).
 *   - "supports --check" = file source contains a QUOTED '--check' or
 *     "--check" token (i.e. `process.argv.includes('--check')` and
 *     equivalent) — not a bare substring match. A bare-substring version was
 *     tried against the real corpus first and false-positived on
 *     scripts/sync-stats.mjs, which merely mentions "--check" in a comment
 *     about a DIFFERENT script (gen-chain-index.mjs); the quoted form only
 *     matches an actual argv check.
 *   - "wired into preflight.mjs" = GENCOV-GATE-FIX-1 (2026-07-27): the path
 *     appears as the script argument of an actual `['label', 'cmd']` GATES
 *     entry — NOT a bare substring match against the whole file. The prior
 *     `preflightSrc.includes(r)` form was satisfied by the path appearing in
 *     a comment, a string, or a disabled/commented-out row; it never checked
 *     that preflight.mjs actually *executes* the generator. Extraction: pull
 *     the `const GATES = [ ... ];` array literal text, strip full-line `//`
 *     comments first (so a commented-out row counts as NOT wired — same
 *     verdict as a row that was never added), then regex out every quoted
 *     `node <path> ...` / `python <path> ...` command token and take the
 *     path. A generator only counts as covered if its rel path is the exact
 *     script token of a live GATES entry.
 *
 * Scans: scripts/*.mjs, chaingraph/*.mjs, and chaingraph/(nested)/scripts/*.mjs
 * (any directory literally named "scripts" nested anywhere under chaingraph/).
 * Self-excluded: this file, scripts/preflight.mjs (the registry being
 * checked, not a generator), and this baseline file's own JSON sibling.
 *
 * Usage:
 *   node scripts/check-generator-coverage.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const BASELINE_PATH = resolve(HERE, 'generator-check-baseline.json');
const UPDATE = process.argv.includes('--update');

const SELF_EXCLUDE = new Set([
  'scripts/check-generator-coverage.mjs',
  'scripts/preflight.mjs',
]);

// ── 1. Collect candidate files ───────────────────────────────────────────
function listMjs(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.filter((e) => e.isFile() && e.name.endsWith('.mjs')).map((e) => join(dir, e.name));
}

const candidates = [
  ...listMjs(resolve(REPO, 'scripts')),
  ...listMjs(resolve(REPO, 'chaingraph')),
];
// chaingraph/**/scripts/*.mjs — any directory literally named "scripts" nested under chaingraph/.
function findScriptsDirs(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = join(dir, e.name);
    if (e.name === 'scripts') out.push(full);
    else if (e.name !== 'node_modules' && !e.name.startsWith('.')) findScriptsDirs(full, out);
  }
  return out;
}
for (const dir of findScriptsDirs(resolve(REPO, 'chaingraph'))) {
  candidates.push(...listMjs(dir));
}

const rel = (p) => relative(REPO, p).split('\\').join('/');

// ── 2. Classify ───────────────────────────────────────────────────────────
const preflightSrc = readFileSync(resolve(REPO, 'scripts', 'preflight.mjs'), 'utf8');

// Extract the invoked-script set from the GATES array — never a substring
// match against the raw file (see header note). Strip full-line comments
// first: a commented-out GATES row is not an execution and must not count.
function extractInvokedPaths(src) {
  const liveLines = src
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  const arrayMatch = liveLines.match(/const GATES = \[([\s\S]*?)\n\];/);
  const arraySrc = arrayMatch ? arrayMatch[1] : '';
  const invoked = new Set();
  // Every fully-quoted string in the array — capture up to the MATCHING
  // quote char (not just "the next quote") so a path is never truncated or
  // over-run by an adjacent `'],` array-syntax character.
  const quotedRe = /'([^']*)'|"([^"]*)"|`([^`]*)`/g;
  let m;
  while ((m = quotedRe.exec(arraySrc))) {
    const content = m[1] ?? m[2] ?? m[3] ?? '';
    if (!/^(node|python)\s+/.test(content)) continue;
    const path = content.split(/\s+/)[1];
    if (path) invoked.add(path);
  }
  return invoked;
}
const invokedPaths = extractInvokedPaths(preflightSrc);

const hasCheckFlag = [];   // generators that support --check
const gapless = [];        // generator-shaped files with no --check at all

for (const file of candidates) {
  const r = rel(file);
  if (SELF_EXCLUDE.has(r)) continue;
  const src = readFileSync(file, 'utf8');
  const writesOutput = src.includes('writeFileSync');
  const supportsCheck = /['"]--check['"]/.test(src);
  if (!writesOutput && !supportsCheck) continue; // not generator-shaped at all
  if (supportsCheck) hasCheckFlag.push(r);
  else gapless.push(r);
}
hasCheckFlag.sort();
gapless.sort();

// ── 3. Hard-fail half: every --check generator must be INVOKED by preflight.mjs ──
const uncalled = hasCheckFlag.filter((r) => !invokedPaths.has(r));

// ── 4. Warn half: baseline-shielded gapless generators ───────────────────
let baseline = { gapless: [] };
if (existsSync(BASELINE_PATH)) {
  try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); } catch { /* fall back to empty */ }
}
const baseSet = new Set(baseline.gapless ?? []);
const curSet = new Set(gapless);
const newGapless = gapless.filter((r) => !baseSet.has(r));
const resolvedGapless = [...baseSet].filter((r) => !curSet.has(r));

if (UPDATE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        generated: new Date().toISOString().slice(0, 10),
        note: 'Known generator-shaped scripts (writeFileSync) with no --check freshness gate. NEW entries are visible in the WARN output but do NOT hard-fail (see check-generator-coverage.mjs §G2.5). Burn down over time by adding --check + a preflight gate, then regenerate this baseline with --update.',
        count: gapless.length,
        gapless,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`generator-check-baseline.json written: ${gapless.length} known gapless generator(s).`);
  process.exit(0);
}

console.log(`check-generator-coverage: ${hasCheckFlag.length} generator(s) support --check, ${gapless.length} generator-shaped file(s) have no --check.`);

if (resolvedGapless.length) {
  console.log(`\n  ${resolvedGapless.length} baselined gap(s) now have --check — prune with --update:`);
  for (const r of resolvedGapless) console.log('    - ' + r);
}
if (newGapless.length) {
  console.log(`\n  ⚠ ${newGapless.length} generator-shaped file(s) with NO --check at all (not yet baselined):`);
  for (const r of newGapless) console.log('    - ' + r);
  console.log('  (WARN only — not a hard failure. Add --check + wire it into preflight.mjs when practical,');
  console.log('   or run `node scripts/check-generator-coverage.mjs --update` to acknowledge into the baseline.)');
}

if (uncalled.length) {
  console.error(`\n✗ check-generator-coverage FAILED — ${uncalled.length} generator(s) support --check but preflight.mjs never calls it:`);
  for (const r of uncalled) console.error('  • ' + r);
  console.error('\nAdd a GATES entry to scripts/preflight.mjs calling `node ' + (uncalled[0] || '<file>') + ' --check` (or equivalent).');
  process.exit(1);
}

console.log('\n✓ generator-coverage clean — every --check-supporting generator is wired into preflight.mjs.');
