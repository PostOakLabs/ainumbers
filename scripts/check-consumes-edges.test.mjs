#!/usr/bin/env node
/**
 * scripts/check-consumes-edges.test.mjs — GATE-SELFTEST-META-1 pair for
 * scripts/check-consumes-edges.mjs (CONSUMES-EDGE-CHECK-1).
 *
 * Proves the consumes-edge checker can go RED, not just that today's estate
 * happens to read as declared (SO #34c: a gate only ever observed green has not
 * been observed at all):
 *   · scanner — payload + header `consumes:` declarations extracted, deduped,
 *     non-declaring sources scanned clean;
 *   · classifier — BYTE-EQUAL / SUBSET-BY-YEAR / MISMATCH / the vacuous
 *     UNVERIFIED-NO-OVERLAP class (absence of comparable entries is never a pass);
 *   · MUTATION ADEQUACY (the row's house rule) — ONE perturbed pinned value in
 *     the committed scratch fixture (2026 floor 1380 → 1379) fires MISMATCH and
 *     names year+field, while the real art-234 kernel's 2026 entries measure
 *     equal — so the firing is attributable to the mutation alone;
 *   · declared expectations — a SURPRISE is raised in BOTH directions
 *     (observed MISMATCH declared HOLDS, and observed equal declared MISMATCH),
 *     so the art-234 declaration cannot silently go stale when
 *     CCPP-FIX-ART234-1 lands.
 *
 * Wired into scripts/preflight.mjs as a GATES entry (blocking); the checker
 * itself is the advisory report-only half of the pair.
 */
import { scanSource, classify, VERDICT, probeArt234, supplierArt234 } from './check-consumes-edges.mjs';

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   ${label}`);
  else { console.error(`  FAIL ${label}`); failures++; }
}

// ── Scanner ──────────────────────────────────────────────────────────────────
const payloadAndHeader = [
  "    consumes: 'art-220 (lookup_reg_z_thresholds) supplies the HOEPA threshold table (table: hoepa). This node pins the same values for local deterministic compute.',",
  '// CONSUMES: art-220 (lookup_reg_z_thresholds) for threshold table --',
  '//   declare consume; do not duplicate thresholds independently.',
].join('\n');
const e1 = scanSource('art-234-test-hoepa-high-cost', payloadAndHeader);
check('scanner: payload + header art-220 declarations dedupe to ONE edge', e1.length === 1 && e1[0].supplierArt === 220);
check('scanner: payload declaration recorded with its where', e1[0].where === 'payload' && e1[0].consumer === 'art-234-test-hoepa-high-cost');
const none = scanSource('art-x', "consumes: 'no supplier kernel named here', // just prose about what this node consumes");
check('scanner: prose without an art-NNN reference yields no edge', none.length === 0);

// ── Classifier equivalence classes ───────────────────────────────────────────
const full = classify(
  { 2025: { a: 1 }, 2026: { a: 2 } },
  { 2025: { a: 1 }, 2026: { a: 2 } },
);
check('classifier: full coverage all equal → BYTE-EQUAL', full.verdict === VERDICT.BYTE_EQUAL);
const subset = classify({ 2026: { a: 2 } }, { 2025: { a: 1 }, 2026: { a: 2 } });
check('classifier: fewer consumer years, overlaps equal → SUBSET-BY-YEAR', subset.verdict === VERDICT.SUBSET_BY_YEAR);
const mism = classify({ 2026: { a: 3 } }, { 2026: { a: 2 } });
check('classifier: one differing overlapping entry → MISMATCH (diffs=1)', mism.verdict === VERDICT.MISMATCH && mism.diffs === 1);
const vacuous = classify({ 2026: { unmeasured: 1 } }, { 2026: { a: 2 } });
check('classifier: zero comparable entries → UNVERIFIED-NO-OVERLAP, never clean', vacuous.verdict === 'UNVERIFIED-NO-OVERLAP');
const unanswered = classify({ 2026: { a: 2 } }, { 2025: { a: 1 }, 2026: { a: 2 } });
check('classifier: supplier year the consumer cannot answer is a non-overlap (SUBSET, not MISMATCH)',
  unanswered.verdict === VERDICT.SUBSET_BY_YEAR);

// ── MUTATION ADEQUACY (SO #34c RED control, committed fixture) ───────────────
const { probe: perturbed, meta } = await import('./consumes-edge-fixtures/art-234-hoepa-floor-perturbed.fixture.mjs');
const art220 = (await import('../chaingraph/kernels/art-220-reg-z-threshold-lookup.kernel.mjs')).compute;
const art234 = (await import('../chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs')).compute;
const supplier = supplierArt234(art220);

const real = classify(probeArt234(art234, art220), supplier);
const real2026 = real.entries.find((e) => e.year === 2026);
check('GREEN control: real art-234, year 2026 entries measure equal to art-220',
  real2026 && !real2026.differs);
check('GREEN control: real art-234 edge is MISMATCH only via the declared 2021-2024 fallback years',
  real.verdict === VERDICT.MISMATCH && real.entries.every((e) => !e.differs || (e.year >= 2021 && e.year <= 2024)));

const pert = classify(perturbed, supplier);
const p2026 = pert.entries.find((e) => e.year === 2026);
const floor = p2026 && p2026.fields.points_fees_floor;
check(`RED control: perturbed fixture (${meta.perturbation}) fires MISMATCH`, pert.verdict === VERDICT.MISMATCH);
check('RED control: fired entry names year 2026, points_fees_floor, consumer 1379 vs supplier 1380',
  floor && floor.equal === false && floor.consumer === 1379 && floor.supplier === 1380);
check('RED control: exactly ONE NEW firing field vs the unperturbed run — the mutation alone caused it',
  pert.diffs === real.diffs + 1);
check('RED control: 2026 points_fees_floor fires ONLY in the perturbed run',
  !(real2026 && real2026.differs) && floor && floor.equal === false);
check('RED control: fixture 2025 entries still equal (untouched pin stays clean)',
  pert.entries.find((e) => e.year === 2025) && !pert.entries.find((e) => e.year === 2025).differs);

// ── Declared-expectation surprise logic (both directions) ────────────────────
function declaredOk(verdict, declared) {
  const holding = verdict === VERDICT.BYTE_EQUAL || verdict === VERDICT.SUBSET_BY_YEAR;
  return !declared || declared === 'HOLDS' ? holding : verdict === declared;
}
check('expectations: observed MISMATCH declared MISMATCH → no surprise (art-234 today)',
  !declaredOk(VERDICT.MISMATCH, 'MISMATCH') === false);
check('expectations: observed MISMATCH declared HOLDS → SURPRISE',
  !declaredOk(VERDICT.MISMATCH, 'HOLDS'));
check('expectations: observed BYTE-EQUAL declared MISMATCH → SURPRISE (the fix-landed flip)',
  !declaredOk(VERDICT.BYTE_EQUAL, 'MISMATCH'));
check('expectations: observed SUBSET-BY-YEAR declared HOLDS → no surprise',
  declaredOk(VERDICT.SUBSET_BY_YEAR, 'HOLDS'));

if (failures) {
  console.error(`\n${failures} control(s) FAILED`);
  process.exit(1);
}
console.log('\nall consumes-edge controls green');
