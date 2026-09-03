import { executionHash } from './_hash.mjs';

// art-670-examination-readiness-pack — Examination Readiness Pack: one pack, two selectable regime
// modules, five stages (EXAMPACK-BUILD-1 / EXAM-READINESS-BUILD-SPEC.md):
//   1. request intake + due-date validation (as_of is a DECLARED input, never a runtime clock);
//   2. status roll-up (delivered/open/overdue counts, overdue ids);
//   3. readiness score (delivered/total pct + READY/AT_RISK/NOT_READY verdict);
//   4. regime-module annex (module-specific checklist verdicts, conditional on module_checklist input);
//   5. evidence handoff (pointer set for the binder chain, composition only, conditional on
//      evidence_request_ids input).
// Stages 4 and 5 are conditional-presence: their payload keys appear only when the caller supplies the
// corresponding input, which is exactly how the spec's worked example (stages 1-3 only) reproduces the
// pinned 8-key output_payload byte-identically. Regime facts and their primary-text citations live in
// the node shard's cited_clause_digest/description (KERNEL-CITATION-CLASS-1), not in this source file.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network, no
// filesystem. Overdue is decided by ISO calendar-date string comparison against the caller-declared
// as_of (both validated to ^\d{4}-\d{2}-\d{2}$ with a real calendar check), so the same pp always
// yields the same verdict regardless of when it runs (the deadline-wall lesson: no runtime clock).
//
// Verdict bands (stage 3) are this pack's own design choice, stated as such, and are pinned by the
// estate spec's own two worked vectors: readiness 100% with zero overdue -> READY; readiness 0% ->
// NOT_READY; anything between -> AT_RISK. The pinned AT_RISK vector (1/3 delivered, 1 overdue, 33.3%)
// and the required READY vector (all delivered, zero overdue) both sit on this mapping.

const TOOL_ID = 'art-670-examination-readiness-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_exam_readiness_pack',
  mandate_type: 'compliance_control', gpu: false,
};

// ---- input vocabulary (echoed keys, not citations; provenance lives in the node shard) ----
const MODULES = ['sec-2026', 'amla'];
const REQUEST_STATUSES = ['delivered', 'open'];
const CHECKLIST_STATUSES = ['PASS', 'FAIL', 'NOT_ASSESSED'];

// Per-module checklist item sets (stage 4). Item ids are this pack's neutral vocabulary; each item's
// regulatory meaning and pinned primary-text citation are recorded per item in the node shard.
const MODULE_ITEMS = {
  'sec-2026': ['ai_supervision', 'records_channel_controls', 'controls_operate_evidence'],
  amla: ['six_member_state_eligibility', 'high_risk_selection_evidence', 'supervision_commencement_tracking'],
};

// Module edition metadata, echoed into the annex so a receipt names WHICH edition it was assessed
// against (stale-constant doctrine: measured-date constants carry their edition, never "current").
const MODULE_EDITION = {
  'sec-2026': { module: 'sec-2026', edition: 'FY2026', published: '2025-11-17' },
  amla: { module: 'amla', edition: 'selection-window-1', first_selection_deadline: '2028-01-01' },
};

// amla only: the first selection process must be concluded by this date (commencement deadline
// 2027-07-01 plus the six-month conclusion bound), which is the pack's PRE_EFFECTIVE marker. The
// direct-supervision commencement rule itself (six months after list publication) is echoed verbatim
// in the annex under commencement_rule; this constant is the conclusion-of-selection boundary, not a
// claim that supervision starts on this date.
const AMLA_FIRST_SELECTION_CONCLUSION_DATE = '2028-01-01';
const AMLA_COMMENCEMENT_RULE = 'direct supervision of selected obliged entities commences six months after publication of the selection list';

// ---- binder chain pointers (stage 5): composition only, never rebuilt here ----
const BINDER_TOOLS = [
  { tool_id: 'T574', path: 'tools/574-casefile-binder-composer.html', role: 'compose the casefile binder' },
  { tool_id: 'T575', path: 'tools/575-casefile-binder-verifier.html', role: 'verify binder completeness and integrity' },
  { tool_id: 'T576', path: 'tools/576-evidence-handover-bundle.html', role: 'build the evidence handover bundle' },
];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealCalendarDate(s) {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= dim;
}

// Strict string compare is sufficient for overdue: both operands are validated real calendar dates
// in YYYY-MM-DD form, where lexicographic order equals calendar order.
function isBefore(a, b) { return a < b; }

function s(v) { return String(v == null ? '' : v).trim(); }

/**
 * compute(pp) — pure five-stage examination-readiness computation.
 * pp: {
 *   as_of: 'YYYY-MM-DD'                      (required, declared; never a runtime clock)
 *   module: 'sec-2026' | 'amla'              (required; the pack's two regime modules)
 *   requests: [{id, status, due_date}]       (required, >=1, unique ids, status delivered|open)
 *   module_checklist: [{item, status, note?}] (optional; enables stage 4)
 *   evidence_request_ids: [request_id]        (optional; enables stage 5)
 * }
 * Invalid intake -> { valid:false, errors:[...] } (every refusal branch is fixture-covered).
 * Valid intake  -> the stage 1-3 payload (8 keys, matching the estate spec's pinned worked example)
 *                  plus module_annex / evidence_handoff keys iff their inputs were supplied.
 */
export function compute(pp) {
  pp = pp || {};
  const errors = [];

  // ---- stage 1: intake + due-date validation ----
  const as_of = s(pp.as_of);
  if (!as_of) errors.push('as_of is required (declared assessment date, YYYY-MM-DD).');
  else if (!isRealCalendarDate(as_of)) errors.push(`as_of "${as_of}" must be a real calendar date formatted YYYY-MM-DD.`);

  const module = s(pp.module);
  if (!module) errors.push('module is required (sec-2026 or amla).');
  else if (!MODULES.includes(module)) errors.push(`module "${module}" is not one of the pack's regime modules (sec-2026, amla).`);

  const requests = pp.requests;
  if (!Array.isArray(requests) || requests.length === 0) {
    errors.push('requests must be a non-empty array of examination requests.');
  } else {
    const seen = new Set();
    for (let i = 0; i < requests.length; i++) {
      const r = requests[i];
      const where = `requests[${i}]`;
      if (!r || typeof r !== 'object') { errors.push(`${where} must be an object.`); continue; }
      const id = s(r.id);
      if (!id) errors.push(`${where}.id is required (synthetic identifier).`);
      else if (seen.has(id)) errors.push(`${where}.id "${id}" duplicates an earlier request id.`);
      else seen.add(id);
      if (!REQUEST_STATUSES.includes(s(r.status))) errors.push(`${where}.status must be delivered or open.`);
      if (!isRealCalendarDate(s(r.due_date))) errors.push(`${where}.due_date must be a real calendar date formatted YYYY-MM-DD.`);
    }
  }

  // optional stage 4 input: module_checklist
  let checklist = null;
  if (pp.module_checklist !== undefined) {
    checklist = pp.module_checklist;
    if (!Array.isArray(checklist)) {
      errors.push('module_checklist, when supplied, must be an array of {item, status}.');
      checklist = null;
    } else if (!module || !MODULES.includes(module)) {
      errors.push('module_checklist requires a valid module.');
      checklist = null;
    } else {
      const known = MODULE_ITEMS[module];
      const seenItems = new Set();
      for (let i = 0; i < checklist.length; i++) {
        const c = checklist[i];
        const where = `module_checklist[${i}]`;
        if (!c || typeof c !== 'object') { errors.push(`${where} must be an object.`); continue; }
        const item = s(c.item);
        if (!item) errors.push(`${where}.item is required.`);
        else if (!known.includes(item)) errors.push(`${where}.item "${item}" is not a ${module} checklist item (${known.join(', ')}).`);
        else if (seenItems.has(item)) errors.push(`${where}.item "${item}" is assessed more than once.`);
        else seenItems.add(item);
        if (!CHECKLIST_STATUSES.includes(s(c.status))) errors.push(`${where}.status must be PASS, FAIL, or NOT_ASSESSED.`);
        if (c.note !== undefined && s(c.note) === '') errors.push(`${where}.note, when supplied, must be non-empty text.`);
      }
    }
  }

  // optional stage 5 input: evidence_request_ids
  let evidenceIds = null;
  if (pp.evidence_request_ids !== undefined) {
    evidenceIds = pp.evidence_request_ids;
    if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      errors.push('evidence_request_ids, when supplied, must be a non-empty array of request ids.');
      evidenceIds = null;
    } else if (!Array.isArray(requests)) {
      errors.push('evidence_request_ids requires a valid requests array.');
      evidenceIds = null;
    } else {
      const knownIds = new Set(requests.map((r) => (r && typeof r === 'object' ? s(r.id) : null)).filter(Boolean));
      for (let i = 0; i < evidenceIds.length; i++) {
        const id = s(evidenceIds[i]);
        if (!knownIds.has(id)) errors.push(`evidence_request_ids[${i}] "${id || '(empty)'} does not match any request id.`);
      }
    }
  }

  if (errors.length > 0) {
    // FLAG-MIRROR-DOCTRINE (AUTHORING-STANDARD.md, flag-mirror section): EXAMPACK_INTAKE_INVALID is a
    // conditional compliance_flags member raised exactly when intake validation fails, mirrored into
    // output_payload by errors (non-empty iff invalid) so chain-gate steps can route on output_payload.
    return {
      output_payload: { valid: false, errors },
      compliance_flags: ['EXAMPACK_INTAKE_INVALID'],
    };
  }

  // ---- stage 2: status roll-up ----
  const total = requests.length;
  const delivered = requests.filter((r) => s(r.status) === 'delivered').length;
  const open = requests.filter((r) => s(r.status) === 'open').length;
  const overdue = requests.filter((r) => s(r.status) === 'open' && isBefore(s(r.due_date), as_of));
  const overdue_ids = overdue.map((r) => s(r.id));
  const overdue_count = overdue.length;

  // ---- stage 3: readiness score ----
  // One decimal, half-up via Math.round on the scaled value, IEEE-754 binary64, no intermediate rounding.
  const readiness_pct = Math.round((delivered / total) * 1000) / 10;
  const findings = [
    {
      check: 'overdue_requests',
      status: overdue_count > 0 ? 'FAIL' : 'PASS',
      detail: `${overdue_count} of ${total} requests overdue`,
    },
  ];
  let overall;
  if (readiness_pct === 100 && overdue_count === 0) overall = 'READY';
  else if (readiness_pct === 0) overall = 'NOT_READY';
  else overall = 'AT_RISK';

  const output_payload = {
    total,
    delivered,
    open,
    overdue_count,
    overdue_ids,
    readiness_pct,
    findings,
    overall,
  };

  const compliance_flags = [
    errors.length === 0 ? 'EXAMPACK_INTAKE_OK' : 'EXAMPACK_INTAKE_INVALID',
    module === 'amla' ? 'EXAMPACK_MODULE_AMLA' : 'EXAMPACK_MODULE_SEC2026',
  ];
  if (overall === 'READY') compliance_flags.push('EXAMPACK_READY');
  else if (overall === 'NOT_READY') compliance_flags.push('EXAMPACK_NOT_READY');
  else compliance_flags.push('EXAMPACK_AT_RISK');

  // ---- stage 4 (conditional): regime-module annex ----
  if (checklist !== null) {
    const known = MODULE_ITEMS[module];
    const byItem = new Map(checklist.map((c) => [s(c.item), c]));
    const items = known.map((item) => {
      const c = byItem.get(item);
      if (!c) return { item, status: 'NOT_ASSESSED', assessed: false };
      const out = { item, status: s(c.status), assessed: true };
      if (c.note !== undefined) out.note = s(c.note);
      return out;
    });
    const pass = items.filter((i) => i.status === 'PASS').length;
    const fail = items.filter((i) => i.status === 'FAIL').length;
    const not_assessed = items.filter((i) => i.status === 'NOT_ASSESSED').length;
    const missing = items.filter((i) => !i.assessed).length;
    const annex_verdict = fail > 0 ? 'GAPS' : (not_assessed > 0 ? 'INCOMPLETE' : 'COMPLETE');

    const annex = {
      module,
      edition: MODULE_EDITION[module].edition,
      items,
      summary: { pass, fail, not_assessed, missing },
      annex_verdict,
    };
    if (module === 'amla') {
      const pre_effective = isBefore(as_of, AMLA_FIRST_SELECTION_CONCLUSION_DATE);
      annex.first_selection_deadline = AMLA_FIRST_SELECTION_CONCLUSION_DATE;
      annex.pre_effective = pre_effective;
      annex.commencement_rule = AMLA_COMMENCEMENT_RULE;
      if (pre_effective) compliance_flags.push('EXAMPACK_AMLA_PRE_EFFECTIVE');
    }
    output_payload.module_annex = annex;
    compliance_flags.push(`EXAMPACK_ANNEX_${annex_verdict}`);
  }

  // ---- stage 5 (conditional): evidence handoff (composition only) ----
  if (evidenceIds !== null) {
    const byId = new Map(requests.map((r) => [s(r.id), r]));
    const per_request = evidenceIds.map((rawId) => {
      const id = s(rawId);
      const r = byId.get(id);
      const overdueReq = s(r.status) === 'open' && isBefore(s(r.due_date), as_of);
      const handover = s(r.status) === 'delivered' ? 'ELIGIBLE' : (overdueReq ? 'BLOCKED_OVERDUE' : 'BLOCKED_NOT_DELIVERED');
      return { request_id: id, handover };
    });
    const blocked = per_request.filter((p) => p.handover !== 'ELIGIBLE').length;
    output_payload.evidence_handoff = {
      mode: 'composition',
      binder_tools: BINDER_TOOLS,
      per_request,
    };
    if (blocked > 0) compliance_flags.push('EXAMPACK_EVIDENCE_HANDBLOCKED');
  }

  return { output_payload, compliance_flags };
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
