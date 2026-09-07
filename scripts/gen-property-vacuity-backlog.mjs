// gen-property-vacuity-backlog.mjs — build/check the property-vacuity backlog
// (PROPTEST-KILL-ATTRIBUTION-1; rebased onto VACUITY-SCREEN-3 by
// PROPTEST-BACKLOG-REBASE-1).
//
// WHAT: Derives repo/scripts/property-vacuity-backlog.json from a vacuity-screen
// report. Two modes:
//
//   legacy (VACUITY-SCREEN-2): a kernel is BACKLOGGED when its screen verdict is
//     ADEQUATE and EVERY KILLED mutant's first error line matches /ORACLE/i —
//     i.e. the property assertion itself never fired on a valid mutant; every
//     kill came from the fixture replay (the art-223 class). That heuristic
//     inferred "oracle-only" from the FIRST error line and overstated the
//     backlog at 156 kernels of 660.
//
//   verdicts (--from <report.json> --screen <id>, VACUITY-SCREEN-3 onward): a
//     kernel is BACKLOGGED when the runner's own PROPERTY-FAIL/ORACLE-FAIL
//     attribution tags give it verdict ORACLE-ONLY or VACUOUS — property_kills
//     is 0 for both classes. Report: scripts/fixtures/vacuity-screen-3.json
//     (copy of research/step-out/VACUITY-SCREEN-3.d/vacuity-report.json;
//     population 661 kernels → 34 ORACLE-ONLY + 2 VACUOUS + 17 HARNESS-FAIL).
//
// REMOVAL RULE (verdicts mode): a committed entry absent from the fresh
// ORACLE-ONLY/VACUOUS set may leave the backlog ONLY when the new screen shows
// property_kills >= 1 for it (a removal record citing the screen id is appended
// to `removals`). A committed entry the new screen could not classify because
// of HARNESS-FAIL stays, marked `screen_status: "harness-fail"`. Anything else
// is an illegal removal and fails the run.
//
// RATCHET (--check): the backlog only shrinks through evidence.
//   - ADDITION: a kernel present in a fresh regeneration but absent from the
//     committed file FAILS the check (a new property that kills nothing must be
//     dispositioned deliberately, not drift in).
//   - REMOVAL: a committed entry absent from the regeneration is allowed ONLY
//     via the removal rule above; `removals` must carry the record.
//
// USAGE:
//   node scripts/gen-property-vacuity-backlog.mjs --write   # (re)build the backlog
//   node scripts/gen-property-vacuity-backlog.mjs --check   # gate (preflight)
//   node scripts/gen-property-vacuity-backlog.mjs --check --simulate-add <id>
//       # RED drill: pretend a fresh screen produced one extra vacuous kernel
//   node scripts/gen-property-vacuity-backlog.mjs --from scripts/fixtures/vacuity-screen-3.json \
//        --screen VACUITY-SCREEN-3 --write   # verdicts-mode (re)build
//   node scripts/gen-property-vacuity-backlog.mjs --from <report.json> --screen <id> --check

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute } from 'node:path';
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
const fromIdx = argv.indexOf('--from');
const FROM = fromIdx !== -1 ? argv[fromIdx + 1] : null;
const screenIdx = argv.indexOf('--screen');
const SCREEN_ID = screenIdx !== -1 ? argv[screenIdx + 1] : null;

// Walk up from the repo root until research/step-out/<report> exists (the shared
// clone has it at workspace root; a worktree under repo/.wt/<name>/ finds the same
// workspace-root copy several levels up).
function findReport(rel) {
  let dir = REPO;
  for (;;) {
    const candidate = join(dir, ...rel);
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

function sortedByKernel(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort(collator.compare)) sorted[key] = obj[key];
  return sorted;
}

// Build the entry map from a SCREEN-2 report. Returns { entries, sourceCommit }.
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
  return { entries, sourceCommit: report.report_meta?.clone_commit || 'unknown' };
}

// Verdicts mode (SCREEN-3+): entries = kernels whose runner-attributed verdict
// is ORACLE-ONLY or VACUOUS. Also reconciles committed entries that the new
// screen no longer classifies as property-vacuous, per the removal rule.
function deriveVerdicts(reportPath, screenId, committed) {
  if (!screenId) fail('--from requires --screen <id>');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const clone = String(report.clone_commit || report.report_meta?.clone_commit || 'unknown');
  const tag = `${screenId} @ ${clone.slice(0, 8)}`;
  const kmap = new Map((report.kernels || []).map((k) => [k.kernel, k]));
  const entries = {};
  for (const k of report.kernels || []) {
    if (k.verdict !== 'ORACLE-ONLY' && k.verdict !== 'VACUOUS') continue;
    if ((k.property_kills || 0) !== 0) {
      fail(`kernel ${k.kernel}: verdict ${k.verdict} but property_kills=${k.property_kills} (report inconsistency)`);
    }
    entries[k.kernel] = {
      property_file: k.property_file,
      mutants_valid: (k.mutants || []).length - (k.mutants_invalid || 0),
      oracle_kills: k.oracle_kills || 0,
      property_kills: 0,
      magnitude_mutants_tried: k.magnitude_mutants_tried || 0,
      magnitude_mutants_killed_by_property: k.magnitude_mutants_killed_by_property || 0,
      screen: tag,
    };
  }
  const removals = [];
  const removed = [];
  if (committed) {
    for (const kernel of Object.keys(committed.entries || {})) {
      if (entries[kernel]) continue; // still property-vacuous per the new screen
      const f = kmap.get(kernel);
      if (f && f.verdict === 'HARNESS-FAIL') {
        // The screen could not classify it (control/mutant harness failure):
        // it stays, marked, until a clean screen dispositions it.
        entries[kernel] = { ...committed.entries[kernel], screen_status: 'harness-fail' };
      } else if (f && (f.property_kills || 0) >= 1) {
        removals.push({ kernel, screen: tag, property_kills: f.property_kills });
        removed.push(kernel);
      } else {
        fail(`illegal removal: committed entry ${kernel} is absent from the ${screenId} ORACLE-ONLY/VACUOUS set and the screen shows no property-attributed kill for it (verdict: ${f ? f.verdict : 'ABSENT from report'}); removal requires property_kills >= 1 or a HARNESS-FAIL carry-over`);
      }
    }
  }
  return { entries: sortedByKernel(entries), removals, removed, tag, clone };
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
    if ('screen_status' in e && e.screen_status !== 'harness-fail') fail(`entry ${kernel}: \`screen_status\` must be "harness-fail" when present`);
  }
  for (const r of backlog.removals) {
    if (!r.kernel || !r.screen) fail('removal record must cite `kernel` and `screen`');
    if (!(r.property_kills >= 1)) fail(`removal record for ${r.kernel}: removal requires >= 1 property-attributed kill cited with a screen id`);
  }
}

function resolveCommitted() {
  if (!existsSync(BACKLOG_PATH)) return null;
  return JSON.parse(readFileSync(BACKLOG_PATH, 'utf8'));
}

// Resolve the source report for a verdicts-mode committed backlog: prefer the
// in-repo fixtures copy (CI-checkout-able), fall back to the original research
// path walked up from the repo root.
function resolveVerdictsSource(meta) {
  const rel = meta?.source_report;
  if (!rel) return null;
  const inRepo = isAbsolute(rel) ? rel : join(REPO, rel);
  if (existsSync(inRepo)) return inRepo;
  const norm = rel.replace(/\\/g, '/').split('/');
  if (norm[0] === 'research') return findReport(norm.slice(1));
  return null;
}

function writeVerdicts(reportPath, screenId) {
  const committed = resolveCommitted();
  const { entries, removals, removed, tag, clone } = deriveVerdicts(reportPath, screenId, committed);
  const backlog = {
    _meta: {
      generator: 'scripts/gen-property-vacuity-backlog.mjs',
      mode: 'verdicts',
      source_report: isAbsolute(reportPath) ? reportPath : resolve(reportPath).slice(REPO.length + 1).replace(/\\/g, '/'),
      source_clone_commit: clone,
      screen: tag,
      row: 'PROPTEST-BACKLOG-REBASE-1',
    },
    entries,
    removals: [...(committed?.removals || []), ...removals],
  };
  validateCommitted(backlog);
  writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2) + '\n');
  console.log(`gen-property-vacuity-backlog: wrote ${Object.keys(entries).length} entr(ies) from ${tag} to ${BACKLOG_PATH}`);
  console.log(`gen-property-vacuity-backlog: removed ${removed.length} committed entr(ies) under the property_kills >= 1 rule: ${removed.length ? removed.join(', ') : '(none)'}`);
  process.exit(0);
}

function checkVerdicts(reportPath, screenId, committed) {
  const { entries: fresh, removals: freshRemovals } = deriveVerdicts(reportPath, screenId, committed);
  if (SIMULATE_ADD) {
    fresh[SIMULATE_ADD] = { property_file: `${SIMULATE_ADD}.proptest.mjs`, mutants_valid: 1, oracle_kills: 1, property_kills: 0, screen: 'SIMULATED' };
  }
  const expectedRemovals = [...(committed.removals || []), ...freshRemovals].sort((a, b) => collator.compare(a.kernel, b.kernel));
  const committedKeys = new Set(Object.keys(committed.entries));
  const freshKeys = Object.keys(fresh);
  const additions = freshKeys.filter((k) => !committedKeys.has(k));
  if (additions.length > 0) {
    fail(`ratchet: ${additions.length} kernel(s) ADDED vs the committed backlog (counts only go down): ${additions.slice(0, 10).join(', ')}${additions.length > 10 ? ' …' : ''} — a new property that kills nothing must be dispositioned deliberately, never drift in`);
  }
  const missingRemovals = expectedRemovals.filter((r) => !committed.removals.some((c) => c.kernel === r.kernel && c.screen === r.screen && c.property_kills === r.property_kills));
  if (missingRemovals.length > 0) {
    fail(`ratchet: ${missingRemovals.length} removal record(s) missing from the committed file: ${missingRemovals.map((r) => r.kernel).join(', ')}`);
  }
  console.log(`gen-property-vacuity-backlog: OK — ${committedKeys.size} committed entr(ies), ${freshKeys.length} in fresh screen, ${additions.length} addition(s), ${freshRemovals.length} removal(s) under the property_kills >= 1 rule.`);
  process.exit(0);
}

function main() {
  if (!WRITE && !CHECK) {
    console.error('usage: gen-property-vacuity-backlog.mjs --write | --check [--simulate-add <kernel-id>] [--from <vacuity-report.json> --screen <id>]');
    process.exit(2);
  }

  if (FROM) {
    const reportPath = isAbsolute(FROM) ? FROM : join(REPO, FROM);
    if (!existsSync(reportPath)) fail(`--from report not found at ${reportPath}`);
    if (WRITE) writeVerdicts(reportPath, SCREEN_ID);
    if (CHECK) {
      if (!existsSync(BACKLOG_PATH)) fail(`committed backlog missing at ${BACKLOG_PATH}; run --write`);
      const committed = resolveCommitted();
      validateCommitted(committed);
      checkVerdicts(reportPath, SCREEN_ID, committed);
    }
    return;
  }

  const committed = existsSync(BACKLOG_PATH) ? JSON.parse(readFileSync(BACKLOG_PATH, 'utf8')) : null;
  if (CHECK) {
    if (!committed) fail(`committed backlog missing at ${BACKLOG_PATH}; run --write`);
    validateCommitted(committed);
    if (committed._meta?.mode === 'verdicts') {
      const reportPath = resolveVerdictsSource(committed._meta);
      if (!reportPath) {
        console.log('gen-property-vacuity-backlog: SKIPPED regeneration ratchet — source vacuity report not present in this checkout (structural validation passed).');
        process.exit(0);
      }
      checkVerdicts(reportPath, String(committed._meta.screen).split(' @ ')[0], committed);
    }
    // legacy SCREEN-2 mode falls through
  }

  const reportPath = findReport(REPORT_REL);

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
      removals: committed?.removals || [],
    };
    validateCommitted(backlog);
    writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2) + '\n');
    console.log(`gen-property-vacuity-backlog: wrote ${Object.keys(entries).length} entr(ies) from ${screenTag(sourceCommit)} to ${BACKLOG_PATH}`);
    process.exit(0);
  }

  // --check (legacy mode)
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
