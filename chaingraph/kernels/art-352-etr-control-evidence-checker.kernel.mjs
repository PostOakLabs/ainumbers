import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-352-etr-control-evidence-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_etr_control_evidence',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// MLETR (UNCITRAL Model Law on Electronic Transferable Records) Art. 10/11
// singularity + exclusive-control evidence checker. Given a document digest,
// a platform-identity/singularity assertion, and a supplied control-transfer
// event log (control-assertion set, as presented by the holder), walks the
// events in timestamp order as a single chain of custody and flags any event
// that does not extend that chain -- either because the claimed from_holder
// had already relinquished control (OVERLAPPING_CONTROL_CLAIM) or because the
// claimed from_holder never held control in the accepted chain at all
// (UNKNOWN_PARTY_TRANSFER). Both are, structurally, a second party asserting
// control over a time window the accepted chain already assigned elsewhere --
// exactly the double-control risk Art. 11 exclusivity guards against.
// Pure interval/chain math -- no Date.now(), no external registry lookup.
// Educational element checklist, not a legal opinion or registry attestation
// of which copy is authoritative. MLETR-CONTROL-BUILD-SPEC.md §MC-1.

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function isFiniteEpoch(v) { return typeof v === 'number' && Number.isFinite(v); }

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

function partitionEvents(control_events) {
  const valid = [];
  const malformed = [];
  for (const ev of control_events) {
    const event_id = safeStr(ev && ev.event_id);
    const from_holder = safeStr(ev && ev.from_holder);
    const to_holder = safeStr(ev && ev.to_holder);
    const epoch_ms = ev ? ev.epoch_ms : undefined;
    const signature_present = !!(ev && ev.signature_present);
    if (!event_id || !from_holder || !to_holder || !isFiniteEpoch(epoch_ms) || from_holder === to_holder) {
      malformed.push({ event_id: event_id || null, detail: 'Missing/invalid event_id, from_holder, to_holder, epoch_ms, or from_holder equals to_holder.' });
      continue;
    }
    valid.push({ event_id, from_holder, to_holder, epoch_ms, signature_present });
  }
  // Deterministic order: ascending epoch_ms, ties broken by event_id.
  valid.sort((a, b) => (a.epoch_ms - b.epoch_ms) || (a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0));
  return { valid, malformed };
}

export function compute(pp) {
  const {
    document_digest = '',
    platform_identity = '',
    singularity_assertion = false,
    original_holder = '',
    control_events = [],
  } = pp || {};

  const events = Array.isArray(control_events) ? control_events : [];
  const { valid: sortedEvents, malformed } = partitionEvents(events);
  const origHolder = safeStr(original_holder);

  // 1. Integrity ref (Art. 10 -- integrity of the electronic record)
  const integrity_pass = DIGEST_RE.test(safeStr(document_digest));
  const integrity_ref = {
    article: 'MLETR Art. 10 -- integrity of the electronic record',
    result: integrity_pass ? 'pass' : 'fail',
    detail: integrity_pass
      ? 'document_digest is a well-formed sha256 reference.'
      : 'document_digest is missing or not a well-formed "sha256:<64 hex>" reference.',
  };

  // 2. Singularity assertion (Art. 10 -- singularity / authoritative copy)
  const hasPlatform = safeStr(platform_identity).length > 0;
  const singularity_ok = hasPlatform && singularity_assertion === true;
  const singularity = {
    article: 'MLETR Art. 10 -- singularity / authoritative copy',
    result: singularity_ok ? 'pass' : (hasPlatform || singularity_assertion === true) ? 'partial' : 'fail',
    detail: singularity_ok
      ? 'A named platform_identity asserts sole-authoritative-copy control (singularity_assertion=true).'
      : !hasPlatform && singularity_assertion !== true
        ? 'No platform_identity supplied and no singularity_assertion made.'
        : !hasPlatform
          ? 'singularity_assertion=true but no platform_identity named to bear it.'
          : 'platform_identity supplied but singularity_assertion is not true.',
  };

  // 3/4. Walk the sorted event log as a single chain of custody from
  // original_holder. Any event whose from_holder is not the currently
  // recognized controller is flagged as an overlap/anomaly rather than
  // applied to the chain.
  const holder_intervals = [];
  const overlap_events = [];
  const heldBefore = new Set(origHolder ? [origHolder] : []);
  let current_holder = origHolder;
  let active_start = null; // null = "since inception" (no prior transfer)
  let chain_link_count = 0;

  for (const ev of sortedEvents) {
    if (ev.from_holder === current_holder && current_holder !== '') {
      holder_intervals.push({ holder: current_holder, start_epoch_ms: active_start, end_epoch_ms: ev.epoch_ms });
      current_holder = ev.to_holder;
      heldBefore.add(ev.to_holder);
      active_start = ev.epoch_ms;
      chain_link_count++;
    } else if (heldBefore.has(ev.from_holder)) {
      overlap_events.push({
        event_id: ev.event_id, from_holder: ev.from_holder, to_holder: ev.to_holder, epoch_ms: ev.epoch_ms,
        code: 'OVERLAPPING_CONTROL_CLAIM',
        detail: `"${ev.from_holder}" already relinquished control before this event's timestamp -- this transfer overlaps a window the accepted chain assigned elsewhere.`,
      });
    } else {
      overlap_events.push({
        event_id: ev.event_id, from_holder: ev.from_holder, to_holder: ev.to_holder, epoch_ms: ev.epoch_ms,
        code: 'UNKNOWN_PARTY_TRANSFER',
        detail: `"${ev.from_holder}" never held recognized control in the accepted chain -- an unrecognized party asserting a transfer is itself a double-control risk.`,
      });
    }
  }
  holder_intervals.push({ holder: current_holder, start_epoch_ms: active_start, end_epoch_ms: null });

  const has_original_holder = origHolder.length > 0;
  const chain_continuous = has_original_holder && malformed.length === 0 && overlap_events.length === 0;
  const chain_continuity = {
    article: 'MLETR Art. 11 -- exclusive control (chain continuity)',
    result: chain_continuous ? 'pass' : 'fail',
    detail: !has_original_holder
      ? 'No original_holder declared -- cannot anchor a chain of custody.'
      : malformed.length > 0
        ? `${malformed.length} malformed control event(s) could not be placed in the chain.`
        : chain_continuous
          ? `${chain_link_count} control-transfer event(s) form one unbroken chain from "${origHolder}" to "${current_holder}".`
          : `${overlap_events.length} event(s) did not extend the accepted chain of custody.`,
  };

  const no_overlap = overlap_events.length === 0 && malformed.length === 0;
  const exclusive_control = {
    article: 'MLETR Art. 11 -- exclusive control (no overlapping claims)',
    result: no_overlap ? 'pass' : 'fail',
    detail: no_overlap
      ? 'No two parties claim overlapping control of the record at any point in time.'
      : `${overlap_events.length} overlapping/anomalous control claim(s) detected.`,
    overlap_events,
  };

  const all_pass = integrity_pass && singularity_ok && chain_continuous && no_overlap;
  const overall_verdict = all_pass ? 'reliable_evidence' : 'insufficient_evidence';

  const output_payload = {
    document_digest: document_digest || null,
    platform_identity: platform_identity || null,
    overall_verdict,
    element_checklist: { integrity_ref, singularity, chain_continuity, exclusive_control },
    chain_summary: {
      total_events: events.length,
      malformed_event_count: malformed.length,
      valid_chain_events: chain_link_count,
      overlap_event_count: overlap_events.length,
      final_holder: current_holder || null,
      final_interval_open: true,
      holder_intervals,
    },
    malformed_events: malformed,
    note: 'Educational element checklist against UNCITRAL MLETR Arts. 10-11 functional-equivalence criteria for singularity and exclusive control, computed by interval/chain math over the SUPPLIED control-assertion set only. Not a legal opinion, not a registry attestation of which copy is authoritative -- verify the platform\'s own reliable-system status independently.',
  };

  const compliance_flags = [];
  if (all_pass) compliance_flags.push('MLETR_CONTROL_EVIDENCE_RELIABLE');
  if (!integrity_pass) compliance_flags.push('INTEGRITY_REF_MISSING');
  if (!singularity_ok) compliance_flags.push('SINGULARITY_NOT_ASSERTED');
  if (!chain_continuous) compliance_flags.push('CHAIN_CONTINUITY_BROKEN');
  if (!no_overlap) compliance_flags.push('OVERLAPPING_CONTROL_DETECTED');

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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
