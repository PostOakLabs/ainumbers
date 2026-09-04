/**
 * art-674-eba-im-model-validation-tracker.kernel.mjs
 *
 * EBA-IM-TRACKER-BUILD-1 (EBA-IM-TRACKER-BUILD-SPEC.md) -- deterministic roll-up arithmetic over
 * a caller-DECLARED internal-model inventory. A tracker over declared inputs, never a consumer of
 * live registers: there is no network, no storage, no SSR tape, no borrow list, and no clock
 * inside compute(). The caller declares the inventory snapshot and the as_of date; this kernel
 * only performs the named arithmetic and returns it with a trace.
 *
 * NAMED RULES (declared here, never chosen at runtime):
 *   - approved  = count of models whose declared status is "approved" (whole number).
 *   - pending   = count of models whose declared status is "submitted" (whole number).
 *   - pending_ids   = ids of the submitted models, in declared order.
 *   - pending_age_days  = whole days from each pending model's declared "submitted" date to the
 *     declared as_of date (UTC calendar-day difference; never a wall-clock read).
 *   - trace = one entry per pending model, in declared order, joined by "; ":
 *     "<id> submitted <date>, <age> days to as_of". Exactly the pinned canonical phrasing.
 *   - overall verdict under the declared aging rule AGE_ATTENTION_DAYS = 180:
 *       TRACKING_EMPTY    no submitted and no approved models in the declared inventory;
 *       TRACKING_AGED     at least one pending model older than 180 days at as_of;
 *       TRACKING_CURRENT  otherwise.
 *   - Status "rejected" is validated but counted nowhere: a rejected application is neither
 *     approved nor pending. T516 computation is a linked pointer; this kernel does not compute
 *     margin, does not check live registers, and is not_proven against them (the not_proven
 *     discipline applies).
 *
 * NEVER GUESS, NEVER DEFAULT. An absent or invalid as_of, model entry, id, status, or submitted
 * date resolves to the fail-closed payload -- counts null, overall FAIL_CLOSED, each offending
 * field named in domain_errors and in the trace -- never a silently repaired inventory.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4). This kernel tracks arithmetic of
 * a declared inventory. It is NOT a regulatory determination, NOT advice on any application, and
 * NOT a check of any supervisor register, live SSR tape, or cutoff feed. Whether any model is
 * suitable for internal-model use is a judgement for the caller and its supervisor alone.
 *
 * Output payload shape: exactly { approved, pending, pending_ids, pending_age_days, trace,
 * overall } on success (the canonical pinned shape; extra keys would move the execution_hash),
 * and the same six keys nulled (overall = "FAIL_CLOSED") plus a domain_errors[] array on the
 * fail-closed path (the flag-mirror member: a caveat carrier, truthy exactly when inputs were
 * refused).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). Runs unmodified in the
 * QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in this file).
 *
 * Spec: EBA-IM-TRACKER-BUILD-SPEC.md (worked example is the parity pin d8f8d45f070f7c99...).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-674-eba-im-model-validation-tracker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_eba_im_model_validation_tracker',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const STATUSES = ['submitted', 'approved', 'rejected'];
const MAX_MODELS = 4096;
const AGE_ATTENTION_DAYS = 180; // declared aging rule: pending over this many days flags TRACKING_AGED

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_AS_OF: 'as_of must be a calendar date in YYYY-MM-DD form',
  INVALID_MODELS: 'models must be a non-empty array of declared model entries, at most 4096',
  INVALID_MODEL_ENTRY: 'each model entry must be an object with string id, status, and submitted fields',
  INVALID_MODEL_ID: 'each model id must be a non-empty string',
  DUPLICATE_MODEL_ID: 'model ids must be unique within the declared inventory',
  INVALID_MODEL_STATUS: 'each model status must be one of submitted, approved, rejected',
  INVALID_SUBMITTED_DATE: 'each model submitted date must be a calendar date in YYYY-MM-DD form',
  SUBMITTED_AFTER_AS_OF: 'a submitted date must not fall after the declared as_of date',
};

/** UTC-midnight milliseconds for a YYYY-MM-DD string, or NaN when the date is not real. */
function utcMs(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return NaN;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return NaN;
  return ms;
}

/** Shortest round-trip number formatting for trace strings (94 -> "94"). */
function fmt(n) { return String(n); }

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];

  const asOfMs = utcMs(pp.as_of);
  if (Number.isNaN(asOfMs)) domain_errors.push('INVALID_AS_OF');

  const models = pp.models;
  const shapeOk = Object.prototype.toString.call(models) === '[object Array]' && models.length > 0 && models.length <= MAX_MODELS;
  if (!shapeOk) {
    domain_errors.push('INVALID_MODELS');
  } else {
    const seen = new Set();
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      if (m === null || typeof m !== 'object' || Array.isArray(m)
        || typeof m.id !== 'string' || typeof m.status !== 'string' || typeof m.submitted !== 'string') {
        domain_errors.push('INVALID_MODEL_ENTRY');
        continue;
      }
      if (m.id.length === 0) { domain_errors.push('INVALID_MODEL_ID'); continue; }
      if (seen.has(m.id)) { domain_errors.push('DUPLICATE_MODEL_ID'); continue; }
      seen.add(m.id);
      if (!STATUSES.includes(m.status)) { domain_errors.push('INVALID_MODEL_STATUS'); continue; }
      const subMs = utcMs(m.submitted);
      if (Number.isNaN(subMs)) { domain_errors.push('INVALID_SUBMITTED_DATE'); continue; }
      if (!Number.isNaN(asOfMs) && subMs > asOfMs) { domain_errors.push('SUBMITTED_AFTER_AS_OF'); continue; }
    }
  }

  const compliance_flags = [];

  if (domain_errors.length > 0) {
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`EBAIMT_${code}`);
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    return {
      output_payload: {
        approved: null,
        pending: null,
        pending_ids: null,
        pending_age_days: null,
        trace: `fail-closed: ${reasons}; no roll-up computed -- correct the named inputs and resubmit. Tracker over caller-declared synthetic inputs only: it does not check any live register, SSR tape, or cutoff feed, and no such check is claimed (not_proven).`,
        overall: 'FAIL_CLOSED',
        domain_errors,
      },
      compliance_flags,
    };
  }

  const approved = [];
  const pendingIds = [];
  const pendingAges = {};
  const traceParts = [];
  for (const m of models) {
    if (m.status === 'approved') approved.push(m.id);
    else if (m.status === 'submitted') {
      pendingIds.push(m.id);
      const age = Math.round((asOfMs - utcMs(m.submitted)) / 86400000);
      pendingAges[m.id] = age;
      traceParts.push(`${m.id} submitted ${m.submitted}, ${fmt(age)} days to as_of`);
    }
  }

  let overall = 'TRACKING_CURRENT';
  if (pendingIds.length === 0 && approved.length === 0) overall = 'TRACKING_EMPTY';
  else if (pendingIds.some((id) => pendingAges[id] > AGE_ATTENTION_DAYS)) overall = 'TRACKING_AGED';

  const output_payload = {
    approved: approved.length,
    pending: pendingIds.length,
    pending_ids: pendingIds,
    pending_age_days: pendingAges,
    trace: traceParts.join('; '),
    overall,
  };

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
