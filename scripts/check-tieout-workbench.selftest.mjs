#!/usr/bin/env node
// check-tieout-workbench.selftest.mjs - TIEOUT-WORKBENCH-1: proves the workbench
// page (tools/848-tieout-workbench.html) is honest on three fronts.
//
//   Leg A  page shape: composition sentinels in order, verbatim CSV bundle (byte-equal
//          to chaingraph/kernels/_csv.bundle.mjs), required ids, the exact PII banner,
//          the mandated legend wording ("this does not show the document is accurate",
//          "bound to this document at this location"), forbidden claims absent, no
//          innerHTML anywhere, connect-src 'none'.
//   Leg B  verdict parity: the page's OWN inlined checker port, extracted into a module,
//          must return reports deep-equal to scripts/check-document-span.mjs (the
//          reference checker) over all 48 shipped fixtures - port called with its
//          embedded digest snapshot, reference with the live registry listing. A red
//          control disarms the port's row-key uniqueness guard and must be caught.
//   Leg C  snapshot freshness: the embedded kernel digest list is a subset of the live
//          registry/kernel directory (never invents entries), holds >= 700 entries, is
//          sorted and unique, the stamp count agrees, and the page's pinned extractor
//          digest is in the live list.
//   Leg D  authoring: the page's buildSpans, fed specs derived from the shipped
//          fixtures, rebuilds every doc-bearing positive record byte-equal to the
//          fixture record and reaches the fixture's expected verdict; a table of
//          authoring-negative mutations refuses with the right reason codes.
//   Leg E  embedded example: the page's TIEOUT_EXAMPLE document and mapping fields
//          equal the pos-01 fixture it was emitted from.
//
// Deliberately NOT registered in scripts/preflight.mjs GATES (same doctrine as the
// tie-out block's checker: scripts/check-tieout-block.selftest.mjs, header). The page
// carries no node manifest, no kernel and no vendor step, so no mutation tier applies;
// this file is the row's named selftest and runs standalone:
//
//   node scripts/check-tieout-workbench.selftest.mjs
//
// Run from the worktree via an absolute path is fine: every path is resolved from
// this file's own location.

import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deepStrictEqual, ok, match } from 'node:assert';

const HERE = dirname(fileURLToPath(import.meta.url));
const WT = resolve(HERE, '..');
const PAGE = join(WT, 'tools', '848-tieout-workbench.html');
const FIXDIR = join(WT, 'chaingraph', 'standard', 'fixtures', 'document-span');
const REGDIR = join(WT, 'registry', 'kernel');
const BUNDLE = join(WT, 'chaingraph', 'kernels', '_csv.bundle.mjs');

const { verifyDocumentSpan: refVerify, loadPublishedDigestHexes } = await import(pathToFileURL(join(HERE, 'check-document-span.mjs')).href);

const page = readFileSync(PAGE, 'utf8');
const failures = [];
const leg = (name, cond, detail) => { if (!cond) failures.push(`${name}${detail ? ': ' + detail : ''}`); };

// ---- extract the inlined blocks ----------------------------------------------

function between(from, to, label) {
  const a = page.indexOf(from);
  const b = to === undefined ? -1 : page.indexOf(to, a);
  leg('extract ' + label, a >= 0 && b > a, `markers ${from}/${to}`);
  return a >= 0 && b > a ? page.slice(a, b + to.length) : '';
}
const csvBegin = page.indexOf('BEGIN chaingraph/kernels/_csv.bundle.mjs');
const csvA = page.indexOf('const _csv = (function () {', csvBegin);
const csvB = page.indexOf('})();', csvA) + '})();'.length;
const csvCopy = csvA >= 0 ? page.slice(csvA, csvB) : '';
const snapshotBlock = between('/* __TIEOUT_SNAPSHOT_BEGIN', '__TIEOUT_SNAPSHOT_END */', 'snapshot');
const checkerBlock = between('/* __TIEOUT_CHECKER_BEGIN', '__TIEOUT_CHECKER_END */', 'checker');
const buildBlock = between('/* __TIEOUT_BUILD_BEGIN', '__TIEOUT_BUILD_END */', 'build');

// ---- build the page-port module (csv + snapshot + checker + build, with jcs) --

const tmpMod = join(WT, '.tmp', `wb-port-${process.pid}.mjs`);
const modText = [
  `import { jcsStringify as __ocgJcs } from '../chaingraph/kernels/_hash.mjs';`,
  csvCopy,
  snapshotBlock,
  checkerBlock,
  buildBlock,
  `export { verifyDocumentSpan as portVerify, checkRecordShape as portShape, normalize as portNormalize, resolveJsonPointer as portResolve, buildSpans as portBuildSpans, KERNEL_DIGEST_LIST_STAMP, KERNEL_DIGEST_HEXES, TIEOUT_EXAMPLE, TIEOUT_EXTRACTOR_TOOL_ID, TIEOUT_EXTRACTOR_DIGEST };`,
  '',
].join('\n');
writeFileSync(tmpMod, modText, 'utf8');
let port = null;
try {
  port = await import(pathToFileURL(tmpMod).href);
} finally {
  rmSync(tmpMod, { force: true });
}

// ---- fixtures ------------------------------------------------------------------

const fixNames = readdirSync(FIXDIR).filter((n) => n.endsWith('.json')).sort();
leg('fixture count is 48', fixNames.length === 48, String(fixNames.length));
const fixtures = fixNames.map((n) => ({ name: n, ...JSON.parse(readFileSync(join(FIXDIR, n), 'utf8')) }));
const registry = loadPublishedDigestHexes();
const registryHexes = [...registry].sort();
leg('live registry >= 700', registry.size >= 700, String(registry.size));

// ---- Leg A: page shape -----------------------------------------------------------

{
  const order = [
    ['csv', csvA], ['snapshot', page.indexOf('__TIEOUT_SNAPSHOT_BEGIN')],
    ['checker', page.indexOf('__TIEOUT_CHECKER_BEGIN')], ['build', page.indexOf('__TIEOUT_BUILD_BEGIN')],
  ];
  leg('block order csv<snapshot<checker<build', order[0][1] < order[1][1] && order[1][1] < order[2][1] && order[2][1] < order[3][1]);

  // verbatim bundle binding: the page copy is byte-equal to the repo bundle's IIFE.
  const bundleSrc = readFileSync(BUNDLE, 'utf8');
  const bA = bundleSrc.indexOf('const _csv = (function () {');
  const bB = bundleSrc.indexOf('})();', bA) + '})();'.length;
  leg('csv IIFE byte-equal to repo bundle', csvCopy === bundleSrc.slice(bA, bB));

  const PII = '🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.';
  leg('exact PII banner present', page.includes(PII));
  leg('legend carries the mandated sentence', page.includes('this does not show the document is accurate'));
  leg('legend carries the binding phrasing', page.includes('bound to this document at this location'));
  leg('connect-src none', page.includes("connect-src 'none'"));
  leg('no innerHTML anywhere', !page.includes('innerHTML'));
  for (const banned of ['verified source', 'authentic', 'attested by the bank', 'proves the document is', 'proves the document was']) {
    leg(`forbidden phrase absent: ${banned}`, !page.toLowerCase().includes(banned));
  }
  const ids = ['docDropZone', 'docFileInput', 'docMeta', 'docEntropyWarn', 'docParseStatus', 'dataPreview', 'selReadout',
    'mapPointer', 'mapNorm', 'mapCurrentValue', 'mapRowKeyColumn', 'addSpanBtn', 'batchWrap', 'spansExportBtn',
    'clearBatchBtn', 'loadExampleBtn', 'tieoutLegend', 'outputSection', 'mfstBody', 'mfstCode', 'extractorPin', 'digestStamp'];
  for (const id of ids) leg(`id present: ${id}`, page.includes(`id="${id}"`));
  leg('mfst button wired', page.includes('class="mfst-btn"') && page.includes('function toggleMfst()'));
  leg('export row present', page.includes('results-export-row'));
  leg('manifest tool matches page', /"tool_id":\s*"848-tieout-workbench"/.test(readFileSync(join(WT, 'manifests', '848-tieout-workbench.manifest.json'), 'utf8')));
}

// ---- Leg B: verdict parity over all 48 fixtures -----------------------------------

{
  let mismatches = 0;
  for (const fx of fixtures) {
    const opts = {
      documentText: typeof fx.document === 'string' ? fx.document : undefined,
      policyParameters: fx.policy_parameters,
    };
    const refReport = await refVerify(fx.record, { ...opts, digestHexes: registry });
    const portReport = await port.portVerify(fx.record, opts); // embedded snapshot is the default
    try {
      deepStrictEqual(portReport, refReport);
    } catch (e) {
      mismatches++;
      failures.push(`Leg B parity: ${fx.name} differs\n${e.message}`);
      continue;
    }
    // and the verdict is what the fixture expects (proves BOTH sides agree on the truth)
    leg(`${fx.name} expect.verifiable`, refReport.verifiable === fx.expect.verifiable,
      `got ${refReport.verifiable}`);
    leg(`${fx.name} expect.reason_code`, refReport.reason_code === fx.expect.reason_code,
      `got ${refReport.reason_code}`);
    leg(`${fx.name} expect.structural`, refReport.structural === fx.expect.structural,
      `got ${refReport.structural}`);
  }
  leg('Leg B ran all fixtures', fixtures.length === 48 && mismatches === 0, `${mismatches} mismatch(es)`);

  // RED control: disarm the port's row-key uniqueness guard; the repeated-key and
  // reorder fixtures must then diverge from the reference (proves the parity leg fails).
  const tamperedText = modText.replace('if (rowKeyOccurrences > 1)', 'if (rowKeyOccurrences > 99999)');
  leg('red control found its mutation point', tamperedText !== modText);
  const tamperedMod = join(WT, '.tmp', `wb-port-broken-${process.pid}.mjs`);
  writeFileSync(tamperedMod, tamperedText, 'utf8');
  try {
    const broken = await import(pathToFileURL(tamperedMod).href);
    let caught = 0;
    for (const fx of fixtures) {
      if (typeof fx.document !== 'string') continue;
      const opts = { documentText: fx.document, policyParameters: fx.policy_parameters };
      const refReport = await refVerify(fx.record, { ...opts, digestHexes: registry });
      const badReport = await broken.portVerify(fx.record, opts);
      try { deepStrictEqual(badReport, refReport); } catch { caught++; }
    }
    leg('red control caught: disarmed guard diverges', caught >= 1, `diverged on ${caught} fixture(s) (neg-02 is the expected diverger)`);
  } finally {
    rmSync(tamperedMod, { force: true });
  }
}

// ---- Leg C: snapshot freshness ------------------------------------------------------

{
  const stamp = port.KERNEL_DIGEST_LIST_STAMP;
  const pageHexes = port.KERNEL_DIGEST_HEXES;
  leg('snapshot is an array', Array.isArray(pageHexes) && pageHexes.length >= 700, String(pageHexes && pageHexes.length));
  leg('snapshot sorted unique', pageHexes.every((h, i) => /^[0-9a-f]{64}$/.test(h) && (i === 0 || pageHexes[i - 1] < h)));
  leg('snapshot never invents (subset of live)', pageHexes.every((h) => registry.has(h)),
    pageHexes.filter((h) => !registry.has(h)).slice(0, 3).join(','));
  leg('stamp count agrees', stamp.count === pageHexes.length, `${stamp.count} vs ${pageHexes.length}`);
  leg('stamp names the registry source', stamp.source === 'registry/kernel');
  leg('pinned extractor digest is live', registry.has(port.TIEOUT_EXTRACTOR_DIGEST.slice('sha256:'.length)),
    port.TIEOUT_EXTRACTOR_DIGEST);
  leg('pinned extractor id is a valid tool id', /^art-[0-9]+-[a-z0-9-]+$/.test(port.TIEOUT_EXTRACTOR_TOOL_ID),
    port.TIEOUT_EXTRACTOR_TOOL_ID);
}

// ---- Leg D: authoring via the page's buildSpans --------------------------------------

{
  const resolvePtr = (ptr, doc) => {
    if (ptr === '') return doc;
    let cur = doc;
    for (const raw of ptr.split('/').slice(1)) {
      const tok = raw.replace(/~1/g, '/').replace(/~0/g, '~');
      if (cur === null || typeof cur !== 'object' || !Object.hasOwn(cur, tok)) return undefined;
      cur = cur[tok];
    }
    return cur;
  };

  // every doc-bearing positive rebuilds byte-equal to the fixture record
  let authored = 0;
  for (const fx of fixtures) {
    if (!fx.name.startsWith('pos-')) continue;
    if (typeof fx.document !== 'string') continue; // pos-09: the page always holds the document, so this one is not authoring-reachable (covered in Leg B)
    authored++;
    const locator = { ...fx.record.proof.locator };
    const spec = {
      source_ref: fx.record.source_ref,
      media_type: fx.record.proof.document.media_type,
      document_text: fx.document,
      pointer: fx.record.pointer,
      normalization: fx.record.proof.normalization,
      locator,
    };
    const rk = locator.row_key;
    delete locator.row_key;
    if (rk) spec.row_key = rk;
    if (fx.policy_parameters !== undefined) {
      const v = resolvePtr(fx.record.pointer, fx.policy_parameters);
      if (v !== undefined) spec.current_value = String(v);
    }
    const res = await port.portBuildSpans(spec);
    leg(`${fx.name} authored without refusal`, res.refused.length === 0, JSON.stringify(res.refused));
    leg(`${fx.name} authored exactly one record`, res.records.length === 1, String(res.records.length));
    if (res.records.length === 1) {
      try { deepStrictEqual(res.records[0], fx.record); } catch (e) { failures.push(`Leg D rebuild: ${fx.name} record differs\n${e.message}`); }
    }
    if (res.reports.length === 1) {
      leg(`${fx.name} authored verdict`, res.reports[0].verifiable === fx.expect.verifiable && res.reports[0].reason_code === fx.expect.reason_code,
        `got ${res.reports[0].verifiable}/${res.reports[0].reason_code}`);
    }
  }
  leg('authored the doc-bearing positives', authored === 8, String(authored));

  // unicode document: the page's digest and byte counter must match node's
  {
    const uniText = 'name,balance,note\nAmélie OP-1,700,café latte fund\r\nZoë OP-2,300,€ reserved as text\r\n';
    const spec = {
      source_ref: 'unicode-example.csv',
      media_type: 'text/csv',
      document_text: uniText,
      pointer: '/opening_balance',
      normalization: 'integer-plain',
      locator: { scheme: 'csv-rfc4180-cell', record: 1, column: 1, header: 'balance' },
      row_key: { column: 'name', value: 'Zoë OP-2' },
      current_value: '300',
    };
    const res = await port.portBuildSpans(spec);
    leg('unicode: no refusal', res.refused.length === 0, JSON.stringify(res.refused));
    if (res.records.length === 1) {
      const rec = res.records[0];
      leg('unicode: sha256 matches node crypto',
        rec.proof.document.sha256 === createHash('sha256').update(uniText, 'utf8').digest('hex'));
      leg('unicode: byte count matches node', rec.proof.document.bytes === Buffer.byteLength(uniText, 'utf8'));
      leg('unicode: verdict verified', res.reports[0].verifiable === 'verified', res.reports[0].reason_code);
    }
  }

  // authoring negatives: mutations of the pos-01 spec must refuse with the right codes
  const pos01 = fixtures.find((f) => f.name.startsWith('pos-01'));
  const baseSpec = () => {
    const locator = { ...pos01.record.proof.locator };
    const spec = {
      source_ref: pos01.record.source_ref,
      media_type: pos01.record.proof.document.media_type,
      document_text: pos01.document,
      pointer: pos01.record.pointer,
      normalization: pos01.record.proof.normalization,
      locator,
      row_key: { ...locator.row_key },
    };
    delete locator.row_key;
    spec.current_value = String(resolvePtr(pos01.record.pointer, pos01.policy_parameters));
    return spec;
  };
  const cases = [
    ['RECORD_SHAPE_SOURCE_REF', (s) => { s.source_ref = 'evidence/bank-statement.csv'; }],
    ['RECORD_SHAPE_SOURCE_REF', (s) => { s.source_ref = 'bank-statement.csv.bak\\old'; }],
    ['RECORD_SHAPE_MEDIA_TYPE', (s) => { s.media_type = 'text/plain'; }],
    ['RECORD_SHAPE_NORMALIZATION', (s) => { s.normalization = 'decimal-with-grouping'; }],
    ['RECORD_SHAPE_POINTER', (s) => { s.pointer = 'cash_balance'; }],
    ['RECORD_SHAPE_LOCATOR_SCHEME', (s) => { s.locator = {}; }],
    ['RECORD_SHAPE_LOCATOR_RECORD', (s) => { s.locator.record = '1'; }],
    ['RECORD_SHAPE_ROW_KEY_VALUE', (s) => { s.row_key.value = 900; }],
    ['ROW_KEY_COLUMN_NOT_IN_HEADER', (s) => { s.row_key.column = 'nope'; }],
    ['HEADER_NAME_MISMATCH', (s) => { s.locator.header = 'Cash'; }],
    ['CELL_OUT_OF_RANGE', (s) => { s.locator.record = 99; }],
    ['CSV_PARSE_REFUSED', (s) => { s.document_text = 'name,balance\n"unclosed,900\n'; }],
    ['REFUSED_DECIMAL_GRAMMAR', (s) => { s.normalization = 'decimal-plain'; s.document_text = s.document_text.replace(/\b900\b/, '"1,234"'); }],
    ['REFUSED_DATE_NOT_CALENDAR', (s) => { s.normalization = 'date-iso'; s.document_text = s.document_text.replace(/\b900\b/, '2026-02-30'); s.current_value = '2026-02-30'; }],
    ['RECORD_SHAPE_NOT_AN_OBJECT', () => 'not-a-spec'],
  ];
  for (const [wantCode, mutate] of cases) {
    const fresh = baseSpec();
    const spec = mutate(fresh) || fresh;
    const res = await port.portBuildSpans(spec);
    const got = res.refused.length > 0 ? res.refused[0].reason_code
      : (res.reports.length > 0 ? `report:${res.reports[0].reason_code}` : 'no-output');
    leg(`negative ${wantCode}`, got === wantCode, `got ${got}`);
    if (res.refused.length > 0) leg(`negative ${wantCode} made no record`, res.records.length === 0);
  }

  // commitment + step-4 mismatch surface through the report, not the refusal list
  {
    const commitment = 'sha256:' + 'a'.repeat(64);
    let spec = baseSpec(); spec.current_value = commitment;
    let res = await port.portBuildSpans(spec);
    leg('commitment refused in report', res.refused.length === 0 && res.reports.length === 1 && res.reports[0].reason_code === 'PRIVATE_INPUT_COMMITMENT_REFUSED',
      res.reports[0] ? res.reports[0].reason_code : JSON.stringify(res.refused));
    spec = baseSpec(); spec.current_value = '901';
    res = await port.portBuildSpans(spec);
    leg('step-4 mismatch surfaces', res.reports.length === 1 && res.reports[0].verifiable === 'failed' && res.reports[0].reason_code === 'STEP4_DIGEST_MISMATCH',
      res.reports[0] ? `${res.reports[0].verifiable}/${res.reports[0].reason_code}` : 'none');
  }
}

// ---- Leg E: embedded example equals the pos-01 fixture ---------------------------------

{
  const ex = port.TIEOUT_EXAMPLE;
  const pos01 = fixtures.find((f) => f.name.startsWith('pos-01'));
  leg('example document equals pos-01 document', ex.document === pos01.document);
  leg('example source_ref equals pos-01', ex.source_ref === pos01.record.source_ref, ex.source_ref);
  leg('example pointer equals pos-01', ex.pointer === pos01.record.pointer, ex.pointer);
  leg('example normalization equals pos-01', ex.normalization === pos01.record.proof.normalization, ex.normalization);
  leg('example row_key column equals pos-01', ex.row_key_column === pos01.record.proof.locator.row_key.column, ex.row_key_column);
  leg('example cell equals pos-01 locator', ex.record === pos01.record.proof.locator.record && ex.column === pos01.record.proof.locator.column,
    `(${ex.record},${ex.column})`);
  const wantValue = pos01.policy_parameters[pos01.record.pointer.split('/').filter(Boolean)[0]];
  leg('example current value equals pos-01 policy value', ex.current_value === wantValue, String(ex.current_value));
}

// ---- verdict ------------------------------------------------------------------------------

if (failures.length) {
  console.error(`FAIL ${failures.length} check(s):`);
  console.error(failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`TIEOUT-WORKBENCH-1 selftest OK: page shape, 48/48 verdict parity (+ red control), snapshot subset of ${registry.size} live digests, ${8} positives rebuilt byte-equal, ${15} authoring negatives refused, example equals pos-01.`);
