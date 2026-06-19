// exporters/xlsx.mjs — chaingraph_export:xlsx (OCG Standard §13.5).
// Minimal, dependency-free OOXML (.xlsx) writer for the Cloudflare Worker.
// Produces a 3-sheet workbook: Decision / Data / Provenance. Inline strings
// (no sharedStrings), store-only ZIP, deterministic output.
//
// Reference implementation — correct enough for Excel/LibreOffice to open.
// Harden (styles, number formats, large-batch streaming) before GA.

import { zipStore } from './zip.mjs';
import { metaBlock, exportFilename, xmlEscape, flattenPayload } from './_meta.mjs';

const MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const enc = (s) => new TextEncoder().encode(s);

function colLetter(n) { // 0 -> A
  let s = '';
  n += 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function cellXml(ref, v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `<c r="${ref}"><v>${v}</v></c>`;
  }
  if (v === null || v === undefined || v === '') return `<c r="${ref}"/>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
}

function sheetXml(rows) {
  let body = '';
  rows.forEach((row, r) => {
    const cells = row.map((v, c) => cellXml(`${colLetter(c)}${r + 1}`, v)).join('');
    body += `<row r="${r + 1}">${cells}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData></worksheet>`;
}

function decisionRows(artifact) {
  const m = metaBlock(artifact);
  const op = artifact?.output_payload ?? {};
  const verdict = op.verdict ?? op.grade ?? op.overall_grade ?? op.recommended_model ?? '(see Data)';
  const rows = [
    ['OpenChainGraph Export — Decision'],
    [],
    ['tool_id', m.tool_id],
    ['mandate_type', m.mandate_type],
    ['verdict / headline', verdict],
    ['generated_at', artifact?.generated_at ?? null],
    [],
    ['— Provenance metadata —'],
    ['execution_hash', m.execution_hash],
    ['chaingraph_version', m.chaingraph_version],
    ['compute_mode', m.compute_mode],
    ['signing keyid', m.keyid],
    ['verify_url', m.verify_url],
    [],
    ['This spreadsheet is a generated VIEW of a verified artifact. It is not'],
    ['independently verifiable — verify the JSON artifact at verify_url.'],
  ];
  return rows;
}

function dataRows(artifact) {
  const { scalars, tables } = flattenPayload(artifact?.output_payload ?? {});
  const rows = [['output_payload — scalars'], ['key', 'value']];
  for (const [k, v] of scalars) rows.push([k, v]);
  for (const t of tables) {
    rows.push([]);
    rows.push([`table: ${t.name}`]);
    rows.push(t.columns);
    for (const r of t.rows) rows.push(r);
  }
  return rows;
}

function provenanceRows(artifact) {
  const chain = artifact?.chain ?? {};
  const rows = [['Provenance']];
  rows.push([], ['parent_hashes']);
  for (const h of (chain.parent_hashes ?? [])) rows.push([h]);
  rows.push([], ['parent_tool_ids']);
  for (const t of (chain.parent_tool_ids ?? [])) rows.push([t]);
  rows.push(['chain_depth', chain.chain_depth ?? 0]);
  rows.push([], ['compliance_flags']);
  for (const f of (artifact?.compliance_flags ?? [])) rows.push([f]);
  return rows;
}

const SHEETS = [
  { name: 'Decision', build: decisionRows },
  { name: 'Data', build: dataRows },
  { name: 'Provenance', build: provenanceRows },
];

function contentTypes() {
  const overrides = SHEETS.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    overrides + `</Types>`;
}

function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
}

function workbookXml() {
  const sheets = SHEETS.map((s, i) =>
    `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${sheets}</sheets></workbook>`;
}

function workbookRels() {
  const rels = SHEETS.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

/** buildXlsx(artifact) -> { bytes: Uint8Array, filename, media_type } */
export function buildXlsx(artifact) {
  const files = [
    { name: '[Content_Types].xml', data: enc(contentTypes()) },
    { name: '_rels/.rels', data: enc(rootRels()) },
    { name: 'xl/workbook.xml', data: enc(workbookXml()) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc(workbookRels()) },
    ...SHEETS.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc(sheetXml(s.build(artifact))),
    })),
  ];
  return {
    bytes: zipStore(files),
    filename: exportFilename(artifact, 'xlsx'),
    media_type: MEDIA_TYPE,
  };
}
