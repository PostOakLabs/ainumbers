/**
 * art-81-allocation-affirmation-conformance.kernel.mjs
 * Wave 17 — Allocation/Affirmation Conformance Checker.
 * Checks allocation + confirmation/affirmation events against the ESMA RTS
 * 23:00 CET trade-date rule and the machine-readable-format mandate (Dec 2026).
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   ESMA CSDR SDR RTS — Final Report 13 Oct 2025 (ESMA74-2119945926-3430):
 *     same-day allocation/confirmation by 23:00 CET, machine-readable formats,
 *     from December 2026. Verify current applicability date.
 *   EDUCATIONAL: outputs are decision-support drafts, not regulatory findings.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-81-allocation-affirmation-conformance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_allocation_affirmation',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

const DEFAULT_CUTOFF_HHMM = '23:00'; // CET trade-date cutoff (ESMA RTS)

// Parse "HH:MM" → minutes since midnight
const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm ?? '').split(':').map(Number);
  return (isNaN(h) ? 23 : h) * 60 + (isNaN(m) ? 0 : m);
};

export function compute(pp) {
  const {
    events          = [],  // [{ event_type, timestamp_ct, trade_date, format, counterparty_type }]
    cutoff_local    = DEFAULT_CUTOFF_HHMM,
  } = pp;

  const cutoffMins = toMinutes(cutoff_local);
  const events_flagged = [];
  let on_time = 0;
  let format_nonconformance_count = 0;

  for (const ev of events) {
    const issues   = [];
    const tsStr    = String(ev.timestamp_ct ?? '');
    const timePart = tsStr.includes('T') ? tsStr.split('T')[1]?.split(':').slice(0, 2).join(':') : tsStr.slice(0, 5);
    const evMins   = toMinutes(timePart);

    // Same-day check (date part must match trade_date — just check if provided)
    const sameDay = !ev.trade_date || !tsStr.includes('T') || tsStr.startsWith(ev.trade_date);
    const late    = !sameDay || evMins > cutoffMins;

    if (late) {
      const reason = !sameDay
        ? `Event date (${tsStr.split('T')[0]}) after trade date (${ev.trade_date})`
        : `Event time ${timePart} CET exceeds ${cutoff_local} CET trade-date cutoff`;
      if (ev.event_type === 'allocation') {
        issues.push({ rule: 'LATE_ALLOCATION', reason });
      } else {
        issues.push({ rule: 'LATE_CONFIRMATION', reason });
      }
    } else {
      on_time++;
    }

    if (ev.format !== 'machine-readable') {
      issues.push({ rule: 'MANUAL_FORMAT', reason: 'Non-machine-readable format. ESMA RTS Dec 2026 mandate requires machine-readable allocation/confirmation.' });
      format_nonconformance_count++;
    }

    if (issues.length > 0) {
      events_flagged.push({
        event_type:       ev.event_type,
        timestamp_ct:     ev.timestamp_ct,
        trade_date:       ev.trade_date,
        format:           ev.format,
        counterparty_type: ev.counterparty_type,
        issues,
      });
    }
  }

  const total      = events.length;
  const on_time_rate = total > 0 ? +(on_time / total * 100).toFixed(1) : 100;

  const compliance_flags = [];
  if (events_flagged.some(e => e.issues.some(i => i.rule === 'LATE_ALLOCATION')))   compliance_flags.push('LATE_ALLOCATION');
  if (events_flagged.some(e => e.issues.some(i => i.rule === 'LATE_CONFIRMATION'))) compliance_flags.push('LATE_CONFIRMATION');
  if (format_nonconformance_count > 0)                                               compliance_flags.push('MANUAL_FORMAT');

  const output_payload = {
    on_time_rate,
    total_events:             total,
    on_time_events:           on_time,
    events_flagged,
    format_nonconformance_count,
    cutoff_applied:           cutoff_local,
    cutoff_timezone:          'CET (Central European Time)',
    reference: {
      rts:  'ESMA CSDR SDR RTS — Final Report 13 Oct 2025 (ESMA74-2119945926-3430)',
      rule: 'Same-day allocation/confirmation by 23:00 CET + machine-readable formats from December 2026',
      note: 'Verify current applicability date. "Dec 2026" refers to the ESMA RTS binding date — confirm final text.',
    },
    dual_date_note: 'Allocation/confirmation timing rules binding DEC 2026 · T+1 go-live 11 OCT 2027 — verify current (CSDR Refit/RTS still finalising)',
    note: 'DECISION-SUPPORT DRAFT — not a regulatory finding. Timestamps are compared in the timezone provided (assumed CET). Verify all event timestamps are in CET/CEST as applicable. Machine-readable format requirement: verify final format specification against ESMA RTS.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
