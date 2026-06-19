// exporters/xbrl.mjs — chaingraph_export:xbrl (OCG Standard §13.8).
// Regulator-submission profile. Builds a well-formed XBRL v2.1 instance document
// (contexts, units, facts) from a verified artifact.
//
// IMPORTANT (core project rule: no fabricated regulatory content):
//   - The `ocg-ext` taxonomy below is OUR namespace — fully defined here, so it
//     produces a real, valid instance now. This is the working pilot path that
//     proves the machinery end-to-end.
//   - `eba-corep-own-funds` / `eba-corep-lcr-nsfr` are REGISTERED but their concept
//     maps are intentionally EMPTY. We do NOT invent eba_met qnames. Populate them
//     ONLY from the published EBA taxonomy (entry points + metric/dimension codes)
//     before emitting; until then these taxonomies return a clear "pending" error.
//
// XBRL note: a true COREP submission also needs the EBA dimensional model and
// validation rules. This module emits a standards-shaped instance; full COREP
// conformance is the tracked per-regime work item (§13.8).

import { metaBlock, exportFilename, xmlEscape, flattenPayload } from './_meta.mjs';

const MEDIA_TYPE = 'application/xml';

// --- Taxonomy registry ----------------------------------------------------
// A taxonomy entry = { ns, prefix, schemaRef, concepts: { payloadKey: {name, type, unit} } }.
// type: 'monetary' | 'pure' | 'string' | 'percent'. unit only for monetary/pure.
const OCG_EXT_NS = 'https://ainumbers.co/chaingraph/xbrl/ocg-ext';

const TAXONOMIES = {
  // Working pilot — our own namespace, fully defined, emits a real instance.
  'ocg-ext': {
    ns: OCG_EXT_NS,
    prefix: 'ocg',
    schemaRef: `${OCG_EXT_NS}/ocg-ext-2026.xsd`,
    // Generic OCG concept map. Anything in output_payload that matches is tagged;
    // unmatched scalars are emitted under ocg:fact with a @name attribute so no
    // data is silently dropped.
    concepts: {
      verdict:            { name: 'Verdict', type: 'string' },
      grade:              { name: 'Grade', type: 'string' },
      overall_grade:      { name: 'Grade', type: 'string' },
      recommended_model:  { name: 'RecommendedModel', type: 'string' },
      annual_saving_usd:  { name: 'AnnualSaving', type: 'monetary', unit: 'USD' },
      net_cleared_im:     { name: 'NetClearedInitialMargin', type: 'monetary', unit: 'USD' },
      gross_bilateral_im: { name: 'GrossBilateralInitialMargin', type: 'monetary', unit: 'USD' },
      netting_benefit_usd:{ name: 'NettingBenefit', type: 'monetary', unit: 'USD' },
      netting_benefit_pct:{ name: 'NettingBenefitPct', type: 'percent' },
      estimated_vbm:      { name: 'EstimatedVaRBasedMargin', type: 'monetary', unit: 'USD' },
      rwa_delta:          { name: 'RwaDelta', type: 'monetary', unit: 'USD' },
    },
  },
};

// --- EBA COREP runtime maps (loader) -------------------------------------
// Mirrors exporters/taxonomies/eba-corep-concept-map.json (the human artifact).
// eba_qname / schemaRef / ns.uri are NULL — buildCorep() guards while unpopulated
// and DOES NOT fabricate concepts (OCG §13.8 / core project rule). When a future
// session fills these from the published EBA taxonomy, COREP emission turns on with
// no other change. Keep this in sync with the JSON scaffold.
const COREP_MAPS = {
  'eba-corep-own-funds': {
    schemaRef: null,                                   // EBA COREP-OF entry-point .xsd
    ns: { prefix: 'eba_met', uri: null },              // confirm metric namespace URI from taxonomy
    fields: [
      { payload_field: 'basel31_rwa_bn', template: 'C 02.00', label: 'TREA', eba_qname: null, unit: 'monetary' },
      { payload_field: 'cet1_ratio_basel31_pct', template: 'C 03.00', label: 'CET1 ratio', eba_qname: null, unit: 'percent' },
      { payload_field: 'floor_rwa_bn', template: 'C 02.00', label: 'Output floor RWA', eba_qname: null, unit: 'monetary' },
    ],
  },
  'eba-corep-lcr-nsfr': {
    schemaRef: null,                                   // EBA Liquidity entry-point .xsd
    ns: { prefix: 'eba_met', uri: null },
    fields: [
      { payload_field: 'lcr_median_day30', template: 'C 76.00', label: 'LCR', eba_qname: null, unit: 'percent' },
      { payload_field: 'nsfr_median_day250', template: 'C 84.00', label: 'NSFR', eba_qname: null, unit: 'percent' },
    ],
  },
};

export const XBRL_TAXONOMIES = [...Object.keys(TAXONOMIES), ...Object.keys(COREP_MAPS)];

// Build a COREP instance — or throw a clear "pending" error while unpopulated.
function buildCorep(artifact, taxonomyId) {
  const map = COREP_MAPS[taxonomyId];
  const ready = map.schemaRef && map.ns.uri && map.fields.some((f) => f.eba_qname);
  if (!ready) {
    throw new Error(
      `EBA COREP ${taxonomyId}: concept map not populated (schemaRef / ns.uri / eba_qname are null). ` +
      `See exporters/taxonomies/eba-corep-concept-map.json — populate from the published EBA taxonomy; ` +
      `concepts must not be fabricated (OCG §13.8). Use xbrl_taxonomy="ocg-ext" in the interim.`);
  }
  // --- Activated path (runs once qnames are populated) ---
  const m = metaBlock(artifact);
  const op = artifact?.output_payload ?? {};
  const { scalars } = flattenPayload(op);
  const lookup = new Map(scalars);
  const period = (artifact?.generated_at ?? '').slice(0, 10) || '1970-01-01';
  const monetaryUnits = new Set();
  const facts = [];
  for (const f of map.fields) {
    if (!f.eba_qname || !lookup.has(f.payload_field)) continue;
    const v = lookup.get(f.payload_field);
    const u = f.unit === 'monetary' ? 'u-RC' : 'u-pure';
    if (f.unit === 'monetary') monetaryUnits.add('RC');
    facts.push(`  <${f.eba_qname} contextRef="c1" unitRef="${u}" decimals="2">${factValue(f.unit, v)}</${f.eba_qname}>`);
  }
  const units = [`  <unit id="u-pure"><measure>xbrli:pure</measure></unit>`,
    ...[...monetaryUnits].map(() => `  <unit id="u-RC"><measure>iso4217:EUR</measure></unit>`)].join('\n');
  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<!-- chaingraph_export:xbrl ${taxonomyId} (OCG §13.8). Generated view — NOT independently
     verifiable. Verify JSON: ${m.verify_url}  | source execution_hash: ${m.execution_hash} -->
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
    xmlns:${map.ns.prefix}="${map.ns.uri}">
  <link:schemaRef xlink:type="simple" xlink:href="${map.schemaRef}"/>
  <xbrli:context id="c1"><xbrli:entity><xbrli:identifier scheme="https://www.gleif.org/">${xmlEscape(m.tool_id || 'ocg')}</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>${period}</xbrli:instant></xbrli:period></xbrli:context>
${units}
${facts.join('\n')}
</xbrli:xbrl>
`;
  return { bytes: new TextEncoder().encode(xml), filename: exportFilename(artifact, 'xbrl'), media_type: MEDIA_TYPE };
}

function unitRef(type, unit) {
  if (type === 'monetary') return `u-${unit}`;
  if (type === 'pure' || type === 'percent') return 'u-pure';
  return null;
}

function factValue(type, v) {
  if (type === 'monetary' || type === 'pure') return Number(v) || 0;
  if (type === 'percent') { const n = Number(v) || 0; return n > 1 ? n / 100 : n; } // ratio
  return xmlEscape(v);
}

/** buildXbrl(artifact, xbrl_taxonomy) -> { bytes, filename, media_type } | throws */
export function buildXbrl(artifact, xbrl_taxonomy) {
  if (COREP_MAPS[xbrl_taxonomy]) return buildCorep(artifact, xbrl_taxonomy);
  const tax = TAXONOMIES[xbrl_taxonomy];
  if (!tax) throw new Error(`Unknown xbrl_taxonomy "${xbrl_taxonomy}". Known: ${XBRL_TAXONOMIES.join(', ')}.`);

  const m = metaBlock(artifact);
  const op = artifact?.output_payload ?? {};
  const { scalars } = flattenPayload(op);
  const period = (artifact?.generated_at ?? '').slice(0, 10) || '1970-01-01';
  const entity = m.tool_id || 'ocg';
  const ctxId = 'c1';

  // Determine which units we need.
  const monetaryUnits = new Set();
  for (const [k] of scalars) {
    const c = tax.concepts?.[k];
    if (c?.type === 'monetary') monetaryUnits.add(c.unit || 'USD');
  }

  const facts = [];
  for (const [k, v] of scalars) {
    const c = tax.concepts?.[k];
    if (c) {
      const u = unitRef(c.type, c.unit);
      const decimals = (c.type === 'monetary' || c.type === 'pure' || c.type === 'percent') ? ' decimals="2"' : '';
      const unitAttr = u ? ` unitRef="${u}"` : '';
      facts.push(`  <${tax.prefix}:${c.name} contextRef="${ctxId}"${unitAttr}${decimals}>${factValue(c.type, v)}</${tax.prefix}:${c.name}>`);
    } else {
      // Unmatched scalar — emit generically so nothing is dropped (ocg-ext only).
      facts.push(`  <${tax.prefix}:fact contextRef="${ctxId}" name="${xmlEscape(k)}">${xmlEscape(v)}</${tax.prefix}:fact>`);
    }
  }

  const units = [
    `  <unit id="u-pure"><measure>xbrli:pure</measure></unit>`,
    ...[...monetaryUnits].map((u) => `  <unit id="u-${u}"><measure>iso4217:${u}</measure></unit>`),
  ].join('\n');

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<!-- chaingraph_export:xbrl (OCG Standard §13.8). Generated view of a verified
     artifact — NOT independently verifiable. Verify the JSON artifact:
     ${m.verify_url}
     Source artifact execution_hash: ${m.execution_hash}
     Taxonomy: ${xbrl_taxonomy} -->
<xbrli:xbrl
    xmlns:xbrli="http://www.xbrl.org/2003/instance"
    xmlns:link="http://www.xbrl.org/2003/linkbase"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
    xmlns:${tax.prefix}="${tax.ns}">
  <link:schemaRef xlink:type="simple" xlink:href="${tax.schemaRef}"/>
  <xbrli:context id="${ctxId}">
    <xbrli:entity><xbrli:identifier scheme="https://ainumbers.co/chaingraph/tool">${xmlEscape(entity)}</xbrli:identifier></xbrli:entity>
    <xbrli:period><xbrli:instant>${period}</xbrli:instant></xbrli:period>
  </xbrli:context>
${units}
${facts.join('\n')}
</xbrli:xbrl>
`;

  return {
    bytes: new TextEncoder().encode(xml),
    filename: exportFilename(artifact, 'xbrl'),
    media_type: MEDIA_TYPE,
  };
}
