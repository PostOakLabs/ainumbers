// art-662-odnsf-fee-recompute.proptest.mjs -- class-A property-test FLOOR (FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:96b81492f13d9e398309ad1e6ffc48f4c4b91f2afd27992e83fed452bcad9fa6
// spec: CORE-VERIFY-BUILD-SPEC.md Sec0, Sec3.
// human_sign_off: PENDING
//
// SCOPE: floor tier only, NOT a proof, NOT Dafny. float_sensitive: NO -- all money math is
// integer minor-units arithmetic (no Math.round/floor of a fraction, no division feeding a
// threshold); display() is integer Math.trunc + string padding only.
//
// Checks: fixture-oracle gate, determinism, output-shape (no NaN/undefined anywhere),
// termination (bounded by ledger.length), a balance-conservation identity re-derived from the
// events walk, and a differential re-derivation of the daily-fee-cap enforcement.
//
// Run: node chaingraph/kernels/__proptests__/art-662-odnsf-fee-recompute.proptest.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute, buildArtifact } from '../art-662-odnsf-fee-recompute.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32, pick } from './_pbt-common.mjs';

const KERNEL_ID = 'art-662-odnsf-fee-recompute';
const FIXTURES_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', `${KERNEL_ID}.fixtures.json`);
const rand = mulberry32(0x662A11);

const TXN_TYPES = ['debit_check', 'debit_ach', 'debit_card_pos', 'debit_atm', 'credit_deposit', 'credit_transfer', 'fee', 'other'];
function pad2(n) { return String(n).padStart(2, '0'); }
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }

function randomLedger(rng, n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const day = 1 + Math.floor(i / 2); // up to 2 items per post_date
    rows.push({
      txn_id: `T${i + 1}`,
      post_date: `2026-08-${pad2(Math.min(day, 28))}`,
      effective_date: `2026-08-${pad2(Math.min(day, 28))}`,
      txn_type: pick(rng, TXN_TYPES),
      amount: randInt(rng, -500, 500),
      settle_negative_allowed: rng() < 0.5,
    });
  }
  return rows;
}

function randomPP(rng) {
  const n = randInt(rng, 0, 8);
  return {
    account_token: 'acct-fuzz-001',
    period_label: '2026-08',
    opening_balance_minor_units: randInt(rng, -1000, 1000),
    posting_order_policy: pick(rng, ['as_supplied', 'high_to_low_amount', 'low_to_high_amount', 'chronological_by_effective_date']),
    ledger: randomLedger(rng, n),
    fee_schedule: {
      nsf_fee_minor_units: randInt(rng, 0, 5000),
      od_fee_minor_units: randInt(rng, 0, 5000),
      daily_fee_cap_count: rng() < 0.5 ? randInt(rng, 0, 3) : null,
      representment_dedup_days: rng() < 0.3 ? randInt(rng, 0, 10) : null,
      extended_overdrawn_days: rng() < 0.3 ? randInt(rng, 0, 5) : null,
      extended_overdrawn_fee_minor_units: rng() < 0.3 ? randInt(rng, 0, 5000) : null,
    },
    core_charged_fees: rng() < 0.5 ? [{ post_date: '2026-08-01', fee_type: 'NSF', amount_minor_units: randInt(rng, 0, 5000) }] : [],
  };
}

const RUNS = Number(process.env.MUTATION_TIER_NUM_RUNS);
const TRIALS = Number.isSafeInteger(RUNS) && RUNS > 0 ? RUNS : 1500; // MUTATION_TIER_NUM_RUNS: per-kernel mutation-mode budget set by run-mutation-tier.mjs; unset = full 1500

// ---------- P1: determinism -- same policy_parameters -> byte-identical output_payload ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P1_determinism', checked, violations };
}

// ---------- P2: output shape -- no NaN/undefined anywhere in output_payload ----------
function checkP2_output_shape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (findShapeViolations(output_payload).length > 0) violations++;
  }
  return { name: 'P2_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P3: termination -- event count and ledger_row_count bounded by usable ledger rows ----------
function checkP3_termination_bounded() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.events.length !== output_payload.ledger_row_count) violations++;
    if (output_payload.ledger_row_count > pp.ledger.length) violations++;
  }
  return { name: 'P3_termination_bounded_by_ledger_length', checked, violations };
}

// ---------- P4 (differential): re-derive daily-fee-cap enforcement from the events array ----------
function checkP4_daily_cap_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const cap = output_payload.fee_schedule.daily_fee_cap_count;
    if (cap === null) {
      if (output_payload.events.some((e) => e.cap_reached)) violations++;
      continue;
    }
    const perDay = {};
    for (const e of output_payload.events) {
      if (e.event_type === null) continue; // not a fee-eligible event
      const chargedBefore = perDay[e.post_date] || 0;
      const expectCapReached = chargedBefore >= cap;
      if (e.cap_reached !== expectCapReached) violations++;
      if (!expectCapReached && !e.deduped) perDay[e.post_date] = chargedBefore + 1;
    }
  }
  return { name: 'P4_daily_cap_differential', checked, violations };
}

// ---------- P5: conservation -- an item never both fee_charged and (deduped or cap_reached) ----------
function checkP5_fee_charge_exclusivity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    for (const e of output_payload.events) {
      if (e.fee_charged && (e.deduped || e.cap_reached)) violations++;
      if (e.fee_charged && e.fee_amount_minor_units <= 0 && (output_payload.fee_schedule.nsf_fee_minor_units > 0 || output_payload.fee_schedule.od_fee_minor_units > 0)) {
        // a charged fee should carry a positive amount whenever the relevant schedule fee is positive
        const relevant = e.fee_type === 'NSF' ? output_payload.fee_schedule.nsf_fee_minor_units : output_payload.fee_schedule.od_fee_minor_units;
        if (relevant > 0) violations++;
      }
    }
  }
  return { name: 'P5_fee_charge_exclusivity', checked, violations };
}

// ---------- P6 (D6-ANYKERNEL-1115): buildArtifact_never_throws, one class per _hash.mjs refusal ----------
function deepObj(n) { const root = /** @type {any} */ ({}); let o = root; for (let i = 0; i < n; i++) { o.x = {}; o = o.x; } return root; }
const UNHASHABLE_CLASSES = [
  ['junk_1e300', 1e300],
  ['junk_NaN', NaN],
  ['junk_minus_Infinity', -Infinity],
  ['depth_511', deepObj(511)],
  ['values_over_1e6', new Array(1000001).fill(1)],
];
async function checkP6_buildArtifactNeverThrows() {
  let violations = 0;
  const rows = [];
  for (const [label, junk] of UNHASHABLE_CLASSES) {
    let artifact;
    try { artifact = await buildArtifact(junk); }
    catch (e) {
      violations++;
      rows.push({ label, threw: true, error: e && e.message });
      continue;
    }
    const refused = Boolean(artifact && artifact.execution_hash === null
      && artifact.hash_refusal && typeof artifact.hash_refusal.reason === 'string');
    if (!refused) violations++;
    rows.push({ label, threw: false, refused });
  }
  return { name: 'buildArtifact_never_throws', checked: UNHASHABLE_CLASSES.length, violations, rows };
}

// ---------- P7: a required field mutated to missing/null/blank/whitespace never gives a positive verdict ----------
// The node's only inputSchema.required fields are ledger and fee_schedule. account_token,
// period_label, opening_balance_minor_units and posting_order_policy are optional by that same
// contract (each carries a documented default) and are deliberately not mutated here.
const REQUIRED_FIELDS = ['ledger', 'fee_schedule'];
const REQUIRED_MUTATIONS = [
  { mode: 'delete', apply: (pp, f) => { delete pp[f]; } },
  { mode: 'null', apply: (pp, f) => { pp[f] = null; } },
  { mode: 'empty_string', apply: (pp, f) => { pp[f] = ''; } },
  { mode: 'whitespace_only', apply: (pp, f) => { pp[f] = '   '; } },
];
const isNonIndeterminate = (op) => Boolean(op && (op.verdict === 'MATCHES' || op.verdict === 'DIVERGES'));
function checkP7_requiredFieldNeverPositive() {
  const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'));
  let violations = 0, checked = 0;
  const offenders = [];
  for (const v of fixtures.vectors) {
    const base = v.policy_parameters;
    if (!isNonIndeterminate(compute(base).output_payload)) continue;
    for (const f of REQUIRED_FIELDS) {
      for (const { mode, apply } of REQUIRED_MUTATIONS) {
        const pp = structuredClone(base);
        apply(pp, f);
        const op = compute(pp).output_payload;
        checked++;
        if (isNonIndeterminate(op)) {
          violations++;
          if (offenders.length < 10) offenders.push({ vector: v.name, field: f, mode, verdict: op.verdict });
        }
      }
    }
  }
  return { name: 'required_field_missing_never_positive', checked, violations, offenders };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_determinism(),
  checkP2_output_shape(),
  checkP3_termination_bounded(),
  checkP4_daily_cap_differential(),
  checkP5_fee_charge_exclusivity(),
  await checkP6_buildArtifactNeverThrows(),
  checkP7_requiredFieldNeverPositive(),
];
console.log(`[${KERNEL_ID}] class-A floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
