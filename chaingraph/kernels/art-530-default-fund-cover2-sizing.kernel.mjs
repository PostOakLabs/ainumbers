/**
 * art-530-default-fund-cover2-sizing.kernel.mjs
 * CCP-CORE-BUILD-SPEC.md §1.3 -- default fund sizing under the PFMI "Cover 2" standard.
 *
 * THE STANDARD. PFMI Principle 4 (Credit Risk): a CCP serving markets of more than local
 * systemic importance must maintain financial resources sufficient to cover the default of
 * the two clearing members and their affiliates that would create the largest combined
 * credit exposure for the CCP under extreme but plausible market conditions. This kernel
 * sizes that requirement: for each caller-declared stress scenario, it computes every
 * member's stress loss, takes the two largest, and checks a caller-declared fund size
 * against the worst scenario across the declared set.
 *
 * ⛔ THIS DOES NOT RUN STRESS SCENARIOS. `qfa-03-stress-test-engine` already computes
 * multi-scenario stress losses (6 historical crisis scenarios with Monte Carlo per scenario).
 * This kernel CONSUMES that shape as a caller-declared input -- `stress_scenarios[]` with a
 * `loss_bps` per scenario, the same fractional-loss idea as qfa-03's `scenario_losses`
 * object, converted to a fixed-point basis-point integer by the caller/composer before this
 * kernel ever runs. It is a READ-ONLY consumer of qfa-03's output SHAPE, never a shared write
 * and never a duplicate stress-loss implementation.
 *
 * PORTFOLIO -> PER-MEMBER. qfa-03 computes a portfolio-level stress loss percentage per
 * scenario. Cover-2 sizing needs a PER-MEMBER stress loss to rank members by exposure. This
 * kernel applies the caller-declared scenario loss_bps to each caller-declared member
 * exposure: member_stress_loss = exposure * loss_bps / 10000. Applying the SAME scenario
 * shock uniformly to every member's declared exposure is a simplification a real CCP's
 * margin model would refine per member/portfolio composition; that refinement is out of
 * scope for this arithmetic sizing check, which computes on the declared exposures only.
 *
 * REGION-PORTABLE. No CCP, currency, or jurisdiction is named. The caller declares members,
 * exposures, and stress scenarios; the "cover 2" arithmetic is the standing PFMI Principle 4
 * requirement, not any one CCP's rulebook.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an integer number of minor
 * units; loss rates are integer basis points. No floating-point arithmetic in compute().
 * Non-integer/non-finite/absent amounts are coerced to 0 and named in `rejected_inputs[]`,
 * never silently dropped, never NaN.
 *
 * FINITE GATE. Zero members and zero scenarios each resolve to a DEFINED verdict
 * (COVER2_INPUTS_INSUFFICIENT, cover2 requirement 0). compute() contains no division by an
 * input-derived count, only by the fixed constant 10000 for basis-point rates, so no branch
 * can divide by zero.
 *
 * §23 HONEST POSTURE. `execution_hash` proves the computation ran over the members,
 * exposures, and stress scenarios the caller DECLARED. It proves nothing about whether those
 * declared exposures match any external position system, and this kernel issues no
 * recommendation to change the fund size -- it reports the sizing arithmetic and a verdict.
 *
 * §27 BOUNDARY. No approver identity, signature, approval field, or role appears anywhere in
 * `output_payload`. A human sign-off over this artifact is a separate record whose
 * `subject_hash` is this artifact's `execution_hash`, never a payload member here.
 *
 * PII: opaque member_id strings only. No natural-person identity of any kind enters this
 * kernel -- clearing members are institutional counterparties.
 *
 * NO CLOCK. `as_of` is a caller-declared input; compute() never reads a clock.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: CCP-CORE-BUILD-SPEC.md §1.3.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-530-default-fund-cover2-sizing';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'size_ccp_default_fund_cover2', mandate_type: 'risk_parameter', gpu: false };

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

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const as_of = isoDateOrNull(pp.as_of);
  const fund_size_minor_units = toMinorUnits(pp.fund_size_minor_units, 'fund_size_minor_units', rejected_inputs);

  // --- Members: caller declares N clearing members and their declared stress-exposure base. ---
  const membersIn = Array.isArray(pp.members) ? pp.members : [];
  if (!Array.isArray(pp.members)) rejected_inputs.push({ where: 'members', reason: 'absent or not an array', supplied: pp.members === undefined ? null : typeof pp.members });
  const seenMemberIds = new Set();
  const members = membersIn.map((m, i) => {
    m = m && typeof m === 'object' ? m : {};
    let member_id = isNonEmptyString(m.member_id) ? m.member_id.trim() : `UNLABELLED-MEMBER-${i + 1}`;
    if (seenMemberIds.has(member_id)) { rejected_inputs.push({ where: `members[${i}].member_id`, reason: 'duplicate member_id', supplied: member_id }); member_id = `${member_id}-DUP-${i + 1}`; }
    seenMemberIds.add(member_id);
    const exposure_minor_units = toMinorUnits(m.exposure_minor_units, `members[${i}].exposure_minor_units`, rejected_inputs);
    return { member_id, exposure_minor_units };
  });

  // --- Stress scenarios: caller-declared loss_bps per scenario, shaped from qfa-03's scenario_losses. ---
  const scenariosIn = Array.isArray(pp.stress_scenarios) ? pp.stress_scenarios : [];
  if (!Array.isArray(pp.stress_scenarios)) rejected_inputs.push({ where: 'stress_scenarios', reason: 'absent or not an array', supplied: pp.stress_scenarios === undefined ? null : typeof pp.stress_scenarios });
  const seenScenarioIds = new Set();
  const scenarios = scenariosIn.map((s, i) => {
    s = s && typeof s === 'object' ? s : {};
    let scenario_id = isNonEmptyString(s.scenario_id) ? s.scenario_id.trim() : `UNLABELLED-SCENARIO-${i + 1}`;
    if (seenScenarioIds.has(scenario_id)) { rejected_inputs.push({ where: `stress_scenarios[${i}].scenario_id`, reason: 'duplicate scenario_id', supplied: scenario_id }); scenario_id = `${scenario_id}-DUP-${i + 1}`; }
    seenScenarioIds.add(scenario_id);
    const loss_bps = toBpsOrNull(s.loss_bps, `stress_scenarios[${i}].loss_bps`, rejected_inputs) ?? 0;
    return { scenario_id, loss_bps };
  });

  const per_scenario = scenarios.map((sc) => {
    const member_losses = members
      .map((m) => ({ member_id: m.member_id, stress_loss_minor_units: Math.trunc(m.exposure_minor_units * sc.loss_bps / 10000) }))
      .sort((a, b) => b.stress_loss_minor_units - a.stress_loss_minor_units);
    const largest = member_losses.length > 0 ? member_losses[0] : null;
    const second_largest = member_losses.length > 1 ? member_losses[1] : null;
    const cover2_requirement_minor_units = (largest ? largest.stress_loss_minor_units : 0) + (second_largest ? second_largest.stress_loss_minor_units : 0);
    return {
      scenario_id: sc.scenario_id,
      loss_bps: sc.loss_bps,
      member_losses,
      largest,
      second_largest,
      cover2_requirement_minor_units,
      cover2_requirement_display: display(cover2_requirement_minor_units),
    };
  });

  let worst = null;
  for (const row of per_scenario) {
    if (worst === null || row.cover2_requirement_minor_units > worst.cover2_requirement_minor_units) worst = row;
  }
  const worst_case_scenario_id = worst ? worst.scenario_id : null;
  const worst_case_cover2_requirement_minor_units = worst ? worst.cover2_requirement_minor_units : 0;

  const inputs_insufficient = members.length === 0 || scenarios.length === 0;
  const fund_adequate = fund_size_minor_units >= worst_case_cover2_requirement_minor_units;
  const shortfall_minor_units = fund_adequate ? 0 : (worst_case_cover2_requirement_minor_units - fund_size_minor_units);

  const compliance_flags = [];
  if (inputs_insufficient) compliance_flags.push('COVER2_INPUTS_INSUFFICIENT');
  compliance_flags.push(fund_adequate ? 'COVER2_FUND_ADEQUATE' : 'COVER2_FUND_SHORTFALL');

  const rationale = [];
  rationale.push(`${members.length} declared clearing member${members.length === 1 ? '' : 's'} evaluated across ${scenarios.length} declared stress scenario${scenarios.length === 1 ? '' : 's'}.`);
  if (worst) {
    rationale.push(`Worst-case scenario "${worst_case_scenario_id}" at ${worst.loss_bps} bps: largest member loss ${worst.largest ? display(worst.largest.stress_loss_minor_units) : '0.00'}${worst.largest ? ` (${worst.largest.member_id})` : ''}, second-largest ${worst.second_largest ? display(worst.second_largest.stress_loss_minor_units) : '0.00'}${worst.second_largest ? ` (${worst.second_largest.member_id})` : ''}; Cover-2 requirement ${display(worst_case_cover2_requirement_minor_units)}.`);
  } else {
    rationale.push('No stress scenarios declared: Cover-2 requirement is 0.00 by definition of an empty scenario set, not a passing adequacy result.');
  }
  rationale.push(`Declared default fund size ${display(fund_size_minor_units)} is ${fund_adequate ? 'adequate against' : 'short of'} the worst-case Cover-2 requirement of ${display(worst_case_cover2_requirement_minor_units)}${fund_adequate ? '.' : `, a shortfall of ${display(shortfall_minor_units)}.`}`);
  rationale.push('This is an arithmetic sizing check over declared member exposures, declared stress-scenario loss rates, and a declared fund size. It proves nothing about whether those declarations match any external position or margin system, and it recommends no fund-size change.');

  const output_payload = {
    as_of,
    fund_size_minor_units,
    fund_size_display: display(fund_size_minor_units),
    member_count: members.length,
    scenario_count: scenarios.length,
    per_scenario,
    worst_case_scenario_id,
    worst_case_cover2_requirement_minor_units,
    worst_case_cover2_requirement_display: display(worst_case_cover2_requirement_minor_units),
    fund_adequate,
    shortfall_minor_units,
    shortfall_display: display(shortfall_minor_units),
    rejected_inputs,
    rationale,
    note: 'Deterministic Cover-2 default fund sizing over caller-declared clearing members, member exposures, stress-scenario loss rates (shaped from a stress-test-engine chain input as basis points), and a declared fund size. Per PFMI Principle 4, the fund must cover the default of the two members creating the largest combined stress loss under the worst declared scenario. No CCP, currency, or jurisdiction is named. It performs no stress-scenario computation of its own -- that shape is a chained input -- and it recommends no fund-size change.',
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
