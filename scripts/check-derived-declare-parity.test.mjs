/**
 * scripts/check-derived-declare-parity.test.mjs — paired self-test for
 * check-derived-declare-parity.mjs (GATE-SELFTEST-META-1).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * SO #40b: "a checker that cannot be shown red proves nothing." The parity gate
 * is a STATIC ANALYSER — it reads a generator's source and measures which paths
 * that generator actually writes. A static analyser fails in one direction that
 * matters: it can quietly measure NOTHING and report success, which reads exactly
 * like a clean repo. Every case below is therefore a MUTATION control: it feeds
 * the analyser a crafted generator, then changes exactly one thing and asserts the
 * verdict moves. A test that only asserted "the current repo passes" would stay
 * green if measureEntry() were gutted to `return []`.
 *
 * Fixtures are written to a temp dir and removed on exit; nothing under the repo
 * is touched, and the gate's own COVERED set is never consulted here.
 *
 * Run: node scripts/check-derived-declare-parity.test.mjs
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { REPO } from './derived-artifacts.mjs';
import { measureEntry, primaryScriptPath } from './check-derived-declare-parity.mjs';

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    fail++;
    failures.push(`${name}\n      ${e.message}`);
    console.log(`  \u2717 ${name}\n      ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// The analyser resolves script paths against REPO, so fixtures must live inside it.
// A dot-prefixed dir under scripts/ keeps them out of every glob the estate uses.
const FIXROOT = join(REPO, 'scripts', '.parity-selftest-fixtures');
mkdirSync(FIXROOT, { recursive: true });
const workdir = mkdtempSync(join(FIXROOT, 'run-'));
const cleanup = () => { try { rmSync(FIXROOT, { recursive: true, force: true }); } catch { /* best effort */ } };
process.on('exit', cleanup);

/** Write a fixture generator and return the COVERED-shaped entry that regenerates it. */
function fixture(basename, source, extra = {}) {
  const abs = join(workdir, basename);
  writeFileSync(abs, source);
  const rel = relative(REPO, abs).split('\\').join('/');
  return { id: 'selftest', regen: `node ${rel}`, artifacts: [], ...extra };
}

const WRITES_ONE = `
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(REPO, 'alpha', 'one.json'), '{}');
`;

console.log('check-derived-declare-parity.test.mjs');

// ── 1. The analyser actually measures a write ────────────────────────────────
// Anchors everything below: if this fails, later "detected a change" assertions
// would be vacuously true against a measurement of nothing.
test('MEASURE - a writeFileSync target is discovered in generator source', () => {
  const { measured, unresolved } = measureEntry(fixture('w1.mjs', WRITES_ONE));
  assert(!unresolved, 'entry should resolve to a JS generator');
  assert(Array.isArray(measured), `measured should be an array, got ${typeof measured}`);
  assert(measured.some((p) => p.endsWith('one.json')), `expected a path ending one.json, got ${JSON.stringify(measured)}`);
});

// ── 2. MUTATION: add a second write, measurement must grow ───────────────────
// This is the control that a gutted `return []` cannot survive.
test('MUTATION - adding a second write target changes the measurement', () => {
  const before = measureEntry(fixture('m1.mjs', WRITES_ONE)).measured;
  const after = measureEntry(fixture('m2.mjs', `${WRITES_ONE}\nwriteFileSync(join(REPO, 'beta', 'two.json'), '{}');\n`)).measured;
  assert(after.length > before.length, `expected more targets after mutation: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  assert(after.some((p) => p.endsWith('two.json')), `second target missing: ${JSON.stringify(after)}`);
});

// ── 3. MUTATION: a generator with no writes is UNRESOLVED, not "clean" ───────
// The contract is stronger than "measures zero": zero writes is reported as
// unresolved with a reason, so a generator the analyser cannot see into can never
// be mistaken for one that legitimately writes nothing. Asserted explicitly
// because the weaker behaviour (measured: []) would look identical in a green run.
test('MUTATION - a generator with no writes is UNRESOLVED with a reason, never silently clean', () => {
  const { measured, unresolved, reason } = measureEntry(fixture('empty.mjs', 'const x = 1;\nexport default x;\n'));
  assert(unresolved === true, `a no-write generator must be unresolved, got unresolved=${unresolved}`);
  assert(measured === null, `unresolved entries must not report a measurement, got ${JSON.stringify(measured)}`);
  assert(/writeFile/.test(reason || ''), `reason should name the missing write call, got ${JSON.stringify(reason)}`);
});

// ── 4. The `writes:` escape hatch short-circuits static analysis ─────────────
// Rule 1 of the gate: a declared `writes:` is taken as authoritative. Proven
// explicitly so nobody "simplifies" the branch away.
test('ESCAPE HATCH - an explicit writes: is returned verbatim, source not parsed', () => {
  const entry = fixture('ignored.mjs', WRITES_ONE, { writes: ['declared/only.json'] });
  const { measured, unresolved } = measureEntry(entry);
  assert(!unresolved, 'explicit writes: must never be unresolved');
  assert(measured.length === 1 && measured[0] === 'declared/only.json',
    `writes: must win over static parse, got ${JSON.stringify(measured)}`);
});

// ── 5. Unresolvable entries are reported, NOT silently passed ────────────────
// The dangerous failure mode: "I could not read it" rendered as "it is fine".
test('UNRESOLVED - a non-JS generator is flagged unresolved with a reason', () => {
  const { unresolved, reason } = measureEntry({ id: 'selftest', regen: 'python scripts/regen_catalog.py', artifacts: [] });
  assert(unresolved === true, 'a python generator must be unresolved, never silently clean');
  assert(typeof reason === 'string' && reason.length > 0, 'unresolved must carry a human reason');
});

test('UNRESOLVED - a regen command with no script path is flagged, not passed', () => {
  const { unresolved } = measureEntry({ id: 'selftest', regen: 'echo nothing-to-do', artifacts: [] });
  assert(unresolved === true, 'a command with no identifiable script must be unresolved');
});

// ── 6. primaryScriptPath picks the generator, not the interpreter or its flags ─
// Note the division of labour, verified rather than assumed: primaryScriptPath is
// purely lexical and returns the first non-interpreter token ('echo' for 'echo hi').
// It is measureEntry's extension check that rejects a non-JS result — proven in
// case 5. Pinning both halves keeps a future "tidy-up" from moving the rejection
// out of one without adding it to the other.
test('PARSE - primaryScriptPath extracts the script, ignoring the interpreter and flags', () => {
  assert(primaryScriptPath('node scripts/gen-x.mjs --write') === 'scripts/gen-x.mjs',
    'should return the .mjs path from a flagged node command');
  assert(primaryScriptPath('python scripts/regen_catalog.py') === 'scripts/regen_catalog.py',
    'should return the script for a non-node interpreter too');
  assert(primaryScriptPath('echo hi') === 'echo',
    'lexical only: returns the first non-interpreter token; measureEntry rejects it on extension');
});

console.log(`\ncheck-derived-declare-parity.test.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
