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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cgCanon } from '../kernels/_hash.mjs';
import { OCG_EXT_NAMESPACE_URI, OCG_EXT_CONCEPT_NAMES } from './xbrl.mjs';

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

console.log();
console.log(fail ? `✗ ${fail} failure(s)` : '✓ all §13.14 fixture checks pass');
process.exitCode = fail ? 1 : 0;
