// art-291-screen-onledger-transfer-batch.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C10-1).
// kernel_digest_at_authoring: sha256:8b96056cb0c7a9e5152efaff0a3b8d4eb6cf558db3e7627a0aef99ed7511841b
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (name/purpose-code screen is string equality + array membership, no
// arithmetic on the screened amounts).
// Checks: fixture-oracle gate, termination (per_transfer.length bounded by transfers.length),
// differential re-derivation of each transfer's status, boundedness of coverage_gaps, and
// metamorphic prefix-invariance (each transfer's own screening result depends only on itself
// and the shared flagged-names list, never on sibling transfers).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-291-screen-onledger-transfer-batch.proptest.mjs

import { compute } from '../art-291-screen-onledger-transfer-batch.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-291-screen-onledger-transfer-batch.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x291A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const NAMES = ['Alice Corp', 'Bob Ltd', 'sanctioned party a', 'Carol Inc', 'Dan LLC', ''];
const PURPOSE_CODES = ['SALA', 'SUPP', 'TRAD', 'INTC', 'GDDS', 'SVCS', 'TAXS', 'DIVI', 'LOAN', 'BADCODE', undefined];

function randomTransfer(rng) {
  return {
    originator: pick(rng, NAMES),
    beneficiary: pick(rng, NAMES),
    amount: Math.floor(rng() * 10000),
    purpose_code: pick(rng, PURPOSE_CODES),
  };
}
function randomTransfers(rng, n) { return Array.from({ length: n }, () => randomTransfer(rng)); }

function randomFlaggedNames(rng) {
  const opts = ['sanctioned party a', 'Alice Corp', 'nobody'];
  return rng() < 0.8 ? [pick(rng, opts)] : null; // null => coverage gap
}

function normalizeName(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
const VALID_PURPOSE_CODES = ['SALA', 'SUPP', 'TRAD', 'INTC', 'GDDS', 'SVCS', 'TAXS', 'DIVI', 'LOAN'];

const TRIALS = 5000;

// ---------- P1: termination — per_transfer.length and transfer_count bounded by transfers.length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const transfers = randomTransfers(rand, n);
    const flaggedNames = randomFlaggedNames(rand);
    const { output_payload } = compute({ transfers, screening_lists_meta: flaggedNames ? { flagged_names: flaggedNames } : {} });
    checked++;
    if (output_payload.per_transfer.length !== n) violations++;
    if (output_payload.transfer_count !== n) violations++;
  }
  return { name: 'P1_termination_bounded_by_transfers_length', trials: checked, violations };
}

// ---------- P2 (differential): per-transfer status re-derived independently ----------
function checkP2_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const transfers = randomTransfers(rand, n);
    const flaggedNamesRaw = randomFlaggedNames(rand);
    const flaggedNames = flaggedNamesRaw ? flaggedNamesRaw.map(normalizeName).filter(Boolean) : null;
    const { output_payload } = compute({ transfers, screening_lists_meta: flaggedNamesRaw ? { flagged_names: flaggedNamesRaw } : {} });
    checked++;
    output_payload.per_transfer.forEach((r, idx) => {
      const t = transfers[idx];
      const originator = normalizeName(t.originator);
      const beneficiary = normalizeName(t.beneficiary);
      const purpose_code_ok = VALID_PURPOSE_CODES.includes(t.purpose_code);
      let expectedHits = 0;
      if (flaggedNames) {
        if (originator && flaggedNames.includes(originator)) expectedHits++;
        if (beneficiary && flaggedNames.includes(beneficiary)) expectedHits++;
      }
      const expectedStatus = expectedHits > 0 ? 'hit' : !purpose_code_ok ? 'flagged_purpose_code' : 'clean';
      if (r.status !== expectedStatus) violations++;
      if (r.purpose_code_ok !== purpose_code_ok) violations++;
      if (r.hits.length !== expectedHits) violations++;
    });
  }
  return { name: 'P2_per_transfer_status_differential', trials: checked, violations };
}

// ---------- P3: boundedness — coverage_gaps only from the 2 known messages, batch_clean iff both hold ----------
function checkP3_coverage_gaps_bounded() {
  let violations = 0, checked = 0;
  const KNOWN = [
    'screening_lists_meta.flagged_names not supplied; sanctions coverage is a gap for this batch.',
    'transfers[] is empty; nothing to screen.',
  ];
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const transfers = randomTransfers(rand, n);
    const flaggedNamesRaw = randomFlaggedNames(rand);
    const { output_payload } = compute({ transfers, screening_lists_meta: flaggedNamesRaw ? { flagged_names: flaggedNamesRaw } : {} });
    checked++;
    for (const g of output_payload.coverage_gaps) if (!KNOWN.includes(g)) violations++;
    const expectedClean = output_payload.coverage_gaps.length === 0 && output_payload.per_transfer.every((r) => r.status === 'clean');
    if (output_payload.batch_clean !== expectedClean) violations++;
  }
  return { name: 'P3_coverage_gaps_bounded_and_batch_clean_correct', trials: checked, violations };
}

// ---------- P4: metamorphic — each transfer's result is independent of sibling transfers ----------
function checkP4_transfer_independence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rand() * 8);
    const base = randomTransfers(rand, n);
    const extraN = Math.floor(rand() * 5);
    const extra = randomTransfers(rand, extraN);
    const flaggedNamesRaw = randomFlaggedNames(rand);
    const meta = flaggedNamesRaw ? { flagged_names: flaggedNamesRaw } : {};
    const r1 = compute({ transfers: base, screening_lists_meta: meta }).output_payload;
    const r2 = compute({ transfers: base.concat(extra), screening_lists_meta: meta }).output_payload;
    checked++;
    for (let idx = 0; idx < n; idx++) {
      if (JSON.stringify(r1.per_transfer[idx]) !== JSON.stringify({ ...r2.per_transfer[idx], index: r1.per_transfer[idx].index })) {
        // index differs only if it does; compare status/hits/purpose_code_ok directly
        if (r1.per_transfer[idx].status !== r2.per_transfer[idx].status
          || r1.per_transfer[idx].purpose_code_ok !== r2.per_transfer[idx].purpose_code_ok
          || JSON.stringify(r1.per_transfer[idx].hits) !== JSON.stringify(r2.per_transfer[idx].hits)) {
          violations++;
        }
      }
    }
  }
  return { name: 'P4_per_transfer_independent_of_siblings', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_status_differential());
results.properties.push(checkP3_coverage_gaps_bounded());
results.properties.push(checkP4_transfer_independence());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-291-screen-onledger-transfer-batch',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
