// ics23-verify.test.mjs — regression proof for ics23-verify.mjs against cosmos/ics23's own
// published test vectors (fixtures/ics23-testvectors/, provenance in that dir's PROVENANCE.md),
// plus the offline-verify invariant (ICS23-VERIFY-MODULE-1 done-criteria).
//
// Run: node chaingraph/kernels/ics23-verify.test.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyExistence, verifyNonExistence, checkAgainstSpec,
  IAVL_SPEC, TENDERMINT_SPEC, SMT_SPEC,
} from './ics23-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures/ics23-testvectors');

// -------------------------------------------------------------------------------------------
// Minimal protobuf reader — scoped to CommitmentProof/ExistenceProof/NonExistenceProof/LeafOp/
// InnerOp (proofs.proto field numbers), test-harness-only. NOT part of the shipped module: the
// module never accepts a spec or proof as raw protobuf bytes, only as plain JS objects.
// -------------------------------------------------------------------------------------------

function decodeVarint(buf, pos) {
  let result = 0, shift = 0, b;
  do {
    b = buf[pos++];
    result += (b & 0x7f) * 2 ** shift;
    shift += 7;
  } while (b & 0x80);
  return [result, pos];
}

function decodeMessage(buf, start, end) {
  const fields = {};
  let pos = start;
  while (pos < end) {
    let tag;
    [tag, pos] = decodeVarint(buf, pos);
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x7;
    let value;
    if (wireType === 0) {
      [value, pos] = decodeVarint(buf, pos);
    } else if (wireType === 2) {
      let len;
      [len, pos] = decodeVarint(buf, pos);
      value = buf.slice(pos, pos + len);
      pos += len;
    } else {
      throw new Error(`protobuf test-reader: unsupported wire type ${wireType} at field ${fieldNum}`);
    }
    (fields[fieldNum] ??= []).push(value);
  }
  return fields;
}

function decodeLeafOp(bytes) {
  const f = decodeMessage(bytes, 0, bytes.length);
  return {
    hash: f[1]?.[0] ?? 0,
    prehash_key: f[2]?.[0] ?? 0,
    prehash_value: f[3]?.[0] ?? 0,
    length: f[4]?.[0] ?? 0,
    prefix: f[5]?.[0] ?? new Uint8Array(0),
  };
}

function decodeInnerOp(bytes) {
  const f = decodeMessage(bytes, 0, bytes.length);
  return { hash: f[1]?.[0] ?? 0, prefix: f[2]?.[0] ?? new Uint8Array(0), suffix: f[3]?.[0] };
}

function decodeExistenceProof(bytes) {
  const f = decodeMessage(bytes, 0, bytes.length);
  return {
    key: f[1]?.[0] ?? new Uint8Array(0),
    value: f[2]?.[0] ?? new Uint8Array(0),
    leaf: f[3]?.[0] ? decodeLeafOp(f[3][0]) : undefined,
    path: (f[4] ?? []).map(decodeInnerOp),
  };
}

function decodeNonExistenceProof(bytes) {
  const f = decodeMessage(bytes, 0, bytes.length);
  return {
    key: f[1]?.[0] ?? new Uint8Array(0),
    left: f[2]?.[0] ? decodeExistenceProof(f[2][0]) : null,
    right: f[3]?.[0] ? decodeExistenceProof(f[3][0]) : null,
  };
}

function decodeCommitmentProof(bytes) {
  const f = decodeMessage(bytes, 0, bytes.length);
  if (f[1]) return { type: 'exist', proof: decodeExistenceProof(f[1][0]) };
  if (f[2]) return { type: 'nonexist', proof: decodeNonExistenceProof(f[2][0]) };
  throw new Error('protobuf test-reader: CommitmentProof has neither exist nor nonexist set');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function b64ToBytes(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function decodeLeafOpJson(o) {
  if (!o) return undefined;
  return {
    hash: o.hash ?? 0, prehash_key: o.prehash_key ?? 0, prehash_value: o.prehash_value ?? 0,
    length: o.length ?? 0, prefix: o.prefix ? b64ToBytes(o.prefix) : new Uint8Array(0),
  };
}

function decodeInnerOpJson(o) {
  return {
    hash: o.hash ?? 0,
    prefix: o.prefix ? b64ToBytes(o.prefix) : new Uint8Array(0),
    suffix: o.suffix !== undefined ? b64ToBytes(o.suffix) : undefined,
  };
}

function decodeSpecJson(s) {
  return {
    leaf_spec: {
      hash: s.leaf_spec?.hash ?? 0, prehash_key: s.leaf_spec?.prehash_key ?? 0,
      prehash_value: s.leaf_spec?.prehash_value ?? 0, length: s.leaf_spec?.length ?? 0,
      prefix: s.leaf_spec?.prefix ? b64ToBytes(s.leaf_spec.prefix) : new Uint8Array(0),
    },
    inner_spec: {
      child_order: s.inner_spec?.child_order ?? [0, 1],
      child_size: s.inner_spec?.child_size ?? 0,
      min_prefix_length: s.inner_spec?.min_prefix_length ?? 0,
      max_prefix_length: s.inner_spec?.max_prefix_length ?? 0,
      empty_child: s.inner_spec?.empty_child ? b64ToBytes(s.inner_spec.empty_child) : new Uint8Array(0),
      hash: s.inner_spec?.hash ?? 0,
    },
    max_depth: s.max_depth ?? 0,
    min_depth: s.min_depth ?? 0,
    prehash_key_before_comparison: s.prehash_key_before_comparison ?? false,
  };
}

// -------------------------------------------------------------------------------------------
// 1. Existence/non-existence vectors — all expected PASS (they are golden valid proofs).
// -------------------------------------------------------------------------------------------

const SPECS = { iavl: IAVL_SPEC, tendermint: TENDERMINT_SPEC, smt: SMT_SPEC };
let pass = 0, fail = 0;
const failures = [];

for (const specName of ['iavl', 'tendermint', 'smt']) {
  const dir = resolve(FIXDIR, specName);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const doc = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
    const root = hexToBytes(doc.root);
    const key = hexToBytes(doc.key);
    const proofBytes = hexToBytes(doc.proof);
    const decoded = decodeCommitmentProof(proofBytes);
    const label = `${specName}/${file}`;
    try {
      if (decoded.type === 'exist') {
        const value = hexToBytes(doc.value);
        await verifyExistence(decoded.proof, SPECS[specName], root, key, value);
      } else {
        await verifyNonExistence(decoded.proof, SPECS[specName], root, key);
      }
      pass++;
    } catch (e) {
      fail++;
      failures.push(`${label}: expected PASS, got FAIL — ${e.message}`);
    }
  }
}

// -------------------------------------------------------------------------------------------
// 2. TestCheckAgainstSpecData.json — the direct VSA-2022-103 regression fixture. Each case
//    names an expected Err ("" = accept, non-empty = reject); byte-identical PASS/FAIL verdict
//    is what's being proven here, not the exact error text (BUILD-SPEC's own stated bar).
// -------------------------------------------------------------------------------------------

const checkSpecDoc = JSON.parse(readFileSync(resolve(FIXDIR, 'TestCheckAgainstSpecData.json'), 'utf8'));
let checkPass = 0, checkFail = 0;
for (const [name, tc] of Object.entries(checkSpecDoc)) {
  const proof = {
    key: tc.Proof.key ? b64ToBytes(tc.Proof.key) : new Uint8Array(0),
    value: tc.Proof.value ? b64ToBytes(tc.Proof.value) : new Uint8Array(0),
    leaf: decodeLeafOpJson(tc.Proof.leaf),
    path: (tc.Proof.path ?? []).map(decodeInnerOpJson),
  };
  const spec = decodeSpecJson(tc.Spec);
  const expectFail = !!tc.Err && tc.Err.length > 0;
  let actualFail = false, message = '';
  try {
    checkAgainstSpec(proof, spec);
  } catch (e) {
    actualFail = true;
    message = e.message;
  }
  if (actualFail === expectFail) {
    checkPass++;
  } else {
    checkFail++;
    failures.push(
      `TestCheckAgainstSpecData/"${name}": expected ${expectFail ? 'FAIL' : 'PASS'}` +
      `(Err="${tc.Err}"), got ${actualFail ? 'FAIL' : 'PASS'}${actualFail ? ` (${message})` : ''}`,
    );
  }
}

// -------------------------------------------------------------------------------------------
// 3. Offline-verify invariant — poison global.fetch, confirm verify still works unchanged.
// -------------------------------------------------------------------------------------------

let offlineOk = false, offlineNote = '';
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('ics23-verify.test.mjs: fetch must never be called by the verifier'); };
  try {
    const dir = resolve(FIXDIR, 'iavl');
    const doc = JSON.parse(readFileSync(resolve(dir, 'exist_left.json'), 'utf8'));
    const decoded = decodeCommitmentProof(hexToBytes(doc.proof));
    const result = await verifyExistence(
      decoded.proof, IAVL_SPEC, hexToBytes(doc.root), hexToBytes(doc.key), hexToBytes(doc.value),
    );
    offlineOk = result === true;
    offlineNote = `verifyExistence(iavl/exist_left) returned ${result} with global.fetch poisoned to throw`;
  } catch (e) {
    offlineOk = false;
    offlineNote = `unexpected throw with fetch poisoned: ${e.message}`;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// -------------------------------------------------------------------------------------------
// Report
// -------------------------------------------------------------------------------------------

console.log(`existence/non-existence vectors: ${pass} pass, ${fail} fail (18 expected: 3 specs x 6 fixtures each)`);
console.log(`TestCheckAgainstSpecData.json:    ${checkPass} pass, ${checkFail} fail (${Object.keys(checkSpecDoc).length} cases)`);
console.log(`offline-verify invariant:         ${offlineOk ? 'PASS' : 'FAIL'} — ${offlineNote}`);

if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error(`  ✗ ${f}`);
}

if (fail === 0 && checkFail === 0 && offlineOk) {
  console.log(`\n✓ ics23-verify regression clean: ${pass + checkPass} total vectors byte-identical PASS/FAIL, offline-verify confirmed.`);
  process.exit(0);
} else {
  console.error('\n✗ ics23-verify regression FAILED.');
  process.exit(1);
}
