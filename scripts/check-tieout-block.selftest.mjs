#!/usr/bin/env node
/**
 * scripts/check-tieout-block.selftest.mjs — TIEOUT-VERIFY-SURFACE-1's selftest.
 *
 * Guards the tie-out block added to chaingraph/verify.html. Four legs:
 *
 *   A  page shape — the block's markers, ids, legend, caveat copy and wiring
 *      imports are present and in order, and the block renders exclusively
 *      through createElement/textContent (no innerHTML).
 *   B  verdict parity — the checker port embedded in the page (extracted
 *      verbatim between the __TIEOUT_CHECKER markers, run in Node with the
 *      repo's _csv bundle and _hash.mjs jcsStringify bound as __ocgJcs)
 *      produces a deep-equal report to the reference checker
 *      scripts/check-document-span.mjs on EVERY shipped fixture in
 *      chaingraph/standard/fixtures/document-span/, and each fixture's
 *      declared expectation holds on both sides.
 *   C  snapshot freshness — every digest in
 *      chaingraph/kernel-digests-snapshot.mjs exists in the live
 *      registry/kernel/ tree (the vendored list never invents one), the list
 *      is not implausibly small, and the as-of stamp agrees with its length.
 *   D  examples fidelity — the three embedded example records are deep-equal
 *      to the tracked fixture files they name.
 *
 * Mutation controls are deliberately absent: this script is not registered in
 * preflight's GATES list (the row's fence is the page and its test; wiring a
 * new gate is a separate, coordinator-scoped change), so there is no
 * "red today, green after the fix" lifecycle to prove. The parity leg instead
 * holds the port to the reference checker's verdicts on all 48 fixtures,
 * which is the stronger property.
 *
 * Run: node scripts/check-tieout-block.selftest.mjs
 */
import { readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { deepStrictEqual } from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE = join(REPO, 'chaingraph', 'verify.html');
const FIXTURES = join(REPO, 'chaingraph', 'standard', 'fixtures', 'document-span');
const REGISTRY = join(REPO, 'registry', 'kernel');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  + ' + name);
    passed++;
  } catch (e) {
    console.error('  x ' + name);
    console.error('    ' + (e && e.message ? e.message.split('\n')[0] : e));
    failed++;
  }
}
async function atest(name, fn) {
  try {
    await fn();
    console.log('  + ' + name);
    passed++;
  } catch (e) {
    console.error('  x ' + name);
    console.error('    ' + (e && e.message ? e.message.split('\n')[0] : e));
    failed++;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const HEX64 = /^[0-9a-f]{64}$/;
const BEGIN = '/* __TIEOUT_CHECKER_BEGIN';
const END = '/* __TIEOUT_CHECKER_END */';
const EX_BEGIN = '/* __TIEOUT_EXAMPLES_BEGIN';
const EX_END = '/* __TIEOUT_EXAMPLES_END */';

const page = readFileSync(PAGE, 'utf8');

function extractBetween(src, beginMarker, endMarker) {
  const b = src.indexOf(beginMarker);
  assert(b !== -1, 'begin marker not found: ' + beginMarker);
  const bodyStart = src.indexOf('*/', b);
  assert(bodyStart !== -1, 'begin marker comment never closes');
  const e = src.indexOf(endMarker, bodyStart);
  assert(e !== -1, 'end marker not found: ' + endMarker);
  return src.slice(bodyStart + 2, e);
}

// The reference checker and the port must see the same digest set: pass the
// registry-derived Set explicitly to both (the reference would otherwise
// resolve its own default directory, which is the same tree today but should
// not be load-bearing for parity).
const registryHexes = readdirSync(REGISTRY).filter((n) => HEX64.test(n.slice(0, -'.json'.length)) && n.endsWith('.json')).map((n) => n.slice(0, -'.json'.length)).sort();
const REGISTRY_SET = new Set(registryHexes);
assert(registryHexes.length >= 700, 'registry/kernel holds only ' + registryHexes.length + ' digests');

const fixtureFiles = readdirSync(FIXTURES).filter((n) => n.endsWith('.json')).sort();
const fixtures = fixtureFiles.map((n) => ({ name: n, fx: JSON.parse(readFileSync(join(FIXTURES, n), 'utf8')) }));

const checkerSrc = extractBetween(page, BEGIN, END);
const examplesSrc = extractBetween(page, EX_BEGIN, EX_END);

// Node runner for the embedded port: repo copies of the two imports it needs,
// with jcsStringify bound under the same name the page binds it to.
const TMP = join(REPO, '.tmp', 'tieout-selftest');
mkdirSync(TMP, { recursive: true });
const portPath = join(TMP, 'tieout-checker-port.mjs');
writeFileSync(portPath, [
  "import { jcsStringify as __ocgJcs } from '../../chaingraph/kernels/_hash.mjs';",
  "import { _csv } from '../../chaingraph/kernels/_csv.bundle.mjs';",
  checkerSrc,
  '',
].join('\n'), 'utf8');
const portUrl = pathToFileURL(portPath).href + '?run=' + Date.now();
const { verifyDocumentSpan: portVerify } = await import(portUrl);
const { verifyDocumentSpan: refVerify } = await import('./check-document-span.mjs');

const exPath = join(TMP, 'tieout-examples.mjs');
writeFileSync(exPath, examplesSrc + '\nexport default TIEOUT_EXAMPLES;\n', 'utf8');
const exUrl = pathToFileURL(exPath).href + '?run=' + Date.now();
const { default: TIEOUT_EXAMPLES } = await import(exUrl);

function refOpts(fx) {
  return {
    documentText: typeof fx.document === 'string' ? fx.document : undefined,
    policyParameters: Object.hasOwn(fx, 'policy_parameters') ? fx.policy_parameters : undefined,
    digestHexes: REGISTRY_SET,
  };
}

console.log('check-tieout-block.selftest.mjs (chaingraph/verify.html tie-out block)');
console.log('  fixtures: ' + fixtures.length + '  registry digests: ' + registryHexes.length);

// ---- Leg A: page shape ------------------------------------------------------

test('A1: checker and example markers present, in order', () => {
  const order = [BEGIN, END, EX_BEGIN, EX_END].map((m) => page.indexOf(m));
  for (const idx of order) assert(idx !== -1, 'missing marker');
  assert(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], 'markers out of order');
});

test('A2: checker block exports verifyDocumentSpan and keeps the four-step flow', () => {
  assert(/export\s+async\s+function\s+verifyDocumentSpan/.test(checkerSrc), 'no exported verifyDocumentSpan in the checker block');
  for (const code of ['ALL_FOUR_STEPS_PASSED', 'SELF_CONSISTENT_WITH_POLICY', 'SELF_CONSISTENT_NO_POLICY', 'DOCUMENT_DIGEST_MISMATCH', 'ROW_KEY_AMBIGUOUS', 'EXTRACTOR_DIGEST_UNKNOWN', 'DIGEST_LIST_UNAVAILABLE', 'PRIVATE_INPUT_COMMITMENT_REFUSED']) {
    assert(checkerSrc.includes(code), 'checker block missing reason code ' + code);
  }
});

test('A3: wiring imports ride same-origin (csv bundle, digest snapshot, errata)', () => {
  assert(page.includes("from './kernels/_csv.bundle.mjs'"), 'no _csv.bundle.mjs import');
  assert(page.includes("from './kernel-digests-snapshot.mjs'"), 'no kernel-digests-snapshot.mjs import');
  assert(page.includes('KERNEL_DIGEST_HEXES'), 'KERNEL_DIGEST_HEXES unused');
  assert(page.includes('KERNEL_DIGEST_LIST_STAMP'), 'KERNEL_DIGEST_LIST_STAMP unused');
  assert(page.includes("from './errata-check.mjs'"), 'no errata-check.mjs import');
  assert(page.includes("from './errata/errata-snapshot.mjs'"), 'no errata-snapshot.mjs import');
  assert(page.includes('window.runTieout'), 'runTieout not exposed as a window global');
});

test('A4: tie-out card ids and the three example buttons are present', () => {
  for (const id of ['id="tieoutCard"', 'id="tieoutSpansInput"', 'id="tieoutDocsInput"', 'id="tieoutResult"', 'id="tieoutExampleVerifiedBtn"', 'id="tieoutExampleExternalBtn"', 'id="tieoutExampleFailedBtn"']) {
    assert(page.includes(id), 'missing ' + id);
  }
});

test('A5: three-state legend and the zero-attestation caveat stay in the page', () => {
  for (const s of ['✓ verified', '◐ external', '✗ failed', 'Zero-attestation caveat (SPEC.md §23.2, kept visible)', 'computed independently of']) {
    assert(page.includes(s), 'missing page copy: ' + s);
  }
});

test('A6: the tie-out module renders through createElement/textContent only (no innerHTML)', () => {
  const start = page.lastIndexOf('<script type="module">');
  const stop = page.lastIndexOf('</script>');
  const block = page.slice(start, stop);
  assert(block.includes('runTieout'), 'tie-out module block not found');
  assert(!block.includes('innerHTML'), 'tie-out module block must not use innerHTML');
  assert(!block.includes('insertAdjacentHTML'), 'tie-out module block must not use insertAdjacentHTML');
});

// ---- Leg B: verdict parity on every fixture ---------------------------------

for (const { name, fx } of fixtures) {
  await atest('B: ' + name + ' — port verdict deep-equals reference checker', async () => {
    const opts = refOpts(fx);
    const ref = refVerify(fx.record, opts);
    const port = await portVerify(fx.record, opts);
    deepStrictEqual(port, ref, 'port/reference divergence');
    const expect = fx.expect;
    assert(port.structural === expect.structural, 'structural: got ' + port.structural + ', want ' + expect.structural + ' (detail ' + JSON.stringify(port.detail) + ')');
    assert(port.verifiable === expect.verifiable, 'verifiable: got ' + port.verifiable + ', want ' + expect.verifiable);
    assert(port.reason_code === expect.reason_code, 'reason_code: got ' + port.reason_code + ', want ' + expect.reason_code);
  });
}

test('B: fixture corpus is complete (48 files)', () => {
  assert(fixtures.length === 48, 'expected 48 fixtures, found ' + fixtures.length);
});

// ---- Leg C: snapshot freshness ----------------------------------------------

const { KERNEL_DIGEST_HEXES, KERNEL_DIGEST_LIST_STAMP } = await import('../chaingraph/kernel-digests-snapshot.mjs');

test('C1: every vendored digest exists in the live registry tree', () => {
  const invented = KERNEL_DIGEST_HEXES.filter((h) => !REGISTRY_SET.has(h));
  assert(invented.length === 0, 'vendored list holds ' + invented.length + ' digests absent from registry/kernel (first: ' + (invented[0] || 'n/a') + ')');
});

test('C2: snapshot is not implausibly small', () => {
  assert(KERNEL_DIGEST_HEXES.length >= 700, 'snapshot holds only ' + KERNEL_DIGEST_HEXES.length + ' digests');
});

test('C3: stamp agrees with the list it stamps', () => {
  assert(KERNEL_DIGEST_LIST_STAMP.count === KERNEL_DIGEST_HEXES.length, 'stamp count ' + KERNEL_DIGEST_LIST_STAMP.count + ' != list length ' + KERNEL_DIGEST_HEXES.length);
  assert(KERNEL_DIGEST_LIST_STAMP.source === 'registry/kernel', 'unexpected stamp source ' + KERNEL_DIGEST_LIST_STAMP.source);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(KERNEL_DIGEST_LIST_STAMP.date), 'stamp date malformed');
  assert(/^[0-9a-f]{8,}$/.test(KERNEL_DIGEST_LIST_STAMP.as_of), 'stamp as_of is not a commit abbreviations');
  for (const h of KERNEL_DIGEST_HEXES) assert(HEX64.test(h), 'non-hex entry in snapshot');
});

test('C4: snapshot list is sorted and duplicate-free', () => {
  const sorted = [...KERNEL_DIGEST_HEXES].sort();
  deepStrictEqual(KERNEL_DIGEST_HEXES, sorted, 'list not sorted');
  assert(new Set(KERNEL_DIGEST_HEXES).size === KERNEL_DIGEST_HEXES.length, 'duplicate entries');
});

// ---- Leg D: embedded examples equal the tracked fixtures ---------------------

const EXAMPLE_SOURCES = {
  verified: 'pos-01-csv-cell-row-key.json',
  external: 'pos-09-no-document-external.json',
  failed: 'neg-09-wrong-document-digest.json',
};
for (const key of Object.keys(EXAMPLE_SOURCES)) {
  test('D: embedded example "' + key + '" deep-equals ' + EXAMPLE_SOURCES[key], () => {
    const tracked = JSON.parse(readFileSync(join(FIXTURES, EXAMPLE_SOURCES[key]), 'utf8'));
    assert(TIEOUT_EXAMPLES && TIEOUT_EXAMPLES[key], 'embedded examples missing key ' + key);
    deepStrictEqual(TIEOUT_EXAMPLES[key], tracked, 'embedded example drifted from the tracked fixture');
  });
}

test('D: embedded examples cover exactly the three states', () => {
  deepStrictEqual(Object.keys(TIEOUT_EXAMPLES).sort(), ['external', 'failed', 'verified'], 'unexpected example keys');
  assert(TIEOUT_EXAMPLES.verified.expect.verifiable === 'verified', 'verified example does not expect verified');
  assert(TIEOUT_EXAMPLES.external.expect.verifiable === 'external', 'external example does not expect external');
  assert(TIEOUT_EXAMPLES.failed.expect.verifiable === 'failed', 'failed example does not expect failed');
});

// ---- cleanup ------------------------------------------------------------------

rmSync(TMP, { recursive: true, force: true });

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
