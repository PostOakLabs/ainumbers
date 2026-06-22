import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-101-mica-art67-own-funds-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'calculate_mica_own_funds',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Annex IV permanent minimums (EUR)
const PERMANENT_MINIMUMS = {
  'advisory': 50000,
  'trading-platform': 125000,
  'custody-exchange': 150000,
};

export function compute(pp) {
  const {
    service_class = 'advisory',
    fixed_overheads_annual = 0,
    own_funds_held = 0,
    own_funds_form = 'cet1',
  } = pp.inputs ?? pp;

  const permanent_minimum = PERMANENT_MINIMUMS[service_class] ?? 50000;
  const foh_quarter = fixed_overheads_annual / 4;
  const required = Math.max(permanent_minimum, foh_quarter);
  const surplus_shortfall = own_funds_held - required;
  const form_eligible = own_funds_form === 'cet1';
  const binding_basis = foh_quarter > permanent_minimum ? 'fixed-overheads-quarter' : 'permanent-minimum';

  const compliance_flags = [];
  if (surplus_shortfall < 0) compliance_flags.push('OWN_FUNDS_SHORTFALL');
  if (binding_basis === 'fixed-overheads-quarter') compliance_flags.push('FIXED_OVERHEADS_BINDING');

  const output_payload = {
    required_own_funds: required,
    permanent_minimum,
    fixed_overheads_quarter: foh_quarter,
    binding_basis,
    own_funds_held,
    surplus_shortfall,
    form_eligible,
    form_note: 'CET1 is the primary eligible form; insurance/guarantee are conditional (verify Annex IV)',
    reference_version: '2026-06',
    note: 'Art 67 + Annex IV MiCA Reg. (EU) 2023/1114. Verify current thresholds.',
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
