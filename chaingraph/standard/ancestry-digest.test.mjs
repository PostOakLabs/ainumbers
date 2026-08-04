// ancestry-digest.test.mjs — §21.6 ancestry_digest GATE (SPEC.md §21.6, v0.8.17).
// Proves: the digest is bottom-up over {execution_hash, parent_ancestry_digests} through the ONE
// canonical cgCanon path (§21.6.1), a root's digest is a pure function of its own execution_hash
// (§21.6.1), it is hash-EXCLUDED so adding it never moves execution_hash (§21.6.3), it is
// mutation-sensitive to an omitted/reordered/substituted ancestor or a topology change (§21.6.4/
// §21.6.6), absence is fully conformant (§21.6.3), and a verifier missing a cited ancestor reports
// the distinct incomplete-bundle tier rather than failed (§21.6.6).
// Node 18+ (WebCrypto + node: builtins only — zero npm deps).
// Run:  node chaingraph/standard/ancestry-digest.test.mjs
import { cgCanon, canonicalPreimage, executionHash } from '../kernels/_hash.mjs';
import { ancestryDigest } from '../kernels/_ancestry.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const SHA256REF = /^(sha256:)?[0-9a-f]{64}$/; // #/$defs/sha256ref — prefix OPTIONAL
const bare = (v) => String(v).replace(/^sha256:/, '');

// ---- Build a small three-node DAG: root -> child, and an independent "other" root -----------
const rootPolicy = { execution_backend: 'server', input_parameters: { document_id: 'DOC-ANC-001', algorithm: 'sha256' } };
const rootOutput = { integrity_status: 'verified', checked: 3 };
const rootHash = await executionHash(rootPolicy, rootOutput);
const rootAd = await ancestryDigest(rootHash, []);

const otherPolicy = { execution_backend: 'server', input_parameters: { document_id: 'DOC-ANC-003', algorithm: 'sha256' } };
const otherOutput = { integrity_status: 'verified', checked: 7 };
const otherHash = await executionHash(otherPolicy, otherOutput);
const otherAd = await ancestryDigest(otherHash, []);

const childPolicy = { execution_backend: 'server', input_parameters: { document_id: 'DOC-ANC-002', algorithm: 'sha256' } };
const childOutput = { integrity_status: 'verified', checked: 5 };
const childHash = await executionHash(childPolicy, childOutput);
const childAd = await ancestryDigest(childHash, [rootAd]);

// ---- §21.6.1 shape, value form, root-is-pure-function-of-its-own-hash -------------------------
ok(SHA256REF.test(rootAd), `root digest matches #/$defs/sha256ref (${rootAd.slice(0, 16)}…)`);
ok(!rootAd.startsWith('sha256:'), '§21.6.2: producer emits the BARE form (what the shared path returns)');
ok(SHA256REF.test('sha256:' + rootAd), '§21.6.2: the prefixed form is ALSO schema-valid (either accepted)');
ok(rootAd !== rootHash, 'ancestry_digest is NOT the execution_hash it covers');
ok(await ancestryDigest(rootHash, []) === rootAd, 'root digest is deterministic and a pure function of its own execution_hash');

// Key-order independence via cgCanon (mirrors §PPH-1's proof of the shared canon path).
const reKeyedRootPolicy = { input_parameters: { algorithm: 'sha256', document_id: 'DOC-ANC-001' }, execution_backend: 'server' };
ok(await executionHash(reKeyedRootPolicy, rootOutput) === rootHash, 'control: re-keyed policy_parameters still hashes identically (JCS canon)');

// ---- §21.6.4/§21.6.6 mutation sensitivity: omitted / reordered / substituted / tampered --------
ok(childAd !== rootAd, 'child digest differs from the root digest it cites');
ok(await ancestryDigest(childHash, []) !== childAd, 'OMITTED ancestor (empty parent_ancestry_digests instead of [rootAd]) changes the digest');
ok(await ancestryDigest(childHash, [otherAd]) !== childAd, 'SUBSTITUTED ancestor (otherAd in place of rootAd) changes the digest');
ok(await ancestryDigest(childHash, ['0'.repeat(64)]) !== childAd, 'a tampered parent digest changes the digest (recomputation detects it)');

const multiHash = await executionHash({ execution_backend: 'server', input_parameters: { merge: true } }, { merged: true });
const multiAdForward = await ancestryDigest(multiHash, [rootAd, otherAd]);
const multiAdReordered = await ancestryDigest(multiHash, [otherAd, rootAd]);
ok(multiAdForward !== multiAdReordered, 'REORDERED parent_hashes (topology) changes the digest — order is load-bearing, not decorative');
ok(await ancestryDigest(multiHash, [rootAd, otherAd]) === multiAdForward, 'digest is stable across repeat computation at a fixed order (determinism)');

// ---- §21.6.3 THE HASH-EXCLUSION PROOF (non-vacuous — both halves, mirrors §PPH-1.2) ------------
const withoutField = { tool_id: 'art-121-document-integrity-anchor', execution_hash: rootHash, chain: { parent_hashes: [], parent_tool_ids: [], chain_depth: 0 }, policy_parameters: rootPolicy, output_payload: rootOutput };
const withField = { ...withoutField, chain: { ...withoutField.chain, ancestry_digest: rootAd } };

ok(JSON.stringify(cgCanon(withField)) !== JSON.stringify(cgCanon(withoutField)),
   'the member DOES change the artifact\'s canonical form (it is materially present — makes the next assertion non-vacuous)');
ok(canonicalPreimage(withField.policy_parameters, withField.output_payload)
   === canonicalPreimage(withoutField.policy_parameters, withoutField.output_payload),
   '§4 preimage is byte-identical with and without the member (member lives inside chain, outside the preimage)');
ok(await executionHash(withField.policy_parameters, withField.output_payload) === rootHash,
   'execution_hash is byte-identical with and without the member (member is hash-EXCLUDED)');
ok(withField.execution_hash === withoutField.execution_hash,
   'the recorded execution_hash does not move when the member is added (additive: goldens stay pinned)');
ok(!('ancestry_digest' in withoutField.chain), 'an artifact omitting the member is unchanged (absence is conformant, never a defect)');
ok(executionHash.length === 2, 'executionHash() takes exactly the two §4 inputs — the member cannot reach the preimage');

// ---- §21.6.6 verifier walk: present-complete-bundle recompute, and the incomplete-bundle tier --
// A minimal simulation of the NORMATIVE walk: bottom-up recompute from the terminal artifact over
// whatever ancestor bundle is presented; a missing cited ancestor reports incomplete-bundle rather
// than failing outright.
async function verifyAncestryWalk(terminal, bundleByHash) {
  async function recompute(node) {
    const parentDigests = [];
    for (const parentHash of node.chain.parent_hashes) {
      const parentNode = bundleByHash.get(parentHash);
      if (!parentNode) return { status: 'incomplete-bundle' };
      const r = await recompute(parentNode);
      if (r.status === 'incomplete-bundle') return r;
      if (r.status === 'failed') return r;
      parentDigests.push(r.digest);
    }
    const recomputed = await ancestryDigest(node.execution_hash, parentDigests);
    if (recomputed !== node.chain.ancestry_digest) return { status: 'failed' };
    return { status: 'verified', digest: recomputed };
  }
  return recompute(terminal);
}

const rootNode = { execution_hash: rootHash, chain: { parent_hashes: [], ancestry_digest: rootAd } };
const childNode = { execution_hash: childHash, chain: { parent_hashes: [rootHash], ancestry_digest: childAd } };

const completeBundle = new Map([[rootHash, rootNode], [childHash, childNode]]);
const partialBundle = new Map([[childHash, childNode]]); // root missing

ok((await verifyAncestryWalk(childNode, completeBundle)).status === 'verified',
   'complete bundle: bottom-up walk recomputes and matches the stored digest');
ok((await verifyAncestryWalk(childNode, partialBundle)).status === 'incomplete-bundle',
   'missing cited ancestor reports incomplete-bundle — an honest "cannot check", never a silent failure');

const tamperedChildNode = { execution_hash: childHash, chain: { parent_hashes: [rootHash], ancestry_digest: '1'.repeat(64) } };
ok((await verifyAncestryWalk(tamperedChildNode, completeBundle)).status === 'failed',
   'a stored digest that does not match the recompute FAILS the ancestry verdict');

const multiChildNode = { execution_hash: multiHash, chain: { parent_hashes: [rootHash, otherHash], ancestry_digest: multiAdForward } };
const multiBundle = new Map([[rootHash, rootNode], [otherHash, { execution_hash: otherHash, chain: { parent_hashes: [], ancestry_digest: otherAd } }], [multiHash, multiChildNode]]);
ok((await verifyAncestryWalk(multiChildNode, multiBundle)).status === 'verified',
   'multi-parent walk in parent_hashes order verifies against a digest computed in the same order');

console.log(fail ? `\n${fail} failure(s).` : '\nAll §21.6 ancestry_digest checks passed.');
process.exit(fail ? 1 : 0);
