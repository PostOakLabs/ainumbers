import { executionHash } from './_hash.mjs';

// art-692 — Close Posting Lineage: does every declared accrual entry trace to a declared GL
// coding entry? Built per CLOSE-COMMAND-CENTER-BUILD-SPEC-2026-09-23.md D2 as re-scoped by the
// 2026-09-24 value review (build the lineage node only; the calendar, routing and flux stages
// stay parked, and no new chain is minted). Four stages in one pure compute():
//   stage 1  intake + shape validation, fail closed
//   stage 2  key uniqueness across the declared coding and accrual entries
//   stage 3  linkage classification per accrual entry (linked / unlinked / dangling ref)
//   stage 4  coding-side observations (orphan coding, missing source digest) and the verdict
//
// SCOPE IS LINKAGE STRUCTURE, NOT BUSINESS VALIDITY. The node answers "does every declared
// accrual name a declared coding entry" over caller-declared keys. It never checks that the
// two amounts agree, never reads a document behind a digest, never posts anything. A declared
// 1200 accrual tracing to a declared 300 coding entry is linked here, and that is the honest
// boundary: amount agreement is a parked option, not a silent omission.
//
// INDETERMINATE IS A REAL VERDICT, AND IT IS WHAT AN EMPTY REGISTER GETS. Zero declared
// accrual entries cannot produce "all accruals are linked" — a vacuous CLOSE_READY over an
// empty input is the unearned-green shape the estate bans. Malformed input takes the same
// path: zeroed arrays, one reason string, INDETERMINATE.
//
// VERDICT GATING. CLOSE_READY requires unlinked_accruals, dangling_trace_refs and
// duplicate_lineage_keys all empty over a non-empty accrual set. missing_source_refs and
// orphan_coding are recorded and advisory by design — a coding entry nobody accrued against,
// or one whose source digest was not declared, is information for the preparer, not a
// blocking defect of the linkage itself.
//
// FLAG DISCIPLINE (FLAGS-COMPUTED-LINT-1 + AUTHORING-STANDARD flag-mirror): the flag channel
// starts empty and carries exactly ONE conditional emission, CLOSE_LINEAGE_INDETERMINATE,
// pushed only on the indeterminate branch, and mirrored there by the closed-list payload
// member `errors` (non-empty exactly when the flag is present). The verdict itself never
// rides a flag — overall is the answer channel, and SPEC.md Sec. 21.4 chain gates resolve
// pointers against output_payload only.
//
// DETERMINISM: compute() is a pure function of pp — no clock, no randomness, no network, no
// filesystem, no TextEncoder/atob/btoa/URL (the QuickJS guest lacks all four). No floating
// point arithmetic at all: every output member is a list of declared string keys or a verdict
// token, so there is nothing to round.

const TOOL_ID = 'art-692-close-posting-lineage';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_close_posting_lineage',
  mandate_type: 'compliance_mandate', gpu: false,
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function finiteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Stage 1 — intake + shape validation. Returns the first violation as a string, or null when
// both declared lists are well-formed. Fail closed: a malformed register yields no linkage
// data at all, because a partial classification over entries whose keys were never validated
// is a silently-wrong lineage answer, which is the failure this stage exists to prevent.
function validateIntake(pp) {
  if (pp.as_of !== undefined && pp.as_of !== null) {
    if (typeof pp.as_of !== 'string' || !ISO_DATE_RE.test(pp.as_of)) {
      return 'as_of, when present, must be a YYYY-MM-DD date string.';
    }
  }
  for (const field of ['coding_entries', 'accrual_entries']) {
    if (!Array.isArray(pp[field])) return `${field} must be an array.`;
  }
  for (let i = 0; i < pp.coding_entries.length; i++) {
    const e = pp.coding_entries[i];
    const label = `coding_entries[${i}]`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) return `${label} must be an object.`;
    if (!nonEmptyString(e.key)) return `${label}.key is required (fail closed on a missing lineage key).`;
    if (!nonEmptyString(e.gl_account)) return `${label}.gl_account is required.`;
    if (!finiteNumber(e.amount)) return `${label}.amount must be a finite number.`;
    if (e.source_document_digest !== undefined && e.source_document_digest !== null
        && !nonEmptyString(e.source_document_digest)) {
      return `${label}.source_document_digest, when present, must be a non-empty string.`;
    }
  }
  for (let i = 0; i < pp.accrual_entries.length; i++) {
    const e = pp.accrual_entries[i];
    const label = `accrual_entries[${i}]`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) return `${label} must be an object.`;
    if (!nonEmptyString(e.key)) return `${label}.key is required (fail closed on a missing lineage key).`;
    if (!nonEmptyString(e.gl_account)) return `${label}.gl_account is required.`;
    if (!finiteNumber(e.amount)) return `${label}.amount must be a finite number.`;
    const t = e.traces_to;
    if (t === undefined || t === null) continue; // absent traces_to reads as none, not as malformed
    if (!Array.isArray(t)) return `${label}.traces_to must be an array of non-empty strings.`;
    for (let j = 0; j < t.length; j++) {
      if (!nonEmptyString(t[j])) return `${label}.traces_to[${j}] must be a non-empty string.`;
    }
  }
  return null;
}

// The indeterminate payload: every list empty, the reason carried once in errors. Shared by
// the malformed-input branch and the empty-register branch so the two read identically to a
// downstream consumer, which only ever needs "no linkage assertion was possible, here is why".
function indeterminate(reason) {
  return {
    output_payload: {
      linked_accruals: [],
      unlinked_accruals: [],
      dangling_trace_refs: [],
      orphan_coding: [],
      missing_source_refs: [],
      duplicate_lineage_keys: [],
      overall: 'INDETERMINATE',
      errors: [reason],
    },
    compliance_flags: ['CLOSE_LINEAGE_INDETERMINATE'],
  };
}

/**
 * compute(pp) — the four-stage lineage verdict. Pure and synchronous.
 * pp: {
 *   as_of?: "YYYY-MM-DD",
 *   coding_entries:  [{ key, gl_account, amount, source_document_digest? }],
 *   accrual_entries: [{ key, gl_account, amount, traces_to?: [key] }]
 * }
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 *
 * On an assertable register the payload carries exactly the seven pinned members
 * (linked_accruals, unlinked_accruals, dangling_trace_refs, orphan_coding, missing_source_refs,
 * duplicate_lineage_keys, overall) — the spec's worked example pins that shape through its
 * execution_hash, so no member may be added on this path. errors joins only the indeterminate
 * branch, where no pin applies.
 */
export function compute(pp) {
  pp = pp || {};

  // Stage 1 — intake.
  const intake_error = validateIntake(pp);
  if (intake_error !== null) return indeterminate(intake_error);

  const coding = pp.coding_entries;
  const accruals = pp.accrual_entries;

  // An empty accrual set is assertion-free: there is no population over which "every accrual
  // traces to a coding entry" could be true. It is INDETERMINATE, never CLOSE_READY.
  if (accruals.length === 0) {
    return indeterminate('no accrual entries declared; linkage cannot be asserted over an empty register.');
  }

  // Stage 2 — key uniqueness. Lineage keys are caller-declared and period-scoped by
  // convention, so a repeated key is a collision the preparer must resolve before any
  // traces_to reference to it can mean one thing. Reported in first-repeat order, once per
  // colliding key, over the coding and accrual entries together.
  const seen = {};
  const duplicate_lineage_keys = [];
  for (const e of coding.concat(accruals)) {
    if (Object.prototype.hasOwnProperty.call(seen, e.key)) {
      if (seen[e.key] === 1) duplicate_lineage_keys.push(e.key);
      seen[e.key]++;
    } else {
      seen[e.key] = 1;
    }
  }

  // Stage 3 — linkage classification, in declared accrual order. An accrual with no traces_to
  // is unlinked; one naming a key no coding entry declares carries a dangling reference. Both
  // classifications can be true of neither, and dangling takes precedence in the linked list:
  // an accrual is linked only when every reference it declares resolves.
  const codingKeys = {};
  for (const e of coding) codingKeys[e.key] = true;

  const linked_accruals = [];
  const unlinked_accruals = [];
  const dangling_trace_refs = [];
  const referenced = {};
  for (const a of accruals) {
    const refs = Array.isArray(a.traces_to) ? a.traces_to : [];
    if (refs.length === 0) {
      unlinked_accruals.push(a.key);
      continue;
    }
    let allResolve = true;
    for (const ref of refs) {
      if (Object.prototype.hasOwnProperty.call(codingKeys, ref)) {
        referenced[ref] = true;
      } else {
        allResolve = false;
        dangling_trace_refs.push({ accrual_key: a.key, trace_ref: ref });
      }
    }
    if (allResolve) linked_accruals.push(a.key);
  }

  // Stage 4 — coding-side observations (advisory, never gating) and the verdict.
  const orphan_coding = [];
  const missing_source_refs = [];
  for (const e of coding) {
    if (!Object.prototype.hasOwnProperty.call(referenced, e.key)) orphan_coding.push(e.key);
    if (!nonEmptyString(e.source_document_digest)) missing_source_refs.push(e.key);
  }

  const gated = unlinked_accruals.length + dangling_trace_refs.length + duplicate_lineage_keys.length;

  return {
    output_payload: {
      linked_accruals,
      unlinked_accruals,
      dangling_trace_refs,
      orphan_coding,
      missing_source_refs,
      duplicate_lineage_keys,
      overall: gated > 0 ? 'GAPS_FOUND' : 'CLOSE_READY',
    },
    compliance_flags: [],
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0, supersedes = undefined } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
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
  if (Array.isArray(supersedes) && supersedes.length > 0) {
    artifact.supersedes = supersedes;
  }
  return artifact;
}
