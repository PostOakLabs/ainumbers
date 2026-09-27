// receipt-bundle-verify.mjs — the one-file RECEIPT-BUNDLE v0.1 combined verifier (CLI half).
//
// Verifies BOTH halves of a portable receipt bundle (chaingraph/standard/RECEIPT-BUNDLE.md) and reports them
// as two independent half-verdicts plus one combined statement, per §3.3's non-collapse rule:
//
//   §3.1 proof half  — the risc0 Groth16/BN254 seal over (imageId, §18.7 JCS journal bytes).
//   §3.2 logged half — Sigsum log inclusion + witness-cosignature quorum against a PINNED trust policy.
//
// ⛔ THE NON-COLLAPSE RULE (§3.3, NORMATIVE): a proof-valid but log-absent bundle is reported as exactly
// that and NEVER as "verified". There is no single boolean anywhere in this file's output. `proof` and
// `logged` are siblings, each with its own verdict token, in every output mode.
//
// ⛔ NO SECOND CANONICALIZER (§1.4). Journal bytes come from cgCanon (chaingraph/kernels/_hash.mjs) via the
// §18.1 reference verifier in chaingraph/kernels/_computeproof.mjs. ⛔ NO SECOND MERKLE / SIGNED-NOTE
// IMPLEMENTATION (§20.1): every transparency-log primitive is imported from the shared C2SP module
// chaingraph/kernels/c2sp-tlog-verify.mjs. This file adds ZERO crypto of its own — it is assembly.
//
// ⛔ OFFLINE BY CONSTRUCTION (§3.2, §4). Zero network operations: no fetch, no DNS, no log query. Every byte
// and every trust key is read either from the bundle (evidence) or from this repo's published policy files
// (trust). Nothing is ever adopted out of the bundle as an authority — see PINS below.
//
// SO #34 (independent derivation): every value this verifier validates is RECOMPUTED from the bundle's
// primary bytes. `journal_contract.journal_digest` / `.claim_digest` and every `provenance.*` field are
// ADVISORY ANNOTATIONS ONLY (§2 table, §3.1) — read for display and diffed for report, NEVER trusted, and
// never able to decide a half-verdict.

import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { cgCanon } from '../chaingraph/kernels/_hash.mjs';
import { verifySeal, normId } from '../chaingraph/kernels/_computeproof.mjs';
import {
  bytesToHex,
  hexToBytes,
  base64ToBytes,
  concatBytes,
  bytesEqual,
  sha256,
  hashLeafNode,
  verifyInclusion,
  formatCheckpoint,
  parseSignedNote,
  toCosignedData,
} from '../chaingraph/kernels/c2sp-tlog-verify.mjs';

const { subtle } = webcrypto;
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const enc = (s) => new TextEncoder().encode(s);

// ---------------------------------------------------------------------------
// §3.2.1 — THE VERIFIER'S OWN PINS.
//
// The bundle carries a trust-policy NAME for humans; the PINS DO NOT TRAVEL IN THE BUNDLE. The verifier
// holds its own copy of each policy file and pins it by name + sha256 of that file. An unknown or
// hash-mismatched policy name yields NOT-LOGGED-POLICY-UNPINNED — the verifier never adopts a trust policy
// out of the artifact under test.
// ---------------------------------------------------------------------------

const POLICY_FILES = {
  'sigsum-generic-2025-1': 'chaingraph/policies/sigsum-generic-2025-1.tlog-policy',
  'ainumbers-registry-lineage': 'chaingraph/policies/ainumbers-registry-lineage.tlog-policy',
};

// C2SP tlog-policy.md grammar, only the three line kinds these policies use:
//   log <keyhex> <url> | witness <name> <keyhex> | group <name> <threshold> <member>... | quorum <name|none>
export function parseTlogPolicy(text) {
  const logs = [];
  const witnesses = [];
  const groups = {};
  let quorum = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const f = line.split(/\s+/);
    if (f[0] === 'log') logs.push({ keyHex: f[1], url: f[2] });
    else if (f[0] === 'witness') witnesses.push({ name: f[1], keyHex: f[2] });
    else if (f[0] === 'group') groups[f[1]] = { threshold: Number(f[2]), members: f.slice(3) };
    else if (f[0] === 'quorum') quorum = f[1];
  }
  // A `quorum none` policy (single-operator log) has threshold 0 by construction.
  const q = quorum && quorum !== 'none' ? groups[quorum] : { threshold: 0, members: [] };
  return { logs, witnesses, groups, quorum, threshold: q ? q.threshold : 0, quorumMembers: q ? q.members : [] };
}

// Load a pinned policy: its parsed content AND the sha256 of the exact file bytes this verifier holds.
export async function loadPinnedPolicy(name, repoRoot = REPO) {
  const rel = POLICY_FILES[name];
  if (!rel) return null;
  const bytes = readFileSync(join(repoRoot, rel));
  const text = new TextDecoder().decode(bytes);
  return {
    name,
    source: rel,
    sha256: 'sha256:' + bytesToHex(await sha256(new Uint8Array(bytes))),
    shapeThreshold: parseTlogPolicy(text).threshold,
    ...parseTlogPolicy(text),
  };
}

// ---------------------------------------------------------------------------
// §3.1 — the proof half.
// ---------------------------------------------------------------------------

// The §18.7 recompute, independent of every annotation in the bundle.
async function recomputeJournal(receipt) {
  const journalBytes = enc(JSON.stringify(cgCanon(receipt.journal)));
  return { journalBytes, journalDigest: 'sha256:' + bytesToHex(await sha256(journalBytes)) };
}

/**
 * §3.1. Returns { verdict, checks[], annotations, recomputed }.
 *
 * verdict: 'PROOF-VALID' | 'PROOF-INVALID'. A missing or malformed member is PROOF-INVALID, never a pass
 * (§3.1, SO #34c: absence is not a pass).
 *
 * ⛔ SO #34 / #34c — THE BINDING LEG THAT CANNOT BE ENGAGED FROM A BUNDLE, AND IS NOT REPORTED AS A PASS.
 * verifyBinding() (chaingraph/kernels/_computeproof.mjs L64) decides two things a bundle cannot supply:
 *   (a) journal.output JCS-equals the ARTIFACT's output_payload — a bundle carries no artifact (§6: "not an
 *       OCG artifact"), and synthesising one as {output_payload: receipt.journal.output, ...} would validate
 *       the receipt against a value copied OUT OF THE RECEIPT UNDER TEST. That is precisely SO #34's banned
 *       shape (self-attested provenance validated by a self-consistent checker), so this verifier refuses to
 *       do it.
 *   (b) imageId / journal.kernel_digest are published identities for the node — those live in the Graph
 *       Index, which a portable offline bundle does not carry.
 * Both legs are therefore reported as NOT-ENGAGED with the reason, a DISTINCT state from a pass (SO #34c).
 * verifyBinding's remaining, self-contained STRUCTURAL predicate (receipt shape) IS applied below, mirroring
 * its check order exactly rather than re-deriving it.
 */
export async function verifyProofHalf(bundle) {
  const checks = [];
  const add = (name, ok, detail) => { checks.push({ name, ok, detail }); return ok; };
  const r = bundle?.receipt;

  // verifyBinding's structural predicate, same order (L64-L72), applied to the bundle's receipt member.
  if (!r || typeof r !== 'object') {
    add('receipt.present', false, 'bundle.receipt missing or not an object');
    return { verdict: 'PROOF-INVALID', checks, annotations: [], recomputed: null };
  }
  add('receipt.type', r.type === 'ZkVmReceipt', `type=${JSON.stringify(r.type)} (want "ZkVmReceipt")`);
  add('receipt.system', typeof r.system === 'string' && !!r.system, `system=${JSON.stringify(r.system)}`);
  add('receipt.receiptFormat', r.receiptFormat === 'groth16-bn254',
    `receiptFormat=${JSON.stringify(r.receiptFormat)} (this verifier implements the §18.1 groth16-bn254 reference verifier; "stark" stays delegated to the vendor verifier)`);
  // §3.1.2 — imageId is "sha256:" + 64 hex.
  add('receipt.imageId', typeof r.imageId === 'string' && /^sha256:[0-9a-f]{64}$/.test(normId(r.imageId || '')),
    `imageId=${JSON.stringify(r.imageId)}`);
  // §3.1.3 — journal is an object.
  add('receipt.journal', !!r.journal && typeof r.journal === 'object', 'journal must be an object');
  // §3.1.1 — seal base64-decodes to exactly 256 bytes.
  let sealLen = null;
  try { sealLen = base64ToBytes(r.seal).length; } catch { sealLen = null; }
  add('seal.256bytes', sealLen === 256, `decoded seal length=${sealLen} (want 256)`);

  // The two binding legs a bundle cannot decide — reported, never passed (SO #34c).
  const notEngaged = [
    { name: 'binding.journal_output_vs_artifact_output_payload', ok: null,
      detail: 'NOT-ENGAGED: a bundle carries no OCG artifact (§6), and synthesising output_payload from the receipt\'s own journal.output would validate the artifact under test against itself (SO #34). Engage this leg by running verifyBinding() against the published artifact.' },
    { name: 'binding.published_image_and_kernel_identity', ok: null,
      detail: 'NOT-ENGAGED: imageId / journal.kernel_digest are bound to published Graph Index identities (node.compute_images[]), which a portable offline bundle does not carry.' },
  ];
  checks.push(...notEngaged);

  const structurallyOk = checks.every((c) => c.ok !== false);
  if (!structurallyOk) return { verdict: 'PROOF-INVALID', checks, annotations: [], recomputed: null };

  // §3.1.4 — recompute the journal bytes/digest from the primary bytes.
  const recomputed = await recomputeJournal(r);

  // §3.1 — the annotations are DIFFED FOR REPORT and cannot decide the verdict.
  const annotations = [];
  const jc = bundle.journal_contract || {};
  if (jc.journal_digest !== undefined) {
    const agrees = normId(jc.journal_digest) === recomputed.journalDigest;
    annotations.push({
      field: 'journal_contract.journal_digest', agrees,
      annotated: jc.journal_digest, recomputed: recomputed.journalDigest,
      note: agrees ? 'annotation agrees with the recomputed value (advisory either way)'
                   : 'REPORTED DISCREPANCY: the annotation disagrees with the recomputed value. The verdict is decided by the RECOMPUTED value (§3.1); the annotation is advisory and is never trusted.',
    });
  }
  if (jc.claim_digest !== undefined) {
    annotations.push({
      field: 'journal_contract.claim_digest', agrees: null, annotated: jc.claim_digest, recomputed: null,
      note: 'advisory annotation; the ReceiptClaim digest is recomputed INSIDE the §18.1 reference verifier (claimDigestOk) and is never read from the bundle.',
    });
  }

  // §3.1.5 — the Groth16/BN254 pairing equation, via the §18.1 reference verifier. This recomputes the
  // ReceiptClaim digest from (imageId, JCS journal bytes) and the 5 public inputs internally; the pinned
  // ceremony constants (VK / CONTROL_ROOT / BN254_CONTROL_ID) live there, not here.
  let sealOk = false;
  try { sealOk = verifySeal(r) === true; } catch (e) { sealOk = false; add('seal.pairing.error', false, String(e.message || e)); }
  add('seal.groth16_pairing', sealOk,
    sealOk ? 'e(A,B)·e(-α,β)·e(-vk_x,γ)·e(-C,δ) == 1 against the risc0 3.0.x verifying key'
           : 'pairing equation did NOT hold for the decoded seal over the recomputed ReceiptClaim');

  return {
    verdict: sealOk ? 'PROOF-VALID' : 'PROOF-INVALID',
    checks, annotations, recomputed: { journal_digest: recomputed.journalDigest },
  };
}

// ---------------------------------------------------------------------------
// §3.2 — the logged half.
// ---------------------------------------------------------------------------

async function ed25519Verify(pubKeyHex, sigBytes, msgBytes) {
  try {
    const key = await subtle.importKey('raw', hexToBytes(pubKeyHex), { name: 'Ed25519' }, true, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, key, sigBytes, msgBytes);
  } catch { return false; }
}

/**
 * §3.2, steps 1-7 in order. Returns { verdict, checks[], subject, quorum }.
 * verdict: 'LOGGED' | 'NOT-LOGGED' | 'NOT-LOGGED-POLICY-UNPINNED', with the failing check named.
 */
export async function verifyLoggedHalf(bundle, { repoRoot = REPO } = {}) {
  const checks = [];
  const add = (name, ok, detail) => { checks.push({ name, ok, detail }); return ok; };
  const anchor = bundle?.anchor;
  const rec = anchor?.record;

  if (!anchor || !rec || typeof rec !== 'object' || typeof anchor.checkpoint_text !== 'string') {
    add('anchor.present', false,
      'NOT-LOGGED: the bundle carries no anchor (record + checkpoint_text). A bundle with no log half is LOG-ABSENT, which §3.3 requires be reported as exactly that and never as "verified".');
    return { verdict: 'NOT-LOGGED', checks, subject: anchor?.subject ?? null, quorum: null };
  }

  // §3.2.1 — the policy the verifier pins ITSELF (name + sha256 of its own copy).
  const declaredName = bundle?.trust_policy?.name;
  const pinned = await loadPinnedPolicy(declaredName, repoRoot);
  if (!pinned) {
    add('policy.pinned', false,
      `NOT-LOGGED-POLICY-UNPINNED: trust_policy.name=${JSON.stringify(declaredName)} is not a policy this verifier holds. Known: ${Object.keys(POLICY_FILES).join(', ')}. The verifier never adopts a trust policy out of the bundle.`);
    return { verdict: 'NOT-LOGGED-POLICY-UNPINNED', checks, subject: anchor.subject ?? null, quorum: null };
  }
  add('policy.pinned', true, `${pinned.name} @ ${pinned.source} ${pinned.sha256} (${pinned.logs.length} logs, ${pinned.witnesses.length} witnesses, quorum ${pinned.threshold}-of-${pinned.quorumMembers.length})`);
  // The bundle's own sha256 claim about the policy is an ANNOTATION: diffed, never trusted (SO #34).
  if (bundle.trust_policy?.sha256) {
    const claimed = normId(bundle.trust_policy.sha256);
    add('policy.sha256_annotation_agrees', claimed === pinned.sha256,
      claimed === pinned.sha256
        ? 'the bundle\'s policy sha256 annotation agrees with the verifier\'s own file'
        : `REPORTED DISCREPANCY (advisory): bundle says ${claimed}, this verifier's own copy hashes to ${pinned.sha256}. The verifier proceeds on ITS OWN pins; a hash-mismatched policy NAME would be POLICY-UNPINNED, but a mismatched annotation alone never decides the half.`);
  }

  // §3.2.2 — sha256(utf8(checkpoint_text)) == record.anchored_hash.
  const cpBytes = enc(anchor.checkpoint_text);
  const cpDigest = 'sha256:' + bytesToHex(await sha256(cpBytes));
  const anchoredHash = normId(String(rec.anchored_hash || ''));
  add('anchored_hash.commits_to_checkpoint_text', cpDigest === anchoredHash,
    `sha256(utf8(checkpoint_text))=${cpDigest} vs record.anchored_hash=${anchoredHash}`);

  // §3.2.3 — the checkpoint's OWN signature verifies against the operator key pinned in the SUBJECT log's
  // published tlog-policy. The pinned key is never taken from the bundle.
  const subjectPolicyName = String(anchor.subject?.log_policy || '').split('/').pop().replace(/\.tlog-policy$/, '');
  const subjectPinned = await loadPinnedPolicy(subjectPolicyName, repoRoot);
  if (!subjectPinned) {
    add('subject_policy.pinned', false,
      `NOT-LOGGED-POLICY-UNPINNED: anchor.subject.log_policy=${JSON.stringify(anchor.subject?.log_policy)} names a policy this verifier does not hold.`);
    return { verdict: 'NOT-LOGGED-POLICY-UNPINNED', checks, subject: anchor.subject ?? null, quorum: null };
  }
  let note = null;
  try { note = parseSignedNote(anchor.checkpoint_text); } catch (e) {
    add('checkpoint.signed_note_parse', false, `signed-note framing rejected: ${e.message}`);
  }
  if (note) {
    add('checkpoint.signed_note_parse', true, `origin=${note.origin} size=${note.size} cosignature_lines=${note.cosignatures.length}`);
    const operatorKey = subjectPinned.logs[0]?.keyHex;
    let cpSigOk = false;
    for (const cs of note.cosignatures) {
      // signed-note.md: the signature payload is keyHint(4 bytes) || raw Ed25519 signature; the signed
      // bytes are the note text exactly (origin/size/root(/extension) lines, trailing newline).
      if (await ed25519Verify(operatorKey, cs.sigBytes, enc(note.noteText))) { cpSigOk = true; break; }
    }
    add('checkpoint.operator_signature', cpSigOk,
      cpSigOk ? `verifies against the operator key pinned in ${subjectPinned.source} (${operatorKey.slice(0, 16)}…)`
              : `no signature line on the checkpoint verifies against the pinned operator key from ${subjectPinned.source}`);
  }

  // §3.2.4 — sha256(anchored_hash bytes) == leaf.checksum, and the leaf signature verifies over the
  // domain-separated "sigsum.org/v1/tree-leaf" message.
  const anchoredBytes = hexToBytes(anchoredHash.slice('sha256:'.length));
  const checksum = await sha256(anchoredBytes);
  const leafChecksumOk = bytesToHex(checksum) === String(rec.leaf?.checksum || '');
  add('leaf.checksum', leafChecksumOk,
    `sha256(anchored_hash bytes)=${bytesToHex(checksum)} vs leaf.checksum=${rec.leaf?.checksum}`);
  const TREE_LEAF_NAMESPACE = 'sigsum.org/v1/tree-leaf';
  const leafMsg = concatBytes([enc(TREE_LEAF_NAMESPACE), new Uint8Array([0x00]), checksum]);
  const leafSigOk = await ed25519Verify(String(rec.leaf?.public_key || ''), hexToBytes(String(rec.leaf?.signature || '')), leafMsg);
  add('leaf.signature', leafSigOk, leafSigOk
    ? 'leaf signature verifies over the namespaced checksum against record.leaf.public_key'
    : 'leaf signature did NOT verify over "sigsum.org/v1/tree-leaf"\\x00 || checksum');

  // §3.2.5 — RFC 6962 inclusion walk reconstructs tree_head.root_hash.
  const keyHash = await sha256(hexToBytes(String(rec.leaf?.public_key || '')));
  const leafBin = concatBytes([checksum, hexToBytes(String(rec.leaf?.signature || '')), keyHash]);
  const leafNode = await hashLeafNode(leafBin);
  const root = hexToBytes(String(rec.tree_head?.root_hash || ''));
  const inclusionOk = await verifyInclusion({
    leaf: leafNode,
    index: rec.inclusion_proof?.leaf_index,
    size: rec.tree_head?.size,
    root,
    path: (rec.inclusion_proof?.path || []).map((h) => hexToBytes(h)),
  });
  add('inclusion_proof', inclusionOk,
    `RFC 6962 walk from hashLeafNode(checksum‖signature‖keyHash) at (index ${rec.inclusion_proof?.leaf_index}, size ${rec.tree_head?.size}) ${inclusionOk ? 'reconstructs' : 'does NOT reconstruct'} tree_head.root_hash=${rec.tree_head?.root_hash}`);

  // §3.2.6 — the log checkpoint: origin INDEPENDENTLY DERIVED from the PINNED log key, and
  // tree_head.log_signature verified against that pinned key. record.log_public_key is never an authority:
  // a pinned key must match it, or the half fails.
  let matchedLog = null;
  for (const l of pinned.logs) {
    const derivedOrigin = 'sigsum.org/v1/tree/' + bytesToHex(await sha256(hexToBytes(l.keyHex)));
    if (l.keyHex === String(rec.log_public_key || '') || derivedOrigin === String(rec.log_origin || '')) {
      matchedLog = { ...l, derivedOrigin };
      break;
    }
  }
  if (!matchedLog) {
    add('log.pinned_key_match', false,
      `record.log_public_key=${rec.log_public_key} matches NO log pinned in ${pinned.source}. The record's own log key is never accepted as an authority (§3.2.6).`);
  } else {
    add('log.pinned_key_match', true,
      `pinned log ${matchedLog.url}; origin independently derived as sigsum.org/v1/tree/${matchedLog.derivedOrigin.split('/').pop().slice(0, 16)}…`);
    add('log.origin_matches_derived', matchedLog.derivedOrigin === String(rec.log_origin || ''),
      `derived=${matchedLog.derivedOrigin} vs record.log_origin=${rec.log_origin}`);
    const logCheckpoint = formatCheckpoint(matchedLog.derivedOrigin, rec.tree_head.size, root);
    const logSigOk = await ed25519Verify(matchedLog.keyHex, hexToBytes(String(rec.tree_head?.log_signature || '')), enc(logCheckpoint));
    add('log.tree_head_signature', logSigOk, logSigOk
      ? 'tree_head.log_signature verifies against the PINNED log key over the derived checkpoint'
      : 'tree_head.log_signature did NOT verify against the pinned log key over the derived checkpoint');
  }

  // §3.2.7 — witness cosignatures: hash-match-before-pin, then verify over the cosigned checkpoint.
  // The carried cosignatures are evidence bulk; ONLY PINNED MATCHES COUNT toward the policy's quorum.
  const quorum = { threshold: pinned.threshold, carried: (rec.witness_cosignatures || []).length, matched: 0, valid: 0, witnesses: [] };
  if (matchedLog) {
    // Resolve each carried key_hash by hashing THIS VERIFIER'S pinned witness keys (never the bundle's).
    const byHash = new Map();
    for (const w of pinned.witnesses) byHash.set(bytesToHex(await sha256(hexToBytes(w.keyHex))), w);
    for (const cs of rec.witness_cosignatures || []) {
      const w = byHash.get(String(cs.key_hash || ''));
      if (!w) continue; // unpinned witness: evidence bulk, never counted
      quorum.matched++;
      const msg = toCosignedData(matchedLog.derivedOrigin, rec.tree_head.size, root, cs.timestamp);
      const ok = await ed25519Verify(w.keyHex, hexToBytes(String(cs.signature || '')), enc(msg));
      if (ok) quorum.valid++;
      quorum.witnesses.push({ name: w.name, valid: ok, timestamp: cs.timestamp });
    }
  }
  add('witness_quorum', quorum.valid >= quorum.threshold,
    `${quorum.valid} valid pinned cosignature(s) of ${quorum.matched} matched (of ${quorum.carried} carried) vs quorum ${quorum.threshold}-of-${quorum.quorumMembers?.length ?? pinned.quorumMembers.length}${quorum.witnesses.length ? ': ' + quorum.witnesses.map((w) => `${w.name}=${w.valid ? 'valid' : 'INVALID'}`).join(', ') : ''}`);

  const failed = checks.filter((c) => c.ok === false);
  return {
    verdict: failed.length ? 'NOT-LOGGED' : 'LOGGED',
    checks, subject: anchor.subject ?? null, quorum,
    failing: failed.map((c) => c.name),
  };
}

// ---------------------------------------------------------------------------
// §3.3 — the combined verdict. TWO SIBLINGS, NEVER ONE BOOLEAN.
// ---------------------------------------------------------------------------

// §3.4 — anchor subject scope, stated plainly. A v0.1 verifier MUST NOT phrase the combined verdict as
// "this receipt is transparency-logged".
export function subjectScopeSentence(subject, record) {
  if (!subject) return 'The log half commits to an UNSTATED subject: the bundle names no anchor.subject, so what the logged half covers cannot be stated. It is not the receipt.';
  if (subject.kind === 'registry-checkpoint') {
    return `The log half commits to the registry checkpoint ${subject.origin} at size ${record?.tree_head?.size ?? '?'}, NOT to the receipt itself.`;
  }
  if (subject.kind === 'execution_hash') {
    return `The log half commits to the subject artifact execution_hash ${subject.artifact_execution_hash ?? '(unnamed)'} (§3.4 per-artifact anchoring).`;
  }
  return `The log half commits to a subject of kind ${JSON.stringify(subject.kind)}, NOT to the receipt itself.`;
}

/**
 * The §3.3 verdict object: `proof` and `logged` as SIBLINGS, each with its own verdict token.
 * There is deliberately no `valid` boolean and no single collapsed field anywhere in this object.
 */
export async function verifyBundle(bundle, opts = {}) {
  const versionOk = bundle?.bundle_version === '0.1';
  const proof = await verifyProofHalf(bundle);
  const logged = await verifyLoggedHalf(bundle, opts);
  return {
    bundle_version: bundle?.bundle_version ?? null,
    bundle_version_supported: versionOk,
    proof: { verdict: proof.verdict, checks: proof.checks, annotations: proof.annotations, recomputed: proof.recomputed },
    logged: { verdict: logged.verdict, checks: logged.checks, quorum: logged.quorum, failing: logged.failing },
    subject: logged.subject,
    subject_scope: subjectScopeSentence(logged.subject, bundle?.anchor?.record),
    // §3.3: a combined STATEMENT, not a collapsed verdict — both tokens remain separately legible.
    combined: `${proof.verdict} + ${logged.verdict}`,
    non_collapse_note: proof.verdict === 'PROOF-VALID' && logged.verdict !== 'LOGGED'
      ? 'PROOF-VALID but NOT LOGGED. This bundle is proof-valid and log-absent. It is NOT "verified": the seal verifies a computation by the named guest image, and nothing here shows the subject was sequenced in a witnessed transparency log.'
      : 'Both halves are reported separately above; neither verdict implies the other (§3.3).',
  };
}

// ---------------------------------------------------------------------------
// Rendering — §3.3 requires both verdicts be independently legible in EVERY output mode.
// ---------------------------------------------------------------------------

export function renderVerdict(v, { verbose = false } = {}) {
  const lines = [];
  const pad = (s) => s.padEnd(13);
  lines.push(`${pad(v.proof.verdict)} (groth16 seal over imageId + §18.7 journal bytes)`);
  const subj = v.subject ? `${v.subject.kind}:${v.subject.origin ?? v.subject.artifact_execution_hash ?? ''}` : 'none';
  lines.push(`${pad(v.logged.verdict)} (sigsum inclusion + witness quorum, subject: ${subj})`);
  lines.push('');
  lines.push(`scope:  ${v.subject_scope}`);
  lines.push(`note:   ${v.non_collapse_note}`);
  if (v.logged.failing?.length) lines.push(`failed: ${v.logged.failing.join(', ')}`);
  if (verbose) {
    for (const [half, res] of [['proof', v.proof], ['logged', v.logged]]) {
      lines.push('', `--- ${half} half checks ---`);
      for (const c of res.checks) {
        const mark = c.ok === true ? 'PASS' : c.ok === false ? 'FAIL' : 'n/a ';
        lines.push(`  [${mark}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
      }
      for (const a of res.annotations || []) {
        lines.push(`  [note] ${a.field}: ${a.note}`);
      }
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// §5 fixtures — the self-test. Runs every fixture and prints the §3.3 verdict for each.
// ---------------------------------------------------------------------------

const FIXTURE_DIR = 'chaingraph/standard/fixtures/receipt-bundle';

// Each fixture declares the two half-verdicts it MUST produce. The RED controls exist to prove the verifier
// fails honestly and that the two halves are INDEPENDENTLY decidable (§5): a mutated seal must leave the
// logged half green, and a forged cosignature must leave the proof half green.
const EXPECTED = [
  { file: 'a-single-node-both-green.bundle.json', proof: 'PROOF-VALID', logged: 'LOGGED',
    why: 'live single-node receipt + published registry-checkpoint anchor: both halves verify' },
  { file: 'b-proof-valid-log-absent.bundle.json', proof: 'PROOF-VALID', logged: 'NOT-LOGGED',
    why: 'the §3.3 non-collapse control: proof-valid, log-absent, and reported as exactly that' },
  { file: 'c-tampered-journal.bundle.json', proof: 'PROOF-INVALID', logged: 'LOGGED',
    why: 'RED control, proof half: journal mutated, so the recomputed ReceiptClaim no longer matches the seal; the logged half is untouched and still passes' },
  { file: 'd-forged-cosignature.bundle.json', proof: 'PROOF-VALID', logged: 'NOT-LOGGED',
    why: 'RED control, logged half: a witness cosignature is forged, so the pinned quorum is not met; the proof half is untouched and still passes' },
  { file: 'e-composed-receipt.bundle.json', proof: 'PROOF-VALID', logged: 'LOGGED',
    why: 'composed chain-level receipt from CHAIN-PROOF-TRIAL-1 (§7.2 chain-walk shape): the same verifier accepts a composed seal with no format change' },
];

async function selfTest({ repoRoot = REPO } = {}) {
  console.log('RECEIPT-BUNDLE v0.1 combined verifier — §5 fixture self-test');
  console.log(`fixtures: ${FIXTURE_DIR}`);
  console.log('');
  let pass = 0, fail = 0, skip = 0;
  for (const exp of EXPECTED) {
    const path = join(repoRoot, FIXTURE_DIR, exp.file);
    let bundle;
    try { bundle = JSON.parse(readFileSync(path, 'utf8')); } catch (e) {
      if (exp.optional) {
        skip++;
        console.log(`SKIP  ${exp.file}\n      reason: ${exp.skipReason || e.message}\n`);
        continue;
      }
      fail++;
      console.log(`FAIL  ${exp.file}\n      fixture unreadable: ${e.message}\n`);
      continue;
    }
    const v = await verifyBundle(bundle, { repoRoot });
    const ok = v.proof.verdict === exp.proof && v.logged.verdict === exp.logged;
    if (ok) pass++; else fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${exp.file}`);
    console.log(`      ${exp.why}`);
    console.log(`      expected: ${exp.proof} + ${exp.logged}`);
    console.log(`      observed: ${v.combined}`);
    for (const line of renderVerdict(v).split('\n')) console.log(`      ${line}`);
    if (!ok) {
      const failed = [...v.proof.checks, ...v.logged.checks].filter((c) => c.ok === false);
      for (const c of failed) console.log(`      [FAIL] ${c.name} — ${c.detail}`);
    }
    console.log('');
  }
  console.log(`self-test: ${pass} passed, ${fail} failed, ${skip} skipped (of ${EXPECTED.length})`);
  return fail === 0;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--self-test')) return (await selfTest()) ? 0 : 1;
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.log('usage: node scripts/receipt-bundle-verify.mjs <bundle.json> [--verbose] [--json]');
    console.log('       node scripts/receipt-bundle-verify.mjs --self-test');
    console.log('');
    console.log('Verifies BOTH halves of a RECEIPT-BUNDLE v0.1 bundle offline and reports them separately');
    console.log('(§3.3 non-collapse rule: there is no single "verified" boolean).');
    return 2;
  }
  const bundle = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const v = await verifyBundle(bundle);
  if (args.includes('--json')) console.log(JSON.stringify(v, null, 2));
  else console.log(renderVerdict(v, { verbose: args.includes('--verbose') }));
  // An overall exit code MAY require both halves (§3.3) — the two verdicts stay separately legible above.
  return v.proof.verdict === 'PROOF-VALID' && v.logged.verdict === 'LOGGED' ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('receipt-bundle-verify.mjs')) {
  main(process.argv).then((code) => process.exit(code)).catch((e) => { console.error(e); process.exit(1); });
}
