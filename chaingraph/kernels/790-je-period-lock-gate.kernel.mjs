import { executionHash } from './_hash.mjs';

// 790-je-period-lock-gate — journal-entry period-lock policy gate.
//
// Evaluates caller-DECLARED journal entries against a caller-DECLARED, VERSIONED,
// time-varying period-lock policy (periods with dated lock events: open,
// soft_locked with exempt roles, hard_closed) and, for reversal entries, resolves
// the effective date the declared reversal policy implies. Pure decision engine:
// it never prevents or blocks any posting anywhere — every fact (lock history,
// entered_on timestamps, roles, approval labels) is caller-declared and is NOT
// verified by this kernel. The receipt proves recomputation only. A refused or
// exempt entry is NOT evidence of fraud, and no output here speaks to whether any
// control is effective under SOX or ISA; likewise none of the three reversal
// policies is required by any accounting standard — all three are ERP
// conventions offered as options.
//
// Time-varying state is the point: the lock state is evaluated at entered_on
// (or the declared as_of_date) for the period containing the entry's effective
// date, so a detective test can tell a legitimate January entry entered before a
// February soft lock from one posted into an already-locked period.
//
// A structurally bad policy NEVER yields per-entry decisions: the kernel refuses
// the whole run with execution_state "did_not_run" and a POLICY_* / cap code
// (fail closed, no silent allow).
//
// policy_digest is the canonical digest string of the declared period table:
// the key-sorted canonical form (cgCanon semantics) serialized with RFC 8785
// (JCS) member ordering — the exact semantics of the _hash.mjs canonicalizers.
// Both helpers are INLINED below (behaviour only) because the zkVM ESM strip
// removes cross-module imports and the VM prelude exposes executionHash only;
// the inline bodies are byte-semantics-identical to _hash.mjs (and to the VM
// prelude's own jcsStringify), so worker, VM and page all digest identically.
//
// Dates are integer civil dates handled with pure Hinnant-style proleptic
// Gregorian day-number arithmetic (no Date object, no clock read, no
// locale-dependent API). Calendar-validity is checked by strict round-trip
// (2026-02-29 and 2026-02-31 refuse; 2028-02-29 is valid). NaN-safe. Zero
// network, zero PII: entry_id / prepared_by / approved_by are opaque synthetic
// labels echoed or compared verbatim, never interpreted.

const TOOL_ID = '790-je-period-lock-gate';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'gate_je_period_lock',
  mandate_type: 'compliance_control', gpu: false,
};

// Row-fixed entry cap (JE-PERIOD-LOCK-GATE-1 contract: "capped at a named constant").
const MAX_ENTRIES = 500;

const LOCK_STATES = ['open', 'soft_locked', 'hard_closed'];
const REVERSAL_POLICIES = ['original_date', 'first_open_period', 'explicit_date'];

// ---- inlined canonicalizers (byte-identical semantics to kernels/_hash.mjs; the zkVM
// ESM strip removes imports, and the VM prelude exposes executionHash only) ----
function jcsStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) {
    let out = '[';
    for (let i = 0; i < v.length; i++) {
      if (i) out += ',';
      const e = v[i];
      out += (e === undefined || typeof e === 'function' || typeof e === 'symbol') ? 'null' : jcsStringify(e);
    }
    return out + ']';
  }
  const keys = Object.keys(v).sort();
  let out = '{', first = true;
  for (const k of keys) {
    const e = v[k];
    if (e === undefined || typeof e === 'function' || typeof e === 'symbol') continue;
    if (!first) out += ',';
    first = false;
    out += JSON.stringify(k) + ':' + jcsStringify(e);
  }
    return out + '}';
}
// cgCanon: key-sorted canonical form (null-prototype accumulator, so a member
// literally named "__proto__" cannot vanish from the preimage).
function cgCanon(v) {
  return Array.isArray(v) ? v.map(cgCanon)
    : (v && typeof v === 'object')
      ? Object.keys(v).sort().reduce((o, k) => { o[k] = cgCanon(v[k]); return o; }, Object.create(null))
      : v;
}

function s(v) { return String(v == null ? '' : v).trim(); }
function arr(v) { return Array.isArray(v) ? v : []; }

// Days since 1970-01-01 (proleptic Gregorian), pure integer arithmetic (Howard Hinnant).
function daysFromCivil(y, m, d) {
  y = m <= 2 ? y - 1 : y;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
// Inverse of daysFromCivil (Hinnant civil_from_days) — used for strict calendar
// validation (round-trip) and to re-render resolved reversal dates.
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}
function isoOf(days) {
  const c = civilFromDays(days);
  return `${String(c.y).padStart(4, '0')}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
}
// Strict ISO parse with a REAL calendar check: the parsed day number must
// round-trip to the same y/m/d, so 2026-02-29 and 2026-02-31 refuse and
// 2028-02-29 passes (art-462's parser accepts any day up to 31 — this gate does not).
function parseISOStrict(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(str));
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const days = daysFromCivil(y, mo, d);
  const back = civilFromDays(days);
  return (back.y === y && back.m === mo && back.d === d) ? days : null;
}

// Lock state at date D inside a period whose lock_events are already validated
// ascending: the last event with from_date <= D; none means open.
function lockStateAt(events, days) {
  let state = 'open';
  for (const ev of events) {
    if (ev.from_days <= days) state = ev.state;
    else break;
  }
  return state;
}

export function compute(pp) {
  pp = pp || {};
  const policy_version = s(pp.policy_version) || 'unversioned';

  const compliance_flags = [];
  const totals_by_decision = { allow: 0, allow_exempt: 0, refuse: 0 };
  const totals_by_period = {};

  // ---- declared period table, normalized AFTER validation ----
  const declared = arr(pp.periods);
  const periods = declared.map((p) => ({
    period_id: s(p && p.period_id),
    start_date: s(p && p.start_date),
    end_date: s(p && p.end_date),
    lock_events: arr(p && p.lock_events).map((e) => ({
      from_date: s(e && e.from_date),
      state: s(e && e.state),
    })),
  }));

  // policy_digest: canonical digest of the declared period table, via the
  // _hash.mjs canonicalizers ONLY (key-sorted canonical form, RFC 8785 string).
  const policy_digest = jcsStringify(cgCanon(periods));

  const sortedPeriods = () => periods
    .map((p, idx) => ({ p, idx, start: parseISOStrict(p.start_date), end: parseISOStrict(p.end_date) }))
    .sort((a, b) => (a.start - b.start) || (a.end - b.end) || (a.p.period_id < b.p.period_id ? -1 : 1));

  // ---- policy validation: a bad policy never yields a silent allow ----
  const refusePolicy = (code, message) => {
    compliance_flags.push('PERIOD_LOCK_POLICY_FAULT');
    return {
      output_payload: {
        policy_version,
        policy_digest,
        execution_state: 'did_not_run',
        reason: `${code}: ${message}`,
        entry_count: 0,
        entries: [],
        totals_by_decision: { allow: 0, allow_exempt: 0, refuse: 0 },
        totals_by_period: {},
      },
      compliance_flags,
    };
  };

  const sorted = sortedPeriods();
  for (const sp of sorted) {
    if (sp.start === null || sp.end === null) {
      return refusePolicy('POLICY_PERIOD_START_AFTER_END', `period ${sp.p.period_id || '(unlabeled)'} has a missing or non-calendar start_date/end_date`);
    }
    if (sp.start > sp.end) {
      return refusePolicy('POLICY_PERIOD_START_AFTER_END', `period ${sp.p.period_id} starts after it ends`);
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].end >= sorted[i].start) {
      return refusePolicy('POLICY_PERIOD_OVERLAP', `period ${sorted[i - 1].p.period_id} overlaps period ${sorted[i].p.period_id}`);
    }
  }
  // Parallel days-array per period (no mutation of caller input): events[i] is
  // { state, from_days } for periods[i].lock_events[i], ascending-checked.
  let policyFault = null;
  const eventsByPeriod = periods.map((p) => {
    let prev = null;
    return p.lock_events.map((ev) => {
      if (!LOCK_STATES.includes(ev.state)) {
        policyFault = { code: 'POLICY_UNKNOWN_LOCK_STATE', message: `period ${p.period_id} declares unknown lock state ${JSON.stringify(ev.state || null)}` };
        return null;
      }
      const from = parseISOStrict(ev.from_date);
      if (from === null || (prev !== null && from <= prev)) {
        policyFault = { code: 'POLICY_LOCK_EVENTS_UNORDERED', message: `period ${p.period_id} has missing, non-calendar or non-ascending lock event dates` };
        return null;
      }
      prev = from;
      return { state: ev.state, from_days: from };
    });
  });
  const fault = policyFault;
  if (fault !== null) return refusePolicy(fault.code, fault.message);
  const reversal_policy = s(pp.reversal_policy);
  if (!REVERSAL_POLICIES.includes(reversal_policy)) {
    return refusePolicy('POLICY_REVERSAL_POLICY_MISSING', `reversal_policy must be one of ${REVERSAL_POLICIES.join(' | ')}`);
  }
  let explicit_reversal_days = null;
  if (reversal_policy === 'explicit_date') {
    explicit_reversal_days = parseISOStrict(pp.explicit_reversal_date);
    if (explicit_reversal_days === null) {
      return refusePolicy('POLICY_EXPLICIT_DATE_MISSING', 'reversal_policy explicit_date requires a calendar-valid explicit_reversal_date');
    }
  }

  const exempt = new Set(arr(pp.soft_lock_exempt_roles).map(s).filter(Boolean));
  const as_of_days = parseISOStrict(pp.as_of_date); // null when absent/invalid
  const entries = arr(pp.entries);

  if (entries.length > MAX_ENTRIES) {
    return refusePolicy('ENTRY_CAP_EXCEEDED', `${entries.length} entries declared; the cap is ${MAX_ENTRIES}`);
  }

  compliance_flags.push('PERIOD_LOCK_RAN');
  for (const p of periods) totals_by_period[p.period_id] = { allow: 0, allow_exempt: 0, refuse: 0 };

  const out_entries = [];
  for (const e of entries) {
    const entry_id = s(e && e.entry_id);
    const roles = arr(e && e.roles).map(s);
    const prepared_by = s(e && e.prepared_by) || null;
    const approved_by = s(e && e.approved_by) || null;
    const is_reversal = (e && e.is_reversal) === true;
    const record = {
      entry_id,
      decision: null,
      period_id: null,
      lock_state_at_entry: null,
      exempt_role_used: null,
      resolved_effective_date: null,
      refusal_code: null,
      self_approval: (prepared_by !== null && approved_by !== null) ? (prepared_by === approved_by) : null,
    };

    const refuse = (code) => { record.decision = 'refuse'; record.refusal_code = code; };

    // entered_on, else as_of_date, else MISSING_ENTERED_ON_AND_AS_OF.
    let entered_days = null;
    if (e && e.entered_on != null && s(e.entered_on) !== '') {
      entered_days = parseISOStrict(e.entered_on);
      if (entered_days === null) refuse('BAD_DATE');
    } else if (as_of_days !== null) {
      entered_days = as_of_days;
    } else {
      refuse('MISSING_ENTERED_ON_AND_AS_OF');
    }

    // Effective date: the entry's own (non-reversal) or the resolved reversal date.
    let eval_days = null;
    if (record.refusal_code === null) {
      if (!is_reversal) {
        eval_days = parseISOStrict(e && e.effective_date);
        if (eval_days === null) refuse('BAD_DATE');
      } else if (reversal_policy === 'explicit_date') {
        eval_days = explicit_reversal_days;
        record.resolved_effective_date = isoOf(eval_days);
      } else {
        const orig_days = parseISOStrict(e && e.original_effective_date);
        if (orig_days === null) {
          refuse('BAD_DATE');
        } else if (reversal_policy === 'original_date') {
          eval_days = orig_days;
          record.resolved_effective_date = isoOf(orig_days);
        } else {
          // first_open_period: start of the first period on or after the
          // original date that is open at entered_on; none -> fail closed.
          let resolved = null;
          for (const sp of sorted) {
            if (sp.start < orig_days) continue;
            if (lockStateAt(eventsByPeriod[sp.idx], entered_days) === 'open') { resolved = sp; break; }
          }
          if (resolved === null) {
            refuse('NO_OPEN_PERIOD_FOR_REVERSAL');
          } else {
            eval_days = resolved.start;
            record.resolved_effective_date = isoOf(resolved.start);
          }
        }
      }
    }

    if (record.refusal_code === null) {
      const sp = sorted.find((q) => q.start <= eval_days && eval_days <= q.end);
      if (sp === undefined) {
        refuse('NO_PERIOD_FOR_DATE'); // fail closed on a gap
      } else {
        const state = lockStateAt(eventsByPeriod[sp.idx], entered_days);
        record.period_id = sp.p.period_id;
        record.lock_state_at_entry = state;
        if (state === 'hard_closed') {
          refuse('HARD_CLOSED'); // refuses everyone, exempt roles included
        } else if (state === 'soft_locked') {
          const used = roles.find((r) => exempt.has(r));
          if (used === undefined) {
            refuse('SOFT_LOCKED');
          } else {
            record.decision = 'allow_exempt';
            record.exempt_role_used = used;
          }
        } else {
          record.decision = 'allow';
        }
      }
    }

    if (record.decision === null) record.decision = 'refuse'; // safety: never a silent allow
    totals_by_decision[record.decision] += 1;
    if (record.period_id !== null) totals_by_period[record.period_id][record.decision] += 1;
    out_entries.push(record);
  }

  if (totals_by_decision.refuse > 0) compliance_flags.push('PERIOD_LOCK_ENTRIES_REFUSED');
  if (totals_by_decision.allow_exempt > 0) compliance_flags.push('PERIOD_LOCK_EXEMPT_USED');
  if (out_entries.some((r) => r.self_approval === true)) compliance_flags.push('PERIOD_LOCK_SELF_APPROVAL_PRESENT');

  return {
    output_payload: {
      policy_version,
      policy_digest,
      execution_state: 'ran',
      reason: null,
      entry_count: out_entries.length,
      entries: out_entries,
      totals_by_decision,
      totals_by_period,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
