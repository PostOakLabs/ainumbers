// XLR-2 unit fixtures: identical values -> match; a perturbed cell -> mismatch
// naming that cell's ref/expected/observed; formula-injection paste ->
// sanitized in the receipt; zero-new-engine-code call-site proof.
// Zero-dep: run directly with `node chaingraph/workbook/roundtrip-verify.test.mjs`.

import { csvToWorkbook, fullRangeRef, rangeDigest, csvDigest } from './workbook.mjs';
import { verifyRoundtrip } from './roundtrip-verify.mjs';
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const eq = (actual, expected, msg) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${msg} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);

console.log('— XLR-2: round-trip comparator —\n');

// Build a WB-2 manifest whose ranges[].values_digest is computed by the SAME
// rangeDigest() the comparator calls -- so the "match" case is correct by
// construction, not a hand-typed hash.
async function manifestFor(csvText, ref, sourceCsvDigest) {
  const wb = csvToWorkbook(csvText);
  const fullRange = fullRangeRef(wb);
  return {
    manifest_type: 'spreadsheet-input-manifest',
    source: { filename: 'line-items.csv', csv_digest: sourceCsvDigest },
    ranges: [{ ref, values_digest: await rangeDigest(wb, fullRange), semantics: 'unit fixture' }],
    produced_by: 'roundtrip-verify.test.mjs fixture',
    produced_at: '2026-08-03T00:00:00Z',
  };
}

// ── 1. call-site proof: comparator reuses workbook.mjs's parser + digest ───
{
  ok(typeof verifyRoundtrip === 'function', 'verifyRoundtrip is exported');
  const text = readFileSync(join(HERE, 'roundtrip-verify.mjs'), 'utf8');
  ok(text.includes("from './workbook.mjs'") && /csvToWorkbook|rangeDigest|rangeValuesMatrix|fullRangeRef|expandRange/.test(text), 'imports workbook.mjs symbols (parser + digest reuse)');
  ok(!/function\s+parseCSV|function\s+tokenize|new RegExp\(.*QUOTED/i.test(text), 'no second CSV parser hand-rolled in this module');
  ok(!/from '\.\.\/kernels\/_hash\.mjs'/.test(text), 'does not import _hash.mjs directly -- digests flow only through workbook.mjs\'s rangeDigest');
}

// ── 2. identical values -> match ────────────────────────────────────────────
{
  const csv = '10,widget\r\n20,gadget\r\n';
  const manifest = await manifestFor(csv, 'A1:B2', 'src-digest-1');
  const receipt = await verifyRoundtrip(manifest, { 'A1:B2': csv }, { producedBy: 'test', producedAt: '2026-08-03T01:00:00Z' });
  eq(receipt.receipt_type, 'workbook-roundtrip-receipt', 'receipt_type is set');
  eq(receipt.manifest_ref, 'src-digest-1', 'manifest_ref echoes manifest.source.csv_digest');
  eq(receipt.result, 'match', 'identical pasted values -> result "match"');
  eq(receipt.mismatches, [], 'match receipt has empty mismatches[]');
  eq(receipt.expected.ranges[0].values_digest, receipt.observed.ranges[0].values_digest, 'expected/observed digests are equal on match');
  eq(receipt.expected.source, 'manifest', 'expected.source defaults to "manifest" when no expectedByRef supplied');
  eq(receipt.observed.source, 'excel-paste', 'observed.source is "excel-paste"');
}

// ── 3. a perturbed cell -> mismatch naming that cell's ref/expected/observed ─
{
  const expectedCsv = '10,widget\r\n20,gadget\r\n';
  const observedCsv = '10,widget\r\n25,gadget\r\n'; // A2 perturbed 20 -> 25
  const manifest = await manifestFor(expectedCsv, 'A1:B2', 'src-digest-2');
  const receipt = await verifyRoundtrip(
    manifest,
    { 'A1:B2': observedCsv },
    { expectedByRef: { 'A1:B2': expectedCsv }, producedBy: 'test', producedAt: '2026-08-03T02:00:00Z' },
  );
  eq(receipt.result, 'mismatch', 'a perturbed cell -> result "mismatch"');
  eq(receipt.mismatches.length, 1, 'exactly one cell differs -> one mismatches[] entry');
  eq(receipt.mismatches[0].ref, 'A2', 'mismatch entry names the diverging cell A2');
  eq(receipt.mismatches[0].expected_value, 20, 'mismatch entry carries the expected value');
  eq(receipt.mismatches[0].observed_value, 25, 'mismatch entry carries the observed value');
  eq(receipt.expected.source, 'pq-export', 'expected.source is "pq-export" when expectedByRef is supplied');
  ok(receipt.expected.ranges[0].values_digest !== receipt.observed.ranges[0].values_digest, 'expected/observed digests differ on mismatch');
}

// ── 4. digest-only expected (no expectedByRef) -> range-level mismatch ─────
{
  const expectedCsv = '10,widget\r\n20,gadget\r\n';
  const observedCsv = '10,widget\r\n25,gadget\r\n';
  const manifest = await manifestFor(expectedCsv, 'A1:B2', 'src-digest-3');
  const receipt = await verifyRoundtrip(manifest, { 'A1:B2': observedCsv }, { producedBy: 'test', producedAt: '2026-08-03T03:00:00Z' });
  eq(receipt.result, 'mismatch', 'digest-only expected still detects a mismatch');
  eq(receipt.mismatches.length, 1, 'no raw expected values available -> one range-level mismatch entry');
  eq(receipt.mismatches[0].ref, 'A1:B2', 'range-level mismatch entry names the whole range, not a single cell');
}

// ── 5. finite-gate: malformed pasted CSV is rejected, never repaired ───────
{
  const manifest = await manifestFor('10,widget\r\n', 'A1:B1', 'src-digest-4');
  let threw = false, code = null;
  try { await verifyRoundtrip(manifest, { 'A1:B1': 'a"b,c' }, { producedBy: 'test', producedAt: '2026-08-03T04:00:00Z' }); }
  catch (e) { threw = true; code = e.code; }
  ok(threw && code === '#PARSE!', 'malformed pasted CSV is rejected (#PARSE!), not silently repaired');
}

// ── 6. CSV-injection: a formula-injection paste is sanitized in the receipt ─
// (A leading "=" is consumed by the workbook engine's own formula parser --
// that's correct spreadsheet-paste semantics, not the vulnerability this rule
// targets. The OWASP CSV-injection risk this row calls out is a benign-to-us
// literal that is STILL a live formula trigger the moment Excel re-imports
// it: "+", "-", "@". "+1+1" is exactly that shape.)
{
  const expectedCsv = '10,widget\r\n';
  const observedCsv = '+1+1,widget\r\n'; // A1 perturbed to a formula-injection payload
  const manifest = await manifestFor(expectedCsv, 'A1:B1', 'src-digest-5');
  const receipt = await verifyRoundtrip(
    manifest,
    { 'A1:B1': observedCsv },
    { expectedByRef: { 'A1:B1': expectedCsv }, producedBy: 'test', producedAt: '2026-08-03T05:00:00Z' },
  );
  eq(receipt.result, 'mismatch', 'a formula-injection paste diverges from the expected value -> mismatch');
  const cell = receipt.mismatches.find((m) => m.ref === 'A1');
  ok(!!cell, 'the A1 mismatch entry is present');
  eq(cell.observed_value, "'+1+1", 'formula-injection observed value is prefixed with a single quote before entering the receipt (OWASP CSV-injection mitigation)');
  ok(!String(cell.observed_value).startsWith('+1+1'), 'the raw unsanitized "+1+1" never lands in the receipt as-is');
  eq(cell.expected_value, 10, 'a benign numeric expected value keeps its number type (only injection-risk strings are sanitized)');
}

// ── 7. pure function: no globals -- producedBy/producedAt are mandatory ────
{
  const csv = '1,2\r\n';
  const manifest = await manifestFor(csv, 'A1:B1', 'src-digest-6');
  let threwNoProducedBy = false, threwNoProducedAt = false;
  try { await verifyRoundtrip(manifest, { 'A1:B1': csv }, { producedAt: '2026-08-03T06:00:00Z' }); } catch { threwNoProducedBy = true; }
  try { await verifyRoundtrip(manifest, { 'A1:B1': csv }, { producedBy: 'test' }); } catch { threwNoProducedAt = true; }
  ok(threwNoProducedBy, 'producedBy has no default -- omitting it throws rather than reading a global identity');
  ok(threwNoProducedAt, 'producedAt has no default -- omitting it throws rather than reading Date.now()/new Date()');
}

// ── 8. shape mismatch between manifest range and pasted text is rejected ───
{
  const manifest = await manifestFor('10,widget\r\n20,gadget\r\n', 'A1:B2', 'src-digest-7');
  let threw = false;
  try { await verifyRoundtrip(manifest, { 'A1:B2': '10,widget\r\n' }, { producedBy: 'test', producedAt: '2026-08-03T07:00:00Z' }); }
  catch { threw = true; }
  ok(threw, 'a pasted range whose shape does not match the manifest range is rejected');
}

// ── 9. schema conformance: a produced receipt validates against XLR-1's schema
{
  const expectedCsv = '10,widget\r\n20,gadget\r\n';
  const observedCsv = '10,widget\r\n25,gadget\r\n';
  const manifest = await manifestFor(expectedCsv, 'A1:B2', await csvDigest(expectedCsv));
  const receipt = await verifyRoundtrip(
    manifest,
    { 'A1:B2': observedCsv },
    { expectedByRef: { 'A1:B2': expectedCsv }, producedBy: 'test', producedAt: '2026-08-03T08:00:00Z' },
  );
  const dir = mkdtempSync(join(tmpdir(), 'xlr2-'));
  const file = join(dir, 'receipt.json');
  writeFileSync(file, JSON.stringify(receipt, null, 2));
  let out = '';
  let validatorOk = false;
  try {
    out = execFileSync('node', [join(HERE, 'validate-roundtrip-receipt.mjs'), file], { encoding: 'utf8' });
    validatorOk = true;
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  rmSync(dir, { recursive: true, force: true });
  ok(validatorOk, `a produced mismatch receipt validates against roundtrip-receipt.schema.json via validate-roundtrip-receipt.mjs\n${out}`);
}

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
