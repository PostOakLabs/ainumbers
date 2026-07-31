#!/usr/bin/env node
// scripts/check-kernel-asof-staleness.test.mjs -- fixture proof for ASOF-GATE-1.
//
// Asserts, on in-memory fixtures (never live kernel source): the gate finds a literal
// table_version/effective_date pin but ignores a runtime record field of the same name; it
// resolves an ALL_CAPS const reference; it classifies a citation-shaped value (CFR/USC/
// mortgagee-letter/EU-regulation) as undecidable rather than comparing its year to the clock;
// and it correctly buckets past/current/expiring by comparing an authored date against an
// injected "now" (so the test never goes stale as real time passes).
//
// Usage: node scripts/check-kernel-asof-staleness.test.mjs
// Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.

import { findCandidates, classifyCandidate } from './check-kernel-asof-staleness.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.log(`✗ ${msg}`);
  } else {
    console.log(`✓ ${msg}`);
  }
}

// -- findCandidates: literal pin vs runtime record field ------------------------------------
const kernelSource = `
export const TABLE_VERSION = 'ISO20022-PURPOSE-CODE-V1';
export function compute(pp) {
  const as_of = num(pp.as_of) ?? 0; // caller-supplied runtime point, not a pin
  const record = pp.record;
  return {
    table_version: TABLE_VERSION,
    effective_date: record.effective_date, // runtime field on the validated record -- not a literal
    note: 'Thresholds are version-pinned.',
  };
}
`;
const found = findCandidates(kernelSource);
assert(
  found.some((c) => c.key === 'table_version' && c.value === 'ISO20022-PURPOSE-CODE-V1'),
  'resolves table_version: TABLE_VERSION via the same-file ALL_CAPS const declaration'
);
assert(
  !found.some((c) => c.key === 'effective_date'),
  'a runtime property access (record.effective_date) is NOT captured as a candidate -- only a literal string RHS counts'
);
assert(found.length === 1, 'exactly one candidate found (the resolved table_version); the as_of runtime param and the free-text "version-pinned" comment are not candidates');

// -- findCandidates: direct literal string -------------------------------------------------
const directLiteral = findCandidates(`x = { effective_date: '2025-01-01' };`);
assert(directLiteral.length === 1 && directLiteral[0].value === '2025-01-01', 'a direct literal string assigned to effective_date is captured');

// -- classifyCandidate: citation-shaped values are undecidable, never compared to the clock --
const now2026 = new Date('2026-07-31T00:00:00Z');
assert(classifyCandidate('SCRA-50USC3937-2024', now2026).class === 'undecidable', 'USC citation (SCRA-50USC3937-2024) classified undecidable, not past -- the 2024 is when the statute was enacted, not a data-currency stamp');
assert(classifyCandidate('MLA-DOD-32CFR232-2016-10-03', now2026).class === 'undecidable', 'CFR citation with an embedded full date is still undecidable -- CFR marker wins over date extraction');
assert(classifyCandidate('EU-AIA-ART12-2024-1689-R1', now2026).class === 'undecidable', 'EU regulation citation (2024/1689) classified undecidable');
assert(classifyCandidate('NAIC-AIS-BULLETIN-2023-R1', now2026).class === 'undecidable', 'bulletin citation classified undecidable');

// -- classifyCandidate: genuine calendar pins compared against an injected clock ------------
assert(classifyCandidate('FNM-LLPA-2025-11-01', now2026).class === 'past', 'a bare dated pin (no citation marker) from a fully-elapsed calendar year is "past"');
assert(classifyCandidate('FHFA-CLL-2026', now2026).class === 'current', 'a bare year-only pin matching the current year is "current"');
assert(classifyCandidate('FHFA-CLL-2027', now2026).class === 'current', 'a bare year-only pin for a future year is "current" (not yet due)');
const nowOctober = new Date('2026-11-15T00:00:00Z');
assert(classifyCandidate('FHFA-CLL-2026', nowOctober).class === 'expiring', 'a current-year pin evaluated in the final quarter (Nov) is "expiring", signalling the next annual update is likely due soon');
assert(classifyCandidate('SWIFT-GPI-STATUS-LIFECYCLE-V1', now2026).class === 'undecidable', 'a version tag with no date or year at all is undecidable, not guessed as current');

if (failures > 0) {
  console.log(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\nall fixture assertions passed');
