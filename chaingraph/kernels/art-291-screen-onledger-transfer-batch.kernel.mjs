import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-291-screen-onledger-transfer-batch';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'screen_onledger_transfer_batch',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Batch-level pre-commit sanctions + purpose-code screen for a shared-ledger
// transfer batch. Reuses the SAME purpose-code enum and screening-hit shape as
// the shipped check_purpose_code_requirement (art-243) / check_screening_list_coverage
// (art-92) kernels rather than inventing new semantics -- kernels can only import
// _hash.mjs (never each other), so the shared methodology is inlined here; the
// swift-ledger-transfer-readiness chain composes this node directly (no duplicate
// per-transfer screening node needed downstream).
const VALID_PURPOSE_CODES = ['SALA', 'SUPP', 'TRAD', 'INTC', 'GDDS', 'SVCS', 'TAXS', 'DIVI', 'LOAN'];

function normalizeName(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

export function compute(pp) {
  const transfers = Array.isArray(pp.transfers) ? pp.transfers : [];
  const screeningMeta = pp.screening_lists_meta && typeof pp.screening_lists_meta === 'object' ? pp.screening_lists_meta : {};
  const flaggedNames = Array.isArray(screeningMeta.flagged_names) ? screeningMeta.flagged_names.map(normalizeName).filter(Boolean) : null;
  const profile = pp.profile || 'sli-batch-screen-v1';

  const coverage_gaps = [];
  if (flaggedNames === null) coverage_gaps.push('screening_lists_meta.flagged_names not supplied; sanctions coverage is a gap for this batch.');
  if (transfers.length === 0) coverage_gaps.push('transfers[] is empty; nothing to screen.');

  const per_transfer = transfers.map((t, i) => {
    const originator = normalizeName(t && t.originator);
    const beneficiary = normalizeName(t && t.beneficiary);
    const purposeCode = t && t.purpose_code;
    const purpose_code_ok = VALID_PURPOSE_CODES.includes(purposeCode);

    const hits = [];
    if (flaggedNames) {
      if (originator && flaggedNames.includes(originator)) hits.push({ field: 'originator', value: t.originator });
      if (beneficiary && flaggedNames.includes(beneficiary)) hits.push({ field: 'beneficiary', value: t.beneficiary });
    }

    const status = hits.length > 0 ? 'hit' : !purpose_code_ok ? 'flagged_purpose_code' : 'clean';
    return { index: i, status, hits, purpose_code_ok };
  });

  const batch_clean = coverage_gaps.length === 0 && per_transfer.every((r) => r.status === 'clean');

  const output_payload = { per_transfer, batch_clean, coverage_gaps, profile, transfer_count: transfers.length };
  const anyHit = per_transfer.some((r) => r.status === 'hit');
  const compliance_flags = batch_clean
    ? ['SLI_SCREEN_BATCH_CLEAN']
    : anyHit
      ? ['SLI_SCREEN_HIT', 'ESCALATION_RAISED']
      : ['SLI_SCREEN_BATCH_NOT_CLEAN'];

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
