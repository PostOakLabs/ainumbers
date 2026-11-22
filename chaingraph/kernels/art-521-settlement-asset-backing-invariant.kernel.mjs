/**
 * art-521-settlement-asset-backing-invariant.kernel.mjs
 * INBOUND-EVIDENCE-BUILD-SPEC.md §6.6 -- settlement-asset backing invariant.
 *
 * ⛔ THIS DOES NOT SWEEP OR NET. `106-treasury-float-workbench` already ships a Sweep
 * Optimizer across five accounts with cut-off times over a 13-week horizon; `art-259` and
 * `art-368` already net multilateral and FX positions. None of them checks whether moving
 * value between buffers preserves the AGGREGATE backing composition of the buffer set --
 * a movement that leaves the buffer set's total balance unchanged can still break the
 * invariant if it moves value out of a buffer that backs circulation into one that does
 * not. That is the one thing this kernel does that none of the three above do.
 *
 * THE INVARIANT. Each buffer declares what it backs via `backs`: `"circulation"` (counts
 * toward the aggregate backing check for value already in circulation) or anything else
 * (does not count -- e.g. a settlement balance backing NEW issuance, not existing
 * circulation). Aggregate backing = sum of balances across buffers where
 * `backs === "circulation"`. A movement that changes which buffer holds a balance changes
 * the COMPOSITION of that sum even when the buffer set's grand total is unchanged. This is
 * the aggregate property the row exists to check; it is not visible per-account.
 *
 * SETTLEMENT-ASSET AGNOSTIC BY CONSTRUCTION. No currency, scheme, country, or issuer is
 * named anywhere in this file. The caller declares each buffer's id, role, asset type, and
 * what it backs. The same kernel runs unchanged for centrally-issued digital cash, a
 * pooled-account-backed digital cash, and a reserve-backed stablecoin -- see the fixtures
 * for all three, with zero kernel difference between them.
 *
 * ⛔ NO RESERVE ATTESTATION HERE. `art-06`, `art-512`, `art-280` supply reserve facts where
 * the settlement asset is issuer-reserve-backed; correctly absent where it is centrally
 * issued. Composing those facts into this invariant is a different row's job, not this
 * one's -- this kernel takes buffer balances and the backing ratio as DECLARED inputs.
 *
 * §23 HONEST POSTURE. `execution_hash` proves the computation ran over the balances and
 * movements the caller DECLARED. It proves nothing about whether those declared balances
 * are the true ledger balances at any external system of record. An artifact with zero
 * `input_attestations` is fully conformant; this kernel never fabricates one to paper over
 * that gap.
 *
 * ⛔ NO OPTIMIZER, NO RECOMMENDATION. This kernel reports the invariant, the breaches, and
 * the declared idle/crossing costs. It does not instruct a treasury to move money, does
 * not schedule a sweep, and nothing in its output is financial advice.
 *
 * §27 BOUNDARY. No approver identity, signature, approval field, or role appears anywhere
 * in `output_payload`. A human sign-off over this artifact is a separate record whose
 * `subject_hash` is this artifact's `execution_hash`, never a payload member here.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an integer number of minor
 * units; no floating-point arithmetic in compute(). Non-integer/non-finite/absent amounts
 * are coerced to 0 and named in `rejected_inputs[]`, never silently dropped, never NaN.
 *
 * FINITE GATE. Zero buffers, zero circulation, and an empty movement set each resolve to a
 * DEFINED verdict -- compute() contains no division by an input-derived count, only by the
 * fixed constant 10000 for basis-point rates, so no branch can divide by zero.
 *
 * §10.1 BACKING_NOT_APPLICABLE (INBOUND-BUFFER-MODEL-1). A buffer topology does not exist
 * for every settlement asset -- a direct/one-tier CBDC or a two-tier/intermediated CBDC has
 * NO backing set, because the holder's claim IS central bank money or a claim on the central
 * bank itself. The caller DECLARES this via `backing_model: "vacuous"` (default is
 * `"segregated"`, the pre-existing behaviour, unchanged). The kernel never infers the model
 * from the buffer count: an empty buffer array under the default `"segregated"` model is
 * still `BACKING_INPUTS_INSUFFICIENT` / evaluated for shortfall, exactly as before. Only an
 * EXPLICIT `"vacuous"` declaration produces `BACKING_NOT_APPLICABLE`, and it replaces
 * `BACKING_INTACT`/`BACKING_SHORTFALL`/`BACKING_INPUTS_INSUFFICIENT` entirely -- it is not a
 * pass, it is "this model has no backing question". `backing_intact_before`/`_after` are
 * `null` (not `true`) under a vacuous model so no downstream reader can mistake it for an
 * intact-backing pass. Per-buffer floor/ceiling checks are unaffected -- they are a liquidity
 * property independent of whether a backing question applies. A reserve PORTFOLIO (e.g.
 * fiat-reserve-backed stablecoin) is not a single balance; this kernel does not value one --
 * `art-06`/`art-512`/`art-280` supply reserve facts, unchanged, unedited by this row.
 *
 * NO CLOCK. `as_of` is a caller-declared input; compute() never reads a clock.
 *
 * PII: opaque buffer_id / movement_id strings only. No account holder or customer identity
 * of any kind enters this kernel.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: INBOUND-EVIDENCE-BUILD-SPEC.md §6.6.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-521-settlement-asset-backing-invariant';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'verify_settlement_asset_backing', mandate_type: 'compliance_mandate', gpu: false };

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }

function toMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return 0;
}
function toBpsOrNull(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v >= 0) return v;
  rejected.push({ where, reason: 'absent or not a non-negative integer basis-point rate', supplied: v === undefined ? null : v });
  return null;
}
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / 100);
  const frac = abs - whole * 100;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(2, '0');
}

function toBackingModel(v, rejected) {
  const s = isNonEmptyString(v) ? v.trim() : null;
  if (s === 'vacuous' || s === 'segregated') return s;
  if (s !== null) rejected.push({ where: 'backing_model', reason: 'must be "vacuous" or "segregated"; defaulted to segregated', supplied: s });
  return 'segregated';
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const as_of = isoDateOrNull(pp.as_of);
  const backing_model = toBackingModel(pp.backing_model, rejected_inputs);
  const backing_applicable = backing_model !== 'vacuous';
  const value_in_circulation_minor_units = toMinorUnits(pp.value_in_circulation_minor_units, 'value_in_circulation_minor_units', rejected_inputs);
  const backing_ratio_bps = toBpsOrNull(pp.backing_ratio_bps, 'backing_ratio_bps', rejected_inputs) ?? 10000;
  const idle_cost_bps = toBpsOrNull(pp.idle_cost_bps, 'idle_cost_bps', rejected_inputs) ?? 0;
  const cost_per_crossing_minor_units = toMinorUnits(pp.cost_per_crossing_minor_units, 'cost_per_crossing_minor_units', rejected_inputs);

  // --- Buffers: caller declares N, kernel never assumes three. ---
  const buffersIn = Array.isArray(pp.buffers) ? pp.buffers : [];
  if (!Array.isArray(pp.buffers)) rejected_inputs.push({ where: 'buffers', reason: 'absent or not an array', supplied: pp.buffers === undefined ? null : typeof pp.buffers });
  const seenIds = new Set();
  const buffers = buffersIn.map((b, i) => {
    b = b && typeof b === 'object' ? b : {};
    let buffer_id = isNonEmptyString(b.buffer_id) ? b.buffer_id.trim() : `UNLABELLED-${i + 1}`;
    if (seenIds.has(buffer_id)) { rejected_inputs.push({ where: `buffers[${i}].buffer_id`, reason: 'duplicate buffer_id', supplied: buffer_id }); buffer_id = `${buffer_id}-DUP-${i + 1}`; }
    seenIds.add(buffer_id);
    const role = isNonEmptyString(b.role) ? b.role.trim() : 'unspecified';
    const asset_type = isNonEmptyString(b.asset_type) ? b.asset_type.trim() : 'unspecified';
    const backs = isNonEmptyString(b.backs) ? b.backs.trim() : 'none';
    const balance_minor_units = toMinorUnits(b.balance_minor_units, `buffers[${i}].balance_minor_units`, rejected_inputs);
    const min_minor_units = (b.min_minor_units === undefined || b.min_minor_units === null)
      ? null : toMinorUnits(b.min_minor_units, `buffers[${i}].min_minor_units`, rejected_inputs);
    const max_minor_units = (b.max_minor_units === undefined || b.max_minor_units === null)
      ? null : toMinorUnits(b.max_minor_units, `buffers[${i}].max_minor_units`, rejected_inputs);
    return { buffer_id, role, asset_type, backs, balance_minor_units, min_minor_units, max_minor_units };
  });

  function aggregateCirculationBacking(balances) {
    let sum = 0;
    for (const b of buffers) if (b.backs === 'circulation') sum += balances[b.buffer_id];
    return sum;
  }
  function floorCeilingBreaches(balances) {
    const breaches = [];
    for (const b of buffers) {
      const bal = balances[b.buffer_id];
      if (b.min_minor_units !== null && bal < b.min_minor_units) breaches.push({ buffer_id: b.buffer_id, kind: 'BUFFER_BELOW_FLOOR', balance_minor_units: bal, threshold_minor_units: b.min_minor_units });
      if (b.max_minor_units !== null && bal > b.max_minor_units) breaches.push({ buffer_id: b.buffer_id, kind: 'BUFFER_ABOVE_CEILING', balance_minor_units: bal, threshold_minor_units: b.max_minor_units });
    }
    return breaches;
  }

  const required_backing_minor_units = Math.trunc(value_in_circulation_minor_units * backing_ratio_bps / 10000);

  const balancesBefore = {};
  for (const b of buffers) balancesBefore[b.buffer_id] = b.balance_minor_units;
  const aggregate_backing_before_minor_units = aggregateCirculationBacking(balancesBefore);
  const backing_intact_before = backing_applicable ? (aggregate_backing_before_minor_units >= required_backing_minor_units) : null;
  const breaches_before = floorCeilingBreaches(balancesBefore);

  // --- Declared movement set, applied in order to a working copy. ---
  const movementsIn = Array.isArray(pp.movements) ? pp.movements : [];
  const balancesWorking = { ...balancesBefore };
  const movements = [];
  let movement_breaks_invariant = null;
  const breachedBeforeKeys = new Set(breaches_before.map((x) => `${x.buffer_id}:${x.kind}`));

  movementsIn.forEach((m, i) => {
    m = m && typeof m === 'object' ? m : {};
    const movement_id = isNonEmptyString(m.movement_id) ? m.movement_id.trim() : `MOVE-${i + 1}`;
    const from = isNonEmptyString(m.from) ? m.from.trim() : null;
    const to = isNonEmptyString(m.to) ? m.to.trim() : null;
    const amount_minor_units = toMinorUnits(m.amount_minor_units, `movements[${i}].amount_minor_units`, rejected_inputs);
    const fromKnown = from !== null && Object.prototype.hasOwnProperty.call(balancesWorking, from);
    const toKnown = to !== null && Object.prototype.hasOwnProperty.call(balancesWorking, to);
    if (!fromKnown) rejected_inputs.push({ where: `movements[${i}].from`, reason: 'unknown buffer_id', supplied: from });
    if (!toKnown) rejected_inputs.push({ where: `movements[${i}].to`, reason: 'unknown buffer_id', supplied: to });

    const fromBuf = fromKnown ? buffers.find((b) => b.buffer_id === from) : null;
    const toBuf = toKnown ? buffers.find((b) => b.buffer_id === to) : null;
    const external_crossing = !!(fromBuf && toBuf && fromBuf.asset_type !== toBuf.asset_type);

    const applied = fromKnown && toKnown;
    if (applied) {
      balancesWorking[from] -= amount_minor_units;
      balancesWorking[to] += amount_minor_units;
    }

    if (applied && movement_breaks_invariant === null) {
      const aggAfterThis = aggregateCirculationBacking(balancesWorking);
      const backingBreaksNow = backing_applicable && aggAfterThis < required_backing_minor_units;
      const newFloorBreach = floorCeilingBreaches(balancesWorking).some((x) => !breachedBeforeKeys.has(`${x.buffer_id}:${x.kind}`));
      if (backingBreaksNow || newFloorBreach) {
        movement_breaks_invariant = { movement_id, from, to, amount_minor_units, reason: backingBreaksNow ? 'aggregate circulation backing falls below the required ratio after this movement' : 'this movement puts a buffer below its declared floor or above its declared ceiling' };
      }
    }

    movements.push({ movement_id, from, to, amount_minor_units, applied, external_crossing });
  });

  const aggregate_backing_after_minor_units = aggregateCirculationBacking(balancesWorking);
  const backing_intact_after = backing_applicable ? (aggregate_backing_after_minor_units >= required_backing_minor_units) : null;
  const breaches_after = floorCeilingBreaches(balancesWorking);

  // --- Thinnest-safe-buffer figure per buffer, given the declared floor, on the resulting state. ---
  const buffer_margins = buffers
    .filter((b) => b.min_minor_units !== null)
    .map((b) => ({ buffer_id: b.buffer_id, safe_margin_minor_units: balancesWorking[b.buffer_id] - b.min_minor_units }));
  let thinnest_buffer = null;
  for (const m of buffer_margins) {
    if (thinnest_buffer === null || m.safe_margin_minor_units < thinnest_buffer.safe_margin_minor_units) thinnest_buffer = m;
  }

  // --- Declared idle-balance cost vs declared crossing cost, over the resulting state. ---
  let idle_amount_minor_units = 0;
  for (const b of buffers) {
    if (b.min_minor_units !== null) {
      const excess = balancesWorking[b.buffer_id] - b.min_minor_units;
      if (excess > 0) idle_amount_minor_units += excess;
    }
  }
  const idle_cost_minor_units = Math.trunc(idle_amount_minor_units * idle_cost_bps / 10000);
  const crossing_count = movements.filter((m) => m.applied && m.external_crossing).length;
  const crossing_cost_minor_units = crossing_count * cost_per_crossing_minor_units;

  const compliance_flags = [];
  if (!backing_applicable) {
    compliance_flags.push('BACKING_NOT_APPLICABLE');
  } else {
    if (buffers.length === 0 || rejected_inputs.some((r) => r.where === 'buffers')) compliance_flags.push('BACKING_INPUTS_INSUFFICIENT');
    compliance_flags.push(backing_intact_after ? 'BACKING_INTACT' : 'BACKING_SHORTFALL');
  }
  if (breaches_after.some((x) => x.kind === 'BUFFER_BELOW_FLOOR')) compliance_flags.push('BUFFER_BELOW_FLOOR');
  if (breaches_after.some((x) => x.kind === 'BUFFER_ABOVE_CEILING')) compliance_flags.push('BUFFER_ABOVE_CEILING');
  if (movement_breaks_invariant !== null) compliance_flags.push('MOVEMENT_BREAKS_INVARIANT');

  const rationale = [];
  if (!backing_applicable) {
    rationale.push('Backing model declared as vacuous: no backing set exists for this settlement-asset topology (e.g. a direct/one-tier CBDC, where the holder\'s claim IS central bank money, or a two-tier/intermediated CBDC, where the claim is still on the central bank). BACKING_NOT_APPLICABLE is a defined answer, not a pass and not a shortfall -- this model has no backing question to evaluate.');
  } else {
    rationale.push(`${buffers.length} declared buffer${buffers.length === 1 ? '' : 's'}; aggregate circulation-backing ${display(aggregate_backing_before_minor_units)} before movements, required ${display(required_backing_minor_units)} at a ${backing_ratio_bps} bps ratio against ${display(value_in_circulation_minor_units)} in circulation.`);
    rationale.push(backing_intact_before ? 'Backing was intact before the declared movements.' : 'Backing was already short before the declared movements.');
    rationale.push(`After ${movements.filter((m) => m.applied).length} applied movement${movements.filter((m) => m.applied).length === 1 ? '' : 's'}, aggregate circulation-backing is ${display(aggregate_backing_after_minor_units)}.`);
    rationale.push(backing_intact_after
      ? 'Backing remains intact after the declared movements.'
      : (backing_intact_before ? 'Backing is short after the declared movements: composition shifted, not merely location.' : 'Backing remains short after the declared movements.'));
  }
  if (movement_breaks_invariant) rationale.push(`Movement ${movement_breaks_invariant.movement_id} (${movement_breaks_invariant.from} -> ${movement_breaks_invariant.to}) is the first to break the invariant: ${movement_breaks_invariant.reason}.`);
  rationale.push('This is an arithmetic check over declared balances and declared movements. It proves nothing about whether those declarations match any external ledger, and it recommends no action.');

  const output_payload = {
    as_of,
    backing_model,
    backing_applicable,
    value_in_circulation_minor_units,
    value_in_circulation_display: display(value_in_circulation_minor_units),
    backing_ratio_bps,
    required_backing_minor_units,
    required_backing_display: display(required_backing_minor_units),
    buffer_count: buffers.length,
    buffers: buffers.map((b) => ({ buffer_id: b.buffer_id, role: b.role, asset_type: b.asset_type, backs: b.backs, balance_before_minor_units: b.balance_minor_units, balance_after_minor_units: balancesWorking[b.buffer_id], min_minor_units: b.min_minor_units, max_minor_units: b.max_minor_units })),
    aggregate_backing_before_minor_units,
    aggregate_backing_before_display: display(aggregate_backing_before_minor_units),
    backing_intact_before,
    breaches_before,
    aggregate_backing_after_minor_units,
    aggregate_backing_after_display: display(aggregate_backing_after_minor_units),
    backing_intact_after,
    breaches_after,
    movements,
    movement_breaks_invariant,
    buffer_margins,
    thinnest_buffer,
    idle_amount_minor_units,
    idle_cost_minor_units,
    idle_cost_display: display(idle_cost_minor_units),
    crossing_count,
    crossing_cost_minor_units,
    crossing_cost_display: display(crossing_cost_minor_units),
    rejected_inputs,
    rationale,
    note: 'Deterministic aggregate settlement-asset backing invariant check over caller-declared buffers, backing ratio, value in circulation, and a declared movement set. Verifies the AGGREGATE composition of the buffer set before and after the declared movements, not merely per-account totals or their grand sum. Settlement-asset agnostic: no currency, scheme, country, or issuer is named in this kernel. It performs no sweep, no netting, no reserve attestation, and issues no recommendation to move money. The caller declares backing_model ("segregated", default, or "vacuous" for a direct/two-tier CBDC with no backing set); the kernel never infers this from the buffer count, and BACKING_NOT_APPLICABLE is a defined non-pass answer, not BACKING_INTACT.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
