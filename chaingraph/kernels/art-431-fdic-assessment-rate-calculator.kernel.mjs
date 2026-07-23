import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-431-fdic-assessment-rate-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_fdic_assessment_rate',
  mandate_type: 'compliance_mandate', gpu: false,
};

// FDIC deposit-insurance assessment rate calculator (12 CFR 327): looks up the base assessment
// rate for a supplied composite CAMELS + financial-ratio score against a caller-supplied rate
// schedule, then applies the unsecured-debt and brokered-deposit adjustments and floors/caps the
// result to a caller-supplied statutory range. The composite score itself (FDIC's proprietary
// CAMELS-component + financial-ratio regression) and the current published rate schedule are both
// policy input, not hardcoded -- a future FDIC rate-schedule update (including the pending
// assessments NPR) is a policy_parameters change, not a kernel change. BANKING-OCG-BUILD-SPEC.md
// §4.7.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Basis-point figures
// rounded to 2 decimals (r2) only at declared output boundaries; a zero/empty rate schedule is
// reported via base_rate_bp: null (finite gate: never NaN/Infinity).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function lookupBaseRate(totalScore, brackets) {
  const rows = arr(brackets)
    .map((b) => ({
      max_score: b && b.max_score === null ? Infinity : safeNum(b && b.max_score, Infinity),
      base_rate_bp: safeNum(b && b.base_rate_bp, null),
    }))
    .filter((b) => b.base_rate_bp !== null)
    .sort((a, b) => a.max_score - b.max_score);
  if (rows.length === 0) return null;
  const hit = rows.find((b) => totalScore <= b.max_score);
  return hit ? hit.base_rate_bp : rows[rows.length - 1].base_rate_bp;
}

export function compute(pp) {
  pp = pp || {};

  const rateScheduleVersion = (typeof pp.rate_schedule_version === 'string' && pp.rate_schedule_version) || null;
  const totalScore = clamp(safeNum(pp.total_score, 0), 0, 100);
  const assessmentBaseMusd = Math.max(0, safeNum(pp.assessment_base_musd, 0));
  const unsecuredDebtAdjBp = safeNum(pp.unsecured_debt_adjustment_bp, 0);
  const brokeredDepositAdjBp = safeNum(pp.brokered_deposit_adjustment_bp, 0);
  const rateFloorBp = safeNum(pp.rate_floor_bp, 0);
  const rateCapBp = safeNum(pp.rate_cap_bp, Infinity);

  const baseRateBp = lookupBaseRate(totalScore, pp.rate_brackets);
  const preClampRateBp = baseRateBp === null ? null : baseRateBp + unsecuredDebtAdjBp + brokeredDepositAdjBp;
  const totalRateBp = preClampRateBp === null ? null : clamp(preClampRateBp, rateFloorBp, rateCapBp);
  const rateClamped = preClampRateBp !== null && totalRateBp !== null && totalRateBp !== preClampRateBp;

  const quarterlyAssessmentMusd = totalRateBp === null ? null
    : r2(assessmentBaseMusd * (totalRateBp / 10000) / 4);

  const compliance_flags = [];
  if (baseRateBp === null) compliance_flags.push('FDIC_RATE_SCHEDULE_MISSING_OR_EMPTY');
  else compliance_flags.push('FDIC_ASSESSMENT_RATE_COMPUTED');
  if (rateClamped) compliance_flags.push('FDIC_ASSESSMENT_RATE_FLOOR_OR_CAP_APPLIED');

  const output_payload = {
    rate_schedule_version: rateScheduleVersion,
    total_score: r2(totalScore),
    base_rate_bp: r2(baseRateBp),
    unsecured_debt_adjustment_bp: r2(unsecuredDebtAdjBp),
    brokered_deposit_adjustment_bp: r2(brokeredDepositAdjBp),
    total_rate_bp: r2(totalRateBp),
    rate_floor_bp: r2(rateFloorBp),
    rate_cap_bp: Number.isFinite(rateCapBp) ? r2(rateCapBp) : null,
    rate_floor_or_cap_applied: rateClamped,
    assessment_base_musd: r2(assessmentBaseMusd),
    estimated_quarterly_assessment_musd: quarterlyAssessmentMusd,
    npr_banner: 'A pending FDIC assessments rulemaking (NPR, June 2026) may revise this rate schedule -- verify the current published schedule at fdic.gov before relying on this output for any live filing decision.',
    note: 'Base rate = lookup of the supplied composite CAMELS + financial-ratio score against a caller-supplied rate-bracket schedule (policy input, not hardcoded), then adjusted for unsecured debt and brokered deposits and floored/capped to the caller-supplied statutory range. Does NOT compute the composite score itself and is NOT a filing-ready assessment invoice.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
