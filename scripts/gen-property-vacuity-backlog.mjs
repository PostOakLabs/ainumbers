// gen-property-vacuity-backlog.mjs — build/check the property-vacuity backlog
// (PROPTEST-KILL-ATTRIBUTION-1).
//
// WHAT: Derives repo/scripts/property-vacuity-backlog.json from a vacuity-screen
// report (research/step-out/VACUITY-SCREEN-2.vacuity-report.json, outside this
// repo, found by walking up from the repo root). A kernel is BACKLOGGED when its
// screen verdict is ADEQUATE and EVERY KILLED mutant's first error line matches
// /ORACLE/i — i.e. the property assertion itself never fired on a valid mutant;
// every kill came from the fixture replay (the art-223 class, VACUITY-SCREEN-2
// population: 156 kernels of 660).
//
// READ DEPENDENCIES: this generator reads ONLY (a) the screen's vacuity report
// (a research artifact outside the repo, NOT produced by any COVERED writer in
// scripts/derived-artifacts.mjs) and (b) nothing else — the kernel/property data
// rides inside the report. Because its single source lives outside the repo, a
// CI-side COVERED regeneration is impossible; it is therefore wired into
// preflight.mjs as a standalone --check (skip-with-note when the source report
// is absent from the checkout, e.g. CI), never as a COVERED derived artifact.
//
// RATCHET (--check): the backlog only shrinks through evidence.
//   - ADDITION: a kernel present in a fresh regeneration but absent from the
//     committed file FAILS the check (a new property that kills nothing must be
//     dispositioned deliberately, not drift in).
//   - REMOVAL: a committed entry absent from the regeneration is allowed ONLY if
//     the committed file's `removals` array carries a record for that kernel
//     citing a screen id and >= 1 property-attributed kill.
//
// USAGE:
//   node scripts/gen-property-vacuity-backlog.mjs --write   # (re)build the backlog
//   node scripts/gen-property-vacuity-backlog.mjs --check   # gate (preflight)
//   node scripts/gen-property-vacuity-backlog.mjs --check --simulate-add <id>
//       # RED drill: pretend a fresh screen produced one extra vacuous kernel

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const BACKLOG_PATH = join(REPO, 'scripts', 'property-vacuity-backlog.json');
const REPORT_REL = ['research', 'step-out', 'VACUITY-SCREEN-2.vacuity-report.json'];

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const CHECK = argv.includes('--check');
const simIdx = argv.indexOf('--simulate-add');
const SIMULATE_ADD = simIdx !== -1 ? argv[simIdx + 1] : null;

// Walk up from the repo root until research/step-out/<report> exists (the shared
// clone has it at workspace root; a worktree under repo/.wt/<name>/ finds the same
// workspace-root copy several levels up).
function findReport() {
  let dir = REPO;
  for (;;) {
    const candidate = join(dir, ...REPORT_REL);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function screenTag(cloneCommit) {
  return `VACUITY-SCREEN-2 @ ${String(cloneCommit).slice(0, 8)}`;
}

const collator = new Intl.Collator('en', { numeric: true });

// Build the entry map from a report. Returns { entries, sourceCommit }.
function deriveFromReport(reportPath) {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const entries = {};
  for (const k of report.kernels || []) {
    if (k.verdict !== 'ADEQUATE') continue;
    const kills = (k.mutants || []).filter((m) => m.outcome === 'KILLED');
    // Vacuous: every kill is fixture-oracle-attributed, and there is at least one.
    if (kills.length === 0) continue;
    if (!kills.every((m) => /ORACLE/i.test(m.first_error_line || ''))) continue;
    entries[k.kernel] = {
      property_file: k.property_file,
      mutants_valid: (k.mutants_total || 0) - (k.mutants_invalid || 0),
      oracle_kills: kills.length,
      property_kills: 0,
      screen: screenTag(report.report_meta?.clone_commit),
    };
  }
  const sorted = {};
  for (const key of Object.keys(entries).sort(collator.compare)) sorted[key] = entries[key];
  return { entries, sourceCommit: report.report_meta?.clone_commit || 'unknown' };
}

function fail(msg) {
  console.error(`gen-property-vacuity-backlog: FAIL: ${msg}`);
  process.exit(1);
}

// Structural validation of the committed backlog (runs regardless of whether the
// source report is available in this checkout).
function validateCommitted(backlog) {
  if (!backlog || typeof backlog !== 'object') fail('committed backlog is not an object');
  if (typeof backlog.entries !== 'object' || backlog.entries === null) fail('missing `entries` object');
  if (!Array.isArray(backlog.removals)) fail('missing `removals` array');
  for (const [kernel, e] of Object.entries(backlog.entries)) {
    for (const field of ['property_file', 'mutants_valid', 'oracle_kills', 'property_kills', 'screen']) {
      if (!(field in e)) fail(`entry ${kernel}: missing field \`${field}\``);
    }
    if (e.property_kills !== 0) fail(`entry ${kernel}: property_kills must be 0 in the backlog (a property-attributed kill means the kernel leaves the backlog via \`removals\`)`);
    if (!/VACUITY-SCREEN-\d+ @ [0-9a-f]{8}/.test(e.screen || '')) fail(`entry ${kernel}: \`screen\` must cite a screen id + clone commit ("VACUITY-SCREEN-2 @ e428bf7b")`);
  }
  for (const r of backlog.removals) {
    if (!r.kernel || !r.screen) fail('removal record must cite `kernel` and `screen`');
    if (!(r.property_kills >= 1)) fail(`removal record for ${r.kernel}: removal requires >= 1 property-attributed kill cited with a screen id`);
  }
}

function main() {
  if (!WRITE && !CHECK) {
    console.error('usage: gen-property-vacuity-backlog.mjs --write | --check [--simulate-add <kernel-id>]');
    process.exit(2);
  }

  const reportPath = findReport();

  if (WRITE) {
    if (!reportPath) fail('source vacuity report not found (walked up from repo root); cannot --write');
    const { entries, sourceCommit } = deriveFromReport(reportPath);
    const backlog = {
      _meta: {
        generator: 'scripts/gen-property-vacuity-backlog.mjs',
        source_report: REPORT_REL.join('/'),
        source_clone_commit: sourceCommit,
        row: 'PROPTEST-KILL-ATTRIBUTION-1',
      },
      entries,
      removals: existsSync(BACKLOG_PATH) ? (JSON.parse(readFileSync(BACKLOG_PATH, 'utf8')).removals || []) : [],
    };
    validateCommitted(backlog);
    writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2) + '\n');
    console.log(`gen-property-vacuity-backlog: wrote ${Object.keys(entries).length} entr(ies) from ${screenTag(sourceCommit)} to ${BACKLOG_PATH}`);
    process.exit(0);
  }

  // --check
  if (!existsSync(BACKLOG_PATH)) fail(`committed backlog missing at ${BACKLOG_PATH}; run --write`);
  const committed = JSON.parse(readFileSync(BACKLOG_PATH, 'utf8'));
  validateCommitted(committed);

  if (!reportPath) {
    console.log('gen-property-vacuity-backlog: SKIPPED regeneration ratchet — source vacuity report not present in this checkout (structural validation passed).');
    process.exit(0);
  }

  const { entries: fresh } = deriveFromReport(reportPath);
  if (SIMULATE_ADD) fresh[SIMULATE_ADD] = { property_file: `${SIMULATE_ADD}.proptest.mjs`, mutants_valid: 1, oracle_kills: 1, property_kills: 0, screen: 'SIMULATED' };

  const committedKeys = new Set(Object.keys(committed.entries));
  const freshKeys = Object.keys(fresh);

  const additions = freshKeys.filter((k) => !committedKeys.has(k));
  if (additions.length > 0) {
    fail(`ratchet: ${additions.length} kernel(s) ADDED vs the committed backlog (counts only go down): ${additions.slice(0, 10).join(', ')}${additions.length > 10 ? ' …' : ''} — a new property that kills nothing must be dispositioned deliberately, never drift in`);
  }

  const removalsCited = new Map(committed.removals.map((r) => [r.kernel, r]));
  const unexplainedRemovals = [...committedKeys].filter((k) => !(k in fresh) && !removalsCited.has(k));
  if (unexplainedRemovals.length > 0) {
    fail(`ratchet: ${unexplainedRemovals.length} committed entr(ies) absent from the fresh screen without a removal record: ${unexplainedRemovals.slice(0, 10).join(', ')} — removal requires >= 1 property-attributed kill cited with a screen id`);
  }

  console.log(`gen-property-vacuity-backlog: OK — ${committedKeys.size} committed entr(ies), ${freshKeys.length} in fresh screen, ${additions.length} addition(s), ${unexplainedRemovals.length} unexplained removal(s).`);
  process.exit(0);
}

main();
