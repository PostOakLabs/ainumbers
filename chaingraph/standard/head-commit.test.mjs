// head-commit.test.mjs — §HEAD-1 GATE (SPEC.md §HEAD-1, additive slug section).
// Proves: genesis shape, chain linking (prev_head_hash/seq), signer-rotation continuity, and
// equivocation detection over the head-commit primitive in ../kernels/_head.mjs.
// Node 18+, zero npm deps.
// Run:  node chaingraph/standard/head-commit.test.mjs
import { buildHead, headHash, signHead, verifyHeadProof, verifyChain, detectEquivocation, didKeyToPublicKey, rawPubkeyToDidKey } from '../kernels/_head.mjs';
import { BINDING_TYPE, buildNoteText, parseNote, signCosignLine, buildBilateralCosignBinding, verifyBilateralCosignBinding } from '../kernels/_bilateral-cosign.mjs';

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

// ── SPEC.md §HEAD-1.3 `ocg-head-bilateral-cosign@1` — BILAT-COSIGN-BUILD-SPEC.md §5 vectors ──
// Reference verifier: ../kernels/_bilateral-cosign.mjs. All eight vectors are pure functions
// over supplied fixtures — no network, no live counterparty (§5's offline-verifiable posture).

async function makeHead(streamSuffix) {
  const signer = await keypair();
  const head = await signHead(
    buildHead({ stream: 'bilat-' + streamSuffix, signer: signer.did, seq: 0, prev_head_hash: null, root: 'sha256:' + '77'.repeat(32), timestamp: '2026-08-07T00:00:00Z' }),
    { verificationMethod: signer.did, created: '2026-08-07T00:00:00Z', privateKey: signer.privateKey },
  );
  return { signer, head };
}

// ---- §5 vector 1: valid n-of-n bilateral cosign ----
{
  const { head } = await makeHead('v1');
  const cosignerA = await keypair();
  const cosignerB = await keypair();
  const binding = await buildBilateralCosignBinding(head, [{ didKey: cosignerA.did, privateKey: cosignerA.privateKey }, { didKey: cosignerB.did, privateKey: cosignerB.privateKey }], { logOrigin: 'orgA<->orgB/stream-v1', timestampMs: 1_770_000_000_000 });
  ok(binding.type === BINDING_TYPE, 'v1: binding carries the ocg-head-bilateral-cosign@1 type string');
  const result = await verifyBilateralCosignBinding(binding, head);
  ok(result.valid, 'v1: valid n-of-n bilateral cosign (2 of 2) verifies: ' + JSON.stringify(result.errors));
  ok(result.valid_witness_count === 2 && result.threshold === 2, 'v1: n-of-n threshold defaults to cosigner_keys.length when omitted');
}

// ---- §5 vector 2: valid k-of-n bilateral cosign (explicit threshold, only k of n present) ----
{
  const { head } = await makeHead('v2');
  const cosignerA = await keypair();
  const cosignerB = await keypair();
  const cosignerC = await keypair();
  const binding = await buildBilateralCosignBinding(head, [{ didKey: cosignerA.did, privateKey: cosignerA.privateKey }], { logOrigin: 'orgA<->orgB,orgC/stream-v2', timestampMs: 1_770_000_000_000, threshold: 1 });
  binding.cosigner_keys = [cosignerA.did, cosignerB.did, cosignerC.did]; // relationship names 3 possible cosigners
  const result = await verifyBilateralCosignBinding(binding, head);
  ok(result.valid && result.valid_witness_count === 1 && result.threshold === 1, 'v2: k-of-n (1 of 3) verifies when the explicit threshold is met: ' + JSON.stringify(result.errors));
}

// ---- §5 vector 3: below-threshold — fewer than k valid lines MUST FAIL ----
{
  const { head } = await makeHead('v3');
  const cosignerA = await keypair();
  const cosignerB = await keypair();
  const binding = await buildBilateralCosignBinding(head, [{ didKey: cosignerA.did, privateKey: cosignerA.privateKey }], { logOrigin: 'orgA<->orgB/stream-v3', timestampMs: 1_770_000_000_000, threshold: 2 });
  binding.cosigner_keys = [cosignerA.did, cosignerB.did]; // threshold 2, but only A actually signed
  const result = await verifyBilateralCosignBinding(binding, head);
  ok(!result.valid && result.valid_witness_count === 1 && result.threshold === 2, 'v3: below-threshold (1 of 2 required) MUST FAIL: ' + JSON.stringify(result.errors));
}

// ---- §5 vector 4: tamper fixture — mutated head_hash post-cosign MUST FAIL ----
{
  const { head } = await makeHead('v4');
  const cosignerA = await keypair();
  const binding = await buildBilateralCosignBinding(head, [{ didKey: cosignerA.did, privateKey: cosignerA.privateKey }], { logOrigin: 'orgA<->orgB/stream-v4', timestampMs: 1_770_000_000_000 });
  const goodResult = await verifyBilateralCosignBinding(binding, head);
  ok(goodResult.valid, 'v4 precondition: the untampered head verifies against its own binding: ' + JSON.stringify(goodResult.errors));
  const mutatedHead = { ...head, seq: head.seq + 1 }; // a mutated field moves head_hash; OLD proof/binding stays attached
  const tamperedResult = await verifyBilateralCosignBinding(binding, mutatedHead);
  ok(!tamperedResult.valid && !tamperedResult.anchored_hash_match, 'v4: a mutated head_hash under an unchanged binding MUST FAIL (anchored_hash no longer matches): ' + JSON.stringify(tamperedResult.errors));
}

// ---- §5 vector 5: wrong-key fixture — a valid line from a key NOT in cosigner_keys MUST FAIL and MUST NOT silently count ----
{
  const { head } = await makeHead('v5');
  const cosignerA = await keypair();
  const cosignerB = await keypair(); // named as a required cosigner, but never actually signs
  const outsider = await keypair(); // signs, but is not named in cosigner_keys at all
  const anchoredHash = await headHash(head);
  const noteText = buildNoteText('orgA<->orgB/stream-v5', anchoredHash);
  const lineA = await signCosignLine(noteText, { didKey: cosignerA.did, privateKey: cosignerA.privateKey, timestampMs: 1_770_000_000_000 });
  const lineOutsider = await signCosignLine(noteText, { didKey: outsider.did, privateKey: outsider.privateKey, timestampMs: 1_770_000_000_000 });
  const binding = {
    type: BINDING_TYPE, anchored_hash: anchoredHash, log_origin: 'orgA<->orgB/stream-v5',
    proof: noteText + '\n' + lineA + '\n' + lineOutsider + '\n', // outsider's line is syntactically valid but unlisted
    cosigner_keys: [cosignerA.did, cosignerB.did], threshold: 2,
  };
  const result = await verifyBilateralCosignBinding(binding, head);
  ok(!result.valid && result.valid_witness_count === 1, 'v5: an unlisted-but-valid cosignature line does not count toward the threshold: ' + JSON.stringify(result.errors));
  ok(result.cosignatures.every((c) => c.name !== outsider.did), 'v5: the outsider key is never even looked up (only cosigner_keys names are checked)');
}

// ---- §5 vector 6: equivocation fixture, cosigned on both sides ----
{
  const signer = await keypair();
  const cosignerA = await keypair();
  const cosignerB = await keypair();
  const headA = await signHead(buildHead({ stream: 'bilat-eq', signer: signer.did, seq: 5, prev_head_hash: 'sha256:' + '55'.repeat(32), root: 'sha256:' + 'aa'.repeat(32), timestamp: '2026-08-07T00:00:00Z' }), { verificationMethod: signer.did, created: '2026-08-07T00:00:00Z', privateKey: signer.privateKey });
  const headB = await signHead(buildHead({ stream: 'bilat-eq', signer: signer.did, seq: 5, prev_head_hash: 'sha256:' + '55'.repeat(32), root: 'sha256:' + 'bb'.repeat(32), timestamp: '2026-08-07T00:00:01Z' }), { verificationMethod: signer.did, created: '2026-08-07T00:00:01Z', privateKey: signer.privateKey });

  const bindingA = await buildBilateralCosignBinding(headA, [{ didKey: cosignerA.did, privateKey: cosignerA.privateKey }], { logOrigin: 'orgA<->orgB/stream-eq', timestampMs: 1_770_000_000_000 });
  const bindingB = await buildBilateralCosignBinding(headB, [{ didKey: cosignerB.did, privateKey: cosignerB.privateKey }], { logOrigin: 'orgA<->orgB/stream-eq', timestampMs: 1_770_000_000_100 });

  const resultA = await verifyBilateralCosignBinding(bindingA, headA);
  const resultB = await verifyBilateralCosignBinding(bindingB, headB);
  ok(resultA.valid && resultB.valid, 'v6: each conflicting head is independently well-formed and validly cosigned: ' + JSON.stringify([resultA.errors, resultB.errors]));

  const eq = await detectEquivocation(headA, headB);
  ok(eq.equivocation === true, 'v6: detectEquivocation() still flags the pair — cosigning adds evidentiary weight, not a new check');
}

// ---- §5 vector 7: non-conflicting repeat — the same head presented twice, cosigned once, is NOT equivocation ----
{
  const { head } = await makeHead('v7');
  const cosignerA = await keypair();
  const binding = await buildBilateralCosignBinding(head, [{ didKey: cosignerA.did, privateKey: cosignerA.privateKey }], { logOrigin: 'orgA<->orgB/stream-v7', timestampMs: 1_770_000_000_000 });
  const result = await verifyBilateralCosignBinding(binding, head);
  ok(result.valid, 'v7 precondition: the single cosigned head verifies: ' + JSON.stringify(result.errors));
  const eq = await detectEquivocation(head, head);
  ok(eq.equivocation === false, 'v7: the identical head presented twice (cosigned once) is NOT flagged as equivocation — unchanged §HEAD-1.4 behavior');
}

// ---- §5 vector 8: unknown-type forward-compat — a verifier without support for this type skips it ----
{
  const { signer, head } = await makeHead('v8');
  const unknownBinding = { type: 'ocg-head-file@1', href: 'https://example.org/heads/whatever.json' };
  const result = await verifyBilateralCosignBinding(unknownBinding, head);
  ok(result.skipped === true && result.valid === false, 'v8: an unrecognized anchor_bindings[] type is reported as skipped, not a parse/verification error');
  // Head-chain verification is entirely unaffected: a binding is never part of the head object's
  // own hashed shape, so the SAME head still verifies cleanly regardless of what anchor_bindings
  // (recognized or not) a caller may separately be tracking alongside it.
  const chainResult = await verifyChain([head], { resolveKey: async (did) => (did === signer.did ? signer.publicKey : null) });
  ok(chainResult.valid, 'v8: an unrecognized backing-ladder type never surfaces as a head-chain verification failure — bindings sit entirely outside the hashed head shape: ' + JSON.stringify(chainResult.errors));
}

console.log(fail ? `\n${fail} failure(s).` : '\nAll §HEAD-1 head-commit checks passed.');
process.exit(fail ? 1 : 0);
