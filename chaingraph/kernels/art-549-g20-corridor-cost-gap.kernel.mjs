/**
 * art-549-g20-corridor-cost-gap.kernel.mjs
 * XBORDER-PAYMENTS-BUILD-SPEC.md §2.1 -- G20/FSB corridor cost-gap calculator.
 *
 * MANDATE CONTEXT. G20/FSB roadmap targets for cross-border payment cost: retail
 * cross-border payments by end-2027 (<=1% global average / <=3% any corridor),
 * remittances by 2030 (<=3% global average / <=5% any corridor). These are
 * TARGETS, not enforceable deadlines against any single firm -- this kernel is a
 * transparency/benchmarking tool, never a compliance-gate. Targets are hardcoded
 * NAMED POLICY CONSTANTS below, never fabricated at compute time.
 *
 * RPW METHOD VINTAGE. World Bank Remittance Prices Worldwide, methodology page
 * (https://remittanceprices.worldbank.org/methodology), most recent quarterly
 * report at spec-authoring time = Q3 2025 ("Q325"). This kernel does NOT vendor
 * RPW's own corridor cost table -- that would be a live/republished-data problem,
 * not a compute problem. The caller supplies the corridor's observed cost (from
 * RPW, their own quote basket, or elsewhere); this kernel recomputes the gap
 * against the published target arithmetic only. The RPW methodology is cited by
 * NAME AND VERSION in every output, never by embedding its data.
 *
 * SINGLE-CORRIDOR CHECK. The G20/FSB targets carry two numbers each (a global
 * average and a per-corridor ceiling). A caller declares ONE corridor's observed
 * cost, so the binding comparison is against the ANY-CORRIDOR ceiling -- the
 * global-average figure is reported alongside for context but is not itself
 * checkable from a single corridor's data point.
 *
 * FIXED-POINT COST MATH. Cost is declared as an integer number of basis points
 * (bps), never a float percentage, so no engine-parity rounding drift is
 * possible. gap_bps = observed_cost_bps - target_any_corridor_bps; no division
 * anywhere in compute(), so no branch can divide by zero (finite gate trivially
 * holds for every input shape, including all-rejected input).
 *
 * §25 (PII). Corridor pairs (ISO country-code pairs) and cost percentages are
 * not enumerable personal data -- no natural person is named or derivable from
 * a send/receive country pair and a cost basis point figure. §25 does not apply.
 *
 * §18. Ships compute_proof_ready:"deferred" -- new shard, awaiting the async GPU
 * proving queue (S18 steady-state); XBORDER-VENDOR-1 is the row that re-vendors
 * after this and its sibling shards land, raising the ratchet ceiling. This row
 * does not bump any §18 baseline itself.
 *
 * NO CLOCK. `as_of` is a caller-declared input; compute() never reads a clock.
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: XBORDER-PAYMENTS-BUILD-SPEC.md §2.1.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-549-g20-corridor-cost-gap';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'check_g20_corridor_cost_gap', mandate_type: 'risk_parameter', gpu: false };

// Named policy constants -- G20/FSB roadmap targets. Hardcoded, never fabricated.
const G20_FSB_TARGETS = {
  2027: {
    scope: 'retail cross-border payments',
    global_avg_bps: 100,
    any_corridor_bps: 300,
    label: 'G20/FSB 2027 retail target: ≤1% global avg / ≤3% any corridor',
  },
  2030: {
    scope: 'remittances',
    global_avg_bps: 300,
    any_corridor_bps: 500,
    label: 'G20/FSB 2030 remittance target: ≤3% global avg / ≤5% any corridor',
  },
};

const RPW_METHODOLOGY = {
  name: 'World Bank Remittance Prices Worldwide (RPW)',
  version: 'Q325',
  url: 'https://remittanceprices.worldbank.org/methodology',
};

function isCountryCode(v) { return typeof v === 'string' && /^[A-Za-z]{2}$/.test(v.trim()); }
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

function toBpsOrNull(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v >= 0) return v;
  rejected.push({ where, reason: 'absent or not a non-negative integer number of basis points', supplied: v === undefined ? null : v });
  return null;
}
function bpsDisplay(bps) {
  const neg = bps < 0;
  const abs = neg ? -bps : bps;
  const whole = Math.trunc(abs / 100);
  const frac = abs - whole * 100;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(2, '0');
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const as_of = isoDateOrNull(pp.as_of);

  const cp = pp.corridor_pair && typeof pp.corridor_pair === 'object' ? pp.corridor_pair : {};
  if (!pp.corridor_pair || typeof pp.corridor_pair !== 'object') rejected_inputs.push({ where: 'corridor_pair', reason: 'absent or not an object', supplied: pp.corridor_pair === undefined ? null : typeof pp.corridor_pair });
  let send_country = isCountryCode(cp.send_country) ? cp.send_country.trim().toUpperCase() : null;
  if (!send_country) rejected_inputs.push({ where: 'corridor_pair.send_country', reason: 'absent or not a 2-letter ISO country code', supplied: cp.send_country === undefined ? null : cp.send_country });
  let receive_country = isCountryCode(cp.receive_country) ? cp.receive_country.trim().toUpperCase() : null;
  if (!receive_country) rejected_inputs.push({ where: 'corridor_pair.receive_country', reason: 'absent or not a 2-letter ISO country code', supplied: cp.receive_country === undefined ? null : cp.receive_country });

  const observed_cost_bps = toBpsOrNull(pp.observed_cost_bps, 'observed_cost_bps', rejected_inputs) ?? 0;

  const send_amount_basis = (pp.send_amount_basis === 'USD_200' || pp.send_amount_basis === 'USD_500') ? pp.send_amount_basis : null;
  if (!send_amount_basis) rejected_inputs.push({ where: 'send_amount_basis', reason: 'must be exactly "USD_200" or "USD_500"', supplied: pp.send_amount_basis === undefined ? null : pp.send_amount_basis });

  const target_year = (pp.target_year === 2027 || pp.target_year === 2030) ? pp.target_year : null;
  if (!target_year) rejected_inputs.push({ where: 'target_year', reason: 'must be exactly 2027 or 2030', supplied: pp.target_year === undefined ? null : pp.target_year });

  const target = target_year ? G20_FSB_TARGETS[target_year] : null;
  const target_any_corridor_bps = target ? target.any_corridor_bps : null;
  const target_global_avg_bps = target ? target.global_avg_bps : null;
  const target_basis = target ? target.label : null;
  const target_scope = target ? target.scope : null;

  const gap_bps = target ? (observed_cost_bps - target_any_corridor_bps) : null;
  const meets_target = target ? (gap_bps <= 0) : null;

  const inputs_insufficient = !send_country || !receive_country || !send_amount_basis || !target_year;

  const compliance_flags = [];
  if (inputs_insufficient) compliance_flags.push('COSTGAP_INPUTS_INSUFFICIENT');
  if (target) compliance_flags.push(meets_target ? 'COSTGAP_MEETS_TARGET' : 'COSTGAP_EXCEEDS_TARGET');

  const rationale = [];
  if (inputs_insufficient) {
    rationale.push('One or more required declared inputs is missing or malformed; see rejected_inputs. No gap can be computed against an undeclared target or corridor.');
  } else {
    rationale.push(`Corridor ${send_country}→${receive_country}, observed cost ${bpsDisplay(observed_cost_bps)}% on the ${send_amount_basis.replace('_', ' ')} RPW basket, checked against the ${target_year} target ("${target_basis}").`);
    rationale.push(`gap_pct = observed ${bpsDisplay(observed_cost_bps)}% - target ${bpsDisplay(target_any_corridor_bps)}% (any-corridor ceiling) = ${bpsDisplay(gap_bps)}%. ${meets_target ? 'Corridor meets the target.' : 'Corridor exceeds the target.'}`);
    rationale.push(`Global-average target for this year (${bpsDisplay(target_global_avg_bps)}%) is reported for context only -- it describes the overall market average, not this single corridor, and is not itself checkable from one corridor's observed cost.`);
  }
  rationale.push('These are G20/FSB roadmap targets, not an enforceable deadline against any single firm. This is a transparency/benchmarking recompute, not a compliance-gate verdict.');
  rationale.push(`Corridor cost table sourced by the caller from ${RPW_METHODOLOGY.name} (methodology ${RPW_METHODOLOGY.version}, ${RPW_METHODOLOGY.url}) or elsewhere; this kernel does not embed or vendor RPW's own corridor cost data.`);

  const output_payload = {
    as_of,
    corridor_pair: { send_country, receive_country },
    observed_cost_bps,
    observed_cost_display: bpsDisplay(observed_cost_bps) + '%',
    send_amount_basis,
    target_year,
    target_scope,
    target_any_corridor_bps,
    target_any_corridor_display: target_any_corridor_bps === null ? null : (bpsDisplay(target_any_corridor_bps) + '%'),
    target_global_avg_bps,
    target_global_avg_display: target_global_avg_bps === null ? null : (bpsDisplay(target_global_avg_bps) + '%'),
    target_basis,
    gap_bps,
    gap_pct_display: gap_bps === null ? null : (bpsDisplay(gap_bps) + '%'),
    meets_target,
    rpw_methodology: RPW_METHODOLOGY,
    rejected_inputs,
    rationale,
    note: 'Deterministic recompute of a caller-declared corridor\'s cost gap against the hardcoded G20/FSB roadmap target for the declared year. Zero live FX/rate calls; the caller supplies the observed cost, sourced from World Bank RPW or elsewhere, and this kernel never embeds or vendors RPW\'s own corridor cost table. Targets are transparency/benchmarking figures, not an enforceable deadline against any single firm.',
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
