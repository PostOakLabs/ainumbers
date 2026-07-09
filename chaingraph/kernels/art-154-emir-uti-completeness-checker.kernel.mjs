import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-154-emir-uti-completeness-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_emir_uti_completeness',
  mandate_type: 'compliance_mandate', gpu: false,
};

export function compute(pp) {
  const { uti, generating_party, trade_unix, uti_shared_unix } = pp;
  const format_ok = typeof uti === 'string' && /^[A-Z0-9]{1,52}$/i.test(uti);
  const generator_known = typeof generating_party === 'string' && generating_party.length > 0;
  // T+1 10:00 sharing SLA: shared within ~34h of trade (1 business day + to 10:00) — finite-guarded.
  const t = Number.isFinite(Number(trade_unix)) ? Number(trade_unix) : NaN;
  const s = Number.isFinite(Number(uti_shared_unix)) ? Number(uti_shared_unix) : NaN;
  const lag_h = (Number.isFinite(t) && Number.isFinite(s)) ? Math.round(((s - t) / 3600) * 100) / 100 : null;
  const shared_on_time = lag_h === null ? null : (lag_h >= 0 && lag_h <= 34);
  const uti_complete = format_ok && generator_known && shared_on_time !== false;

  const compliance_flags = [];
  compliance_flags.push('EMIR_UTI_ASSESSED');
  compliance_flags.push(uti_complete ? 'EMIR_UTI_COMPLETE' : 'EMIR_UTI_INCOMPLETE');
  if (shared_on_time === false) compliance_flags.push('UTI_SHARED_LATE');
  if (!format_ok) compliance_flags.push('UTI_MALFORMED');

  return {
    output_payload: { uti_complete, format_ok, generator_known, lag_h, shared_on_time },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
