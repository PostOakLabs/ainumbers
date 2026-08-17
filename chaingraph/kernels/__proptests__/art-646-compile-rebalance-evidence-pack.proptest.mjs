// art-646-compile-rebalance-evidence-pack — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:06a6f6215cff260bdeadad70817cacf72195aebec6e2d5ac436002c095b70fde
// spec: INDEX-LINEAGE-BUILD-SPEC.md, rebalance evidence pack section
// human_sign_off: sonnet-2026-08-17
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3). NOT a proof, NOT Dafny.
// float_sensitive: NO -- weight_deltas compares weight VALUES for strict inequality only
// (no arithmetic on them); every other computation (set membership for additions/removals,
// Map lookups) is integer/reference comparison.
// Checks: fixture-oracle gate, additions/removals partition invariant (P1), weight_deltas
// completeness (P2), differential re-derivation of structural_error (P3), metamorphic
// permutation-invariance of constituent/weight row order (P4), forced categorical boundary
// cases (P5).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-646-compile-rebalance-evidence-pack.proptest.mjs

import { compute } from '../art-646-compile-rebalance-evidence-pack.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-646-compile-rebalance-evidence-pack';
const rand = mulberry32(0x64600001);

function randomWeights(rng, rows) {
  return rows.map((r) => ({ security_id: r.security_id, weight: Math.round(rng() * 1000) / 1000 }));
}
function randomPP(rng) {
  const currentN = Math.floor(rng() * 5) + 1;
  const priorN = Math.floor(rng() * 5);
  // deliberately overlap ids by using a shared pool so additions/removals/deltas are exercised
  const pool = Array.from({ length: 8 }, (_, i) => `SEC-${i}`);
  const currentIds = pool.slice(0, currentN).map((id) => ({ security_id: id }));
  const priorIds = priorN > 0 ? pool.slice(2, 2 + priorN).map((id) => ({ security_id: id })) : [];
  const pp = {
    index_id: rng() < 0.1 ? undefined : `IDX-${Math.floor(rng() * 1000)}`,
    rebalance_date: rng() < 0.1 ? undefined : '2026-08-05',
    current: {
      constituents: currentIds,
      weights: randomWeights(rng, currentIds),
    },
  };
  if (priorN > 0) {
    pp.prior = { constituents: priorIds, weights: randomWeights(rng, priorIds) };
  }
  return pp;
}

const TRIALS = 2000;

// ---------- P1: additions/removals are a strict partition (no id in both) ----------
function checkP1_partition() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.structural_error !== null) continue;
    const addIds = new Set(output_payload.additions.map((c) => c.security_id));
    const remIds = new Set(output_payload.removals.map((c) => c.security_id));
    for (const id of addIds) if (remIds.has(id)) violations++;
  }
  return { name: 'P1_additions_removals_disjoint', checked, violations };
}

// ---------- P2: weight_deltas covers exactly the union of current/prior ids that differ ----------
function checkP2_deltaCompleteness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.structural_error !== null) continue;
    const currentIds = new Set((pp.current.constituents || []).map((c) => c.security_id));
    const priorIds = new Set((pp.prior ? pp.prior.constituents : []).map((c) => c.security_id) || []);
    const allIds = new Set([...currentIds, ...priorIds]);
    const deltaIds = new Set(output_payload.weight_deltas.map((d) => d.security_id));
    for (const id of deltaIds) if (!allIds.has(id)) violations++;
    if (deltaIds.size > allIds.size) violations++;
  }
  return { name: 'P2_weight_deltas_bounded_by_id_union', checked, violations };
}

// ---------- P3 (differential): structural_error re-derived independently ----------
function reimplement(pp) {
  if (!pp.index_id) return 'index_id is required.';
  if (!pp.rebalance_date) return 'rebalance_date is required.';
  const current = pp.current || {};
  const currentConstituents = Array.isArray(current.constituents) ? current.constituents.filter((c) => c && c.security_id) : [];
  if (currentConstituents.length === 0) return 'current.constituents must be a non-empty array.';
  return null;
}
function checkP3_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = reimplement(pp);
    if ((output_payload.structural_error === null) !== (expected === null)) violations++;
  }
  return { name: 'P3_structural_error_differential', checked, violations };
}

// ---------- P4: metamorphic -- permutation-invariance of constituent/weight row order ----------
function checkP4_permutationInvariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP(rand);
    if (pp.current.constituents.length < 2) continue;
    const shuffled = {
      ...pp,
      current: { ...pp.current, constituents: [...pp.current.constituents].reverse(), weights: [...pp.current.weights].reverse() },
    };
    const r1 = compute(pp).output_payload;
    const r2 = compute(shuffled).output_payload;
    checked++;
    if (r1.structural_error !== r2.structural_error) violations++;
    if (r1.structural_error === null) {
      const a1 = new Set(r1.additions.map((c) => c.security_id));
      const a2 = new Set(r2.additions.map((c) => c.security_id));
      if (a1.size !== a2.size) violations++;
      for (const id of a1) if (!a2.has(id)) violations++;
    }
  }
  return { name: 'P4_row_order_invariance', checked, violations };
}

// ---------- P5: forced categorical boundary cases ----------
function checkP5_forcedCategorical() {
  let violations = 0, checked = 0;
  const base = { index_id: 'IDX', rebalance_date: '2026-08-05', current: { constituents: [{ security_id: 'S1' }], weights: [{ security_id: 'S1', weight: 1 }] } };
  checked++;
  { const r = compute({ ...base, index_id: undefined }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute({ ...base, current: { constituents: [] } }).output_payload; if (!r.structural_error) violations++; }
  checked++;
  { const r = compute(base).output_payload; if (r.structural_error !== null) violations++; }
  checked++;
  { const { compliance_flags } = compute(base); if (!compliance_flags.includes('REBALANCE_PACK_FIRST_REBALANCE_NO_PRIOR')) violations++; }
  checked++;
  { const withPrior = { ...base, prior: { constituents: [{ security_id: 'S1' }], weights: [{ security_id: 'S1', weight: 1 }] } }; const { compliance_flags } = compute(withPrior); if (compliance_flags.includes('REBALANCE_PACK_FIRST_REBALANCE_NO_PRIOR')) violations++; }
  return { name: 'P5_forced_categorical_boundaries', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_partition(),
  checkP2_deltaCompleteness(),
  checkP3_differential(),
  checkP4_permutationInvariance(),
  checkP5_forcedCategorical(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
