#!/usr/bin/env node
// prune-recompute-quarantine.test.mjs — REGEN-QUARANTINE-PRUNE-1's proven-to-reject
// controls for the main-side regen's quarantine prune step (the COVERED entry
// 'recompute-quarantine-prune' and its helper scripts/prune-recompute-quarantine.mjs).
//
// ⛔ VERIFY BY MUTATION, NOT BY READING THE CODE (same law as check-recompute-equality.test.mjs).
// Every case below is shown RED against a stub that does the wrong thing, then GREEN against the
// real helper. The wrong stubs live here; the real helper is exercised two ways: as an IMPORTED
// pure function (planPrune / applyPrune / runCheck with an injected spawn) and END-TO-END — the
// test materializes a fixture scripts/ dir (tmpdir), copies the real helper into it BY BYTES,
// plants a stub §18 check that prints a scripted --json report, and spawns the CLI. The helper
// resolves both of its inputs module-relative, so the fixture copy operates only inside the
// fixture — the real quarantine file is never written by this test (a dedicated control below
// additionally proves the real file's serialization round-trips byte-identically, which is what
// keeps a real prune's diff surgical).
//
// Cases (row contract, in order):
//   1. one reproducing entry is removed (the cured one — not its neighbour, not both);
//   2. a non-reproducing entry stays (excused ≠ cured: the ratchet only goes down, never sideways);
//   3. zero reproducing leaves the bytes untouched (no write at all);
//   4. malformed check output fails closed: no write, exit non-zero (garbage, missing arrays,
//      missing tool_id, a child that never reached an exit code);
//   5. the step can never add an entry (phantom cured ids, unknown ids, set contraction);
//   6. --check mode: read-only in every branch — exit 0 on fixpoint, exit 1 naming cured ids, bytes untouched;
//   7. serialization law: the file's own JSON.stringify(doc, null, 2) + '\n' round-trips byte-identically,
//      so a one-entry prune is a one-entry diff.
//
// Zero dependencies. Writes only to os.tmpdir().
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planPrune, applyPrune, runCheck } from './prune-recompute-quarantine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_HELPER = resolve(HERE, 'prune-recompute-quarantine.mjs');
const REAL_QUARANTINE = resolve(HERE, 'recompute-equality-quarantine.json');
const HELPER_SRC = readFileSync(REAL_HELPER, 'utf8');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── fixture scaffolding ────────────────────────────────────────────────────────────────────────
const CUR_ID = 'art-9001-synthetic-reproduces';
const STAY_ID = 'art-9002-synthetic-still-stale';
const CAUSE = 'synthetic observed cause, word-for-word what the ratchet wrote';
const quarantineDoc = () => ({
  _comment: ['synthetic quarantine header — must survive every prune byte-for-byte'],
  observed_on: '2026-11-23',
  observed_by: 'REGEN-QUARANTINE-PRUNE-1-selftest',
  nodes: [
    { tool_id: CUR_ID, cause: CAUSE },
    { tool_id: STAY_ID, cause: CAUSE },
  ],
});
const writeQuarantine = (dir, doc) => writeFileSync(join(dir, 'scripts', 'recompute-equality-quarantine.json'), JSON.stringify(doc, null, 2) + '\n', 'utf8');
const readQuarantine = (dir) => readFileSync(join(dir, 'scripts', 'recompute-equality-quarantine.json'), 'utf8');

// A fixture scripts/ dir: the REAL helper copied by bytes + a stub §18 check that
// prints the report the scenario scripts and exits the code the scenario names.
function makeFixture(report, { exitCode = 0, stdout, stderr = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ocg-quarantine-prune-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  copyFileSync(REAL_HELPER, join(dir, 'scripts', 'prune-recompute-quarantine.mjs'));
  const body = stdout !== undefined
    ? stdout
    : JSON.stringify({ elapsed_ms: 1, examined: 2, skippedPrivate: 0, failures: [], cured: report.cured ?? [], excused: report.excused ?? [], matched: report.matched ?? [], staleQuarantineEntries: report.staleQuarantineEntries ?? [], advisoryCured: report.advisoryCured ?? [], ok: true });
  const stub = [
    '#!/usr/bin/env node',
    `const out = ${JSON.stringify(body)};`,
    `if (out !== null) process.stdout.write(out);`,
    `if (${JSON.stringify(stderr)}) process.stderr.write(${JSON.stringify(stderr)});`,
    `process.exit(${exitCode});`,
  ].join('\n');
  writeFileSync(join(dir, 'scripts', 'check-recompute-equality.mjs'), stub, 'utf8');
  writeQuarantine(dir, quarantineDoc());
  return dir;
}
const runCLI = (dir, args = []) => spawnSync(process.execPath, [join(dir, 'scripts', 'prune-recompute-quarantine.mjs'), ...args], { encoding: 'utf8', timeout: 60000 });
const cleanup = (dir) => rmSync(dir, { recursive: true, force: true });

// ── the wrong stubs (RED legs): test-local implementations that do the wrong thing ─────────────
const WRONG = {
  // 1a. removes the neighbour instead of the cured entry
  removeWrongEntry: (doc, curedIds) => applyPrune(doc, [STAY_ID]),
  // 1b. removes everything that matches or not — here: nukes all entries on ANY cure
  removeAll: (doc, curedIds) => applyPrune(doc, doc.nodes.map((n) => n.tool_id)),
  // 2. treats "excused" (quarantined and STILL not reproducing) as removable
  prunesExcused: (doc, curedIds, report) => applyPrune(doc, [...curedIds, ...report.excused.map((e) => e.tool_id)]),
  // 3. rewrites the file even when nothing reproduces — and re-serializes it with a
  //    different indent while it is there (the churn a write-on-zero run commits)
  writesOnZero: (doc) => ({ doc, bytes: JSON.stringify(doc, null, 4), removedCount: 0, removedIds: [] }),
  // 4. parses best-effort: garbage in, "zero cured" out, exit 0 — the opposite of fail-closed
  bestEffortParse: () => ({ ok: true, remove: [] }),
  // 5. adds an entry for a cured id the file does not carry (the phantom-add vector)
  phantomAdd: (doc, curedIds) => ({ doc: { ...doc, nodes: [...doc.nodes, { tool_id: curedIds[0], cause: 're-added by the prune' }] }, removedCount: 0, removedIds: [] }),
};

async function red(name, probe) {
  return test(`RED — ${name}`, async () => {
    let threw = null;
    try { await probe(); } catch (e) { threw = e; }
    assert(threw, 'the wrong stub PASSED the case invariant — the test cannot see the defect class it exists to catch');
  });
}

// ══ 1. one reproducing entry is removed ════════════════════════════════════════════════════════
const curedReport = { cured: [{ tool_id: CUR_ID }], advisoryCured: [], excused: [{ tool_id: STAY_ID }] };

await red('a stub that removes the WRONG entry is caught (case 1)', async () => {
  const doc = quarantineDoc();
  const { doc: next } = WRONG.removeWrongEntry(doc, [CUR_ID]);
  assert(!next.nodes.some((n) => n.tool_id === CUR_ID), 'cured entry must be gone');
  assert(next.nodes.some((n) => n.tool_id === STAY_ID), 'stable entry must stay');
});
await red('a stub that removes BOTH entries is caught (case 1)', async () => {
  const doc = quarantineDoc();
  const { doc: next } = WRONG.removeAll(doc, [CUR_ID]);
  assert(next.nodes.length === 1, 'exactly one entry must remain');
});
await test('GREEN — one reproducing entry is removed end-to-end, neighbour intact, order and header untouched', async () => {
  const dir = makeFixture(curedReport, { exitCode: 1 });
  try {
    const r = runCLI(dir);
    assert(r.status === 0, `prune must exit 0, got ${r.status}: ${r.stderr}`);
    const after = readQuarantine(dir);
    const doc = JSON.parse(after);
    assert(doc.nodes.length === 1 && doc.nodes[0].tool_id === STAY_ID, `expected only ${STAY_ID} to survive, got ${JSON.stringify(doc.nodes.map((n) => n.tool_id))}`);
    assert(JSON.stringify(doc._comment) === JSON.stringify(quarantineDoc()._comment), 'the _comment header must be byte-identical');
    assert(doc.observed_on === '2026-11-23' && doc.observed_by === 'REGEN-QUARANTINE-PRUNE-1-selftest', 'other keys must pass through untouched');
    assert(after.includes(CAUSE) && after.includes(STAY_ID), 'the surviving entry keeps its cause verbatim');
    assert(!after.includes(CUR_ID), 'the cured entry is gone from the bytes');
    assert(r.stdout.includes(CUR_ID), 'stdout names what was removed');
  } finally { cleanup(dir); }
});

// ══ 2. a non-reproducing entry stays ═══════════════════════════════════════════════════════════
await red('a stub that prunes EXCUSED (still-stale) entries is caught (case 2)', async () => {
  const doc = quarantineDoc();
  const { doc: next } = WRONG.prunesExcused(doc, [], curedReport);
  assert(next.nodes.some((n) => n.tool_id === STAY_ID), 'an excused entry must never be removed');
});
await test('GREEN — a quarantined-and-still-stale entry stays (only the cured report moves)', async () => {
  const dir = makeFixture(curedReport, { exitCode: 1 });
  try {
    const r = runCLI(dir);
    assert(r.status === 0, `prune must exit 0, got ${r.status}`);
    const doc = JSON.parse(readQuarantine(dir));
    assert(doc.nodes.some((n) => n.tool_id === STAY_ID && n.cause === CAUSE), 'the still-stale entry keeps its id AND its cause');
  } finally { cleanup(dir); }
});

// ══ 3. zero reproducing leaves the bytes untouched ═════════════════════════════════════════════
await red('a stub that rewrites (and re-indents) the file on a zero-cure run is caught by the byte witness (case 3)', async () => {
  const doc = quarantineDoc();
  const before = JSON.stringify(doc, null, 2) + '\n';
  const r = WRONG.writesOnZero(doc);
  assert(r.removedCount === 0, 'the stub removed nothing — yet it still rewrote the bytes');
  assert(r.bytes === before, 'guard: the byte witness must have seen the rewrite');
});
await test('GREEN — zero reproducing: bytes untouched, exit 0, nothing-to-prune on stdout', async () => {
  const dir = makeFixture({ cured: [], advisoryCured: [] }, { exitCode: 0 });
  try {
    const before = readQuarantine(dir);
    const r = runCLI(dir);
    assert(r.status === 0, `prune must exit 0 on a zero-cure tree, got ${r.status}: ${r.stderr}`);
    assert(readQuarantine(dir) === before, 'zero reproducing entries must leave the bytes untouched');
    assert(/nothing to prune/.test(r.stdout), `stdout must say nothing to prune, got: ${r.stdout}`);
  } finally { cleanup(dir); }
});

// ══ 4. malformed check output fails closed (no write) ══════════════════════════════════════════
await red('a best-effort parser that shrugs at garbage output is caught by the fail-closed invariant (case 4)', async () => {
  const plan = WRONG.bestEffortParse('<html>boom</html>');
  assert(plan.ok === false, 'a malformed report must never plan a prune');
});
const malformedCases = [
  ['stdout is not JSON at all', { stdout: '<html>panic: undefined is not a function</html>', exitCode: 1 }],
  ['stdout is JSON but not a report', { stdout: '{"error":"no chaingraph found"}', exitCode: 1 }],
  ['report is missing the cured array', { stdout: JSON.stringify({ failures: [], excused: [], matched: [], staleQuarantineEntries: [], advisoryCured: [] }), exitCode: 0 }],
  ['cured entry has no tool_id', { stdout: JSON.stringify({ failures: [], cured: [{ cause: 'x' }], excused: [], matched: [], staleQuarantineEntries: [], advisoryCured: [] }), exitCode: 1 }],
  ['advisoryCured is not an array', { stdout: JSON.stringify({ failures: [], cured: [], excused: [], matched: [], staleQuarantineEntries: [], advisoryCured: 'art-9001-synthetic-reproduces' }), exitCode: 1 }],
];
for (const [name, stub] of malformedCases) {
  await test(`GREEN — malformed check output fails closed, no write: ${name}`, async () => {
    const dir = makeFixture(null, stub);
    try {
      const before = readQuarantine(dir);
      const r = runCLI(dir);
      assert(r.status !== 0, `prune must exit non-zero on malformed report (${name}), got ${r.status}`);
      assert(readQuarantine(dir) === before, 'no write may happen on a malformed report');
      assert(/✗/.test(r.stderr), `stderr must name the failure, got: ${r.stderr}`);
    } finally { cleanup(dir); }
  });
}
await test('GREEN — runCheck fails closed when the child never reaches an exit code (injected spawn)', async () => {
  const r = runCheck({ spawn: () => ({ status: null, error: Object.assign(new Error('killed'), { code: 'ETIMEDOUT' }) }) });
  assert(r.ok === false && /did not run to an exit code/.test(r.reason), `expected fail-closed, got ${JSON.stringify(r)}`);
});

// ══ 4b. CI cure (PR 3282): a multi-MB report followed by process.exit() must parse whole ═══════
// CI printed "no parsable --json report (exit 0)": the real check's ~1.5 MB report ends with
// process.exit(), which truncates a pipe on Linux. The helper reads stdout from a file now.
await test('GREEN — a multi-MB --json report written then process.exit()ed parses whole, zero cured is a pass', async () => {
  const pad = 'x'.repeat(3 * 1024 * 1024);
  const big = JSON.stringify({ elapsed_ms: 1, examined: 2, skippedPrivate: 0, failures: [], cured: [], excused: [{ tool_id: STAY_ID, detail: pad }], matched: [], staleQuarantineEntries: [], advisoryCured: [], ok: true });
  const dir = makeFixture(null, { stdout: big, exitCode: 0 });
  try {
    const before = readQuarantine(dir);
    const r = runCLI(dir);
    assert(r.status === 0, `a large zero-cure report must pass, got ${r.status}: ${r.stderr}`);
    assert(/nothing to prune/.test(r.stdout), `stdout must say nothing to prune, got: ${r.stdout}`);
    assert(readQuarantine(dir) === before, 'bytes untouched');
  } finally { cleanup(dir); }
});

// ══ 5. the step can never add an entry═════════════════════════════════════════════════════════
await red('a stub that adds an entry for a phantom cured id is caught (case 5)', async () => {
  const doc = quarantineDoc();
  const { doc: next } = WRONG.phantomAdd(doc, ['art-9999-synthetic-phantom']);
  const ids = new Set(next.nodes.map((n) => n.tool_id));
  for (const n of doc.nodes) assert(ids.has(n.tool_id), 'post-state must be a subset of pre-state');
  assert(next.nodes.length <= doc.nodes.length, 'the nodes list may never grow');
});
await test('GREEN — a cured id the file does not carry is a no-op (no phantom entry, bytes untouched)', async () => {
  const dir = makeFixture({ cured: [{ tool_id: 'art-9999-synthetic-phantom' }], advisoryCured: [] }, { exitCode: 1 });
  try {
    const before = readQuarantine(dir);
    const r = runCLI(dir);
    assert(r.status === 0, `prune must exit 0, got ${r.status}: ${r.stderr}`);
    assert(readQuarantine(dir) === before, 'a phantom cured id must not add OR rewrite anything');
  } finally { cleanup(dir); }
});
await test('GREEN — applyPrune unit: set contraction, order preserved, other keys pass through', async () => {
  const doc = quarantineDoc();
  const { doc: next, removedCount } = applyPrune(doc, [CUR_ID, 'art-9999-synthetic-phantom']);
  assert(removedCount === 1, `exactly one entry goes, got ${removedCount}`);
  assert(next.nodes.length === 1 && next.nodes[0].tool_id === STAY_ID, 'survivor keeps its position');
  assert(next._comment === doc._comment && next.observed_on === doc.observed_on && next.observed_by === doc.observed_by, 'every other key is the same object, untouched');
  assert(next.nodes.length <= doc.nodes.length, 'nodes may only shrink');
  const empty = applyPrune({ nodes: [] }, [CUR_ID]);
  assert(empty.removedCount === 0 && empty.doc.nodes.length === 0, 'an empty nodes list stays empty');
});

// ══ 6. --check mode: read-only in every branch ═════════════════════════════════════════════════
await test('GREEN — --check exits 0 on a fixpoint tree (nothing reproduces)', async () => {
  const dir = makeFixture({ cured: [], advisoryCured: [] }, { exitCode: 0 });
  try {
    const before = readQuarantine(dir);
    const r = runCLI(dir, ['--check']);
    assert(r.status === 0, `--check must exit 0 when nothing reproduces, got ${r.status}: ${r.stderr}`);
    assert(readQuarantine(dir) === before, '--check must never write');
    assert(/fixpoint holds/.test(r.stdout), `stdout must say the fixpoint holds, got: ${r.stdout}`);
  } finally { cleanup(dir); }
});
await test('GREEN — --check exits 1 naming the reproducing entries, and still never writes', async () => {
  const dir = makeFixture(curedReport, { exitCode: 1 });
  try {
    const before = readQuarantine(dir);
    const r = runCLI(dir, ['--check']);
    assert(r.status === 1, `--check must exit 1 when entries reproduce, got ${r.status}`);
    assert(readQuarantine(dir) === before, '--check must never write, not even on a red');
    assert(r.stderr.includes(CUR_ID), 'stderr names the cured entry');
  } finally { cleanup(dir); }
});
await test('GREEN — --check fails closed on malformed output (exit 1, no write)', async () => {
  const dir = makeFixture(null, { stdout: 'not json', exitCode: 1 });
  try {
    const before = readQuarantine(dir);
    const r = runCLI(dir, ['--check']);
    assert(r.status === 1, `--check must exit 1 on malformed output, got ${r.status}`);
    assert(readQuarantine(dir) === before, 'no write on malformed output');
  } finally { cleanup(dir); }
});

// ══ 7. serialization law: the real file round-trips byte-identically ═══════════════════════════
await test('GREEN — the real quarantine file round-trips through JSON.stringify(doc, null, 2) + newline byte-identically (a prune write is a surgical diff)', async () => {
  const bytes = readFileSync(REAL_QUARANTINE, 'utf8');
  const round = JSON.stringify(JSON.parse(bytes), null, 2) + '\n';
  assert(round === bytes, `the real file's serialization is not stringify(…,2)+newline — a prune write would reformat unrelated lines (${Buffer.byteLength(bytes)} vs ${Buffer.byteLength(round)} bytes)`);
});

console.log(`\nprune-recompute-quarantine selftest: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
