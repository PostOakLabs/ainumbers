import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-497-validator-change-control-receipt';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_validator_change_control_receipt',
  mandate_type: 'compliance_control', gpu: false,
};

// Permissioned-validator (Avalanche Evergreen L1) change-control receipt.
// One validator add / remove / weight_change event, caller-transcribed, into
// change-control evidence in the shape the SOX/ICFR family already uses
// (art-461 control-test-evidence-composer precedent): who authorized it,
// what changed, and whether the caller's own declared approval-quorum policy
// was met. No chain observation, no P-Chain query -- the event is
// transcribed by the caller. Retargets art-41's single-subject scorer shape
// (one record in, one verdict out), not art-41's scoring rubric.
//
// quorum_required is a CALLER-DECLARED policy threshold, never baked in --
// same discipline art-445/art-494 apply to their own thresholds. This
// kernel does not count distinct identities (that is art-503's §27 job);
// it reconciles the caller's stated quorum_achieved against the caller's
// stated quorum_required and against how many authorizing identities were
// actually named, and reports the disagreement rather than trusting either
// number silently.
//
// No clock: as_of and effective_epoch are caller-supplied opaque values,
// echoed only. Zero PII: validator_ref and every identity in
// authorizing_identities are opaque references.
//
// Required inputs are fail-closed (missing-input cure, 2026-10-17 policy):
// every manifest-required field is either reconciled above or disclosed as
// unstated. as_of is required, so a missing or blank as-of date raises
// AS_OF_MISSING and escalates instead of recording undated evidence.
// prior_weight and posterior_weight are required: absent, null or non-numeric
// values are NO statement at all (a missing weight must never read as a stated
// zero, which would silently encode a from-zero add or a slash-to-zero), so
// PRIOR_WEIGHT_NOT_STATED / POSTERIOR_WEIGHT_NOT_STATED fire and escalate; an
// explicit 0 remains the caller's own statement and evaluates. The quorum and
// identity fields were already fail-closed (UNQUANTIFIED quorum status plus
// exceptions when either quorum number is missing).
//
// Statedness is strict (weight-statedness cure, 2026-11-13): a weight, the
// total stake or a quorum number is a statement ONLY as a finite JSON number,
// or as ONE strict decimal-string form (a minus sign, digits, at most one
// fractional part; quorum counts whole), because the page port sends DOM
// input strings. An empty string, a boolean, an array, an object, a blank or
// junk string is NO statement -- Number() coercion of those to a stated zero
// is exactly the silent from-zero add / slash-to-zero this kernel refuses --
// and a negative statement is refused with its own NEGATIVE exception, never
// clamped to zero. An unstated field echoes as null, never 0, and no derived
// field (delta, share) is computed from a refused statement. as_of,
// effective_epoch and validator_ref must be non-empty strings: a non-string
// scalar is a missing statement, never String()-coerced into a present one.

const CHANGE_TYPES = ['add', 'remove', 'weight_change'];
const MAX_SAFE = 9007199254740991;

function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }
function jnum(v) { return Number.isFinite(v) && Math.abs(v) > MAX_SAFE ? String(v) : (Number.isFinite(v) ? v : 0); }
function jn(v) { return v == null ? null : jnum(v); }
function str(v) { return String(v == null ? '' : v).trim(); }
function optStr(v) { return typeof v === 'string' && v.trim() !== '' ? v.trim() : null; }

// Strict statedness readers. A weight is a statement ONLY as a finite JSON
// number or as one strict decimal-string form (the page port sends DOM input
// strings); a count must additionally be whole. status 'unstated' (empty
// string, boolean, array, object, null, blank or junk string -- anything
// Number() would coerce) and status 'negative' both refuse: the value is
// carried for the echo only, never fed to a branch or a derived field.
const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;
const INTEGER_STRING = /^-?\d+$/;

function readWeight(v) {
  let n;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && DECIMAL_STRING.test(v.trim())) n = Number(v.trim());
  else return { status: 'unstated', value: null };
  if (!Number.isFinite(n)) return { status: 'unstated', value: null };
  return n < 0 ? { status: 'negative', value: n } : { status: 'stated', value: n };
}

function readCount(v) {
  let n;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && INTEGER_STRING.test(v.trim())) n = Number(v.trim());
  else return { status: 'unstated', value: null };
  if (!Number.isInteger(n)) return { status: 'unstated', value: null };
  return n < 0 ? { status: 'negative', value: n } : { status: 'stated', value: n };
}

export function compute(pp) {
  pp = pp || {};
  const exceptions = [];
  const compliance_flags = [];

  const validator_ref = optStr(pp.validator_ref);
  const rawType = typeof pp.change_type === 'string' ? pp.change_type.trim() : '';
  const change_type_valid = CHANGE_TYPES.indexOf(rawType) >= 0;
  const change_type = change_type_valid ? rawType : (rawType || 'unstated');
  if (!change_type_valid) exceptions.push('UNKNOWN_CHANGE_TYPE');

  const prior = readWeight(pp.prior_weight);
  const posterior = readWeight(pp.posterior_weight);
  if (prior.status === 'negative') exceptions.push('PRIOR_WEIGHT_NEGATIVE');
  else if (prior.status === 'unstated') exceptions.push('PRIOR_WEIGHT_NOT_STATED');
  if (posterior.status === 'negative') exceptions.push('POSTERIOR_WEIGHT_NEGATIVE');
  else if (posterior.status === 'unstated') exceptions.push('POSTERIOR_WEIGHT_NOT_STATED');
  const prior_weight = prior.value;
  const posterior_weight = posterior.value;
  const weight_delta = prior.status === 'stated' && posterior.status === 'stated'
    ? posterior.value - prior.value : null;
  const total = readWeight(pp.total_stake_weight);
  if (total.status === 'negative') exceptions.push('TOTAL_STAKE_WEIGHT_NEGATIVE');
  else if (total.status === 'unstated') exceptions.push('TOTAL_STAKE_WEIGHT_NOT_STATED');
  else if (total.value === 0) exceptions.push('TOTAL_STAKE_WEIGHT_ZERO_OR_ABSENT');
  const total_stake_weight = total.value;
  const share_of_total_pct = total_stake_weight > 0 && weight_delta !== null
    ? r2((weight_delta / total_stake_weight) * 100) : null;

  if (change_type === 'add') {
    if (prior.status === 'stated' && prior_weight !== 0) exceptions.push('ADD_WITH_NONZERO_PRIOR_WEIGHT');
    if (posterior.status === 'stated' && posterior_weight <= 0) exceptions.push('ADD_WITH_NONPOSITIVE_POSTERIOR_WEIGHT');
  } else if (change_type === 'remove') {
    if (posterior.status === 'stated' && posterior_weight !== 0) exceptions.push('REMOVE_WITH_NONZERO_POSTERIOR_WEIGHT');
    if (prior.status === 'stated' && prior_weight <= 0) exceptions.push('REMOVE_WITH_NONPOSITIVE_PRIOR_WEIGHT');
  } else if (change_type === 'weight_change') {
    if (prior.status === 'stated' && posterior.status === 'stated' && prior_weight === posterior_weight) {
      exceptions.push('WEIGHT_CHANGE_WITH_NO_DELTA');
    }
  }

  const authorization_chain = Array.isArray(pp.authorizing_identities)
    ? pp.authorizing_identities.map(str).filter(Boolean)
    : [];
  const authorized = authorization_chain.length > 0;
  if (!authorized) exceptions.push('NO_AUTHORIZING_IDENTITY');

  const qr = readCount(pp.quorum_required);
  const qa = readCount(pp.quorum_achieved);
  const quorum_required = qr.value;
  const quorum_achieved = qa.value;
  const quorum_required_evaluable = qr.status === 'stated' && qr.value > 0;
  let quorum_status;
  if (qr.status === 'negative') {
    quorum_status = 'UNQUANTIFIED';
    exceptions.push('QUORUM_REQUIRED_NEGATIVE');
  } else if (!quorum_required_evaluable) {
    quorum_status = 'UNQUANTIFIED';
    exceptions.push('QUORUM_REQUIRED_NOT_STATED');
  } else if (qa.status === 'negative') {
    quorum_status = 'UNQUANTIFIED';
    exceptions.push('QUORUM_ACHIEVED_NEGATIVE');
  } else if (qa.status !== 'stated') {
    quorum_status = 'UNQUANTIFIED';
    exceptions.push('QUORUM_ACHIEVED_NOT_STATED');
  } else {
    quorum_status = quorum_achieved >= quorum_required ? 'MET' : 'SHORT';
    if (quorum_achieved > authorization_chain.length) {
      exceptions.push('QUORUM_ACHIEVED_EXCEEDS_NAMED_AUTHORIZERS');
    }
  }

  const effective_epoch = optStr(pp.effective_epoch);
  if (!effective_epoch) exceptions.push('EFFECTIVE_EPOCH_MISSING');
  const as_of = optStr(pp.as_of);
  if (!as_of) exceptions.push('AS_OF_MISSING');

  if (validator_ref) {
    compliance_flags.push('VCC_RECORDED');
  } else {
    exceptions.push('VALIDATOR_REF_MISSING');
    compliance_flags.push('VCC_VALIDATOR_REF_MISSING');
  }
  if (quorum_status === 'MET') compliance_flags.push('VCC_QUORUM_MET');
  else if (quorum_status === 'SHORT') compliance_flags.push('VCC_QUORUM_SHORT');
  if (!authorized) compliance_flags.push('VCC_UNAUTHORIZED_CHANGE');

  const escalate = !validator_ref || !authorized || quorum_status === 'SHORT' || exceptions.length > 0;
  if (escalate) compliance_flags.push('ESCALATION_RAISED');

  return {
    output_payload: {
      validator_ref: validator_ref || null,
      change_type,
      change_type_valid,
      prior_weight: jn(prior_weight),
      posterior_weight: jn(posterior_weight),
      weight_delta: jn(weight_delta),
      total_stake_weight: jn(total_stake_weight),
      share_of_total_pct,
      authorization_chain,
      authorized,
      quorum_required,
      quorum_achieved,
      quorum_status,
      effective_epoch,
      as_of,
      exceptions,
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
