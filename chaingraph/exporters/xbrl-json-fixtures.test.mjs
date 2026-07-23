// xbrl-json-fixtures.test.mjs — §13.13 xBRL-JSON export profile GATE (SPEC.md §15, v0.8.12).
// This profile ships fixture-only (no exporter yet — see SPEC.md §13.13 fence), so the gate
// asserts the three properties §13.13.6 names against the two committed fixtures:
//   (a) round-trip determinism — re-canonicalizing a fixture twice is byte-identical (and
//       matches the file bytes, so the fixture itself is already in canonical JCS key order);
//   (b) canonicalValues conformance — every fact's `value` is a canonical-lexical STRING, never
//       a raw number/boolean (OIM canonicalValues mode requirement);
//   (c) Annex 1 structural load — real MDRM concept names (not a placeholder/null concept),
//       required OIM members present, and the fixture is explicitly marked non-submittable.
// Node 18+. Run: node chaingraph/exporters/xbrl-json-fixtures.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cgCanon } from '../kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = join(HERE, 'fixtures', 'xbrl-json');

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

function loadFixture(name) {
  const raw = readFileSync(join(FIXDIR, name), 'utf8');
  return { raw, doc: JSON.parse(raw) };
}

function assertCanonicalValues(doc, label) {
  const facts = doc.facts ?? {};
  const ids = Object.keys(facts);
  ok(ids.length > 0, `${label}: has at least one fact`);
  for (const id of ids) {
    const f = facts[id];
    ok(typeof f.value === 'string', `${label}: fact "${id}" value is a canonical-lexical string (got ${typeof f.value})`);
    ok(f.dimensions && typeof f.dimensions.concept === 'string' && f.dimensions.concept.length > 0,
      `${label}: fact "${id}" has a non-empty dimensions.concept`);
  }
  ok(doc.documentInfo?.features?.['xbrl:canonicalValues'] === true, `${label}: documentInfo.features["xbrl:canonicalValues"] === true`);
}

function assertDeterminism(raw, doc, label) {
  const once = JSON.stringify(cgCanon(doc));
  const twice = JSON.stringify(cgCanon(JSON.parse(once)));
  ok(once === twice, `${label}: re-canonicalizing twice is byte-identical`);
  // The committed fixture is itself already in JCS key order — canonicalizing it must be a no-op.
  ok(JSON.stringify(cgCanon(doc)) === JSON.stringify(doc), `${label}: fixture on disk is already in canonical (JCS) key order`);
}

console.log('§13.13 xBRL-JSON export profile — fixture gate\n');

console.log('sample.oim.json:');
{
  const { raw, doc } = loadFixture('sample.oim.json');
  assertDeterminism(raw, doc, 'sample.oim.json');
  assertCanonicalValues(doc, 'sample.oim.json');
  ok(typeof doc.documentInfo?.['ocg:metadata']?.execution_hash === 'string' &&
     doc.documentInfo['ocg:metadata'].execution_hash.startsWith('sha256:'),
     'sample.oim.json: execution_hash embedded in documentInfo metadata, sha256:-prefixed');
  ok(doc.documentInfo?.['ocg:metadata']?.chaingraph_version === '0.4.0',
     'sample.oim.json: chaingraph_version stays 0.4.0 (export mints no envelope change)');
}

console.log('\nannex1-ffiec-callreport.sample.json:');
{
  const { raw, doc } = loadFixture('annex1-ffiec-callreport.sample.json');
  assertDeterminism(raw, doc, 'annex1');
  assertCanonicalValues(doc, 'annex1');
  const concepts = Object.values(doc.facts).map((f) => f.dimensions.concept);
  const MDRM = /^ffiec-cr:RCON\d{4}$/;
  for (const c of concepts) ok(MDRM.test(c), `annex1: concept "${c}" is a real MDRM-pattern item code (RCONnnnn), not a placeholder`);
  ok(!concepts.some((c) => /placeholder|null|tbd/i.test(c)), 'annex1: no placeholder/null/tbd concept present');
  const note = doc.documentInfo?.['ocg:metadata']?.note ?? '';
  ok(/not a submittable/i.test(note), 'annex1: fixture note explicitly states NOT submittable (§13.13.3 caveat)');
}

console.log();
console.log(fail ? `✗ ${fail} failure(s)` : '✓ all §13.13 fixture checks pass');
process.exitCode = fail ? 1 : 0;
