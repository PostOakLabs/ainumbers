// art-750-diff-evidence-bundles.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the port of the root
// bundle-diff.html comparison engine (kernel art-750, row BUNDLE-DIFF-KERNEL-1).
// kernel_digest_at_authoring: sha256:693b7edea3f0a7a3d0123d9918e30abee3503aa91c3cf880d882c89fb78aab16
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof. Internal engineering QC only.
// float_sensitive: NO — the kernel is pure structural comparison over strings
// and set membership; every property below is exact.
//
// Checks: fixture-oracle gate (the 10 golden vectors); P1 determinism (two runs
// agree byte-for-byte) and output shape (no undefined/NaN/non-finite anywhere in
// output_payload); P2 the map-diff rows restated independently against a naive
// recomputation on generated path-keyed maps, with the swap symmetry added =
// removed and changed preserved; P3 identical inputs give bundles_identical
// true and no section in a changed/regressed status; P4 every refusal is by
// throw with a named reason (unknown class on either side, missing side, bad
// as_of, missing as_of on an override-bearing pair, non-object pp); P5 the
// verdict regression rule restated (regressed iff values differ and B matches
// fail/reject/hold and A does not); P6 accountability shape-migration
// invariance (records array vs equivalent evidence bundle yields zero
// accountability rows); P7 the depth cap refuses a 250-level nest with the
// named message.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-750-diff-evidence-bundles.proptest.mjs

import { compute } from '../art-750-diff-evidence-bundles.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-750-diff-evidence-bundles';

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasBadValue = (x) => {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x === undefined) return true;
  if (x === null || typeof x !== 'object') return false;
  return Object.values(x).some(hasBadValue);
};

const artifact = (hash, version, verdict) => ({
  tool_id: 'probe-tool',
  tool_version: version,
  chaingraph_version: '0.4.0',
  execution_hash: hash,
  output_payload: { verdict },
});

const HEX = '0123456789abcdef';
const fakeHash = (rng, tag) => 'sha256:' + String(tag).padStart(2, '0') + Array.from({ length: 62 }, () => HEX[Math.floor(rng() * 16)]).join('');

// P1 — determinism + output shape.
function checkP1DeterminismAndShape() {
  let checked = 0, violations = 0;
  const rng = mulberry32(20261020);
  for (let i = 0; i < 200; i++) {
    const a = artifact(fakeHash(rng, i % 3), '1.' + (i % 2) + '.0', ['PASS', 'FAIL', 'HOLD'][i % 3]);
    const b = artifact(fakeHash(rng, (i + 1) % 3), '1.' + ((i + 1) % 2) + '.0', ['PASS', 'FAIL', 'REJECT'][i % 3]);
    const r1 = compute({ bundle_a: a, bundle_b: b });
    const r2 = compute({ bundle_a: a, bundle_b: b });
    checked++;
    if (!deepEqual(r1.output_payload, r2.output_payload)) violations++;
    if (hasBadValue(r1.output_payload)) violations++;
  }
  return { name: 'P1 determinism and output shape', checked, violations };
}

// P2 — map diff restated independently + swap symmetry.
function checkP2MapDiffRestated() {
  let checked = 0, violations = 0;
  const rng = mulberry32(750750);
  const flat = (n) => {
    const m = {};
    for (let i = 0; i < n; i++) m['f' + Math.floor(rng() * 12)] = String(Math.floor(rng() * 5));
    return m;
  };
  for (let i = 0; i < 200; i++) {
    const a = { execution_hash: 'h' + i, ...flat(6) };
    const b = { execution_hash: 'h' + (i % 2), ...flat(6) };
    const rows = compute({ bundle_a: a, bundle_b: b }).output_payload.hashes.rows;
    // naive restatement (restricted to the hash/digest field matcher the kernel walks with)
    const isHashKey = (k) => /(_hash|_digest)$/i.test(k) || /^(hash|digest)$/i.test(k);
    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).sort();
    const naive = [];
    for (const k of keys) {
      const inA = Object.prototype.hasOwnProperty.call(a, k);
      const inB = Object.prototype.hasOwnProperty.call(b, k);
      if (!isHashKey(k)) continue;
      if (inA && inB) { if (a[k] !== b[k]) naive.push('changed:' + k); }
      else if (inA) naive.push('removed:' + k);
      else if (inB) naive.push('added:' + k);
    }
    checked++;
    if (JSON.stringify(rows.map((r) => r.kind + ':' + r.path)) !== JSON.stringify(naive)) violations++;
    // swap symmetry
    const back = compute({ bundle_a: b, bundle_b: a }).output_payload.hashes.rows;
    checked++;
    const fwdKind = Object.fromEntries(rows.map((r) => [r.path, r.kind]));
    const bwdKind = Object.fromEntries(back.map((r) => [r.path, r.kind]));
    let symOk = rows.length === back.length;
    for (const p of Object.keys(fwdKind)) {
      const f = fwdKind[p], g = bwdKind[p];
      if (f === 'changed' ? g !== 'changed' : (f === 'added' ? g !== 'removed' : g !== 'added')) symOk = false;
    }
    if (!symOk) violations++;
  }
  return { name: 'P2 map diff restated with swap symmetry', checked, violations };
}

// P3 — identical inputs are identical.
function checkP3Identity() {
  let checked = 0, violations = 0;
  const rng = mulberry32(424242);
  for (let i = 0; i < 100; i++) {
    const a = artifact(fakeHash(rng, i), '1.0.0', 'PASS');
    const out = compute({ bundle_a: a, bundle_b: structuredClone(a) }).output_payload;
    checked++;
    if (out.bundles_identical !== true) violations++;
    checked++;
    const statuses = [out.hashes.status, out.versions.status, out.human_accountability.status, out.verdict.status];
    if (statuses.some((s) => s === 'changed' || s === 'regressed')) violations++;
  }
  return { name: 'P3 identical inputs report identical', checked, violations };
}

// P4 — refusals by throw with a named reason.
function checkP4Refusals() {
  let checked = 0, violations = 0;
  const expectThrow = (pp, label) => {
    checked++;
    try {
      compute(pp);
      violations++;
      console.log('  miss: ' + label + ' did not throw');
    } catch (e) {
      if (!e || !e.message || e.message.length < 8) violations++;
    }
  };
  expectThrow(null, 'pp null');
  expectThrow('x', 'pp string');
  expectThrow([], 'pp array');
  expectThrow({}, 'missing both sides');
  expectThrow({ bundle_a: artifact('h1', '1.0.0', 'PASS') }, 'missing bundle_b');
  expectThrow({ bundle_b: artifact('h1', '1.0.0', 'PASS') }, 'missing bundle_a');
  expectThrow({ bundle_a: { nope: 1 }, bundle_b: artifact('h1', '1.0.0', 'PASS') }, 'unknown class A');
  expectThrow({ bundle_a: artifact('h1', '1.0.0', 'PASS'), bundle_b: [1, 2] }, 'unknown class B');
  expectThrow({ bundle_a: artifact('h1', '1.0.0', 'PASS'), bundle_b: artifact('h2', '1.0.0', 'PASS'), as_of: 'not-a-date' }, 'bad as_of');
  const overrideRecord = [{ record_type: 'override', role: 'approver', identity: { id: 'x' }, override: { expiry: '2026-12-01T00:00:00.000Z' } }];
  expectThrow({ bundle_a: overrideRecord, bundle_b: overrideRecord }, 'override pair without as_of');
  // non-override records arrays do NOT require as_of
  checked++;
  try {
    compute({ bundle_a: [{ record_type: 'approval', role: 'reviewer', identity: { id: 'x' } }], bundle_b: [{ record_type: 'approval', role: 'reviewer', identity: { id: 'x' } }] });
  } catch (e) {
    violations++;
    console.log('  miss: plain records array refused: ' + e.message);
  }
  return { name: 'P4 refusals by throw with named reason', checked, violations };
}

// P5 — verdict regression rule restated.
function checkP5VerdictRegression() {
  let checked = 0, violations = 0;
  const verdicts = ['PASS', 'FAIL', 'REJECT', 'HOLD', 'WARN', 'pass', 'failed'];
  const isNeg = (v) => /fail|reject|hold/i.test(String(v));
  for (const va of verdicts) {
    for (const vb of verdicts) {
      const out = compute({ bundle_a: artifact('h', '1.0.0', va), bundle_b: artifact('h2', '1.0.0', vb) }).output_payload.verdict;
      const wantRegressed = va !== vb && isNeg(vb) && !isNeg(va);
      checked++;
      if (out.regressed !== wantRegressed) violations++;
      checked++;
      if ((out.status === 'regressed') !== wantRegressed) violations++;
      checked++;
      if (out.value_a !== va || out.value_b !== vb) violations++;
    }
  }
  return { name: 'P5 verdict regression rule', checked, violations };
}

// P6 — accountability shape migration is not a diff row.
function checkP6ShapeMigrationInvariance() {
  let checked = 0, violations = 0;
  const records = [
    { record_type: 'approval', role: 'reviewer', identity: { id: 'did:key:zR' }, subject_hash: 'sh1' },
    { record_type: 'approval', role: 'engagement_approver', identity: { id: 'did:key:zA' } },
  ];
  const bundle = { subject_hash: 'sh1', reviewers: ['did:key:zR'], approvers: ['did:key:zA'] };
  const out = compute({ bundle_a: records, bundle_b: bundle }).output_payload.human_accountability;
  checked++;
  if (out.rows.length !== 0) violations++;
  checked++;
  if (out.status !== 'unchanged') violations++;
  checked++;
  if (out.shape_a === out.shape_b) violations++; // shapes do differ, and that is reported as shape, not as rows
  // and the mirror direction
  const out2 = compute({ bundle_a: bundle, bundle_b: records }).output_payload.human_accountability;
  checked++;
  if (out2.rows.length !== 0) violations++;
  return { name: 'P6 accountability shape migration invariance', checked, violations };
}

// P7 — depth cap refuses a 250-level nest.
function checkP7DepthCap() {
  let checked = 0, violations = 0;
  let nested = /** @type {any} */ ({ tail: true });
  for (let i = 0; i < 250; i++) nested = { nested };
  const deep = { execution_hash: 'h', output_payload: nested };
  checked++;
  try {
    compute({ bundle_a: deep, bundle_b: { execution_hash: 'h' } });
    violations++;
  } catch (e) {
    if (!/nesting exceeds 200/i.test(e.message)) violations++;
  }
  return { name: 'P7 depth cap refusal', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1DeterminismAndShape(),
  checkP2MapDiffRestated(),
  checkP3Identity(),
  checkP4Refusals(),
  checkP5VerdictRegression(),
  checkP6ShapeMigrationInvariance(),
  checkP7DepthCap(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — bundle-diff kernel.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
