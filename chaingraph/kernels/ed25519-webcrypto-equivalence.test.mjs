// ed25519-webcrypto-equivalence.test.mjs — FV-ED25519-NOBLE-1.
//
// WHY THIS FILE EXISTS — a recorded, tested divergence, not a silent one.
//
// art-129 and art-284 verify Ed25519 signatures. Their kernels now do it with the vendored
// _noble-ed25519.bundle.mjs; their node PAGES still do it with globalThis.crypto.subtle. Two
// implementations of the same verification step is exactly the shape that produced the defect
// this row closes (the page path worked while the guest path silently computed nothing), so the
// divergence is pinned here rather than left to be discovered.
//
// The kernels moved off crypto.subtle because they had to: the QuickJS interpreter inside the
// RISC Zero zkVM guest has NO WebCrypto at all — crypto.subtle is ABSENT, not slow — so an
// `await crypto.subtle.verify(...)` inside compute() could never execute in-guest. The guest
// canonicalized the returned promise to {} and sealed a receipt that attested nothing.
//
// WHAT IS ASSERTED HERE:
//   1. compute() is synchronous in both kernels (a thenable canonicalizes to {} in-guest).
//   2. Fixture-level equivalence: every (public key, message, signature) triple the golden
//      fixtures actually exercise verifies IDENTICALLY under noble and under crypto.subtle.
//      The triples are reconstructed from the fixtures and then cross-checked against the
//      verdicts the kernels record, so a wrong reconstruction fails loudly instead of passing
//      vacuously.
//   3. RFC 8032 §7.1 known-answer vectors, accept and reject.
//   4. A randomized differential against crypto.subtle over accept AND reject vectors.
//   5. The ONE known divergence class, asserted in the fail-closed direction only.
//
// THE KNOWN DIVERGENCE, measured rather than assumed. noble is configured `zip215: false`
// (strict RFC 8032). On the edge vectors where verification modes provably differ — small-order
// public keys, small-order R, non-canonical S, non-canonical y — strict mode disagrees with
// Node/OpenSSL WebCrypto on 2 of 27 probed cases and ZIP-215 mode disagrees on 22 of 27, which is
// why strict was chosen. Both residual disagreements are cases where WebCrypto ACCEPTS a
// signature under a degenerate small-order key and noble REFUSES it. That is the fail-closed
// direction: no signature noble accepts is one WebCrypto rejects. Only an attacker-chosen
// small-order key reaches this class, and such a key verifies arbitrary messages, so refusing it
// is the behaviour a compliance verifier wants. Property 5 asserts that direction holds.
//
// Run: node chaingraph/kernels/ed25519-webcrypto-equivalence.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ed25519 } from './_noble-ed25519.bundle.mjs';
import { compute as compute129 } from './art-129-webbotauth-signature-verifier.kernel.mjs';
import { compute as compute284 } from './art-284-did-webvh-log-verifier.kernel.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const subtle = globalThis.crypto.subtle;
const VERIFY_OPTS = { zip215: false };

let failures = 0;
function ok(name, cond, detail) {
  if (!cond) { failures++; console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

const b64uToBytes = (s) => {
  let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return new Uint8Array(Buffer.from(t, 'base64'));
};
const b64ToBytes = (s) => new Uint8Array(Buffer.from(String(s), 'base64'));
const cgCanon = (v) => Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {}) : v;

async function wcVerify(pubRaw, sig, msg) {
  try {
    const jwk = { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(pubRaw).toString('base64url') };
    const key = await subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, key, sig, msg) === true;
  } catch { return false; }
}
const nobleVerify = (pubRaw, sig, msg) => {
  try { return ed25519.verify(sig, msg, pubRaw, VERIFY_OPTS) === true; } catch { return false; }
};

const fixtures = (id) => JSON.parse(readFileSync(path.join(__dirname, 'fixtures', `${id}.fixtures.json`), 'utf8'));

// ── 0. The inlined copies are byte-identical to the bundle SSOT ────────────────────────────
// Kernels cannot import the bundle — chaingraph/vm/kernel-vm.mjs strips every ESM import before
// running a kernel in QuickJS, and the zkVM guest loads it the same way, so an imported symbol is
// undefined in both. Each kernel therefore carries its own inlined copy (art-591 and art-424 do
// the same). This pins those copies to the bundle so the three can never drift apart.
{
  const bundleText = readFileSync(path.join(__dirname, '_noble-ed25519.bundle.mjs'), 'utf8');
  const start = bundleText.indexOf('// ── @noble/hashes utils.js');
  ok('bundle carries the vendored-body start marker', start >= 0);
  const body = bundleText.slice(start).replace(/\n*export \{[^}]*\};\s*$/, '').trimEnd();
  ok('vendored body is non-trivial', body.length > 50_000, `${body.length} bytes`);
  for (const id of ['art-129-webbotauth-signature-verifier', 'art-284-did-webvh-log-verifier']) {
    const src = readFileSync(path.join(__dirname, `${id}.kernel.mjs`), 'utf8');
    ok(`${id} inlines the bundle body byte-identically`, src.includes(body));
    ok(`${id} does not import the bundle`, !/^import\s+.*_noble-ed25519\.bundle\.mjs/m.test(src));
  }
}

// ── 1. compute() is synchronous ────────────────────────────────────────────────────────────
{
  const f129 = fixtures('art-129-webbotauth-signature-verifier');
  const f284 = fixtures('art-284-did-webvh-log-verifier');
  const r129 = compute129(f129.vectors[0].policy_parameters);
  const r284 = compute284(f284.vectors[0].policy_parameters);
  ok('art-129 compute() is not a thenable', typeof r129?.then !== 'function');
  ok('art-284 compute() is not a thenable', typeof r284?.then !== 'function');
  ok('art-129 compute() returns a populated object', r129 && Object.keys(r129).length > 0);
  ok('art-284 compute() returns a populated object', r284 && Object.keys(r284).length > 0);
}

// ── 2. Fixture-level equivalence, triples reconstructed from the golden fixtures ────────────
// art-129: RFC 9421 §2.5 signature base — one line per covered component, then @signature-params.
function art129Triples() {
  const out = [];
  for (const v of fixtures('art-129-webbotauth-signature-verifier').vectors) {
    const pp = v.policy_parameters;
    if (!pp.public_key_jwk || !pp.signature_b64 || !Array.isArray(pp.covered_components) || !pp.signature_params) continue;
    const lines = pp.covered_components.map((c) => `"${String(c.name).toLowerCase()}": ${c.value}`);
    lines.push(`"@signature-params": ${pp.signature_params}`);
    out.push({
      label: `art-129/${v.name}`,
      pub: b64uToBytes(pp.public_key_jwk.x),
      sig: b64ToBytes(pp.signature_b64),
      msg: new TextEncoder().encode(lines.join('\n')),
      kernelSaid: compute129(pp).output_payload.signature_cryptographically_valid,
    });
  }
  return out;
}
// art-284: the signed message is the JCS-canonical entry input; did:key z-form carries the raw key.
function b58decode(str) {
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let z = 0;
  while (z < str.length && str[z] === '1') z++;
  let num = 0n;
  for (let i = z; i < str.length; i++) {
    const c = B58.indexOf(str[i]);
    if (c < 0) throw new Error('bad base58');
    num = num * 58n + BigInt(c);
  }
  const bytes = [];
  while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
  return new Uint8Array([...Array(z).fill(0), ...bytes]);
}
function art284Triples() {
  const out = [];
  for (const v of fixtures('art-284-did-webvh-log-verifier').vectors) {
    const pp = v.policy_parameters;
    if (!Array.isArray(pp.did_log)) continue;
    let prior = null;
    for (let idx = 0; idx < pp.did_log.length; idx++) {
      const e = pp.did_log[idx] ?? {};
      const parameters = e.parameters ?? {};
      const priorRef = idx === 0 ? (parameters.scid ?? null) : prior;
      const entryInput = { versionId: priorRef, versionTime: e.versionTime ?? null, parameters, state: e.state ?? null };
      const msg = new TextEncoder().encode(JSON.stringify(cgCanon(entryInput)));
      const proofs = Array.isArray(e.proof) ? e.proof : (e.proof ? [e.proof] : []);
      for (const proof of proofs) {
        const vm = typeof proof.verificationMethod === 'string' ? proof.verificationMethod.split('#')[0] : proof.verificationMethod;
        if (typeof vm !== 'string' || vm.indexOf('did:key:z') !== 0) continue;
        const prefixed = b58decode(vm.slice('did:key:z'.length));
        if (prefixed[0] !== 0xed || prefixed[1] !== 0x01) continue;
        out.push({ label: `art-284/${v.name}#${idx}`, pub: prefixed.slice(2), sig: b64ToBytes(proof.proofValue), msg });
      }
      prior = e.versionId;
    }
  }
  return out;
}

{
  const triples = [...art129Triples(), ...art284Triples()];
  ok('fixture triples were extracted', triples.length >= 5, `got ${triples.length}`);
  let agreed = 0, acc = 0, rej = 0;
  for (const t of triples) {
    const n = nobleVerify(t.pub, t.sig, t.msg);
    const w = await wcVerify(t.pub, t.sig, t.msg);
    ok(`equivalence ${t.label}`, n === w, `noble=${n} webcrypto=${w}`);
    if (n === w) agreed++;
    if (n) acc++; else rej++;
    // Cross-check the reconstruction against what the kernel itself concluded, so a wrong
    // message reconstruction cannot make this test pass vacuously.
    if (t.kernelSaid !== undefined) {
      ok(`reconstruction matches kernel verdict ${t.label}`, n === t.kernelSaid, `reconstructed=${n} kernel=${t.kernelSaid}`);
    }
  }
  ok('fixtures exercise at least one accepting signature', acc >= 1);
  ok('fixtures exercise at least one rejecting signature', rej >= 1);
  console.log(`  fixture-level equivalence: ${agreed}/${triples.length} triples agree (${acc} accept, ${rej} reject)`);
}

// ── 3. RFC 8032 §7.1 known-answer vectors ──────────────────────────────────────────────────
{
  const KAT = [
    { pk: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a', msg: '', sig: 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b' },
    { pk: '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c', msg: '72', sig: '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00' },
    { pk: 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025', msg: 'af82', sig: '6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a' },
  ];
  for (const [i, v] of KAT.entries()) {
    const pk = Buffer.from(v.pk, 'hex'), msg = Buffer.from(v.msg, 'hex'), sig = Buffer.from(v.sig, 'hex');
    ok(`rfc8032[${i}] accepts`, nobleVerify(pk, sig, msg) === true);
    const bad = Buffer.from(sig); bad[10] ^= 1;
    ok(`rfc8032[${i}] rejects a flipped bit`, nobleVerify(pk, bad, msg) === false);
  }
}

// ── 4. Randomized differential vs crypto.subtle, accept AND reject ─────────────────────────
{
  let agree = 0, total = 0, acc = 0, rej = 0;
  for (let i = 0; i < 20; i++) {
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
    const msg = randomBytes(1 + (i % 41));
    const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, kp.privateKey, msg));
    const otherKp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const otherPub = new Uint8Array(await subtle.exportKey('raw', otherKp.publicKey));
    const flipSig = sig.slice(); flipSig[i % 64] ^= 1;
    const flipMsg = Buffer.from(msg); flipMsg[i % flipMsg.length] ^= 1;
    const cases = [
      ['valid', pub, sig, msg, true],
      ['sig-bitflip', pub, flipSig, msg, false],
      ['msg-bitflip', pub, sig, flipMsg, false],
      ['wrong-key', otherPub, sig, msg, false],
      ['truncated-sig', pub, sig.slice(0, 63), msg, false],
    ];
    for (const [name, p, s, m, expect] of cases) {
      const n = nobleVerify(p, s, m);
      const w = await wcVerify(p, s, m);
      total++;
      if (n === w) agree++; else ok(`differential ${name}`, false, `noble=${n} webcrypto=${w}`);
      ok(`differential ${name} expectation`, n === expect);
      if (expect) acc++; else rej++;
    }
  }
  ok('randomized differential fully agrees', agree === total, `${agree}/${total}`);
  console.log(`  randomized differential: ${agree}/${total} agree (${acc} accept, ${rej} reject)`);
}

// ── 5. The known divergence class, asserted fail-closed ────────────────────────────────────
{
  const TORSION = [
    '0100000000000000000000000000000000000000000000000000000000000000',
    'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
    '0000000000000000000000000000000000000000000000000000000000000080',
    '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
    'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
    '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85',
    '0000000000000000000000000000000000000000000000000000000000000000',
    'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
  ];
  const msg = Buffer.from('edge', 'utf8');
  let probed = 0, nobleStricter = 0;
  for (const pk of TORSION) {
    for (const r of [TORSION[0], TORSION[2], TORSION[6]]) {
      const pub = Buffer.from(pk, 'hex');
      const sig = Buffer.concat([Buffer.from(r, 'hex'), Buffer.alloc(32, 0)]);
      const n = nobleVerify(pub, sig, msg);
      const w = await wcVerify(pub, sig, msg);
      probed++;
      // THE INVARIANT: noble must never accept what WebCrypto rejects. The reverse is permitted
      // and is the documented divergence.
      ok('small-order divergence stays fail-closed', !(n === true && w === false), `pk=${pk.slice(0, 8)} R=${r.slice(0, 8)}`);
      if (!n && w) nobleStricter++;
    }
  }
  // Non-canonical encodings: both implementations must refuse.
  const nonCanon = [
    ['S == L', Buffer.from(TORSION[0], 'hex'), Buffer.concat([Buffer.from(TORSION[0], 'hex'), Buffer.from('edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010', 'hex')])],
    ['S all-ff', Buffer.from(TORSION[0], 'hex'), Buffer.concat([Buffer.from(TORSION[0], 'hex'), Buffer.alloc(32, 0xff)])],
    ['pk y >= p', Buffer.alloc(32, 0xff), Buffer.concat([Buffer.from(TORSION[0], 'hex'), Buffer.alloc(32, 0)])],
  ];
  for (const [name, pub, sig] of nonCanon) {
    ok(`non-canonical ${name} refused by noble`, nobleVerify(pub, sig, msg) === false);
    ok(`non-canonical ${name} refused by WebCrypto`, await wcVerify(pub, sig, msg) === false);
  }
  console.log(`  small-order probe: ${probed} cases, noble stricter than WebCrypto in ${nobleStricter}, noble laxer in 0`);
}

if (failures) {
  console.error(`\n✗ ed25519 <-> WebCrypto equivalence FAILED — ${failures} assertion(s)`);
  process.exit(1);
}
console.log('✓ ed25519 kernels (noble) and the pages\' crypto.subtle path agree on every fixture triple; the only divergence class is fail-closed');
