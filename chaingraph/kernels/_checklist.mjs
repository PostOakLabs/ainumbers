// OpenChainGraph shared checklist/SOP runner logic — CHECKRUN-1.
// SINGLE SOURCE OF TRUTH for: definition validation, definition digest,
// step-receipt / run-receipt construction, the §20.1 Merkle tree, and the
// §22.9-shaped escalation (failure) receipt.
//
// Reuses the ONE canonicalizer (cgCanon/executionHash, chaingraph/kernels/_hash.mjs)
// and the ONE signer (_proof.mjs, eddsa-jcs-2022) — no second canonicalization
// or crypto path. Byte-identical copies of this file's logic are inlined into:
//   - chaingraph/checklist-definition-builder.html (CR-1, composer/author)
//   - chaingraph/checklist-run-executor.html       (CR-2, run + receipts)
//   - chaingraph/checklist-run-verifier.html       (CR-3, verify)
//   - mcp-apps-poc/checkrun.mjs                    (CR-4, worker MCP tools)
// Any change here MUST be copied to all four (checklist-selftest.mjs asserts
// the browser/worker/node paths agree by exercising this exact module).
//
// Doctrine fence (CHECKRUN-1-BUILD-SPEC.md): this emits RECEIPTS. It is not a
// hosted workflow service — no server state, no accounts. A "run" lives
// client-side / in the artifact chain the operator holds.

import { cgCanon, executionHash } from './_hash.mjs';

export const CHECKLIST_CONTEXT = 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld';
export const CG_VERSION = '0.4.0';

const EVIDENCE_KINDS = new Set(['none', 'text', 'file-digest', 'attestation']);
const GATE_KINDS = new Set(['blocking', 'advisory']);

// ── Definition validation (hand-rolled, zero-dep — schema-validate.mjs house
//    style: explicit field/type checks, not a generic JSON-Schema engine) ───
export function validateDefinition(def) {
  const errs = [];
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(def)) { errs.push('definition: must be an object'); return { valid: false, errors: errs }; }
  if (typeof def.definition_id !== 'string' || !def.definition_id) errs.push('definition_id: required non-empty string');
  if (typeof def.title !== 'string' || !def.title) errs.push('title: required non-empty string');
  if (typeof def.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(def.version)) errs.push('version: required semver string (x.y.z)');
  if (def.source_citation != null && typeof def.source_citation !== 'string') errs.push('source_citation: must be a string if present');
  if (def.mandate_hash != null && typeof def.mandate_hash !== 'string') errs.push('mandate_hash: must be a string (§22 work-mandate hash) if present');
  if (!Array.isArray(def.steps) || def.steps.length === 0) {
    errs.push('steps: required non-empty array');
  } else {
    const seenIds = new Set();
    def.steps.forEach((s, i) => {
      const p = `steps[${i}]`;
      if (!isObj(s)) { errs.push(`${p}: must be an object`); return; }
      if (typeof s.step_id !== 'string' || !s.step_id) errs.push(`${p}.step_id: required non-empty string`);
      else if (seenIds.has(s.step_id)) errs.push(`${p}.step_id: duplicate "${s.step_id}"`);
      else seenIds.add(s.step_id);
      if (typeof s.title !== 'string' || !s.title) errs.push(`${p}.title: required non-empty string`);
      if (typeof s.instruction !== 'string' || !s.instruction) errs.push(`${p}.instruction: required non-empty string`);
      if (!EVIDENCE_KINDS.has(s.evidence_requirement)) errs.push(`${p}.evidence_requirement: must be one of none|text|file-digest|attestation`);
      if (s.approver_role != null && typeof s.approver_role !== 'string') errs.push(`${p}.approver_role: must be a string if present`);
      if (!GATE_KINDS.has(s.gate)) errs.push(`${p}.gate: must be one of blocking|advisory`);
    });
  }
  return { valid: errs.length === 0, errors: errs };
}

// ── Definition digest — SHA-256 over the JCS canonicalization of the
//    definition with definition_digest/audit_signature stripped (a proof/
//    digest is never part of its own input — same discipline as _proof.mjs
//    securedDocument). Reuses cgCanon; does NOT invent a second canonicalizer. ─
export async function definitionDigest(def) {
  const stripped = { ...def };
  delete stripped.definition_digest;
  delete stripped.audit_signature;
  const canon = cgCanon(stripped);
  const bytes = new TextEncoder().encode(JSON.stringify(canon));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── §20.1 Merkle machinery — RFC 6962 (Certificate Transparency) domain-
//    separated leaf/node hashing, SAME clean-room construction as
//    art-286-anchored-extract-verifier.kernel.mjs (leaf: / node: string
//    prefixes) — reused here for the run-receipt Merkle root over step
//    receipts, not re-derived. ─────────────────────────────────────────────
async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function leafHash(contentHash) { return sha256Hex('leaf:' + String(contentHash ?? '')); }
export async function combineNodes(left, right) { return sha256Hex('node:' + left + ':' + right); }

// Full RFC 6962 Merkle Tree Hash (MTH) over an ordered list of leaf content
// hashes (step execution_hash values). MTH([]) is the empty hash; MTH([d0])
// is leafHash(d0); for n>1, split at the largest power of two k<n.
export async function merkleRoot(leafContentHashes) {
  const n = leafContentHashes.length;
  if (n === 0) return sha256Hex('');
  if (n === 1) return leafHash(leafContentHashes[0]);
  let k = 1;
  while (k * 2 < n) k *= 2;
  const left = await merkleRoot(leafContentHashes.slice(0, k));
  const right = await merkleRoot(leafContentHashes.slice(k));
  return combineNodes(left, right);
}

// Inclusion path for leaf index `i` among n leaves — mirrors art-286's
// verifier-side walkMerklePath so a run receipt is independently checkable
// leaf-by-leaf, not just as a whole-tree recompute.
export async function merklePath(leafContentHashes, i) {
  async function pathAt(hashes, idx) {
    const n = hashes.length;
    if (n <= 1) return [];
    let k = 1;
    while (k * 2 < n) k *= 2;
    if (idx < k) {
      const rightRoot = await merkleRoot(hashes.slice(k));
      return [{ hash: rightRoot, position: 'right' }, ...(await pathAt(hashes.slice(0, k), idx))];
    }
    const leftRoot = await merkleRoot(hashes.slice(0, k));
    return [{ hash: leftRoot, position: 'left' }, ...(await pathAt(hashes.slice(k), idx - k))];
  }
  return pathAt(leafContentHashes, i);
}

// ── Step receipt (OCG v0.4 artifact) ────────────────────────────────────────
// policy_parameters carries the hash-chain link (prev_step_receipt_digest);
// execution_hash of THIS receipt becomes the next step's chain link.
export async function buildStepReceipt({
  definition_digest, step, step_index, completer_key, timestamp, evidence, prev_step_receipt_digest,
}) {
  const policy_parameters = {
    definition_digest,
    step_id: step.step_id,
    step_index,
    completer_key: completer_key ?? null,
    timestamp,
    evidence: evidence ?? null,
    prev_step_receipt_digest: prev_step_receipt_digest ?? null,
  };
  const output_payload = {
    step_title: step.title,
    gate: step.gate,
    evidence_requirement: step.evidence_requirement,
    evidence_provided: step.evidence_requirement === 'none' ? true : !!evidence,
  };
  const execution_hash = await executionHash(policy_parameters, output_payload);
  return {
    '@context': CHECKLIST_CONTEXT,
    chaingraph_version: CG_VERSION,
    mandate_type: 'compliance_control',
    tool_id: 'checkrun-step-receipt',
    tool_version: '1.0.0',
    generated_at: timestamp,
    execution_hash,
    chain: {
      parent_hashes: prev_step_receipt_digest ? [prev_step_receipt_digest] : [],
      parent_tool_ids: prev_step_receipt_digest ? ['checkrun-step-receipt'] : [],
      chain_depth: step_index,
    },
    policy_parameters,
    output_payload,
    compliance_flags: step.gate === 'blocking' ? ['CHECKRUN_BLOCKING_GATE'] : ['CHECKRUN_ADVISORY_GATE'],
    compute_mode: 'client',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

// ── Run receipt (OCG v0.4 artifact) — Merkle root over step execution_hash
//    values, per §20.1. outcome: complete|aborted|escalated. ───────────────
export async function buildRunReceipt({
  definition_digest, run_id, started_at, completed_at, outcome, stepReceipts, escalation,
}) {
  const leaves = stepReceipts.map((r) => r.execution_hash);
  const merkle_root = await merkleRoot(leaves);
  const policy_parameters = {
    definition_digest,
    run_id,
    started_at,
    completed_at,
    outcome,
    step_count: stepReceipts.length,
  };
  const output_payload = {
    merkle_root,
    merkle_algorithm: 'rfc6962',
    steps: stepReceipts.map((r, i) => ({ step_id: r.policy_parameters.step_id, index: i, execution_hash: r.execution_hash })),
    outcome,
    escalation: escalation ?? null,
  };
  const execution_hash = await executionHash(policy_parameters, output_payload);
  return {
    '@context': CHECKLIST_CONTEXT,
    chaingraph_version: CG_VERSION,
    mandate_type: 'compliance_control',
    tool_id: 'checkrun-run-receipt',
    tool_version: '1.0.0',
    generated_at: completed_at,
    execution_hash,
    chain: {
      parent_hashes: leaves,
      parent_tool_ids: stepReceipts.map(() => 'checkrun-step-receipt'),
      chain_depth: stepReceipts.length,
    },
    policy_parameters,
    output_payload,
    compliance_flags: outcome === 'complete' ? ['CHECKRUN_COMPLETE'] : outcome === 'escalated' ? ['CHECKRUN_ESCALATED'] : ['CHECKRUN_ABORTED'],
    compute_mode: 'client',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

// ── §22.9 Signed failure (escalation) receipt — AR4SI-tiered, references the
//    subject execution_hash, names the failing rule id. Signing is optional
//    (holder-chosen, §16.2) — callers pass a private key via _proof.mjs
//    addProof/sign separately; this builds the unsigned body. ──────────────
export function buildEscalationReceipt({ definition_digest, subject_execution_hash, failing_rule_id, ar4si_tier, detail, generated_at }) {
  return {
    '@context': CHECKLIST_CONTEXT,
    chaingraph_version: CG_VERSION,
    receipt_type: 'failure_receipt',
    ar4si_tier: ar4si_tier ?? 'contraindicated',
    failing_rule_id,
    subject_execution_hash,
    definition_digest,
    generated_at,
    detail,
    spec_ref: 'OpenChainGraph SPEC.md §22.9 (IETF RATS EAR / AR4SI)',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

// ── Verifier: replay the chain + Merkle root from a set of step receipts +
//    a run receipt, recomputing execution_hash at every link. Returns the
//    exact broken link (step index) on any tamper. ─────────────────────────
export async function verifyRun({ runReceipt, stepReceipts }) {
  const stepResults = [];
  let brokenAt = null;
  let prevHash = null;
  for (let i = 0; i < stepReceipts.length; i++) {
    const r = stepReceipts[i];
    const recomputed = await executionHash(r.policy_parameters, r.output_payload);
    const hashOk = recomputed === r.execution_hash;
    const linkOk = i === 0
      ? (r.policy_parameters.prev_step_receipt_digest == null)
      : (r.policy_parameters.prev_step_receipt_digest === prevHash);
    const ok = hashOk && linkOk;
    if (!ok && brokenAt === null) brokenAt = i;
    stepResults.push({ index: i, step_id: r.policy_parameters.step_id, hash_ok: hashOk, link_ok: linkOk, ok, recomputed_hash: recomputed, stored_hash: r.execution_hash });
    prevHash = r.execution_hash;
  }
  const leaves = stepReceipts.map((r) => r.execution_hash);
  const recomputedRoot = await merkleRoot(leaves);
  const storedRoot = runReceipt?.output_payload?.merkle_root ?? null;
  const merkleOk = recomputedRoot === storedRoot;
  const runRecomputed = runReceipt ? await executionHash(runReceipt.policy_parameters, runReceipt.output_payload) : null;
  const runHashOk = runReceipt ? runRecomputed === runReceipt.execution_hash : false;
  const chainOk = stepResults.every((s) => s.ok);
  return {
    valid: chainOk && merkleOk && runHashOk,
    chain_ok: chainOk,
    merkle_ok: merkleOk,
    run_hash_ok: runHashOk,
    broken_at: brokenAt,
    recomputed_root: recomputedRoot,
    stored_root: storedRoot,
    steps: stepResults,
  };
}
