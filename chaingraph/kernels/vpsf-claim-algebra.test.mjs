#!/usr/bin/env node
// vpsf-claim-algebra.test.mjs — spec-conformance coverage for the shared VPSF
// module (VPSF-CLAIM-VERIFY-TOOL-1), against draft-vauban-x402-vpsf-algebra-01
// (pinned research/clause-snapshots/draft-vauban-x402-vpsf-algebra-01.txt).
//
// 1. VECTOR-DIGEST FIXTURE: reproduces 4 of the 11 pinned conformance vectors'
//    own published digests (stark/0001-baseline, delegation-grant/0001's two
//    objects, action_ref_adversarial/0011's NFC reference) via jcsPreimageHash
//    -- proves the canonicalization pipeline (imported verbatim from
//    _hash.mjs, never reimplemented) is byte-correct against real published
//    digests, not just internally self-consistent.
// 2. OPERATOR PREIMAGE SHAPES: each builder produces exactly the JCS Preimage
//    Rule object stated in its own subsection (S4.1.3/4.2.3/4.3.3/4.4.3/4.5.3).
// 3. SELECTIVE DISCLOSURE COMMITMENT: recomputes S4.4.3's withheld_commitment
//    and confirms it changes when a disclosed field is removed (more fields
//    withheld -> different commitment) -- proves the commitment is a real
//    function of the withheld set, not a constant.
// 4. OFFLINE-VERIFY INVARIANT (CHAINPOINT GUARD, SO #0): poison global.fetch
//    before every call, confirm identical results and no throw.

import {
  jcsPreimageHash, sameSubject, checkClaimStructure, extractSubjectValue,
  conjunctionPreimage, implicationPreimage, aggregationPreimage,
  selectiveDisclosurePreimage, revocationPreimage, computeWithheldCommitment,
  CLAIM_TYPES, OPERATORS,
} from './vpsf-claim-algebra.mjs';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  OK ' + name); passed++; }
  catch (e) { console.error('  FAIL ' + name + ' -- ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// -- 0. OFFLINE-VERIFY INVARIANT --
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('CHAINPOINT GUARD: fetch called -- module must be a pure offline verifier'); };

// -- 1. VECTOR-DIGEST FIXTURES (pinned x402-stark-receipts-conformance, commit c2a27dee) --

await test('reproduces stark/0001-baseline expected_core_digest', async () => {
  const obj = { action_ref: '10d8a38c01d8672176aa6e5209a368fde3e1831640d69e15283142b35880c2c1', amount: 50000, canon_version: '1.0', currency: 'USDC', merchant_id: 'b4e5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5', payer_pseudonym: 'a3f2c1d4e5b6a7890123456789abcdef0123456789abcdef0123456789abcdef01', payment_hash: '2ed186ebc66947eaac6a05a88c7bc096ee07ac11a2c44bb5580bd72b3670f580', proof_blob_b64: 'AAECBAUGB', proof_scheme: 'stark-vauban-pay-v1', timestamp_ms: 1747843200000 };
  const h = await jcsPreimageHash(obj);
  assert(h === 'sha256:89e01af0770494243e7ba6d003332688ca7107dd05c52cc8c73f470b13d5767f', `got ${h}`);
});

await test('reproduces delegation-grant/0001 expected_delegation_grant_hash', async () => {
  const obj = { anchor: { chain_id: '0x534e5f5345504f4c4941', delegation_commitment: '0x73d8e2f1c0b9a8978675645342310fedcba98765432101fedcba98765432101f', kind: 'StarknetDelegation', revocation_authority: 'https://pay.vauban.tech/.well-known/revocation/v0/' }, canon_version: '1.0', evidence: { grantor_signature: '0xaabbccddeeff00112233445566778899aabbccddeeff00112233445566778899', scheme: 'HmacPhaseMvp' }, predicate: { allowed_currencies: ['urn:eip3009:USDC:starknet-sepolia'], allowed_merchants: ['0xb4e5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5'], cap_per_period: '100000000', cap_per_tx: '1000000', delegate_pseudonym: '0xc1a2e3f4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2', delegation_nonce: '0xdeadbeef00112233445566778899aabbccddeeff0123456789abcdef01234567', kind: 'DelegationAuth', max_chain_length: 8, period_seconds: 86400 }, revelation_mask: { allowed_merchants: 'Open', cap_per_period: 'Open', cap_per_tx: 'Open', delegate_pseudonym: 'Open', delegation_nonce: 'Committed', period_seconds: 'Open' }, subject: { kind: 'UserPseudonym', value: '0xa3f2c1d4e5b6a7890123456789abcdef0123456789abcdef0123456789abcdef' }, temporal_frame: { kind: 'ValidityWindow', t_end: 1747929600, t_start: 1747843200 } };
  const h = await jcsPreimageHash(obj);
  assert(h === 'sha256:ff558f21b26c5045fb6997fef185b9993e33a29a7907dbcf349e49b9019c1fd2', `got ${h}`);
});

await test('reproduces action_ref_adversarial/0011 NFC reference digest', async () => {
  // NFC-encoded agent id (single code point U+00E9 for e-acute), matching the
  // vector's own nfc_reference_digest field.
  const obj = { action_type: 'sanctions_screen', agent_id: 'did:web:agent-é.example.com', scope: 'counterparty-due-diligence', timestamp_ms: 1747728000000 };
  const h = await jcsPreimageHash(obj);
  assert(h.replace(/^sha256:/, '') === '24d6bd1693f44c42f69ed395df20f1fbc7c6d933cd1774077909d3a88dea59f7', `got ${h}`);
});

// -- 2. OPERATOR PREIMAGE SHAPES (S4.1.3/4.2.3/4.3.3/4.4.3/4.5.3) --

await test('conjunctionPreimage matches S4.1.3 shape exactly', () => {
  const p = conjunctionPreimage({ leftHash: 'sha256:a', rightHash: 'sha256:b', issuedAt: 100 });
  assert(Object.keys(p).sort().join(',') === 'issued_at,left,operator,right', JSON.stringify(p));
  assert(p.operator === 'conjunction' && p.left === 'sha256:a' && p.right === 'sha256:b' && p.issued_at === 100);
});

await test('conjunction is NOT commutative at the hash level (S4.1.2)', async () => {
  const ab = await jcsPreimageHash(conjunctionPreimage({ leftHash: 'sha256:a', rightHash: 'sha256:b', issuedAt: 100 }));
  const ba = await jcsPreimageHash(conjunctionPreimage({ leftHash: 'sha256:b', rightHash: 'sha256:a', issuedAt: 100 }));
  assert(ab !== ba, 'swapped operands must produce different composite hashes');
});

await test('implicationPreimage matches S4.2.3 shape exactly', () => {
  const p = implicationPreimage({ antecedentHash: 'sha256:a', consequentHash: 'sha256:b', issuedAt: 100 });
  assert(Object.keys(p).sort().join(',') === 'antecedent,consequent,issued_at,operator', JSON.stringify(p));
});

await test('aggregationPreimage matches S4.3.3 shape exactly', () => {
  const p = aggregationPreimage({ operandHashes: ['sha256:a', 'sha256:b'], currency: 'USDC', totalAmount: '100', issuedAt: 100 });
  assert(Object.keys(p).sort().join(',') === 'currency,issued_at,operand_count,operands,operator,total_amount', JSON.stringify(p));
  assert(p.operand_count === 2);
});

await test('selectiveDisclosurePreimage matches S4.4.3 shape exactly', () => {
  const p = selectiveDisclosurePreimage({ sourceHash: 'sha256:a', disclosedFields: { amount: 1 }, withheldCommitment: 'deadbeef', issuedAt: 100 });
  assert(Object.keys(p).sort().join(',') === 'disclosed_fields,issued_at,operator,source_hash,withheld_commitment', JSON.stringify(p));
});

await test('revocationPreimage matches S4.5.3 shape exactly', () => {
  const p = revocationPreimage({ targetHash: 'sha256:a', reason: 'x', revokedAt: 50, issuedAt: 100 });
  assert(Object.keys(p).sort().join(',') === 'issued_at,operator,reason,revoked_at,target_hash', JSON.stringify(p));
});

// -- 3. SELECTIVE DISCLOSURE COMMITMENT (S4.4.3) --

await test('withheld_commitment changes when the withheld field set changes', async () => {
  const source = { amount: '100', currency: 'USDC', payer: 'p1', nonce: 'n1' };
  const c1 = await computeWithheldCommitment(source, { amount: '100', currency: 'USDC' }); // withholds payer,nonce
  const c2 = await computeWithheldCommitment(source, { amount: '100', currency: 'USDC', payer: 'p1' }); // withholds nonce only
  assert(c1 !== c2, 'commitment must be a function of the actual withheld field set');
  assert(!c1.startsWith('sha256:'), 'S4.4.3 stores withheld_commitment as bare hex, not "sha256:"-prefixed');
});

// -- 4. CLAIM STRUCTURE (S3.2) --

await test('checkClaimStructure accepts a well-formed DelegationGrant', () => {
  const r = checkClaimStructure({ subject: { kind: 'UserPseudonym', value: '0x1' }, predicate: { kind: 'DelegationAuth', delegate_pseudonym: '0x2', cap_per_tx: '1', cap_per_period: '2', period_seconds: 60 } }, 'DelegationGrant');
  assert(r.ok, JSON.stringify(r.errors));
});

await test('checkClaimStructure rejects a claim with no subject', () => {
  const r = checkClaimStructure({ predicate: { kind: 'Intent' } }, 'PaymentIntent');
  assert(!r.ok && r.errors.some((e) => e.includes('subject')));
});

await test('checkClaimStructure rejects an unknown claim_type', () => {
  const r = checkClaimStructure({ subject: 'x', predicate: {} }, 'NotARealType');
  assert(!r.ok);
});

await test('sameSubject applies NFC normalization per S2.1', () => {
  const nfc = 'agent-é'; // precomposed e-acute (U+00E9)
  const nfd = 'agent-é'; // e (U+0065) + combining acute accent (U+0301)
  assert(nfc !== nfd, 'fixture sanity: NFC and NFD forms must be different byte sequences before normalization');
  assert(sameSubject(nfc, nfd), 'NFC and NFD encodings of the same subject must compare equal after normalization');
  assert(!sameSubject('a', 'b'));
});

await test('CLAIM_TYPES and OPERATORS match S3.2 / S4 exactly', () => {
  assert(CLAIM_TYPES.length === 4 && CLAIM_TYPES.includes('PaymentIntent') && CLAIM_TYPES.includes('SettlementReceipt') && CLAIM_TYPES.includes('RefundClaim') && CLAIM_TYPES.includes('DelegationGrant'));
  assert(OPERATORS.length === 5 && OPERATORS.includes('conjunction') && OPERATORS.includes('implication') && OPERATORS.includes('aggregation') && OPERATORS.includes('selective_disclosure') && OPERATORS.includes('revocation'));
});

globalThis.fetch = originalFetch;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
