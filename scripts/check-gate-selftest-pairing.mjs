#!/usr/bin/env node
/**
 * scripts/check-gate-selftest-pairing.mjs — GATE-SELFTEST-META-1
 *
 * Mechanizes SO #40b ("a checker that cannot be shown red proves nothing") /
 * 0xAlpha's 2026-08-21 audit Tier-B Rec 1: every NEWLY ADDED blocking gate
 * script (`check-X.mjs`) must ship a paired tamper/mutation self-test
 * (`check-X.test.mjs`, `check-X.selftest.mjs`, or the same script invoked
 * with `--self-test` as its own GATES entry) proving the checker CAN go red,
 * not just that it currently reads green.
 *
 * SCOPE (rail 1 of the row): NEW gates only. The repo already carries a large
 * backlog of unpaired checkers predating this gate — that backlog is
 * BASELINE-SHIELDED (same ratchet shape as scripts/copy-hallmarks-baseline.json
 * and scripts/generator-check-baseline.json: counts only go down, nothing here
 * pairs the backlog, a session that pairs one prunes it from the baseline with
 * --update). A gate NOT in the baseline and NOT paired is new debt and hard-fails.
 *
 * MEMBERSHIP (rail 2): "blocking gate" = wired into scripts/preflight.mjs's own
 * GATES array — the exact command-extraction technique
 * scripts/check-generator-coverage.mjs already uses (strip full-line comments,
 * pull the `const GATES = [ ... ];` literal, regex out every quoted `node <path>
 * ...` / `python <path> ...` token). Never a hand-maintained registry — add a
 * gate to preflight.mjs and this script sees it on the next run, nothing else
 * to update.
 *
 * WHAT COUNTS AS "NEEDS A PAIR" — a checker candidate is any invoked script
 * path whose basename matches `check[-_]*.mjs` and is not itself a `.test.mjs`
 * or `.selftest.mjs` file (those ARE the pairs, not things needing one).
 * Deliberately narrow to the repo's own `check-X.mjs` naming convention named
 * in the row body — generator `--check` freshness scripts (a different
 * category, covered by check-generator-coverage.mjs) and raw kernel
 * `*.test.mjs` unit suites are out of scope.
 *
 * WHAT COUNTS AS "PAIRED" (rail 3's "or equivalent"), either form, and the
 * pair must ITSELF be a live GATES entry (so it actually runs and must stay
 * green every push — this repo's existing preflight discipline already
 * enforces "RUNS green" for anything registered as a hard gate; a pair that
 * exists on disk but is not wired into GATES would run nothing and prove
 * nothing, so it does not count):
 *   (a) sibling `<name>.test.mjs` or `<name>.selftest.mjs` file, on disk AND
 *       wired into GATES as its own entry — e.g. check-binary-bytes.mjs +
 *       check-binary-bytes.test.mjs.
 *   (b) the SAME script invoked with a `--self-test` flag as a distinct GATES
 *       entry — e.g. check-inline-ssot-sync.mjs --self-test.
 * This script deliberately does NOT re-execute every tamper case per push
 * (cost, per rail 3) — the pair's own GATES entry already runs and must pass
 * elsewhere in the same preflight invocation; this gate only verifies the
 * pair EXISTS and IS wired (i.e. WILL run, and preflight is already what
 * makes it prove green).
 *
 * Usage:
 *   node scripts/check-gate-selftest-pairing.mjs           — check (exit 1 on new debt)
 *   node scripts/check-gate-selftest-pairing.mjs --update   — regenerate the baseline
 *                                                              to the CURRENT unpaired
 *                                                              set (prune resolved
 *                                                              entries; never a
 *                                                              substitute for pairing
 *                                                              new debt, which this
 *                                                              script always hard-fails)
 *
 * Self-test: scripts/check-gate-selftest-pairing.test.mjs (imports classify()/
 * isCheckerCandidate() below and proves, on in-memory fixtures, that an
 * unpaired scratch gate is flagged and a paired one is not — RED then GREEN).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const BASELINE_PATH = resolve(HERE, 'gate-selftest-pairing-baseline.json');
const UPDATE = process.argv.includes('--update');

// ── Extraction (mirrors check-generator-coverage.mjs's extractInvokedPaths —
// duplicated rather than imported: that file is an existing gate, out of
// scope to modify per this row's rails, and the extraction is ~15 lines). ──
export function extractInvokedCommands(preflightSrc) {
  const liveLines = preflightSrc
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  const arrayMatch = liveLines.match(/const GATES = \[([\s\S]*?)\n\];/);
  const arraySrc = arrayMatch ? arrayMatch[1] : '';
  const commands = [];
  const quotedRe = /'([^']*)'|"([^"]*)"|`([^`]*)`/g;
  let m;
  while ((m = quotedRe.exec(arraySrc))) {
    const content = m[1] ?? m[2] ?? m[3] ?? '';
    if (/^(node|python)\s+/.test(content)) commands.push(content);
  }
  return commands;
}

export function pathOf(cmd) {
  return cmd.split(/\s+/)[1] ?? null;
}

// Narrow, deliberate: only this repo's `check-X.mjs` checker-naming
// convention is in scope for pairing (see header). `check_tools.js` (a
// different extension, the JS-syntax gate) and python `check_*.py` scripts
// are out of scope by construction — this pattern only matches `.mjs`.
export function isCheckerCandidate(path) {
  if (!path) return false;
  const base = path.split('/').pop();
  return /^check[-_].*\.mjs$/.test(base) && !/\.(test|selftest)\.mjs$/.test(base);
}

export function pairPathsFor(path) {
  const noExt = path.replace(/\.mjs$/, '');
  return { testFile: `${noExt}.test.mjs`, selftestFile: `${noExt}.selftest.mjs` };
}

/**
 * Pure classification — no disk I/O beyond the injected `exists` fn, so the
 * self-test can drive it against synthetic command lists. Returns
 * { candidates, paired, unpaired } (all sorted, all checker-candidate paths).
 */
export function classify(commands, exists) {
  const paths = new Set(commands.map(pathOf).filter(Boolean));
  const hasSelfTestFlag = new Set(
    commands.filter((c) => /\s--self-test(\s|$)/.test(c)).map(pathOf),
  );
  const candidates = [...paths].filter(isCheckerCandidate).sort();
  const paired = [];
  const unpaired = [];
  for (const c of candidates) {
    const { testFile, selftestFile } = pairPathsFor(c);
    const hasSeparatePair =
      (paths.has(testFile) && exists(testFile)) ||
      (paths.has(selftestFile) && exists(selftestFile));
    const hasInlinePair = hasSelfTestFlag.has(c);
    (hasSeparatePair || hasInlinePair ? paired : unpaired).push(c);
  }
  return { candidates, paired, unpaired };
}

// ── Live run against the real estate ────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const preflightSrc = readFileSync(resolve(REPO, 'scripts', 'preflight.mjs'), 'utf8');
  const commands = extractInvokedCommands(preflightSrc);
  const exists = (p) => existsSync(resolve(REPO, p));
  const { candidates, paired, unpaired } = classify(commands, exists);

  let baseline = { unpaired: [] };
  if (existsSync(BASELINE_PATH)) {
    try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); } catch { /* fall back to empty */ }
  }
  const baseSet = new Set(baseline.unpaired ?? []);
  const curSet = new Set(unpaired);
  const newUnpaired = unpaired.filter((p) => !baseSet.has(p));
  const resolvedFromBaseline = [...baseSet].filter((p) => !curSet.has(p));

  if (UPDATE) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          generated: new Date().toISOString().slice(0, 10),
          note: 'Known blocking check-X.mjs gate scripts (wired into scripts/preflight.mjs GATES) with no paired tamper/mutation self-test (check-X.test.mjs / check-X.selftest.mjs / --self-test). Predates GATE-SELFTEST-META-1 (2026-08-21) and is shielded — NEW entries outside this list hard-fail check-gate-selftest-pairing.mjs; these do not. Burn down over time by adding a paired self-test, then regenerate with --update.',
          count: unpaired.length,
          unpaired,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`gate-selftest-pairing-baseline.json written: ${unpaired.length} known unpaired gate(s).`);
    process.exit(0);
  }

  console.log(
    `check-gate-selftest-pairing: ${candidates.length} blocking check-X.mjs gate(s) in preflight.mjs, ` +
    `${paired.length} paired, ${unpaired.length} unpaired (${baseSet.size} baselined).`,
  );

  if (resolvedFromBaseline.length) {
    console.log(`\n  ${resolvedFromBaseline.length} baselined gap(s) now have a pair — prune with --update:`);
    for (const p of resolvedFromBaseline) console.log('    - ' + p);
  }

  if (newUnpaired.length) {
    console.error(`\n✗ check-gate-selftest-pairing FAILED — ${newUnpaired.length} blocking gate(s) added since the baseline with no paired self-test:`);
    for (const p of newUnpaired) {
      const { testFile, selftestFile } = pairPathsFor(p);
      console.error(`  • ${p}`);
      console.error(`      add ${testFile} (or ${selftestFile}, or --self-test as its own GATES entry) and wire it into preflight.mjs`);
    }
    console.error('\nThis is SCOPE-NEW debt only — the pre-existing backlog stays baseline-shielded (scripts/gate-selftest-pairing-baseline.json).');
    process.exit(1);
  }

  console.log('\n✓ gate-selftest-pairing clean — no NEW blocking check-X.mjs gate lacks a paired self-test.');
}
