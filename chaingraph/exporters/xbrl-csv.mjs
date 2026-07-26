// exporters/xbrl-csv.mjs — chaingraph_export:xbrl-csv (OCG Standard §13.14).
// Emits a real xBRL-CSV (REC 2021-10-13) report package: a JSON metadata part
// (documentInfo/tableTemplates/tables) plus one CSV data part, zipped together
// (the same STORE-only zip.mjs writer this repo already uses for .xlsx — a
// report package is conventionally distributed as a single archive).
//
// IMPORTANT (core project rule: no fabricated regulatory content, restated at
// §13, §13.8, §13.13.5, §13.14.5):
//   - The 'ocg-ext' taxonomy is OUR namespace, fully defined in xbrl.mjs. This
//     module reuses that SAME concept map (imported, not copied) so a payload
//     field maps to a real concept or is OMITTED from the table — never a
//     placeholder/invented concept.
//   - 'eba-corep-own-funds' / 'eba-corep-lcr-nsfr' mirror exporters/xbrl.mjs's
//     COREP_MAPS: registered, but every eba_qname is intentionally NULL until
//     populated from the published EBA DPM 2.0 taxonomy package (see
//     exporters/taxonomies/eba-dpm2-xbrlcsv-corep-map.json). Until then these
//     taxonomies throw a clear "pending" error — the ocg-ext profile is the
//     working demonstration path (§13.14.5, mirrors §13.8/§13.13 Annex 1).
//
// Full EBA DPM 2.0 submission conformance additionally needs dimensional/
// validation-rule machinery this module does not vendor (§13.14.3/.4) — this
// emits a structurally valid, NOT independently submittable report package.

import { metaBlock, exportFilename, csvField, flattenPayload } from './_meta.mjs';
import { zipStore } from './zip.mjs';
import { cgCanon } from '../kernels/_hash.mjs';
import { OCG_EXT_NAMESPACE_URI, OCG_EXT_CONCEPTS, OCG_EXT_SCHEMA_REF } from './xbrl.mjs';

const MEDIA_TYPE = 'application/zip';
const TABLE_COLUMNS = ['concept', 'decimals', 'entity', 'period', 'unit', 'value']; // already alphabetical

// Mirrors exporters/taxonomies/eba-dpm2-xbrlcsv-corep-map.json (the human artifact) — every
// entry_point_schemaRef / eba_qname stays NULL until populated from the published EBA DPM 2.0
// taxonomy package. DO NOT set any of these directly; edit the JSON scaffold first, then mirror.
const COREP_MAPS_CSV = {
  'eba-corep-own-funds': { entry_point_schemaRef: null, fields: [{ eba_qname: null }, { eba_qname: null }, { eba_qname: null }] },
  'eba-corep-lcr-nsfr':   { entry_point_schemaRef: null, fields: [{ eba_qname: null }, { eba_qname: null }] },
};

export const XBRL_CSV_TAXONOMIES = ['ocg-ext', ...Object.keys(COREP_MAPS_CSV)];

function buildCorepCsv(taxonomyId) {
  const map = COREP_MAPS_CSV[taxonomyId];
  const ready = map.entry_point_schemaRef && map.fields.some((f) => f.eba_qname);
  if (ready) {
    // Not reachable today — the scaffold's eba_qname values are all null (see the JSON
    // scaffold's concept_binding_status). Left as an explicit branch so populating the
    // scaffold + mirroring it here is the only change needed to activate this taxonomy.
    throw new Error(`EBA DPM 2.0 xBRL-CSV ${taxonomyId}: concept map reports ready but no build path is wired yet.`);
  }
  throw new Error(
    `EBA DPM 2.0 xBRL-CSV ${taxonomyId}: concept map not populated (entry_point_schemaRef / eba_qname are null). ` +
    `See exporters/taxonomies/eba-dpm2-xbrlcsv-corep-map.json — populate from the published EBA DPM 2.0 taxonomy ` +
    `package; concepts must not be fabricated (OCG Standard §13.14.5). Use xbrl_csv_taxonomy="ocg-ext" in the interim.`);
}

function buildOcgExtCsv(artifact) {
  const m = metaBlock(artifact);
  const op = artifact?.output_payload ?? {};
  const { scalars } = flattenPayload(op);
  const period = (artifact?.generated_at ?? '').slice(0, 10) || '1970-01-01';
  const entity = `https://ainumbers.co/chaingraph/tool:${m.tool_id || 'ocg'}`;

  // Only scalars that resolve to a REAL ocg-ext concept become a row. An unmapped field is
  // OMITTED, never emitted under an invented placeholder concept (§13.14.2 / §13.14.5).
  const rows = [];
  for (const [k, v] of scalars) {
    const c = OCG_EXT_CONCEPTS[k];
    if (!c) continue;
    const unit = c.type === 'monetary' ? `iso4217:${c.unit || 'USD'}` : '';
    const decimals = (c.type === 'monetary' || c.type === 'pure' || c.type === 'percent') ? '2' : '';
    const value = c.type === 'percent' ? String(Number(v) > 1 ? Number(v) / 100 : Number(v)) : String(v);
    rows.push({ concept: `ocg-ext:${c.name}`, decimals, entity, period, unit, value });
  }
  rows.sort((a, b) => (a.concept < b.concept ? -1 : a.concept > b.concept ? 1 : 0)); // §13.14.1 row-id sort

  const metadataDoc = cgCanon({
    documentInfo: {
      documentType: 'https://xbrl.org/2021/xbrl-csv',
      features: { 'xbrl:canonicalValues': true },
      namespaces: { 'ocg-ext': OCG_EXT_NAMESPACE_URI, xbrli: 'http://www.xbrl.org/2003/instance' },
      'ocg:metadata': {
        chaingraph_version: m.chaingraph_version,
        compute_mode: m.compute_mode,
        // m.execution_hash is bare lowercase hex (chaingraph/kernels/_hash.mjs); §13.14.1 embeds
        // it sha256:-prefixed (mirrors sample.metadata.json + vc.mjs's own normalization).
        execution_hash: m.execution_hash ? `sha256:${String(m.execution_hash).replace(/^sha256:/, '')}` : null,
        tool_id: m.tool_id,
      },
      taxonomy: [OCG_EXT_SCHEMA_REF],
    },
    tableTemplates: { 'ocg-ext-summary': { columns: Object.fromEntries(TABLE_COLUMNS.map((c) => [c, {}])) } },
    tables: { 'ocg-ext-summary': { rowIdColumn: 'concept', template: 'ocg-ext-summary', url: 'data.csv' } },
  });
  const metadataJson = JSON.stringify(metadataDoc);

  const csvLines = [TABLE_COLUMNS.join(','), ...rows.map((r) => TABLE_COLUMNS.map((c) => csvField(r[c])).join(','))];
  const csvText = csvLines.join('\r\n') + '\r\n';

  const zipBytes = zipStore([
    { name: 'metadata.json', data: new TextEncoder().encode(metadataJson) },
    { name: 'data.csv', data: new TextEncoder().encode(csvText) },
  ]);

  return { bytes: zipBytes, filename: exportFilename(artifact, 'xbrl-csv.zip'), media_type: MEDIA_TYPE };
}

/** buildXbrlCsv(artifact, xbrl_csv_taxonomy='ocg-ext') -> { bytes, filename, media_type } | throws */
export function buildXbrlCsv(artifact, xbrl_csv_taxonomy = 'ocg-ext') {
  if (COREP_MAPS_CSV[xbrl_csv_taxonomy]) return buildCorepCsv(xbrl_csv_taxonomy);
  if (xbrl_csv_taxonomy !== 'ocg-ext') {
    throw new Error(`Unknown xbrl_csv_taxonomy "${xbrl_csv_taxonomy}". Known: ${XBRL_CSV_TAXONOMIES.join(', ')}.`);
  }
  return buildOcgExtCsv(artifact);
}
