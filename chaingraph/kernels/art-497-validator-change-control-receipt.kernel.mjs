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

const CHANGE_TYPES = ['add', 'remove', 'weight_change'];
const MAX_SAFE = 9007199254740991;

function g(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function gz(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }
function jnum(v) { return Number.isFinite(v) && Math.abs(v) > MAX_SAFE ? String(v) : (Number.isFinite(v) ? v : 0); }
function str(v) { return String(v == null ? '' : v).trim(); }

export function compute(pp) {
  pp = pp || {};
  const exceptions = [];
  const compliance_flags = [];

  const validator_ref = str(pp.validator_ref);
  const rawType = str(pp.change_type);
  const change_type_valid = CHANGE_TYPES.indexOf(rawType) >= 0;
  const change_type = change_type_valid ? rawType : (rawType || 'unstated');
  if (!change_type_valid) exceptions.push('UNKNOWN_CHANGE_TYPE');

  const prior_weight = gz(pp.prior_weight);
  const posterior_weight = gz(pp.posterior_weight);
  const weight_delta = posterior_weight - prior_weight;
  const total_stake_weight = gz(pp.total_stake_weight);
  const share_of_total_pct = total_stake_weight > 0 ? r2((weight_delta / total_stake_weight) * 100) : null;
  if (total_stake_weight <= 0) exceptions.push('TOTAL_STAKE_WEIGHT_ZERO_OR_ABSENT');

  if (change_type === 'add') {
    if (prior_weight !== 0) exceptions.push('ADD_WITH_NONZERO_PRIOR_WEIGHT');
    if (posterior_weight <= 0) exceptions.push('ADD_WITH_NONPOSITIVE_POSTERIOR_WEIGHT');
  } else if (change_type === 'remove') {
    if (posterior_weight !== 0) exceptions.push('REMOVE_WITH_NONZERO_POSTERIOR_WEIGHT');
    if (prior_weight <= 0) exceptions.push('REMOVE_WITH_NONPOSITIVE_PRIOR_WEIGHT');
  } else if (change_type === 'weight_change') {
    if (prior_weight === posterior_weight) exceptions.push('WEIGHT_CHANGE_WITH_NO_DELTA');
  }

  const authorization_chain = Array.isArray(pp.authorizing_identities)
    ? pp.authorizing_identities.map(str).filter(Boolean)
    : [];
  const authorized = authorization_chain.length > 0;
  if (!authorized) exceptions.push('NO_AUTHORIZING_IDENTITY');

  const quorum_required = g(pp.quorum_required);
  const quorum_required_evaluable = quorum_required !== null && quorum_required > 0;
  const quorum_achieved = g(pp.quorum_achieved);
  let quorum_status;
  if (!quorum_required_evaluable) {
    quorum_status = 'UNQUANTIFIED';
    exceptions.push('QUORUM_REQUIRED_NOT_STATED');
  } else if (quorum_achieved === null) {
    quorum_status = 'UNQUANTIFIED';
    exceptions.push('QUORUM_ACHIEVED_NOT_STATED');
  } else {
    quorum_status = quorum_achieved >= quorum_required ? 'MET' : 'SHORT';
    if (quorum_achieved > authorization_chain.length) {
      exceptions.push('QUORUM_ACHIEVED_EXCEEDS_NAMED_AUTHORIZERS');
    }
  }

  const effective_epoch = str(pp.effective_epoch) || null;
  if (!effective_epoch) exceptions.push('EFFECTIVE_EPOCH_MISSING');
  const as_of = str(pp.as_of) || null;

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
      prior_weight: jnum(prior_weight),
      posterior_weight: jnum(posterior_weight),
      weight_delta: jnum(weight_delta),
      total_stake_weight: jnum(total_stake_weight),
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
