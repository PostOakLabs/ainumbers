#!/usr/bin/env node
/**
 * scripts/check-source-currency.test.mjs — SOURCE-CURRENCY-FEED-1's own pair
 * (GATE-SELFTEST-META-1: a gate must ship a paired fixture test proving it CAN go
 * red, not just that it currently reads green).
 *
 * Pure in-memory fixtures via the exported helpers — never touches the real
 * chaingraph/kernels/ tree or the network (the gate and this test are both
 * OFFLINE; only the workspace-root refresh instrument fetches). Section 9 does
 * read the real committed scripts/source-currency.json, which is in-repo, so it
 * is valid in a CI clone.
 *
 * Usage: node scripts/check-source-currency.test.mjs
 */
import {
  extractCfrCitations,
  normalizeCfrUnit,
  hasCfrMention,
  kernelSourcePins,
  kernelPin,
  isAmendedAfterPin,
  compareKernelToMap,
  gateExit,
  MAP_PATH,
} from './check-source-currency.mjs';
import { readFileSync, existsSync } from 'node:fs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`✗ ${msg}`); }
  else console.log(`✓ ${msg}`);
}
function unitOf(source) { return extractCfrCitations(source).map((c) => c.unit); }

// ── 1. Citation extraction — every measured estate shape ────────────────────
assert(JSON.stringify(unitOf("const CIT = '32 CFR 232.4(c)(1)(i)';")) === JSON.stringify(['32 CFR 232.4']),
  'spaced dotted citation with sub-clauses: "32 CFR 232.4(c)(1)(i)" -> section unit 32 CFR 232.4 (sub-clauses dropped)');
assert(unitOf("'12 CFR part 1026'").includes('12 CFR part 1026'), '"12 CFR part 1026" -> part unit');
assert(unitOf("'12 CFR Part 1002'")[0] === '12 CFR part 1002', '"12 CFR Part 1002" normalizes to lowercase "part"');
assert(unitOf("'15 CFR Parts 730'")[0] === '15 CFR part 730', '"15 CFR Parts 730" (plural keyword) -> part unit');
assert(unitOf("'12 CFR 1026 Appendix J'")[0] === '12 CFR part 1026', 'appendix citation "12 CFR 1026 Appendix J" normalizes to its part (coarsest unit eCFR versions)');
assert(unitOf("'15 CFR §744'")[0] === '15 CFR part 744', 'section-sign form "15 CFR §744" -> part unit');
assert(unitOf("'17 CFR 240.15c3-3'")[0] === '17 CFR 240.15c3-3', 'clause-dash section id preserved: "17 CFR 240.15c3-3"');
assert(unitOf("'FINCEN-CDD-RULE-31CFR1010.230-2024'")[0] === '31 CFR 1010.230', 'no-space pin with year suffix: 31CFR1010.230-2024 -> section 31 CFR 1010.230');
assert(unitOf("'MLA-DOD-32CFR232-2015-10-01'")[0] === '32 CFR part 232', 'no-space pin with full-date suffix: 32CFR232-2015-10-01 -> part 32 CFR part 232');
assert(unitOf("'EEOC-UGSP-29CFR1607-2024'")[0] === '29 CFR part 1607', 'no-space pin with year: 29CFR1607-2024 -> part 29 CFR part 1607');
assert(unitOf("'12CFR1003'")[0] === '12 CFR part 1003', 'bare no-space part: 12CFR1003 -> 12 CFR part 1003');
assert(unitOf("'31 CFR Chapter X OFAC/SDN screening'").length === 0, 'chapter-level "31 CFR Chapter X" yields NO unit (not addressable by the versioner)');
assert(unitOf("/\\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\\b/i").length === 0, 'Incoterm CFR (Cost and Freight, art-474 measured) is NOT a citation — no digits before it');
assert(normalizeCfrUnit('99', '123.4') === null, 'title 99 is out of the CFR 1..54 range -> rejected');
assert(normalizeCfrUnit('12', '1026.22').kind === 'section' && normalizeCfrUnit('12', '1026').kind === 'part', 'dotted token -> section kind, bare token -> part kind');
const dedupeSrc = "x = '32 CFR 232.4'; y = '32 CFR 232.4(c)'; z = '32 CFR 232.4(d)'";
assert(extractCfrCitations(dedupeSrc).length === 1, 'the same section cited three ways dedupes to one unit');
assert(extractCfrCitations("'12 CFR 1026.22' and '17 CFR 240.15c3-3'")[0].unit === '12 CFR 1026.22'
  && extractCfrCitations("'12 CFR 1026.22' and '17 CFR 240.15c3-3'")[1].unit === '17 CFR 240.15c3-3', 'multi-citation source returns units in sorted order');
assert(hasCfrMention("'31 CFR Chapter X'") === true, 'chapter-level mention still counts as a CFR mention (UNIT-LESS reporting, not silence)');
assert(hasCfrMention('plain source without any CFR') === false, 'CFR-free source has no mention');

// ── 2. Pin extraction — ASOF-GATE-1 vocabulary, literals only ────────────────
const pinSrc = [
  "table_version: 'MLA-DOD-32CFR232-2015-10-01'",
  "year_pin: 'EEOC-UGSP-2024'", // not a pin key — must be ignored
].join('\n');
const pins1 = kernelSourcePins(pinSrc.replace('year_pin', 'as_of'));
assert(pins1.full.includes('2015-10-01'), 'full date inside a table_version literal is a pin');
assert(pins1.years.includes('2024') && pins1.years.includes('2015'), 'bare years inside pin literals are year pins (2015 from the table_version, 2024 from the as_of value)');
const constSrc = "const TV = 'HOEPA-REGZ-2026-01-01';\nmeta = { table_version: TV }";
assert(kernelSourcePins(constSrc).full.includes('2026-01-01'), 'pin key referencing a same-file ALL_CAPS const resolves the const value');
const runtimeSrc = "record.as_of = input.as_of; if (x.as_of_date) warn(); const effective_date = row.effective_date";
assert(kernelSourcePins(runtimeSrc).full.length === 0 && kernelSourcePins(runtimeSrc).years.length === 0,
  'runtime property reads (record.as_of etc.) are NOT pins — RHS is not a quoted literal');

// ── 3. kernelPin — node digest dates and max semantics ───────────────────────
const nodeA = { cited_clause_digest: [{ digest: 'sha256:a', retrieved_at: '2026-08-14' }, { digest: 'sha256:b', retrieved_at: '2026-08-22' }] };
assert(kernelPin("table_version: 'X-2015-10-01'", nodeA).date === '2026-08-22'
  && kernelPin("table_version: 'X-2015-10-01'", nodeA).kind === 'clause-digest retrieved_at',
  'the LATEST clause-digest retrieved_at beats an older source pin (max semantics)');
assert(kernelPin("table_version: 'X-2026-09-01'", nodeA).date === '2026-09-01', 'a NEWER source pin beats older digest dates');
assert(kernelPin('no pins here', null) === null, 'a kernel with no pin anywhere yields null (NO-PIN, never flaggable)');
assert(kernelPin("table_version: 'X-2024'", null)?.coarse === true, 'a year-only pin is marked coarse');

// ── 4. Comparison semantics ──────────────────────────────────────────────────
assert(isAmendedAfterPin({ date: '2020-01-01', coarse: false }, '2026-01-01') === true, 'RED: last_amended after a full-date pin flags');
assert(isAmendedAfterPin({ date: '2026-08-22', coarse: false }, '2016-12-05') === false, 'GREEN: last_amended before the pin does not flag');
assert(isAmendedAfterPin({ date: '2024-01-01', coarse: false }, '2024-01-01') === false, 'same-day pin and amendment do not flag');
assert(isAmendedAfterPin({ date: '2024-01-01', coarse: true }, '2024-06-01') === false, 'year-pin same-year exemption: amendment INSIDE the pinned year is undecidable, not flagged');
assert(isAmendedAfterPin({ date: '2024-01-01', coarse: true }, '2026-07-21') === true, 'year-pin vs a LATER year amendment flags');
assert(isAmendedAfterPin(null, '2030-01-01') === false, 'no pin -> never flagged');

// ── 5. compareKernelToMap — RED/GREEN + UNMAPPED (pin-independent) ───────────
const MAP = { '32 CFR 232.4': { last_amended: '2016-12-05' }, '12 CFR part 1002': { last_amended: '2026-07-21' } };
const cites232 = extractCfrCitations("'32 CFR 232.4(c)(1)(i)'");
const redPin = { date: '2015-10-01', coarse: false, kind: 'source date pin (as_of/effective_date/table_version)' };
const redFindings = compareKernelToMap('art-x', cites232, redPin, MAP);
assert(redFindings.length === 1 && redFindings[0].kind === 'FLAGGED', 'RED: pin 2015-10-01 vs last_amended 2016-12-05 yields exactly one FLAGGED');
console.log(`  [quotable] RED  — ${redFindings[0]?.message}`);
assert(redFindings[0].pin === '2015-10-01' && redFindings[0].last_amended === '2016-12-05', 'FLAGGED carries kernel id, unit, BOTH dates and pin kind');
const greenFindings = compareKernelToMap('art-x', cites232, { date: '2026-08-22', coarse: false, kind: 'clause-digest retrieved_at' }, MAP);
assert(greenFindings.length === 0, 'GREEN: re-pinned kernel (2026-08-22) clears the flag — the JSON is the record, no baseline to burn down');
// MUTATION CONTROL: only the MAP DATE changes; a stale pin must not silently stay clean.
const flipMap = { '32 CFR 232.4': { last_amended: '2026-01-01' } };
assert(compareKernelToMap('art-x', cites232, redPin, flipMap).length === 1, 'MUTATION CONTROL: the same pin flags when the map date moves past it (comparator really compares)');
// UNMAPPED_SECTION for a NO-PIN kernel — map coverage is independent of pinning.
const unmappedFindings = compareKernelToMap('art-y', extractCfrCitations("'12 CFR 1026.46-48'"), null, MAP);
assert(unmappedFindings.length === 1 && unmappedFindings[0].kind === 'UNMAPPED_SECTION', 'UNMAPPED_SECTION fires even for a NO-PIN kernel (measured: the range-shaped 1026.46-48)');

// ── 6. Exit semantics — advisory by default / on PR, blocking only on ENFORCE ─
const F = [{ kind: 'FLAGGED' }];
assert(gateExit(F, { enforce: false, isPullRequest: false }) === 0, 'findings + no ENFORCE -> 0 (advisory until the initial set is triaged)');
assert(gateExit(F, { enforce: false, isPullRequest: true }) === 0, 'findings on pull_request -> 0 (advisory even if a main job flips ENFORCE)');
assert(gateExit(F, { enforce: true, isPullRequest: false }) === 1, 'findings + ENFORCE on main -> 1 (blocking, post-triage)');
assert(gateExit([], { enforce: true, isPullRequest: false }) === 0, 'no findings + ENFORCE -> 0');

// ── 7. Structural map check — the real committed JSON (offline, in-repo) ─────
assert(existsSync(MAP_PATH), 'scripts/source-currency.json is committed (MISSING_MAP would fail the gate outright)');
const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
assert(typeof map.generated_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(map.generated_at), 'map carries an ISO generated_at (the refresh timestamp, the only non-deterministic field)');
assert(!!map._provenance && typeof map._provenance.source === 'string', 'map carries _provenance naming the eCFR endpoint and instrument');
const keys = Object.keys(map.sections ?? {});
assert(keys.length >= 40, `map carries a full population (${keys.length} units; a truncated map would silently shrink coverage)`);
assert(JSON.stringify(keys) === JSON.stringify([...keys].sort()), 'section keys are sorted (deterministic ordering)');
const iso = /^\d{4}-\d{2}-\d{2}$/;
let shapeOK = true;
for (const [k, v] of Object.entries(map.sections)) {
  if (!iso.test(v.last_amended ?? '') || !iso.test(v.latest_issue_date ?? '') || !Array.isArray(v.kernels) || v.kernels.length === 0
    || !v.kernels.every((id) => /^art-[\w-]+$/.test(id)) || JSON.stringify(v.kernels) !== JSON.stringify([...v.kernels].sort())) { shapeOK = false; console.log(`  bad entry: ${k} -> ${JSON.stringify(v)}`); break; }
}
assert(shapeOK, 'every map entry has ISO last_amended + latest_issue_date and a non-empty, sorted kernels list of art-* ids');
assert(keys.every((k) => /^\d{1,2} CFR (part )?[\w.-]+$/.test(k)), 'every section key matches the "<title> CFR <unit>" canonical shape');

// ── 8. Coverage agreement — map units vs the live tree (mutation canary) ─────
// A unit the gate can extract from the current tree but the map lacks must be
// visible as UNMAPPED_SECTION at gate time; here we assert the COMMITTED map at
// least covers the estate's biggest stable pins so a bad regeneration is caught
// by the fixture proof, not only by the advisory gate line.
for (const mustHave of ['32 CFR 232.4', '12 CFR part 1026', '17 CFR 240.15c3-3']) {
  assert(!!map.sections[mustHave], `map covers ${mustHave} (stable, long-lived estate pin)`);
}

if (failures) {
  console.error(`\ncheck-source-currency.test.mjs: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\ncheck-source-currency.test.mjs: all assertions passed.');
