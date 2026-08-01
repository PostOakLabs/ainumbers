#!/usr/bin/env node
// pqc-inventory.test.mjs — asserts pqc-inventory.mjs's classification invariants against the real repo:
//   - SHA-256/SHA3 are never classified at-risk (PQC-READINESS-BUILD-SPEC.md §1.2)
//   - Ed25519 and groth16-bn254 ARE classified at-risk (§1.1)
//   - the §2.2 hypothesis trace runs and returns a verdict string
//   - every surface has a classification + reachable flag (no silently-dropped fields)

import { buildInventory } from './pqc-inventory.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const inv = buildInventory();

test('every surface has a classification in {at-risk, acceptable, pqc}', () => {
  const allowed = new Set(['at-risk', 'acceptable', 'pqc']);
  for (const s of inv.surfaces) {
    assert(allowed.has(s.classification), `unexpected classification "${s.classification}" on ${s.surface}`);
  }
});

test('every surface has a boolean reachable flag', () => {
  for (const s of inv.surfaces) {
    assert(typeof s.reachable === 'boolean', `reachable not boolean on ${s.surface}`);
  }
});

test('§1.2 correction respected: no SHA-256/SHA3 surface is classified at-risk', () => {
  const hashSurfaces = inv.surfaces.filter(s => /SHA-256|SHA3|SHAKE256/i.test(s.algorithm));
  assert(hashSurfaces.length > 0, 'expected at least one SHA-256/SHA3 surface in the inventory');
  for (const s of hashSurfaces) {
    assert(s.classification === 'acceptable', `${s.surface} carries algorithm "${s.algorithm}" but classification is "${s.classification}", expected "acceptable"`);
  }
});

test('§1.1: Ed25519 surfaces are classified at-risk', () => {
  const ed25519Surfaces = inv.surfaces.filter(s => /Ed25519/i.test(s.algorithm));
  assert(ed25519Surfaces.length > 0, 'expected at least one Ed25519 surface');
  for (const s of ed25519Surfaces) {
    assert(s.classification === 'at-risk', `${s.surface} is Ed25519 but classified "${s.classification}"`);
  }
});

test('§1.1: groth16-bn254 (pairing-based) compute-proof receipts are classified at-risk', () => {
  const grothSurfaces = inv.surfaces.filter(s => /groth16/i.test(s.algorithm));
  assert(grothSurfaces.length > 0, 'expected at least one groth16 surface (compute-proof receipts)');
  for (const s of grothSurfaces) {
    assert(s.classification === 'at-risk', `${s.surface} is groth16-bn254 but classified "${s.classification}"`);
  }
});

test('§2.2 hypothesis trace produces a verdict', () => {
  assert(inv.hypothesis_2_2.traced === true, 'expected verify.html to be traceable');
  assert(typeof inv.hypothesis_2_2.verdict === 'string' && inv.hypothesis_2_2.verdict.length > 0, 'expected a non-empty verdict string');
});

test('ML-DSA surface exists and is classified pqc', () => {
  const mldsa = inv.surfaces.find(s => /ML-DSA/i.test(s.algorithm));
  assert(mldsa, 'expected an ML-DSA surface in the inventory');
  assert(mldsa.classification === 'pqc', `ML-DSA surface classified "${mldsa.classification}", expected "pqc"`);
});

test('no surface reports a coverage percentage or score field (§2.4)', () => {
  for (const s of inv.surfaces) {
    for (const key of Object.keys(s)) {
      assert(!/percent|score|coverage/i.test(key), `surface "${s.surface}" has a forbidden field "${key}" — §2.4 bans a coverage percentage or score`);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
