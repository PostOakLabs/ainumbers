import { executionHash } from './_hash.mjs';

// 817-eth-l2-stage-classifier: classify the properties a caller declares for one Ethereum L2
// against a fixed list of maturity criteria, and report which criteria each declared property
// meets, fails or leaves unresolved. Pure decision logic over declared inputs.
//
// DETERMINISM: compute() is a pure function of pp. No clock, no randomness, no network, no
// TextEncoder. A property the caller did not declare is never guessed: its criterion is
// INDETERMINATE. The node never states a live stage; it reads only what the caller declared.

const TOOL_ID = '817-eth-l2-stage-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_l2_stage_criteria',
  mandate_type: 'compliance_control', gpu: false,
};

const MIN_FRAUD_PROOF_ACTORS = 5;
const MIN_COUNCIL_SHARE_PCT = 75;
const MIN_NON_COUNCIL_EXIT_DAYS = 7;
const MIN_UNWANTED_UPGRADE_EXIT_DAYS = 30;
const MAX_ACTORS = 1000000;
const MAX_DAYS = 36500;

const BOOL_FIELDS = [
  'self_identifies_as_rollup', 'state_roots_posted_on_l1', 'da_on_l1', 'reconstruction_software_available',
  'has_proper_proof_system', 'fraud_proof_permissionless', 'security_council_present',
  'non_council_upgrades_possible', 'council_restricted_to_onchain_detected_errors',
];
const PROOF_TYPES = ['fraud', 'validity', 'none'];

const MET = 'MET';
const FAILED = 'FAILED';
const INDET = 'INDETERMINATE';
const NA = 'NOT_APPLICABLE';

const EDGE_CASES_NOT_EVALUATED = [
  'liveness_failure_upper_bound', 'forced_transaction_delay_upper_bound', 'frontrunning_risk', 'based_preconfs',
];

function refuse(code) {
  // `issues` mirrors compliance_flags in output_payload (ART806-MIRROR-ISSUES-1).
  const issues = [code];
  return { output_payload: { refused: true, refusal_code: code, issues }, compliance_flags: ['INPUT_REFUSED'] };
}

/** A declared value, or null when absent. */
const decl = (v) => (v === undefined ? null : v);

/** @param {boolean | null} v */
function boolStatus(v) {
  if (v === null) return INDET;
  return v ? MET : FAILED;
}

/** @param {number | null} v @param {number} min */
function minStatus(v, min) {
  if (v === null) return INDET;
  return v >= min ? MET : FAILED;
}

/**
 * @param {string} id @param {number} stage @param {string} status @param {unknown} declared
 * @param {unknown} threshold @param {string} basis
 */
function crit(id, stage, status, declared, threshold, basis) {
  return { id, stage, status, declared, threshold, basis };
}

export function compute(pp) {
  pp = pp || {};
  if (typeof pp !== 'object' || Array.isArray(pp)) return refuse('INPUT_NOT_AN_OBJECT');

  /** @type {Record<string, boolean | null>} */
  const b = {};
  for (const k of BOOL_FIELDS) {
    const v = decl(pp[k]);
    if (v !== null && typeof v !== 'boolean') return refuse('BOOLEAN_FIELD_NOT_BOOLEAN');
    b[k] = v;
  }

  const ptype = decl(pp.proof_system_type);
  if (ptype !== null && !PROOF_TYPES.includes(ptype)) return refuse('PROOF_SYSTEM_TYPE_UNKNOWN');

  const actors = decl(pp.fraud_proof_external_actors);
  if (actors !== null && !(Number.isInteger(actors) && actors >= 0 && actors <= MAX_ACTORS)) return refuse('FRAUD_PROOF_ACTORS_OUT_OF_RANGE');

  const share = decl(pp.council_min_share_to_compromise_pct);
  if (share !== null && !(typeof share === 'number' && Number.isFinite(share) && share >= 0 && share <= 100)) return refuse('COUNCIL_SHARE_OUT_OF_RANGE');

  const days = {};
  for (const k of ['non_council_upgrade_exit_window_days', 'unwanted_upgrade_exit_window_days']) {
    const v = decl(pp[k]);
    if (v !== null && !(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_DAYS)) return refuse('EXIT_WINDOW_OUT_OF_RANGE');
    days[k] = v;
  }

  if (ptype === 'none' && b.has_proper_proof_system === true) return refuse('PROOF_SYSTEM_DECLARATIONS_CONTRADICT');
  // A council share is only meaningful when a council exists.
  if (b.security_council_present === false && share !== null) return refuse('COUNCIL_SHARE_DECLARED_WITHOUT_COUNCIL');

  const fraud = ptype === 'fraud';
  const proofDependent = (status) => (ptype === null ? INDET : (fraud ? status : NA));

  const nonCouncilWindow = b.non_council_upgrades_possible === true ? days.non_council_upgrade_exit_window_days : null;
  let s1b;
  if (b.non_council_upgrades_possible === null) s1b = INDET;
  else if (b.non_council_upgrades_possible === false) s1b = MET;
  else s1b = minStatus(nonCouncilWindow, MIN_NON_COUNCIL_EXIT_DAYS);

  let s2c;
  if (b.security_council_present === null) s2c = INDET;
  else if (b.security_council_present === false) s2c = NA;
  else s2c = boolStatus(b.council_restricted_to_onchain_detected_errors);

  const criteria = [
    crit('S0-1', 0, boolStatus(b.self_identifies_as_rollup), b.self_identifies_as_rollup, true, 'S0a'),
    crit('S0-2', 0, boolStatus(b.state_roots_posted_on_l1), b.state_roots_posted_on_l1, true, 'S0a'),
    crit('S0-3', 0, boolStatus(b.da_on_l1), b.da_on_l1, true, 'S0a'),
    crit('S0-4', 0, boolStatus(b.reconstruction_software_available), b.reconstruction_software_available, true, 'S0a'),
    crit('S0-5', 0, boolStatus(b.has_proper_proof_system), b.has_proper_proof_system, true, 'S0a'),
    crit('S0-6', 0, proofDependent(minStatus(actors, MIN_FRAUD_PROOF_ACTORS)), fraud ? actors : null, MIN_FRAUD_PROOF_ACTORS, 'S0b'),
    crit('S1-1', 1, b.security_council_present === false ? NA : minStatus(share, MIN_COUNCIL_SHARE_PCT), share, MIN_COUNCIL_SHARE_PCT, 'S1'),
    crit('S1-2', 1, s1b, nonCouncilWindow, MIN_NON_COUNCIL_EXIT_DAYS, 'S1'),
    crit('S2-1', 2, proofDependent(boolStatus(b.fraud_proof_permissionless)), fraud ? b.fraud_proof_permissionless : null, true, 'S2a'),
    crit('S2-2', 2, minStatus(days.unwanted_upgrade_exit_window_days, MIN_UNWANTED_UPGRADE_EXIT_DAYS), days.unwanted_upgrade_exit_window_days, MIN_UNWANTED_UPGRADE_EXIT_DAYS, 'S2b'),
    crit('S2-3', 2, s2c, b.security_council_present === true ? b.council_restricted_to_onchain_detected_errors : null, true, 'S2c'),
  ];

  // Stage-by-stage tallies, then walk the stages in order. A failed criterion fixes the reading at
  // the stage below; an unresolved one stops the walk with no reading at all.
  const stages = [0, 1, 2].map((n) => {
    const rows = criteria.filter((c) => c.stage === n);
    const count = (st) => rows.filter((c) => c.status === st).length;
    return { stage: n, met: count(MET), failed: count(FAILED), indeterminate: count(INDET), not_applicable: count(NA) };
  });
  let level = 'STAGE_2';
  let confirmed = 2;
  let firstUnresolved = null;
  for (const st of stages) {
    if (st.failed > 0) { confirmed = st.stage - 1; level = st.stage === 0 ? 'BELOW_STAGE_0' : `STAGE_${st.stage - 1}`; break; }
    if (st.indeterminate > 0) { confirmed = st.stage - 1; level = 'INDETERMINATE'; firstUnresolved = st.stage; break; }
  }

  const failedIds = criteria.filter((c) => c.status === FAILED).map((c) => c.id);
  const indetIds = criteria.filter((c) => c.status === INDET).map((c) => c.id);
  const flags = [];
  if (failedIds.length > 0) flags.push('CRITERIA_FAILED');
  if (indetIds.length > 0) flags.push('DECLARATION_MISSING');

  return {
    output_payload: {
      refused: false,
      declared_level: level,
      highest_confirmed_stage: confirmed < 0 ? null : confirmed,
      first_unresolved_stage: firstUnresolved,
      live_stage_asserted: false,
      criteria,
      stage_tallies: stages,
      failed_criteria: failedIds,
      indeterminate_criteria: indetIds,
      edge_cases_not_evaluated: EDGE_CASES_NOT_EVALUATED,
      issues: flags.slice(),
    },
    compliance_flags: flags,
  };
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
