import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-103-mar-crypto-surveillance-readiness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'assess_mar_crypto_surveillance',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

function scoreArrangement(value, readyValue, partialValue) {
  if (value === readyValue) return 100;
  if (value === partialValue) return 50;
  return 0;
}

export function compute(pp) {
  const { inputs = {} } = pp;
  const {
    ppaet_arrangements = 'none',
    stor_templates = 'none',
    insider_lists = 'none',
    manipulation_detection = 'none',
    asset_scope = [],
  } = inputs;

  const ppaet_score = scoreArrangement(ppaet_arrangements, 'in-place', 'partial');
  const stor_score = scoreArrangement(stor_templates, 'ready', 'partial');
  const insider_score = scoreArrangement(insider_lists, 'maintained', 'partial');
  const manip_score = scoreArrangement(manipulation_detection, 'in-place', 'partial');

  const composite_pct = Math.round((ppaet_score + stor_score + insider_score + manip_score) / 4);

  let grade;
  if (composite_pct >= 88) {
    grade = 'A';
  } else if (composite_pct >= 72) {
    grade = 'B';
  } else if (composite_pct >= 56) {
    grade = 'C';
  } else if (composite_pct >= 40) {
    grade = 'D';
  } else {
    grade = 'F';
  }

  const stor_ready = stor_templates === 'ready';

  const arrangement_scores = {
    ppaet: ppaet_score,
    stor: stor_score,
    insider_list: insider_score,
    manipulation: manip_score,
  };

  const gaps = Object.entries(arrangement_scores)
    .filter(([, score]) => score < 75)
    .map(([key]) => key);

  const compliance_flags = [];
  if (ppaet_arrangements === 'none') compliance_flags.push('NO_PPAET_ARRANGEMENTS');
  if (stor_templates === 'none') compliance_flags.push('STOR_NOT_READY');

  const output_payload = {
    surveillance_grade: grade,
    composite_pct,
    arrangement_scores,
    ppaet_status: ppaet_arrangements,
    stor_ready,
    assets_in_scope: asset_scope.length,
    gaps,
    mar_rts_note:
      'ESMA MAR-crypto RTS finalised 17 Dec 2024 (ESMA70-472101844-4975). Arts 86-92 MiCA Reg. (EU) 2023/1114.',
    reference_version: '2026-06',
    note: 'Assessed on synthetic order/trade configuration only. No real transaction data. Decision-support draft.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(
  pp,
  { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}
) {
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
