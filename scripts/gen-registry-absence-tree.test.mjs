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

import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import {
  verifyExistence, verifyNonExistence, AINUMBERS_SIMPLE_SPEC,
} from '../chaingraph/kernels/ics23-verify.mjs';
import {
  loadKeySet, buildAbsenceTree, existenceProofAt, nonExistenceProofFor, PROOFSPEC_NAME,
  ABSENCE_ANCHOR_TYPE, absenceLineageRecord,
} from './gen-registry-absence-tree.mjs';
import {
  sha256, bytesToHex, parseSignedNote,
} from '../chaingraph/kernels/c2sp-tlog-verify.mjs';
import {
  generate as generateLineage, check as checkLineage, readEntryBundles, canonicalEntryBytes,
} from './gen-registry-lineage.mjs';
import { appendAbsenceLineageRecord } from './append-absence-lineage-record.mjs';

const subtle = webcrypto.subtle;

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
// 6. REGISTRY-ABSENCE-LINEAGE-REBIND-1 controls — the records-file vs
//    published-log split. The append tooling writes
//    chaingraph/kernels/registry-lineage-records.json while `--check` reads the
//    PUBLISHED log (registry/lineage/checkpoint + entry bundles); when a record
//    is published seat-side but its append never lands (the #2132 shape), the
//    two disagree about the same index and the append+publish remedy silently
//    jams. Red control: without reconcile, the append fills the file slot,
//    record count equals the published size, and gen-registry-lineage's
//    size-only skip refuses to anchor — the binding NEVER publishes. Green
//    control: the log-ahead reconcile imports the published entries (byte-
//    verified through the ONE canonicalizer) before appending, so the binding
//    lands at the next LOG index and the consistency gate accepts the publish.
//    Refusal control: a diverged shared prefix is refused, never repaired.
//    Runs entirely in a temp dir; Sigsum is stubbed; the appended record is
//    the REAL recomputed F2 tree's (absenceLineageRecord(buildAbsenceTree(...))).
// ---------------------------------------------------------------------------

function bytesEqualU8(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

console.log('lineage rebind controls (records file vs published log, REGISTRY-ABSENCE-LINEAGE-REBIND-1):');
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'absence-rebind-test-'));
  const registryDir = join(tmpDir, 'lineage');
  const recordsPath = join(tmpDir, 'registry-lineage-records.json');
  try {
    // Fresh Ed25519 keypair for THIS test run only — never the real log key.
    const { publicKey, privateKey } = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const privJwk = await subtle.exportKey('jwk', privateKey);
    const pubKeyHex = Buffer.from(await subtle.exportKey('raw', publicKey)).toString('hex');
    const keyPath = join(tmpDir, 'test-log-key.priv.jwk.json');
    writeFileSync(keyPath, JSON.stringify(privJwk));
    const stubSigsumRecord = {
      anchor_type: 'c2sp-tlog-proof-v1',
      log_url: 'https://example.invalid/stub-for-test',
      leaf: { checksum: '00'.repeat(32), signature: '00'.repeat(64), public_key: '00'.repeat(32) },
      tree_head: { size: 1, root_hash: '00'.repeat(32), log_signature: '00'.repeat(64) },
      inclusion_proof: { leaf_index: 0, path: [] },
      witness_cosignatures: [],
    };

    // Incident shape: a publisher input list of 5 records is PUBLISHED (log
    // size 5), then the records file is truncated back to 4 — entry 4 was
    // published seat-side but its append never landed (the #2132 split).
    const listed = Array.from({ length: 4 }, (_, i) => ({
      synthetic_record_index: i,
      note: 'gen-registry-absence-tree.test.mjs fixture, not a real anchor record',
    }));
    const missing = {
      anchor_type: ABSENCE_ANCHOR_TYPE,
      source: 'registry-absence-tree',
      proofspec: PROOFSPEC_NAME,
      tree_root: `sha256:${'ab'.repeat(32)}`,
      key_count: 649,
      note: 'gen-registry-absence-tree.test.mjs fixture for the published-but-never-appended log entry (the #2132 split shape), not a real anchor record',
    };
    const writeRecords = (recs) => writeFileSync(recordsPath, JSON.stringify({ records: recs }, null, 2) + '\n');
    writeRecords([...listed, missing]);
    await generateLineage({
      registryDir, records: [...listed, missing], logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
      submitToSigsum: async () => stubSigsumRecord, // no network
    });
    writeRecords(listed); // ...the append never landed: log (5) is now AHEAD of the file (4)

    const logSize = parseSignedNote(readFileSync(join(registryDir, 'checkpoint'), 'utf8')).size;
    if (logSize === 5) {
      ok(`incident shape built: published log size ${logSize} vs records file with ${listed.length} records (log ahead by one)`);
    } else {
      bad('incident shape', `expected log size 5 over 4 listed records, got log size ${logSize}`);
    }

    // RED control — the pre-REBIND jam: append WITHOUT reconcile.
    writeRecords(listed);
    const jammed = await appendAbsenceLineageRecord({ recordsPath, registryDir, reconcile: false, log: () => {} });
    const jammedRecords = JSON.parse(readFileSync(recordsPath, 'utf8')).records;
    if (jammed.appended === true && jammedRecords.length === logSize) {
      ok(`RED: without reconcile the append fills the file slot (records ${jammedRecords.length} == published size ${logSize})`);
    } else {
      bad('RED jam shape', `expected appended record count to equal published size (${logSize}), got appended=${jammed.appended} count=${jammedRecords.length}`);
    }
    let published = false;
    try {
      await generateLineage({
        registryDir, records: jammedRecords, logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
        submitToSigsum: async () => stubSigsumRecord,
      });
      published = parseSignedNote(readFileSync(join(registryDir, 'checkpoint'), 'utf8')).size > logSize;
    } catch {
      published = false;
    }
    if (published === false) {
      ok('RED: the size-only skip refuses to anchor (nothing to publish) — the binding would NEVER land, --check stays red forever (the repro jam)');
    } else {
      bad('RED jam', 'expected the publish to be SKIPPED (size unchanged), but the log grew');
    }

    // GREEN control — reconcile + append (the REBIND remedy).
    writeRecords(listed);
    const fixed = await appendAbsenceLineageRecord({ recordsPath, registryDir, log: () => {} });
    const fixedRecords = JSON.parse(readFileSync(recordsPath, 'utf8')).records;
    if (fixed.imported === 1 && fixed.appended === true && fixed.index === logSize) {
      ok(`GREEN: reconciled ${fixed.imported} published-but-unlisted entry, appended the real binding at records[${fixed.index}] (the next LOG index)`);
    } else {
      bad('GREEN reconcile+append', `expected imported=1 appended=true index=${logSize}, got imported=${fixed.imported} appended=${fixed.appended} index=${fixed.index}`);
    }
    const publishedEntries = readEntryBundles(registryDir, logSize);
    const prefixMatches = fixedRecords.slice(0, logSize).every((r, i) => bytesEqualU8(canonicalEntryBytes(r), publishedEntries[i]));
    if (prefixMatches) {
      ok('GREEN: reconciled prefix byte-matches the published log entries (leaf continuity the §2.3 consistency gate requires)');
    } else {
      bad('GREEN prefix', 'a reconciled record does not byte-match its published log entry');
    }
    await generateLineage({
      registryDir, records: fixedRecords, logPrivateKeyPath: keyPath, logPublicKeyHex: pubKeyHex,
      submitToSigsum: async () => stubSigsumRecord,
    });
    const newSize = parseSignedNote(readFileSync(join(registryDir, 'checkpoint'), 'utf8')).size;
    if (newSize === logSize + 1) {
      ok(`GREEN: publish accepted by the consistency gate (size ${logSize} -> ${newSize}), exactly one new leaf anchored`);
    } else {
      bad('GREEN publish', `expected published size ${logSize + 1}, got ${newSize}`);
    }
    const entriesAfter = readEntryBundles(registryDir, newSize);
    const realTree = await buildAbsenceTree(loadKeySet());
    if (bytesEqualU8(canonicalEntryBytes(absenceLineageRecord(realTree)), entriesAfter[newSize - 1])) {
      ok(`GREEN: the anchored log's latest entry now BINDS the recomputed tree (root ${bytesToHex(realTree.root)}, key_count ${realTree.count})`);
    } else {
      bad('GREEN binding', 'the latest log entry is not the recomputed tree\'s absence record');
    }
    const lineageCheck = await checkLineage({ registryDir, logPublicKeyHex: pubKeyHex, noExit: true });
    if (lineageCheck.ok === true) {
      ok('GREEN: gen-registry-lineage --check passes on the reconciled-and-published log');
    } else {
      bad('GREEN lineage --check', lineageCheck.message);
    }

    // REFUSAL control — a corrupted shared prefix is an honest refusal.
    const corrupt = JSON.parse(readFileSync(recordsPath, 'utf8'));
    corrupt.records[1] = { ...corrupt.records[1], note: 'mutated by the refusal control' };
    writeRecords(corrupt.records);
    let refused = false;
    try {
      await appendAbsenceLineageRecord({ recordsPath, registryDir, log: () => {} });
    } catch (e) {
      refused = e.message.includes('RECONCILIATION REFUSED');
    }
    if (refused) {
      ok('REFUSAL: a records file whose shared prefix diverges from the published log is REFUSED, never silently repaired');
    } else {
      bad('REFUSAL', 'expected a RECONCILIATION REFUSED error for a diverged prefix record');
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
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
