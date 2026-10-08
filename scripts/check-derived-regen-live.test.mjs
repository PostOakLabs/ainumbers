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
 *
 * Fixtures are synthetic, throwaway git repos under os.tmpdir() — nothing
 * under this repo's REPO is ever touched, and the real COVERED list is never
 * consulted here (that would make this a snapshot test, not a mutation
 * control — see check-derived-declare-parity.test.mjs's own header for the
 * same reasoning applied to its sibling gate).
 *
 * Run: node scripts/check-derived-regen-live.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLiveScan, withinEntryDuplicates, crossEntryShares } from './check-derived-regen-live.mjs';
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
  const startedAt = Date.now();
  const { timeouts, executionFailures, classA } = runLiveScan({ dir, covered: [entry], timeoutMs: 1500 });
  const wallMs = Date.now() - startedAt;

  assert(timeouts.length === 1 && timeouts[0].id === 'fixture-hang',
    `expected exactly one TIMEOUT finding naming fixture-hang, got ${JSON.stringify(timeouts)}`);
  assert(timeouts[0].elapsedMs >= 1350, `the finding must report its elapsed time, got ${timeouts[0].elapsedMs} ms`);
  assert(wallMs < 15000, `the bound must actually cut the 30 s hang short, whole scan took ${wallMs} ms`);
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
  const { timeouts, classB } = runLiveScan({ dir, covered: entries, timeoutMs: 1500 });
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
  const { timeouts, executionFailures } = runLiveScan({ dir, covered: [entry], timeoutMs: 1500 });
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

// ── CROSS-INSTANCE SCAN MUTEX (REGEN-CHECK-CONCURRENCY-HEAL-1) ────────────────
// The CLI serializes concurrent live scans on a mkdir-lock in the repo's
// COMMON git dir (two builders' suites push the same repo from different
// worktrees and collide exactly there). These fixtures drive that mutex
// directly against throwaway tmpdir lock dirs — no repo, no generators, no
// scratch worktrees — with injectable clocks/probes so the shapes run in
// milliseconds: free acquire, live-owner wait (never stolen young), dead-owner
// steal, ownerless-young wait, and a release that never deletes a successor's
// lock. The production kill shape these guard against is the harness
// exit-137 mid-scan: its owner.json names a pid that no longer exists, and a
// waiter that could not detect that would wait forever — the exact
// "several at cpu=0s, all parents alive" freeze this row heals.
import { spawn } from 'node:child_process';
import { withScanLock, readLockOwner, isPidAlive } from './check-derived-regen-live.mjs';

function lockFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'derived-regen-lock-'));
  roots.push(dir);
  return join(dir, 'scan.lock');
}

/** A pid proven dead: spawn `node -e ""` and poll until the OS reaps it. */
function deadPidSync() {
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  const deadline = Date.now() + 10_000;
  while (isPidAlive(child.pid) && Date.now() < deadline) sleepTest(25);
  return child.pid;
}
function sleepTest(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

test('MUTEX GREEN - a free lock acquires, runs the body and releases', () => {
  const lockDir = lockFixture();
  const out = withScanLock(lockDir, () => 'ran', { pollMs: 20 });
  assert(out === 'ran', `the body must run under the lock, got ${JSON.stringify(out)}`);
  assert(!existsSync(lockDir), `the lock dir must be removed on release, still exists: ${lockDir}`);
});

test('MUTEX - a live owner is waited for and stolen only past the age bound, never young', () => {
  const lockDir = lockFixture();
  mkdirSync(lockDir);
  writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  const beats = [];
  const startedAt = Date.now();
  const out = withScanLock(lockDir, () => 'ran', {
    pollMs: 25, stealMs: 300, heartbeatMs: 100, isAlive: () => true,
    progress: (line) => beats.push(line),
  });
  const waitedMs = Date.now() - startedAt;
  assert(out === 'ran', `the body must run once the bound expires, got ${JSON.stringify(out)}`);
  assert(waitedMs >= 250, `a live young owner must be WAITED for (bound 300 ms), stolen after only ${waitedMs} ms`);
  assert(beats.some((l) => l.includes('waits its turn')), `a waiting heartbeat must be emitted, got ${JSON.stringify(beats)}`);
  assert(beats.some((l) => l.includes('steal')), `the age-bound steal must be announced, got ${JSON.stringify(beats)}`);
  assert(!existsSync(lockDir), 'the acquired lock must be released after the body');
});

test('MUTEX RED - a dead owner is stolen immediately instead of waited on forever', () => {
  const lockDir = lockFixture();
  const dead = deadPidSync();
  mkdirSync(lockDir);
  writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({ pid: dead, startedAt: new Date().toISOString() }));
  const beats = [];
  const startedAt = Date.now();
  const out = withScanLock(lockDir, () => 'ran', {
    pollMs: 25, stealMs: 10 * 60_000, isAlive: isPidAlive, progress: (line) => beats.push(line),
  });
  const waitedMs = Date.now() - startedAt;
  assert(out === 'ran', `the body must run after the steal, got ${JSON.stringify(out)}`);
  assert(waitedMs < 5_000, `a dead owner must be stolen at once (real stealMs bound in force), took ${waitedMs} ms`);
  assert(beats.some((l) => l.includes('owner is gone')), `the steal line must name the dead owner, got ${JSON.stringify(beats)}`);
  assert(!existsSync(lockDir), 'the lock must be released after the body');
});

test('MUTEX - an ownerless young lock is never stolen on sight, only on age', () => {
  const lockDir = lockFixture();
  mkdirSync(lockDir); // no owner.json — an acquirer between mkdir and its record write
  const beats = [];
  const startedAt = Date.now();
  const out = withScanLock(lockDir, () => 'ran', {
    pollMs: 25, stealMs: 300, isAlive: () => true, progress: (line) => beats.push(line),
  });
  const waitedMs = Date.now() - startedAt;
  assert(out === 'ran', `the body must run, got ${JSON.stringify(out)}`);
  assert(waitedMs >= 250, `an ownerless young lock must wait its bound, stolen after only ${waitedMs} ms`);
  assert(!existsSync(lockDir), 'the lock must be released after the body');
});

test('MUTEX - release never deletes a successor\u2019s lock', () => {
  const lockDir = lockFixture();
  const successor = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 8000)'], { stdio: 'ignore' });
  try {
    const out = withScanLock(lockDir, () => {
      // Simulate the mid-body steal-and-replace: a successor acquires the
      // lock while our body runs (its owner.json names a live pid — the
      // successor process spawned above).
      writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({ pid: successor.pid, startedAt: new Date().toISOString() }));
      return 'ran';
    }, { pollMs: 20 });
    assert(out === 'ran', `the body must run, got ${JSON.stringify(out)}`);
    assert(existsSync(lockDir), `a successor\u2019s lock must survive our release, gone: ${lockDir}`);
    assert(readLockOwner(lockDir)?.pid === successor.pid, 'the surviving lock must still name the successor');
  } finally {
    try { rmSync(lockDir, { recursive: true, force: true }); } catch { /* fixture cleanup */ }
  }
});

console.log(`\ncheck-derived-regen-live.test.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
