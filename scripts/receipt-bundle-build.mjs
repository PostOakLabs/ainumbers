// receipt-bundle-build.mjs — the RECEIPT-BUNDLE v0.1 bundle builder.
//
// Packages a published compute-integrity receipt and a published Sigsum anchor record into ONE
// self-contained JSON object per chaingraph/standard/RECEIPT-BUNDLE.md §2, so a third party can verify both
// halves offline with scripts/receipt-bundle-verify.mjs (or chaingraph/receipt-bundle-verify.html).
//
// ⛔ §4 BUILDER CONFORMANCE — "bundles are evidence CARRIERS, not evidence MAKERS":
//   · copies the six receipt members VERBATIM (no re-serialization of `seal`, no re-keying of `journal`);
//   · copies the anchor record and checkpoint text BYTE-FOR-BYTE from the published files;
//   · computes only §2's derivable fields, via the ONE canonicalizer (cgCanon, §1.4);
//   · performs ZERO network operations (§1.3 never-re-stamp, §1.2 no re-proving). This file imports no
//     network API and never runs a prover or a log submission. A builder that could contact a log is
//     defective by design (§1.3).
//
// The digests it writes into `journal_contract` are ADVISORY ANNOTATIONS (§2 table): the verifier recomputes
// both and MUST NOT trust either. They exist so a human can diff two bundles.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

import { cgCanon } from '../chaingraph/kernels/_hash.mjs';
import { bytesToHex, sha256 } from '../chaingraph/kernels/c2sp-tlog-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const enc = (s) => new TextEncoder().encode(s);

const FIXTURE_DIR = 'chaingraph/standard/fixtures/receipt-bundle';

// §1.5 — I-JSON-safe: reject any number that cannot survive a JSON round-trip losslessly.
function assertIJson(value, path = '$') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`§1.5 I-JSON: non-finite number at ${path}`);
    if (!Number.isSafeInteger(value) && Number.isInteger(value)) throw new Error(`§1.5 I-JSON: integer beyond 2^53-1 at ${path}: ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertIJson(v, `${path}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) assertIJson(v, `${path}.${k}`);
  }
  return value;
}

const SIX_MEMBERS = ['type', 'system', 'receiptFormat', 'imageId', 'seal', 'journal'];

/**
 * Build a §2 bundle object.
 *
 * receipt      — the published receipt object (node compute_proof, or a fixture-corpus receipt file).
 * anchor       — { recordPath, checkpointPath, subject } published Sigsum registration output, or null for a
 *                deliberately LOG-ABSENT bundle (§3.3's non-collapse control).
 * provenance   — repo-relative source paths, recorded for humans. Informational only: provenance LOCATES
 *                sources, it proves nothing, and a verifier MUST NOT treat it as evidence (§2 table).
 */
export async function buildBundle({ receipt, receiptSourcePath, anchor, trustPolicyName = 'sigsum-generic-2025-1', repoRoot = REPO, note }) {
  for (const m of SIX_MEMBERS) {
    if (!(m in receipt)) throw new Error(`§4: receipt is missing member "${m}" — a builder copies all six verbatim, it never invents one`);
  }
  // §4 — verbatim copy of exactly the six members, in §2's order. No re-serialization, no re-keying.
  const receiptOut = {};
  for (const m of SIX_MEMBERS) receiptOut[m] = receipt[m];

  // §2 derivable: journal bytes via the ONE canonicalizer (RFC 8785 JCS per SPEC.md §18.7).
  const journalBytes = enc(JSON.stringify(cgCanon(receiptOut.journal)));
  const journalDigest = 'sha256:' + bytesToHex(await sha256(journalBytes));

  const bundle = {
    bundle_version: '0.1',
    receipt: receiptOut,
    journal_contract: {
      spec: 'SPEC.md §18.7',
      serialization: 'rfc8785-jcs+utf8',
      journal_digest: journalDigest,
      // §2 table: the ReceiptClaim digest is recomputed INSIDE the §18.1 reference verifier from
      // (imageId, journalBytes). This builder does not reimplement risc0's tagged-struct hashing to
      // annotate it — that would be a second implementation of a value the verifier must recompute anyway
      // (§1.4's "no second canonicalization/hashing rule" applied to the claim digest).
      claim_digest: null,
    },
    provenance: {
      repo: 'PostOakLabs/ainumbers',
      receipt_source: receiptSourcePath,
      receipt_source_sha256: null,
      anchor_source: anchor ? relative(repoRoot, anchor.recordPath).replace(/\\/g, '/') : null,
      checkpoint_source: anchor ? relative(repoRoot, anchor.checkpointPath).replace(/\\/g, '/') : null,
    },
  };

  if (receiptSourcePath) {
    try {
      const bytes = readFileSync(join(repoRoot, receiptSourcePath));
      bundle.provenance.receipt_source_sha256 = 'sha256:' + bytesToHex(await sha256(new Uint8Array(bytes)));
    } catch { /* an unpublished source (e.g. an off-repo trial output) has no in-repo file to hash */ }
  }

  if (anchor) {
    // §4 — byte-for-byte copies of the published registration output.
    const record = JSON.parse(readFileSync(anchor.recordPath, 'utf8'));
    const checkpointText = readFileSync(anchor.checkpointPath, 'utf8');
    bundle.anchor = {
      type: record.anchor_type || 'c2sp-tlog-proof-v1',
      record,
      checkpoint_text: checkpointText,
      subject: anchor.subject,
    };
    // §2 — the trust policy identifier travels for humans; the PINS do not travel (§3.2.1).
    const policyRel = `chaingraph/policies/${trustPolicyName}.tlog-policy`;
    const policyBytes = readFileSync(join(repoRoot, policyRel));
    const policyText = new TextDecoder().decode(policyBytes);
    bundle.trust_policy = {
      name: trustPolicyName,
      source: policyRel,
      sha256: 'sha256:' + bytesToHex(await sha256(new Uint8Array(policyBytes))),
      shape: policyShape(policyText),
    };
  }

  if (note) bundle.build_note = note;
  return assertIJson(bundle);
}

// §2 table: `shape` transcribes the policy's quorum line. Derived from the file, never hardcoded.
function policyShape(text) {
  let logs = 0, witnesses = 0, threshold = null, members = 0, quorum = null;
  const groups = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const f = line.split(/\s+/);
    if (f[0] === 'log') logs++;
    else if (f[0] === 'witness') witnesses++;
    else if (f[0] === 'group') groups[f[1]] = { threshold: Number(f[2]), members: f.length - 3 };
    else if (f[0] === 'quorum') quorum = f[1];
  }
  if (quorum && quorum !== 'none' && groups[quorum]) { threshold = groups[quorum].threshold; members = groups[quorum].members; }
  const q = threshold === null ? 'quorum none' : `quorum ${threshold}-of-${members}`;
  return `${logs} log${logs === 1 ? '' : 's'}, ${witnesses} witness${witnesses === 1 ? '' : 'es'}, ${q}`;
}

// ---------------------------------------------------------------------------
// §5 fixtures.
//
// Five fixtures, each naming what it proves. The RED controls (c, d) exist to prove the verifier fails
// HONESTLY and that the two halves are INDEPENDENTLY decidable: a mutated journal must leave the logged half
// green, and a forged cosignature must leave the proof half green. Without that independence the §3.3
// non-collapse rule would be unenforceable in practice.
// ---------------------------------------------------------------------------

// §3.4: for v0.1 the published anchor records commit to REGISTRY CHECKPOINTS, not to individual receipts.
// This subject member says so, and the verifier prints it beside every logged verdict.
const REGISTRY_LINEAGE_SUBJECT = {
  kind: 'registry-checkpoint',
  origin: 'ainumbers.co/registry/lineage',
  log_policy: 'chaingraph/policies/ainumbers-registry-lineage.tlog-policy',
};

const SINGLE_NODE_RECEIPT = 'chaingraph/kernels/fixtures/compute-proof/art-04-agent-identity-attestation-checker.receipt.json';
const COMPOSED_RECEIPT = `${FIXTURE_DIR}/chain-proof-aca226j.trial1.receipt.json`;

async function writeFixtures({ repoRoot = REPO } = {}) {
  const outDir = join(repoRoot, FIXTURE_DIR);
  mkdirSync(outDir, { recursive: true });
  const anchor = {
    recordPath: join(repoRoot, 'registry/lineage/checkpoint.sigsum-record.json'),
    checkpointPath: join(repoRoot, 'registry/lineage/checkpoint'),
    subject: REGISTRY_LINEAGE_SUBJECT,
  };
  const written = [];
  const emit = (name, obj) => {
    const p = join(outDir, name);
    writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
    written.push(name);
  };
  const loadReceipt = (rel) => JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'));

  // (a) live single-node bundle, both halves green. art-04 is the §18.7 DISCRIMINATING receipt: its journal
  // has unsorted nested keys, so JCS and insertion-order serializations diverge and only JCS verifies —
  // which makes this fixture a live test of §1.4's one-canonicalizer rule, not just a happy path.
  const base = await buildBundle({
    receipt: loadReceipt(SINGLE_NODE_RECEIPT), receiptSourcePath: SINGLE_NODE_RECEIPT, anchor, repoRoot,
    note: 'Fixture (a): live single-node receipt + the published registry-lineage checkpoint anchor. art-04 is the §18.7 discriminating-journal receipt (unsorted nested journal keys), so a non-JCS canonicalizer fails the proof half here.',
  });
  emit('a-single-node-both-green.bundle.json', base);

  // (b) proof-valid, log-absent — THE §3.3 NON-COLLAPSE CONTROL. No anchor member at all.
  const logAbsent = await buildBundle({
    receipt: loadReceipt(SINGLE_NODE_RECEIPT), receiptSourcePath: SINGLE_NODE_RECEIPT, anchor: null, repoRoot,
    note: 'Fixture (b): the §3.3 non-collapse control. The proof half verifies; there is no anchor at all. A conforming verifier reports PROOF-VALID + NOT-LOGGED and never reports this bundle as "verified".',
  });
  emit('b-proof-valid-log-absent.bundle.json', logAbsent);

  // (c) RED control, PROOF half: mutate one journal value. The seal and the anchor are untouched, so the
  // logged half must stay green — that is what makes the halves independently decidable.
  const tampered = structuredClone(base);
  tampered.receipt.journal.output.overall_status = 'pass'; // was "warn"
  tampered.build_note = 'Fixture (c): RED control for the PROOF half. One journal value is mutated ("warn" -> "pass") against the SAME seal, so the recomputed ReceiptClaim no longer matches and the pairing fails. The anchor is untouched: the logged half must still verify. journal_contract.journal_digest is deliberately left at the PRE-mutation value so this fixture also exercises the §3.1 "reported discrepancy" path.';
  emit('c-tampered-journal.bundle.json', tampered);

  // (d) RED control, LOGGED half: forge one witness cosignature. The receipt is untouched, so the proof half
  // must stay green.
  const forged = structuredClone(base);
  // Flip the last hex nibble of the FIRST cosignature that this verifier will actually count (a pinned one).
  // Forging an unpinned cosignature would prove nothing: unpinned signatures are evidence bulk and never
  // counted toward quorum, so the quorum would still be met and the fixture would be a false control.
  const pinnedHashes = await pinnedWitnessKeyHashes(repoRoot);
  let forgedIdx = forged.anchor.record.witness_cosignatures.findIndex((cs) => pinnedHashes.has(cs.key_hash));
  if (forgedIdx === -1) throw new Error('fixture (d): no PINNED witness cosignature found to forge — forging an unpinned one would be a false control');
  // Forge enough pinned cosignatures to drop the count BELOW the policy quorum; forging one when three are
  // valid would leave 2-of-3 met and the fixture would pass for the wrong reason.
  const pinnedIdxs = forged.anchor.record.witness_cosignatures
    .map((cs, i) => (pinnedHashes.has(cs.key_hash) ? i : -1)).filter((i) => i !== -1);
  const quorum = 2;
  const toForge = Math.max(1, pinnedIdxs.length - (quorum - 1));
  for (const i of pinnedIdxs.slice(0, toForge)) {
    const cs = forged.anchor.record.witness_cosignatures[i];
    cs.signature = flipLastNibble(cs.signature);
  }
  forged.build_note = `Fixture (d): RED control for the LOGGED half. ${toForge} of ${pinnedIdxs.length} PINNED witness cosignature(s) are forged (last hex nibble flipped), dropping valid pinned cosignatures below the policy's 2-of-3 quorum. Unpinned cosignatures are deliberately NOT the target: they are evidence bulk and never count toward quorum, so forging one would be a false control. The receipt is untouched: the proof half must still verify.`;
  emit('d-forged-cosignature.bundle.json', forged);

  // (e) composed-receipt bundle — CHAIN-PROOF-TRIAL-1 produced a real composed chain-level receipt
  // (3 succinct assumptions resolved, then Groth16-wrapped), so this fixture carries live composed bytes
  // rather than the §7.2 follow-on placeholder. §7.2 (chain-walk BUNDLES, journal-of-A = input-of-B as a
  // bundle FORMAT) stays a follow-on; what is demonstrated here is narrower and worth stating exactly: the
  // v0.1 format and this verifier accept a COMPOSED seal with no format change and no verifier change.
  const composed = await buildBundle({
    receipt: loadReceipt(COMPOSED_RECEIPT), receiptSourcePath: COMPOSED_RECEIPT, anchor, repoRoot,
    note: 'Fixture (e): composed chain-level receipt from CHAIN-PROOF-TRIAL-1 (chain aca-226j-response-composer; 3 succinct assumptions resolved into one Groth16 receipt). Demonstrates that a composed seal verifies under the unchanged §18.1 reference verifier and needs no v0.1 format change. NOTE: the log half still commits to the registry checkpoint (§3.4), NOT to this composed receipt; and §7.2 chain-walk bundles (a bundle format that carries the A->B journal linkage itself) remain a named follow-on.',
  });
  emit('e-composed-receipt.bundle.json', composed);

  return written;
}

function flipLastNibble(hex) {
  const last = hex.slice(-1);
  const flipped = ((parseInt(last, 16) + 1) % 16).toString(16);
  return hex.slice(0, -1) + flipped;
}

async function pinnedWitnessKeyHashes(repoRoot) {
  const text = readFileSync(join(repoRoot, 'chaingraph/policies/sigsum-generic-2025-1.tlog-policy'), 'utf8');
  const out = new Set();
  for (const raw of text.split('\n')) {
    const f = raw.trim().split(/\s+/);
    if (f[0] === 'witness') {
      const keyBytes = new Uint8Array(f[2].match(/../g).map((x) => parseInt(x, 16)));
      out.add(bytesToHex(await sha256(keyBytes)));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function flag(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--fixtures')) {
    const written = await writeFixtures();
    console.log(`wrote ${written.length} fixture(s) to ${FIXTURE_DIR}:`);
    for (const w of written) console.log(`  ${w}`);
    console.log('');
    console.log('Verify them with: node scripts/receipt-bundle-verify.mjs --self-test');
    return 0;
  }
  const receiptPath = flag(args, 'receipt');
  const out = flag(args, 'out');
  if (!receiptPath || !out) {
    console.log('usage: node scripts/receipt-bundle-build.mjs --receipt <receipt.json> --out <bundle.json>');
    console.log('                                            [--anchor-record <r.json> --anchor-checkpoint <cp>]');
    console.log('       node scripts/receipt-bundle-build.mjs --fixtures     # regenerate the §5 fixtures');
    console.log('');
    console.log('Builds a RECEIPT-BUNDLE v0.1 object (chaingraph/standard/RECEIPT-BUNDLE.md §2). Offline only:');
    console.log('it never proves and never submits to a log (§1.2, §1.3).');
    return 2;
  }
  const recordPath = flag(args, 'anchor-record');
  const checkpointPath = flag(args, 'anchor-checkpoint');
  const anchor = recordPath && checkpointPath
    ? { recordPath: resolve(recordPath), checkpointPath: resolve(checkpointPath), subject: REGISTRY_LINEAGE_SUBJECT }
    : null;
  const bundle = await buildBundle({
    receipt: JSON.parse(readFileSync(resolve(receiptPath), 'utf8')),
    receiptSourcePath: relative(REPO, resolve(receiptPath)).replace(/\\/g, '/'),
    anchor,
  });
  writeFileSync(resolve(out), JSON.stringify(bundle, null, 2) + '\n');
  console.log(`wrote ${out}`);
  if (!anchor) console.log('NOTE: no anchor supplied, so this bundle is LOG-ABSENT by construction. A conforming verifier reports NOT-LOGGED for it, never "verified" (§3.3).');
  return 0;
}

if (process.argv[1]?.endsWith('receipt-bundle-build.mjs')) {
  main(process.argv).then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
}
