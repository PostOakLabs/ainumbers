#!/usr/bin/env node
/**
 * jcs-rfc8785-vectors.test.mjs — JCS-RFC8785-VECTORS-1
 *
 * WHY: SPEC §4 says execution_hash is SHA-256 over the RFC 8785 (JCS) form of {policy_parameters,
 * output_payload}, and SPEC §24 row D2 says serialization must not depend on property enumeration order.
 * Nothing checked either claim against the RFC's own test data. This gate runs the RFC 8785 author's
 * official vectors (vendored at ./vendor/rfc8785-testdata/, Apache-2.0, see PROVENANCE.md there) plus
 * OCG-authored probes (./fixtures/jcs-ocg-probes.json) through every canonicalizer the standard depends on.
 *
 * IMPLEMENTATIONS UNDER TEST
 *   ocg-hash-path         policyParametersHash(v) from ../kernels/_hash.mjs, compared with SHA-256 of the
 *                         expected bytes (the §PPH-1 digest path; same serializer as §4).
 *   ocg-preimage          canonicalPreimage(v, null) from ../kernels/_hash.mjs, compared with the expected
 *                         preimage string {"output_payload":null,"policy_parameters":<expected>} (the §4 path).
 *   twin-jcsCanonicalize  jcsCanonicalize(v) from ../vm/twin/verify.mjs, which mirrors the zkVM guest's
 *                         journal serializer (UTF-8 key order, fail-closed on exponent-form numbers).
 * OUTCOMES: PASS | FAIL | POLICY-REJECT (assertIJson refused the input) | THROW (any other error).
 *
 * BASELINE (./jcs-rfc8785-baseline.json) is SHRINK-ONLY. Every non-PASS outcome must be listed with the
 * same outcome; an unlisted non-PASS fails (new divergence), and a listed entry whose observed outcome
 * differs fails too (stale entry: remove or correct it in the same PR, never raise the baseline to pass).
 * Classes: "defect" (to be fixed, owner row named), "policy" (deliberate I-JSON rule), "by-design"
 * (mirrors the prover guest; changing it needs a new guest image and re-proving).
 *
 * The vendored files are also pinned by SHA-256 below; any byte change fails (re-vendor from a new pin and
 * update PROVENANCE.md together).
 *
 * Usage:
 *   node chaingraph/standard/jcs-rfc8785-vectors.test.mjs              gate (exit 1 on any violation)
 *   node chaingraph/standard/jcs-rfc8785-vectors.test.mjs --list       print the full matrix
 *   node chaingraph/standard/jcs-rfc8785-vectors.test.mjs --json       machine-readable report
 *   node chaingraph/standard/jcs-rfc8785-vectors.test.mjs --self-test  red-proof (GATE-SELFTEST-META-1 pair)
 *
 * Zero dependencies. Read-only: never writes the baseline.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { policyParametersHash, canonicalPreimage } from '../kernels/_hash.mjs';
import { jcsCanonicalize } from '../vm/twin/verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = resolve(HERE, 'vendor', 'rfc8785-testdata');
const PROBES = resolve(HERE, 'fixtures', 'jcs-ocg-probes.json');
const BASELINE = resolve(HERE, 'jcs-rfc8785-baseline.json');

// Upstream cyberphone/json-canonicalization @ 19d51d7fe467d4706a3ff08adf8a748f29fc21e0 (see PROVENANCE.md).
const PINS = {
  'input/arrays.json': 'e503b6d71d1afa595b1c74b1016445c944cd89f90418066b23de1aeda7d17563',
  'input/french.json': '03676a951cd8753ac62589f72eb2105cc782c33425418cfe1d517c111f6e5d5a',
  'input/structures.json': 'd66893805be1784116af50af3110d08766c70a6b4aad93374723f72346e7aaa6',
  'input/unicode.json': '4621864e014d4a805a563f55b9ea20aba4a2d2dc09c7394f625496998c00702c',
  'input/values.json': 'c4a041b503d6bc236036ef44db4dac499272f60fc22c40dc3b7a54870ba6f1c3',
  'input/weird.json': 'a3a905266bd4a49a969274ea69baa14ee0c4af0ead926d6fa2b7612b4af75387',
  'output/arrays.json': '099601b171cafed97c333f8878d68e7f8c8f795412adb34b2fdcf0e7c7beac42',
  'output/french.json': 'd99d0ebdcb0033cb858cfa830ae46bc0fb3309413b271f1da828c89901a27ed5',
  'output/structures.json': '605f65004ec2db7692522a0852c22f1c989e036d547e88963d1a3143cf3195d5',
  'output/unicode.json': '0d99aad92a125196ff887876643fd3206786a84ddce2cee52ba4ad256d2381d3',
  'output/values.json': '2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb',
  'output/weird.json': '6af595a9aa80110b964b4de3f82a05fa6ae7423005019bacfa2620dddc4e94d1',
  'outhex/arrays.txt': 'e306733ca0c4da9595ebde73ec072c295f0f9ef0ea4aafc4d267d4a04988ce51',
  'outhex/french.txt': 'f9b3bfd02f4edb3d0a490703153d836db5ef0a2090a9d3357f8c3797e12d4043',
  'outhex/structures.txt': '063ee2bc6fa3f93b2a131841315f5c6bf0ea7488cc128ed50725cabf5592627b',
  'outhex/unicode.txt': '0471fea1ee0464e435a52510d2c187b216961a5e7e2665402ea9cb1cd04109ca',
  'outhex/values.txt': 'b8b802e82c7bead71a7841e27fce6458854eb72ffd0eaa51474dacdfbdf3ab64',
  'outhex/weird.txt': '1061953c7129537722f9abd9de321c787120489d09f34ba58065bd77ba9a84b6',
  'LICENSE': '6821faaddedf2d78c95bb6d98b127e9e616097afd2f6bcc34389f000d13ab12d',
};

const sha256hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const POLICY_RE = /I-JSON|2\^53|Non-finite/;

export function checkPins() {
  const errors = [];
  for (const [rel, pin] of Object.entries(PINS)) {
    let got;
    try { got = sha256hex(readFileSync(resolve(VENDOR, rel))); } catch { errors.push(`missing vendored file ${rel}`); continue; }
    if (got !== pin) errors.push(`vendored file ${rel} sha256 ${got} != pinned ${pin}`);
  }
  return errors;
}

export function loadCases() {
  const cases = [];
  for (const f of readdirSync(resolve(VENDOR, 'input')).filter((x) => x.endsWith('.json')).sort()) {
    const expected = readFileSync(resolve(VENDOR, 'output', f));
    const outhex = readFileSync(resolve(VENDOR, 'outhex', f.replace(/\.json$/, '.txt')), 'utf8').replace(/\s+/g, '').toLowerCase();
    if (expected.toString('hex') !== outhex) throw new Error(`vendored output/${f} disagrees with outhex/${f.replace(/\.json$/, '.txt')}`);
    cases.push({ id: f, source: 'rfc8785', text: readFileSync(resolve(VENDOR, 'input', f), 'utf8'), expected });
  }
  for (const p of JSON.parse(readFileSync(PROBES, 'utf8')).probes) {
    cases.push({ id: p.id, source: 'ocg-probe', text: p.input, expected: Buffer.from(p.expected, 'utf8') });
  }
  return cases;
}

const classify = (e) => (POLICY_RE.test(String(e && e.message)) ? 'POLICY-REJECT' : 'THROW');

export async function runMatrix(cases) {
  const rows = [];
  for (const c of cases) {
    const expectedText = c.expected.toString('utf8');
    const want = sha256hex(c.expected);
    let a, p, t;
    try { a = (await policyParametersHash(JSON.parse(c.text))) === want ? 'PASS' : 'FAIL'; } catch (e) { a = classify(e); }
    try { p = canonicalPreimage(JSON.parse(c.text), null) === `{"output_payload":null,"policy_parameters":${expectedText}}` ? 'PASS' : 'FAIL'; } catch (e) { p = classify(e); }
    try { t = Buffer.from(jcsCanonicalize(JSON.parse(c.text))).equals(c.expected) ? 'PASS' : 'FAIL'; } catch { t = 'THROW'; }
    rows.push({ case: c.id, source: c.source, 'ocg-hash-path': a, 'ocg-preimage': p, 'twin-jcsCanonicalize': t });
  }
  return rows;
}

export const IMPLS = ['ocg-hash-path', 'ocg-preimage', 'twin-jcsCanonicalize'];

export function compare(rows, known) {
  const errors = [];
  const key = (impl, c) => `${impl}\u0000${c}`;
  const knownMap = new Map(known.map((k) => [key(k.impl, k.case), k]));
  const seen = new Set();
  for (const r of rows) {
    for (const impl of IMPLS) {
      const k = knownMap.get(key(impl, r.case));
      if (r[impl] === 'PASS') {
        if (k) errors.push(`STALE baseline: ${impl} × ${r.case} now PASSES (listed ${k.outcome}); remove the entry in this PR`);
      } else if (!k) {
        errors.push(`NEW divergence: ${impl} × ${r.case} = ${r[impl]} (not in baseline)`);
      } else if (k.outcome !== r[impl]) {
        errors.push(`CHANGED: ${impl} × ${r.case} = ${r[impl]} (baseline says ${k.outcome})`);
      }
      if (k) seen.add(key(impl, r.case));
    }
  }
  for (const k of known) if (!seen.has(key(k.impl, k.case))) errors.push(`ORPHAN baseline entry: ${k.impl} × ${k.case} (no such case or implementation)`);
  return errors;
}

async function selfTest() {
  const cases = loadCases();
  const known = JSON.parse(readFileSync(BASELINE, 'utf8')).known;
  const failures = [];
  // 1. corrupt the expected bytes of a case every implementation passes: must surface as NEW divergence
  const mutated = cases.map((c) => (c.id === 'arrays.json' ? { ...c, expected: Buffer.concat([c.expected, Buffer.from(' ')]) } : c));
  if (!compare(await runMatrix(mutated), known).some((e) => e.startsWith('NEW divergence') && e.includes('arrays.json'))) failures.push('corrupted expected bytes were not caught');
  // 2. drop one baseline entry: its non-PASS outcome must surface as NEW divergence
  const rows = await runMatrix(cases);
  if (!compare(rows, known.slice(1)).some((e) => e.startsWith('NEW divergence'))) failures.push('dropped baseline entry was not caught');
  // 3. add an entry for a passing pair: must surface as STALE
  if (!compare(rows, [...known, { impl: 'ocg-hash-path', case: 'arrays.json', outcome: 'FAIL', class: 'defect' }]).some((e) => e.startsWith('STALE'))) failures.push('stale baseline entry was not caught');
  // 4. the unmodified tree must be green
  if (compare(rows, known).length) failures.push('unmodified tree is not green');
  if (failures.length) { console.error('SELF-TEST FAILED:\n  ' + failures.join('\n  ')); process.exit(1); }
  console.log('jcs-rfc8785-vectors self-test OK: corrupted vector, dropped baseline entry and stale entry all caught; clean tree green');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();
  const errors = checkPins();
  let cases = [];
  try { cases = loadCases(); } catch (e) { errors.push(`cannot load cases: ${e.message}`); }
  const rows = await runMatrix(cases);
  const known = JSON.parse(readFileSync(BASELINE, 'utf8')).known;
  if (cases.length) errors.push(...compare(rows, known));
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, rows }, null, 2));
  } else {
    if (args.includes('--list') || errors.length) {
      for (const r of rows) console.log(`${r.case.padEnd(26)} ${IMPLS.map((i) => `${i}=${r[i]}`).join('  ')}`);
    }
    const counts = IMPLS.map((i) => `${i} ${rows.filter((r) => r[i] === 'PASS').length}/${rows.length} pass`).join(' · ');
    if (errors.length) { console.error(`\nJCS-RFC8785 GATE: FAIL (${errors.length})\n  ` + errors.join('\n  ')); }
    else console.log(`JCS-RFC8785 GATE: OK · ${counts} · ${known.length} baselined outcome(s), all unchanged`);
  }
  process.exit(errors.length ? 1 : 0);
}

main();
