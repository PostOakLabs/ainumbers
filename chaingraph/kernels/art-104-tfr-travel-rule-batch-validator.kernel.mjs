import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-104-tfr-travel-rule-batch-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_tfr_travel_rule_batch',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

function djb2Hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h;
}

export function compute(pp) {
  const { inputs = {} } = pp;
  const {
    transfer_batch = [],
    tfr_threshold = 1000,
  } = inputs;

  const transfers_flagged = [];
  let unhosted_dd_required_count = 0;

  for (const transfer of transfer_batch) {
    const {
      transfer_id,
      originator_name,
      originator_account,
      beneficiary_name,
      beneficiary_account,
      counterparty_type = 'casp',
      amount_eur = 0,
    } = transfer || {};

    const missing_fields = [];

    // Always required
    if (!originator_name) missing_fields.push('originator_name');
    if (!originator_account) missing_fields.push('originator_account');

    if (counterparty_type === 'casp') {
      if (!beneficiary_name) missing_fields.push('beneficiary_name');
      if (!beneficiary_account) missing_fields.push('beneficiary_account');
    } else if (counterparty_type === 'unhosted') {
      if (!beneficiary_name) missing_fields.push('beneficiary_name');
      // beneficiary_account not required for unhosted
    }

    const unhosted_dd_required =
      counterparty_type === 'unhosted' && amount_eur > tfr_threshold;

    if (unhosted_dd_required) {
      unhosted_dd_required_count++;
    }

    if (missing_fields.length > 0 || unhosted_dd_required) {
      const flag_entry = { transfer_id: transfer_id || null };
      if (missing_fields.length > 0) flag_entry.missing_fields = missing_fields;
      if (unhosted_dd_required) flag_entry.unhosted_dd_required = true;
      transfers_flagged.push(flag_entry);
    }
  }

  const batch_size = transfer_batch.length;
  const flagged_ids = new Set(transfers_flagged.map((t) => t.transfer_id));
  const conformant_count = transfer_batch.filter(
    (t) => !flagged_ids.has(t ? t.transfer_id : null) || flagged_ids.size === 0
  ).length;

  // Recalculate conformant: transfers with no missing_fields (dd-only flags still non-conformant in count)
  const missing_fields_flagged = transfers_flagged.filter(
    (t) => t.missing_fields && t.missing_fields.length > 0
  ).length;
  const conformant_count_final = batch_size - missing_fields_flagged;
  const batch_conformance_pct =
    batch_size > 0 ? Math.round((conformant_count_final / batch_size) * 100) : 100;

  // Merkle root simulation (sync, no WebCrypto)
  const sorted_ids = transfer_batch.map((t) => (t && t.transfer_id ? t.transfer_id : '')).sort();
  const joined = sorted_ids.join('|');
  const h = djb2Hash(joined);
  const merkle_root = 'sim-root:' + h.toString(16).padStart(8, '0');

  const compliance_flags = [];
  if (transfers_flagged.some((t) => t.missing_fields && t.missing_fields.length > 0)) {
    compliance_flags.push('TRAVEL_RULE_FIELDS_MISSING');
  }
  if (unhosted_dd_required_count > 0) {
    compliance_flags.push('UNHOSTED_WALLET_DD');
  }

  const output_payload = {
    batch_size,
    batch_conformance_pct,
    transfers_flagged,
    unhosted_dd_required_count,
    merkle_root,
    tfr_note:
      'TFR recast Reg. (EU) 2023/1113 applied 30 Dec 2024 (technical transitional ended 31 Jul 2025). Unhosted wallet enhanced DD per Art 19(2).',
    reference_version: '2026-06',
    note: 'Operates on synthetic/hashed transfer data only. No real PII. Decision-support draft.',
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
