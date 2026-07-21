#!/usr/bin/env node
/**
 * scripts/ocg-receipt-verifier-568-tamper.test.mjs
 * AV-REJECT-FIX-1: tamper-negative fixture for tools/568-ocg-receipt-verifier.html
 * (AV-VERIFY-1) — the airgapped OCG receipt verifier (hash + eddsa-jcs-2022
 * Ed25519 + RFC 6962 Merkle inclusion, entirely offline). A verifier never
 * observed to reject isn't known to verify.
 *
 * Inlines the SAME executionHash/verifyArtifactProofs/verifyMerkleInclusion/
 * verifyReceipt logic as tools/568-ocg-receipt-verifier.html, and reuses its
 * own shipped golden/tampered FIXTURES verbatim so this test never opens a
 * second implementation or a second fixture pair.
 */

// ── cgCanon / hash (byte-identical to tools/568) ────────────────────────────
function cgCanon(v) {
  if (Array.isArray(v)) return v.map(cgCanon);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = cgCanon(v[k]); return o; }, {});
  return v;
}
function canonicalPreimage(pp, op) { return JSON.stringify(cgCanon({ policy_parameters: pp, output_payload: op })); }
async function executionHash(pp, op) {
  const bytes = new TextEncoder().encode(canonicalPreimage(pp, op));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function jcsBytes(obj) { return new TextEncoder().encode(JSON.stringify(cgCanon(obj))); }
async function sha256(bytes) { return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)); }
function hexToBytes(hex) {
  hex = String(hex || '');
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}
function bytesToHex(b) { return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(''); }

// ── base58 / did:key (byte-identical to tools/568) ──────────────────────────
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(str) {
  let zeros = 0; while (zeros < str.length && str[zeros] === '1') zeros++;
  const bytes = [0];
  for (let i = zeros; i < str.length; i++) {
    let carry = B58.indexOf(str[i]); if (carry < 0) throw new Error('bad base58 char');
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let k = 0; k < bytes.length; k++) out[zeros + bytes.length - 1 - k] = bytes[k];
  return out;
}
async function didKeyToPublicKey(did) {
  if (!did || did.indexOf('did:key:z') !== 0) throw new Error('not a did:key z-form');
  const prefixed = b58decode(did.slice('did:key:z'.length));
  if (prefixed[0] !== 0xed || prefixed[1] !== 0x01) throw new Error('did:key is not Ed25519');
  const raw = prefixed.slice(2);
  return crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, true, ['verify']);
}
function proofOptions(o) { return { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', verificationMethod: o.verificationMethod, proofPurpose: 'assertionMethod', created: o.created }; }
async function hashData(doc, opts) {
  const optHash = await sha256(jcsBytes(opts));
  const docHash = await sha256(jcsBytes(doc));
  const cat = new Uint8Array(optHash.length + docHash.length);
  cat.set(optHash, 0); cat.set(docHash, optHash.length);
  return cat;
}
function securedArtifact(a) {
  const c = JSON.parse(JSON.stringify(a));
  if (c && c.audit_signature && ('proof' in c.audit_signature)) delete c.audit_signature.proof;
  return c;
}
async function verifyOneProof(secured, proof) {
  if (!proof || proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'eddsa-jcs-2022') return { valid: false, verificationMethod: proof && proof.verificationMethod, error: 'unsupported proof type/cryptosuite' };
  if (proof.proofPurpose !== 'assertionMethod' || typeof proof.proofValue !== 'string' || proof.proofValue[0] !== 'z') return { valid: false, verificationMethod: proof.verificationMethod, error: 'malformed proof object' };
  try {
    const pub = await didKeyToPublicKey(proof.verificationMethod);
    const opts = proofOptions(proof);
    const sig = b58decode(proof.proofValue.slice(1));
    const ok = await crypto.subtle.verify('Ed25519', pub, sig, await hashData(secured, opts));
    return { valid: ok, verificationMethod: proof.verificationMethod, error: ok ? null : 'signature does not verify against the named key' };
  } catch (e) { return { valid: false, verificationMethod: proof.verificationMethod, error: e.message }; }
}
async function verifyArtifactProofs(artifact) {
  const raw = artifact && artifact.audit_signature && artifact.audit_signature.proof;
  const proofs = raw == null ? [] : (Array.isArray(raw) ? raw : [raw]);
  if (proofs.length === 0) return { present: false, allValid: true, results: [] };
  const secured = securedArtifact(artifact);
  const results = [];
  for (let i = 0; i < proofs.length; i++) results.push(await verifyOneProof(secured, proofs[i]));
  return { present: true, allValid: results.every(r => r.valid), results };
}

// ── RFC 6962 Merkle inclusion (byte-identical to tools/568) ─────────────────
function concatBytes(a, b) { const out = new Uint8Array(a.length + b.length); out.set(a, 0); out.set(b, a.length); return out; }
async function leafHash(data) { return sha256(concatBytes(new Uint8Array([0x00]), data)); }
async function nodeHash(l, r) { return sha256(concatBytes(new Uint8Array([0x01]), concatBytes(l, r))); }
async function rootFromInclusion(leaf, index, size, path) {
  if (index >= size) return null;
  let fn = BigInt(index), sn = BigInt(size) - 1n, r = leaf;
  for (let i = 0; i < path.length; i++) {
    const v = path[i];
    if (sn === 0n) return null;
    if ((fn & 1n) === 1n || fn === sn) {
      r = await nodeHash(v, r);
      if ((fn & 1n) === 0n) { while (fn !== 0n && (fn & 1n) === 0n) { fn >>= 1n; sn >>= 1n; } }
    } else { r = await nodeHash(r, v); }
    fn >>= 1n; sn >>= 1n;
  }
  return sn === 0n ? r : null;
}
async function verifyMerkleInclusion(mi, execHashHex) {
  if (!mi || typeof mi !== 'object') return { ok: false, reason: 'merkle_inclusion must be an object' };
  if (mi.algorithm !== 'rfc6962') return { ok: false, reason: 'merkle_inclusion.algorithm must be "rfc6962"' };
  const leafHex = String(mi.leaf || '').replace(/^sha256:/, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(leafHex)) return { ok: false, reason: 'merkle_inclusion.leaf must be a 64-hex digest' };
  if (leafHex !== String(execHashHex || '').toLowerCase()) return { ok: false, reason: 'merkle_inclusion.leaf != recomputed execution_hash' };
  if (!Number.isInteger(mi.index) || mi.index < 0) return { ok: false, reason: 'merkle_inclusion.index must be a non-negative integer' };
  if (!Number.isInteger(mi.tree_size) || mi.tree_size <= 0) return { ok: false, reason: 'merkle_inclusion.tree_size must be a positive integer' };
  if (!Array.isArray(mi.path)) return { ok: false, reason: 'merkle_inclusion.path must be an array' };
  try {
    const L = await leafHash(hexToBytes(leafHex));
    const pathBytes = mi.path.map(h => hexToBytes(String(h).replace(/^sha256:/, '')));
    const root = await rootFromInclusion(L, mi.index, mi.tree_size, pathBytes);
    if (!root) return { ok: false, reason: 'inclusion path does not reconstruct a root (index/size/path inconsistent)' };
    return { ok: true, rootHex: bytesToHex(root) };
  } catch (e) { return { ok: false, reason: 'inclusion path malformed: ' + e.message }; }
}

// ── Core verifier (byte-identical to tools/568's verifyReceipt) ────────────
async function verifyReceipt(artifact, opts) {
  opts = opts || {};
  const checks = [];
  const pp = artifact && artifact.policy_parameters, op = artifact && artifact.output_payload;
  const structOk = !!(artifact && typeof artifact === 'object' && pp && typeof pp === 'object' && op && typeof op === 'object' && typeof artifact.execution_hash === 'string' && artifact.execution_hash);
  checks.push({ check: 'structure', pass: structOk });
  if (!structOk) return { verdict: 'FAIL', checks, hash_match: false, recomputed_hash: null, signature: { present: false, allValid: true, results: [] }, anchors: [] };

  const recomputed = await executionHash(pp, op);
  const statedHash = String(artifact.execution_hash).replace(/^sha256:/, '').toLowerCase();
  const hashMatch = recomputed.toLowerCase() === statedHash;
  checks.push({ check: 'execution_hash_recompute', pass: hashMatch });

  const sigRes = await verifyArtifactProofs(artifact);
  checks.push({ check: 'audit_signature_proof', pass: sigRes.present ? sigRes.allValid : true });

  const anchorBindings = Array.isArray(artifact.anchor_bindings) ? artifact.anchor_bindings : [];
  const anchorResults = [];
  for (let i = 0; i < anchorBindings.length; i++) {
    const ab = anchorBindings[i];
    const anchoredHashHex = String(ab.anchored_hash || '').replace(/^sha256:/, '').toLowerCase();
    if (ab.merkle_inclusion) {
      const mres = await verifyMerkleInclusion(ab.merkle_inclusion, recomputed);
      const rootMatch = mres.ok && mres.rootHex.toLowerCase() === anchoredHashHex;
      const trustedMatch = !opts.trustedRootHex || (mres.ok && mres.rootHex.toLowerCase() === String(opts.trustedRootHex).replace(/^sha256:/, '').toLowerCase());
      anchorResults.push({ type: ab.type || 'unknown', mode: 'merkle_inclusion', pass: mres.ok && rootMatch && trustedMatch });
    } else {
      const directOk = anchoredHashHex !== '' && anchoredHashHex === recomputed.toLowerCase();
      anchorResults.push({ type: ab.type || 'unknown', mode: 'direct', pass: directOk });
    }
  }
  const anchorsOk = anchorResults.every(r => r.pass);
  if (anchorBindings.length > 0) checks.push({ check: 'anchor_bindings', pass: anchorsOk });
  else if (opts.requireAnchor) checks.push({ check: 'anchor_bindings', pass: false });

  const overall = hashMatch && (!sigRes.present || sigRes.allValid) && anchorsOk && (!opts.requireAnchor || anchorBindings.length > 0);
  return { verdict: overall ? 'PASS' : 'FAIL', checks, hash_match: hashMatch, recomputed_hash: recomputed, signature: sigRes, anchors: anchorResults };
}

// ── Fixtures — copied VERBATIM from tools/568-ocg-receipt-verifier.html's own
//    FIXTURES.golden/FIXTURES.tampered (real Ed25519-signed, real 4-leaf RFC
//    6962 Merkle inclusion). Golden verifies PASS; tampered mutates
//    output_payload.decision after signing so hash + anchor both go stale.  ──
const GOLDEN = {"@context":"https://ainumbers.co/chaingraph/context/v0.3/context.jsonld","chaingraph_version":"0.4.0","mandate_type":"compliance_mandate","tool_id":"568-ocg-receipt-verifier-fixture-source","tool_version":"1.0.0","generated_at":"2026-07-21T00:00:00.000Z","execution_hash":"eea6041adc4c9457e45de5133cca0a43e81a872219980c2176704aa5a48dc3e2","chain":{"parent_hashes":[],"parent_tool_ids":[],"chain_depth":0},"policy_parameters":{"activity":"av_verify_1_fixture","jurisdiction":"US","amount_usd":48250,"counterparty":"fixture-counterparty-01"},"output_payload":{"risk_score":0.14,"decision":"approve","rule_set":"av-verify-1-golden-v1"},"compliance_flags":["AV_VERIFY_1_GOLDEN_FIXTURE"],"compute_mode":"browser","anchor_bindings":[{"type":"opentimestamps","anchored_hash":"sha256:cee200515da21290f8b718f2e2ebc84c67d064b0314c0cf6cf42f40a7908e974","log_origin":"av-verify-1-fixture-batch","proof":"AV-VERIFY-1-FIXTURE-OTS-PROOF-PLACEHOLDER","merkle_inclusion":{"leaf":"eea6041adc4c9457e45de5133cca0a43e81a872219980c2176704aa5a48dc3e2","index":1,"path":["sha256:76b937f2d58d028736ae6fed649daca596d24645d8ffca2ed247818d2f046a7e","sha256:ab330f2fc3b6cc19814dfb2d0255f0fcc597601fa3a3b369a55044d95025eeb5"],"tree_size":4,"algorithm":"rfc6962"}}],"audit_signature":{"proof":{"type":"DataIntegrityProof","cryptosuite":"eddsa-jcs-2022","verificationMethod":"did:key:z6MktGCknd2KA2Gnsb4BDLCyeya2SWGfqbEATi32TgQk1L29","proofPurpose":"assertionMethod","created":"2026-07-21T00:00:00.000Z","proofValue":"z5JZ3MQDvEHK7ywMHhrhaGn2dFGbNJ2unFgCBp72itPrM7c3eAG3tpZcrw3HA7uB14WjbCGx5UNTRr4s5hyUeJwtD"}}};
const TAMPERED = {"@context":"https://ainumbers.co/chaingraph/context/v0.3/context.jsonld","chaingraph_version":"0.4.0","mandate_type":"compliance_mandate","tool_id":"568-ocg-receipt-verifier-fixture-source","tool_version":"1.0.0","generated_at":"2026-07-21T00:00:00.000Z","execution_hash":"eea6041adc4c9457e45de5133cca0a43e81a872219980c2176704aa5a48dc3e2","chain":{"parent_hashes":[],"parent_tool_ids":[],"chain_depth":0},"policy_parameters":{"activity":"av_verify_1_fixture","jurisdiction":"US","amount_usd":48250,"counterparty":"fixture-counterparty-01"},"output_payload":{"risk_score":0.14,"decision":"DENY","rule_set":"av-verify-1-golden-v1"},"compliance_flags":["AV_VERIFY_1_GOLDEN_FIXTURE"],"compute_mode":"browser","anchor_bindings":[{"type":"opentimestamps","anchored_hash":"sha256:cee200515da21290f8b718f2e2ebc84c67d064b0314c0cf6cf42f40a7908e974","log_origin":"av-verify-1-fixture-batch","proof":"AV-VERIFY-1-FIXTURE-OTS-PROOF-PLACEHOLDER","merkle_inclusion":{"leaf":"eea6041adc4c9457e45de5133cca0a43e81a872219980c2176704aa5a48dc3e2","index":1,"path":["sha256:76b937f2d58d028736ae6fed649daca596d24645d8ffca2ed247818d2f046a7e","sha256:ab330f2fc3b6cc19814dfb2d0255f0fcc597601fa3a3b369a55044d95025eeb5"],"tree_size":4,"algorithm":"rfc6962"}}],"audit_signature":{"proof":{"type":"DataIntegrityProof","cryptosuite":"eddsa-jcs-2022","verificationMethod":"did:key:z6MktGCknd2KA2Gnsb4BDLCyeya2SWGfqbEATi32TgQk1L29","proofPurpose":"assertionMethod","created":"2026-07-21T00:00:00.000Z","proofValue":"z5JZ3MQDvEHK7ywMHhrhaGn2dFGbNJ2unFgCBp72itPrM7c3eAG3tpZcrw3HA7uB14WjbCGx5UNTRr4s5hyUeJwtD"}}};

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  ✓ ' + name); passed++; } catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('ocg-receipt-verifier-568-tamper.test.mjs (tools/568-ocg-receipt-verifier.html)');

const goldenReport = await verifyReceipt(GOLDEN, {});
test('golden receipt (real Ed25519 sig + real Merkle inclusion): verdict PASS', () => {
  assert(goldenReport.verdict === 'PASS', 'Expected PASS, got ' + goldenReport.verdict + ' — checks: ' + JSON.stringify(goldenReport.checks));
});

const tamperedReport = await verifyReceipt(TAMPERED, {});
test('tampered receipt (output_payload.decision mutated post-signing): verdict FAILS', () => {
  assert(tamperedReport.verdict === 'FAIL', 'Expected FAIL, got ' + tamperedReport.verdict);
  assert(tamperedReport.hash_match === false, 'Expected hash_match=false after tamper');
});

const wrongSigReport = await verifyReceipt({ ...GOLDEN, audit_signature: { proof: { ...GOLDEN.audit_signature.proof, proofValue: GOLDEN.audit_signature.proof.proofValue.slice(0, -4) + 'AAAA' } } }, {});
test('flipped signature bytes: signature check FAILS', () => {
  assert(wrongSigReport.signature.allValid === false, 'Expected signature.allValid=false after flipping proofValue bytes');
  assert(wrongSigReport.verdict === 'FAIL', 'Expected overall verdict FAIL with a bad signature');
});

const wrongMerklePath = JSON.parse(JSON.stringify(GOLDEN));
wrongMerklePath.anchor_bindings[0].merkle_inclusion.path[0] = 'sha256:' + '00'.repeat(32);
const wrongMerkleReport = await verifyReceipt(wrongMerklePath, {});
test('corrupted Merkle inclusion path: anchor check FAILS', () => {
  assert(wrongMerkleReport.anchors[0].pass === false, 'Expected anchor pass=false with corrupted path');
  assert(wrongMerkleReport.verdict === 'FAIL', 'Expected overall verdict FAIL with a corrupted Merkle path');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
