// vpsf-claim-algebra.mjs — VPSF Claim Algebra structural verification primitives.
// Implements draft-vauban-x402-vpsf-algebra-01 (pinned research/clause-snapshots/
// draft-vauban-x402-vpsf-algebra-01.txt): the four Payment Claim types
// (PaymentIntent, SettlementReceipt, RefundClaim, DelegationGrant, §3.2) and the
// five composition operators (Conjunction ∧, Implication →, Aggregation ⊕,
// Selective Disclosure ▷, Revocation ¬, §4). Sibling to c2sp-tlog-verify.mjs:
// one canonical implementation, imported (never duplicated) by the browser tool
// that ports it inline (CONTRACT §1.1 forbids a self-contained page from
// importing a module at runtime).
//
// JCS canonicalization is NEVER reimplemented here — cgCanon/assertIJson are
// imported verbatim from _hash.mjs, the repo's single canonicalization SSOT
// (CLAUDE.md: "there is exactly one correct canonicalization ... it lives in
// _hash.mjs"). This module's own contribution is only the VPSF composite
// preimage shapes (§4.1.3/4.2.3/4.3.3/4.4.3/4.5.3) and the operator rules that
// govern them (§4, §5) — never a second canonicalizer.
//
// This module implements STRUCTURAL verification only: preimage well-formedness,
// hash recomputation, and the operator/subject rules stated in the draft. It
// does NOT verify the cryptographic `evidence` field of a component Claim (STARK
// proof, signature) — that is explicitly out of scope for a VPSF-algebra
// verifier per §6.2 ("Neither property is required by this document for
// conformance") and stated again on the tool page itself.
//
// Runs unchanged in Node 18+, Workers, and browsers (globalThis.crypto.subtle,
// atob/btoa — no Buffer, no node:crypto import).

import { cgCanon, assertIJson } from './_hash.mjs';

export const CLAIM_TYPES = Object.freeze(['PaymentIntent', 'SettlementReceipt', 'RefundClaim', 'DelegationGrant']);
export const OPERATORS = Object.freeze(['conjunction', 'implication', 'aggregation', 'selective_disclosure', 'revocation']);

// §2.1 "JCS Preimage Hash": SHA-256 digest of the UTF-8 encoding of the JCS
// canonical form of a preimage object, encoded as "sha256:<lowercase-hex-64>".
export async function jcsPreimageHash(obj) {
  assertIJson(obj);
  const bytes = new TextEncoder().encode(JSON.stringify(cgCanon(obj)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// §2.1 Subject: byte-identical after NFC normalization.
export function sameSubject(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a).normalize('NFC') === String(b).normalize('NFC');
}

// ---------------------------------------------------------------------------
// §3.2 Payment Claim type structural checks. The six-tuple abstract schema is
// (subject, predicate, object, proof, context, metadata) per §3.1; the pinned
// conformance vector schemas (schemas/delegation-grant.schema.json,
// schemas/settlement-receipt.schema.json) give a concrete six-element shape
// (subject, predicate, evidence, temporal_frame, revelation_mask, anchor) for
// DelegationGrant and SettlementReceipt specifically. PaymentIntent and
// RefundClaim have no pinned schema (only [LIFECYCLE-FSM] defines them
// normatively, and that draft is not in this row's pinned snapshot set) — this
// module checks only what §2.1/§3.2 state about them directly: a subject field,
// and (for RefundClaim) a linkage to the SettlementReceipt it reverses.
// ---------------------------------------------------------------------------

const CLAIM_TYPE_SUBJECT_ROLE = Object.freeze({
  PaymentIntent: 'payer',
  SettlementReceipt: 'payer',
  RefundClaim: 'merchant',
  DelegationGrant: 'delegator',
});

export function extractSubjectValue(claim) {
  const s = claim && claim.subject;
  if (s === undefined || s === null) return null;
  if (typeof s === 'object') return s.value !== undefined ? s.value : JSON.stringify(cgCanon(s));
  return s;
}

// Returns { ok, errors[] }. Never throws — a structurally invalid claim is a
// verifier finding, not a script error.
export function checkClaimStructure(claim, claimType) {
  const errors = [];
  if (!CLAIM_TYPES.includes(claimType)) {
    errors.push(`unknown claim_type "${claimType}" — must be one of ${CLAIM_TYPES.join(', ')} (§3.2)`);
    return { ok: false, errors };
  }
  if (!claim || typeof claim !== 'object') { errors.push('claim is not a JSON object'); return { ok: false, errors }; }
  if (extractSubjectValue(claim) === null) {
    errors.push(`missing "subject" field — §2.1 defines Subject as the identity field anchoring every Claim; for ${claimType} it is the ${CLAIM_TYPE_SUBJECT_ROLE[claimType]}`);
  }
  if (claim.predicate === undefined) {
    errors.push('missing "predicate" field — §3.1 six-tuple requires a predicate (lifecycle state or derived predicate)');
  }
  if (claimType === 'RefundClaim') {
    const linked = claim.predicate && (claim.predicate.settlement_ref || claim.predicate.reversed_claim_hash);
    if (!linked) errors.push('RefundClaim carries no linkage to the SettlementReceipt it reverses (§3.2: "Carries a cryptographic linkage to the SettlementReceipt being reversed")');
  }
  if (claimType === 'DelegationGrant' && claim.predicate && claim.predicate.kind === 'DelegationAuth') {
    for (const k of ['delegate_pseudonym', 'cap_per_tx', 'cap_per_period', 'period_seconds']) {
      if (claim.predicate[k] === undefined) errors.push(`DelegationGrant.predicate missing required field "${k}" (schemas/delegation-grant.schema.json)`);
    }
  }
  if (claimType === 'SettlementReceipt' && claim.predicate && claim.predicate.kind === 'Settlement') {
    for (const k of ['amount', 'currency', 'nullifier', 'intent_ref']) {
      if (claim.predicate[k] === undefined) errors.push(`SettlementReceipt.predicate missing required field "${k}" (schemas/settlement-receipt.schema.json)`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// §4 Composite preimage builders — one per operator, exactly the JCS Preimage
// Rule stated in each operator's own subsection. `issued_at` and (for
// Revocation) `revoked_at` are integer Unix timestamps the caller supplies;
// this module never reads the clock (SO #0 CHAINPOINT GUARD — pure functions).
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {string} opts.leftHash
 * @param {string} opts.rightHash
 * @param {number} opts.issuedAt
 * @param {{left_subject: string, right_subject: string}} [opts.subjectDisclosure]
 */
export function conjunctionPreimage({ leftHash, rightHash, issuedAt, subjectDisclosure }) {
  const obj = { operator: 'conjunction', left: leftHash, right: rightHash, issued_at: issuedAt };
  if (subjectDisclosure) obj.subject_disclosure = subjectDisclosure;
  return obj;
}

/**
 * @param {object} opts
 * @param {string} opts.antecedentHash
 * @param {string} opts.consequentHash
 * @param {number} opts.issuedAt
 * @param {{left_subject: string, right_subject: string}} [opts.subjectDisclosure]
 */
export function implicationPreimage({ antecedentHash, consequentHash, issuedAt, subjectDisclosure }) {
  const obj = { operator: 'implication', antecedent: antecedentHash, consequent: consequentHash, issued_at: issuedAt };
  if (subjectDisclosure) obj.subject_disclosure = subjectDisclosure;
  return obj;
}

// §4.3.3: operands MUST be sorted lexicographically by hash value before
// serialisation — the caller passes them in that order; this module does not
// silently re-sort (a verifier "MUST validate the preimage structure as
// presented" per §4.3.2, never regroup or reorder operands itself).
/**
 * @param {object} opts
 * @param {string[]} opts.operandHashes
 * @param {string} opts.currency
 * @param {string} opts.totalAmount
 * @param {number} opts.issuedAt
 * @param {string[]} [opts.subjects]
 */
export function aggregationPreimage({ operandHashes, currency, totalAmount, issuedAt, subjects }) {
  const obj = {
    operator: 'aggregation', operands: operandHashes, currency,
    total_amount: totalAmount, operand_count: operandHashes.length, issued_at: issuedAt,
  };
  if (subjects) obj.subjects = subjects;
  return obj;
}

export function selectiveDisclosurePreimage({ sourceHash, disclosedFields, withheldCommitment, issuedAt }) {
  return { operator: 'selective_disclosure', source_hash: sourceHash, disclosed_fields: disclosedFields, withheld_commitment: withheldCommitment, issued_at: issuedAt };
}

export function revocationPreimage({ targetHash, reason, revokedAt, issuedAt }) {
  return { operator: 'revocation', target_hash: targetHash, reason, revoked_at: revokedAt, issued_at: issuedAt };
}

// §4.4.3: withheld_commitment = SHA-256(UTF-8(JCS({withheld fields}))), where
// withheld fields = source claim's canonical preimage keys minus disclosed_fields keys.
export async function computeWithheldCommitment(sourceClaim, disclosedFields) {
  const withheld = {};
  for (const k of Object.keys(sourceClaim)) {
    if (!(k in disclosedFields)) withheld[k] = sourceClaim[k];
  }
  const hash = await jcsPreimageHash(withheld);
  return hash.replace(/^sha256:/, ''); // §4.4.3 stores the commitment as bare hex, not the "sha256:" prefixed form
}
