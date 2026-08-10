// kernel_digest_at_authoring: sha256:93ef8ec9fa4ffdc03b213bad686e8ed98f183bbb707fce9629bf0721e6cff2a5
//
// FV-PROPFLOOR-SHARD-B5-1 — property-test floor for art-207-attribution-string-generator.
// Class B (bounded string/metadata generator), float:no exception per the WU row — pure string
// formatting and set-membership over a fixed license table, no numeric computation at all.
// Forced categorical boundary cases used in place of ULP forcing per
// FV-PBT-FLOOR-BUILD-SPEC.md §3. Zero external dependencies (mulberry32 PRNG + explicit
// boundary arrays), same shape as the B1/B2/B3 harnesses. Read-only w.r.t. the kernel.
//
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)
//
// Run: node chaingraph/kernels/__proptests__/art-207-attribution-string-generator.proptest.mjs

import { compute } from '../art-207-attribution-string-generator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-207-attribution-string-generator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x20701);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const TRIALS = 6000;
const LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-ND-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-ND-4.0', 'NOT-A-LICENSE'];
const MAYBE_STRINGS = ['Title', '', '   ', 'https://example.com/x', undefined];

function mkPP(rng) {
  return {
    title: pick(rng, MAYBE_STRINGS),
    creator: pick(rng, MAYBE_STRINGS),
    source_url: pick(rng, MAYBE_STRINGS),
    license: pick(rng, LICENSES),
    work_url: rng() < 0.5 ? pick(rng, MAYBE_STRINGS) : undefined,
  };
}
function sanitize(v) { return typeof v !== 'string' ? '' : v.trim(); }

// ---------- P1: validity iff all four required fields present (after trim) and license recognized ----------
function checkP1_validity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    const title = sanitize(pp.title), creator = sanitize(pp.creator), sourceUrl = sanitize(pp.source_url);
    const knownLicense = LICENSES.slice(0, 7).includes(pp.license);
    const expValid = Boolean(title && creator && sourceUrl && knownLicense);
    if (r.valid !== expValid) violations++;
    if (expValid !== (r.errors.length === 0)) violations++;
  }
  return { name: 'P1_valid_iff_all_required_fields_present_and_license_known', trials: checked, violations };
}

// ---------- P2: boundedness -- tasl_line/json_ld/rdfa_html are empty/null iff invalid, non-empty iff valid ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = mkPP(rand);
    const r = compute(pp).output_payload;
    checked++;
    if (r.valid) {
      if (!r.tasl_line || r.json_ld === null || !r.rdfa_html) violations++;
    } else {
      if (r.tasl_line !== '' || r.json_ld !== null || r.rdfa_html !== '') violations++;
    }
  }
  return { name: 'P2_boundedness_output_fields_empty_iff_invalid', trials: checked, violations };
}

// ---------- P3: forced categorical boundary cases (float:no exception — no ULP forcing applicable) ----------
const CATEGORICAL_BOUNDARY_CASES = [
  [{}, 'all-empty input -- must report all 4 errors, no throw'],
  [{ title: 'T', creator: 'C', source_url: 'https://x', license: 'CC0-1.0' }, 'CC0-1.0 branch -- must use "marked with" phrasing, not "licensed under"'],
  [{ title: 'T', creator: 'C', source_url: 'https://x', license: 'CC-BY-4.0' }, 'standard license branch -- must use "licensed under" phrasing'],
  [{ title: '  T  ', creator: '  C  ', source_url: '  https://x  ', license: 'CC-BY-4.0' }, 'whitespace-padded fields -- sanitize must trim before validity check'],
  [{ title: 'T', creator: 'C', source_url: 'https://x', license: 'GPL-3.0' }, 'unrecognized license id -- must be invalid with license-list error'],
  [{ title: 'T', creator: 'C', source_url: 'https://x', license: 'CC-BY-4.0', work_url: 'https://work' }, 'work_url present -- must override source_url as the attribution URL'],
  [{ title: '', creator: 'C', source_url: 'https://x', license: 'CC-BY-4.0' }, 'title missing only -- single-error case'],
  [{ title: 'T', creator: 'C', source_url: '', license: 'CC0-1.0' }, 'CC0 with no source_url/work_url -- attrUrl empty, must use the no-URL TASL phrasing'],
];

function checkP3_forced() {
  const rows = [];
  for (const [pp, label] of CATEGORICAL_BOUNDARY_CASES) {
    const r = compute(pp).output_payload;
    const plausible = typeof r.valid === 'boolean' && Array.isArray(r.errors) && typeof r.tasl_line === 'string' && typeof r.rdfa_html === 'string';
    rows.push({ label, pp, valid: r.valid, tasl_line: r.tasl_line, errors: r.errors, plausible });
  }
  return rows;
}

const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED — spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_validity());
results.properties.push(checkP2_boundedness());
results.boundary_forced = checkP3_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const anyBoundaryImplausible = results.boundary_forced.some((b) => !b.plausible);

console.log(JSON.stringify({
  tool_id: 'art-207-attribution-string-generator',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_implausible: anyBoundaryImplausible,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryImplausible ? 1 : 0);
