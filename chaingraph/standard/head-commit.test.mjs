// head-commit.test.mjs — §HEAD-1 GATE (SPEC.md §HEAD-1, additive slug section).
// Proves: genesis shape, chain linking (prev_head_hash/seq), signer-rotation continuity, and
// equivocation detection over the head-commit primitive in ../kernels/_head.mjs.
// Node 18+, zero npm deps.
// Run:  node chaingraph/standard/head-commit.test.mjs
import { buildHead, headHash, signHead, verifyHeadProof, verifyChain, detectEquivocation, didKeyToPublicKey, rawPubkeyToDidKey } from '../kernels/_head.mjs';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

async function keypair() {
  const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const did = await rawPubkeyToDidKey(kp.publicKey);
  return { ...kp, did };
}

// ---- §HEAD-1.0 genesis vector ----
{
  const signer = await keypair();
  const genesis = buildHead({ stream: 'urn:ocg:test-stream-1', signer: signer.did, seq: 0, prev_head_hash: null, root: 'sha256:' + '11'.repeat(32), timestamp: '2026-08-05T00:00:00Z' });
  const signed = await signHead(genesis, { verificationMethod: signer.did, created: '2026-08-05T00:00:00Z', privateKey: signer.privateKey });
  ok(signed.proof && signed.proof.cryptosuite === 'eddsa-jcs-2022', 'genesis head carries an eddsa-jcs-2022 proof');
  ok(await verifyHeadProof(signed, signer.publicKey), 'genesis head proof verifies against the signer public key');
  const wrong = await keypair();
  ok(!(await verifyHeadProof(signed, wrong.publicKey)), 'genesis head proof rejects the wrong public key');
  const h = await headHash(signed);
  ok(h.startsWith('sha256:') && h.length === 71, 'headHash() returns a "sha256:"-prefixed 64-hex digest');
  const hUnsigned = await headHash(genesis);
  ok(h === hUnsigned, 'headHash() is identical whether or not the object carries .proof (proof is stripped first)');

  const tampered = { ...signed, seq: 99 };
  ok(!(await verifyHeadProof(tampered, signer.publicKey)), 'a tampered field (seq) invalidates the proof — proof covers the full secured document');
}

// ---- §HEAD-1.2 chain: genesis -> head 1 -> head 2, all same signer ----
{
  const signer = await keypair();
  const root0 = 'sha256:' + '00'.repeat(32);
  const g = await signHead(buildHead({ stream: 's', signer: signer.did, seq: 0, prev_head_hash: null, root: root0, timestamp: '2026-08-05T00:00:00Z' }), { verificationMethod: signer.did, created: '2026-08-05T00:00:00Z', privateKey: signer.privateKey });
  const gHash = await headHash(g);
  const h1 = await signHead(buildHead({ stream: 's', signer: signer.did, seq: 1, prev_head_hash: gHash, root: 'sha256:' + '01'.repeat(32), timestamp: '2026-08-05T00:01:00Z' }), { verificationMethod: signer.did, created: '2026-08-05T00:01:00Z', privateKey: signer.privateKey });
  const h1Hash = await headHash(h1);
  const h2 = await signHead(buildHead({ stream: 's', signer: signer.did, seq: 2, prev_head_hash: h1Hash, root: 'sha256:' + '02'.repeat(32), timestamp: '2026-08-05T00:02:00Z' }), { verificationMethod: signer.did, created: '2026-08-05T00:02:00Z', privateKey: signer.privateKey });

  const resolveKey = async (did) => (did === signer.did ? signer.publicKey : null);
  const result = await verifyChain([g, h1, h2], { resolveKey });
  ok(result.valid, 'three-head same-signer chain verifies clean: ' + JSON.stringify(result.errors));
  ok(result.length === 3 && result.headHashes.length === 3, 'verifyChain() reports length + per-head hashes');

  // break seq monotonicity
  const h2BadSeq = { ...h2, seq: 1 };
  const brokenSeq = await verifyChain([g, h1, h2BadSeq], { resolveKey });
  ok(!brokenSeq.valid && brokenSeq.errors.some((e) => e.includes('seq')), 'non-increasing seq is rejected');

  // break prev_head_hash link
  const h2BadPrev = { ...h2, prev_head_hash: 'sha256:' + 'ff'.repeat(32) };
  const brokenPrev = await verifyChain([g, h1, h2BadPrev], { resolveKey });
  ok(!brokenPrev.valid && brokenPrev.errors.some((e) => e.includes('prev_head_hash')), 'a broken prev_head_hash link is rejected');

  // structural-only mode (no resolveKey) still runs chain laws and flags the skipped crypto check
  const structuralOnly = await verifyChain([g, h1, h2]);
  ok(!structuralOnly.valid, 'omitting resolveKey never silently passes — it is reported as an explicit error, not a pass');
  ok(structuralOnly.errors.every((e) => e.includes('NOT cryptographically verified')), 'structural-only mode names exactly the skipped-crypto reason, no other spurious errors');
}

// ---- §HEAD-1.2 signer rotation: old key signs a head naming the new key, then new key continues ----
{
  const oldSigner = await keypair();
  const newSigner = await keypair();
  const g = await signHead(buildHead({ stream: 'rot', signer: oldSigner.did, seq: 0, prev_head_hash: null, root: 'sha256:' + '10'.repeat(32), timestamp: '2026-08-05T00:00:00Z' }), { verificationMethod: oldSigner.did, created: '2026-08-05T00:00:00Z', privateKey: oldSigner.privateKey });
  const gHash = await headHash(g);
  // rotation head: STILL signed by the OLD key, but declares rotates_to = new key
  const rotHead = buildHead({ stream: 'rot', signer: oldSigner.did, seq: 1, prev_head_hash: gHash, root: 'sha256:' + '11'.repeat(32), timestamp: '2026-08-05T00:01:00Z', rotates_to: newSigner.did });
  const rot = await signHead(rotHead, { verificationMethod: oldSigner.did, created: '2026-08-05T00:01:00Z', privateKey: oldSigner.privateKey });
  const rotHash = await headHash(rot);
  const next = await signHead(buildHead({ stream: 'rot', signer: newSigner.did, seq: 2, prev_head_hash: rotHash, root: 'sha256:' + '12'.repeat(32), timestamp: '2026-08-05T00:02:00Z' }), { verificationMethod: newSigner.did, created: '2026-08-05T00:02:00Z', privateKey: newSigner.privateKey });

  const resolveKey = async (did) => (did === oldSigner.did ? oldSigner.publicKey : did === newSigner.did ? newSigner.publicKey : null);
  const result = await verifyChain([g, rot, next], { resolveKey });
  ok(result.valid, 'rotation chain (old key -> rotates_to -> new key continues) verifies clean: ' + JSON.stringify(result.errors));

  // an UNANNOUNCED signer swap (no rotates_to on the prior head) MUST fail
  const badNext = await signHead(buildHead({ stream: 'rot', signer: newSigner.did, seq: 2, prev_head_hash: gHash, root: 'sha256:' + '12'.repeat(32), timestamp: '2026-08-05T00:02:00Z' }), { verificationMethod: newSigner.did, created: '2026-08-05T00:02:00Z', privateKey: newSigner.privateKey });
  const badResult = await verifyChain([g, badNext], { resolveKey });
  ok(!badResult.valid && badResult.errors.some((e) => e.includes('signer discontinuity')), 'an unannounced signer swap (no matching rotates_to) is rejected');
}

// ---- §HEAD-1.4 equivocation-refusal: same signer, same (stream, seq), two different heads ----
{
  const signer = await keypair();
  const a = await signHead(buildHead({ stream: 'eq', signer: signer.did, seq: 0, prev_head_hash: null, root: 'sha256:' + 'aa'.repeat(32), timestamp: '2026-08-05T00:00:00Z' }), { verificationMethod: signer.did, created: '2026-08-05T00:00:00Z', privateKey: signer.privateKey });
  const b = await signHead(buildHead({ stream: 'eq', signer: signer.did, seq: 0, prev_head_hash: null, root: 'sha256:' + 'bb'.repeat(32), timestamp: '2026-08-05T00:00:01Z' }), { verificationMethod: signer.did, created: '2026-08-05T00:00:01Z', privateKey: signer.privateKey });

  const eq = await detectEquivocation(a, b);
  ok(eq.equivocation === true, 'two different heads at the same (stream, seq) from the same signer flag equivocation');

  const same = await detectEquivocation(a, a);
  ok(same.equivocation === false, 'comparing a head against itself is never equivocation');

  const otherSigner = await keypair();
  const c = await signHead(buildHead({ stream: 'eq', signer: otherSigner.did, seq: 0, prev_head_hash: null, root: 'sha256:' + 'cc'.repeat(32), timestamp: '2026-08-05T00:00:02Z' }), { verificationMethod: otherSigner.did, created: '2026-08-05T00:00:02Z', privateKey: otherSigner.privateKey });
  const disputed = await detectEquivocation(a, c);
  ok(disputed.equivocation === false, 'different signers at the same (stream, seq) is a dispute, not one-signer equivocation');

  const diffSeq = await signHead(buildHead({ stream: 'eq', signer: signer.did, seq: 1, prev_head_hash: await headHash(a), root: 'sha256:' + 'dd'.repeat(32), timestamp: '2026-08-05T00:00:03Z' }), { verificationMethod: signer.did, created: '2026-08-05T00:00:03Z', privateKey: signer.privateKey });
  const notComparable = await detectEquivocation(a, diffSeq);
  ok(notComparable.equivocation === false, 'different (stream, seq) pairs are simply not comparable, not flagged as equivocation');
}

// ---- structural guards on buildHead() ----
{
  let threw = false;
  try { buildHead({ stream: 's', signer: 'not-a-did-key', seq: 0, prev_head_hash: null, root: 'sha256:' + '00'.repeat(32), timestamp: '2026-08-05T00:00:00Z' }); } catch (e) { threw = /did:key/.test(e.message); }
  ok(threw, 'buildHead() rejects a signer that is not a did:key');

  threw = false;
  try { buildHead({ stream: 's', signer: 'did:key:zAbc', seq: -1, prev_head_hash: null, root: 'sha256:' + '00'.repeat(32), timestamp: '2026-08-05T00:00:00Z' }); } catch (e) { threw = /seq/.test(e.message); }
  ok(threw, 'buildHead() rejects a negative seq');
}

console.log(fail ? `\n${fail} failure(s).` : '\nAll §HEAD-1 head-commit checks passed.');
process.exit(fail ? 1 : 0);
