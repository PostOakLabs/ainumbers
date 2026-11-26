// art-709-v4-hook-fee-conformance — class-K property test floor, authored by ART709-V4HOOK-FEE-CONFORMANCE-1.
// spec: RHC hooks build spec Addendum art-709 (research/rhc-hooks/RHC-HOOKS-BUILD-SPEC-2026-10-03.md),
// Uniswap v4-core LPFeeLibrary.sol / ProtocolFeeLibrary.sol / Pool.sol at the pinned commit
// a7cf038cd568801a79a9b4cf92cd5b52c95c8585
// kernel_digest_at_authoring: sha256:006276eea211adf270ea4964fa8024c40abe4849bd45ced5872f07da1733bcfc
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-709-v4-hook-fee-conformance.proptest.mjs

import { readFileSync } from 'node:fs';
import { compute, calculateSwapFee } from '../art-709-v4-hook-fee-conformance.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-709-v4-hook-fee-conformance';
const TRIALS = 2000;
const rand = mulberry32(0x709CB);
const PIN = 'a7cf038cd568801a79a9b4cf92cd5b52c95c8585';

function rngPick(rng, n) { return rng() * n; }

function mkBase(rng) {
  const protoDir = Math.floor(rngPick(rng, 4)) === 0 ? 0 : Math.floor(rngPick(rng, 1001));
  const protoFee = rng() < 0.3 ? 0 : protoDir + (rng() < 0.2 ? Math.floor(rngPick(rng, 1001)) * 4096 : 0);
  const poolFee = rng() < 0.15 ? 0x800000 : Math.floor(rngPick(rng, 1000001));
  const splits = rng() < 0.5
    ? [{ recipient_label: 'treasury', share_bps: 10000 }]
    : [{ recipient_label: 'lp_side_pool', share_bps: 6000 }, { recipient_label: 'treasury', share_bps: 4000 }];
  return {
    protocol_fee: protoFee,
    pool_fee: poolFee,
    declared_lp_fee_bounds: { min_pips: 0, max_pips: 1000000 },
    declared_hook_charge: { rate_pips: Math.floor(rngPick(rng, 5000)), splits },
    swaps: [{
      index: 0,
      zero_for_one: rng() < 0.5,
      amount_in: Math.floor(rngPick(rng, 100000000)),
      emitted_fee_pips: Math.floor(rngPick(rng, 1000001)),
    }],
  };
}

// Independent reference of the pinned formula (ProtocolFeeLibrary L38-46) — plain numbers,
// deliberately not routed through the kernel's BigInt helper.
function refSwapFee(protoDir, lpFee) {
  return protoDir + lpFee - Math.floor((protoDir * lpFee) / 1e6);
}

// ---------- P1 (row-mandated): the composed fee is never below either of its parts ----------
function checkP1_composedFeeDominates() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const protoDir = Math.floor(rngPick(rand, 1001));
    const lpFee = Math.floor(rngPick(rand, 1000001));
    const composed = Number(calculateSwapFee(BigInt(protoDir), BigInt(lpFee)));
    checked++;
    if (composed < protoDir || composed < lpFee) violations++;
    if (composed !== refSwapFee(protoDir, lpFee)) violations++;
  }
  return { name: 'P1_composed_fee_ge_max_protocol_lp', checked, violations };
}

// ---------- P2 (row-mandated): raising the LP fee never lowers the swap fee ----------
function checkP2_monotoneInLpFee() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const protoDir = Math.floor(rngPick(rand, 1001));
    const lp = Math.floor(rngPick(rand, 1000000));
    const delta = 1 + Math.floor(rngPick(rand, 1000000 - lp));
    const a = Number(calculateSwapFee(BigInt(protoDir), BigInt(lp)));
    const b = Number(calculateSwapFee(BigInt(protoDir), BigInt(lp + delta)));
    checked++;
    if (b < a) violations++;
  }
  return { name: 'P2_swap_fee_monotone_non_decreasing_in_lp_fee', checked, violations };
}

// ---------- P3 (row-mandated): per-recipient split totals + remainder conserve the hook charge ----------
function checkP3_splitConservation() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkBase(rand);
    const multi = pp.declared_hook_charge.splits.length > 1;
    const r = compute(pp).output_payload;
    checked++;
    if (r.error) continue;
    for (const row of r.per_swap) {
      if (row.lp_fee_pips === null) continue;
      const parts = Object.values(row.hook_charge_per_recipient);
      const sum = parts.reduce((acc, p) => acc + p.amount, 0);
      const rem = parts.reduce((acc, p) => acc + p.remainder, 0);
      if (multi) {
        // each share floors independently: sum of shares <= hook charge, gap fully reported
        if (sum > row.hook_charge_amount) violations++;
        // the swap-level remainder is the unallocated residue: charge minus total allocated
        if (sum + row.hook_charge_remainder !== row.hook_charge_amount) violations++;
        // each recipient's own floor remainder is below the share denominator
        if (parts.some((p) => p.remainder >= 10000)) violations++;
      } else if (sum !== row.hook_charge_amount || rem !== 0 || row.hook_charge_remainder !== 0) {
        violations++;
      }
      // LP revenue is never netted against the hook charge: both appear side by side
      if (row.lp_revenue_amount !== Math.floor((row.amount_in * row.lp_fee_pips) / 1e6)) violations++;
      const expectHook = Math.floor((row.amount_in * pp.declared_hook_charge.rate_pips) / 1e6);
      if (row.hook_charge_amount !== expectHook) violations++;
    }
    // totals per recipient equal the sum of per-swap parts
    for (const [label, tot] of Object.entries(r.totals.per_recipient)) {
      let s = 0;
      for (const row2 of r.per_swap) s += ((row2.hook_charge_per_recipient[label] || {}).amount) || 0;
      if (tot.amount !== s) violations++;
    }
  }
  return { name: 'P3_split_totals_plus_reported_remainder_conserve_hook_charge', checked, violations };
}

// ---------- P4: swap-fee recomputation matches an independent reference; status precedence ----------
function checkP4_recomputeAndStatuses() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkBase(rand);
    const dyn = pp.pool_fee === 0x800000;
    // exact-out reverts only at or above MAX_SWAP_FEE; an override on a static pool is ignored
    if (rand() < 0.25) pp.swaps[0].exact_out = true;
    if (!dyn && rand() < 0.25) pp.swaps[0].lp_fee_override = 0x400000 + Math.floor(rngPick(rand, 1000001));
    const exactOut = pp.swaps[0].exact_out === true;
    const protoDir = pp.swaps[0].zero_for_one ? (pp.protocol_fee & 0xfff) : ((pp.protocol_fee >> 12) & 0xfff);
    const r = compute(pp).output_payload;
    checked++;
    if (r.error) continue;
    const row = r.per_swap[0];
    if (dyn) {
      if (row.status !== 'INDETERMINATE' || row.indeterminate_reason === null) violations++;
      continue;
    }
    const ref = refSwapFee(protoDir, pp.pool_fee);
    if (row.swap_fee_pips !== ref) violations++;
    const oob = pp.pool_fee < pp.declared_lp_fee_bounds.min_pips || pp.pool_fee > pp.declared_lp_fee_bounds.max_pips;
    if (row.lp_fee_source !== 'pool_static' || row.lp_fee_pips !== pp.pool_fee) violations++;
    const expect = exactOut && ref >= 1000000 ? 'INDETERMINATE'
      : oob ? 'OUT_OF_BOUNDS'
        : (row.emitted_fee_pips !== ref) ? 'FEE_MISMATCH' : 'CONFORMS';
    if (row.status !== expect) violations++;
    if (!['CONFORMS', 'OUT_OF_BOUNDS', 'FEE_MISMATCH', 'INDETERMINATE'].includes(row.status)) violations++;
  }
  return { name: 'P4_swap_fee_matches_independent_reference_and_status_precedence', checked, violations };
}

// ---------- P5: refusal contract — kill power over malformed inputs ----------
function checkP5_refusalContract() {
  let violations = 0, checked = 0;
  const base = mkBase(rand);
  base.pool_fee = 3000;
  const cases = [];
  cases.push([{ ...base, protocol_fee: 1.5 }, 'protocol_fee_invalid']);
  cases.push([{ ...base, protocol_fee: -1 }, 'protocol_fee_invalid']);
  cases.push([{ ...base, pool_fee: 16777216 }, 'pool_fee_invalid']);
  cases.push([{ ...base, declared_lp_fee_bounds: { min_pips: 5000, max_pips: 1000 } }, 'lp_fee_bounds_invalid']);
  cases.push([{ ...base, declared_lp_fee_bounds: { min_pips: 0 } }, 'lp_fee_bounds_invalid']);
  cases.push([{ ...base, declared_hook_charge: { rate_pips: 500, splits: [{ recipient_label: 'x', share_bps: 10001 }] } }, 'hook_charge_splits_invalid']);
  cases.push([{ ...base, declared_hook_charge: { rate_pips: 500, splits: 'all' } }, 'hook_charge_splits_invalid']);
  cases.push([{ ...base, declared_total_fee_cap_pips: 2000000 }, 'total_fee_cap_invalid']);
  cases.push([{ ...base, swaps: [] }, 'swaps_invalid']);
  cases.push([{ ...base, swaps: [{ ...base.swaps[0], amount_in: -5 }] }, 'swap_entry_invalid']);
  cases.push([{ ...base, swaps: [{ ...base.swaps[0], index: 1 }, { ...base.swaps[0], index: 1 }] }, 'swap_index_duplicate']);
  cases.push([{ ...base, swaps: [{ ...base.swaps[0], lp_fee_override: 16777216 }] }, 'lp_fee_override_invalid']);
  for (const [pp, code] of cases) {
    const r = compute(pp);
    checked++;
    if (r.output_payload.error !== code) violations++;
    if (r.compliance_flags[0] !== 'INPUT_REFUSED') violations++;
    if (!r.output_payload.domain_errors || r.output_payload.domain_errors.length !== 1) violations++;
  }
  return { name: 'P5_refusal_contract_kill_power', checked, violations };
}

// ---------- P6: output shape, determinism and the evidence-only contract ----------
function checkP6_outputShapeDeterminism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const pp = mkBase(rand);
    if (rand() < 0.4) pp.declared_total_fee_cap_pips = Math.floor(rngPick(rand, 1000001));
    if (rand() < 0.2) pp.swaps[0].exact_out = true;
    const a = compute(pp); const b = compute(pp);
    const out = a.output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if (out.error) continue;
    if (!Array.isArray(out.per_swap) || !Array.isArray(out.assumptions)) violations++;
    if (out.v4_core_commit !== PIN) violations++;
    if (typeof out.fee_story_explained !== 'boolean') violations++;
    if (!out.totals || typeof out.totals.lp_revenue !== 'number'
      || typeof out.totals.hook_charge !== 'number' || typeof out.totals.hook_charge_remainder !== 'number') violations++;
    if (!out.assumptions.some((x) => /never reads a chain/.test(x))) violations++;
    if (!out.assumptions.some((x) => /never netted against the hook charge/.test(x))) violations++;
  }
  return { name: 'P6_output_shape_determinism_evidence_only', checked, violations };
}

// ---------- PF1 (KERNEL-BIGINT-F1-SAFE-FORMAT-1): a BigInt on protocol_fee refuses, never throws ----------
// RED on main: compute() threw "Do not know how to serialize a BigInt" while building the
// protocol_fee_invalid refusal detail. GREEN on head: the same input returns the refusal
// (measured across 4 BigInt values on this field, origin/main 0289be7577 vs this branch).
function checkPF1_bigintInputRefusesWithoutThrowing() {
  let violations = 0, checked = 0;
  const fixtures = JSON.parse(readFileSync(new URL('../fixtures/art-709-v4-hook-fee-conformance.fixtures.json', import.meta.url), 'utf8'));
  for (const big of [7n, 123456789012345678901234567890n, -1n, 0n]) {
    const pp = structuredClone(fixtures.vectors[0].policy_parameters);
    pp.protocol_fee = big;
    checked++;
    try {
      const r = compute(pp);
      const out = r && r.output_payload;
      if (!out) { violations++; continue; }
      const dcode = out.domain_errors && out.domain_errors[0] && out.domain_errors[0].code;
      if (dcode !== 'PROTOCOL_FEE_INVALID') violations++;
    } catch (e) {
      violations++; // the serialization throw this cure removes
    }
  }
  return { name: 'PF1_bigint_protocol_fee_refuses_without_throwing', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_composedFeeDominates(),
  checkP2_monotoneInLpFee(),
  checkP3_splitConservation(),
  checkP4_recomputeAndStatuses(),
  checkP5_refusalContract(),
  checkP6_outputShapeDeterminism(),
  checkPF1_bigintInputRefusesWithoutThrowing(),
];
console.log('[' + KERNEL_ID + '] class-K floor property test — ' + properties.length + ' properties.');
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
