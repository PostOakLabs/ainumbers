#!/usr/bin/env node
/**
 * gen-rule-registry.test.mjs — tests for the rule-registry generator, INCLUDING THE MUTATION
 * CONTROL that STANDING-ORDERS.md #34 and ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.2.2 both require.
 *
 * ⛔ THE LOAD-BEARING TEST IS T4. It flips ONE byte in a pinned snapshot and asserts the generator
 * REJECTS that entry. If T4 ever passes the entry through, the gate IS the vulnerability, not a
 * safeguard — verifying a checker by reading it is the same self-consistent-checker shape one
 * level up (SO #34, "VERIFY A CHECKER BY MUTATION, NOT BY READING IT").
 *
 * Fully self-contained: builds its own in-memory entry documents and its own snapshot bytes, so it
 * runs identically on a developer machine and in a CI checkout that has no
 * workspace-root research/clause-snapshots/ directory. It never reads the real registry.
 *
 * Run: node scripts/gen-rule-registry.test.mjs
 */
import { createHash } from 'node:crypto';
import {
  validateEntryFile, collectSourceClaims, verifySourceClaims, assembleTable,
  checkSliceConstructibility, canon, sha256HexOf, MAX_SLICE_ENTRIES, SCHEMA_VERSION,
} from './gen-rule-registry.mjs';

let pass = 0, fail = 0;
const results = [];
function t(name, fn) {
  try { fn(); pass++; results.push(`  ok   ${name}`); }
  catch (e) { fail++; results.push(`  FAIL ${name}\n         ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── a synthetic snapshot + a synthetic entry file that cites it ──────────────────────────────────
const SNAP_TEXT =
  'SYNTHETIC TEST SNAPSHOT — not a real regulatory excerpt.\n'
  + 'Effective for fiscal years beginning after December 15, 2023.\n';
const SNAP_LOC = 'research/clause-snapshots/SYNTHETIC-TEST.excerpt.txt';
const SNAP_BYTES = Buffer.from(SNAP_TEXT, 'utf8');
const REAL_DIGEST = 'sha256:' + createHash('sha256').update(SNAP_BYTES).digest('hex');

const cite = (digest = REAL_DIGEST) => ({
  clause: 'Synthetic Sec.1',
  source: 'synthetic test source, not a real standard',
  source_digest: digest,
  snapshot_location: SNAP_LOC,
});

function makeDoc(overrides = {}) {
  return JSON.parse(JSON.stringify({
    schema_version: SCHEMA_VERSION,
    standard_id: 'TEST-2023-01',
    written_by: 'gen-rule-registry.test.mjs',
    entries: [
      {
        standard_id: 'TEST-2023-01',
        applies_to_filer_statuses: ['large_accelerated', 'accelerated'],
        effective_for_annual_periods_beginning: '2023-12-16',
        effective_for_interim_periods_beginning: null,
        early_adoption_permitted: true,
        transition_method: 'retrospective',
        parameter_set: {
          threshold_percent: [
            { value: 5, effective_from: '2023-12-16', effective_to: '2025-01-01', source: 'synthetic', source_digest: REAL_DIGEST, snapshot_location: SNAP_LOC },
            { value: 10, effective_from: '2025-01-01', effective_to: null, source: 'synthetic', source_digest: REAL_DIGEST, snapshot_location: SNAP_LOC },
          ],
        },
        citation: cite(),
      },
    ],
    ...overrides,
  }));
}

const FILE = 'chaingraph/kernels/data/rule-registry/TEST-2023-01.entry.json';
const registryDigests = new Set([REAL_DIGEST]);
const readSnapshotOk = (loc) => (loc === SNAP_LOC ? SNAP_BYTES : null);

// ── T1: the happy path really is happy (so a later rejection means something) ────────────────────
t('T1 valid entry file passes structural validation', () => {
  assert(validateEntryFile(FILE, makeDoc()).length === 0, 'expected no structural errors');
});

t('T1b valid entry file passes digest verification, recomputed from bytes', () => {
  const { errors, verifications } = verifySourceClaims(collectSourceClaims(makeDoc()), { readSnapshot: readSnapshotOk, registryDigests });
  assert(errors.length === 0, 'expected no digest errors, got: ' + errors.join(' | '));
  assert(verifications.length === 1, 'expected one deduplicated verification');
  assert(verifications[0].mode === 'RECOMPUTED-FROM-BYTES', 'expected the byte-recomputation mode');
  assert(verifications[0].digest === REAL_DIGEST, 'the RECOMPUTED digest must be what lands in the table');
});

// ── T2: an entry with NO digest is REJECTED, not warned about (build spec Sec.2.2) ───────────────
t('T2 a parameter version with no source_digest is REJECTED', () => {
  const doc = makeDoc();
  delete doc.entries[0].parameter_set.threshold_percent[0].source_digest;
  const errs = validateEntryFile(FILE, doc);
  assert(errs.some((e) => /source_digest is missing/.test(e)), 'expected a named rejection, got: ' + errs.join(' | '));
});

t('T2b a citation with no source_digest is REJECTED', () => {
  const doc = makeDoc();
  delete doc.entries[0].citation.source_digest;
  const errs = validateEntryFile(FILE, doc);
  assert(errs.some((e) => /citation must carry/.test(e)), 'expected a named citation rejection');
});

// ── T3: a digest that resolves to nothing in the clause-snapshot registry is REJECTED ────────────
t('T3 an unregistered digest is REJECTED even when the bytes would hash to it', () => {
  const doc = makeDoc();
  const { errors } = verifySourceClaims(collectSourceClaims(doc), { readSnapshot: readSnapshotOk, registryDigests: new Set() });
  assert(errors.length > 0, 'an unregistered digest must fail');
  assert(errors.every((e) => /does not resolve to any entry/.test(e)), 'expected the registry-resolution rejection');
});

t('T3b an arbitrary string digest is REJECTED', () => {
  const doc = makeDoc();
  doc.entries[0].citation.source_digest = 'sha256:' + '0'.repeat(64);
  const { errors } = verifySourceClaims(collectSourceClaims(doc), { readSnapshot: readSnapshotOk, registryDigests });
  assert(errors.length > 0, 'a digest satisfied by an arbitrary string must fail');
});

// ══ T4: THE MUTATION CONTROL. FLIP ONE BYTE. THE GENERATOR MUST REJECT. ═════════════════════════
// ⛔ If this test ever observes a PASS after the flip, the gate is the vulnerability and this
//    assertion is the only thing standing between the estate and a silently-agreed-with claim.
t('T4 MUTATION CONTROL — one flipped byte in the snapshot REJECTS the entry', () => {
  const doc = makeDoc();

  // Sanity: unmutated bytes verify.
  const before = verifySourceClaims(collectSourceClaims(doc), { readSnapshot: readSnapshotOk, registryDigests });
  assert(before.errors.length === 0, 'precondition failed: the unmutated snapshot must verify, else T4 proves nothing');

  // Flip exactly one byte, at a fixed offset, changing nothing else.
  const mutated = Buffer.from(SNAP_BYTES);
  mutated[10] = mutated[10] ^ 0x01;
  assert(mutated.length === SNAP_BYTES.length, 'the mutation must change bytes, not length');
  assert(Buffer.compare(mutated, SNAP_BYTES) !== 0, 'the mutation must actually change the bytes');

  const readMutated = (loc) => (loc === SNAP_LOC ? mutated : null);
  const after = verifySourceClaims(collectSourceClaims(doc), { readSnapshot: readMutated, registryDigests });

  assert(
    after.errors.length > 0,
    'MUTATION CONTROL PASSED THE MUTATED SNAPSHOT. The generator agreed with a claim it should have '
    + 'refuted, which means the digest check reads the claimed value instead of recomputing it. '
    + 'THE GATE IS THE VULNERABILITY — do not ship.'
  );
  assert(after.errors.every((e) => /DIGEST MISMATCH/.test(e)), 'expected the byte-recomputation mismatch rejection specifically, got: ' + after.errors.join(' | '));
  assert(after.verifications.length === 0, 'a rejected source must not appear as a verified one');
});

t('T4b the mutation control is not satisfied by registry resolution alone', () => {
  // The mutated bytes still carry a digest that IS registered (the entry's claim is unchanged), so
  // leg 2 passes. Only leg 1 — byte recomputation — can catch this. Proving that here means a
  // future refactor cannot quietly delete leg 1 and still look green.
  const doc = makeDoc();
  const mutated = Buffer.from(SNAP_BYTES);
  mutated[10] = mutated[10] ^ 0x01;
  const { errors } = verifySourceClaims(collectSourceClaims(doc), { readSnapshot: () => mutated, registryDigests });
  assert(errors.length > 0 && /recomputed/.test(errors[0]), 'leg 1 must be the leg that fires');
});

// ── T5: SNAPSHOT-UNREACHABLE is a DISTINCT state, never a silent pass (SO #34c) ──────────────────
t('T5 unreachable snapshot bytes are reported as SNAPSHOT-UNREACHABLE, not as verified', () => {
  const { errors, verifications } = verifySourceClaims(collectSourceClaims(makeDoc()), { readSnapshot: () => null, registryDigests });
  assert(errors.length === 0, 'unreachable bytes are not themselves an error when the digest is registered');
  assert(verifications.every((v) => v.mode === 'SNAPSHOT-UNREACHABLE'), 'expected the distinct unreachable mode');
  assert(!verifications.some((v) => v.mode === 'RECOMPUTED-FROM-BYTES'), 'unreachable must never be recorded as recomputed');
});

// ── T6: non-overlap is asserted host-side too ────────────────────────────────────────────────────
t('T6 overlapping parameter windows are REJECTED', () => {
  const doc = makeDoc();
  doc.entries[0].parameter_set.threshold_percent[1].effective_from = '2024-06-01';
  const errs = validateEntryFile(FILE, doc);
  assert(errs.some((e) => /OVERLAPPING/.test(e)), 'expected the non-overlap rejection, got: ' + errs.join(' | '));
});

t('T6b abutting windows [a,b) [b,c) are NOT treated as overlapping', () => {
  assert(validateEntryFile(FILE, makeDoc()).length === 0, 'half-open windows that abut must be legal');
});

// ── T7: duplicate (standard_id, filer_status) coverage is REJECTED — total resolution needs it ──
t('T7 two entries covering the same (standard_id, filer_status) are REJECTED', () => {
  const doc = makeDoc();
  doc.entries.push(JSON.parse(JSON.stringify(doc.entries[0])));
  const errs = validateEntryFile(FILE, doc);
  assert(errs.some((e) => /EXACTLY ONE entry/.test(e)), 'expected the duplicate-coverage rejection');
});

// ── T8: filename is the disjointness key ────────────────────────────────────────────────────────
t('T8 a filename that disagrees with standard_id is REJECTED', () => {
  const errs = validateEntryFile('chaingraph/kernels/data/rule-registry/WRONG.entry.json', makeDoc());
  assert(errs.some((e) => /filename must be/.test(e)), 'expected the filename/standard_id mismatch rejection');
});

// ── T9: a filer status outside the closed enum is REJECTED ──────────────────────────────────────
t('T9 a filer_status outside the closed enum is REJECTED', () => {
  const doc = makeDoc();
  doc.entries[0].applies_to_filer_statuses = ['some_new_category'];
  const errs = validateEntryFile(FILE, doc);
  assert(errs.some((e) => /outside the closed enum/.test(e)), 'expected the closed-enum rejection');
});

// ── T10: assembly is deterministic and order-independent ────────────────────────────────────────
t('T10 assembleTable is deterministic and independent of input file order', () => {
  const a = makeDoc();
  const b = makeDoc({ standard_id: 'TEST-2023-02' });
  b.entries[0].standard_id = 'TEST-2023-02';
  const v = [{ snapshot_location: SNAP_LOC, digest: REAL_DIGEST, mode: 'RECOMPUTED-FROM-BYTES', excerpt_bytes: SNAP_BYTES.length }];
  const one = assembleTable([a, b], v);
  const two = assembleTable([b, a], v);
  assert(JSON.stringify(one) === JSON.stringify(two), 'assembly must not depend on input order');
  assert(one.table_digest === sha256HexOf(Buffer.from(JSON.stringify(canon({ entries: one.entries, standards: one.standards, schema_version: SCHEMA_VERSION })), 'utf8')), 'table_digest must be derived from the assembled body');
});

// ── T11: slice constructibility bound ───────────────────────────────────────────────────────────
t('T11 a standard expanding past max_slice_entries is REJECTED', () => {
  const entries = [];
  for (let i = 0; i < MAX_SLICE_ENTRIES + 1; i++) entries.push({ standard_id: 'TEST-BIG', applies_to_filer_statuses: ['private'] });
  const errs = checkSliceConstructibility({ entries });
  assert(errs.length === 1 && /max_slice_entries/.test(errs[0]), 'expected the slice-bound rejection');
});

console.log('gen-rule-registry.test.mjs — generator + MUTATION CONTROL (STANDING-ORDERS.md #34)');
results.forEach((r) => console.log(r));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
