// xbrl-csv-fixtures.test.mjs — §13.14 xBRL-CSV export profile GATE (SPEC.md §15, v0.8.13).
// This profile ships fixture-only (no exporter yet — see SPEC.md §13.14 fence), sibling to
// §13.13's xbrl-json-fixtures.test.mjs. Asserts the properties §13.14.6 names against the three
// committed fixtures:
//   (a) JSON metadata part round-trip determinism (re-canonicalizing twice is byte-identical, and
//       the fixture on disk is already in canonical JCS key order);
//   (b) CSV data part determinism — rows sorted ascending by the declared row-id column, re-sort
//       is a no-op;
//   (c) every tableTemplates column that names a concept resolves to a REAL ocg-ext concept
//       (cross-checked against exporters/xbrl.mjs's own taxonomy — no second, driftable copy),
//       never a fabricated one;
//   (d) the Annex 2 EBA DPM 2.0 scaffold has entry_point_schemaRef / ns.uri / every eba_qname
//       all null, and a simulated build against it throws a "pending" error rather than emitting
//       a fact (mirrors exporters/xbrl.mjs buildCorep()'s guard).
// Node 18+. Run: node chaingraph/exporters/xbrl-csv-fixtures.test.mjs
//
// XBRLCSV-EXPORTER-1 (2026-07-26) added a live exporter (exporters/xbrl-csv.mjs) — the block
// below the fixture checks now runs the SAME §13.14.6 properties against its actual output,
// not just the committed fixtures, plus a ZIP-structural check and the Annex 2 pending guard
// via the real exporter (not a simulation). See research/XBRLCSV-EXPORTER-1-2026-07-26.md for
// what remains unverified (no offline OIM/xBRL-CSV certified validator — §13.14.4 is EXTERNAL by
// design; this repo is zero-dep and does not vendor one).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cgCanon } from '../kernels/_hash.mjs';
import { OCG_EXT_NAMESPACE_URI, OCG_EXT_CONCEPT_NAMES } from './xbrl.mjs';
import { buildXbrlCsv } from './xbrl-csv.mjs';
import { buildArtifact } from '../kernels/art-35-tempo-payments-business-case.kernel.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = join(HERE, 'fixtures', 'xbrl-csv');

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

function loadJson(name) {
  const raw = readFileSync(join(FIXDIR, name), 'utf8');
  return { raw, doc: JSON.parse(raw) };
}

// Minimal RFC 4180 split — fixture has no quoted/escaped fields.
function parseCsv(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((l) => l.split(','));
  return { header, rows };
}

console.log('§13.14 xBRL-CSV export profile — fixture gate\n');

console.log('sample.metadata.json:');
let rowIdColumn, templateColumns, ocgExtPrefix;
{
  const { raw, doc } = loadJson('sample.metadata.json');
  const once = JSON.stringify(cgCanon(doc));
  const twice = JSON.stringify(cgCanon(JSON.parse(once)));
  ok(once === twice, 'sample.metadata.json: re-canonicalizing twice is byte-identical');
  ok(JSON.stringify(cgCanon(doc)) === JSON.stringify(doc), 'sample.metadata.json: fixture on disk is already in canonical (JCS) key order');
  ok(doc.documentInfo?.features?.['xbrl:canonicalValues'] === true, 'sample.metadata.json: documentInfo.features["xbrl:canonicalValues"] === true');
  ok(typeof doc.documentInfo?.['ocg:metadata']?.execution_hash === 'string' &&
     doc.documentInfo['ocg:metadata'].execution_hash.startsWith('sha256:'),
     'sample.metadata.json: execution_hash embedded in documentInfo metadata, sha256:-prefixed');
  ok(doc.documentInfo?.['ocg:metadata']?.chaingraph_version === '0.4.0',
     'sample.metadata.json: chaingraph_version stays 0.4.0 (export mints no envelope change)');

  const tableNames = Object.keys(doc.tables ?? {});
  ok(tableNames.length > 0, 'sample.metadata.json: has at least one table');
  const table = doc.tables[tableNames[0]];
  rowIdColumn = table?.rowIdColumn;
  ok(typeof rowIdColumn === 'string' && rowIdColumn.length > 0, 'sample.metadata.json: table declares a rowIdColumn (§13.14.1 sort key)');
  templateColumns = doc.tableTemplates?.[table?.template]?.columns;
  ok(templateColumns && Object.keys(templateColumns).length > 0, 'sample.metadata.json: referenced tableTemplate has columns');

  const namespaces = doc.documentInfo?.namespaces ?? {};
  ocgExtPrefix = Object.keys(namespaces).find((p) => namespaces[p] === OCG_EXT_NAMESPACE_URI);
  ok(typeof ocgExtPrefix === 'string', 'sample.metadata.json: documentInfo.namespaces binds a prefix to the real ocg-ext namespace URI (exporters/xbrl.mjs)');
}

console.log('\nsample.data.csv:');
{
  const raw = readFileSync(join(FIXDIR, 'sample.data.csv'), 'utf8');
  const { header, rows } = parseCsv(raw);
  ok(rows.length > 0, 'sample.data.csv: has at least one data row');
  ok(header.every((h) => templateColumns[h]), 'sample.data.csv: every CSV header column is declared in the tableTemplate');

  const idIdx = header.indexOf(rowIdColumn);
  ok(idIdx >= 0, `sample.data.csv: header includes the declared row-id column "${rowIdColumn}"`);
  const ids = rows.map((r) => r[idIdx]);
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  ok(JSON.stringify(ids) === JSON.stringify(sorted), 'sample.data.csv: rows sorted ascending by the declared row-id column');

  const conceptIdx = header.indexOf('concept');
  if (conceptIdx >= 0) {
    for (const r of rows) {
      const c = r[conceptIdx];
      const [prefix, local] = c.split(':');
      ok(prefix === ocgExtPrefix && OCG_EXT_CONCEPT_NAMES.includes(local),
        `sample.data.csv: concept "${c}" resolves to a real ocg-ext taxonomy concept (exporters/xbrl.mjs), not a placeholder`);
    }
  }
}

console.log('\nannex2-eba-dpm-corep.pending.json:');
{
  const { doc } = loadJson('annex2-eba-dpm-corep.pending.json');
  ok(doc.entry_point_schemaRef === null, 'annex2: entry_point_schemaRef is null (unpopulated — §13.14.5)');
  ok(doc.ns?.uri === null, 'annex2: ns.uri is null (unpopulated)');
  ok(Array.isArray(doc.fields) && doc.fields.length > 0, 'annex2: has at least one scaffold field');
  ok(doc.fields.every((f) => f.eba_qname === null), 'annex2: every field eba_qname is null — no fabricated concept');

  // Simulate the same guard buildCorep() applies in exporters/xbrl.mjs (§13.8) — this fixture
  // MUST hit the "pending" branch, never the "activated" branch, until populated.
  const ready = doc.entry_point_schemaRef && doc.ns?.uri && doc.fields.some((f) => f.eba_qname);
  let threw = false;
  try {
    if (!ready) throw new Error(`EBA DPM 2.0 Annex 2: concept map not populated (entry_point_schemaRef / ns.uri / eba_qname are null).`);
  } catch { threw = true; }
  ok(threw, 'annex2: a simulated build against the unpopulated scaffold throws "pending", never emits a fact');
}

console.log('\nlive exporter (exporters/xbrl-csv.mjs) — §13.14.6 properties on ACTUAL output, not fixtures:');
{
  const artifact = await buildArtifact(
    { rail: 'swift', stablecoin: 'usdc', tx_amount_usd: 25000, monthly_volume: 800, impl_months: 3 },
    { now: '2026-06-19T00:00:00Z' },
  );

  // Minimal STORE-only ZIP reader (mirrors zip.mjs's writer) — just enough to pull the two
  // parts back out and prove the package is a real, readable ZIP, not a check on our own writer.
  function unzipStore(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const files = {};
    let p = 0;
    while (p < bytes.length && dv.getUint32(p, true) === 0x04034b50) {
      const method = dv.getUint16(p + 8, true);
      const size = dv.getUint32(p + 22, true);
      const nameLen = dv.getUint16(p + 26, true);
      const extraLen = dv.getUint16(p + 28, true);
      const nameStart = p + 30;
      const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLen));
      const dataStart = nameStart + nameLen + extraLen;
      files[name] = { method, data: bytes.slice(dataStart, dataStart + size) };
      p = dataStart + size;
    }
    return files;
  }

  const built = buildXbrlCsv(artifact, 'ocg-ext');
  ok(built.media_type === 'application/zip', 'live export: media_type application/zip');
  ok(built.bytes[0] === 0x50 && built.bytes[1] === 0x4b, 'live export: bytes start with ZIP local-file-header signature (PK)');

  const parts = unzipStore(built.bytes);
  ok(!!parts['metadata.json'] && !!parts['data.csv'], 'live export: ZIP contains metadata.json + data.csv (readable by an independent unzip, not just our own writer)');
  ok(Object.values(parts).every((f) => f.method === 0), 'live export: both parts are STORE (method 0) — no compression to independently re-implement to read them');

  const liveDoc = JSON.parse(new TextDecoder().decode(parts['metadata.json'].data));
  ok(JSON.stringify(cgCanon(liveDoc)) === JSON.stringify(liveDoc), 'live export: metadata.json is byte-identical to its own canonical (JCS) re-serialization (§13.14.1)');
  ok(liveDoc.documentInfo?.features?.['xbrl:canonicalValues'] === true, 'live export: documentInfo.features["xbrl:canonicalValues"] === true');
  ok(typeof liveDoc.documentInfo?.['ocg:metadata']?.execution_hash === 'string' &&
     liveDoc.documentInfo['ocg:metadata'].execution_hash === `sha256:${artifact.execution_hash.replace(/^sha256:/, '')}`,
     'live export: execution_hash embedded matches the source artifact, sha256:-prefixed');
  ok(liveDoc.documentInfo?.['ocg:metadata']?.chaingraph_version === artifact.chaingraph_version,
     'live export: chaingraph_version carried through unchanged (export mints no envelope change)');

  const liveNamespaces = liveDoc.documentInfo?.namespaces ?? {};
  const livePrefix = Object.keys(liveNamespaces).find((p) => liveNamespaces[p] === OCG_EXT_NAMESPACE_URI);
  ok(typeof livePrefix === 'string', 'live export: documentInfo.namespaces binds a prefix to the real ocg-ext namespace URI');

  const liveTableName = Object.keys(liveDoc.tables ?? {})[0];
  const liveTable = liveDoc.tables[liveTableName];
  const liveRowIdCol = liveTable?.rowIdColumn;
  const liveCsv = new TextDecoder().decode(parts['data.csv'].data);
  const liveLines = liveCsv.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
  const liveHeader = liveLines[0].split(',');
  const liveRows = liveLines.slice(1).map((l) => l.split(','));
  ok(liveRows.length > 0, 'live export: data.csv has at least one data row for this real artifact');
  const liveIdIdx = liveHeader.indexOf(liveRowIdCol);
  const liveIds = liveRows.map((r) => r[liveIdIdx]);
  const liveSorted = [...liveIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  ok(JSON.stringify(liveIds) === JSON.stringify(liveSorted), 'live export: data.csv rows sorted ascending by the declared row-id column');
  const liveConceptIdx = liveHeader.indexOf('concept');
  for (const r of liveRows) {
    const c = r[liveConceptIdx];
    const [prefix, local] = c.split(':');
    ok(prefix === livePrefix && OCG_EXT_CONCEPT_NAMES.includes(local),
      `live export: concept "${c}" resolves to a real ocg-ext taxonomy concept, never a placeholder`);
  }

  // RED before / GREEN after (JOB 3a/3b): before XBRLCSV-EXPORTER-1, exporters/xbrl-csv.mjs did
  // not exist at all — importing it threw ERR_MODULE_NOT_FOUND (verified by hand pre-change,
  // recorded in research/XBRLCSV-EXPORTER-1-2026-07-26.md). The imports above succeeding, and
  // every assertion in this block passing, is the GREEN half of that pair.

  // Annex 2 pending guard via the REAL exporter, not a simulation (§13.14.5).
  let corepThrew = false;
  try { buildXbrlCsv(artifact, 'eba-corep-own-funds'); } catch { corepThrew = true; }
  ok(corepThrew, 'live export: eba-corep-own-funds throws "pending" through the real exporter — no fabricated EBA concept ever reaches output');

  ok(!!buildXbrlCsv(artifact, 'ocg-ext').bytes.length, 'live export: deterministic run does not throw on repeat call');
  const built2 = buildXbrlCsv(artifact, 'ocg-ext');
  ok(JSON.stringify([...built.bytes]) === JSON.stringify([...built2.bytes]), 'live export: byte-identical on re-run for the same artifact (determinism)');
}

console.log();
console.log(fail ? `✗ ${fail} failure(s)` : '✓ all §13.14 fixture + live-exporter checks pass');
console.log('\nNOT verified here (SPEC.md §13.14.4 — validation is EXTERNAL by design, and this repo is');
console.log('zero-dep so it vendors no processor): full OIM/xBRL-CSV REC 2021-10-13 structural conformance');
console.log('(report-package JSON Schema, table-linking machinery) beyond the §13.14.6-named properties');
console.log('checked above. Validate with a certified processor (e.g. Arelle) before any submission claim.');
process.exitCode = fail ? 1 : 0;
