import { executionHash } from './_hash.mjs';

// art-655 — Publish Market Mark Head: pure structural gate over a §HEAD-1 head-commit publication
// event for a market's mark-price print stream, with an independently-recomputed head_hash.
//
// From DERIV-WORKFLOWS-BUILD-SPEC.md's mark/funding receipt-chain framing section (the derivatives mark/funding/settlement provenance-program
// addition). art-560-oracle-price-aggregation ("AT-06" in the source Autonity-workflows spec) already
// gives each aggregation call its own citable execution_hash and an optional prev_print_hash wiring
// that turns same-pair prints into a walkable chain. That chain has no SIGNED TIP: a reader asking
// "what is the current head of this market's mark-price stream" has to independently discover and
// order the prints. This node publishes each print as one entry in a SPEC.md §HEAD-1 head-commit
// stream (stream = "mark:<venue>:<pair>", root = that print's own execution_hash), so the stream gets
// a sequence-numbered, signer-continuous tip -- mirroring the sibling model-risk (art-649) and
// index/NAV-lineage §HEAD-1 sections, applied to a market's mark-price cadence instead of a model's
// revalidation cadence or a fund's daily NAV.
//
// HARD FENCE: this node NEVER accepts or handles private key material. The caller signs the
// head-commit object off-node (via chaingraph/kernels/_head.mjs's own buildHead/signHead) and
// separately runs its own Ed25519 verification (again via _head.mjs's verifyHeadProof/verifyChain,
// or the standard's own chaingraph/standard/head-commit.test.mjs harness) BEFORE calling this
// node -- signature_valid / chain_valid are the CALLER'S OWN verification claim, asserted and
// digested into this receipt, exactly like art-562's stage-reference citations (asserted, never
// independently re-derived by the citing node) and art-649's own identical fence. This node does NOT
// itself execute an Ed25519 verify: art-129-webbotauth-signature-verifier's own build note records
// that the real zkVM guest has no WebCrypto at all, and even kernel-vm.mjs's host-bridged
// crypto.subtle simulation used for the VM<->worker parity gate was measured (while building art-649)
// to return a DIFFERENT verify() boolean than the same call running under Node -- i.e. an in-kernel
// "verified" claim would not be reproducible across the environments this repo requires
// byte-identical output from. What THIS node independently recomputes is head_hash -- pure SHA-256
// digesting (via crypto.subtle.digest, confirmed byte-identical between worker and VM), never a
// caller-asserted value (SO #34): every function below (utf8ToBytes/cgCanon/jcsBytes/sha256Hex/
// securedHead/headHash) is copied VERBATIM from chaingraph/kernels/_head.mjs and _hash.mjs's cgCanon
// -- the SAME canonicalization, never a second one -- inlined rather than imported because every
// kernel in this tree runs unmodified inside kernel-vm.mjs's QuickJS sandbox for the mandatory
// VM<->worker parity gate, and that harness's ESM strip removes every import line except
// `{ executionHash } from './_hash.mjs'` (a hard, repo-wide invariant -- the art-476 FIX-2
// "inline, don't narrow the import" lesson, restated by art-649, restated again here). If
// _head.mjs's headHash/cgCanon algorithm ever changes, this copy must move with it -- there is no
// automated linkage, same as _detmath's inline-never-import convention.
//
// A head-file tip proves the signer's claimed mark-stream tip; it does NOT itself detect a signer
// publishing two conflicting mark heads for the same (stream, seq) elsewhere (needs the
// ocg-head-tlog@1 witness backing, a later WU per the parent spec) and it is NOT itself a
// staleness/gap-detection mechanism -- a stream that stops publishing new heads is silent, not
// flagged, exactly like art-649's revalidation-cadence caveat restated for a print cadence.

// ---- inlined from _head.mjs / _hash.mjs (verbatim algorithm, see note above; SHA-256 only) ----

// GUEST-BUILTIN-GATE-1: TextEncoder is absent in the zkVM guest and only polyfilled (not
// necessarily byte-identical) inside kernel-vm.mjs's sandbox -- use the validated pure-JS
// encoder (ART595-ART590-UTF8-FIX-1 shape) instead of `new TextEncoder()` anywhere below.
function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) { code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000; i++; }
      else code = 0xfffd;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(bytes);
}

// RFC 8785/JCS canonicalization -- byte-identical copy of _hash.mjs's cgCanon.
function cgCanon(v) {
  if (Array.isArray(v)) return v.map(cgCanon);
  if (v !== null && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {});
  return v;
}
const jcsBytes = (obj) => utf8ToBytes(JSON.stringify(cgCanon(obj)));
async function sha256Hex(bytes) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function securedHead(head) {
  const h = { ...head };
  delete h.proof;
  return h;
}
async function headHash(head) {
  return 'sha256:' + (await sha256Hex(jcsBytes(securedHead(head))));
}
// ---- end inlined _head.mjs / _hash.mjs primitives ----

const TOOL_ID = 'art-655-publish-market-mark-head';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'publish_market_mark_head',
  mandate_type: 'attestation_mandate', gpu: false,
};

const NOT_PROVEN = [
  { item: 'Signature / chain verification', detail: 'signature_valid and chain_valid are the CALLER\'s own verification claim (e.g. from running _head.mjs\'s verifyHeadProof/verifyChain, or chaingraph/standard/head-commit.test.mjs, off-node before calling this node), asserted and digested into this receipt -- exactly like art-562\'s stage-reference citations and art-649\'s identical fence. This node does not itself execute Ed25519 verification (the real zkVM guest has no WebCrypto at all; an in-kernel verify() result would not be reproducible across this repo\'s required execution environments).' },
  { item: 'Equivocation detection', detail: 'A head-file tip proves the signer\'s claimed mark-stream tip at this seq; it does not itself detect the same signer publishing a different, conflicting head for the same (stream, seq) elsewhere. That needs the ocg-head-tlog@1 witness backing (a later WU), not this node.' },
  { item: 'Print continuity / staleness detection', detail: 'This node publishes one head-commit event per mark print made citable in order. Whether a market\'s mark stream has gone stale (no new print within its expected cadence) or has silently skipped a print is not evaluated here -- this stream only makes the prints that WERE published citable in sequence order.' },
  { item: 'Root-artifact authenticity', detail: 'root is a caller-supplied execution_hash citing the print\'s own art-560-oracle-price-aggregation artifact, asserted and digested into this receipt. This node performs no lookup against a live artifact store and does not itself verify that the cited hash corresponds to a real, still-valid upstream print, nor does it re-run or check the aggregation math that produced it.' },
  { item: 'Venue / market-data attestation', detail: 'Per the parent spec\'s positioning line, a venue platform attests that an order filled, a margin call fired, or a funding payment transferred -- it does not attest the arithmetic that determined the number. This receipt evidences one head-commit publication event over an already-computed mark print; it makes no claim under CFTC, SEC, or any venue\'s own market-data recordkeeping obligations, and has no bearing on whether the underlying oracle submissions were themselves accurate (that is art-560-oracle-price-aggregation\'s own declared scope, not this node\'s).' },
];

function s(v) { return String(v == null ? '' : v).trim(); }
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// Structural-only mirror of _head.mjs's own buildHead() validation.
function validateHeadShape(head, label) {
  if (!head || typeof head !== 'object') return `${label} is required.`;
  if (typeof head.stream !== 'string' || !head.stream) return `${label}.stream is required.`;
  if (typeof head.signer !== 'string' || !head.signer.startsWith('did:key:')) return `${label}.signer must be a did:key.`;
  if (!Number.isInteger(head.seq) || head.seq < 0) return `${label}.seq must be a non-negative integer.`;
  if (head.prev_head_hash !== null && !(typeof head.prev_head_hash === 'string' && SHA256_RE.test(head.prev_head_hash))) return `${label}.prev_head_hash must be null (genesis) or a "sha256:"-prefixed digest.`;
  if (typeof head.root !== 'string' || !SHA256_RE.test(head.root)) return `${label}.root must be a "sha256:"-prefixed digest.`;
  if (typeof head.timestamp !== 'string' || !ISO_TS_RE.test(head.timestamp)) return `${label}.timestamp must be an RFC3339 timestamp.`;
  if (head.rotates_to !== undefined && !(typeof head.rotates_to === 'string' && head.rotates_to.startsWith('did:key:'))) return `${label}.rotates_to, when present, must be a did:key.`;
  const proof = head.proof;
  if (!proof || typeof proof !== 'object') return `${label}.proof is required (the head must already be signed).`;
  if (proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-jcs-2022') return `${label}.proof must carry type "DataIntegrityProof" and cryptosuite "eddsa-jcs-2022".`;
  if (proof.proofPurpose !== 'assertionMethod') return `${label}.proof.proofPurpose must be "assertionMethod".`;
  if (typeof proof.proofValue !== 'string' || proof.proofValue[0] !== 'z') return `${label}.proof.proofValue is required (multibase, base58btc).`;
  if (proof.verificationMethod !== head.signer) return `${label}.proof.verificationMethod must equal ${label}.signer (a head is self-attesting).`;
  return null;
}

// Structural-only mirror of the caller's verification-claim shape. Never re-derived here.
function validateVerificationClaim(claim, label) {
  if (!claim || typeof claim !== 'object') return `${label} is required (the caller's own verification result).`;
  if (typeof claim.verified !== 'boolean') return `${label}.verified must be a boolean.`;
  if (typeof claim.verified_by !== 'string' || !claim.verified_by) return `${label}.verified_by is required (free text naming the tool/method used to verify).`;
  return null;
}

/**
 * compute(pp) — pure structural gate over an already-signed head-commit publication event AND
 * the caller's own, already-run signature/chain verification claim.
 * pp: {
 *   head: { head_version?, stream, signer, seq, prev_head_hash, root, root_cid?, timestamp, rotates_to?, proof },
 *   signature_verification: { verified: boolean, verified_by: string },
 *   prior_head?: { ...same shape as head... },
 *   chain_verification?: { verified: boolean, verified_by: string, errors?: string[] },
 * }
 * head.stream is expected to follow the "mark:<venue>:<pair>" convention (DERIV-WORKFLOWS-BUILD-SPEC.md
 * mark/funding receipt-chain framing section) but is validated only as a non-empty string -- the same convention-not-schema choice art-649
 * made for its own "model-risk-head:<MODEL-ID>" streams, since a hard-enforced prefix would make this
 * node reject a legitimately-differently-named stream rather than merely fail to document it.
 * NEVER accepts a private key. head_hash is independently recomputed in buildArtifact() below
 * (pure SHA-256, never asserted here); signature_valid / chain_valid are the CALLER's claim, echoed
 * verbatim, never re-derived.
 */
export function compute(pp) {
  pp = pp || {};
  let structural_error = validateHeadShape(pp.head, 'head');
  if (!structural_error) {
    const sigError = validateVerificationClaim(pp.signature_verification, 'signature_verification');
    if (sigError) structural_error = sigError;
  }
  if (!structural_error && pp.head.seq > 0 && pp.prior_head !== undefined) {
    const priorError = validateHeadShape(pp.prior_head, 'prior_head');
    if (priorError) structural_error = priorError;
    else {
      const chainError = validateVerificationClaim(pp.chain_verification, 'chain_verification');
      if (chainError) structural_error = chainError;
    }
  }
  if (!structural_error && pp.head.seq === 0 && pp.head.prev_head_hash !== null) {
    structural_error = 'head.seq is 0 (genesis) but head.prev_head_hash is not null.';
  }
  if (!structural_error && pp.head.seq > 0 && pp.head.prev_head_hash === null) {
    structural_error = 'head.seq is greater than 0 but head.prev_head_hash is null (only a genesis head may omit prev_head_hash).';
  }

  const is_genesis = !structural_error && pp.head.seq === 0;
  const chain_claim_present = !structural_error && pp.head.seq > 0 && pp.prior_head !== undefined;

  const signature_valid = structural_error ? null : pp.signature_verification.verified;
  const signature_verified_by = structural_error ? null : pp.signature_verification.verified_by;
  const chain_valid = chain_claim_present ? pp.chain_verification.verified : null;
  const chain_verified_by = chain_claim_present ? pp.chain_verification.verified_by : null;
  const chain_errors = chain_claim_present && Array.isArray(pp.chain_verification.errors) ? pp.chain_verification.errors : [];

  const compliance_flags = [];
  if (structural_error) {
    compliance_flags.push('MMH_HEAD_STRUCTURAL_ERROR');
  } else {
    compliance_flags.push('MMH_HEAD_STRUCTURE_VALID');
    compliance_flags.push(is_genesis ? 'MMH_HEAD_GENESIS' : 'MMH_HEAD_CHAINED');
    compliance_flags.push(signature_valid ? 'MMH_HEAD_SIGNATURE_CLAIMED_VALID' : 'MMH_HEAD_SIGNATURE_CLAIMED_INVALID');
    if (pp.head.rotates_to) compliance_flags.push('MMH_HEAD_ROTATION_ANNOUNCED');
    if (chain_claim_present) compliance_flags.push(chain_valid ? 'MMH_HEAD_CHAIN_CLAIMED_VALID' : 'MMH_HEAD_CHAIN_CLAIMED_INVALID');
  }

  const output_payload = {
    stream: structural_error ? null : pp.head.stream,
    signer: structural_error ? null : pp.head.signer,
    seq: structural_error ? null : pp.head.seq,
    prev_head_hash: structural_error ? null : pp.head.prev_head_hash,
    root: structural_error ? null : pp.head.root,
    timestamp: structural_error ? null : pp.head.timestamp,
    rotates_to: (pp.head && pp.head.rotates_to) ?? null,
    structural_error,
    is_genesis,
    // filled in by buildArtifact() -- independently recomputed, never asserted here:
    head_hash: null,
    signature_valid,
    signature_verified_by,
    chain_valid,
    chain_verified_by,
    chain_errors,
    // FLAG-MIRROR-DOCTRINE (AUTHORING-STANDARD.md, flag-mirror section): compliance_flags carries
    // MMH_HEAD_STRUCTURAL_ERROR conditionally (it is absent on a structurally valid head) and
    // top-level compliance_flags is outside the gate-pointer resolution scope SPEC.md's chain-gate
    // section defines, so a caller-side gate can never route on it directly. Mirror the one caveat
    // this node itself determines (structural validity) into a closed-list member a gate CAN route on.
    errors: structural_error ? [structural_error] : [],
    not_proven: NOT_PROVEN,
    fence: 'This node never accepts or handles private key material and never itself runs an Ed25519 verify. signature_valid/chain_valid are the CALLER\'s own verification claim, asserted and digested into this receipt, never independently re-derived. head_hash is the one field this node DOES independently recompute (pure SHA-256 over the caller-supplied head, never trusted as a caller-asserted value).',
    regulatory_framework: 'SPEC.md §HEAD-1 (this estate\'s own head-commit primitive, PROV-HEAD-1, DONE/merged) applied to a market\'s mark-price print stream (DERIV-WORKFLOWS-BUILD-SPEC.md §4); not itself a CFTC, SEC, or venue market-data attestation requirement.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0, supersedes = undefined } = {}) {
  const { output_payload, compliance_flags } = compute(pp);

  if (!output_payload.structural_error) {
    try {
      output_payload.head_hash = await headHash(pp.head);
    } catch (e) {
      output_payload.structural_error = `head_hash recomputation threw: ${s(e && e.message)}`;
      compliance_flags.length = 0;
      compliance_flags.push('MMH_HEAD_STRUCTURAL_ERROR');
    }
  }

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
