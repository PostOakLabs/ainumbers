// scripts/gen-registry-absence-tree.test.mjs — proof-pipeline + mutation tests for
// gen-registry-absence-tree.mjs / REGISTRY-ABSENCE-TREE-BUILD-1, verified against the LANDED
// verifier (chaingraph/kernels/ics23-verify.mjs) with its fourth frozen preset
// AINUMBERS_SIMPLE_SPEC. This file never verifies anything itself.
//
// Covers the row's done-criteria:
//   · caller-supplied spec objects REJECTED by the verify entry points (output quoted)
//   · existence + non-existence proofs generated and verified against the landed verifier,
//     over synthetic trees AND the real F2 key set, counts quoted
//   · adjacency mutation: two genuinely valid but NON-adjacent existence proofs REJECTED as a
//     non-existence proof (output quoted)
//   · empty-tree and single-leaf cases assert FAILING, not passing (output quoted)
//
// Run: node scripts/gen-registry-absence-tree.test.mjs
// Wired into scripts/preflight.mjs (REGISTRY-ABSENCE-TREE-BUILD-1 controls entry).

import {
  verifyExistence, verifyNonExistence, AINUMBERS_SIMPLE_SPEC,
} from '../chaingraph/kernels/ics23-verify.mjs';
import {
  loadKeySet, buildAbsenceTree, existenceProofAt, nonExistenceProofFor, PROOFSPEC_NAME,
} from './gen-registry-absence-tree.mjs';
import { sha256, bytesToHex } from '../chaingraph/kernels/c2sp-tlog-verify.mjs';

let pass = 0, fail = 0;
const failures = [];

function compareAll(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function ok(label) { pass++; console.log(`  ✓ ${label}`); }
function bad(label, detail) {
  fail++;
  failures.push(`${label}: ${detail}`);
  console.error(`  ✗ ${label}: ${detail}`);
}

// A verify call that MUST throw with the pinned-spec rejection message.
async function expectPinnedRejection(label, fn) {
  try {
    await fn();
    bad(label, 'expected the caller-supplied spec to be REJECTED, but verification PASSED');
  } catch (e) {
    if (e.message.includes('not one of this module\'s four pinned build-time presets')) {
      ok(`${label} rejected — "${e.message}"`);
    } else {
      bad(label, `rejected, but with the WRONG error: ${e.message}`);
    }
  }
}

// A verify call that MUST throw (any message) — used for the adjacency + range mutations.
async function expectRejection(label, fn) {
  try {
    await fn();
    bad(label, 'expected REJECTION, but verification PASSED');
  } catch (e) {
    ok(`${label} rejected — "${e.message}"`);
  }
}

// ---------------------------------------------------------------------------
// Synthetic key sets — deterministic 32-byte keys, so tree shapes at n = 2..17
// (odd promotion, left-most, right-most, deep gaps) are all exercised cheaply.
// ---------------------------------------------------------------------------

async function syntheticEntries(n) {
  const entries = [];
  for (let i = 0; i < n; i++) {
    const keyBytes = await sha256(new TextEncoder().encode(`gen-registry-absence-tree.test fixture key ${i}`));
    entries.push({
      hex: bytesToHex(keyBytes),
      keyBytes,
      record: { kernel_digest: `sha256:${bytesToHex(keyBytes)}`, spec_version: 'test', note: `synthetic fixture record ${i} (gen-registry-absence-tree.test.mjs — not a real F2 record)` },
    });
  }
  entries.sort((a, b) => {
    for (let i = 0; i < 32; i++) if (a.keyBytes[i] !== b.keyBytes[i]) return a.keyBytes[i] - b.keyBytes[i];
    return 0;
  });
  return entries;
}

async function verifyAll(tree, label) {
  const { entries, root, count } = tree;
  let exist = 0, nonexist = 0;
  for (let i = 0; i < count; i++) {
    const proof = existenceProofAt(tree, i, entries[i]);
    await verifyExistence(proof, AINUMBERS_SIMPLE_SPEC, root, entries[i].keyBytes, proof.value);
    exist++;
  }
  // Every gap, including both edges: n+1 absent keys.
  for (let i = 0; i <= count; i++) {
    const absent = await sha256(new TextEncoder().encode(`${label} absent gap ${i}`));
    const proof = nonExistenceProofFor(tree, absent);
    await verifyNonExistence(proof, AINUMBERS_SIMPLE_SPEC, root, absent);
    nonexist++;
  }
  return { exist, nonexist };
}

// ---------------------------------------------------------------------------
// 1. Synthetic shapes.
// ---------------------------------------------------------------------------

console.log('synthetic trees (verify every existence + every gap against ics23-verify.mjs):');
for (const n of [2, 3, 4, 5, 8, 17]) {
  const tree = await buildAbsenceTree(await syntheticEntries(n));
  const { exist, nonexist } = await verifyAll(tree, `synthetic-n${n}`);
  if (exist === n && nonexist === n + 1) {
    ok(`n=${n}: ${exist} existence + ${nonexist} non-existence proofs verified`);
  } else {
    bad(`n=${n}`, `expected ${n}+${n + 1} verifications, ran ${exist}+${nonexist}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Real F2 key set — every existence proof, every gap.
// ---------------------------------------------------------------------------

console.log('real F2 key set (registry/kernel/*):');
const realTree = await buildAbsenceTree(loadKeySet());
const real = await verifyAll(realTree, 'real-f2');
if (real.exist === realTree.count && real.nonexist === realTree.count + 1) {
  ok(`n=${realTree.count}: ${real.exist} existence + ${real.nonexist} non-existence proofs verified against root ${bytesToHex(realTree.root)}`);
} else {
  bad('real F2', `expected ${realTree.count}+${realTree.count + 1} verifications, ran ${real.exist}+${real.nonexist}`);
}

// ---------------------------------------------------------------------------
// 3. Adjacency mutation — two genuinely valid but NON-adjacent existence proofs
//    presented as a non-existence proof for the key BETWEEN them (which is
//    present). The verifier must reject: the gap is not proven.
// ---------------------------------------------------------------------------

console.log('adjacency mutation (valid proofs, non-adjacent, rejected as non-existence):');
{
  const { entries, root } = realTree;
  const i = entries.findIndex((_, idx) => idx % 2 === 0 && idx >= 1 && idx + 2 < entries.length);
  const leftProof = existenceProofAt(realTree, i, entries[i]);
  const rightProof = existenceProofAt(realTree, i + 2, entries[i + 2]);
  // Control: each mutated proof is GENUINELY valid on its own.
  await verifyExistence(leftProof, AINUMBERS_SIMPLE_SPEC, root, entries[i].keyBytes, leftProof.value);
  await verifyExistence(rightProof, AINUMBERS_SIMPLE_SPEC, root, entries[i + 2].keyBytes, rightProof.value);
  ok(`controls: existence proofs for indices ${i} and ${i + 2} both verify individually (they are genuinely valid)`);
  const forgedKey = entries[i + 1].keyBytes; // present key between the two proofs
  await expectRejection(
    `non-adjacent pair (indices ${i} / ${i + 2}) as non-existence of present key ${i + 1}`,
    () => verifyNonExistence({ key: forgedKey, left: leftProof, right: rightProof }, AINUMBERS_SIMPLE_SPEC, root, forgedKey),
  );
  // Same-shape control with the TRUE adjacent pair: must pass (the mutation, not the shape, is what fails).
  // The claimed key must lie strictly between keys[i] and keys[i+1], so it is constructed from
  // the pair itself: bump the first differing byte of key(i) by one (strictly greater than
  // key(i); strictly less than key(i+1) unless the +1 collides with key(i+1)'s byte and every
  // remaining byte of key(i+1) is zero — that i is skipped, and the scan fails loudly if no
  // usable pair exists, rather than testing nothing).
  const betweenKey = (a, b) => {
    const out = a.slice();
    for (let p = 0; p < a.length; p++) {
      if (a[p] !== b[p]) {
        if (a[p] + 1 < b[p]) { out[p] = a[p] + 1; return out; }
        if (a[p] + 1 === b[p] && !b.slice(p + 1).some((v) => v !== 0)) return null;
        // +1 collides with b[p] but b has a non-zero tail: out keeps a[p]+1 with zero tail,
        // which is strictly between — handled below by the strict re-check anyway.
        out[p] = a[p] + 1;
        return out;
      }
      out[p] = a[p];
    }
    return null; // identical keys — impossible in a validated sorted set
  };
  let controlKey = null, controlIndex = -1;
  for (let k = 0; k + 1 < entries.length; k++) {
    const cand = betweenKey(entries[k].keyBytes, entries[k + 1].keyBytes);
    if (!cand) continue;
    if (compareAll(cand, entries[k].keyBytes) > 0 && compareAll(cand, entries[k + 1].keyBytes) < 0) {
      controlKey = cand; controlIndex = k; break;
    }
  }
  if (!controlKey) bad('adjacent-pair control', 'no constructible between-key found in the whole key set — test bug');
  else {
    const absent = controlKey;
    const ctrlLeft = existenceProofAt(realTree, controlIndex, entries[controlIndex]);
    const ctrlRight = existenceProofAt(realTree, controlIndex + 1, entries[controlIndex + 1]);
    await verifyNonExistence(
      { key: absent, left: ctrlLeft, right: ctrlRight },
      AINUMBERS_SIMPLE_SPEC, root, absent,
    );
    ok(`control: genuinely adjacent pair (${controlIndex}, ${controlIndex + 1}) brackets a real gap and verifies`);
  }
}

// ---------------------------------------------------------------------------
// 4. Caller-supplied spec objects are REJECTED by the verify entry points.
// ---------------------------------------------------------------------------

console.log('caller-supplied spec rejection (pinning rule, BUILD-SPEC §4.3):');
{
  const { entries, root } = realTree;
  const i = 1;
  const proof = existenceProofAt(realTree, i, entries[i]);
  await expectPinnedRejection(
    'ainumbers clone with mutated max_depth',
    () => verifyExistence(proof, { ...AINUMBERS_SIMPLE_SPEC, max_depth: 32 }, root, entries[i].keyBytes, proof.value),
  );
  await expectPinnedRejection(
    'hand-built spec with widened inner prefix bounds',
    () => verifyExistence(proof, {
      name: PROOFSPEC_NAME,
      leaf_spec: { hash: 1, prehash_key: 0, prehash_value: 1, length: 0, prefix: Uint8Array.of(0x00) },
      inner_spec: { child_order: [0, 1], min_prefix_length: 1, max_prefix_length: 2, child_size: 32, hash: 1 },
      max_depth: 64, min_depth: 0, prehash_key_before_comparison: false,
    }, root, entries[i].keyBytes, proof.value),
  );
  await expectPinnedRejection(
    'spec object rejecting via verifyNonExistence',
    () => {
      const absent = new Uint8Array(32).fill(0xff);
      return verifyNonExistence(nonExistenceProofFor(realTree, absent), { ...AINUMBERS_SIMPLE_SPEC, name: 'forged' }, root, absent);
    },
  );
}

// ---------------------------------------------------------------------------
// 5. Empty tree and single-leaf tree assert FAILING, never "absence proven".
// ---------------------------------------------------------------------------

console.log('empty / single-leaf failing states (SO #34c):');
for (const [label, input] of [['empty key set', []], ['single-leaf key set', (await syntheticEntries(1))]]) {
  try {
    await buildAbsenceTree(input);
    bad(`${label}`, 'buildAbsenceTree unexpectedly SUCCEEDED — absence would be "proven" over an unprovable tree');
  } catch (e) {
    ok(`${label} FAILS as required — "${e.message}"`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\nexistence verified: ${pass} check(s) green, ${fail} failure(s)` +
  ` (real key set: ${real.exist} existence + ${real.nonexist} non-existence proofs against the landed verifier)`);

if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('\n✗ gen-registry-absence-tree.test.mjs FAILED.');
  process.exit(1);
}
console.log('✓ gen-registry-absence-tree.test.mjs: ALL PASS');
process.exit(0);
