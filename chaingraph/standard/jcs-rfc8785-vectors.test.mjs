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
 *   vendor-canonicalize   an independent RFC 8785 canonicalizer written outside this estate, vendored
 *                         at ./vendor/canonicalize/ (erdtman/canonicalize, Apache-2.0, pinned commit,
 *                         see PROVENANCE.md there; LANDSCAPE-JCS-DIFF-ORACLE-1). Byte-compared like the
 *                         twin; its upstream rules (lone surrogate / NaN / Infinity throws) are NOT
 *                         OCG policy rejections and are classified on their own outcome.
 *   page-ocgJcs           the PAGE estate's inline canonicalizer (JCS-CANON-PAGES-1): the SSOT lines
 *                         __ocgAssertIJson / __ocgJcs / __ocgCanonStr are extracted live from
 *                         kernels/fix-hash-scheme.mjs (the ocgJcs/ocgCanonStr manifest pairs' SSOT),
 *                         evaluated in a node:vm context, and every vector is run through the page hash
 *                         path __ocgCanonStr(v) = assertIJson + __ocgJcs. Its outcome MUST equal
 *                         ocg-hash-path's on every vector (enforced below), so a page hash and the host
 *                         hash can never disagree on an RFC 8785 case again.
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
import vm from 'node:vm';
import { policyParametersHash, canonicalPreimage } from '../kernels/_hash.mjs';
import { jcsCanonicalize } from '../vm/twin/verify.mjs';
import vendorCanonicalize from './vendor/canonicalize/canonicalize.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = resolve(HERE, 'vendor', 'rfc8785-testdata');
const CANON_VENDOR = resolve(HERE, 'vendor', 'canonicalize');
const PROBES = resolve(HERE, 'fixtures', 'jcs-ocg-probes.json');
const BASELINE = resolve(HERE, 'jcs-rfc8785-baseline.json');
const SSOT = resolve(HERE, '..', 'kernels', 'fix-hash-scheme.mjs');

// -- page-ocgJcs: extract the SSOT helper lines and build the page hash path evaluator --
// Same balanced-brace extraction the inline-ssot-sync gate uses for its `line` pairs.
function extractInlineFn(text, trigger) {
  const out = [];
  let from = 0;
  while (true) {
    const s = text.indexOf(trigger, from);
    if (s === -1) break;
    const braceStart = text.indexOf('{', s);
    if (braceStart === -1) { from = s + trigger.length; continue; }
    let depth = 0, end = -1;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end === -1) { from = s + trigger.length; continue; }
    out.push(text.slice(s, end));
    from = end;
  }
  return out;
}
function loadPageOcgJcs() {
  const ssot = readFileSync(SSOT, 'utf8');
  const lines = [
    ...extractInlineFn(ssot, 'function __ocgAssertIJson('),
    ...extractInlineFn(ssot, 'function __ocgJcs(v)'),
    ...extractInlineFn(ssot, 'function __ocgCanonStr('),
  ];
  if (lines.length !== 3 || lines.some((l) => !l)) {
    throw new Error(`page-ocgJcs: expected exactly 1 __ocgAssertIJson + 1 __ocgJcs + 1 __ocgCanonStr line in ${SSOT}, found ${lines.length} — SSOT/manifest is stale, fix before trusting this gate`);
  }
  const ctx = vm.createContext({});
  new vm.Script(lines.join('\n'), { filename: 'page-ocgJcs.ssot-inline' }).runInContext(ctx); // definitions only
  return (v) => {
    ctx.__vec = v; // host-realm object; __ocgJcs uses only typeof/Array.isArray/Object.keys — realm-safe
    return vm.runInContext('__ocgCanonStr(__vec)', ctx, { timeout: 5000 });
  };
}

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

// Upstream erdtman/canonicalize @ 31fb117afde3ef305b2e1d99bde539bf6300bc62 (see PROVENANCE.md).
const CANON_PINS = {
  'canonicalize.js': 'c1d0195af2a0748454b06af8f218e5c90415c19d39154d0058fee8229c12d859',
  'LICENSE': 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4',
};

const sha256hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const POLICY_RE = /I-JSON|2\^53|Non-finite/;

export function checkPins() {
  const errors = [];
  const pinDir = (dir, pins, label) => {
    for (const [rel, pin] of Object.entries(pins)) {
      let got;
      try { got = sha256hex(readFileSync(resolve(dir, rel))); } catch { errors.push(`missing vendored file ${label}/${rel}`); continue; }
      if (got !== pin) errors.push(`vendored file ${label}/${rel} sha256 ${got} != pinned ${pin}`);
    }
  };
  pinDir(VENDOR, PINS, 'rfc8785-testdata');
  pinDir(CANON_VENDOR, CANON_PINS, 'canonicalize');
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
  const pageOcgJcs = loadPageOcgJcs();
  const rows = [];
  for (const c of cases) {
    const expectedText = c.expected.toString('utf8');
    const want = sha256hex(c.expected);
    let a, p, t, g, v;
    try { a = (await policyParametersHash(JSON.parse(c.text))) === want ? 'PASS' : 'FAIL'; } catch (e) { a = classify(e); }
    try { p = canonicalPreimage(JSON.parse(c.text), null) === `{"output_payload":null,"policy_parameters":${expectedText}}` ? 'PASS' : 'FAIL'; } catch (e) { p = classify(e); }
    try { t = Buffer.from(jcsCanonicalize(JSON.parse(c.text))).equals(c.expected) ? 'PASS' : 'FAIL'; } catch { t = 'THROW'; }
    try { g = sha256hex(Buffer.from(pageOcgJcs(JSON.parse(c.text)), 'utf8')) === want ? 'PASS' : 'FAIL'; } catch (e) { g = classify(e); }
    try { v = Buffer.from(vendorCanonicalize(JSON.parse(c.text)), 'utf8').equals(c.expected) ? 'PASS' : 'FAIL'; } catch (e) { v = classify(e); }
    rows.push({ case: c.id, source: c.source, 'ocg-hash-path': a, 'ocg-preimage': p, 'twin-jcsCanonicalize': t, 'page-ocgJcs': g, 'vendor-canonicalize': v });
  }
  return rows;
}

export const IMPLS = ['ocg-hash-path', 'ocg-preimage', 'twin-jcsCanonicalize', 'page-ocgJcs', 'vendor-canonicalize'];

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
    // page-ocgJcs is the page estate's twin of ocg-hash-path: any outcome divergence means a
    // page hash and the host hash would disagree on that vector — the defect this gate exists for.
    if (r['page-ocgJcs'] !== r['ocg-hash-path']) {
      errors.push(`PAGE DIVERGENCE: page-ocgJcs × ${r.case} = ${r['page-ocgJcs']} but ocg-hash-path = ${r['ocg-hash-path']} — a page hash would disagree with the host hash on this input`);
    }
  }
  for (const k of known) if (!seen.has(key(k.impl, k.case))) errors.push(`ORPHAN baseline entry: ${k.impl} × ${k.case} (no such case or implementation)`);
  return errors;
}

// -- seeded differential fuzz (LANDSCAPE-JCS-DIFF-ORACLE-1) --
// Deterministic PRNG (mulberry32), seed fixed below, no Math.random and no clock. Generates N values
// weighted toward the ES2015 number-serialization surface (RFC 8785 §3.2.2.2.3) where independent
// ports most often diverge, plus unicode/astral keys and nested arrays, and byte-compares the OCG
// paths (canonicalPreimage / policyParametersHash) against the vendored independent canonicalizer.
// OCG policy rejections (I-JSON) count as POLICY-REJECT, never as a divergence; any other mismatch is
// a gate failure with a shrunk reproducer.
export const FUZZ_N = 5000;
export const FUZZ_SEED = 0x8785f00d;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Boundary constants named by the row: the 1e21 / 1e-7 exponent-notation boundaries, -0, subnormals,
// the largest safe integer and its neighbours, and values that round-trip only at 17 digits.
const BOUNDARY_NUMBERS = [
  0, -0, 1, -1, 0.1, 1 / 3, 1e-7, 9.999999999999999e-8, 1e20, 1e21,
  5e-324, 1e-323, 2.2250738585072014e-308, // subnormals and the smallest normal
  Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER - 2, 2 ** 53,
  900719925474099.1, 1.0000000000000002, 0.30000000000000004, -1e-7, -1e21, -5e-324,
  123456789012345678, 1.7976931348623157e308,
];

const KEY_POOL = ['a', 'b', 'Z', '0', 'é', 'ü', '中', '𝕒', '\u007f', 'a\u0301', '𝔸', '𐀀', '€'];

function randomDouble(rnd) {
  // Build a full 64-bit double from PRNG bits: mantissa (53 bits) and a signed exponent, so the
  // sample covers subnormals, 17-digit round-trip values and both signs, never NaN or Infinity.
  const mantissa = Math.floor(rnd() * 2 ** 52) + 2 ** 52; // 53-bit with implicit leading 1
  const exp = Math.floor(rnd() * 2176) - 1087; // [2^-1086 .. 2^1023-ish), keeps every result finite
  const sign = rnd() < 0.5 ? -1 : 1;
  const v = sign * (mantissa / 2 ** 52) * 2 ** exp;
  return Number.isFinite(v) ? v : 0.1;
}

function randomString(rnd) {
  const pool = [...KEY_POOL, '𝕫', 'ñ', 'ﬀ', '\u0000', 'line\u000asep'];
  const base = pool[Math.floor(rnd() * pool.length)];
  if (rnd() < 0.5) return base;
  return base + pool[Math.floor(rnd() * pool.length)];
}

function fuzzValue(rnd, depth) {
  const roll = rnd();
  if (depth <= 0 || roll < 0.55) {
    // numbers first: boundary constants on a fixed cycle, PRNG doubles beyond them
    const pick = rnd();
    if (pick < 0.45) return BOUNDARY_NUMBERS[Math.floor(rnd() * BOUNDARY_NUMBERS.length)];
    if (pick < 0.6) return Math.floor(rnd() * 1000) - 500;
    if (pick < 0.7) return Math.floor(rnd() * 4) * 1e-7; // near the 1e-7 boundary
    return randomDouble(rnd);
  }
  if (roll < 0.7) return randomString(rnd);
  if (roll < 0.8) return rnd() < 0.5;
  if (roll < 0.85) return null;
  if (roll < 0.93) return Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => fuzzValue(rnd, depth - 1));
  const obj = {};
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const key = rnd() < 0.5 ? randomString(rnd) : KEY_POOL[Math.floor(rnd() * KEY_POOL.length)] + i;
    obj[key] = fuzzValue(rnd, depth - 1);
  }
  return obj;
}

// Repeatedly simplify a diverging input so the reported reproducer is minimal (shrink-only).
function shrink(divergent) {
  const kind = (v) => Array.isArray(v) ? 'array' : v && typeof v === 'object' ? 'object' : 'scalar';
  let cur = divergent;
  for (;;) {
    const k = kind(cur);
    if (k === 'array' && cur.length > 1) {
      const halves = [cur.slice(0, cur.length - 1), cur.slice(1), cur.filter((_, i) => i % 2 === 0)].filter((c) => c.length && c.length < cur.length);
      const next = halves.find((c) => kind(c) === 'array' && JSON.stringify(c) !== JSON.stringify(cur));
      if (!next) break;
      cur = next; continue;
    }
    if (k === 'object' && Object.keys(cur).length > 1) {
      let next = null;
      for (const key of Object.keys(cur)) {
        const cand = { ...cur }; delete cand[key];
        if (Object.keys(cand).length && JSON.stringify(cand) !== JSON.stringify(cur)) { next = cand; break; }
      }
      if (!next) break;
      cur = next; continue;
    }
    break;
  }
  return cur;
}

export async function runFuzz(n = FUZZ_N, seed = FUZZ_SEED) {
  const rnd = mulberry32(seed);
  const errors = [];
  let policyRejects = 0;
  for (let i = 0; i < n; i++) {
    const value = fuzzValue(rnd, 4);
    let vendBytes = null, vendThrew = null;
    try { vendBytes = Buffer.from(vendorCanonicalize(value), 'utf8'); } catch (e) { vendThrew = e; }
    let hash = null, pre = null, ocgThrew = null;
    try { hash = await policyParametersHash(value); } catch (e) { ocgThrew = e; }
    try { pre = canonicalPreimage(value, null); } catch (e) { ocgThrew = ocgThrew || e; }
    if (ocgThrew && POLICY_RE.test(String(ocgThrew && ocgThrew.message))) { policyRejects++; continue; }
    if (ocgThrew) { errors.push(`FUZZ OCG THROW (unclassified): seed=${seed} i=${i} input=${JSON.stringify(value)} error=${ocgThrew.message}`); continue; }
    if (vendThrew) { errors.push(`FUZZ DIVERGENCE: vendor throws where the OCG path accepts — seed=${seed} i=${i} input=${JSON.stringify(value)} error=${vendThrew.message}`); continue; }
    const vendText = vendBytes.toString('utf8');
    const wantHash = sha256hex(vendBytes);
    const wantPre = `{"output_payload":null,"policy_parameters":${vendText}}`;
    if (hash !== wantHash || pre !== wantPre) {
      const shrunk = shrink(value);
      errors.push(`FUZZ DIVERGENCE: seed=${seed} i=${i} shrunk input=${JSON.stringify(shrunk)} original input=${JSON.stringify(value)} (hash ${hash === wantHash ? 'equal' : 'differs'}, preimage ${pre === wantPre ? 'equal' : 'differs'})`);
    }
  }
  return { n, seed, policyRejects, divergences: errors.length, errors };
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
  const fuzz = await runFuzz();
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ok: errors.length === 0 && fuzz.divergences === 0, errors, fuzz: { n: fuzz.n, seed: fuzz.seed, policyRejects: fuzz.policyRejects, divergences: fuzz.divergences }, rows }, null, 2));
  } else {
    if (args.includes('--list') || errors.length || fuzz.divergences) {
      for (const r of rows) console.log(`${r.case.padEnd(26)} ${IMPLS.map((i) => `${i}=${r[i]}`).join('  ')}`);
    }
    const counts = IMPLS.map((i) => `${i} ${rows.filter((r) => r[i] === 'PASS').length}/${rows.length} pass`).join(' · ');
    const fuzzLine = `fuzz: N=${fuzz.n} seed=${FUZZ_SEED} divergences=${fuzz.divergences} policy-rejects=${fuzz.policyRejects}`;
    if (errors.length || fuzz.divergences) {
      console.error(`\nJCS-RFC8785 GATE: FAIL (${errors.length + fuzz.divergences})\n  ` + [...errors, ...fuzz.errors].join('\n  '));
    }
    else console.log(`JCS-RFC8785 GATE: OK · ${counts} · ${known.length} baselined outcome(s), all unchanged · ${fuzzLine}`);
  }
  process.exit(errors.length || fuzz.divergences ? 1 : 0);
}

main();
