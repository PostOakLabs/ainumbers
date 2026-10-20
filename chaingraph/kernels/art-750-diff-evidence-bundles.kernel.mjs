import { executionHash } from './_hash.mjs';

// art-750-diff-evidence-bundles - OCG evidence-bundle diff as a deterministic kernel.
// Ports the internal comparison math of the pre-existing human page bundle-diff.html
// (root tools page, kept untouched by this row) from a page-only view into a
// hash-bearing server kernel an MCP caller can execute. The page's rendering layer
// (HTML cards, chips, tables) is NOT ported: the kernel returns values only.
//
// Pure function: no Date.now(), no Math.random(), no network, no filesystem, no
// guest builtins (no TextEncoder/atob/btoa/URL). The one place the page reads the
// wall clock (fresher-than check on override records) is parameterized here as the
// caller-supplied policy parameter as_of (ISO 8601 string); when an override record
// is present and as_of is absent, compute() refuses with a named error instead of
// guessing a clock reading.
//
// Comparison semantics carried over from the page verbatim:
// - Four input classes: artifact (object with execution_hash), chain (array of step
//   artifacts with tool_id + execution_hash, or object with a steps array), evidence
//   bundle (object with subject_hash and no execution_hash, plus reviewer/approver/
//   annotation/timestamp members), records array (non-empty array of records with
//   record_type). Anything else is refused.
// - Four sections: hash/digest fields, version fields, normalized human-
//   accountability sets, verdict. A shape migration on the accountability side is
//   never itself a diff row; only substantive membership changes are.
// - Depth cap 200 on the field walk (hostile-input guard carried from the page).

const TOOL_ID = 'art-750-diff-evidence-bundles';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_diff_evidence_bundles',
  mandate_type: 'compliance_control', gpu: false,
};

// Named constant carried from the page: maximum nesting depth the field walk
// will descend before refusing. A hostile bundle must not crash the caller.
export const MAX_DEPTH = 200;

// Verdict key precedence, carried from the page in order.
export const VERDICT_KEYS = ['verdict', 'decision', 'status', 'outcome', 'result'];

// Section status vocabulary (closed four-value enum, page chip states):
// 'absent' (neither side carries the layer) | the no-diff value | 'changed' |
// 'regressed' (verdict moved toward fail/reject/hold).
const STATUS_ABSENT = 'absent';
const STATUS_UNCHANGED = 'unchanged';
const STATUS_CHANGED = 'changed';
const STATUS_REGRESSED = 'regressed';

// --- generic path-keyed field walk (page __biWalk / extractors) ------------
function walk(obj, matcher, prefix, out, depth) {
  if (depth > MAX_DEPTH) {
    throw new Error('Bundle nesting exceeds ' + MAX_DEPTH + ' levels at "' + prefix + '" - refusing to walk further.');
  }
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) walk(obj[i], matcher, prefix + '[' + i + ']', out, depth + 1);
    return;
  }
  if (typeof obj !== 'object') return;
  const keys = Object.keys(obj);
  for (const k of keys) {
    const v = obj[k];
    const path = prefix ? prefix + '.' + k : k;
    if (matcher(k) && (typeof v === 'string' || typeof v === 'number') && String(v).length) {
      out[path] = String(v);
    }
    if (v && typeof v === 'object') walk(v, matcher, path, out, depth + 1);
  }
}

function extractHashes(root) {
  const out = {};
  walk(root, (k) => /(_hash|_digest)$/i.test(k) || /^(hash|digest)$/i.test(k), '', out, 0);
  return out;
}
function extractVersions(root) {
  const out = {};
  walk(root, (k) => /(^|_)version$/i.test(k), '', out, 0);
  return out;
}
function extractThresholds(root) {
  const out = {};
  walk(root, (k) => /(threshold|gate_policy|policy_applied)/i.test(k), '', out, 0);
  return out;
}

function diffMaps(a, b) {
  const rows = [];
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  Array.from(keys).sort().forEach((k) => {
    const inA = Object.prototype.hasOwnProperty.call(a, k);
    const inB = Object.prototype.hasOwnProperty.call(b, k);
    if (inA && inB) { if (a[k] !== b[k]) rows.push({ path: k, kind: 'changed', from: a[k], to: b[k] }); }
    else if (inA) rows.push({ path: k, kind: 'removed', from: a[k], to: null });
    else rows.push({ path: k, kind: 'added', from: null, to: b[k] });
  });
  return rows;
}

function diffSets(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  return {
    added: b.filter((x) => !A.has(x)),
    removed: a.filter((x) => !B.has(x)),
  };
}

// --- input classification (page __biClassify) ------------------------------
function classify(parsed) {
  if (Array.isArray(parsed) && parsed.length) {
    if (parsed[0] && parsed[0].record_type) return 'records';
    if (parsed[0] && parsed[0].tool_id && ('execution_hash' in parsed[0])) return 'chain';
    return 'unknown';
  }
  if (parsed && typeof parsed === 'object') {
    if (parsed.steps && Array.isArray(parsed.steps)) return 'chain';
    if (parsed.subject_hash && !parsed.execution_hash && (parsed.reviewers || parsed.approvers || parsed.annotations || parsed.timestamps)) return 'evidence_bundle';
    if ('execution_hash' in parsed) return 'artifact';
  }
  return 'unknown';
}

// --- accountability normalization (page __biHaCanon / __biHaBucket) --------
// Legacy record arrays, embedded sign_off members and evidence-bundle approver/
// reviewer members all normalize to the same {approvals, rejections, overrides,
// thresholds} sets so a shape migration alone never surfaces as a diff row.
// Bucketing: role 'reviewer' keeps its own bucket; every other role lands in
// 'approver', mirroring the estate's evidence-bundle assembler split.
function haBucket(role) { return role === 'reviewer' ? 'reviewer' : 'approver'; }

function overrideActive(record, asOfMs) {
  if (!record || record.record_type !== 'override' || !record.override || !record.override.expiry) return false;
  return asOfMs < Date.parse(record.override.expiry);
}

function haCanon(parsed, asOfMs) {
  const kind = classify(parsed);
  const approvals = [];
  const rejections = [];
  const overrides = [];
  let subjectHash = null;
  let shape = 'none';

  if (kind === 'evidence_bundle') {
    shape = 'evidence-bundle';
    subjectHash = parsed.subject_hash || null;
    (parsed.approvers || []).forEach((id) => approvals.push('approver::' + id));
    (parsed.reviewers || []).forEach((id) => approvals.push('reviewer::' + id));
    if (parsed.exception_rationale) overrides.push('exception::' + parsed.exception_rationale);
  } else {
    const records = kind === 'records' ? parsed
      : (parsed && (parsed.human_accountability_records || parsed.records)) || null;
    if (records && records.length) {
      shape = 'records-array';
      records.forEach((r) => {
        const id = (r.identity && r.identity.id) || '(unsigned)';
        const tag = haBucket(r.role) + '::' + id;
        if (r.record_type === 'approval') approvals.push(tag);
        else if (r.record_type === 'rejection') rejections.push(tag);
        else if (r.record_type === 'override') {
          const state = asOfMs === null ? '(freshness unknown)' : (overrideActive(r, asOfMs) ? '(active)' : '(expired)');
          overrides.push(tag + state);
        }
        if (r.subject_hash) subjectHash = subjectHash || r.subject_hash;
      });
    } else if (parsed && parsed.output_payload) {
      // Legacy pre-convergence ad-hoc sign_off member, remapped to the same keys.
      const op = parsed.output_payload;
      if (op.sign_off && op.sign_off.reviewer_statement) {
        shape = 'legacy-sign_off';
        approvals.push(haBucket(op.sign_off.reviewer_role) + '::(legacy sign_off, no signer identity)');
      }
      if (op.ha_record) {
        shape = 'ha_record';
        const hr = op.ha_record;
        const id2 = (hr.identity && hr.identity.id) || '(unsigned)';
        approvals.push(haBucket(hr.role) + '::' + id2);
      }
    }
  }
  const thresholds = (parsed && parsed.policy_parameters) ? extractThresholds(parsed.policy_parameters) : {};
  return {
    shape, subjectHash,
    approvals: approvals.sort(), rejections: rejections.sort(), overrides: overrides.sort(),
    thresholds,
  };
}

function containsOverride(parsed) {
  const hits = {};
  // walk() only ever throws the named depth-cap error; letting it propagate here
  // surfaces that refusal ahead of the as_of requirement, as the page does.
  walk(parsed, (k) => k === 'record_type', '', hits, 0);
  return Object.keys(hits).some((p) => hits[p] === 'override');
}

// --- verdict extraction (page __biExtractVerdict) ---------------------------
function extractVerdict(parsed) {
  if (!parsed || typeof parsed !== 'object') return { value: null, source: null };
  if ('verification_result' in parsed && parsed.verification_result !== null && parsed.verification_result !== undefined) {
    const vr = parsed.verification_result;
    return { value: (typeof vr === 'string') ? vr : JSON.stringify(vr), source: 'verification_result' };
  }
  const op = parsed.output_payload || parsed;
  for (let i = 0; i < VERDICT_KEYS.length; i++) {
    const k = VERDICT_KEYS[i];
    if (op && typeof op[k] === 'string') return { value: op[k], source: 'output_payload.' + k };
    if (parsed[k] && typeof parsed[k] === 'string') return { value: parsed[k], source: k };
  }
  if (op && Array.isArray(op.checks) && op.checks.length) {
    const allPass = op.checks.every((c) => c && c.pass === true);
    const failed = op.checks.filter((c) => c && c.pass !== true).length;
    return { value: allPass ? 'PASS (all checks)' : 'FAIL (' + failed + ' check(s) failed)', source: 'derived from output_payload.checks[]' };
  }
  return { value: null, source: null };
}

function mapSection(a, b, extractor) {
  const va = extractor(a);
  const vb = extractor(b);
  const rows = diffMaps(va, vb);
  if (!Object.keys(va).length && !Object.keys(vb).length) {
    return { count_a: 0, count_b: 0, status: STATUS_ABSENT, rows: [] };
  }
  return {
    count_a: Object.keys(va).length,
    count_b: Object.keys(vb).length,
    status: rows.length ? STATUS_CHANGED : STATUS_UNCHANGED,
    rows,
  };
}

/**
 * compute(pp) - pure bundle-diff kernel.
 * pp = {
 *   bundle_a: parsed JSON value (required) - the baseline bundle,
 *   bundle_b: parsed JSON value (required) - the comparison bundle,
 *   as_of: string ISO 8601 (optional) - clock reading for override freshness;
 *          REQUIRED when either bundle carries an override record.
 * }
 * Unrecognizable inputs, missing sides, depth overflow and a missing as_of on an
 * override-bearing pair are refused by throw with a named reason.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  if (pp === null || typeof pp !== 'object' || Array.isArray(pp)) {
    throw new Error('pp must be an object');
  }
  const { bundle_a, bundle_b, as_of } = pp;
  // R4 (absent equals explicit null): the null form of an input gets exactly
  // the absent form's answer, everywhere.
  if (bundle_a == null) throw new Error('bundle_a is required');
  if (bundle_b == null) throw new Error('bundle_b is required');
  if (as_of != null && (typeof as_of !== 'string' || Number.isNaN(Date.parse(as_of)))) {
    throw new Error('as_of must be an ISO 8601 date string when present');
  }

  const kindA = classify(bundle_a);
  const kindB = classify(bundle_b);
  if (kindA === 'unknown') throw new Error('bundle_a is not a recognizable OCG artifact, chain, evidence bundle or records array');
  if (kindB === 'unknown') throw new Error('bundle_b is not a recognizable OCG artifact, chain, evidence bundle or records array');

  const needAsOf = containsOverride(bundle_a) || containsOverride(bundle_b);
  if (needAsOf && as_of == null) {
    throw new Error('as_of is required when either bundle carries an override record (the page reads the wall clock here; the kernel takes the reading as a policy parameter)');
  }
  const asOfMs = as_of == null ? null : Date.parse(as_of);

  // Section 1: hash/digest-bearing fields.
  const hashes = mapSection(bundle_a, bundle_b, extractHashes);

  // Section 2: version-bearing fields.
  const versions = mapSection(bundle_a, bundle_b, extractVersions);

  // Section 3: normalized accountability sets. Shape differences alone are not
  // reported as changes; only membership and threshold moves are.
  const ca = haCanon(bundle_a, asOfMs);
  const cb = haCanon(bundle_b, asOfMs);
  const appr = diffSets(ca.approvals, cb.approvals);
  const rej = diffSets(ca.rejections, cb.rejections);
  const ovr = diffSets(ca.overrides, cb.overrides);
  const thrRows = diffMaps(ca.thresholds, cb.thresholds);
  const accRows = [];
  appr.removed.forEach((x) => accRows.push({ path: 'approval: ' + x, kind: 'removed', from: 'present', to: null }));
  appr.added.forEach((x) => accRows.push({ path: 'approval: ' + x, kind: 'added', from: null, to: 'present' }));
  rej.removed.forEach((x) => accRows.push({ path: 'rejection: ' + x, kind: 'removed', from: 'present', to: null }));
  rej.added.forEach((x) => accRows.push({ path: 'rejection: ' + x, kind: 'added', from: null, to: 'present' }));
  ovr.removed.forEach((x) => accRows.push({ path: 'override: ' + x, kind: 'removed', from: 'present', to: null }));
  ovr.added.forEach((x) => accRows.push({ path: 'override: ' + x, kind: 'added', from: null, to: 'present' }));
  thrRows.forEach((r) => accRows.push({ path: 'threshold field: ' + r.path, kind: r.kind, from: r.from, to: r.to }));
  const accChanged = accRows.length > 0;
  const accountability = {
    shape_a: ca.shape,
    shape_b: cb.shape,
    subject_hash_a: ca.subjectHash,
    subject_hash_b: cb.subjectHash,
    counts_a: { approvals: ca.approvals.length, rejections: ca.rejections.length, overrides: ca.overrides.length },
    counts_b: { approvals: cb.approvals.length, rejections: cb.rejections.length, overrides: cb.overrides.length },
    thresholds_count_a: Object.keys(ca.thresholds).length,
    thresholds_count_b: Object.keys(cb.thresholds).length,
    status: accChanged ? STATUS_CHANGED : ((ca.shape === 'none' && cb.shape === 'none') ? STATUS_ABSENT : STATUS_UNCHANGED),
    rows: accRows,
  };

  // Section 4: verdict.
  const va = extractVerdict(bundle_a);
  const vb = extractVerdict(bundle_b);
  let verdictStatus;
  if (va.value === null && vb.value === null) verdictStatus = STATUS_ABSENT;
  else if (va.value === vb.value) verdictStatus = STATUS_UNCHANGED;
  else verdictStatus = STATUS_CHANGED;
  const regressed = va.value !== vb.value
    && /fail|reject|hold/i.test(String(vb.value))
    && !/fail|reject|hold/i.test(String(va.value));
  if (regressed) verdictStatus = STATUS_REGRESSED;
  const verdict = {
    value_a: va.value, source_a: va.source,
    value_b: vb.value, source_b: vb.source,
    status: verdictStatus,
    regressed,
  };

  const sections = [hashes.status, versions.status, accountability.status, verdict.status];
  const changedSections = sections.filter((s) => s === STATUS_CHANGED || s === STATUS_REGRESSED).length;

  const output_payload = {
    input_class_a: kindA,
    input_class_b: kindB,
    inputs_differ_in_class: kindA !== kindB,
    hashes,
    versions,
    human_accountability: accountability,
    verdict,
    changed_section_count: changedSections,
    bundles_identical: changedSections === 0,
  };
  return { output_payload, compliance_flags: [] };
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
