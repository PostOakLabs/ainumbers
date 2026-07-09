import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-156-emir-counterparty-pairing-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_emir_pairing',
  mandate_type: 'compliance_mandate', gpu: false,
  export_capability: ['json', 'pdf', 'vc'],
};

export function compute(pp) {
  const { report_a = {}, report_b = {}, matching_fields = [], numeric_tolerance_pct = 0 } = pp;
  const fields = Array.isArray(matching_fields) ? matching_fields : [];
  const tol = Number.isFinite(Number(numeric_tolerance_pct)) ? Math.abs(Number(numeric_tolerance_pct)) : 0;
  const uti_paired = typeof report_a.uti === 'string' && report_a.uti === report_b.uti;
  const breaks = [];

  fields.forEach((f) => {
    const av = report_a[f], bv = report_b[f];
    const an = Number(av), bn = Number(bv);
    let matched;
    if (Number.isFinite(an) && Number.isFinite(bn)) {
      const denom = Math.max(Math.abs(an), Math.abs(bn), 1);
      const diff_pct = (Math.abs(an - bn) / denom) * 100;
      matched = Number.isFinite(diff_pct) ? diff_pct <= tol : (an === bn);
    } else {
      matched = av === bv;
    }
    if (!matched) breaks.push({ field: f, a: av ?? null, b: bv ?? null });
  });

  const reconciled = uti_paired && breaks.length === 0;
  const compliance_flags = [];
  compliance_flags.push('EMIR_PAIRING_ASSESSED');
  compliance_flags.push(reconciled ? 'EMIR_PAIR_RECONCILED' : 'EMIR_PAIR_BREAK');
  if (!uti_paired) compliance_flags.push('UTI_PAIRING_FAILED');

  return {
    output_payload: {
      reconciled,
      uti_paired,
      fields_compared: fields.length,
      break_count: breaks.length,
      breaks,
    },
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
