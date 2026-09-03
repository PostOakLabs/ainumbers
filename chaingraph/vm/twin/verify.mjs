// SPDX-License-Identifier: Apache-2.0
//
// The independent pure-JS receipt verifier ("the twin") — the browser port of
// zkprof-web's web/twin/verify.mjs (ported 2026-09-03, VERIFY-TWIN-PORT-1).
//
// This is a clean-room SECOND implementation of the risc0 3.0.5 Groth16/BN254
// receipt verifier, using ONLY the estate's vendored noble bundle
// (@noble/curves + @noble/hashes v2.2.0, MIT — chaingraph/kernels/
// _noble-bn254.bundle.mjs, digest-gated) for the elliptic-curve/pairing
// arithmetic and SHA-256. It shares nothing with the risc0 crate at runtime.
// Everything below is reimplemented in JS from risc0's semantics:
//   * JCS (RFC 8785) canonical serialization of the journal object.
//   * the `ReceiptClaim::ok(...).digest()` tagged_struct construction.
//   * split_digest + the 5 Groth16 public inputs.
//   * the Groth16 pairing equation.
//
// Agreement on record: this twin and the risc0 3.0.5 crate oracle returned
// identical verdicts on all 312 estate receipts plus the 4-fixture set and the
// mutation/probe cases (zero disagreements; zkprof-web docs/TWIN-CORPUS-SWEEP.md,
// merged 2026-09-03) — "every receipt tested", not a claim about untested bytes.
//
// Browser-port differences from the Node original (behaviour-preserving):
//   * base64 seal decode uses atob (no Node Buffer).
//   * JCS number handling is FAIL-CLOSED: the RFC 8785 number edge cases the
//     corpus never exercises (negative zero, exponent-threshold scientific
//     notation, non-finite) are REJECTED, never guessed (SPEC §18.7 posture).
//
// Provenance of the CONSTANT ceremony parameters (control_root, control_id and
// the verifying key alpha/beta/gamma/delta/ic): the fixture-independent risc0
// default parameters, byte-identical across every fixture oracle in the
// zkprof-web corpus and identical to the estate reference verifier's constants
// (chaingraph/kernels/_computeproof.mjs).

import { bn254, sha256 } from '../../kernels/_noble-bn254.bundle.mjs';

const BN254_R = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

const G1 = bn254.G1.Point;
const G2 = bn254.G2.Point;
const Fp12 = bn254.fields.Fp12;

// The fixture-independent risc0 default ceremony parameters (from the zkprof
// oracle dump; identical across every fixture and equal to the estate
// reference verifier's constants).
export const RISC0_ORACLE_CONSTANTS = {
  control_root: "a54dc85ac99f851c92d7c96d7318af41dbe7c0194edfcc37eb4d422a998c1f56",
  bn254_control_id: "c07a65145c3cb48b6101962ea607a4dd93c753bb26975cb47feb00d3666e4404",
  verifying_key: {
    "alpha": {
      "x": "20491192805390485299153009773594534940189261866228447918068658471970481763042",
      "y": "9383485363053290200918347156157836566562967994039712273449902621266178545958"
    },
    "beta": {
      "x_c0": "6375614351688725206403948262868962793625744043794305715222011528459656738731",
      "x_c1": "4252822878758300859123897981450591353533073413197771768651442665752259397132",
      "y_c0": "10505242626370262277552901082094356697409835680220590971873171140371331206856",
      "y_c1": "21847035105528745403288232691147584728191162732299865338377159692350059136679"
    },
    "delta": {
      "x_c0": "12043754404802191763554326994664886008979042643626290185762540825416902247219",
      "x_c1": "1668323501672964604911431804142266013250380587483576094566949227275849579036",
      "y_c0": "13740680757317479711909903993315946540841369848973133181051452051592786724563",
      "y_c1": "7710631539206257456743780535472368339139328733484942210876916214502466455394"
    },
    "gamma": {
      "x_c0": "10857046999023057135944570762232829481370756359578518086990519993285655852781",
      "x_c1": "11559732032986387107991004021392285783925812861821192530917403151452391805634",
      "y_c0": "8495653923123431417604973247489272438418190587263600148770280649306958101930",
      "y_c1": "4082367875863433681332203403145435568316851327593401208105741076214120093531"
    },
    "ic": [
      {
        "x": "8446592859352799428420270221449902464741693648963397251242447530457567083492",
        "y": "1064796367193003797175961162477173481551615790032213185848276823815288302804"
      },
      {
        "x": "3179835575189816632597428042194253779818690147323192973511715175294048485951",
        "y": "20895841676865356752879376687052266198216014795822152491318012491767775979074"
      },
      {
        "x": "5332723250224941161709478398807683311971555792614491788690328996478511465287",
        "y": "21199491073419440416471372042641226693637837098357067793586556692319371762571"
      },
      {
        "x": "12457994489566736295787256452575216703923664299075106359829199968023158780583",
        "y": "19706766271952591897761291684837117091856807401404423804318744964752784280790"
      },
      {
        "x": "19617808913178163826953378459323299110911217259216006187355745713323154132237",
        "y": "21663537384585072695701846972542344484111393047775983928357046779215877070466"
      },
      {
        "x": "6834578911681792552110317589222010969491336870276623105249474534788043166867",
        "y": "15060583660288623605191393599883223885678013570733629274538391874953353488393"
      }
    ]
  }
};

// ---------------------------------------------------------------------------
// byte/hex/bigint helpers
// ---------------------------------------------------------------------------
const enc = new TextEncoder();

function hexToBytes(hex) {
  if (hex.length % 2) throw new Error('odd hex length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}

function bytesToHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function bytesToBigIntBE(bytes) {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

function bytesToBigIntLE(bytes) {
  let v = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(bytes[i]);
  return v;
}

function u32le(w) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, w >>> 0, true);
  return b;
}

function u16le(w) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, w, true);
  return b;
}

function concatBytes(arr) {
  const len = arr.reduce((a, x) => a + x.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const x of arr) {
    out.set(x, off);
    off += x.length;
  }
  return out;
}

function sha256Bytes(bytes) {
  return new Uint8Array(sha256(bytes));
}

function base64ToBytes(b64) {
  const bin = atob(b64); // browser + Node >= 16
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// JCS (RFC 8785) canonicalization — FAIL-CLOSED on numbers
// ---------------------------------------------------------------------------
// RFC 8785 number serialization caveat, resolved fail-closed for the browser
// port: a JSON number must serialize to the shortest representation that
// round-trips. JS `JSON.stringify` (ECMAScript Number::toString) and serde_json
// (Ryu) agree for ordinary finite numbers, but the genuine edge cases (exact
// exponent thresholds rendering in scientific notation, `-0`, non-finite
// magnitudes) are NOT exercised by any estate journal. Rather than guess, this
// port REJECTS them: the verify fails with a named error, it never silently
// passes a digest the risc0 crate would have computed differently.

function jcsSerializeNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(
      'JCS fail-closed: non-finite journal number rejected (no RFC 8785 mapping exercised by this corpus)'
    );
  }
  if (Object.is(n, -0)) {
    throw new Error(
      'JCS fail-closed: negative zero rejected (-0 vs 0 is an untested RFC 8785 edge case)'
    );
  }
  const s = JSON.stringify(n);
  if (/e/i.test(s)) {
    throw new Error(
      'JCS fail-closed: number serializes in exponent notation (' +
        s +
        ') — an untested RFC 8785 edge case; rejecting rather than guessing'
    );
  }
  return s;
}

// Sort keys by UTF-8 byte order to match Rust's BTreeMap<&str> (which orders by
// str byte order), not JS's default UTF-16 code-unit order.
function utf8KeyCompare(a, b) {
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  const n = Math.min(ba.length, bb.length);
  for (let i = 0; i < n; i++) {
    if (ba[i] !== bb[i]) return ba[i] - bb[i];
  }
  return ba.length - bb.length;
}

function jcsSerializeString(s) {
  return JSON.stringify(s);
}

// Returns the RFC 8785 canonical serialization as a Uint8Array.
export function jcsCanonicalize(value) {
  return enc.encode(jcsWrite(value));
}

function jcsWrite(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return jcsSerializeNumber(value);
  if (typeof value === 'string') return jcsSerializeString(value);
  if (Array.isArray(value)) {
    return '[' + value.map(jcsWrite).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort(utf8KeyCompare);
    const parts = keys.map(
      (k) => jcsSerializeString(k) + ':' + jcsWrite(value[k])
    );
    return '{' + parts.join(',') + '}';
  }
  throw new Error('JCS: unsupported value ' + typeof value);
}

// ---------------------------------------------------------------------------
// risc0 tagged_struct / claim digest
// ---------------------------------------------------------------------------
function taggedStruct(tag, down, data) {
  const tagHash = sha256Bytes(enc.encode(tag));
  const downCount = u16le(down.length);
  return sha256Bytes(concatBytes([tagHash, ...down, ...data.map(u32le), downCount]));
}

// ReceiptClaim::ok(image_id, journal_bytes).digest()
export function claimDigest(imageIdHex, journalBytes) {
  const imageId = hexToBytes(imageIdHex);
  const ZERO = new Uint8Array(32);
  const journalHash = sha256Bytes(journalBytes);
  const post = taggedStruct('risc0.SystemState', [ZERO], [0]);
  const output = taggedStruct('risc0.Output', [journalHash, ZERO], []);
  return taggedStruct(
    'risc0.ReceiptClaim',
    [ZERO, imageId, post, output],
    [0, 0]
  );
}

// risc0 split_digest: reverse; a0 = fr(be[16..32]), a1 = fr(be[0..16]).
export function splitDigest(digestBytes) {
  const be = [...digestBytes].reverse();
  const a0 = bytesToBigIntBE(new Uint8Array(be.slice(16, 32)));
  const a1 = bytesToBigIntBE(new Uint8Array(be.slice(0, 16)));
  return [a0, a1];
}

// The 5th public input: id = LE(control_id) mod r, exactly risc0's
// fr(rev(control_id)) step.
export function controlIdFr(controlIdHex) {
  const bytes = hexToBytes(controlIdHex);
  return bytesToBigIntLE(bytes) % BN254_R;
}

// ---------------------------------------------------------------------------
// seal decode (independent)
// ---------------------------------------------------------------------------
// 256-byte Groth16 seal: A (G1: x,y BE), B (G2: x_c0,x_c1,y_c0,y_c1), C (G1).
export function decodeSeal(sealBytes) {
  if (sealBytes.length !== 256) {
    throw new Error(`seal length mismatch: ${sealBytes.length} != 256`);
  }
  const A = {
    x: bytesToBigIntBE(sealBytes.slice(0, 32)),
    y: bytesToBigIntBE(sealBytes.slice(32, 64)),
  };
  const b = sealBytes.slice(64, 192);
  const B = {
    x_c0: bytesToBigIntBE(b.slice(32, 64)), // data[96..128]
    x_c1: bytesToBigIntBE(b.slice(0, 32)), //  data[64..96]
    y_c0: bytesToBigIntBE(b.slice(96, 128)), // data[160..192]
    y_c1: bytesToBigIntBE(b.slice(64, 96)), // data[128..160]
  };
  const C = {
    x: bytesToBigIntBE(sealBytes.slice(192, 224)),
    y: bytesToBigIntBE(sealBytes.slice(224, 256)),
  };
  return { A, B, C };
}

// ---------------------------------------------------------------------------
// point construction
// ---------------------------------------------------------------------------
function g1pt(p) {
  return G1.fromAffine({ x: BigInt(p.x), y: BigInt(p.y) });
}
function g2pt(p) {
  return G2.fromAffine({
    x: { c0: BigInt(p.x_c0), c1: BigInt(p.x_c1) },
    y: { c0: BigInt(p.y_c0), c1: BigInt(p.y_c1) },
  });
}

// ---------------------------------------------------------------------------
// Groth16 pairing check
// ---------------------------------------------------------------------------
function pairingEqPublicInputs(A, B, C, vk, public_inputs) {
  // ICsum = ic[0] + x0*ic[1] + ... + x4*ic[5]
  let icSum = g1pt(vk.ic[0]);
  for (let i = 1; i <= 5; i++) {
    const scalar = public_inputs[i - 1];
    if (scalar !== 0n) {
      icSum = icSum.add(g1pt(vk.ic[i]).multiply(scalar));
    }
  }
  const lhs = bn254.pairing(g1pt(A), g2pt(B));
  let rhs = bn254.pairing(g1pt(vk.alpha), g2pt(vk.beta));
  rhs = Fp12.mul(rhs, bn254.pairing(icSum, g2pt(vk.gamma)));
  rhs = Fp12.mul(rhs, bn254.pairing(g1pt(C), g2pt(vk.delta)));
  return Fp12.eql(lhs, rhs);
}

// Convenience: derive the JCS bytes, journal digest and claim digest for a
// receipt object (used by the page's per-check panel and the fixture tests).
export function deriveDigests(receipt) {
  const jcsBytes = jcsCanonicalize(receipt.journal);
  const journalDigestHex = bytesToHex(sha256Bytes(jcsBytes));
  const d = claimDigest(receipt.imageId.slice(7), jcsBytes);
  return {
    jcsHex: bytesToHex(jcsBytes),
    journalDigestHex,
    claimDigestHex: bytesToHex(d),
  };
}

// ---------------------------------------------------------------------------
// Top-level verify
// ---------------------------------------------------------------------------
// receipt: { seal: b64, imageId: "sha256:..", journal: <object> }
// opts:    { expectedImageId?: string }
//          The published-identity leg: when given, the receipt's imageId must
//          EQUAL this string. The page passes the risc0 image id published in
//          chaingraph.json's compute_images[] for the node the receipt claims.
//
// Returns { valid, checks:[{name,passed,detail}] }.
export function verify(receipt, opts = {}) {
  const oracle = RISC0_ORACLE_CONSTANTS;
  const checks = [];
  const push = (name, passed, detail) =>
    checks.push({
      name,
      passed: passed === true ? true : passed === false ? false : null,
      detail,
    });

  let sealBytes = null;
  // 1) seal decodes
  try {
    const b64 = receipt.seal;
    if (typeof b64 !== 'string') throw new Error('no seal field');
    sealBytes = base64ToBytes(b64);
    if (sealBytes.length !== 256)
      throw new Error(`length ${sealBytes.length} != 256`);
    push('seal decodes', true, `${sealBytes.length} decoded bytes`);
  } catch (e) {
    push('seal decodes', false, `base64/length failed: ${e.message}`);
    return { valid: false, checks };
  }

  // 2) imageId recognized (shape + published-identity binding)
  let imageId = receipt.imageId;
  let imageIdHex = null;
  let imageIdOk = false;
  if (typeof imageId === 'string' && imageId.startsWith('sha256:')) {
    imageIdHex = imageId.slice(7);
    imageIdOk = /^[0-9a-fA-F]{64}$/.test(imageIdHex);
  }
  const matchExpected =
    opts.expectedImageId === undefined || imageId === opts.expectedImageId;
  const imageIdPassed = imageIdOk && matchExpected;
  push(
    'imageId recognized',
    imageIdPassed,
    `imageId=${imageId} expected=${opts.expectedImageId ?? '(shape only)'}`
  );

  // 3) journal present
  const journal = receipt.journal;
  if (typeof journal !== 'object' || journal === null || Array.isArray(journal)) {
    push('journal present', false, 'journal is not an object');
    return { valid: false, checks };
  }
  push('journal present', true, 'object');

  // 4) claim digest derived (JCS canonicalization is fail-closed on numbers)
  let jcsBytes = null;
  let derived = null;
  try {
    jcsBytes = jcsCanonicalize(journal);
    const d = claimDigest(imageIdHex, jcsBytes);
    derived = bytesToHex(d);
    push('claim digest derived', true, `sha256:${derived}`);
  } catch (e) {
    push('claim digest derived', false, `error: ${e.message}`);
    return { valid: false, checks };
  }

  // 5) public inputs derived
  let pi = null;
  try {
    const [a0, a1] = splitDigest(hexToBytes(oracle.control_root));
    const [c0, c1] = splitDigest(hexToBytes(derived));
    pi = [a0, a1, c0, c1, controlIdFr(oracle.bn254_control_id)];
    push(
      'public inputs derived',
      true,
      `[${pi.map((v) => v.toString()).join(', ')}]`
    );
  } catch (e) {
    push('public inputs derived', false, `error: ${e.message}`);
    return { valid: false, checks };
  }

  // 6) Groth16 pairing check
  try {
    const { A, B, C } = decodeSeal(sealBytes);
    const ok = pairingEqPublicInputs(A, B, C, oracle.verifying_key, pi);
    push(
      'Groth16 pairing check',
      ok,
      `e(A,B)==e(α,β)·e(IC,γ)·e(C,δ) => ${ok}`
    );
  } catch (e) {
    push('Groth16 pairing check', false, `pairing failed: ${e.message}`);
  }

  const valid = checks.every((c) => c.passed === true);
  return { valid, checks };
}
