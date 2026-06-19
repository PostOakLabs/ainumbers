// exporters/csv.mjs — chaingraph_export:csv (OCG Standard §13.7).
// Pipeline-tabular sibling of xlsx. Emits a single CSV: a metadata manifest
// block, the output_payload scalars, then each table. One file (not a per-table
// bundle) to keep the scaffold simple; split into a zip-of-csvs later if needed.

import { metaBlock, exportFilename, csvField, flattenPayload } from './_meta.mjs';

const MEDIA_TYPE = 'text/csv';
const enc = (s) => new TextEncoder().encode(s);

export function buildCsv(artifact) {
  const m = metaBlock(artifact);
  const lines = [];
  lines.push(['# chaingraph_export:csv — generated view, not independently verifiable'].map(csvField).join(','));
  for (const [k, v] of Object.entries(m)) lines.push([`# ${k}`, v].map(csvField).join(','));
  lines.push('');

  const { scalars, tables } = flattenPayload(artifact?.output_payload ?? {});
  lines.push(['key', 'value'].map(csvField).join(','));
  for (const [k, v] of scalars) lines.push([k, v].map(csvField).join(','));

  for (const t of tables) {
    lines.push('');
    lines.push([`# table: ${t.name}`].map(csvField).join(','));
    lines.push(t.columns.map(csvField).join(','));
    for (const r of t.rows) lines.push(r.map(csvField).join(','));
  }

  // Prepend a UTF-8 BOM so Excel-on-Windows detects UTF-8 (otherwise it reads
  // the file as ANSI and mangles non-ASCII, e.g. em-dashes and any payload text).
  const body = enc(lines.join('\r\n'));
  const bytes = new Uint8Array(3 + body.length);
  bytes.set([0xEF, 0xBB, 0xBF], 0);
  bytes.set(body, 3);

  return {
    bytes,
    filename: exportFilename(artifact, 'csv'),
    media_type: MEDIA_TYPE,
  };
}
