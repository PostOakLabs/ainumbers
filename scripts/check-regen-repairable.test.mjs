#!/usr/bin/env node
/**
 * scripts/check-regen-repairable.test.mjs — paired self-test for
 * check-regen-repairable.mjs (MERGEQUEUE-GATE-PARITY-1).
 *
 * SO #34: "verify a checker by MUTATION, not by reading it." Every case below is
 * a mutation of the world the probe observes, driven through the injectable
 * `exec` seam — no git, no worktree, no generators, so the whole suite runs in
 * milliseconds and cannot be perturbed by the estate's real freshness state.
 *
 * The load-bearing case is REGRESSION_ART99: the exact command behaviour measured
 * on the real PR #1477 fixture (restored from bec907ed^) —
 *     gate  -> exit 1  "1 stale entries (node no longer live)"
 *     regen -> exit 0  "wrote 0 changed entry file(s)"
 *     gate  -> exit 1  IDENTICAL
 * If a future edit ever lets that shape earn an advisory downgrade again, this
 * test goes red. That is the whole point: the incident was 15 hours of red main
 * produced by a green required check.
 */
import { probeRepairable, reportProbe, regenChain, selectEntries, FULL_REGEN_CMD, BINDING_CHECK_CMD, BINDING_ENTRY_ID, isRelaxedBindingContext } from './check-regen-repairable.mjs';
import { verifyRegenBinding } from './append-absence-lineage-record.mjs';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// A synthetic COVERED-shaped list. Deliberately NOT the real one: the probe must
// be correct as a function of its inputs, not of today's estate.
const FIXTURE = [
  { id: 'alpha', regen: 'REGEN_ALPHA', gate: 'GATE_ALPHA', artifacts: ['a.json'] },
  { id: 'beta', regen: 'REGEN_BETA', gate: 'GATE_BETA', artifacts: ['b.json'], after: 'alpha' },
  { id: 'gamma', regen: 'REGEN_GAMMA', gate: null, artifacts: ['c.json'] },
];

/**
 * Build an `exec` from a script: a map of command -> array of {ok, output}, each
 * call consuming the next entry (last entry repeats). Also records call order so
 * a test can assert the probe escalated, or did NOT.
 */
function scriptedExec(script) {
  const calls = [];
  const cursors = new Map();
  const fn = (cmd) => {
    calls.push(cmd);
    const seq = script[cmd];
    if (!seq) return { ok: false, output: `UNSCRIPTED: ${cmd}` };
    const i = cursors.get(cmd) ?? 0;
    cursors.set(cmd, Math.min(i + 1, seq.length - 1));
    return seq[i];
  };
  fn.calls = calls;
  return fn;
}

const OK = { ok: true, output: 'ok' };
const RED = (m) => ({ ok: false, output: m });

console.log('check-regen-repairable self-test\n');

// ── pure helpers ─────────────────────────────────────────────────────────────
console.log('regenChain / selectEntries');
check(
  'regenChain resolves the after: closure in declared order',
  JSON.stringify(regenChain(FIXTURE[1], FIXTURE).map((c) => c.id)) === JSON.stringify(['alpha', 'beta'])
);
check('regenChain on a root entry is just that entry', JSON.stringify(regenChain(FIXTURE[0], FIXTURE).map((c) => c.id)) === JSON.stringify(['alpha']));
check('selectEntries by id ignores ungated entries', JSON.stringify(selectEntries({ ids: ['alpha', 'gamma'] }, FIXTURE).map((c) => c.id)) === JSON.stringify(['alpha']));
check('selectEntries by exact gate command string', JSON.stringify(selectEntries({ gates: ['GATE_BETA'] }, FIXTURE).map((c) => c.id)) === JSON.stringify(['beta']));
check('selectEntries with no filter returns every GATED entry', JSON.stringify(selectEntries({}, FIXTURE).map((c) => c.id)) === JSON.stringify(['alpha', 'beta']));

// ── THE REGRESSION CASE ──────────────────────────────────────────────────────
console.log('\nREGRESSION_ART99 — a --check that detects what its --write cannot fix');
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('1 stale entries (node no longer live)')], // red before, red after, forever
    REGEN_ALPHA: [OK],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [FIXTURE[0]], covered: FIXTURE, exec });
  check('verdict is UNREPAIRABLE', res.unrepairable.length === 1 && res.unrepairable[0].id === 'alpha');
  check('it is NOT counted as repaired', res.repaired.length === 0);
  check('the probe escalated to the full declared regen before failing', res.escalated === true && exec.calls.includes(FULL_REGEN_CMD));
  const { hardFail, lines } = reportProbe(res, { ci: true });
  check('reportProbe hard-fails', hardFail === true);
  check('the report names the gate that cannot be repaired', lines.join('\n').includes('alpha'));
}

// ── the legitimate downgrade must keep working ───────────────────────────────
console.log('\nREPAIRABLE — the SO #35 hand-off is real, downgrade stays earned');
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('stale'), OK], // red before regen, green after
    REGEN_ALPHA: [OK],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [FIXTURE[0]], covered: FIXTURE, exec });
  check('verdict is REPAIRABLE', res.repaired.length === 1 && res.unrepairable.length === 0);
  check('the scoped chain was enough — NO escalation to the full regen', res.escalated === false && !exec.calls.includes(FULL_REGEN_CMD));
  check('reportProbe passes', reportProbe(res, { ci: true }).hardFail === false);
}

// ── escalation rescues a scoped false-negative ───────────────────────────────
console.log('\nESCALATION — an undeclared cross-generator dependency must not cause a false red');
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('stale'), RED('still stale'), OK], // scoped regen misses it, full regen fixes it
    REGEN_ALPHA: [OK],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [FIXTURE[0]], covered: FIXTURE, exec });
  check('escalated', res.escalated === true);
  check('verdict is REPAIRABLE via the full declared regen', res.repaired.length === 1 && res.repaired[0].via === 'full declared regen');
  check('reportProbe passes', reportProbe(res, { ci: true }).hardFail === false);
}

// ── fails closed: regen command itself errors ────────────────────────────────
console.log('\nFAILS CLOSED — a regen command that exits non-zero is never a pass (SO #34c)');
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('stale')],
    REGEN_ALPHA: [RED('generator crashed')],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [FIXTURE[0]], covered: FIXTURE, exec });
  check('verdict is UNREPAIRABLE at stage=regen', res.unrepairable.length === 1 && res.unrepairable[0].stage === 'regen');
  check('never silently repaired', res.repaired.length === 0);
  check('reportProbe hard-fails', reportProbe(res, { ci: true }).hardFail === true);
}
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('stale')],
    REGEN_ALPHA: [OK],
    [FULL_REGEN_CMD]: [RED('full regen crashed')],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [FIXTURE[0]], covered: FIXTURE, exec });
  check('a failed FULL regen is UNREPAIRABLE at stage=full-regen', res.unrepairable.length === 1 && res.unrepairable[0].stage === 'full-regen');
  check('reportProbe hard-fails', reportProbe(res, { ci: true }).hardFail === true);
}

// ── NOT REPRODUCED AT HEAD ───────────────────────────────────────────────────
console.log('\nNOT-REPRODUCED-AT-HEAD — its own state, hard in CI, soft locally');
{
  const exec = scriptedExec({ GATE_ALPHA: [OK], REGEN_ALPHA: [OK], [FULL_REGEN_CMD]: [OK] });
  const res = probeRepairable({ dir: '/scratch', entries: [FIXTURE[0]], covered: FIXTURE, exec });
  check('recorded as NOT-REPRODUCED, not as repaired', res.notReproduced.length === 1 && res.repaired.length === 0 && res.unrepairable.length === 0);
  check('no regen was run for a gate that is green at HEAD', !exec.calls.includes('REGEN_ALPHA'));
  check('HARD under GITHUB_ACTIONS', reportProbe(res, { ci: true }).hardFail === true);
  check('SOFT on a local pre-push run', reportProbe(res, { ci: false }).hardFail === false);
}

// ── after: prerequisites actually run, and only once ─────────────────────────
console.log('\nCHAIN — an after: prerequisite runs before the dependent, exactly once');
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('stale'), OK],
    GATE_BETA: [RED('stale'), OK],
    REGEN_ALPHA: [OK],
    REGEN_BETA: [OK],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [FIXTURE[0], FIXTURE[1]], covered: FIXTURE, exec });
  check('both repaired', res.repaired.length === 2 && res.unrepairable.length === 0);
  check('REGEN_ALPHA ran exactly once despite being in two chains', exec.calls.filter((c) => c === 'REGEN_ALPHA').length === 1);
  check('REGEN_ALPHA ran before REGEN_BETA', exec.calls.indexOf('REGEN_ALPHA') < exec.calls.indexOf('REGEN_BETA'));
}

// ── mixed: one repairable, one not — the red must not be masked ──────────────
console.log('\nMIXED — one repairable entry must never mask an unrepairable one');
{
  const exec = scriptedExec({
    GATE_ALPHA: [RED('stale'), OK],
    GATE_BETA: [RED('orphan'), RED('orphan'), RED('orphan')],
    REGEN_ALPHA: [OK],
    REGEN_BETA: [OK],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [FIXTURE[0], FIXTURE[1]], covered: FIXTURE, exec });
  check('alpha repaired', res.repaired.some((r) => r.id === 'alpha'));
  check('beta unrepairable', res.unrepairable.some((r) => r.id === 'beta'));
  check('reportProbe hard-fails', reportProbe(res, { ci: true }).hardFail === true);
}

// ── nothing stale ────────────────────────────────────────────────────────────
console.log('\nEMPTY — nothing stale is a clean pass with no regen executed');
{
  const exec = scriptedExec({ GATE_ALPHA: [OK], GATE_BETA: [OK], REGEN_ALPHA: [OK], REGEN_BETA: [OK] });
  const res = probeRepairable({ dir: '/scratch', entries: [], covered: FIXTURE, exec });
  check('no findings at all', res.notReproduced.length === 0 && res.repaired.length === 0 && res.unrepairable.length === 0);
  check('nothing executed', exec.calls.length === 0);
  check('reportProbe passes', reportProbe(res, { ci: true }).hardFail === false);
}

// ── LINEAGE-BINDING-REGEN-REPAIRABLE-1: the post-regen binding override ──────
// The registry-absence-tree gate goes red on any key-set move because the
// lineage PUBLISH is excluded from the regen chain (needs REGISTRY_LINEAGE_LOG_KEY;
// it is a separate derived-artifacts-regen.yml step). In a PR / merge_group run
// the drift is honestly regen-repairable anyway: main's single-writer regen
// appends AND publishes after merge, provided (i) the records file carries the
// published log as a byte-identical prefix (records length >= log size) and
// (ii) the LAST absence record equals the tree recomputed after --regen. The
// probe may only earn the advisory downgrade by PROVING both, read-only.
console.log('\nBINDING OVERRIDE — LINEAGE-BINDING-REGEN-REPAIRABLE-1');
const ABSENCE_ENTRY = { id: BINDING_ENTRY_ID, regen: 'REGEN_ABSENCE', gate: 'GATE_ABSENCE', artifacts: ['registry/absence/tree.json', 'chaingraph/kernels/registry-lineage-records.json'] };
const ABSENCE_COVERED = [ABSENCE_ENTRY];

// acceptance (a): lineage-free re-prove, binding override earns REPAIRABLE.
{
  const exec = scriptedExec({
    GATE_ABSENCE: [RED('LINEAGE BINDING STALE — the lineage log\'s latest absence-tree entry'), RED('LINEAGE BINDING STALE — the lineage log\'s latest absence-tree entry')],
    REGEN_ABSENCE: [OK],
    [BINDING_CHECK_CMD]: [{ ok: true, output: 'BINDING-OK records=105 log=104 lastIndex=104 root=sha256:abc key_count=42' }],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [ABSENCE_ENTRY], covered: ABSENCE_COVERED, exec, relaxed: true });
  check('verdict is REPAIRABLE via the binding override', res.repaired.length === 1 && res.unrepairable.length === 0);
  check('the override is named as the earned via', (res.repaired[0]?.via || '').includes('LINEAGE-BINDING-REGEN-REPAIRABLE'));
  check('NO escalation was needed — the predicate itself is the proof', res.escalated === false && !exec.calls.includes(FULL_REGEN_CMD));
  check('reportProbe passes', reportProbe(res, { ci: true }).hardFail === false);
}

// acceptance (c): a records file whose prefix diverges from the published log
// is UNREPAIRABLE — the probe must never pass a diverged records file.
{
  const exec = scriptedExec({
    GATE_ABSENCE: [RED('LINEAGE BINDING STALE'), RED('LINEAGE BINDING STALE')],
    REGEN_ABSENCE: [OK],
    [BINDING_CHECK_CMD]: [{ ok: false, output: 'append-absence-lineage-record: BINDING-FAIL PREFIX-DIVERGENCE — records[33] does not byte-match published log entry 33' }],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [ABSENCE_ENTRY], covered: ABSENCE_COVERED, exec, relaxed: true });
  check('diverged prefix is UNREPAIRABLE at stage=binding', res.unrepairable.length === 1 && res.unrepairable[0].stage === 'binding');
  check('never repaired', res.repaired.length === 0);
  check('reportProbe hard-fails', reportProbe(res, { ci: true }).hardFail === true);
}

// acceptance (e)-shape: LAST-RECORD mismatch (the dedupe/oscillation class)
// does NOT earn the downgrade — it falls through and fails loudly.
{
  const exec = scriptedExec({
    GATE_ABSENCE: [RED('LINEAGE BINDING STALE'), RED('LINEAGE BINDING STALE'), RED('LINEAGE BINDING STALE')],
    REGEN_ABSENCE: [OK],
    [BINDING_CHECK_CMD]: [{ ok: false, output: 'append-absence-lineage-record: BINDING-FAIL LAST-RECORD — records last absence entry (root sha256:old) != recomputed root sha256:new' }],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [ABSENCE_ENTRY], covered: ABSENCE_COVERED, exec, relaxed: true });
  check('LAST-RECORD mismatch is UNREPAIRABLE (loud, never downgraded)', res.unrepairable.length === 1 && res.repaired.length === 0);
  check('reportProbe hard-fails', reportProbe(res, { ci: true }).hardFail === true);
}

// strict control: the override must NOT be consulted outside pull_request /
// merge_group (and local) — push / workflow_run / CI-unknown stay strict.
{
  const exec = scriptedExec({
    GATE_ABSENCE: [RED('LINEAGE BINDING STALE'), RED('LINEAGE BINDING STALE')],
    REGEN_ABSENCE: [OK],
    [BINDING_CHECK_CMD]: [{ ok: true, output: 'BINDING-OK records=105 log=104 lastIndex=104 root=sha256:abc key_count=42' }],
    [FULL_REGEN_CMD]: [OK],
  });
  const res = probeRepairable({ dir: '/scratch', entries: [ABSENCE_ENTRY], covered: ABSENCE_COVERED, exec, relaxed: false });
  check('relaxed:false never consults the binding predicate', !exec.calls.includes(BINDING_CHECK_CMD));
  check('strict verdict is UNREPAIRABLE, exactly as before this row', res.unrepairable.length === 1 && res.repaired.length === 0 && res.escalated === true);
}

console.log('isRelaxedBindingContext');
check('pull_request is relaxed', isRelaxedBindingContext({ GITHUB_EVENT_NAME: 'pull_request' }) === true);
check('merge_group is relaxed', isRelaxedBindingContext({ GITHUB_EVENT_NAME: 'merge_group' }) === true);
check('push is STRICT', isRelaxedBindingContext({ GITHUB_EVENT_NAME: 'push' }) === false);
check('workflow_run is STRICT', isRelaxedBindingContext({ GITHUB_EVENT_NAME: 'workflow_run' }) === false);
check('schedule is STRICT', isRelaxedBindingContext({ GITHUB_EVENT_NAME: 'schedule' }) === false);
check('CI with no event name is STRICT (fails closed)', isRelaxedBindingContext({ GITHUB_ACTIONS: 'true' }) === false);
check('local run (no env at all) is relaxed — a local pre-push run is PR-bound', isRelaxedBindingContext({}) === true);

// acceptance (a)/(c) against the REAL repo bytes, read-only: main's records
// file is in sync with the published log at the time this row was written
// (measured 2026-11-01 with
// `node scripts/append-absence-lineage-record.mjs --verify-regen-binding`,
// which prints BINDING-OK records=… log=… when they agree), so the real
// verify passes; one mutated byte in the records copy must flip it to
// PREFIX-DIVERGENCE. No signing path, no writes to repo files.
console.log('verifyRegenBinding (real records file + published log, read-only)');
{
  const res = await verifyRegenBinding({ log: () => {} });
  check('real main-state binding verifies OK', res.ok === true && res.recordsLength >= res.logSize);
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const tmp = mkdtempSync(join(tmpdir(), 'binding-test-'));
  try {
    const recsDir = join(tmp, 'chaingraph', 'kernels');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(recsDir, { recursive: true });
    const recordsPath = join(recsDir, 'registry-lineage-records.json');
    const parsed = JSON.parse(readRepoRecords());
    parsed.records[10] = { ...parsed.records[10], tree_root: 'sha256:deadbeef' };
    writeFileSync(recordsPath, JSON.stringify(parsed, null, 2) + '\n');
    const bad = await verifyRegenBinding({ recordsPath, log: () => {} });
    check('a mutated records byte reports PREFIX-DIVERGENCE and not ok', bad.ok === false && bad.reason === 'PREFIX-DIVERGENCE');
    // a records file AHEAD of the log (PR appended, publish pending) with an
    // intact prefix and a matching last record is exactly the repairable shape.
    const ahead = JSON.parse(readRepoRecords());
    ahead.records.push(JSON.parse(JSON.stringify(ahead.records[ahead.records.length - 1])));
    writeFileSync(recordsPath, JSON.stringify(ahead, null, 2) + '\n');
    const okAhead = await verifyRegenBinding({ recordsPath, log: () => {} });
    check('records length > log size with intact prefix still verifies OK', okAhead.ok === true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

import { readFileSync as _repoRead } from 'node:fs';
function readRepoRecords() {
  return _repoRead(new URL('./../chaingraph/kernels/registry-lineage-records.json', import.meta.url), 'utf8');
}

console.log('');
if (failures) {
  console.error(`✗ check-regen-repairable self-test: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('✓ check-regen-repairable self-test: all assertions passed.');
