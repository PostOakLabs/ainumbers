import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-288-map-iso20022-to-evm-calldata';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'map_iso20022_to_evm_calldata',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// DRAFT-PINNED (SLI-WAVE-1 §0): Swift's shared-ledger MVP (Besu/EVM, live 2026-07-09,
// 17-bank pilot) has not published a pacs.008/pacs.009 -> contract-call field-binding
// table or a fixed settlement-contract ABI shape; cross-chain routing is via Chainlink
// CCIP per Swift's public announcement, not a confirmed Besu/Linea-specific call shape.
// This binding table is therefore a DRAFT GENERIC ISO-20022-to-EVM profile, not a claim
// of conformance to Swift's (unpublished) production contract interface.
const MAPPING_PROFILES = {
  'draft-generic-evm': {
    version: 'SLI-DRAFT-GENERIC-EVM-2026-07-13',
    // abi input name -> { iso_field, type }
    bindings: {
      amount: { iso_field: 'instructedAmount', type: 'uint256' },
      currency: { iso_field: 'currency', type: 'bytes32' },
      debtor: { iso_field: 'debtorAccount', type: 'bytes32' },
      creditor: { iso_field: 'creditorAccount', type: 'bytes32' },
      endToEndId: { iso_field: 'endToEndId', type: 'bytes32' },
      uetr: { iso_field: 'uetr', type: 'bytes32' },
      purposeCode: { iso_field: 'purposeCode', type: 'bytes32' },
    },
  },
};

// Minor-unit decimal places, ISO 4217 subset (pinned; not fetched).
const MINOR_UNIT_DECIMALS = { USD: 2, EUR: 2, GBP: 2, JPY: 0, CHF: 2, AUD: 2, CAD: 2 };

function toHexBytes32(str) {
  const s = String(str == null ? '' : str).slice(0, 32);
  let hex = '';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(2, '0');
  return '0x' + hex.padEnd(64, '0');
}

function toUint256MinorUnits(amount, currency) {
  const decimals = Object.prototype.hasOwnProperty.call(MINOR_UNIT_DECIMALS, currency)
    ? MINOR_UNIT_DECIMALS[currency]
    : 2;
  const raw = String(amount == null ? '' : amount).trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return null;
  const whole = match[1];
  const frac = (match[2] || '').padEnd(decimals, '0').slice(0, decimals);
  const minorStr = (whole + frac).replace(/^0+(?=\d)/, '');
  return minorStr.length ? minorStr : '0';
}

function coerce(type, isoField, isoValue) {
  if (isoValue === undefined || isoValue === null || isoValue === '') return { value: null, ok: false };
  if (type === 'uint256') {
    if (isoField === 'instructedAmount') {
      const currency = null; // amount coercion needs currency, handled by caller
      return { value: null, ok: false, needsAmount: true };
    }
    return { value: null, ok: false };
  }
  if (type === 'bytes32') return { value: toHexBytes32(isoValue), ok: true };
  if (type === 'address') {
    const s = String(isoValue);
    return { value: /^0x[0-9a-fA-F]{40}$/.test(s) ? s : null, ok: /^0x[0-9a-fA-F]{40}$/.test(s) };
  }
  return { value: String(isoValue), ok: true };
}

export function compute(pp) {
  const isoMessageType = pp.iso_message_type || 'pacs.008';
  const isoFields = pp.iso_fields && typeof pp.iso_fields === 'object' ? pp.iso_fields : {};
  const abiFragment = pp.contract_abi_fragment && typeof pp.contract_abi_fragment === 'object'
    ? pp.contract_abi_fragment
    : { function: 'settlePayment', inputs: [] };
  const abiInputs = Array.isArray(abiFragment.inputs) ? abiFragment.inputs : [];
  const profileKey = MAPPING_PROFILES[pp.mapping_profile] ? pp.mapping_profile : 'draft-generic-evm';
  const profile = MAPPING_PROFILES[profileKey];

  const currency = typeof isoFields.currency === 'string' ? isoFields.currency : null;

  const field_bindings = [];
  const unmapped_required_fields = [];
  const abi_type_coercions = [];
  const warnings = [];
  const args = [];

  if (abiInputs.length === 0) {
    warnings.push('contract_abi_fragment.inputs is empty; no calldata args resolved.');
  }

  for (const input of abiInputs) {
    const name = input && input.name ? String(input.name) : '';
    const type = input && input.type ? String(input.type) : 'bytes32';
    const binding = profile.bindings[name];
    if (!binding) {
      unmapped_required_fields.push(name || '(unnamed)');
      warnings.push(`No binding for ABI input "${name}" in mapping_profile "${profileKey}".`);
      args.push(null);
      continue;
    }
    const isoField = binding.iso_field;
    let resolved = null;
    let ok = false;
    if (type === 'uint256' && isoField === 'instructedAmount') {
      resolved = toUint256MinorUnits(isoFields.instructedAmount, currency);
      ok = resolved !== null;
      abi_type_coercions.push({ abi_input: name, type, iso_field: isoField, coercion: 'decimal-to-minor-units-uint256' });
    } else {
      const c = coerce(type, isoField, isoFields[isoField]);
      resolved = c.value;
      ok = c.ok;
      abi_type_coercions.push({ abi_input: name, type, iso_field: isoField, coercion: type === 'bytes32' ? 'utf8-to-bytes32-padded' : 'passthrough' });
    }
    if (!ok || resolved === null) {
      unmapped_required_fields.push(name);
      warnings.push(`ISO field "${isoField}" missing or uncoercible for ABI input "${name}" (type ${type}).`);
    }
    field_bindings.push({ abi_input: name, iso_field: isoField, type, resolved: resolved !== null });
    args.push(resolved);
  }

  const mapping_ok = unmapped_required_fields.length === 0 && abiInputs.length > 0;

  const output_payload = {
    resolved_call: { function: abiFragment.function || 'settlePayment', args },
    field_bindings,
    unmapped_required_fields,
    abi_type_coercions,
    warnings,
    mapping_ok,
    mapping_profile: profileKey,
    mapping_profile_version: profile.version,
    iso_message_type: isoMessageType,
    draft_pinned: true,
  };
  const compliance_flags = mapping_ok
    ? ['SLI_MAPPING_COMPLETE']
    : ['SLI_MAPPING_INCOMPLETE', 'ESCALATION_RAISED'];

  return { output_payload, compliance_flags };
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
