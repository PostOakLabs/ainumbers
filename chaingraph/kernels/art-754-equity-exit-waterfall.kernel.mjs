// art-754-equity-exit-waterfall — port of ApexLogics Apex #141 "Equity Exit Waterfall
// Calculator" (al_id AL-148, tool_id 141-equity-exit-waterfall) inline compute, landed
// from the APEXPORT-141 porting payload (bus msi, GRADES PASS-PENDING-XV
// 2026-10-07T03:0xZ reaudit CONFIRMED 2026-10-07T04:59:15Z; Tim 2026-10-18T21:20Z extend
// ruling: Builder-verifies-at-land — 18/18 payload fixture vectors re-executed through
// compute() before build: 17 live matches byte-for-byte + 1 expected DIFFERS-01 refusal,
// APEX-PORT-141-LAND-1).
//
// Source of record (fetched 2026-10-06, pinned in the payload CITES.md F1):
//   https://apexlogics.org/tools/141-equity-exit-waterfall/
//   HTTP 200, 37,519 raw bytes; registry AL-148, tool_id 141-equity-exit-waterfall, v1.0.0
//   Inline compute slice = lines 339-449 of the pinned page (function calculate()).
//   This module is a pure-function port of that arithmetic.
//
// NOTHING here is a live quote or tax advice. Every modeling convention is either
//   (a) Apex #141 behavior reproduced exactly (payload DIFFERS.md DIFFERS-04..08,
//       "Apex retained"), or
//   (b) port hardening gated by a policy switch (DIFFERS-01 I-JSON refusal,
//       DIFFERS-03 structured refusal), or
//   (c) a flagged heuristic with no official source (DIFFERS-02 preferred-wins warning).
// Citations: IRC Section 1001 (payload CITES.md F2) for the taxable-gain convention; NVCA model
// term sheet (F3) for the liquidation-preference mechanics context.
//
// Pure function: no Date, no clock, no randomness, no I/O. Every comparator is a named
// constant. Refusals surface as output_payload.refusal_reason with a named code, never a
// silent guess and never a throw.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-754-equity-exit-waterfall';
const TOOL_VERSION = '1.0.0';
const APEX_SOURCE = {
  al_id: 'AL-148',
  tool_id: '141-equity-exit-waterfall',
  display_number: '#141',
  page_url: 'https://apexlogics.org/tools/141-equity-exit-waterfall/',
  page_bytes: 37519,
  fetch_date: '2026-10-06',
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — every comparator/threshold from Apex #141, named (payload
// kernel.draft + DIFFERS.md)
// ─────────────────────────────────────────────────────────────────────────────

const ART754_CONSTANTS = {
  PERCENT_DIVISOR: 100,
  // Apex #141 reads its percentage controls as 0-100 and divides by 100.
  NET_FLOOR: 0,
  // Apex #141: Math.max(0, yourGross - yourStrike) — net proceeds floored at 0.
  GAIN_FLOOR: 0,
  // Apex #141: Math.max(0, yourNet - yourBasis) — taxable gain floored at 0.
  BREAK_EVEN_ROLE_EXCLUSION: 'preferred',
  // Apex #141 (lines 425-440): break-even exit is computed only for non-preferred roles.
  CONVERSION_TRIGGER: 'pro_rata_gt_pref',
  // Apex #141 (line 372): non-participating preferred converts when pro-rata > liquidPref.
  CAP_PARTICIPATION_FLOOR: 0,
  // Apex #141 (line 394): Math.max(0, capAmount - liquidPref) — max participation floored at 0.
};

const ART754_POLICY = {
  // Port switches — payload DIFFERS.md:
  APEX_FAITHFUL_MODE: false,
  // true => revert every gated divergence to Apex #141 behavior (parity mode).
  REFUSE_NON_FINITE_INPUT: true,
  // DIFFERS-01 — port hardening: refuse non-finite inputs per I-JSON guard (RFC 8785 Section 3.2.2.3).
  PREF_WINS_WARNING_THRESHOLD: 0.5,
  // DIFFERS-02 — Apex #141 warns when prefTotal > commonPool; no official threshold
  // exists. Kept as a heuristic, flagged, never a rule. Unused in compute.
};

function refusalPayload(refusalReason, echo, note) {
  const o = {
    refusal_reason: refusalReason,
    exit_valuation_usd: null, total_preferred_invested_usd: null,
    preferred_ownership_fraction: null, liquidation_preference_multiple: null,
    participation_type: null, participation_cap_multiple: null,
    your_role: null, your_ownership_fraction: null,
    your_option_strike_total_usd: null, your_cost_basis_usd: null,
    liquidation_preference_usd: null, layers: null,
    preferred_total_usd: null, common_pool_usd: null,
    your_gross_proceeds_usd: null, your_net_proceeds_usd: null,
    your_taxable_gain_usd: null, break_even_exit_usd: null,
    switches: {
      apex_faithful_mode: ART754_POLICY.APEX_FAITHFUL_MODE,
      refuse_non_finite_input: ART754_POLICY.REFUSE_NON_FINITE_INPUT,
      pref_wins_warning_threshold: ART754_POLICY.PREF_WINS_WARNING_THRESHOLD,
    },
    compliance_flags: ['ART754_INPUT_REFUSED'],
    notes: [note],
  };
  if (echo) for (const k of Object.keys(echo)) if (o[k] !== undefined) o[k] = echo[k];
  return o;
}

function computeFlat(pp) {
  const C = ART754_CONSTANTS;
  const P = ART754_POLICY;

  // ── 1. Coercion: Apex #141's exact reads (page lines 339-349, `+el.value`) ──
  const exitVal = Number(pp.exit_valuation_usd);
  const totalInvested = Number(pp.total_preferred_invested_usd);
  const prefOwnerPct = Number(pp.preferred_ownership_pct) / C.PERCENT_DIVISOR;
  const prefMultiple = Number(pp.liquidation_preference_multiple);
  const participationType = pp.participation_type;
  const participationCap = Number(pp.participation_cap_multiple);
  const yourRole = pp.your_role;
  const yourOwnerPct = Number(pp.your_ownership_pct) / C.PERCENT_DIVISOR;
  const yourStrike = Number(pp.your_option_strike_total_usd);
  const yourBasis = Number(pp.your_cost_basis_usd);

  // ── DIFFERS-01 (port hardening): refuse non-finite inputs ──
  const coercedNumerics = [exitVal, totalInvested, prefOwnerPct, prefMultiple, participationCap, yourOwnerPct, yourStrike, yourBasis];
  if (P.REFUSE_NON_FINITE_INPUT && coercedNumerics.some((n) => !Number.isFinite(n))) {
    return refusalPayload('REFUSED_NON_FINITE_INPUT', {
      participation_type: participationType === undefined ? null : participationType,
      your_role: yourRole === undefined ? null : yourRole,
    }, 'One or more inputs are non-finite after Apex coercion; refused per the I-JSON guard (RFC 8785 §3.2.2.3). Apex #141 would propagate NaN/Infinity into every derived figure (DIFFERS-01).');
  }

  // ── 2. Apex #141 line 351: exit validation (DIFFERS-03: structured refusal, not alert) ──
  if (exitVal <= 0) {
    return refusalPayload('REFUSED_NON_POSITIVE_EXIT', {
      exit_valuation_usd: exitVal, total_preferred_invested_usd: totalInvested,
      preferred_ownership_fraction: prefOwnerPct, liquidation_preference_multiple: prefMultiple,
      participation_type: participationType, participation_cap_multiple: participationCap,
      your_role: yourRole, your_ownership_fraction: yourOwnerPct,
      your_option_strike_total_usd: yourStrike, your_cost_basis_usd: yourBasis,
    }, 'Apex #141 alerts "Enter a positive exit valuation." when exitVal <= 0 (page line 351); the port returns a structured refusal (DIFFERS-03).');
  }

  // ── 3. Apex #141 lines 353-361: liquidation preference ──
  const commonOwnerPct = 1 - prefOwnerPct;
  const liquidPref = totalInvested * prefMultiple;
  let remaining = exitVal;
  const layers = [];

  const prefPref = Math.min(remaining, liquidPref);
  remaining -= prefPref;
  layers.push({ label: 'Preferred Liquidation Preference', recipient: 'Preferred investors', amount: prefPref });

  // ── 4. Apex #141 lines 363-408: participation / conversion ──
  let prefParticipation = 0;
  let commonPool = 0;
  let prefProRata = 0;
  let prefParticipationRaw = 0;

  if (participationType === 'non') {
    prefProRata = exitVal * prefOwnerPct;
    if (prefProRata > liquidPref) { // strict inequality, DIFFERS-06
      layers.length = 0;
      layers.push({ label: 'Pro-Rata (Preferred converts to common)', recipient: 'All stockholders', amount: exitVal });
      prefParticipation = exitVal * prefOwnerPct - liquidPref;
      commonPool = exitVal * commonOwnerPct;
      layers[0].amount = exitVal * prefOwnerPct;
      layers.push({ label: 'Pro-Rata Common', recipient: 'Common stockholders', amount: commonPool });
    } else {
      commonPool = remaining;
      if (commonPool > 0) layers.push({ label: 'Common Pro-Rata', recipient: 'Common stockholders', amount: commonPool });
    }
  } else if (participationType === 'full') {
    prefParticipation = remaining * prefOwnerPct;
    commonPool = remaining * commonOwnerPct;
    if (prefParticipation > 0) layers.push({ label: 'Preferred Participation (pro-rata)', recipient: 'Preferred investors', amount: prefParticipation });
    if (commonPool > 0) layers.push({ label: 'Common Pro-Rata', recipient: 'Common stockholders', amount: commonPool });
  } else {
    // Capped participating
    const capAmount = totalInvested * participationCap;
    const maxParticipation = Math.max(C.CAP_PARTICIPATION_FLOOR, capAmount - liquidPref); // DIFFERS-05 floor
    prefParticipationRaw = remaining * prefOwnerPct;
    prefParticipation = Math.min(prefParticipationRaw, maxParticipation);
    const hitCap = prefParticipationRaw > maxParticipation; // strict inequality, DIFFERS-07
    if (hitCap) {
      commonPool = remaining * commonOwnerPct + prefParticipationRaw - prefParticipation; // DIFFERS-08 layer order
    } else {
      commonPool = remaining * commonOwnerPct;
    }
    if (prefParticipation > 0) layers.push({ label: 'Preferred Participation (capped ' + participationCap + '×)', recipient: 'Preferred investors', amount: prefParticipation });
    if (commonPool > 0) layers.push({ label: 'Common Pro-Rata', recipient: 'Common stockholders', amount: commonPool });
  }

  // ── 5. Apex #141 lines 410-421: total preferred and your share ──
  const prefTotal = prefPref + prefParticipation;

  let yourGross = 0;
  if (yourRole === 'preferred') {
    yourGross = prefTotal * (yourOwnerPct / prefOwnerPct);
  } else {
    const commonShare = commonOwnerPct > 0 ? yourOwnerPct / commonOwnerPct : 0;
    yourGross = commonPool * commonShare;
  }
  const yourNet = Math.max(C.NET_FLOOR, yourGross - yourStrike);
  const yourGain = Math.max(C.GAIN_FLOOR, yourNet - yourBasis);

  // ── 6. Apex #141 lines 425-440: break-even exit for common (DIFFERS-04) ──
  let breakEvenExit = 0;
  if (yourRole !== C.BREAK_EVEN_ROLE_EXCLUSION && commonOwnerPct > 0) {
    breakEvenExit = liquidPref;
    const commonShareFrac = yourOwnerPct / commonOwnerPct;
    if (commonShareFrac > 0) {
      breakEvenExit = liquidPref + (yourStrike / (commonOwnerPct * commonShareFrac));
    }
  }

  // ── 7. Compliance flags (DIFFERS-02 warning is a heuristic, never a rule) ──
  const complianceFlags = [];
  if (prefTotal > commonPool && yourRole !== 'preferred') {
    complianceFlags.push('ART754_PREF_WINS_WARNING_HEURISTIC');
  }
  if (participationType === 'capped' && prefParticipation > 0 && prefParticipation < prefParticipationRaw) {
    complianceFlags.push('ART754_CAP_PARTICIPATION_HIT');
  }
  if (participationType === 'non' && prefProRata > liquidPref) {
    complianceFlags.push('ART754_NON_PARTICIPATING_CONVERSION');
  }

  // ── 8. Notes ──
  const notes = [];
  notes.push('Liquidation preference mechanics follow NVCA model term sheet conventions (fetched 2026-10-06).');
  notes.push('Taxable gain is computed as max(0, net proceeds - cost basis) per IRC §1001 (fetched 2026-10-06).');
  if (prefTotal > commonPool && yourRole !== 'preferred') {
    notes.push('Preferred investors captured more than common pool — Apex #141 warns the common position is significantly diluted. No official threshold exists for this warning (DIFFERS-02).');
  }
  if (participationType === 'capped' && prefParticipation > 0 && prefParticipation < prefParticipationRaw) {
    notes.push('Participation cap hit — preferred participation was capped at ' + participationCap + '× invested; remaining proceeds split pro-rata.');
  }
  if (participationType === 'non' && prefProRata > liquidPref) {
    notes.push('Non-participating preferred converted to common — pro-rata share exceeded liquidation preference.');
  }

  // ── 9. Output payload ──
  return {
    refusal_reason: null,
    // input echoes:
    exit_valuation_usd: exitVal,
    total_preferred_invested_usd: totalInvested,
    preferred_ownership_fraction: prefOwnerPct,
    liquidation_preference_multiple: prefMultiple,
    participation_type: participationType,
    participation_cap_multiple: participationCap,
    your_role: yourRole,
    your_ownership_fraction: yourOwnerPct,
    your_option_strike_total_usd: yourStrike,
    your_cost_basis_usd: yourBasis,
    // waterfall:
    liquidation_preference_usd: liquidPref,
    layers: layers,
    preferred_total_usd: prefTotal,
    common_pool_usd: commonPool,
    // your position:
    your_gross_proceeds_usd: yourGross,
    your_net_proceeds_usd: yourNet,
    your_taxable_gain_usd: yourGain,
    break_even_exit_usd: breakEvenExit,
    // provenance:
    switches: {
      apex_faithful_mode: P.APEX_FAITHFUL_MODE,
      refuse_non_finite_input: P.REFUSE_NON_FINITE_INPUT,
      pref_wins_warning_threshold: P.PREF_WINS_WARNING_THRESHOLD,
    },
    compliance_flags: complianceFlags,
    notes: notes
  };
}

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'calc_equity_exit_waterfall',
  mandate_type: 'consumer_finance', gpu: false,
};

/**
 * compute(pp) — pure decision kernel (port of Apex #141 inline compute, lines 339-449).
 * Domain refusals surface as output_payload.refusal_reason with a named code and the
 * ART754_INPUT_REFUSED compliance flag (the payload contract); happy-path output_payload
 * is the Apex results snapshot.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const out = computeFlat(pp);
  return { output_payload: out, compliance_flags: out.compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

