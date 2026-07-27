import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-483-emir-break-ageing';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'age_emir_reconciliation_breaks', mandate_type: 'attestation_mandate', gpu: false };

// EMIR reconciliation break-ageing over consecutive cycles.
//
// Consumes this cycle's CURRENT break set (e.g. art-482-emir-recon-adjudicator's `break_set`
// output) and the PRIOR cycle's SEALED break set (each entry carrying at least the same
// `break_key`, plus the ageing metadata this kernel itself emitted last cycle: `first_seen_at`
// and `recurrence_count`). Diffing by the stable `break_key` yields:
//   - persisting: same break_key present both cycles (age/recurrence carried forward)
//   - newly_opened: break_key present only in current (first_seen_at = this cycle)
//   - newly_closed: break_key present only in prior (dropped out of current)
// plus an ageing bucket and an escalation-clock status per break, against POLICY-SUPPLIED
// ageing limits and an escalation deadline -- not hardcoded, so a policy revision never
// requires a kernel change.
//
// DEADLINE-MATH PATTERN REUSE (per EMIR-RECON-BUILD-SPEC.md Sec 1 -- do not re-derive): follows
// art-428-cyber-incident-clock's deadline-vs-evaluated_at shape (deadline = anchor_ms + limit,
// status = evaluated_at >= deadline ? breached : on_track). A kernel's compute() may only
// import `_hash.mjs` (guest loader constraint), so the pattern is reproduced inline here rather
// than imported -- see art-428's own header for the same forward-pointer convention used for
// art-467-dora-incident-classifier.
//
// Deterministic by construction: pure day-granularity integer arithmetic (Math.floor of a
// millisecond delta), Date.parse(<ISO string>) only (never a bare `new Date()`), no random, no
// locale formatting, no crypto.subtle in compute().
//
// Spec: EMIR-RECON-BUILD-SPEC.md Sec 0 + Sec 1.

const DAY_MS = 86400000;

function str(v) { return typeof v === 'string' ? v : ''; }
function isStr(v) { return typeof v === 'string' && v.length > 0; }
function isFiniteNum(v) { const n = Number(v); return Number.isFinite(n); }
function parseIsoMs(v) {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function pickBucket(ageDays, limits) {
  for (const b of limits) {
    if (!b) continue;
    const min = isFiniteNum(b.min_days) ? Number(b.min_days) : 0;
    const max = isFiniteNum(b.max_days) ? Number(b.max_days) : Infinity;
    if (ageDays >= min && ageDays <= max) return isStr(b.bucket_name) ? b.bucket_name : 'unnamed';
  }
  return 'unbucketed';
}

export function compute(pp) {
  pp = pp || {};
  const current = Array.isArray(pp.current_break_set) ? pp.current_break_set : [];
  const prior = Array.isArray(pp.prior_sealed_break_set) ? pp.prior_sealed_break_set : [];
  const policy = pp.policy || {};

  const ageingLimits = Array.isArray(policy.ageing_limits) ? policy.ageing_limits : [];
  const escalationDays = isFiniteNum(policy.escalation_days) ? Number(policy.escalation_days) : null;
  const evaluatedAtMs = parseIsoMs(policy.evaluated_at);

  const priorByKey = new Map();
  for (const b of prior) {
    if (b && isStr(b.break_key)) priorByKey.set(b.break_key, b);
  }

  const currentKeys = new Set();
  const breaks = [];
  let newly_opened_count = 0;
  let persisting_count = 0;
  let escalation_breached_count = 0;

  for (const b of current) {
    if (!b || !isStr(b.break_key)) continue;
    const key = b.break_key;
    currentKeys.add(key);
    const priorEntry = priorByKey.get(key) || null;

    const priorFirstSeenMs = priorEntry ? parseIsoMs(priorEntry.first_seen_at) : null;
    const firstSeenMs = priorFirstSeenMs != null ? priorFirstSeenMs : evaluatedAtMs;
    const ageDays = (evaluatedAtMs != null && firstSeenMs != null)
      ? Math.max(0, Math.floor((evaluatedAtMs - firstSeenMs) / DAY_MS))
      : null;
    const recurrenceCount = priorEntry
      ? (isFiniteNum(priorEntry.recurrence_count) ? Number(priorEntry.recurrence_count) : 1) + 1
      : 1;
    const status = priorEntry ? 'persisting' : 'newly_opened';
    if (status === 'persisting') persisting_count++; else newly_opened_count++;

    const ageing_bucket = ageDays != null ? pickBucket(ageDays, ageingLimits) : 'unbucketed';

    let escalation_clock = null;
    if (escalationDays != null && firstSeenMs != null) {
      const deadlineMs = firstSeenMs + escalationDays * DAY_MS;
      const escalation_status = evaluatedAtMs != null ? (evaluatedAtMs >= deadlineMs ? 'breached' : 'on_track') : 'unknown';
      if (escalation_status === 'breached') escalation_breached_count++;
      escalation_clock = { deadline_iso: new Date(deadlineMs).toISOString(), escalation_status };
    }

    breaks.push({
      break_key: key,
      uti: isStr(b.uti) ? b.uti : null,
      field_name: isStr(b.field_name) ? b.field_name : null,
      status,
      first_seen_at: firstSeenMs != null ? new Date(firstSeenMs).toISOString() : null,
      age_days: ageDays,
      ageing_bucket,
      recurrence_count: recurrenceCount,
      escalation_clock,
    });
  }

  const newly_closed = [];
  for (const [key, priorEntry] of priorByKey) {
    if (currentKeys.has(key)) continue;
    newly_closed.push({
      break_key: key,
      uti: isStr(priorEntry.uti) ? priorEntry.uti : null,
      field_name: isStr(priorEntry.field_name) ? priorEntry.field_name : null,
      first_seen_at: isStr(priorEntry.first_seen_at) ? priorEntry.first_seen_at : null,
    });
  }

  const output_payload = {
    evaluated_at: isStr(policy.evaluated_at) ? policy.evaluated_at : null,
    total_current: breaks.length,
    newly_opened_count,
    persisting_count,
    newly_closed_count: newly_closed.length,
    escalation_breached_count,
    breaks,
    newly_closed,
    note: 'Deterministic ageing of a current EMIR reconciliation break set diffed against a prior sealed break set by stable break_key. Ageing buckets and the escalation clock are policy-supplied per cycle, reusing the art-428-cyber-incident-clock deadline-vs-evaluated_at pattern (first_seen_at + policy limit vs evaluated_at).',
  };

  const compliance_flags = [];
  if (escalation_breached_count > 0) compliance_flags.push('EMIR_BREAK_AGEING_ESCALATION_BREACHED');
  if (newly_opened_count > 0) compliance_flags.push('EMIR_BREAK_AGEING_NEW_BREAKS');
  if (ageingLimits.length === 0) compliance_flags.push('EMIR_BREAK_AGEING_LIMITS_EMPTY');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
