// art-652-verify-receipt — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:85446228f22d4a193cc19d26eae1288b1c31eaca06f84f181ae878c72335bea3
// spec: research/EVIDENCE-ENVELOPE-V01-RATIFIED-2026-08-20.md (MCP-VERIFY-RECEIPT-TOOL-1)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-652-verify-receipt.proptest.mjs
//
// Checks: fixture-oracle gate (P0, includes the tamper matrix as golden vectors already —
// see the kernel's own fixtures for payload/signature/kid/prev-link tamper cases), totality
// over hostile malformed pp (P1 — never throws), determinism (P2 — identical pp twice
// produces byte-identical output_payload), and two metamorphic tamper properties built
// independently of the fixtures (P3: any single-character mutation to a signed field of a
// KNOWN-VALID receipt must flip valid:true -> false with SIGNATURE_INVALID in failed_codes;
// P4: substituting signatures[0].kid with a syntactically-valid but different did:key must
// produce KID_NOT_RESOLVABLE without ever reaching the signature-verify step).
//
// MUTATION-HEAL-ART652 adds P5-P8: fresh VALID receipts minted by an independent
// node:crypto Ed25519 signer over a corpus of preimage shapes (sha256 block boundaries,
// astral/lone-surrogate UTF-16, JSON escapes, unprotected/signatures stripping,
// chain-link recomputation against an independent sha256 hex, and a
// malformed-signature-material matrix) — killing crypto-internals survivors that the
// 8-vector fixture oracle alone leaves alive.

import { compute } from '../art-652-verify-receipt.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pickNasty } from './_pbt-common.mjs';
import { createHash, createPrivateKey, createPublicKey, sign as cryptoSign } from 'node:crypto';

const KERNEL_ID = 'art-652-verify-receipt';

// A known-good, independently-fixture-verified receipt — reused from the kernel's own golden
// vectors (genesis-receipt-verifies) so P3/P4 mutate real signed bytes rather than fabricating
// a fresh keypair inside this floor.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));
const GOOD_RECEIPT = FIXTURES.vectors.find((v) => v.name === 'genesis-receipt-verifies').policy_parameters.receipt;

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

// ---------- P1: totality — compute() never throws on hostile/malformed pp ----------
function checkTotalityNeverThrows() {
  const rng = mulberry32(652);
  const shapes = [
    undefined, null, {}, { receipt: null }, { receipt: {} }, { receipt: [] },
    { receipt: 'not-an-object' }, { receipt: 42 }, { receipt: { schema: 123 } },
    { receipt: { signatures: 'not-an-array' } }, { receipt: { signatures: [null, undefined, 42] } },
    { receipt: { signatures: [{ alg: 'EdDSA', kid: 123, value: {} }] } },
    { receipt: GOOD_RECEIPT, previous_receipt: 'not-an-object' },
    { receipt: GOOD_RECEIPT, previous_receipt: null },
  ];
  for (let i = 0; i < 20; i++) shapes.push({ receipt: { ...deepClone(GOOD_RECEIPT), extensions: pickNasty(rng) } });
  let checked = 0, violations = 0;
  for (const pp of shapes) {
    checked++;
    try {
      const { output_payload } = compute(pp);
      if (typeof output_payload.valid !== 'boolean') violations++;
    } catch {
      violations++; // compute() must never throw — every hostile shape resolves to a verdict
    }
  }
  return { name: 'totality_never_throws', checked, violations };
}

// ---------- P2: determinism — same pp twice -> byte-identical output_payload ----------
function checkDeterminism() {
  const samples = [
    { receipt: GOOD_RECEIPT },
    { receipt: GOOD_RECEIPT, previous_receipt: GOOD_RECEIPT },
    {},
  ];
  let checked = 0, violations = 0;
  for (const pp of samples) {
    checked++;
    const a = JSON.stringify(compute(deepClone(pp)).output_payload);
    const b = JSON.stringify(compute(deepClone(pp)).output_payload);
    if (a !== b) violations++;
  }
  return { name: 'determinism', checked, violations };
}

// ---------- P3: any single-char mutation to a signed field flips valid -> false / SIGNATURE_INVALID ----------
function checkPayloadTamperBreaksSignature() {
  // issuer_id deliberately excluded: mutating it changes signatures[].kid resolvability (a
  // different, also-correct fail code — KID_NOT_RESOLVABLE, exercised by P4) before the
  // signature is ever checked, so it is not a like-for-like SIGNATURE_INVALID case.
  const SIGNED_STRING_FIELDS = ['receipt_id', 'event_type', 'source_adapter', 'issued_at', 'result_status', 'input_hash', 'policy_digest'];
  let checked = 0, violations = 0;
  for (const field of SIGNED_STRING_FIELDS) {
    checked++;
    const tampered = deepClone(GOOD_RECEIPT);
    const orig = String(tampered[field]);
    tampered[field] = orig.slice(0, -1) + (orig.slice(-1) === 'a' ? 'b' : 'a');
    const { output_payload } = compute({ receipt: tampered });
    if (output_payload.valid !== false || !output_payload.failed_codes.includes('SIGNATURE_INVALID')) {
      violations++;
    }
  }
  return { name: 'payload_tamper_breaks_signature', checked, violations };
}

// ---------- P4: kid substitution is caught BEFORE signature verify, never a false SIGNATURE_VALID ----------
function checkKidSubstitutionNotResolvable() {
  const OTHER_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
  let checked = 1, violations = 0;
  const tampered = deepClone(GOOD_RECEIPT);
  tampered.signatures[0].kid = OTHER_DID;
  const { output_payload } = compute({ receipt: tampered });
  if (output_payload.valid !== false || !output_payload.failed_codes.includes('KID_NOT_RESOLVABLE')) {
    violations++;
  }
  return { name: 'kid_substitution_not_resolvable', checked, violations };
}

// ---------- P5-P8: INDEPENDENT-signer receipts (MUTATION-HEAL-ART652) ----------
// The fixture oracle pins exactly 8 golden vectors, all on ONE keypair and one ~340-byte
// preimage — mutants in the crypto internals (sha256/sha512 block handling, the ed25519
// verify path, utf8/base64url/base58 decoders, JCS canonicalization) survive because their
// behavior is identical on those 8 inputs alone. The checks below mint FRESH valid receipts
// with DETERMINISTIC Ed25519 keypairs generated by node:crypto (a second, independent
// implementation — same independence argument as the fixture oracle itself) over a corpus of
// preimage shapes chosen to walk the branch boundaries of those internals: sha256
// message-length boundaries, astral-plane and lone-surrogate UTF-16, JSON escapes,
// multi-signature receipts, unprotected{}/signatures[] stripping. Determinism: the keypairs
// derive from FIXED 32-byte seeds via a fixed PKCS#8 template — no randomness anywhere.

// NodeBuffer — the floor files carry no @types/node (SO #10), so the global `Buffer`
// type-checks as a narrow inferred shape; route every use through an any-typed alias.
const NodeBuffer = /** @type {any} */ (Buffer);
const ED25519_PKCS8_PREFIX = NodeBuffer.from('302e020100300506032b657004220420', 'hex');
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58Encode(bytes) {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let s = '';
  while (num > 0n) { s = B58_ALPHABET[Number(num % 58n)] + s; num /= 58n; }
  let z = 0;
  while (z < bytes.length && bytes[z] === 0) { z++; s = '1' + s; }
  return s;
}

// Deterministic Ed25519 keypair from a 32-byte seed (RFC 8032 secret-key storage form).
function ed25519FromSeed(seed) {
  const priv = createPrivateKey({ key: NodeBuffer.concat([ED25519_PKCS8_PREFIX, NodeBuffer.from(seed)]), format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(priv).export({ type: 'spki', format: 'der' });
  const rawPub = spki.subarray(spki.length - 32);
  // did:key z-form, multicodec 0xed01 prefix (same wire shape the kernel decodes).
  const did = 'did:key:z' + b58Encode(NodeBuffer.concat([NodeBuffer.from([0xed, 0x01]), rawPub]));
  return { priv, did };
}

const KEY_A = ed25519FromSeed([1, ...Array(31).fill(0xa5)]);
const KEY_B = ed25519FromSeed([2, ...Array(31).fill(0x5a)]);

// JCS of the signing preimage — mirrors the kernel's cgCanon contract (recursive key sort,
// minimal JSON) but implemented independently of the kernel's own canonicalizer.
function canonJson(v) {
  if (Array.isArray(v)) return v.map(canonJson);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = canonJson(v[k]);
    return o;
  }
  return v;
}
function sha256HexIndependent(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
/** @param {any} receipt */
function signingPreimage(receipt) {
  const { signatures, unprotected, ...rest } = receipt;
  void signatures; void unprotected;
  return NodeBuffer.from(JSON.stringify(canonJson(rest)), 'utf8');
}
// Chain-hash preimage: JCS INCLUDING signatures[], EXCLUDING unprotected{} (v0.1 delta #1).
/** @param {any} receipt */
function chainPreimage(receipt) {
  const { unprotected, ...rest } = receipt;
  void unprotected;
  return NodeBuffer.from(JSON.stringify(canonJson(rest)), 'utf8');
}
/** @param {any} receipt */
function signingDigest(receipt) {
  return createHash('sha256').update(signingPreimage(receipt)).digest();
}
/** @param {any} receipt */
function signReceipt(receipt, key = KEY_A) {
  const sig = cryptoSign(null, signingDigest(receipt), key.priv);
  receipt.signatures = [{ alg: 'EdDSA', kid: key.did, value: sig.toString('base64url').replace(/=+$/, '') }];
}
/** @returns {any} Deterministic unsigned receipt with any-shape overrides applied. */
function makeReceipt(overrides = {}) {
  return {
    schema: 'ainumbers.evidence.v0.1',
    receipt_id: 'r-heal',
    event_type: 'policy_decision',
    source_adapter: 'native-tool',
    issuer_id: KEY_A.did,
    issued_at: '2026-08-20T14:00:00Z',
    result_status: 'success',
    input_hash: null,
    links: [],
    extensions: {},
    ...overrides,
  };
}
function computeReceipt(receipt, extra = {}) {
  return compute({ receipt, ...extra }).output_payload;
}

// ---------- P5: freshly-minted VALID receipts must verify across preimage shapes ----------
function checkFreshSignedReceiptsVerify() {
  // Preimage-shape corpus: sha256 message-length boundary regions (55/56/64/119/120 bytes),
  // astral-plane + lone-surrogate UTF-16 (the kernel's hand-rolled utf8Bytes), JSON
  // escape-heavy strings, and per-case receipt_ids.
  const extensions_corpus = [
    'hello',
    '',                                            // empty string
    'x'.repeat(55),                                // preimage near the 64-byte block edge
    'y'.repeat(56),
    'z'.repeat(64),
    'w'.repeat(119),
    'v'.repeat(120),
    '\u{1F600} astral \u{1D306} plane',            // 4-byte UTF-8 surrogate-pair path
    'lone high \uD800 surrogate',                  // unpaired high surrogate -> U+FFFD path
    'lone low \uDFFF surrogate',                   // unpaired low surrogate -> U+FFFD path
    'quote " backslash \\ newline \n tab \t',      // JSON escape-heavy preimage
    'accent \u00e9 \u00ff latin1',                 // 2-byte UTF-8 path
    '\u2028\u2029 line separators',                // JSON-escapable line separators
  ];
  let checked = 0, violations = 0;
  for (let i = 0; i < extensions_corpus.length; i++) {
    const receipt = makeReceipt({ receipt_id: `r-p5-${i}`, extensions: { note: extensions_corpus[i], seq: i } });
    signReceipt(receipt);
    const op = computeReceipt(receipt);
    checked++;
    if (op.valid !== true || op.failed_codes.length !== 0) violations++;
  }
  // Structural variants — each mints and signs its own receipt, then must verify.
  const HEX = '0123456789abcdef';
  const someSha = (n) => 'sha256:' + HEX[n % 16].repeat(64);
  const variants = [
    // hash fields present (lowercase 64-hex, the SHA256_TAGGED_RE accept path) + nested
    // structures and unicode keys in extensions (JCS key-sort path)
    () => { const r = makeReceipt({ input_hash: someSha(1), policy_digest: someSha(2), execution_hash: someSha(3), output_hash: someSha(4), extensions: { deep: { a: [1, 'two', null, true, { k: 'v' }] }, '\u00e9': 'unicode-key', '\u{1F600}': 'astral-key' } }); signReceipt(r); return r; },
    // unprotected{} must be STRIPPED from the preimage (signed without it, still valid)
    () => { const r = makeReceipt({ extensions: { note: 'unprotected-strip' } }); signReceipt(r); r.unprotected = { proofs: { junk: true }, countersignatures: ['x'] }; return r; },
    // duplicate valid signature: signatures[] must be stripped, both entries verify
    () => { const r = makeReceipt({ extensions: { note: 'double-sign' } }); signReceipt(r); r.signatures.push({ ...r.signatures[0] }); return r; },
    // second keypair: kid/issuer resolvability is per-receipt, not a fixture constant
    () => { const r = makeReceipt({ issuer_id: KEY_B.did, extensions: { note: 'key-b' } }); signReceipt(r, KEY_B); return r; },
    // kid with a #fragment: kidBase (split('#')[0]) still resolves to the issuer key
    () => { const r = makeReceipt({ extensions: { note: 'kid-fragment' } }); signReceipt(r); r.signatures[0].kid = r.signatures[0].kid + '#keys-1'; return r; },
    // links[] with content, numbers incl. 0 and negatives in extensions
    () => { const r = makeReceipt({ links: ['sha256:' + 'a'.repeat(64)], extensions: { zero: 0, neg: -17, big: 1e21, flag: false, none: null } }); signReceipt(r); return r; },
  ];
  for (const make of variants) {
    const op = computeReceipt(make());
    checked++;
    if (op.valid !== true || op.failed_codes.length !== 0) violations++;
  }
  return { name: 'fresh_signed_receipts_verify', checked, violations };
}

// ---------- P6: chain-link recomputation matches an independent sha256 exactly ----------
function checkPrevLinkExactDigest() {
  let checked = 0, violations = 0;
  const prev = makeReceipt({ receipt_id: 'r-prev', extensions: { note: 'chain anchor \u{1F600}' } });
  signReceipt(prev);
  prev.unprotected = { countersignatures: ['must-not-affect-chain-hash'] };
  // Independent expectation: JCS INCLUDING signatures[], EXCLUDING unprotected{}.
  const expectedHex = sha256HexIndependent(chainPreimage(prev));

  const ok = makeReceipt({ receipt_id: 'r-child-ok', previousReceiptHash: 'sha256:' + expectedHex });
  signReceipt(ok);
  const opOk = computeReceipt(ok, { previous_receipt: prev });
  checked++;
  const linkOk = opOk.checks.find((c) => c.code === 'PREV_LINK_OK');
  if (opOk.valid !== true || !linkOk || linkOk.detail !== `sha256:${expectedHex}`) violations++;

  const bad = makeReceipt({ receipt_id: 'r-child-bad', previousReceiptHash: 'sha256:' + 'f'.repeat(64) });
  signReceipt(bad);
  const opBad = computeReceipt(bad, { previous_receipt: prev });
  checked++;
  if (opBad.valid !== false || !opBad.failed_codes.includes('PREV_LINK_MISMATCH')) violations++;

  const unverified = makeReceipt({ receipt_id: 'r-child-unv', previousReceiptHash: 'sha256:' + expectedHex });
  signReceipt(unverified);
  const opUnv = computeReceipt(unverified);
  checked++;
  if (!opUnv.checks.some((c) => c.code === 'PREV_LINK_UNVERIFIED' && c.ok === null)) violations++;

  return { name: 'prev_link_exact_digest', checked, violations };
}

// ---------- P7: malformed signature material lands in distinct fail codes ----------
function checkMalformedSignatureMaterial() {
  const base = () => makeReceipt({ receipt_id: 'r-p7', extensions: { note: 'malformed material' } });
  const VALID_SIG = (() => { const r = base(); signReceipt(r); return r.signatures[0].value; })();
  // Each case mutates a freshly-signed receipt; the named code MUST appear in failed_codes.
  // (kid mutations always land in KID_NOT_RESOLVABLE — the kidBase!==issuerBase check runs
  // BEFORE the base58 decode, so any changed kid is unresolvable regardless of its bytes.)
  /** @type {[string, (r: any) => void, string][]} */
  const cases = [
    ['sig with padding =', (r) => { r.signatures[0].value = VALID_SIG + '='; }, 'SIGNATURE_MALFORMED'],
    ['sig with + char', (r) => { r.signatures[0].value = VALID_SIG.slice(0, 10) + '+' + VALID_SIG.slice(11); }, 'SIGNATURE_MALFORMED'],
    ['sig with / char', (r) => { r.signatures[0].value = VALID_SIG.slice(0, 10) + '/' + VALID_SIG.slice(11); }, 'SIGNATURE_MALFORMED'],
    ['sig bad b64 char', (r) => { r.signatures[0].value = VALID_SIG.slice(0, 10) + '*' + VALID_SIG.slice(11); }, 'SIGNATURE_MALFORMED'],
    ['sig length 4k+1', (r) => { r.signatures[0].value = VALID_SIG.slice(0, 85); }, 'SIGNATURE_MALFORMED'],
    ['sig empty', (r) => { r.signatures[0].value = ''; }, 'SIGNATURE_MALFORMED'],
    ['sig 63 bytes', (r) => { r.signatures[0].value = NodeBuffer.from(Array(63).fill(7)).toString('base64url'); }, 'SIGNATURE_MALFORMED'],
    ['sig 65 bytes', (r) => { r.signatures[0].value = NodeBuffer.from(Array(65).fill(7)).toString('base64url'); }, 'SIGNATURE_MALFORMED'],
    ['sig byte-flip', (r) => { r.signatures[0].value = VALID_SIG.slice(0, 20) + (VALID_SIG[20] === 'A' ? 'B' : 'A') + VALID_SIG.slice(21); }, 'SIGNATURE_INVALID'],
    ['kid not issuer', (r) => { r.issuer_id = KEY_B.did; }, 'KID_NOT_RESOLVABLE'],
    ['kid char mutated', (r) => { r.signatures[0].kid = r.signatures[0].kid.slice(0, -1) + (r.signatures[0].kid.slice(-1) === 'A' ? 'B' : 'A'); }, 'KID_NOT_RESOLVABLE'],
    ['alg not EdDSA', (r) => { r.signatures[0].alg = 'es256'; }, 'ALG_UNSUPPORTED'],
    ['hash field uppercase', (r) => { r.input_hash = 'sha256:' + 'ABCDEF'.repeat(10) + 'ABCD'; }, 'HASH_FIELD_FORMAT_INVALID'],
    ['hash field short', (r) => { r.input_hash = 'sha256:' + 'a'.repeat(63); }, 'HASH_FIELD_FORMAT_INVALID'],
    ['hash field no prefix', (r) => { r.input_hash = 'a'.repeat(64); }, 'HASH_FIELD_FORMAT_INVALID'],
  ];
  let checked = 0, violations = 0;
  for (const [name, mutate, expectedCode] of cases) {
    checked++;
    const r = base();
    signReceipt(r);
    mutate(r);
    const op = computeReceipt(r);
    if (op.valid !== false || !op.failed_codes.includes(expectedCode)) violations++;
  }
  // The byte-flip SIGNATURE_INVALID detail pins the exact digest hex — an independent
  // sha256 over the JCS preimage, killing hex/utf8/canonicalization drift in the detail.
  const r = base();
  signReceipt(r);
  const expectedDigestHex = sha256HexIndependent(signingPreimage(r));
  r.signatures[0].value = VALID_SIG.slice(0, 20) + (VALID_SIG[20] === 'A' ? 'B' : 'A') + VALID_SIG.slice(21);
  const op = computeReceipt(r);
  checked++;
  const sigCheck = op.checks.find((c) => c.code === 'SIGNATURE_INVALID');
  if (!sigCheck || sigCheck.detail !== `signatures[0] kid=${r.signatures[0].kid} digest=sha256:${expectedDigestHex}`) violations++;
  return { name: 'malformed_signature_material', checked, violations };
}

// ---------- P8: single-char tamper of every signed field on a unicode-rich valid receipt ----------
function checkUnicodeTamperBreaksSignature() {
  const SIGNED_STRING_FIELDS = ['receipt_id', 'event_type', 'source_adapter', 'issued_at', 'result_status', 'input_hash', 'policy_digest'];
  const receipt = makeReceipt({
    receipt_id: 'r-\u{1F600}-unicode',
    event_type: 'policy_d\u00e9cision',
    input_hash: 'sha256:' + '3a'.repeat(32),
    policy_digest: 'sha256:' + '4b'.repeat(32),
    extensions: { note: 'surrogate pair \u{1D306} tail' },
  });
  signReceipt(receipt);
  let checked = 0, violations = 0;
  for (const field of SIGNED_STRING_FIELDS) {
    checked++;
    const tampered = JSON.parse(JSON.stringify(receipt));
    const orig = String(tampered[field]);
    tampered[field] = orig.slice(0, -1) + (orig.slice(-1) === 'a' ? 'b' : 'a');
    const op = computeReceipt(tampered);
    if (op.valid !== false || !op.failed_codes.includes('SIGNATURE_INVALID')) violations++;
  }
  return { name: 'unicode_tamper_breaks_signature', checked, violations };
}

// ---------- P9: verifier control-flow edges (MUTATION-HEAL-ART652) ----------
// Killable-in-principle survivors in the kernel's OWN verify logic: the empty/missing
// signatures[] branch, the signing/chain preimage catch blocks (a circular JSON structure
// makes canonicalStringify throw -- the only way to reach SIGNING_PREIMAGE_ERROR /
// PREV_LINK_PREIMAGE_ERROR from outside), did:key decode failures reachable with
// kid === issuer (the kidBase!==issuerBase guard is bypassed by construction), the UTF-8
// branch boundaries of the hand-rolled utf8Bytes (single chars at every 1/2/3/4-byte and
// range edge), and Ed25519 malleability: strict (zip215:false) verification must REJECT a
// signature whose S component is >= the group order L, where zip215 would accept it.
function checkVerifierControlFlowEdges() {
  let checked = 0, violations = 0;
  const check = (label, cond) => { checked++; if (!cond) violations++; };

  // missing signatures[] and empty signatures[] both land in NO_SIGNATURES
  const missing = makeReceipt({ receipt_id: 'r-p9-nosig' });
  const opMissing = computeReceipt(missing);
  check('missing signatures[] -> NO_SIGNATURES', opMissing.valid === false && opMissing.failed_codes.includes('NO_SIGNATURES'));
  const empty = makeReceipt({ receipt_id: 'r-p9-emptysig', signatures: [] });
  const opEmpty = computeReceipt(empty);
  check('empty signatures[] -> NO_SIGNATURES', opEmpty.valid === false && opEmpty.failed_codes.includes('NO_SIGNATURES'));

  // circular structures make the kernel's own canonicalStringify throw -> caught verdicts
  const circular = makeReceipt({ receipt_id: 'r-p9-circ' });
  signReceipt(circular); // signatures must be present so the verify path is reached
  circular.self = circular; // JSON.stringify throws on this inside the kernel
  const opCirc = computeReceipt(circular);
  check('circular receipt -> SIGNING_PREIMAGE_ERROR', opCirc.valid === false && opCirc.failed_codes.includes('SIGNING_PREIMAGE_ERROR'));
  const circPrev = makeReceipt({ receipt_id: 'r-p9-circprev', previousReceiptHash: 'sha256:' + 'a'.repeat(64) });
  signReceipt(circPrev);
  const prev = makeReceipt({ receipt_id: 'r-p9-prev' });
  prev.self = prev;
  const opCircPrev = computeReceipt(circPrev, { previous_receipt: prev });
  check('circular previous_receipt -> PREV_LINK_PREIMAGE_ERROR', opCircPrev.valid === false && opCircPrev.failed_codes.includes('PREV_LINK_PREIMAGE_ERROR'));

  // did:key decode failures reachable with kid === issuer (bypasses the kidBase check):
  // wrong multicodec prefix, wrong raw-key length, invalid base58 character.
  const malformedDids = [
    'did:key:z' + b58Encode(NodeBuffer.concat([NodeBuffer.from([0x01, 0x02]), NodeBuffer.alloc(32, 3)])), // not 0xed01
    'did:key:z' + b58Encode(NodeBuffer.concat([NodeBuffer.from([0xed, 0x01]), NodeBuffer.alloc(31, 4)])), // 31-byte raw
    'did:key:z' + b58Encode(NodeBuffer.alloc(34, 5)).slice(0, -1) + '0',                          // '0' not in B58
  ];
  for (let i = 0; i < malformedDids.length; i++) {
    const r = makeReceipt({ receipt_id: `r-p9-did-${i}`, issuer_id: malformedDids[i] });
    signReceipt(r);
    r.signatures[0].kid = malformedDids[i]; // kid === issuer: decode IS reached
    const op = computeReceipt(r);
    check(`malformed did[${i}] -> SIGNATURE_MALFORMED`, op.valid === false && op.failed_codes.includes('SIGNATURE_MALFORMED'));
  }

  // UTF-8 branch boundaries of the hand-rolled encoder: every 1/2/3/4-byte encoding edge.
  const utf8Boundaries = ['\u0080', '\u07FF', '\u0800', '\uFFFD', '\uE000', '\uFFFF', '\u{10000}', '\u{10FFFF}'];
  for (let i = 0; i < utf8Boundaries.length; i++) {
    const r = makeReceipt({ receipt_id: `r-p9-u8-${i}`, extensions: { ch: utf8Boundaries[i] } });
    signReceipt(r);
    const op = computeReceipt(r);
    check(`utf8 boundary ${i} verifies`, op.valid === true && op.failed_codes.length === 0);
  }

  // Ed25519 malleability: S' = S + L verifies under zip215 but MUST fail strict (zip215:false).
  const L = 2n ** 252n + 27742317777372353535851937790883648493n;
  const malleable = makeReceipt({ receipt_id: 'r-p9-malleable' });
  signReceipt(malleable);
  const sigBytes = NodeBuffer.from(malleable.signatures[0].value, 'base64url');
  const s = BigInt('0x' + sigBytes.subarray(32).toString('hex')); // S is little-endian
  const sPlusL = s + L;
  sigBytes.set(NodeBuffer.from(sPlusL.toString(16).padStart(64, '0'), 'hex').reverse().subarray(0, 32), 32);
  malleable.signatures[0].value = sigBytes.toString('base64url');
  const opMalleable = computeReceipt(malleable);
  check('S >= L rejected (zip215:false strictness)', opMalleable.valid === false && opMalleable.failed_codes.includes('SIGNATURE_INVALID'));

  return { name: 'verifier_control_flow_edges', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkTotalityNeverThrows(),
  checkDeterminism(),
  checkPayloadTamperBreaksSignature(),
  checkKidSubstitutionNotResolvable(),
  checkFreshSignedReceiptsVerify(),
  checkPrevLinkExactDigest(),
  checkMalformedSignatureMaterial(),
  checkUnicodeTamperBreaksSignature(),
  checkVerifierControlFlowEdges(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
