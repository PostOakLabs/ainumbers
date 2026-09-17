// shape-reader.test.mjs — regression fixtures + ratchet for chaingraph/kernels/_shape.mjs.
// KERNEL-OUTPUT-READER-1.
//
// Both regression fixtures come from REAL failures, not invented edge cases:
//   node 540 (por-liabilities-composer) — wrapper-shaped fixture file. FreeBuff Task 16 read the
//     `{ tool_id, note, vectors }` WRAPPER as if it were a case, executed it, got 6 scalar fields
//     instead of 9, and published three phantom field-level gaps off the three it lost.
//   node 424 (witness-cosignature-verifier) — its sync path returns `{ __async: true, mode,
//     parsed, … }`, FLAT, while its source text contains `output_payload:` on its error paths.
//     A static classifier calls it wrapped; execution calls it flat. `readOutcome` must return it
//     unchanged rather than descending.
//
// PLACEMENT. This lives in `scripts/` alongside the estate's other `*.test.mjs` gates
// (check-flag-mirror.test.mjs, check-page-determinism.test.mjs, …) rather than under
// `chaingraph/kernels/`, for a mechanical reason: the JSDoc CheckJS gate scopes to
// `chaingraph/kernels/**/*.mjs`, this repo installs no `@types/node`, and it blocks a NEW node
// builtin import there (existing kernel-dir gates pass only because their import lines are
// unchanged and therefore shielded). A test harness needs fs/path/url. The module it guards stays
// at its fenced path, `chaingraph/kernels/_shape.mjs`, and imports nothing at all.
//
// Run: node scripts/shape-reader.test.mjs

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readOutcome, readCases } from '../chaingraph/kernels/_shape.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const KERNELS = path.join(REPO, 'chaingraph', 'kernels');
const fixturePath = (id) => path.join(KERNELS, 'fixtures', `${id}.fixtures.json`);
const readFixture = (id) => JSON.parse(readFileSync(fixturePath(id), 'utf8'));
const importKernel = (id) => import(pathToFileURL(path.join(KERNELS, `${id}.kernel.mjs`)).href);

let failures = 0;
function check(name, ok, detail) {
  if (ok) { console.log(`  PASS  ${name}`); return; }
  failures++;
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ── node 540: wrapper-shaped fixture, 9 scalar fields ────────────────────────────────────────
console.log('art-540-por-liabilities-composer (wrapper-shaped fixture)');
{
  const id = 'art-540-por-liabilities-composer';
  const { compute } = await importKernel(id);
  const raw = readFixture(id);

  check('fixture file really is wrapper-shaped',
    Array.isArray(raw.vectors) && 'tool_id' in raw && 'note' in raw,
    `top-level keys: ${Object.keys(raw).join(',')}`);

  const cases = readCases(raw, fixturePath(id));
  check('readCases yields the vectors, not the wrapper',
    cases.length === raw.vectors.length, `got ${cases.length}, wrapper holds ${raw.vectors.length}`);

  const ppKeys = Object.keys(cases[0].policy_parameters).sort().join(',');
  const expectedPpKeys = 'liabilities_attestation_source,por_input,reported_total_liabilities_musd';
  check('case carries the kernel\'s own policy_parameters',
    ppKeys === expectedPpKeys, `got ${ppKeys}`);

  const payload = readOutcome(compute(cases[0].policy_parameters));
  const scalars = Object.entries(payload)
    .filter(([, v]) => v === null || typeof v !== 'object')
    .map(([k]) => k);
  check('executing the case gives 9 scalar fields (Task 16 got 6)',
    scalars.length === 9, `got ${scalars.length}: ${scalars.join(',')}`);

  // The defect itself: hand the wrapper to readCases as if it were a case.
  let threw = null;
  try { readCases({ ...raw, vectors: undefined, cases: undefined }); } catch (e) { threw = e; }
  check('wrapper handed in as a single case throws FixtureWrapperAsCaseError',
    threw !== null && threw.name === 'FixtureWrapperAsCaseError',
    threw ? `threw ${threw.name}` : 'did not throw');

  // And the mirror of it: a case that legitimately carries `note` must NOT throw. 38 committed
  // cases do (e.g. art-09-dora-incident-classifier), so a blanket note-test would be a regression.
  let noteThrew = null;
  try {
    readCases({ vectors: [{ name: 'n', note: 'legitimate case note', policy_parameters: {} }] });
  } catch (e) { noteThrew = e; }
  check('a real case carrying `note` beside policy_parameters does NOT throw',
    noteThrew === null, noteThrew ? `threw ${noteThrew.name}: ${noteThrew.message}` : '');
}

// ── node 424: shape varies by input; sync path is flat ───────────────────────────────────────
console.log('art-424-witness-cosignature-verifier (shape varies by input)');
{
  const id = 'art-424-witness-cosignature-verifier';
  const { compute } = await importKernel(id);

  const src = readFileSync(path.join(KERNELS, `${id}.kernel.mjs`), 'utf8');
  check('source text DOES contain `output_payload:` (why static classification calls it wrapped)',
    src.includes('output_payload:'));

  const cases = readCases(readFixture(id), fixturePath(id));
  const passing = cases.find((c) => c.name === 'both-witnesses-pass');
  check('fixture case both-witnesses-pass present', Boolean(passing));

  const sync = compute(passing.policy_parameters);
  check('sync path returns a FLAT object with no output_payload key',
    sync.__async === true && !Object.prototype.hasOwnProperty.call(sync, 'output_payload'),
    `keys: ${Object.keys(sync).join(',')}`);

  check('readOutcome returns that object UNCHANGED (does not descend)',
    readOutcome(sync) === sync);
}

// ── readOutcome contract ─────────────────────────────────────────────────────────────────────
console.log('readOutcome contract');
{
  check('unwraps the 93.2% majority shape',
    readOutcome({ output_payload: { a: 1 }, compliance_flags: [] })?.a === 1);
  check('descends nested wrapping', readOutcome({ output_payload: { output_payload: { a: 2 } } })?.a === 2);
  check('caps at 4 levels', (() => {
    const deep = { output_payload: { output_payload: { output_payload: { output_payload: { output_payload: { a: 3 } } } } } };
    const r = readOutcome(deep);
    return Boolean(r) && Object.prototype.hasOwnProperty.call(r, 'output_payload');
  })(), 'a 5-deep chain must stop at the cap, not recurse forever');
  check('flat payload returned unchanged', readOutcome({ a: 4 })?.a === 4);
  check('null passes through', readOutcome(null) === null);
  check('array passes through', Array.isArray(readOutcome([1, 2])));
  check('inherited output_payload is NOT treated as a wrapper', (() => {
    const proto = { output_payload: { a: 5 } };
    const obj = Object.create(proto);
    obj.b = 6;
    return readOutcome(obj)?.b === 6;
  })());
}

// ── readCases shape coverage ─────────────────────────────────────────────────────────────────
console.log('readCases shape coverage');
{
  check('{ vectors: [...] }', readCases({ tool_id: 't', note: 'n', vectors: [{ policy_parameters: {} }] }).length === 1);
  check('{ cases: [...] }', readCases({ cases: [{ policy_parameters: {} }, { policy_parameters: {} }] }).length === 2);
  check('bare array', readCases([{ policy_parameters: {} }]).length === 1);
  check('single case object', readCases({ policy_parameters: { x: 1 } })[0].policy_parameters.x === 1);
  check('wrapper leaking through a bare array throws', (() => {
    try { readCases([{ tool_id: 't', vectors: [] }]); return false; } catch (e) { return e.name === 'FixtureWrapperAsCaseError'; }
  })());
}

// ── the gate (row step 5): readers stay pointed at _shape.mjs ────────────────────────────────
//
// WHAT WAS CONSIDERED AND REJECTED, and why. The row asks for a check that makes "a tool reading
// kernel output without _shape.mjs" visible, and says to say so plainly if a mechanical check is
// not cheap. A grep-shaped lint for the guess patterns (`.vectors ?? []`, `.vectors || []`,
// `output_payload ?? `, `output_payload !== undefined`) is NOT cheap here: measured over the
// reader-class files, 6 of the 11 files it hits carry the pattern only inside a COMMENT that
// documents the historical defect (denominator-sentinel.mjs, denominator-sentinel.test.mjs,
// golden-parity.test.mjs, determinism-replay.test.mjs, bootstrap-fixtures.mjs) or inside a
// GENERATED SOURCE STRING for the QuickJS bundle, which by design has no imports at runtime
// (check-engine-parity.mjs). Any such lint therefore needs a JS-comment-and-string-aware parser to
// avoid false reds on files that are already correct — the fragile lint the row warns against, and
// one that would punish the very comments that record the lesson.
//
// WHAT IS HERE INSTEAD is a ratchet, not a pattern match: the set of files importing _shape.mjs is
// derived from the tree on every run and may not SHRINK. A refactor that quietly puts a local
// reader back — by dropping the import — turns this red and names the file. It cannot false-
// positive on a comment, because it reads imports, not prose.
console.log('readers stay pointed at _shape.mjs (ratchet)');
{
  const dirs = [path.join(REPO, 'scripts'), KERNELS, path.join(REPO, 'chaingraph', 'vm')];
  const pointed = [];
  for (const dir of dirs) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const f of names) {
      if (!f.endsWith('.mjs') || f.endsWith('.kernel.mjs') || f === '_shape.mjs') continue;
      let src = '';
      try { src = readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
      if (/from ['"][^'"]*_shape\.mjs['"]/.test(src)) {
        pointed.push(path.relative(REPO, path.join(dir, f)).replace(/\\/g, '/'));
      }
    }
  }
  pointed.sort();

  // Committed floor. Counts only go UP: add a name here when you point a new reader at _shape.mjs.
  const FLOOR = [
    'chaingraph/kernels/bootstrap-fixtures.mjs',
    'chaingraph/kernels/check-guest-builtin-safety.mjs',
    'chaingraph/kernels/clause-binding.test.mjs',
    'chaingraph/kernels/empty-input-finite.test.mjs',
    'chaingraph/kernels/fill-fixture-payloads.mjs',
    'chaingraph/kernels/kernel-contract.test.mjs',
    'chaingraph/kernels/quantization-parity.test.mjs',
    'chaingraph/kernels/validate-ha-records.test.mjs',
    'chaingraph/kernels/vm-parity-gate.mjs',
    'scripts/check-engine-parity.mjs',
    'scripts/check-flag-mirror.mjs',
    'scripts/check-node-surface-parity.mjs',
    'scripts/check-output-schema-coverage.mjs',
    'scripts/gen-output-schema.mjs',
    'scripts/pbt-discovery-leg-worker.mjs',
    'scripts/recompute-lib.mjs',
    'scripts/run-proptests.mjs',
    'scripts/shape-reader.test.mjs',
  ];
  const dropped = FLOOR.filter((f) => !pointed.includes(f));
  check(`every committed reader still imports _shape.mjs (${pointed.length} pointed, floor ${FLOOR.length})`,
    dropped.length === 0,
    dropped.length ? `no longer pointed: ${dropped.join(', ')}` : '');
}

console.log(failures === 0 ? '\nshape-reader: OK' : `\nshape-reader: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
