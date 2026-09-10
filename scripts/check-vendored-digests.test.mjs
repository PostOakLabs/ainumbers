#!/usr/bin/env node
// check-vendored-digests.test.mjs — fixture proof for VENDOR-DIGEST-GATE-1 (SO #34c pairing).
//
// A digest gate that has only ever been observed green has not been observed at all. This drives
// the REAL gate code (parseRecorded / requiredArtifacts / verifyTable / sha256Hex imported from
// check-vendored-digests.mjs — never a stand-in) against the REAL committed table and the REAL
// vendored bytes, with exactly one byte perturbed, and asserts the gate goes RED naming the file.
// The RED lines below are the row's quoted RED control (1-byte perturbation fixture).
//
// Proves, in order:
//   GREEN calibration — the real table pins the real bytes (all four artifacts MATCH);
//   RED control       — a 1-byte in-place perturbation of a REAL bundle is DRIFT, naming the file;
//   absence ≠ pass    — a required artifact with no table row is NO_ROW (never green);
//   phantom row       — a table row pointing at a missing file is NO_FILE;
//   no table at all   — a missing VENDORED.md is NO_TABLE for every artifact;
//   scope enumeration — requiredArtifacts() discovers _noble-*.bundle.mjs and excludes non-crypto
//                        bundles (a new noble bundle without a row cannot slide in ungated).

import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRecorded, requiredArtifacts, verifyTable, sha256Hex } from './check-vendored-digests.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE_REL = 'chaingraph/kernels/VENDORED.md';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const tableMd = readFileSync(join(REPO, TABLE_REL), 'utf8');
const REQUIRED = requiredArtifacts();
const realBytes = {}; // path -> Buffer, read ONCE from the real tree
const readBytes = (p) => {
  if (!(p in realBytes)) realBytes[p] = readFileSync(join(REPO, p));
  return realBytes[p];
};
const run = (over = {}) => verifyTable({ tableMd, tableMissing: false, required: REQUIRED, readBytes, ...over });

await test('GREEN calibration: the committed table pins the committed bytes — every artifact MATCHes', async () => {
  const findings = run();
  assert(findings.length === REQUIRED.length, `expected ${REQUIRED.length} findings, got ${findings.length}`);
  for (const f of findings) assert(f.state === 'MATCH', `${f.path}: expected MATCH, got ${f.state} (${f.detail})`);
  assert(REQUIRED.length >= 4, `expected the 4 vendored crypto artifacts in scope, got ${REQUIRED.length}`);
});

await test('RED control: a 1-byte perturbation of the REAL bn254 bundle is DRIFT, naming the file', async () => {
  const target = 'chaingraph/kernels/_noble-bn254.bundle.mjs';
  const original = Buffer.from(readBytes(target)); // untouched copy
  const tampered = Buffer.from(readBytes(target)); // same length, exactly one byte changed
  const i = Math.floor(tampered.length / 2);
  tampered[i] ^= 0x01;
  assert(tampered.length === original.length && tampered[i] !== original[i], 'fixture must differ from the real bytes in exactly one byte');
  assert(Buffer.compare(tampered, original) !== 0, 'perturbed buffer must not equal the original');
  const findings = verifyTable({
    tableMd, required: REQUIRED,
    readBytes: (p) => (p === target ? tampered : readBytes(p)),
  });
  const hit = findings.find((f) => f.path === target);
  assert(hit && hit.state === 'DRIFT', `${target}: expected DRIFT, got ${hit ? hit.state : 'no finding'}`);
  assert(hit.detail.includes('DRIFT') && hit.detail.includes('on-disk') && hit.detail.includes('pinned'), `DRIFT detail must name the mismatch: ${hit.detail}`);
  const others = findings.filter((f) => f.path !== target);
  for (const f of others) assert(f.state === 'MATCH', `${f.path} must stay MATCH when an unrelated file is perturbed`);
});

await test('RED control (second artifact): a 1-byte perturbation of the inlined-noble _proof.mjs is DRIFT', async () => {
  const target = 'chaingraph/kernels/_proof.mjs';
  const tampered = Buffer.from(readBytes(target));
  tampered[Math.floor(tampered.length / 2)] ^= 0x01;
  const findings = verifyTable({
    tableMd, required: REQUIRED,
    readBytes: (p) => (p === target ? tampered : readBytes(p)),
  });
  const hit = findings.find((f) => f.path === target);
  assert(hit && hit.state === 'DRIFT', `${target}: expected DRIFT, got ${hit ? hit.state : 'no finding'}`);
});

await test('absence is not a pass: a required artifact with NO table row is NO_ROW, never green', async () => {
  const stripped = tableMd.replace(/^\| `chaingraph\/kernels\/_noble-ed25519\.bundle\.mjs`.*$/m, '| `chaingraph/kernels/REDACTED-FOR-FIXTURE.mjs` | (fixture: row removed) | | | | `0000000000000000000000000000000000000000000000000000000000000000` |');
  const findings = verifyTable({ tableMd: stripped, required: REQUIRED, readBytes });
  const miss = findings.find((f) => f.path === 'chaingraph/kernels/_noble-ed25519.bundle.mjs');
  assert(miss && miss.state === 'NO_ROW', `expected NO_ROW for the de-rowed bundle, got ${miss ? miss.state : 'no finding'}`);
});

await test('phantom row: a table row pointing at a missing file is NO_FILE (table must not describe nothing)', async () => {
  const phantom = tableMd + '\n| `chaingraph/kernels/_noble-phantom-fixture.bundle.mjs` | fixture phantom | x | MIT | 2026-09-03 | `1111111111111111111111111111111111111111111111111111111111111111` |\n';
  const findings = verifyTable({ tableMd: phantom, required: REQUIRED, readBytes });
  const hit = findings.find((f) => f.path === 'chaingraph/kernels/_noble-phantom-fixture.bundle.mjs');
  assert(hit && hit.state === 'NO_FILE', `expected NO_FILE for the phantom row, got ${hit ? hit.state : 'no finding'}`);
});

await test('no table at all: a missing VENDORED.md is NO_TABLE for every required artifact (never a pass)', async () => {
  const findings = verifyTable({ tableMd: '', tableMissing: true, required: REQUIRED, readBytes: () => Buffer.alloc(0) });
  assert(findings.length === REQUIRED.length, 'every artifact must carry a finding');
  for (const f of findings) assert(f.state === 'NO_TABLE', `expected NO_TABLE, got ${f.state}`);
});

await test('scope enumeration: requiredArtifacts() finds every _noble-*.bundle.mjs, plus _proof.mjs, and EXCLUDES non-crypto bundles', async () => {
  const fixtureDir = [
    '_noble-bn254.bundle.mjs', '_noble-ed25519.bundle.mjs', '_noble-secp256k1.bundle.mjs',
    '_amort.bundle.mjs', '_detmath.bundle.mjs', '_dtree.bundle.mjs', '_ruleversion.bundle.mjs',
    'some.kernel.mjs', '_hash.mjs',
  ];
  const got = requiredArtifacts(() => fixtureDir);
  assert(got.includes('chaingraph/kernels/_proof.mjs'), 'the fixed _proof.mjs member must always be in scope');
  for (const n of ['bn254', 'ed25519', 'secp256k1']) {
    assert(got.includes(`chaingraph/kernels/_noble-${n}.bundle.mjs`), `${n} bundle must be discovered`);
  }
  for (const nonCrypto of ['_amort', '_detmath', '_dtree', '_ruleversion']) {
    assert(!got.some((p) => p.includes(nonCrypto)), `${nonCrypto} is not crypto and must stay out of scope`);
  }
});

await test('comparator liveness: sha256Hex differs on a 1-byte perturbation of every real artifact in scope', async () => {
  for (const p of REQUIRED) {
    const b = readBytes(p);
    const t = Buffer.from(b);
    t[Math.floor(t.length / 2)] ^= 0x01;
    assert(sha256Hex(b) !== sha256Hex(t), `${p}: 1-byte perturbation must change the sha256`);
  }
});

await test('parser: parseRecorded extracts exactly the pinned rows from the real table (no backtick ambiguity)', async () => {
  const map = parseRecorded(tableMd);
  for (const p of REQUIRED) {
    assert(map.has(p), `${p} must parse to a row`);
    assert(/^[0-9a-f]{64}$/.test(map.get(p)), `${p} pin must be 64-hex`);
  }
  // The elided-integrity cells in Upstream columns (sha512-…, NOT 64-hex sha256) must never be
  // mistaken for the digest column: every parsed value is 64-hex by the regex, and the count
  // equals the artifact count — nothing extra was swallowed.
  assert(map.size === REQUIRED.length, `expected ${REQUIRED.length} parsed rows, got ${map.size}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
