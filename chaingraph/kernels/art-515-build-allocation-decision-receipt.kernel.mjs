// art-515 — Build Allocation Decision Receipt: pure re-derivation kernel.
//
// INBOUND-EVIDENCE-BUILD-SPEC.md §3. An allocation produced by an optimizer
// can be re-derived from the inputs that were true when it was made — why
// this asset, to this obligation, at this haircut. Re-runs the CALLER'S
// declared objective over the CALLER'S declared inputs (eligibility schedule
// snapshot, inventory snapshot, haircut table version) and compares the
// result to the allocation the caller says was actually chosen.
//
// PORTABLE TO ANY OPTIMIZER, NOT COLLATERAL ONLY. The four input shapes
// (eligibility schedule, inventory snapshot, obligation, objective) are
// generic: they describe a liquidity sweep, a treasury cash placement, a
// payment-routing choice, or an order allocation exactly as well as a
// collateral pledge. Nothing here reads a collateral-specific field name.
//
// DISTINCT FROM TWO SHIPPED SURFACES (state this on the page too):
//   art-370-supervisory-scenario-replay   replays the FED's published
//                                         macro scenario paths against
//                                         caller loss/PPNR functions. That
//                                         is a SCENARIO replay over
//                                         regulator-published inputs. This
//                                         kernel replays no external
//                                         scenario; it re-derives one
//                                         DECISION from the inputs that were
//                                         true when the decision was made.
//   art-236-build-ai-decision-log-record  builds an EU AI Act Art 12(2)
//                                         decision-LOG record: completeness
//                                         score, retention window, chain
//                                         position. It records metadata
//                                         ABOUT a decision. It never
//                                         re-derives whether the decision
//                                         itself follows from a declared
//                                         objective, computes no optimal
//                                         allocation, and has no
//                                         reproducibility verdict.
//
// NO SOLVER ARMS RACE. This kernel re-derives against a DECLARED objective
// on a DECLARED input set, using a plain greedy allocator with a fixed,
// published tie-break order (see buildOptimal below). It is not a competing
// optimizer and never claims to find a better allocation than the caller's
// — only whether the caller's allocation is explained by the caller's own
// stated objective and inputs.
//
// ADR_DIVERGENT IS NOT A FINDING OF ERROR. A divergence means the chosen
// allocation is not explained by the declared objective and inputs over
// this kernel's re-derivation — routinely legitimate: a trader override, an
// undeclared constraint, a stale snapshot. No flag, field name or rationale
// string here characterises intent, negligence, or misconduct.
//
// HARD FENCE (receipt MUST record this): eligibility, inventory, haircuts
// and the objective are every one of them CALLER INPUTS, transcribed from
// the snapshot that was in force when the allocation was made. This kernel
// ships no eligibility table, no inventory feed and no haircut table of its
// own — zero lookups of any kind (zero-egress by contract). Reuse, never
// rebuild: `505` covers eligibility of each candidate and
// `art-444-collateral-haircut-engine` covers the haircut applied; this
// kernel consumes the OUTCOME of those steps as caller-declared inputs, and
// edits neither.
//
// DETERMINISM: no clock anywhere — `as_of` is a caller input. Money is
// fixed-point BigInt parsed from decimal strings, never float
// multiplication. Finite gates cover a non-positive obligation amount, an
// empty eligibility schedule or inventory snapshot, and total eligible
// haircut-adjusted inventory below the obligation amount; none of these can
// produce NaN. `execution_hash` comes from `_hash.mjs` and is never
// hand-built.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-515-build-allocation-decision-receipt';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'build_allocation_decision_receipt',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// ── fixed-point money math (BigInt, no floats) ────────────────────────────
const SCALE_EXP = 8;
const SCALE = 10n ** BigInt(SCALE_EXP);

function toFixed(value) {
  let s = String(value ?? 0).trim();
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }
  if (!/^[0-9]*\.?[0-9]*$/.test(s) || s === '' || s === '.') s = '0';
  let [intPart, fracPart = ''] = s.split('.');
  if (intPart === '') intPart = '0';
  if (fracPart.length > SCALE_EXP) fracPart = fracPart.slice(0, SCALE_EXP);
  fracPart = fracPart.padEnd(SCALE_EXP, '0');
  let mag = BigInt(intPart + fracPart);
  if (neg) mag = -mag;
  return mag;
}

function mulFixed(a, b) { return (a * b) / SCALE; }
function divFixed(a, b) { return b === 0n ? 0n : (a * SCALE) / b; }

function roundFixedToString(value, places, mode) {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const divisor = 10n ** BigInt(SCALE_EXP - places);
  let q = abs / divisor;
  const r = abs % divisor;
  const twiceR = r * 2n;
  if (mode === 'truncate') {
    // q already truncated toward zero
  } else if (mode === 'half_even') {
    if (twiceR > divisor || (twiceR === divisor && q % 2n === 1n)) q += 1n;
  } else {
    if (twiceR >= divisor) q += 1n;
  }
  let qs = q.toString();
  let result;
  if (places === 0) {
    result = qs;
  } else {
    qs = qs.padStart(places + 1, '0');
    result = `${qs.slice(0, -places)}.${qs.slice(-places)}`;
  }
  return (neg && q !== 0n) ? `-${result}` : result;
}

function fixedToPlainString(value, places) { return roundFixedToString(value, places, 'truncate'); }

const KNOWN_OBJECTIVES = ['cheapest_to_deliver', 'preserve_hqla', 'minimise_movements'];

const NOT_PROVEN = [
  { item: 'Eligibility accuracy', detail: 'The eligibility schedule snapshot is a caller input, transcribed from whatever was in force when the allocation was made. This kernel does not verify it against a live eligibility feed and holds no eligibility table of its own.' },
  { item: 'Inventory accuracy', detail: 'The inventory snapshot (available amounts, movement cost, HQLA flag, haircut) is asserted at the values supplied. No independent valuation or market data is read.' },
  { item: 'Optimality of the caller\'s allocation', detail: 'This kernel re-derives ONE candidate allocation for the declared objective using a fixed, published greedy rule. A divergence from the caller\'s allocation is not proof the caller\'s allocation was wrong, and a match is not proof no better allocation exists — only that this re-derivation agrees or disagrees with what was chosen.' },
  { item: 'Intent', detail: 'ADR_DIVERGENT records that the chosen allocation is not explained by the declared objective and inputs. It never characterises why: a trader override, an undeclared constraint and a stale snapshot are all consistent with the same flag.' },
];

// Greedy re-derivation of the declared objective over ELIGIBLE inventory
// only. This is NOT a general solver: it is one fixed, published tie-break
// rule per named objective, so the same inputs always re-derive the same
// candidate allocation. `haircut_pct` and `cost_bps` are caller inputs.
function buildOptimal(objective, eligibleItems, obligationFixed) {
  let ordered;
  if (objective === 'cheapest_to_deliver') {
    ordered = [...eligibleItems].sort((a, b) => (a.costBpsFixed !== b.costBpsFixed ? Number(a.costBpsFixed - b.costBpsFixed) : (a.asset_id < b.asset_id ? -1 : 1)));
  } else if (objective === 'preserve_hqla') {
    ordered = [...eligibleItems].sort((a, b) => {
      if (a.hqla !== b.hqla) return a.hqla ? 1 : -1;
      if (a.costBpsFixed !== b.costBpsFixed) return Number(a.costBpsFixed - b.costBpsFixed);
      return a.asset_id < b.asset_id ? -1 : 1;
    });
  } else if (objective === 'minimise_movements') {
    ordered = [...eligibleItems].sort((a, b) => {
      if (a.adjustedValueFixed !== b.adjustedValueFixed) return Number(b.adjustedValueFixed - a.adjustedValueFixed);
      return a.asset_id < b.asset_id ? -1 : 1;
    });
  } else {
    return null; // unrecognized objective — no known solver, not re-derivable here
  }

  const allocation = [];
  let remaining = obligationFixed;
  for (const item of ordered) {
    if (remaining <= 0n) break;
    if (item.adjustedValueFixed <= 0n) continue;
    const takeAdjusted = item.adjustedValueFixed < remaining ? item.adjustedValueFixed : remaining;
    const factor = SCALE - item.haircutFixed; // (1 - haircut) in fixed terms
    const rawAmount = factor <= 0n ? 0n : divFixed(mulFixed(takeAdjusted, SCALE), factor);
    allocation.push({ asset_id: item.asset_id, amount_fixed: rawAmount, adjusted_value_fixed: takeAdjusted });
    remaining -= takeAdjusted;
  }
  return { allocation, remainingFixed: remaining };
}

/**
 * compute(pp) — pure allocation-decision re-derivation.
 * pp: {
 *   obligation_ref?, as_of?, eligibility_schedule_ref?, inventory_ref?, haircut_table_version?,
 *   obligation_amount: number|string,           // haircut-adjusted value the allocation must cover
 *   eligibility_schedule: [{ asset_id, eligible: bool }],
 *   inventory_snapshot: [{ asset_id, available_amount, cost_bps, hqla?: bool, haircut_pct?: number|string }],
 *   objective: 'cheapest_to_deliver' | 'preserve_hqla' | 'minimise_movements' | string,
 *   allocation_chosen: [{ asset_id, amount }],
 *   rounding?: { decimal_places: number, mode: 'half_up'|'half_even'|'truncate' },
 * }
 */
export function compute(pp) {
  const rounding = pp.rounding ?? {};
  const decimalPlaces = Number.isInteger(rounding.decimal_places) ? rounding.decimal_places : 2;
  const roundingMode = ['half_up', 'half_even', 'truncate'].includes(rounding.mode) ? rounding.mode : 'half_up';

  const compliance_flags = [];
  const judgmentFields = [];
  const exceptions = [];

  const eligibility = Array.isArray(pp.eligibility_schedule) ? pp.eligibility_schedule : [];
  const inventory = Array.isArray(pp.inventory_snapshot) ? pp.inventory_snapshot : [];
  const chosenRaw = Array.isArray(pp.allocation_chosen) ? pp.allocation_chosen : [];
  const objective = typeof pp.objective === 'string' && pp.objective.trim() !== '' ? pp.objective.trim() : null;

  if (objective === null) {
    judgmentFields.push({ field: 'objective', reason: 'No objective was declared. Reproducibility cannot be tested against an objective that was never stated.', supplied: pp.objective ?? null });
    compliance_flags.push('ADR_OBJECTIVE_UNDECLARED');
  } else if (!KNOWN_OBJECTIVES.includes(objective)) {
    judgmentFields.push({ field: 'objective', reason: `"${objective}" is a caller-named objective this kernel has no fixed re-derivation rule for. Only ${KNOWN_OBJECTIVES.join(', ')} are re-derivable; a caller-named objective is recorded but not solved.`, supplied: objective });
    compliance_flags.push('ADR_OBJECTIVE_UNDECLARED');
  }

  const obligationFixed = toFixed(pp.obligation_amount);
  const obligationPositive = obligationFixed > 0n;
  if (!obligationPositive) {
    exceptions.push({ field: 'obligation_amount', reason: 'obligation_amount must be a positive value. A zero or negative obligation has no coverage target to re-derive against.' });
  }

  if (eligibility.length === 0) exceptions.push({ field: 'eligibility_schedule', reason: 'No eligibility schedule entries were supplied. Without a declared eligible set, no candidate can be included in a re-derived allocation.' });
  if (inventory.length === 0) exceptions.push({ field: 'inventory_snapshot', reason: 'No inventory snapshot entries were supplied. Without declared inventory there is nothing to allocate.' });

  const eligibleIds = new Set(eligibility.filter((e) => e && e.eligible === true).map((e) => String(e.asset_id)));
  const inventoryById = new Map();
  const duplicate_inventory_ids = [];
  for (const raw of inventory) {
    const id = String(raw?.asset_id ?? '');
    if (id === '') continue;
    if (inventoryById.has(id)) { duplicate_inventory_ids.push(id); continue; }
    const haircutFraction = divFixed(toFixed(raw?.haircut_pct ?? 0), toFixed(100)); // fraction of SCALE
    const availableFixed = toFixed(raw?.available_amount ?? 0);
    const adjustedValueFixed = mulFixed(availableFixed, SCALE - haircutFraction);
    inventoryById.set(id, {
      asset_id: id,
      availableFixed,
      costBpsFixed: toFixed(raw?.cost_bps ?? 0),
      hqla: raw?.hqla === true,
      haircutFixed: haircutFraction,
      adjustedValueFixed: adjustedValueFixed > 0n ? adjustedValueFixed : 0n,
    });
  }
  if (duplicate_inventory_ids.length > 0) exceptions.push({ field: 'inventory_snapshot', reason: `duplicate asset_id entries were supplied and only the first was kept: ${duplicate_inventory_ids.join(', ')}` });

  const eligibleItems = [...inventoryById.values()].filter((item) => eligibleIds.has(item.asset_id));
  const totalEligibleAdjusted = eligibleItems.reduce((acc, x) => acc + x.adjustedValueFixed, 0n);

  const inputsInsufficient = !obligationPositive || eligibility.length === 0 || inventory.length === 0 || (obligationPositive && totalEligibleAdjusted < obligationFixed);
  if (obligationPositive && eligibility.length > 0 && inventory.length > 0 && totalEligibleAdjusted < obligationFixed) {
    exceptions.push({ field: 'inventory_snapshot', reason: `total eligible haircut-adjusted inventory (${fixedToPlainString(totalEligibleAdjusted, decimalPlaces)}) is below the obligation amount (${fixedToPlainString(obligationFixed, decimalPlaces)}). No allocation, chosen or re-derived, can fully cover this obligation from the declared eligible set.` });
  }
  if (inputsInsufficient) compliance_flags.push('ADR_INPUTS_INSUFFICIENT');

  // ── normalize the chosen allocation ───────────────────────────────────
  const chosenById = new Map();
  const chosen_unknown_asset_ids = [];
  for (const raw of chosenRaw) {
    const id = String(raw?.asset_id ?? '');
    if (id === '') continue;
    const amountFixed = toFixed(raw?.amount ?? 0);
    chosenById.set(id, (chosenById.get(id) ?? 0n) + amountFixed);
    if (!inventoryById.has(id)) chosen_unknown_asset_ids.push(id);
  }
  if (chosen_unknown_asset_ids.length > 0) exceptions.push({ field: 'allocation_chosen', reason: `the chosen allocation references asset_id values absent from the declared inventory snapshot: ${chosen_unknown_asset_ids.join(', ')}` });

  const chosen_ineligible = [...chosenById.keys()].filter((id) => !eligibleIds.has(id));
  if (chosen_ineligible.length > 0) compliance_flags.push('ADR_INELIGIBLE_ASSET_CHOSEN');

  let chosenCostFixed = 0n;
  let chosenAdjustedTotalFixed = 0n;
  let chosenIneligibleAmountFixed = 0n;
  for (const [id, amountFixed] of chosenById.entries()) {
    const item = inventoryById.get(id);
    if (!item) continue;
    chosenCostFixed += mulFixed(amountFixed, item.costBpsFixed);
    const adj = mulFixed(amountFixed, item.haircutFixed >= SCALE ? 0n : (SCALE - item.haircutFixed));
    chosenAdjustedTotalFixed += adj;
    if (!eligibleIds.has(id)) chosenIneligibleAmountFixed += amountFixed;
  }

  // ── re-derive the declared objective, if it is a known one ────────────
  let reproducibility_verdict = null;
  let optimal_allocation = [];
  let optimalCostFixed = null;
  let optimalAdjustedTotalFixed = null;
  const binding_constraints = [];

  const canSolve = KNOWN_OBJECTIVES.includes(objective ?? '') && !inputsInsufficient;
  if (canSolve) {
    const solved = buildOptimal(objective, eligibleItems, obligationFixed);
    optimal_allocation = solved.allocation.map((x) => ({ asset_id: x.asset_id, amount: fixedToPlainString(x.amount_fixed, decimalPlaces) }));
    const optimalById = new Map(solved.allocation.map((x) => [x.asset_id, x.amount_fixed]));
    optimalCostFixed = solved.allocation.reduce((acc, x) => acc + mulFixed(x.amount_fixed, inventoryById.get(x.asset_id).costBpsFixed), 0n);
    optimalAdjustedTotalFixed = solved.allocation.reduce((acc, x) => acc + x.adjusted_value_fixed, 0n);

    const allIds = new Set([...optimalById.keys(), ...chosenById.keys()]);
    let anyDiff = false;
    for (const id of [...allIds].sort()) {
      const optAmt = optimalById.get(id) ?? 0n;
      const chAmt = chosenById.get(id) ?? 0n;
      if (optAmt === chAmt) continue;
      anyDiff = true;
      const item = inventoryById.get(id);
      let reason;
      if (!item) reason = 'asset absent from the declared inventory snapshot';
      else if (!eligibleIds.has(id)) reason = 'ineligible per the declared eligibility schedule snapshot';
      else if (chAmt > (item.availableFixed ?? 0n)) reason = 'chosen amount exceeds the available amount in the declared inventory snapshot';
      else if (chAmt < optAmt) reason = 'objective prefers a larger allocation to this asset than was chosen — a cheaper or more-preferred alternative may have been used instead, or the obligation was covered by other means';
      else reason = 'not explained by the declared objective and inputs — consistent with an override, an undeclared constraint, or a stale snapshot';
      binding_constraints.push({
        asset_id: id,
        optimal_amount: fixedToPlainString(optAmt, decimalPlaces),
        chosen_amount: fixedToPlainString(chAmt, decimalPlaces),
        reason,
      });
    }
    reproducibility_verdict = anyDiff ? 'ADR_DIVERGENT' : 'ADR_REPRODUCED';
    compliance_flags.push(reproducibility_verdict);
    if (anyDiff) compliance_flags.push('ADR_CONSTRAINT_BINDING');
  }

  if (judgmentFields.length > 0) compliance_flags.push('ESCALATION_RAISED');
  compliance_flags.push('ADR_RECEIPT_BUILT');

  const judgment_required = judgmentFields.length === 0 ? null : {
    fields: judgmentFields,
    reason: 'The declared objective was absent or not one this kernel has a fixed re-derivation rule for, so no reproducibility verdict could be computed.',
  };

  const rationale = [];
  rationale.push(objective === null
    ? 'No objective was declared, so no reproducibility verdict could be computed against one.'
    : (KNOWN_OBJECTIVES.includes(objective)
        ? `Objective "${objective}" was re-derived against ${eligibleItems.length} eligible inventory item${eligibleItems.length === 1 ? '' : 's'} using this kernel's fixed greedy rule for that objective.`
        : `Objective "${objective}" is caller-named and has no fixed re-derivation rule in this kernel, so no optimal allocation was computed.`));
  rationale.push(inputsInsufficient
    ? 'One or more declared inputs were insufficient to decide reproducibility; see exceptions.'
    : 'The declared eligibility schedule, inventory snapshot and obligation amount were sufficient to attempt a re-derivation.');
  if (reproducibility_verdict === 'ADR_REPRODUCED') {
    rationale.push('The chosen allocation exactly matches this kernel\'s re-derivation of the declared objective over the declared inputs.');
  } else if (reproducibility_verdict === 'ADR_DIVERGENT') {
    rationale.push(binding_constraints.length === 1
      ? '1 asset differs between the chosen allocation and the re-derived optimal allocation, named with its binding constraint. This is not a finding of error.'
      : `${binding_constraints.length} assets differ between the chosen allocation and the re-derived optimal allocation, each named with its binding constraint. This is not a finding of error.`);
  }
  rationale.push('This kernel re-derives one candidate allocation using a fixed, published rule. It is not a competing optimizer and does not claim the re-derived allocation is better than the one chosen.');

  const output_payload = {
    obligation_ref: pp.obligation_ref ?? null,
    as_of: pp.as_of ?? null,
    eligibility_schedule_ref: pp.eligibility_schedule_ref ?? null,
    inventory_ref: pp.inventory_ref ?? null,
    haircut_table_version: pp.haircut_table_version ?? null,
    objective,
    rounding: { decimal_places: decimalPlaces, mode: roundingMode },
    judgment_required,
    obligation: {
      amount: fixedToPlainString(obligationFixed, decimalPlaces),
      positive: obligationPositive,
    },
    reproducibility: {
      verdict: reproducibility_verdict,
      optimal_allocation,
      chosen_allocation: [...chosenById.entries()].map(([id, amt]) => ({ asset_id: id, amount: fixedToPlainString(amt, decimalPlaces) })),
      obligation_covered_by_chosen: chosenAdjustedTotalFixed >= obligationFixed,
      obligation_covered_by_optimal: optimalAdjustedTotalFixed === null ? null : optimalAdjustedTotalFixed >= obligationFixed,
    },
    delta: {
      cost_chosen: fixedToPlainString(chosenCostFixed, decimalPlaces),
      cost_optimal: optimalCostFixed === null ? null : fixedToPlainString(optimalCostFixed, decimalPlaces),
      cost_delta: optimalCostFixed === null ? null : fixedToPlainString(chosenCostFixed - optimalCostFixed, decimalPlaces),
      eligibility: {
        ineligible_assets_in_chosen: chosen_ineligible,
        ineligible_amount_total: fixedToPlainString(chosenIneligibleAmountFixed, decimalPlaces),
      },
    },
    binding_constraints,
    exceptions,
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'Eligibility, inventory, haircuts and the declared objective are every one of them a caller input, transcribed from the snapshot in force when the allocation was made. This kernel ships no eligibility table, no inventory feed and no haircut table of its own, performs no lookups of any kind (zero-egress by contract), and re-derives against the SAME declared objective and inputs the caller supplied — it is not a competing optimizer and does not claim to find a better allocation.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
