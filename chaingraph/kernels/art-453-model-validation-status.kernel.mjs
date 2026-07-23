import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-453-model-validation-status';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_model_validation_status',
  mandate_type: 'compliance_control', gpu: false,
};

// Model-validation-status kernel: third node in the model-passport
// lifecycle. Combines a model's proportionality tier (art-450 output),
// its last-validation date, and its most recent outcome-analysis result
// (art-451 output) with a caller-declared as_of_date to determine SR 26-2
// validation status against a tier-based revalidation cadence (high=365d,
// moderate=730d, limited=1095d, all overridable). Dates are parsed as
// plain YYYY-MM-DD and diffed with an integer civil-calendar day-count
// (Howard Hinnant's days_from_civil) -- no Date object, no clock read, so
// the result is a pure function of its declared inputs (Date/random are
// banned in compute() for determinism; this kernel never needs "now",
// only the caller-declared as_of_date). NaN-safe. Zero network, zero PII.

const DEFAULT_CADENCE_DAYS = { limited: 1095, moderate: 730, high: 365 };

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }

// Days since 0000-03-01 (proleptic Gregorian), pure integer arithmetic.
function daysFromCivil(y, m, d) {
  y = m <= 2 ? y - 1 : y;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function parseISODate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(str));
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return daysFromCivil(y, mo, d);
}

export function compute(pp) {
  pp = pp || {};
  const tier = ['limited', 'moderate', 'high'].includes(s(pp.tier)) ? s(pp.tier) : 'limited';
  const outcome_status = ['pass', 'fail', 'not_performed'].includes(s(pp.outcome_status)) ? s(pp.outcome_status) : 'not_performed';
  const last_validation_date = s(pp.last_validation_date);
  const as_of_date = s(pp.as_of_date);
  const cadence_days = Math.max(1, Math.trunc(n(pp.cadence_days_override, DEFAULT_CADENCE_DAYS[tier])));
  const compliance_flags = [];

  const asOfDays = parseISODate(as_of_date);
  const lastValDays = last_validation_date ? parseISODate(last_validation_date) : null;
  const never_validated = !last_validation_date || lastValDays === null;

  let days_since_validation = null;
  let overdue = false;
  let next_validation_due_days = null;
  if (!never_validated && asOfDays !== null) {
    days_since_validation = asOfDays - lastValDays;
    overdue = days_since_validation > cadence_days;
    next_validation_due_days = cadence_days - days_since_validation;
  }

  let validation_status;
  if (never_validated) {
    validation_status = 'validation_required';
  } else if (overdue && outcome_status === 'fail') {
    validation_status = 'restricted_use';
  } else if (overdue) {
    validation_status = 'validation_overdue';
  } else if (outcome_status === 'fail') {
    validation_status = 'conditionally_approved';
  } else {
    validation_status = 'validated';
  }

  compliance_flags.push('VAL_STATUS_CALCULATED');
  if (never_validated) compliance_flags.push('VAL_NEVER_VALIDATED');
  if (overdue) compliance_flags.push('VAL_OVERDUE');
  if (outcome_status === 'fail') compliance_flags.push('VAL_OUTCOME_FAIL');
  if (validation_status === 'restricted_use') compliance_flags.push('VAL_RESTRICTED_USE');
  if (validation_status === 'validated') compliance_flags.push('VAL_APPROVED');

  return {
    output_payload: {
      tier,
      cadence_days,
      outcome_status,
      last_validation_date: last_validation_date || null,
      as_of_date: as_of_date || null,
      never_validated,
      days_since_validation,
      overdue,
      next_validation_due_days,
      validation_status,
    },
    compliance_flags,
  };
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
