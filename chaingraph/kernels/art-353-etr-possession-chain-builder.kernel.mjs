import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-353-etr-possession-chain-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'build_etr_possession_chain',
  mandate_type: 'cryptographic_mandate',
  gpu:          false,
};

// MLETR Art. 10/11 possession-chain receipt builder. Takes a document digest
// (the electronic transferable record's own hash, as supplied) plus an
// ordered set of control-transfer events (holder-to-holder, timestamp,
// signature -- all as supplied, not independently verified) and produces a
// hash-chained possession receipt per event -- each receipt binds to the
// prior receipt's hash, so any reordering, insertion, or deletion of a
// transfer breaks the chain -- plus a Merkle root over the whole chain, a
// portable evidence pack a holder can present to a bank or court.
// This kernel does NOT assess MLETR "singularity"/"exclusive control"
// legal-element compliance -- that is MC-1 (check_etr_control_evidence,
// art-352). MC-2 only builds the tamper-evident receipt chain from events a
// caller supplies; it consumes MC-1's checklist by tool_id reference only
// (no runtime dependency), because a broken chain here is a structural fact
// independent of the Art. 10/11 verdict.
// MLETR-CONTROL-BUILD-SPEC.md §MC-2.

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

export function compute(pp) {
  pp = pp || {};
  const document_digest = safeStr(pp.document_digest);
  const initial_holder   = pp.initial_holder != null ? safeStr(pp.initial_holder) : null;
  const events = Array.isArray(pp.control_transfer_events) ? pp.control_transfer_events : [];

  const continuity_breaks = [];
  let prevToHolder = initial_holder;
  let prevTimestamp = null;
  let timestamp_order_valid = true;

  events.forEach((e, i) => {
    const from_holder = safeStr(e && e.from_holder);
    const to_holder    = safeStr(e && e.to_holder);
    const timestamp    = safeStr(e && e.timestamp);

    if (prevToHolder != null && from_holder !== prevToHolder) {
      continuity_breaks.push({ index: i, expected_from_holder: prevToHolder, actual_from_holder: from_holder });
    }
    if (prevTimestamp != null && timestamp && timestamp < prevTimestamp) {
      timestamp_order_valid = false;
    }
    prevToHolder = to_holder || prevToHolder;
    if (timestamp) prevTimestamp = timestamp;
  });

  const chain_continuous = continuity_breaks.length === 0;
  const final_holder = events.length ? safeStr(events[events.length - 1].to_holder) : initial_holder;

  const output_payload = {
    document_digest,
    event_count: events.length,
    chain_continuous,
    continuity_breaks,
    timestamp_order_valid,
    final_holder,
    possession_receipts: null, // filled by buildArtifact (hash chaining requires async WebCrypto)
    merkle_root: null,         // filled by buildArtifact
    note: 'Hash-chained possession receipts over supplied control-transfer events, each receipt binding the prior receipt hash. Detects reordering/insertion/deletion of transfers. Does not itself assess MLETR Art. 10/11 singularity/exclusive-control legal elements -- see check_etr_control_evidence (art-352).',
  };

  const compliance_flags = ['UNCITRAL_MLETR_ART10_ART11_POSSESSION_CHAIN'];
  if (chain_continuous) compliance_flags.push('POSSESSION_CHAIN_CONTINUOUS');
  else compliance_flags.push('POSSESSION_CHAIN_BROKEN');
  if (!timestamp_order_valid) compliance_flags.push('TIMESTAMP_ORDER_INVALID');

  return { output_payload, compliance_flags, events };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, events } = compute(pp);
  const document_digest = output_payload.document_digest;

  // Hash-chain the receipts: each receipt_hash binds {event, prev_receipt_hash}.
  // Genesis prev_receipt_hash is the document digest itself, so the whole
  // chain is anchored to the ETR the possession events are about.
  const possession_receipts = [];
  let prev = document_digest;
  for (let i = 0; i < events.length; i++) {
    const e = events[i] || {};
    const event_record = {
      event_id:    safeStr(e.event_id) || String(i),
      from_holder: safeStr(e.from_holder),
      to_holder:   safeStr(e.to_holder),
      timestamp:   safeStr(e.timestamp),
      signature:   safeStr(e.signature),
    };
    const receipt_hash = await executionHash({ event: event_record, prev_receipt_hash: prev }, { receipt_marker: TOOL_ID });
    possession_receipts.push({ index: i, ...event_record, prev_receipt_hash: prev, receipt_hash });
    prev = receipt_hash;
  }
  output_payload.possession_receipts = possession_receipts;

  // Merkle root over the ordered receipt-hash chain (chain order preserved --
  // unlike a leaf set, transfer order is part of what is being attested).
  const merkle_root = await executionHash(
    { chain: possession_receipts.map((r) => r.receipt_hash) },
    { merkle_schema: 'sha256-possession-chain-v1' }
  );
  output_payload.merkle_root = merkle_root;

  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    compute_proof_ready: 'deferred',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
