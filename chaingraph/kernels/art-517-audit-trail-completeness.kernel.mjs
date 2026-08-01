import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-517-audit-trail-completeness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_audit_trail_completeness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── Audit-Trail Completeness Attestation ─────────────────────────────────
// Attests that an audit log covering TRANSACTIONS and USER ACTIVITY is
// complete and gap-free over a caller-declared window, against a
// caller-declared continuity mechanism (sequence numbers, hash-chain links,
// or periodic control totals).
//
// DISAMBIGUATION (read before editing — do not merge with either):
//   art-237-validate-agent-audit-trail validates the STRUCTURE of a single
//     IETF AAT record (agent_identity/action_class/outcome/trust_level
//     field conformance). It does not evaluate a window, does not detect
//     gaps across a population of records, and is agent-to-agent scoped.
//   cry-05-agent-action-audit-trail-aggregator builds a Merkle root and
//     inclusion proofs over a supplied set of execution-receipt hashes
//     (chaingraph artifacts). It aggregates THIS SUITE's own receipts, not
//     an external transaction/user-activity log.
//   art-517 does neither: it takes SUMMARY COUNTS and a DECLARED
//     CONTINUITY MECHANISM over an external audit log (never a single
//     record, never this suite's receipts) and attests population
//     completeness, gap position, privileged-action coverage, and
//     retention conformance for that external log.
//
// No log ingestion, no vendor log format parsing — the caller supplies
// counts, declared sequence/chain summaries, and control totals only.
// Zero PII: no username, email, IP, or free-text identity field is
// accepted; users are represented as role classes / opaque refs.
//
// FINITE GATE: sequence-number enumeration is bounded at MAX_SEQ_RANGE;
// a declared range beyond that is reported UNDECIDABLE (range too large
// to enumerate), never silently truncated into a false verdict.
//
// Region portability: window, retention requirement, and continuity
// mechanism are entirely caller-declared. No country, currency, scheme,
// or statute name is hardcoded.
//
// Regulatory basis: table_version "AUDIT-TRAIL-COMPLETENESS-2026".

const MAX_SEQ_RANGE = 20000;
const MAX_ITEMS = 5000;

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeInt(v) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; }
function bounded(s, max) { const t = safeStr(s); return t.length <= max ? t : t.slice(0, max) + '[TRUNCATED]'; }
function boundArr(a) { return Array.isArray(a) ? a.slice(0, MAX_ITEMS) : []; }

const VALID_MECHANISMS = ['sequence_number', 'hash_chain', 'control_total'];
const HEX64 = /^[0-9a-f]{64}$/;

function evalSequenceMechanism(pp) {
  const start = safeInt(pp.sequence_start);
  const end = safeInt(pp.sequence_end);
  const observed = boundArr(pp.observed_sequence_numbers).map(safeInt).filter(n => n !== null);

  if (start === null || end === null || end < start) {
    return { verdict: 'MECHANISM_INSUFFICIENT', gaps: [], undecidable: [], reason: 'sequence_start/sequence_end missing or invalid' };
  }
  const rangeSize = end - start + 1;
  if (rangeSize > MAX_SEQ_RANGE) {
    return { verdict: 'UNDECIDABLE', gaps: [], undecidable: [{ range: [start, end], reason: 'RANGE_TOO_LARGE_FOR_ENUMERATION' }] };
  }
  const observedSet = new Set(observed.filter(n => n >= start && n <= end));
  const gaps = [];
  for (let i = start; i <= end; i++) {
    if (!observedSet.has(i)) gaps.push({ position: i, mechanism: 'sequence_number', detail: 'sequence number not observed' });
    if (gaps.length >= MAX_ITEMS) break;
  }
  return { verdict: gaps.length === 0 ? 'CONTINUOUS' : 'GAP_DETECTED', gaps, undecidable: [] };
}

function evalHashChainMechanism(pp) {
  const links = boundArr(pp.chain_links).filter(l => l && typeof l === 'object');
  if (links.length === 0) {
    return { verdict: 'MECHANISM_INSUFFICIENT', gaps: [], undecidable: [], reason: 'chain_links is empty' };
  }
  const sorted = links
    .map(l => ({ position: safeInt(l.position), prev: bounded(l.sha256_prev_record || '', 80), self: bounded(l.sha256_this_record || '', 80) }))
    .filter(l => l.position !== null)
    .sort((a, b) => a.position - b.position);

  const gaps = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (i === 0) {
      if (cur.prev && !HEX64.test(cur.prev)) gaps.push({ position: cur.position, mechanism: 'hash_chain', detail: 'malformed sha256_prev_record on first link' });
      continue;
    }
    const prevLink = sorted[i - 1];
    if (cur.position !== prevLink.position + 1) {
      gaps.push({ position: prevLink.position + 1, mechanism: 'hash_chain', detail: 'sequence break between chained positions' });
    }
    if (!cur.prev || !HEX64.test(cur.prev) || !prevLink.self || cur.prev !== prevLink.self) {
      gaps.push({ position: cur.position, mechanism: 'hash_chain', detail: 'sha256_prev_record does not match prior link sha256_this_record' });
    }
    if (gaps.length >= MAX_ITEMS) break;
  }
  return { verdict: gaps.length === 0 ? 'CONTINUOUS' : 'GAP_DETECTED', gaps, undecidable: [] };
}

function evalControlTotalMechanism(pp) {
  const periods = boundArr(pp.periods).filter(p => p && typeof p === 'object');
  if (periods.length === 0) {
    return { verdict: 'MECHANISM_INSUFFICIENT', gaps: [], undecidable: [], reason: 'periods is empty' };
  }
  const gaps = [];
  const undecidable = [];
  for (const p of periods) {
    const period_id = bounded(p.period_id || '', 128);
    const declared = safeInt(p.declared_event_count);
    const reported = safeInt(p.reported_event_count);
    if (declared === null || reported === null) {
      undecidable.push({ period_id, reason: 'declared_event_count or reported_event_count missing' });
      continue;
    }
    if (declared !== reported) {
      gaps.push({ position: period_id, mechanism: 'control_total', detail: `control total mismatch: declared ${declared} vs reported ${reported}` });
    }
    // Control totals can confirm a period is short but cannot localize which
    // individual event is missing — that position is always undecidable.
    if (declared !== reported) {
      undecidable.push({ period_id, reason: 'control total localizes the period, not the individual missing event' });
    }
  }
  const verdict = gaps.length === 0 ? 'CONTINUOUS' : (undecidable.length > 0 ? 'MECHANISM_INSUFFICIENT' : 'GAP_DETECTED');
  return { verdict, gaps, undecidable };
}

export function compute(pp) {
  pp = pp || {};

  const window_start = bounded(pp.window_start || '', 64);
  const window_end = bounded(pp.window_end || '', 64);
  const continuity_mechanism = safeStr(pp.continuity_mechanism || '').toLowerCase();
  const declared_retention_days = safeInt(pp.declared_retention_period_days);
  const required_retention_days = safeInt(pp.required_retention_period_days);

  if (!window_start || !window_end || !VALID_MECHANISMS.includes(continuity_mechanism)) {
    return {
      output_payload: {
        continuity_verdict: 'MECHANISM_INSUFFICIENT',
        window_start: window_start || null,
        window_end: window_end || null,
        continuity_mechanism: continuity_mechanism || null,
        gaps: [],
        gap_count: 0,
        undecidable: [{ reason: 'window_start, window_end, or continuity_mechanism missing/invalid' }],
        event_counts_by_type: {},
        privileged_action_coverage: { transaction_events_logged: 0, privileged_events_logged: 0, covered: false },
        retention_conformance: { declared_days: declared_retention_days, required_days: required_retention_days, conforms: false },
        known_gap_candidates_reconciled: [],
        regulatory_basis: 'RFP CDGPSS202601 §4.5 (audit trails for transactions and user activities, generalised)',
        table_version: 'AUDIT-TRAIL-COMPLETENESS-2026',
      },
      compliance_flags: ['TRAIL_MECHANISM_INSUFFICIENT'],
    };
  }

  const mech = continuity_mechanism === 'sequence_number' ? evalSequenceMechanism(pp)
    : continuity_mechanism === 'hash_chain' ? evalHashChainMechanism(pp)
    : evalControlTotalMechanism(pp);

  const eventCountsRaw = pp.observed_event_counts_by_type && typeof pp.observed_event_counts_by_type === 'object'
    ? pp.observed_event_counts_by_type : {};
  const event_counts_by_type = {};
  for (const k of Object.keys(eventCountsRaw).slice(0, 64)) {
    const n = safeInt(eventCountsRaw[k]);
    if (n !== null) event_counts_by_type[bounded(k, 64)] = n;
  }

  const transaction_events_logged = event_counts_by_type.transaction || 0;
  const privileged_events_logged = event_counts_by_type.privileged_action || 0;
  const privileged_covered = !(transaction_events_logged > 0 && privileged_events_logged === 0);

  const retention_conforms = required_retention_days === null
    ? null
    : (declared_retention_days !== null && declared_retention_days >= required_retention_days);

  const knownCandidates = boundArr(pp.gap_candidates).map(c => ({
    position: c && (c.position !== undefined) ? bounded(String(c.position), 64) : null,
    detected: mech.gaps.some(g => String(g.position) === String(c && c.position)),
  }));

  const compliance_flags = [];
  if (mech.verdict === 'CONTINUOUS') compliance_flags.push('TRAIL_CONTINUOUS');
  if (mech.verdict === 'GAP_DETECTED') compliance_flags.push('TRAIL_GAP_DETECTED');
  if (mech.verdict === 'MECHANISM_INSUFFICIENT' || mech.verdict === 'UNDECIDABLE') compliance_flags.push('TRAIL_MECHANISM_INSUFFICIENT');
  if (!privileged_covered) compliance_flags.push('TRAIL_PRIVILEGED_UNCOVERED');
  if (retention_conforms === false) compliance_flags.push('TRAIL_RETENTION_SHORT');

  const output_payload = {
    continuity_verdict: mech.verdict,
    window_start,
    window_end,
    continuity_mechanism,
    gaps: mech.gaps,
    gap_count: mech.gaps.length,
    undecidable: mech.undecidable || (mech.reason ? [{ reason: mech.reason }] : []),
    event_counts_by_type,
    privileged_action_coverage: {
      transaction_events_logged,
      privileged_events_logged,
      covered: privileged_covered,
    },
    retention_conformance: {
      declared_days: declared_retention_days,
      required_days: required_retention_days,
      conforms: retention_conforms,
    },
    known_gap_candidates_reconciled: knownCandidates,
    regulatory_basis: 'RFP CDGPSS202601 §4.5 (audit trails for transactions and user activities, generalised); portable to any regime declaring an audit-trail continuity and retention duty (e.g. EU DORA Art 15 / RTS ICT-related incident record-keeping) via caller-supplied inputs only',
    table_version: 'AUDIT-TRAIL-COMPLETENESS-2026',
  };

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
