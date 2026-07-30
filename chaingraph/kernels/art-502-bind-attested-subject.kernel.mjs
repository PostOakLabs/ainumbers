/**
 * art-502-bind-attested-subject.kernel.mjs
 * Assurance Waves programme (HA-ATTESTED-SUBJECT-BUILD-SPEC.md §1, HA-ATTESTED-1) —
 * the SPEC.md §27.4 ATTESTED-ARTIFACT subject binder.
 *
 * WHAT THIS IS FOR. §27 evidences the named-human preparer/reviewer/approver act over a
 * sealed artifact. Until §27.4's non-node subject class, the only subject a §27 approval
 * record could name was the output of a §12 kernel node. Most reporting artifacts in
 * practice have no chain -- a spreadsheet, a reconciliation export, a report builder's PDF.
 * This kernel computes the subject identifier for exactly that case: the sealed output of a
 * PINNED NON-OCG PRODUCER that we did not compute.
 *
 * THE PREIMAGE IS FIXED EXACTLY AND EXHAUSTIVELY (SPEC.md §27.4):
 *
 *   execution_hash = sha256( JCS( { tool_ref, inputs_digest, artifact } ) )
 *
 *   tool_ref = { tool_id, tool_version, entry, manifest_digest }
 *   artifact = { content_type, content_digest }
 *
 * THREE MEMBERS. NO FOURTH. No wall clock, no run identifier, no host or session state may
 * enter it -- the value MUST be recomputable offline by a verifier that never executed the
 * producer. This kernel therefore CONSTRUCTS the preimage from a fixed key list rather than
 * spreading caller input: a caller cannot smuggle a fourth member in, and an omitted member
 * becomes an explicit null that the verifier can see, never a silently absent key.
 *
 * `manifest_digest` is the chainless analogue of the §17 `kernel_digest`. It is what makes
 * the PRODUCER tamper-evident, not merely its output. Its absence is FLAGGED, never assumed.
 *
 * THE STATED LIMIT IS PART OF THE PRODUCT (SPEC.md §27.4, normative). An attested-artifact
 * subject carries NO §18 compute proof and NO §16/§17 re-execution claim. It evidences
 * producer pinning, input binding and content integrity -- NEVER that the producer's
 * arithmetic is correct. Such a subject MUST NOT be reported as `replay_verified`; this
 * kernel OMITS that member entirely rather than emitting it `false`, because omission is the
 * honest encoding of "no replay was attempted" while `false` reads as "a replay was attempted
 * and disagreed". The `no_arithmetic_claim` note carries the limit in the payload itself so a
 * consumer that only ever sees the artifact still sees the limit.
 *
 * DIGEST STRINGS ARE NEVER REWRITTEN. A malformed digest is reported (`producer_pinned:false`
 * plus a named flag) and still hashed VERBATIM as declared. Silently normalising a caller's
 * digest would make two callers who wrote the same value differently collide onto one
 * subject_hash, which is precisely the tamper-evidence this class exists to provide.
 *
 * NO CLOCK-DERIVED GOVERNANCE DATES (HA-ATTESTED-SUBJECT-BUILD-SPEC.md §5). This kernel emits
 * no `last_reviewed` and computes no `valid_until` from an export timestamp. It reads no clock
 * at all: every value in output_payload is a function of policy_parameters alone.
 *
 * SYNCHRONOUS PURE-JS SHA-256 (the art-476 FIX-2 lesson, board/RIDER-KERNEL.md). compute() must
 * not await a crypto digest: the §18 zkVM guest has no crypto.subtle and no TextEncoder. The
 * _sha256/_utf8Bytes core below is the one proven live under ImageID a1a0bc89 and reused
 * verbatim from art-194-digest-manifest-builder. The artifact's OWN §4 execution_hash still
 * goes through the single canonical path (_hash.mjs executionHash) in buildArtifact().
 *
 * ONE CANON ONLY. `_cgCanon` here is the byte-identical inline twin of `_hash.mjs` cgCanon
 * (the guest cannot import), never a second canonicalisation scheme.
 *
 * PII: identifiers, media types and digests only. No document content of any kind ever enters
 * this kernel -- a content_digest is passed in already computed. Fixtures are SYNTHETIC
 * (CONTRACT §1.3).
 *
 * Spec: SPEC.md §27.4 (non-node gate subjects) + §27.2/§27.6 · HA-ATTESTED-SUBJECT-BUILD-SPEC.md §1.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-502-bind-attested-subject';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'bind_attested_subject', mandate_type: 'compliance_control', gpu: false };

// Byte-identical inline twin of _hash.mjs cgCanon (RFC 8785 / JCS key ordering). The §18 guest
// cannot import, so the canon is inlined -- it is the SAME scheme, never a second one.
const _cgCanon = (v) => Array.isArray(v) ? v.map(_cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = _cgCanon(v[k]), o), {}) : v;

// Pure-JS SHA-256 (sync). Byte-identical to WebCrypto, but runs in the zkVM guest which has no
// crypto.subtle and no TextEncoder. Reused verbatim from art-194-digest-manifest-builder (proven
// live under ImageID a1a0bc89); _utf8Bytes reproduces WebCrypto's UTF-8 byte stream incl. surrogates.
function _utf8Bytes(str) {
  const s = String(str), out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = s.charCodeAt(++i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return new Uint8Array(out);
}
function _sha256(bytes) {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x,n) => (x>>>n)|(x<<(32-n));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j=cs+i*4; W[i]=(padded[j]<<24)|(padded[j+1]<<16)|(padded[j+2]<<8)|padded[j+3]; }
    for (let i = 16; i < 64; i++) {
      const s0=rotr(W[i-15],7)^rotr(W[i-15],18)^(W[i-15]>>>3);
      const s1=rotr(W[i-2],17)^rotr(W[i-2],19)^(W[i-2]>>>10);
      W[i]=(W[i-16]+s0+W[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h]=[h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1=rotr(e,6)^rotr(e,11)^rotr(e,25), ch=(e&f)^(~e&g);
      const t1=(h+S1+ch+K[i]+W[i])>>>0;
      const S0=rotr(a,2)^rotr(a,13)^rotr(a,22), maj=(a&b)^(a&c)^(b&c);
      const t2=(S0+maj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;
    h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
  }
  const r=new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v,i)=>{const j=i*4;r[j]=v>>>24;r[j+1]=(v>>>16)&0xff;r[j+2]=(v>>>8)&0xff;r[j+3]=v&0xff;});
  return r;
}
function sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(String(str)))).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// JCS digest of an arbitrary JSON value, through the one canon. Bare lowercase hex.
function jcsDigestHex(value) { return sha256Hex(JSON.stringify(_cgCanon(value))); }

const SHA256REF = /^sha256:[0-9a-f]{64}$/;
function str(v) { return typeof v === 'string' ? v.trim() : ''; }
function strOrNull(v) { const s = str(v); return s === '' ? null : s; }

export function compute(pp) {
  pp = pp || {};
  const tr = pp.tool_ref && typeof pp.tool_ref === 'object' ? pp.tool_ref : {};
  const af = pp.artifact && typeof pp.artifact === 'object' ? pp.artifact : {};

  // ── THE PREIMAGE — constructed from a FIXED key list, never spread from caller input. ──────────
  // Three members, exhaustively. A caller-supplied extra key on tool_ref/artifact/pp cannot reach
  // the preimage because nothing here copies unknown keys; a missing member becomes an explicit
  // null, which a verifier can see, rather than an absent key it cannot distinguish from a typo.
  const tool_ref = {
    tool_id: strOrNull(tr.tool_id),
    tool_version: strOrNull(tr.tool_version),
    entry: strOrNull(tr.entry),
    manifest_digest: strOrNull(tr.manifest_digest),
  };
  const artifact = {
    content_type: strOrNull(af.content_type),
    content_digest: strOrNull(af.content_digest),
  };

  // inputs_digest: DERIVED from the producer's inputs when the caller supplies them, otherwise the
  // caller's own declared digest (the case where the inputs are private and only their digest is
  // shareable). The source is reported in output_payload but is NOT a preimage member -- the same
  // three members hash the same way whichever route produced the digest.
  const hasInputs = pp.producer_inputs !== undefined && pp.producer_inputs !== null;
  const inputs_digest = hasInputs
    ? `sha256:${jcsDigestHex(pp.producer_inputs)}`
    : strOrNull(pp.inputs_digest);
  const inputs_digest_source = hasInputs ? 'derived' : (inputs_digest ? 'declared' : 'absent');

  const subject_preimage = { tool_ref, inputs_digest, artifact };
  const subject_hash = `sha256:${jcsDigestHex(subject_preimage)}`;

  // ── Producer pinning + well-formedness. Findings are NAMED; nothing is silently repaired. ─────
  const findings = [];
  const rationale = [];

  if (!tool_ref.manifest_digest) findings.push({ code: 'MANIFEST_DIGEST_ABSENT', field: 'tool_ref.manifest_digest', detail: 'The producer is NOT pinned: manifest_digest is the chainless analogue of the SPEC.md §17 kernel_digest and is what makes the producer tamper-evident, not merely its output.' });
  else if (!SHA256REF.test(tool_ref.manifest_digest)) findings.push({ code: 'MANIFEST_DIGEST_MALFORMED', field: 'tool_ref.manifest_digest', detail: 'Expected a "sha256:" prefix followed by 64 lowercase hex characters. The value was hashed verbatim as declared and was NOT rewritten.' });

  if (!artifact.content_digest) findings.push({ code: 'CONTENT_DIGEST_ABSENT', field: 'artifact.content_digest', detail: 'Without a content digest the subject identifies no sealed output.' });
  else if (!SHA256REF.test(artifact.content_digest)) findings.push({ code: 'CONTENT_DIGEST_MALFORMED', field: 'artifact.content_digest', detail: 'Expected a "sha256:" prefix followed by 64 lowercase hex characters. The value was hashed verbatim as declared and was NOT rewritten.' });

  if (!inputs_digest) findings.push({ code: 'INPUTS_DIGEST_ABSENT', field: 'inputs_digest', detail: 'Supply producer_inputs (the digest is then derived through the one canonical JCS path) or declare inputs_digest directly.' });
  else if (!SHA256REF.test(inputs_digest)) findings.push({ code: 'INPUTS_DIGEST_MALFORMED', field: 'inputs_digest', detail: 'Expected a "sha256:" prefix followed by 64 lowercase hex characters. The value was hashed verbatim as declared and was NOT rewritten.' });

  if (!tool_ref.tool_id) findings.push({ code: 'TOOL_ID_ABSENT', field: 'tool_ref.tool_id', detail: 'The producer is unnamed, so the subject cannot be traced back to what produced it.' });
  if (!tool_ref.tool_version) findings.push({ code: 'TOOL_VERSION_ABSENT', field: 'tool_ref.tool_version', detail: 'Without a producer version the manifest digest cannot be read against a released build.' });
  if (!tool_ref.entry) findings.push({ code: 'ENTRY_ABSENT', field: 'tool_ref.entry', detail: 'entry names which callable of the producer sealed this output.' });
  if (!artifact.content_type) findings.push({ code: 'CONTENT_TYPE_ABSENT', field: 'artifact.content_type', detail: 'The media type of the sealed output is unstated.' });

  const producer_pinned = !!tool_ref.manifest_digest && SHA256REF.test(tool_ref.manifest_digest);
  const binding_complete = findings.length === 0;

  rationale.push('The subject identifier is sha256 over the JCS canonicalisation of exactly three members: tool_ref, inputs_digest and artifact. No wall clock, no run identifier and no host or session state enters it, so a verifier that never executed the producer recomputes the same value offline from subject_preimage alone.');
  rationale.push(producer_pinned
    ? 'The producer is pinned: tool_ref.manifest_digest is present and well formed, so a changed producer build yields a different subject identifier.'
    : 'The producer is NOT pinned. Without a well-formed tool_ref.manifest_digest the binding covers the output but not the thing that made it.');
  rationale.push(inputs_digest_source === 'derived'
    ? 'inputs_digest was derived here from the supplied producer inputs through the one canonical JCS path.'
    : inputs_digest_source === 'declared'
      ? 'inputs_digest was declared by the caller rather than derived, which is the correct route when the producer inputs are private and only their digest is shareable.'
      : 'No inputs_digest was derived or declared, so the subject is not bound to any input set.');
  rationale.push('This is a subject-identification result only. It evidences producer pinning, input binding and content integrity. It does NOT evidence that the producer\'s arithmetic is correct, and it is not a claim that any regulator has accepted the artifact.');

  const compliance_flags = [];
  compliance_flags.push(producer_pinned ? 'HA_ATTESTED_SUBJECT_PRODUCER_PINNED' : 'HA_ATTESTED_SUBJECT_PRODUCER_UNPINNED');
  compliance_flags.push(binding_complete ? 'HA_ATTESTED_SUBJECT_BINDING_COMPLETE' : 'HA_ATTESTED_SUBJECT_BINDING_INCOMPLETE');
  for (const f of findings) compliance_flags.push(`HA_ATTESTED_SUBJECT_${f.code}`);

  const output_payload = {
    subject_hash,
    subject_preimage,
    preimage_member_count: 3,
    inputs_digest_source,
    producer_pinned,
    binding_complete,
    findings,
    rationale,
    // §27.4 stated limit, carried in the payload so a consumer that only ever sees the artifact
    // still sees it. `replay_verified` is DELIBERATELY ABSENT -- not false. No replay was attempted.
    no_arithmetic_claim: 'An attested-artifact subject carries no §18 compute proof and no §16/§17 re-execution claim. It evidences producer pinning, input binding and content integrity, never that the producer\'s arithmetic is correct. This artifact deliberately omits replay_verified rather than setting it false, because no replay was attempted.',
    note: 'Computes the SPEC.md §27.4 attested-artifact subject identifier for the sealed output of a pinned non-OCG producer, on the one canonical hash path: sha256(JCS({tool_ref, inputs_digest, artifact})), three members exhaustively. Digest strings are hashed verbatim as declared and are never rewritten, so a malformed digest is reported rather than silently normalised. This tool identifies a subject so that separately signed §27 approval records can name it; it neither signs anything itself nor asserts that any filing requirement is met.',
  };

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
