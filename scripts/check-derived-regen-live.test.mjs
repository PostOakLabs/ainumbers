/**
 * scripts/check-derived-regen-live.test.mjs — paired self-test for
 * check-derived-regen-live.mjs (DERIVED-SET-SELFTEST-1, SO #40b pairing).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * SO #40b: a checker proven only by "the current repo passes" proves nothing —
 * it would stay green if its own logic were gutted. Each case below reproduces
 * one of the three mined incident SHAPES as a tiny synthetic git fixture, shows
 * the checker RED against the broken shape, then GREEN once the shape is fixed
 * — a mutation control, not a snapshot assertion.
 *
 *   CLASS A (no-write)  — the kernel-index incident: a regen command whose
 *                          literal text omits the flag its generator needs to
 *                          actually write (FINDINGS-HELD line 47).
 *   CLASS B (escape)    — the chaingraph.meta.json / docs/catalog.json
 *                          incident: a generator writes a path its entry never
 *                          declared, escaping the anti-escape guard (SO #47).
 *   CLASS C (duplicate) — the fv-explainer.html incident: one entry lists the
 *                          same path twice in its own artifacts[] (a pure
 *                          authoring typo, distinct from the legitimate
 *                          cross-entry sharing — chain-index/chaingraph-hub,
 *                          counts/debt-ledger — check-derived-declare-parity.mjs
 *                          already treats as advisory).
 *   --changed scoping   — DERIVED-SET-SELFTEST-HOOK-SCOPE-1: entry selection
 *                          for the hook/pre-push leg. A touched generator/gate
 *                          script selects exactly its entry; a touched
 *                          unrelated file selects nothing and PRINTS the skip
 *                          reason; a touched derived-artifacts.mjs (or the
 *                          gate's own script/test) selects ALL; two entries
 *                          sharing one command still run it once; and a RED
 *                          control proves a selection that MISSES a touched
 *                          generator fails this file.
 *
 * Fixtures are synthetic, throwaway git repos under os.tmpdir() — nothing
 * under this repo's REPO is ever touched, and the real COVERED list is never
 * consulted here (that would make this a snapshot test, not a mutation
 * control — see check-derived-declare-parity.test.mjs's own header for the
 * same reasoning applied to its sibling gate).
 *
 * Run: node scripts/check-derived-regen-live.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, utimesSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLiveScan, withinEntryDuplicates, crossEntryShares, selectCoveredByDiff, changedSelectionLines,
  parseWorktreePorcelain, staleScratchWorktrees, sweepStaleScratch, hostStateLine, withScratchWorktree, ScratchSetupError } from './check-derived-regen-live.mjs';
import { gitEnv } from './_git-env-lib.mjs';

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    failures.push(`${name}\n      ${e.message}`);
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── fixture repo builder ────────────────────────────────────────────────────
// A real git repo (not a bare directory) — runLiveScan needs `git status` and
// `git checkout` to behave, so a synthetic in-memory tree cannot stand in.
// GIT_EXEC_OPTS uses gitEnv() (GIT-ENV-LEAK-SWEEP-1; was cleanGitEnv() re-exported by the module
// under test, now the estate-wide helper directly) — running this file FROM a pre-push hook
// inherits GIT_DIR/GIT_INDEX_FILE pointing at the OUTER repo, which silently redirected every git
// call below at the wrong repository ("fatal: this operation must be run in a work tree",
// reproduced by exporting GIT_DIR before running this file directly).
// Identity is unchanged for the fixture: `git config user.email/user.name` are set on the repo
// below, so commits here never depended on inherited GIT_AUTHOR_*/GIT_COMMITTER_* to begin with.
const GIT_EXEC_OPTS = { stdio: ['ignore', 'pipe', 'pipe'], env: gitEnv() };
const roots = [];
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'derived-regen-selftest-'));
  roots.push(dir);
  execSync('git init -q', { cwd: dir, ...GIT_EXEC_OPTS });
  execSync('git config user.email test@test.local', { cwd: dir, ...GIT_EXEC_OPTS });
  execSync('git config user.name selftest', { cwd: dir, ...GIT_EXEC_OPTS });
  return dir;
}
function commit(dir, msg) {
  // stdio: 'pipe' — Windows autocrlf prints a harmless LF/CRLF advisory to
  // stderr on `add`; suppressed here so a green run stays quiet.
  execSync('git add -A', { cwd: dir, ...GIT_EXEC_OPTS });
  execSync(`git commit -q -m "${msg}"`, { cwd: dir, ...GIT_EXEC_OPTS });
}
process.on('exit', () => {
  for (const r of roots) { try { rmSync(r, { recursive: true, force: true }); } catch { /* best effort */ } }
});

console.log('check-derived-regen-live.test.mjs');

// ── CLASS A: the kernel-index shape — regen omits the flag its generator needs ─
// kernel-index's REAL entry carries a `gate` (`gen-index.mjs --check`), so these
// fixtures carry a `check.mjs` too — a whole-file comparison that CAN see the
// probe byte, which is what routes the finding to CLASS A rather than
// UNVERIFIABLE (see the disambiguation tests further down for the gate-absent
// and gate-blind cases specifically).
test('CLASS A RED - a regen command missing its required write flag is caught as no-write', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen.mjs'), `
    import { writeFileSync } from 'node:fs';
    if (process.argv.includes('--write')) writeFileSync('out.json', '{"regenerated":true}\\n');
  `);
  writeFileSync(join(dir, 'check.mjs'), `
    import { readFileSync } from 'node:fs';
    process.exit(readFileSync('out.json', 'utf8') === '{"regenerated":true}\\n' ? 0 : 1);
  `);
  writeFileSync(join(dir, 'out.json'), '{}\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-a', regen: 'node gen.mjs', gate: 'node check.mjs', artifacts: ['out.json'] }; // ⛔ missing --write, on purpose
  const { classA, unverifiable, executionFailures } = runLiveScan({ dir, covered: [entry] });
  assert(executionFailures.length === 0, `regen should exit 0 even when it no-ops: ${JSON.stringify(executionFailures)}`);
  assert(unverifiable.length === 0, `a gated entry must never fall back to UNVERIFIABLE, got ${JSON.stringify(unverifiable)}`);
  assert(classA.length === 1 && classA[0].id === 'fixture-a', `expected exactly one CLASS A finding for fixture-a, got ${JSON.stringify(classA)}`);
});

test('CLASS A GREEN - the same generator with the flag present is NOT flagged', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen.mjs'), `
    import { writeFileSync } from 'node:fs';
    if (process.argv.includes('--write')) writeFileSync('out.json', '{"regenerated":true}\\n');
  `);
  writeFileSync(join(dir, 'check.mjs'), `
    import { readFileSync } from 'node:fs';
    process.exit(readFileSync('out.json', 'utf8') === '{"regenerated":true}\\n' ? 0 : 1);
  `);
  writeFileSync(join(dir, 'out.json'), '{}\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-a', regen: 'node gen.mjs --write', gate: 'node check.mjs', artifacts: ['out.json'] }; // fixed
  const { classA, executionFailures } = runLiveScan({ dir, covered: [entry] });
  assert(executionFailures.length === 0, `regen should exit 0: ${JSON.stringify(executionFailures)}`);
  assert(classA.length === 0, `expected no CLASS A finding once --write is present, got ${JSON.stringify(classA)}`);
});

// ── CLASS A disambiguation — no gate at all: the regen_catalog.py shape ────────
// `catalog` (COVERED, `gate: null`) has no --check to ask, so a no-op read here
// must be reported as its own UNVERIFIABLE state, never assumed a defect.
test('UNVERIFIABLE - an entry with no gate at all gets its own state, not an assumed CLASS A', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen.mjs'), `// deliberately writes nothing, no --write support, and NO gate to ask\n`);
  writeFileSync(join(dir, 'out.json'), '{}\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-ungated', regen: 'node gen.mjs', artifacts: ['out.json'] }; // no `gate` field at all
  const { classA, unverifiable, executionFailures } = runLiveScan({ dir, covered: [entry] });
  assert(executionFailures.length === 0, `regen should exit 0: ${JSON.stringify(executionFailures)}`);
  assert(classA.length === 0, `an ungated no-op must not be assumed a defect, got ${JSON.stringify(classA)}`);
  assert(unverifiable.length === 1 && unverifiable[0].id === 'fixture-ungated',
    `expected exactly one UNVERIFIABLE finding, got ${JSON.stringify(unverifiable)}`);
});

// ── CLASS A disambiguation — the gen-start-index shape: a skip-if-unchanged
//    generator whose freshness comparison is scoped to a region the probe byte
//    never touches, so its own --check reports the corrupted tree clean. That
//    is a probe-method blind spot, never a defect, and must not be reported
//    as one — measured live against gen-start-index.mjs before this branch
//    existed (it printed "already fresh" against a corrupted start.html).
test('PROBE-BLIND - a gate that also cannot see the probe byte is reported informationally, not as CLASS A', () => {
  const dir = makeRepo();
  // check.mjs and gen.mjs both read ONLY the first line of target.txt — the
  // probe byte (appended at the very end) is invisible to both, exactly like
  // a marker-region generator whose gate reads a substring, not the whole file.
  writeFileSync(join(dir, 'gen.mjs'), `
    import { readFileSync, writeFileSync } from 'node:fs';
    const firstLine = readFileSync('target.txt', 'utf8').split('\\n')[0];
    if (firstLine !== 'MANAGED-VALUE') writeFileSync('target.txt', 'MANAGED-VALUE\\n');
    // else: already fresh by this generator's own definition — no write, by design
  `);
  writeFileSync(join(dir, 'check.mjs'), `
    import { readFileSync } from 'node:fs';
    const firstLine = readFileSync('target.txt', 'utf8').split('\\n')[0];
    process.exit(firstLine === 'MANAGED-VALUE' ? 0 : 1);
  `);
  writeFileSync(join(dir, 'target.txt'), 'MANAGED-VALUE\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-blind', regen: 'node gen.mjs', gate: 'node check.mjs', artifacts: ['target.txt'] };
  const { classA, probeBlind, executionFailures } = runLiveScan({ dir, covered: [entry] });
  assert(executionFailures.length === 0, `regen/gate should exit 0: ${JSON.stringify(executionFailures)}`);
  assert(classA.length === 0, `a probe the gate itself cannot see must NOT be reported as CLASS A, got ${JSON.stringify(classA)}`);
  assert(probeBlind.length === 1 && probeBlind[0].id === 'fixture-blind',
    `expected exactly one PROBE-BLIND finding, got ${JSON.stringify(probeBlind)}`);
});

test('CLASS A via gate disambiguation - a gate that DOES detect the drift, left unfixed by regen, is a genuine finding', () => {
  const dir = makeRepo();
  // check.mjs reads the WHOLE file (so it DOES see the probe byte); gen.mjs is
  // missing its own --write flag, same shape as the kernel-index fixture above,
  // but this time paired with a gate that can actually see the corruption.
  writeFileSync(join(dir, 'gen.mjs'), `
    import { writeFileSync } from 'node:fs';
    if (process.argv.includes('--write')) writeFileSync('target.txt', 'MANAGED-VALUE\\n');
  `);
  writeFileSync(join(dir, 'check.mjs'), `
    import { readFileSync } from 'node:fs';
    process.exit(readFileSync('target.txt', 'utf8') === 'MANAGED-VALUE\\n' ? 0 : 1);
  `);
  writeFileSync(join(dir, 'target.txt'), 'MANAGED-VALUE\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-gated-a', regen: 'node gen.mjs', gate: 'node check.mjs', artifacts: ['target.txt'] }; // ⛔ missing --write
  const { classA, probeBlind, executionFailures } = runLiveScan({ dir, covered: [entry] });
  assert(executionFailures.length === 0, `regen/gate should exit 0: ${JSON.stringify(executionFailures)}`);
  assert(probeBlind.length === 0, `the gate CAN see this corruption, it must not be reported as probe-blind, got ${JSON.stringify(probeBlind)}`);
  assert(classA.length === 1 && classA[0].id === 'fixture-gated-a', `expected exactly one CLASS A finding, got ${JSON.stringify(classA)}`);
});

// ── CLASS B: the chaingraph.meta.json shape — an undeclared path escapes ───────
test('CLASS B RED - a generator writing an undeclared path is caught as an escape', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen.mjs'), `
    import { writeFileSync } from 'node:fs';
    writeFileSync('declared.json', '{"regenerated":true}\\n');
    writeFileSync('undeclared.json', '{"escaped":true}\\n');
  `);
  writeFileSync(join(dir, 'declared.json'), '{}\n');
  commit(dir, 'init');

  // entry declares ONLY declared.json — undeclared.json is the escape, matching
  // the real chaingraph.meta.json incident (a write with no COVERED entry at all).
  const entry = { id: 'fixture-b', regen: 'node gen.mjs', artifacts: ['declared.json'] };
  const { classB, executionFailures } = runLiveScan({ dir, covered: [entry] });
  assert(executionFailures.length === 0, `regen should exit 0: ${JSON.stringify(executionFailures)}`);
  assert(classB.length === 1 && classB[0].path === 'undeclared.json',
    `expected one CLASS B finding naming undeclared.json, got ${JSON.stringify(classB)}`);
});

test('CLASS B GREEN - declaring the second path makes the same write clean', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen.mjs'), `
    import { writeFileSync } from 'node:fs';
    writeFileSync('declared.json', '{"regenerated":true}\\n');
    writeFileSync('also-declared.json', '{"regenerated":true}\\n');
  `);
  writeFileSync(join(dir, 'declared.json'), '{}\n');
  writeFileSync(join(dir, 'also-declared.json'), '{}\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-b', regen: 'node gen.mjs', artifacts: ['declared.json', 'also-declared.json'] }; // fixed
  const { classB, executionFailures } = runLiveScan({ dir, covered: [entry] });
  assert(executionFailures.length === 0, `regen should exit 0: ${JSON.stringify(executionFailures)}`);
  assert(classB.length === 0, `expected no CLASS B finding once both paths are declared, got ${JSON.stringify(classB)}`);
});

// ── CLASS B dependency-chain safety net: a CLASS A defect in entry N must not
//    make entry N+1 misreport an escape (the euc-register -> euc-register-page shape) ─
test('DEPENDENCY SAFETY - a no-write entry does not cascade into a false finding for the next entry', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen-a.mjs'), `// deliberately writes nothing, no --write support at all\n`);
  writeFileSync(join(dir, 'check-a.mjs'), `
    import { readFileSync } from 'node:fs';
    process.exit(readFileSync('a-out.json', 'utf8') === '{}\\n' ? 0 : 1); // "fresh" only means "still {}", so the probe byte trips it
  `);
  writeFileSync(join(dir, 'gen-b.mjs'), `
    import { writeFileSync } from 'node:fs';
    writeFileSync('b-out.json', '{"regenerated":true}\\n');
  `);
  writeFileSync(join(dir, 'a-out.json'), '{}\n');
  writeFileSync(join(dir, 'b-out.json'), '{}\n');
  commit(dir, 'init');

  const entries = [
    { id: 'a', regen: 'node gen-a.mjs', gate: 'node check-a.mjs', artifacts: ['a-out.json'] }, // no-write by construction, gated so it's a real CLASS A not UNVERIFIABLE
    { id: 'b', regen: 'node gen-b.mjs', artifacts: ['b-out.json'], after: 'a' },
  ];
  const { classA, classB, executionFailures } = runLiveScan({ dir, covered: entries });
  assert(executionFailures.length === 0, `both regens should exit 0: ${JSON.stringify(executionFailures)}`);
  assert(classA.length === 1 && classA[0].id === 'a', `expected exactly one CLASS A finding (entry a), got ${JSON.stringify(classA)}`);
  assert(classB.length === 0, `entry a's leftover probe byte must not misattribute to entry b, got ${JSON.stringify(classB)}`);
});

// ── TIMEOUT: the ORCH-332 shape — one regen command never returns ──────────────
// Before DERIVED-REGEN-LIVE-SELFTEST-TIMEOUT-1 the per-entry execSync carried no
// `timeout`, so a command blocked on the network, on a lock, or on stdin hung the
// whole gate (and the pre-push hook with it: ~4 % CPU for 20+ minutes, killed
// twice, with nothing in the log naming the culprit). The bound must (a) fire,
// (b) name the ENTRY, and (c) not stop the scan — the entries AFTER the hung one
// still get their verdicts.
//
// The hanging fixture reaps itself after 30 s instead of sleeping forever:
// execSync's timeout kills the shell, and on Windows the grandchild `node` can
// outlive that kill, so an unbounded sleep would orphan a process per run.
const HANG_SRC = 'setTimeout(() => process.exit(0), 30_000);\n';

test('TIMEOUT RED - a regen command that never returns is bounded, named and killed', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen-hang.mjs'), HANG_SRC);
  writeFileSync(join(dir, 'out.json'), '{}\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-hang', regen: 'node gen-hang.mjs', artifacts: ['out.json'] };
  // SO40B-SELFTEST-BUDGET-SCALE-1 (RULINGS 2026-10-21T23:55Z item 3, Tim's "A —
  // raise/scale budget"): every fixture budget in this file sits at a flat
  // 10 s floor so a probe's git+node child work survives concurrent FULL
  // preflights; the production default (180 s) is untouched.
  const HANG_KILL_BUDGET_MS = 10_000;
  const startedAt = Date.now();
  const { timeouts, executionFailures, classA } = runLiveScan({ dir, covered: [entry], timeoutMs: HANG_KILL_BUDGET_MS });
  const wallMs = Date.now() - startedAt;

  assert(timeouts.length === 1 && timeouts[0].id === 'fixture-hang',
    `expected exactly one TIMEOUT finding naming fixture-hang, got ${JSON.stringify(timeouts)}`);
  assert(timeouts[0].elapsedMs >= HANG_KILL_BUDGET_MS * 0.9, `the finding must report its elapsed time, got ${timeouts[0].elapsedMs} ms`);
  assert(wallMs < HANG_KILL_BUDGET_MS + 5_000, `the bound must actually cut the 30 s hang short, whole scan took ${wallMs} ms`);
  assert(executionFailures.length === 0, `a timeout is its own state, never an execution failure: ${JSON.stringify(executionFailures)}`);
  assert(classA.length === 0, `a timed-out probe is inconclusive for CLASS A, got ${JSON.stringify(classA)}`);
});

test('TIMEOUT - the scan continues past a hung entry so later entries still get verdicts', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen-hang.mjs'), HANG_SRC);
  writeFileSync(join(dir, 'gen-b.mjs'), `
    import { writeFileSync } from 'node:fs';
    writeFileSync('b-out.json', '{"regenerated":true}\\n');
    writeFileSync('undeclared.json', '{"escaped":true}\\n');
  `);
  writeFileSync(join(dir, 'a-out.json'), '{}\n');
  writeFileSync(join(dir, 'b-out.json'), '{}\n');
  commit(dir, 'init');

  const entries = [
    { id: 'hang', regen: 'node gen-hang.mjs', artifacts: ['a-out.json'] },
    { id: 'b', regen: 'node gen-b.mjs', artifacts: ['b-out.json'] },
  ];
  // SO40B-SELFTEST-BUDGET-SCALE-1 (RULINGS 2026-10-21T23:55Z item 3): 10 s is
  // the file-wide flat floor, still well under the 30 s hang it must cut short.
  const { timeouts, classB } = runLiveScan({ dir, covered: entries, timeoutMs: 10_000 });
  assert(timeouts.length === 1 && timeouts[0].id === 'hang', `expected the hang named once, got ${JSON.stringify(timeouts)}`);
  assert(classB.length === 1 && classB[0].id === 'b' && classB[0].path === 'undeclared.json',
    `entry b's escape must still be found after the hung entry, got ${JSON.stringify(classB)}`);
});

test('TIMEOUT GREEN - a command that finishes inside the bound is not flagged', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen.mjs'), `
    import { writeFileSync } from 'node:fs';
    writeFileSync('out.json', '{"regenerated":true}\\n');
  `);
  writeFileSync(join(dir, 'out.json'), '{}\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-fast', regen: 'node gen.mjs', artifacts: ['out.json'] };
  const { timeouts, executionFailures, classA } = runLiveScan({ dir, covered: [entry], timeoutMs: 60000 });
  assert(timeouts.length === 0, `a fast command must not be flagged as a timeout, got ${JSON.stringify(timeouts)}`);
  assert(executionFailures.length === 0, `regen should exit 0: ${JSON.stringify(executionFailures)}`);
  assert(classA.length === 0, `the write moved mtime, so no CLASS A: ${JSON.stringify(classA)}`);
});

test('TIMEOUT - a command that exits NON-ZERO fast is still an execution failure, not a timeout', () => {
  const dir = makeRepo();
  writeFileSync(join(dir, 'gen.mjs'), `process.exit(3); // broken regardless of any probe\n`);
  writeFileSync(join(dir, 'out.json'), '{}\n');
  commit(dir, 'init');

  const entry = { id: 'fixture-broken', regen: 'node gen.mjs', artifacts: ['out.json'] };
  // The bound is not under test here, only the exit-code classification. Under
  // concurrent preflights node startup alone measured 3062 ms against the old
  // 1500 ms bound and the fast exit was misread as a TIMEOUT, so use the same
  // generous bound as the GREEN test.
  const { timeouts, executionFailures } = runLiveScan({ dir, covered: [entry], timeoutMs: 60000 });
  assert(timeouts.length === 0, `a fast non-zero exit is not a timeout, got ${JSON.stringify(timeouts)}`);
  assert(executionFailures.length === 1 && executionFailures[0].id === 'fixture-broken',
    `expected one execution failure, got ${JSON.stringify(executionFailures)}`);
});

// ── CLASS C: the fv-explainer.html shape — one entry lists a path twice ────────
test('CLASS C RED - a path listed twice within one entry\'s own artifacts[] is caught', () => {
  const covered = [{ id: 'fixture-c', regen: 'node gen.mjs', artifacts: ['x.html', 'y.html', 'x.html'] }];
  const findings = withinEntryDuplicates(covered);
  assert(findings.length === 1 && findings[0].path === 'x.html' && findings[0].count === 2,
    `expected one within-entry duplicate finding for x.html, got ${JSON.stringify(findings)}`);
});

test('CLASS C GREEN - removing the duplicate clears the finding', () => {
  const covered = [{ id: 'fixture-c', regen: 'node gen.mjs', artifacts: ['x.html', 'y.html'] }];
  const findings = withinEntryDuplicates(covered);
  assert(findings.length === 0, `expected no within-entry duplicate finding, got ${JSON.stringify(findings)}`);
});

test('CLASS C — cross-entry sharing is NOT a within-entry duplicate (legitimate marker-region pattern)', () => {
  const covered = [
    { id: 'writer-1', regen: 'node gen1.mjs', artifacts: ['shared.html'] },
    { id: 'writer-2', regen: 'node gen2.mjs', artifacts: ['shared.html'] },
  ];
  const hard = withinEntryDuplicates(covered);
  const info = crossEntryShares(covered);
  assert(hard.length === 0, `two DIFFERENT entries sharing a path must not be a hard within-entry finding, got ${JSON.stringify(hard)}`);
  assert(info.length === 1 && info[0].path === 'shared.html' && info[0].ids.length === 2,
    `expected one informational cross-entry share for shared.html, got ${JSON.stringify(info)}`);
});

// ── --changed entry scoping: DERIVED-SET-SELFTEST-HOOK-SCOPE-1 ────────────────
// The selection runs against synthetic repos whose always-run triggers use the
// REAL production path names (scripts/derived-artifacts.mjs, this gate's own
// script and test), so the all-mode rules are exercised exactly as the CLI
// names them, never a paraphrase (SO #34).
function makeSelectionRepo() {
  const dir = makeRepo();
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts/derived-artifacts.mjs'), '// fixture manifest\n');
  writeFileSync(join(dir, 'scripts/check-derived-regen-live.mjs'), '// fixture copy of the gate itself\n');
  writeFileSync(join(dir, 'scripts/check-derived-regen-live.test.mjs'), '// fixture copy of the gate test\n');
  writeFileSync(join(dir, 'gen-a.mjs'), "import { writeFileSync } from 'node:fs';\nwriteFileSync('a.json', '{\"regenerated\":true}\\n');\n");
  writeFileSync(join(dir, 'gen-b.mjs'), "import { writeFileSync } from 'node:fs';\nwriteFileSync('b.json', '{\"regenerated\":true}\\n');\n");
  writeFileSync(join(dir, 'gen-shared.mjs'), "import { appendFileSync, writeFileSync } from 'node:fs';\nappendFileSync(process.env.DERIVED_REGEN_LIVE_SELFTEST_RUNS, process.argv[2] + '\\n');\nwriteFileSync(process.argv[2], '{\"regenerated\":true}\\n');\n");
  writeFileSync(join(dir, 'check-a.mjs'), "import { readFileSync } from 'node:fs';\nprocess.exit(readFileSync('a.json', 'utf8') === '{\"regenerated\":true}\\n' ? 0 : 1);\n");
  writeFileSync(join(dir, 'a.json'), '{}\n');
  writeFileSync(join(dir, 'b.json'), '{}\n');
  writeFileSync(join(dir, 'shared.json'), '{}\n');
  writeFileSync(join(dir, 'unrelated.txt'), 'nothing any entry declares\n');
  commit(dir, 'base');
  return dir;
}
function selectionCovered() {
  return [
    { id: 'fixture-sel-a', regen: 'node gen-a.mjs', gate: 'node check-a.mjs', artifacts: ['a.json'] },
    { id: 'fixture-sel-b', regen: 'node gen-b.mjs', artifacts: ['b.json'] },
    { id: 'fixture-sel-shared-1', regen: 'node gen-shared.mjs shared.json', artifacts: ['shared.json'] },
    { id: 'fixture-sel-shared-2', regen: 'node gen-shared.mjs shared.json --second-entry', artifacts: ['shared.json'] },
  ];
}
function headSha(dir) {
  return execSync('git rev-parse HEAD', { cwd: dir, ...GIT_EXEC_OPTS }).toString().trim();
}
function assertSelects(selection, expectedIds, msg) {
  const got = selection.selected.map((e) => e.id).sort().join(',');
  const want = [...expectedIds].sort().join(',');
  if (got !== want) throw new Error(`${msg}: expected selected=[${want || '(none)'}], got [${got || '(none)'}] (mode=${selection.mode}, skipped=[${selection.skipped.join(',')}])`);
}

test('CHANGED GREEN (a) - a change to a generator script selects exactly its entry', () => {
  const dir = makeSelectionRepo();
  const base = headSha(dir);
  writeFileSync(join(dir, 'gen-a.mjs'), "// touched by the diff\nimport { writeFileSync } from 'node:fs';\nwriteFileSync('a.json', '{\"regenerated\":true}\\n');\n");
  commit(dir, 'touch generator');
  const sel = selectCoveredByDiff({ repoPath: dir, baseRef: base, covered: selectionCovered() });
  assert(sel.mode === 'subset', `a generator-only diff must scope, got mode=${sel.mode} (${sel.reason})`);
  assertSelects(sel, ['fixture-sel-a'], 'generator script touched');
});

test('CHANGED GREEN (b) - a change to an unrelated file selects nothing and PRINTS the skipped reason', () => {
  const dir = makeSelectionRepo();
  const base = headSha(dir);
  writeFileSync(join(dir, 'unrelated.txt'), 'still nothing any entry declares\n');
  commit(dir, 'touch unrelated');
  const sel = selectCoveredByDiff({ repoPath: dir, baseRef: base, covered: selectionCovered() });
  assertSelects(sel, [], 'unrelated file touched');
  assert(sel.skipped.length === 4, `every entry must be named as skipped, got ${JSON.stringify(sel.skipped)}`);
  const lines = changedSelectionLines({ baseRef: base, selection: sel });
  const skippedLine = lines.find((l) => l.includes('skipped '));
  assert(skippedLine && skippedLine.includes(sel.reason) && skippedLine.includes('CI still runs the full live scan'),
    `the printed skipped line must carry the skip reason and the CI backstop, got ${JSON.stringify(lines)}`);
});

test('CHANGED GREEN (c) - a change to derived-artifacts.mjs selects ALL entries (the gate own scripts too)', () => {
  const dir = makeSelectionRepo();
  const base = headSha(dir);
  writeFileSync(join(dir, 'scripts/derived-artifacts.mjs'), '// fixture manifest, touched\n');
  commit(dir, 'touch manifest');
  const sel = selectCoveredByDiff({ repoPath: dir, baseRef: base, covered: selectionCovered() });
  assert(sel.mode === 'all', `a manifest diff must select all, got mode=${sel.mode}`);
  assertSelects(sel, ['fixture-sel-a', 'fixture-sel-b', 'fixture-sel-shared-1', 'fixture-sel-shared-2'], 'manifest touched');
  assert(changedSelectionLines({ baseRef: base, selection: sel })[0].includes('running ALL 4'), 'the printed line must say ALL entries run');
  // Same widening for the gate's OWN script or test (DERIVED-SET-SELFTEST-TRIGGER-1's
  // reasoning: a diff that changes the verdict machinery re-proves every entry).
  for (const gateOwn of ['scripts/check-derived-regen-live.mjs', 'scripts/check-derived-regen-live.test.mjs']) {
    const dir2 = makeSelectionRepo();
    const base2 = headSha(dir2);
    writeFileSync(join(dir2, gateOwn), readFileSync(join(dir2, gateOwn), 'utf8') + '// touched\n');
    commit(dir2, 'touch gate own');
    const sel2 = selectCoveredByDiff({ repoPath: dir2, baseRef: base2, covered: selectionCovered() });
    assert(sel2.mode === 'all', `${gateOwn} touched must select all, got mode=${sel2.mode}`);
    assertSelects(sel2, ['fixture-sel-a', 'fixture-sel-b', 'fixture-sel-shared-1', 'fixture-sel-shared-2'], `${gateOwn} touched`);
  }
});

test('CHANGED GREEN (d) - two entries sharing one command run it exactly ONCE over the selected set', () => {
  const dir = makeSelectionRepo();
  const base = headSha(dir);
  writeFileSync(join(dir, 'gen-shared.mjs'), "// touched by the diff\nimport { appendFileSync, writeFileSync } from 'node:fs';\nappendFileSync(process.env.DERIVED_REGEN_LIVE_SELFTEST_RUNS, process.argv[2] + '\\n');\nwriteFileSync(process.argv[2], '{\"regenerated\":true}\\n');\n");
  commit(dir, 'touch shared generator');
  const sel = selectCoveredByDiff({ repoPath: dir, baseRef: base, covered: selectionCovered() });
  assertSelects(sel, ['fixture-sel-shared-1', 'fixture-sel-shared-2'], 'shared generator touched');
  // The counted-generator log lives OUTSIDE the fixture repo (an in-repo log
  // would be an undeclared write, i.e. CLASS B) - same pattern as the
  // --self-test fixture in check-derived-regen-live.mjs.
  const runsLog = join(tmpdir(), `derived-regen-live-changedtest-runs-${process.pid}.log`);
  process.env.DERIVED_REGEN_LIVE_SELFTEST_RUNS = runsLog;
  try {
    const res = runLiveScan({ dir, covered: sel.selected, timeoutMs: 60_000 });
    const runs = existsSync(runsLog) ? readFileSync(runsLog, 'utf8').split('\n').filter(Boolean) : [];
    assert(runs.filter((r) => r === 'shared.json').length === 1,
      `two entries sharing one command must execute exactly ONE probe cycle over the selected set, got runs=${JSON.stringify(runs)}`);
    assert(![...res.classA, ...res.classB, ...res.executionFailures, ...res.timeouts]
      .some((f) => String(f.id).startsWith('fixture-sel-shared')),
      `the shared entries must stay clean, got ${JSON.stringify([res.classA, res.classB, res.executionFailures])}`);
  } finally {
    delete process.env.DERIVED_REGEN_LIVE_SELFTEST_RUNS;
    try { rmSync(runsLog, { force: true }); } catch { /* best effort */ }
  }
});

test('CHANGED RED CONTROL (e) - a selection that MISSES a touched generator fails this file', () => {
  // SO #34c: proves the (a) assertion is not vacuous. Feed assertSelects the
  // selection a BROKEN --changed implementation would produce for the (a)
  // fixture - one that misses the touched generator - and it must THROW. If a
  // future edit to selectCoveredByDiff stops selecting a touched generator,
  // test (a) fails through this same path.
  const broken = { mode: 'subset', reason: 'no regen/gate script or declared artifact of these entries appears in the diff', selected: [], skipped: ['fixture-sel-a', 'fixture-sel-b', 'fixture-sel-shared-1', 'fixture-sel-shared-2'] };
  let threw = false;
  try { assertSelects(broken, ['fixture-sel-a'], 'RED control'); } catch { threw = true; }
  assert(threw, 'assertSelects must FAIL when the selection misses a touched generator - this file would go red');
});

// ── scratch-setup hardening (DERIVED-REGEN-LIVE-HARDEN-1) ────────────────────
// The three guards in withScratchWorktree: a bounded `git worktree add` that
// FAILS on timeout, a sweep of stale scratch worktrees by exact name + age, and
// a host-state line. Every real-git case runs against a FIXTURE repo, so the
// real repo's worktree list is never read or changed by this file.

const HOUR = 3_600_000;
const normWt = (p) => p.replace(/\\/g, '/').toLowerCase();

test('SCRATCH parse - porcelain worktree list yields paths and the locked flag', () => {
  const text = [
    'worktree C:/repo', 'HEAD abc', 'branch refs/heads/main', '',
    'worktree C:/Temp/derived-regen-live-AbC123', 'HEAD def', 'detached', 'locked', '',
    'worktree C:/Temp/derived-regen-live-XyZ789', 'HEAD 012', 'detached', 'locked reason here', '',
    'worktree C:/Temp/derived-regen-live-Qq1111', 'HEAD 345', 'detached', '',
  ].join('\n');
  const got = parseWorktreePorcelain(text);
  assert(got.length === 4, `4 entries expected, got ${got.length}`);
  assert(got[1].locked === true && got[2].locked === true, 'both `locked` forms must set locked');
  assert(got[0].locked === false && got[3].locked === false, 'unlocked entries stay unlocked');
});

test('SCRATCH select - only unlocked, exactly-named, old scratch directly under tmp is stale', () => {
  const tmp = tmpdir();
  const now = 100 * HOUR;
  const old = now - 10 * HOUR;
  const fresh = now - 1 * HOUR;
  const p = (name) => join(tmp, name);
  const ages = new Map([
    [p('derived-regen-live-OLD111'), old],
    [p('derived-regen-live-NEW222'), fresh],
    [p('derived-regen-live-LCK333'), old],
    [p('derived-regen-live-selftest-ABC444'), old],
    [p('derived-regen-live-UNK555'), null],
    [join(tmp, 'nested', 'derived-regen-live-NST666'), old],
    [p('my-own-worktree'), old],
  ]);
  const entries = [...ages.keys()].map((path) => ({ path, locked: path.endsWith('LCK333') }));
  const stale = staleScratchWorktrees({ entries, tmp, now, maxAgeMs: 6 * HOUR, ageOf: (x) => ages.get(x) });
  const names = stale.map((e) => e.path);
  assert(names.length === 1 && names[0].endsWith('derived-regen-live-OLD111'), `only OLD111 may be stale, got ${JSON.stringify(names)}`);
  // RED control: the same matrix with a bound longer than every age selects nothing.
  assert(staleScratchWorktrees({ entries, tmp, now, maxAgeMs: 1000 * HOUR, ageOf: (x) => ages.get(x) }).length === 0,
    'a bound longer than every age must select nothing');
  if (process.platform === 'win32') {
    // git prints forward slashes and may differ in drive-letter case from os.tmpdir().
    const gitStyle = tmp.replace(/\\/g, '/').toUpperCase() + '/derived-regen-live-OLD111';
    assert(staleScratchWorktrees({ entries: [{ path: gitStyle, locked: false }], tmp, now, maxAgeMs: 6 * HOUR, ageOf: () => old }).length === 1,
      'on Windows a forward-slash, case-different tmp path must still match');
  }
});

test('SCRATCH sweep - removes an OLD leftover scratch worktree and keeps a fresh one (real git, fixture repo)', () => {
  const repo = makeRepo();
  writeFileSync(join(repo, 'a.txt'), 'a\n');
  commit(repo, 'init');
  const oldWt = mkdtempSync(join(tmpdir(), 'derived-regen-live-'));
  const freshWt = mkdtempSync(join(tmpdir(), 'derived-regen-live-'));
  roots.push(oldWt, freshWt);
  // mkdtemp leaves an empty dir; `worktree add` accepts an empty existing dir.
  execSync(`git worktree add --detach "${oldWt}" HEAD`, { cwd: repo, ...GIT_EXEC_OPTS });
  execSync(`git worktree add --detach "${freshWt}" HEAD`, { cwd: repo, ...GIT_EXEC_OPTS });
  const tenHoursAgo = new Date(Date.now() - 10 * HOUR);
  utimesSync(join(oldWt, '.git'), tenHoursAgo, tenHoursAgo);
  const lines = [];
  // RED control first: a bound longer than the planted age removes nothing.
  const none = sweepStaleScratch({ repo, maxAgeMs: 100 * HOUR, log: (l) => lines.push(l) });
  assert(none.removed.length === 0, `a 100 h bound must remove nothing, removed ${JSON.stringify(none.removed)}`);
  const res = sweepStaleScratch({ repo, maxAgeMs: 6 * HOUR, log: (l) => lines.push(l) });
  assert(res.removed.length === 1 && res.failed.length === 0, `exactly one removal expected, got ${JSON.stringify({ removed: res.removed, failed: res.failed })}`);
  const left = normWt(execSync('git worktree list --porcelain', { cwd: repo, ...GIT_EXEC_OPTS }).toString('utf8'));
  assert(!left.includes(normWt(oldWt)), 'the old scratch worktree must no longer be registered');
  assert(left.includes(normWt(freshWt)), 'the fresh scratch worktree must stay registered');
  assert(lines.some((l) => l.includes('removed 1 of 1')), `the sweep must log what it removed, got ${JSON.stringify(lines)}`);
  execSync(`git worktree remove --force "${freshWt}"`, { cwd: repo, ...GIT_EXEC_OPTS });
});

test('SCRATCH setup GREEN - withScratchWorktree hands fn a checked-out tree and unregisters it after', () => {
  const repo = makeRepo();
  writeFileSync(join(repo, 'a.txt'), 'a\n');
  commit(repo, 'init');
  const lines = [];
  const seen = withScratchWorktree((dir) => existsSync(join(dir, 'a.txt')), { repo, log: (l) => lines.push(l) });
  assert(seen === true, 'fn must see the committed file in the scratch tree');
  const left = parseWorktreePorcelain(execSync('git worktree list --porcelain', { cwd: repo, ...GIT_EXEC_OPTS }).toString('utf8'));
  assert(left.length === 1, `only the main worktree may remain registered, got ${left.length}`);
  assert(lines.some((l) => l.startsWith('host state: free RAM')), `the host-state line must print before setup, got ${JSON.stringify(lines)}`);
});

test('SCRATCH setup RED - a hung `worktree add` FAILS within its bound as a host-state error, fn never runs', () => {
  const repo = makeRepo();
  writeFileSync(join(repo, 'a.txt'), 'a\n');
  commit(repo, 'init');
  let fnRan = false;
  let err = null;
  const t0 = Date.now();
  try {
    // The stand-in reaps itself after 20 s: on Windows a grandchild can outlive
    // execSync's kill (same reason as the --self-test hang fixture).
    withScratchWorktree(() => { fnRan = true; }, {
      repo,
      addTimeoutMs: 1500,
      addCommand: 'node -e "setTimeout(() => process.exit(0), 20000)"',
      log: () => {},
    });
  } catch (e) { err = e; }
  const wall = Date.now() - t0;
  assert(err instanceof ScratchSetupError, `a ScratchSetupError must be thrown, got ${err && err.constructor.name}: ${err && err.message}`);
  assert(/HOST-STATE/.test(err.message) && /exceeded 2 s/.test(err.message), `the message must name the bound and host state, got: ${err.message}`);
  assert(!fnRan, 'fn must never run when setup failed');
  assert(wall < 15_000, `the bound must cut the hang short, wall was ${wall} ms`);
});

test('SCRATCH host line - flags RAM below the 4 GB gate and only then', () => {
  const low = hostStateLine({ freeBytes: 3.3 * 1024 ** 3, totalBytes: 16 * 1024 ** 3, scratchCount: 42, worktreeCount: 399 });
  const ok = hostStateLine({ freeBytes: 5.5 * 1024 ** 3, totalBytes: 16 * 1024 ** 3, scratchCount: 0, worktreeCount: 12 });
  assert(low.includes('BELOW the 4 GB gate') && low.includes('399') && low.includes('42'), `low line wrong: ${low}`);
  assert(!ok.includes('BELOW'), `a 5.5 GB line must not warn: ${ok}`);
});

console.log(`\ncheck-derived-regen-live.test.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
