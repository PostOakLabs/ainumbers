import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-99-mica-transitional-deadline-router';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'route_mica_transitional_deadline',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Art 143(3) deadline lookup
const CLIFF_STATES = new Set(['FR','IT','ES','MT','LU','PT','CY','NL','BE','DE','AT','IE','GR','PL','CZ','HU']);
const EXTENDED_STATES = new Set(['SE','DK','FI','NO']);
const CLIFF_DEADLINE = '2026-06-30';
const EXTENDED_DEADLINE = '2026-12-30';
const DEFAULT_DEADLINE = '2026-12-30';
const TODAY = '2026-06-22';

export function compute(pp) {
  const {
    member_state = '',
    existing_registration = 'no',
    national_regime = 'none',
  } = pp.inputs ?? pp;

  const ms = member_state.trim().toUpperCase();

  let deadline;
  if (CLIFF_STATES.has(ms)) {
    deadline = CLIFF_DEADLINE;
  } else if (EXTENDED_STATES.has(ms)) {
    deadline = EXTENDED_DEADLINE;
  } else {
    deadline = DEFAULT_DEADLINE;
  }

  const todayDate = new Date(TODAY);
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate - todayDate;
  const window_months = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));

  let decision;
  if (existing_registration === 'no' && window_months < 0) {
    decision = 'wind-down';
  } else if (existing_registration === 'no' && window_months < 1) {
    decision = 'wind-down';
  } else {
    decision = 'file';
  }

  const file_by_preconditions = [
    'Submit authorization application to NCA before transitional end',
    'Ensure Art 62 application pack complete',
  ];

  const compliance_flags = [];
  if (window_months < 1 && window_months > -12) compliance_flags.push('DEADLINE_IMMINENT');
  if (decision === 'wind-down') compliance_flags.push('WIND_DOWN_PATH');

  const output_payload = {
    transitional_end_date: deadline,
    window_months,
    file_by_preconditions,
    decision,
    state_specific_notes: 'Art 143(3) MiCA Reg. (EU) 2023/1114. ESMA grandfathering list includes 16 cliff states with 30 Jun 2026 deadline.',
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. Verify current ESMA grandfathering list and national implementation against official sources.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode: 'server',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    audit_signature: {
      payloadType: 'application/vnd.openchain.graph+json;version=0.4',
      payload: '',
      signatures: [],
    },
  };
}
