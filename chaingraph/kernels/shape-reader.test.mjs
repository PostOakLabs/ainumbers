// shape-reader.test.mjs — regression fixtures for chaingraph/kernels/_shape.mjs.
// KERNEL-OUTPUT-READER-1.
//
// Both fixtures come from REAL failures, not invented edge cases:
//   node 540 (por-liabilities-composer) — wrapper-shaped fixture file. FreeBuff Task 16 read the
//     `{ tool_id, note, vectors }` WRAPPER as if it were a case, executed it, got 6 scalar fields
//     instead of 9, and published three phantom field-level gaps off the three it lost.
//   node 424 (witness-cosignature-verifier) — its sync path returns `{ __async: true, mode,
//     parsed, … }`, FLAT, while its source text contains `output_payload:` on its error paths.
//     A static classifier calls it wrapped; execution calls it flat. `readOutcome` must return it
//     unchanged rather than descending.
//
// Placement note: the estate's kernel gates live as `chaingraph/kernels/*.test.mjs` (golden-parity,
// kernel-contract, kernel-identity, …). There is no `__tests__/` directory under `kernels/`, so
// this matches what is there rather than introducing a second convention.
//
// Run: node chaingraph/kernels/shape-reader.test.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOutcome, readCases } from './_shape.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = (id) => path.join(__dirname, 'fixtures', `${id}.fixtures.json`);

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
  const { compute } = await import(`./${id}.kernel.mjs`);
  const raw = JSON.parse(readFileSync(fixturePath(id), 'utf8'));

  check('fixture file really is wrapper-shaped',
    Array.isArray(raw.vectors) && 'tool_id' in raw && 'note' in raw,
    `top-level keys: ${Object.keys(raw).join(',')}`);

  const cases = readCases(fixturePath(id));
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
  const { compute } = await import(`./${id}.kernel.mjs`);

  const src = readFileSync(path.join(__dirname, `${id}.kernel.mjs`), 'utf8');
  check('source text DOES contain `output_payload:` (why static classification calls it wrapped)',
    src.includes('output_payload:'));

  const cases = readCases(fixturePath(id));
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
    readOutcome({ output_payload: { a: 1 }, compliance_flags: [] }).a === 1);
  check('descends nested wrapping', readOutcome({ output_payload: { output_payload: { a: 2 } } }).a === 2);
  check('caps at 4 levels', (() => {
    const deep = { output_payload: { output_payload: { output_payload: { output_payload: { output_payload: { a: 3 } } } } } };
    const r = readOutcome(deep);
    return Object.prototype.hasOwnProperty.call(r, 'output_payload');
  })(), 'a 5-deep chain must stop at the cap, not recurse forever');
  check('flat payload returned unchanged', readOutcome({ a: 4 }).a === 4);
  check('null passes through', readOutcome(null) === null);
  check('array passes through', Array.isArray(readOutcome([1, 2])));
  check('inherited output_payload is NOT treated as a wrapper', (() => {
    const proto = { output_payload: { a: 5 } };
    const obj = Object.create(proto);
    obj.b = 6;
    return readOutcome(obj).b === 6;
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

console.log(failures === 0 ? '\nshape-reader: OK' : `\nshape-reader: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
