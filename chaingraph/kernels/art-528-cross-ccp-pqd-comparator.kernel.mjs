/**
 * art-528-cross-ccp-pqd-comparator.kernel.mjs
 * CCP-CORE-BUILD-SPEC.md §1.1 -- cross-CCP public quantitative disclosure (PQD)
 * field comparator, FICC vs ICE only (v1 scope, CCP-CORE-BUILD-SPEC.md §0).
 *
 * PROVENANCE: CPMI-IOSCO "Public quantitative disclosure standards for central
 * counterparties" (Dec 2015) -- the STANDING disclosure template FICC and ICE
 * already publish quarterly. This node does not cite the 2026 PQD-transparency
 * consultation amendments (consultation-stage, no compliance date).
 *
 * FIXTURE DATA IS FIXTURE DATA (CCP-CORE-BUILD-SPEC.md §0 ruling). The figures
 * in CCP_DATASET below are manually transcribed from each CCP's own published
 * quarterly PDF disclosure -- never a live feed, never scraped (no CCP publishes
 * these fields machine-readably). Refresh by hand each quarter against the
 * source URLs in CCP_DATASET. CME and LCH are named in CCP-CORE-BUILD-SPEC.md
 * §0 but NOT built here -- selecting either as entity_a/entity_b yields
 * PQD_CCP_UNKNOWN, never a fabricated figure.
 *
 * Sources (as transcribed 2026-08-03, CCP-CORE-BUILD-SPEC.md §0):
 *   FICC: dtcc.com/legal/policy-and-compliance, Q3 2025 PDF (GSD/MBSD/NSCC
 *     divisions; each division discloses 12-month backtest coverage and its
 *     largest single-day margin deficiency).
 *   ICE:  ice.com/clearing/quarterly-clearing-disclosures, Q4 2025 PDF (ICC,
 *     ICEU, ICUS clearing houses; each discloses default fund requirement,
 *     Cover-2 peak stress loss, and total initial margin required. Skin-in-
 *     the-game of $343M is disclosed as a single total ACROSS all six ICE
 *     clearing houses, not broken out per house -- so it is carried at CCP
 *     level, not per-division, and is unavailable when a caller asks for it
 *     against a single ICE division).
 *
 * FICC and ICE do not disclose the same field set (§0's "sample fields
 * actually opened" table): FICC's verified fields are backtest-coverage-shaped,
 * ICE's are fund-sizing/stress-shaped. A requested field absent from a given
 * CCP's fixture is reported PQD_FIELD_UNAVAILABLE for that side -- never
 * interpolated, never defaulted to zero. This is the honest state of what is
 * actually publicly disclosed, not a build gap.
 *
 * No ranking, no "better/worse" language anywhere in this kernel (§1.1) --
 * output is delta arithmetic and threshold flags only, never a soundness
 * judgment AINumbers is not positioned to make.
 *
 * Pure decision kernel -- no DOM, no window, no Date.now().
 */

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-528-cross-ccp-pqd-comparator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'compare_cross_ccp_pqd_fields',
  mandate_type: 'regulatory_reporting',
  gpu: false,
};

// CCP-CORE-BUILD-SPEC.md §0 -- transcribed from each CCP's own published Q PDF.
const CCP_DATASET = {
  FICC: {
    publisher: 'DTCC',
    source_url: 'https://www.dtcc.com/legal/policy-and-compliance',
    source_period: 'Q3 2025',
    divisions: {
      GSD:   { backtest_coverage_pct: 99.7, largest_deficiency_usd: 48600000 },
      MBSD:  { backtest_coverage_pct: 99.7, largest_deficiency_usd: 24800000 },
      NSCC:  { backtest_coverage_pct: 99.8, largest_deficiency_usd: 172900000 },
    },
  },
  ICE: {
    publisher: 'ICE',
    source_url: 'https://www.ice.com/clearing/quarterly-clearing-disclosures',
    source_period: 'Q4 2025',
    skin_in_the_game_total_usd: 343000000, // across all ICE houses, not broken out per house
    divisions: {
      ICC:  { default_fund_requirement_usd: 4798000000, cover2_peak_stress_usd: 1178000000, total_im_required_usd: 57855000000 },
      ICEU: { default_fund_requirement_usd: 3706000000, cover2_peak_stress_usd: 3670000000, total_im_required_usd: 60751000000 },
      ICUS: { default_fund_requirement_usd: 1009000000, cover2_peak_stress_usd:  800000000, total_im_required_usd: 18811000000 },
    },
  },
};

// The full field taxonomy this v1 comparator knows about, CCP-level or division-level.
const CCP_LEVEL_FIELDS = new Set(['skin_in_the_game_usd']);
const DIVISION_LEVEL_FIELDS = new Set([
  'backtest_coverage_pct',
  'largest_deficiency_usd',
  'default_fund_requirement_usd',
  'cover2_peak_stress_usd',
  'total_im_required_usd',
]);
const KNOWN_FIELDS = new Set([...CCP_LEVEL_FIELDS, ...DIVISION_LEVEL_FIELDS]);
const KNOWN_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte']);

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

function lookupEntity(entity, rejected, where) {
  if (!entity || typeof entity !== 'object') {
    rejected.push({ where, reason: 'absent or not an object', supplied: null });
    return { ccp: null, division: null, valid: false };
  }
  const ccp = isNonEmptyString(entity.ccp) ? entity.ccp.trim().toUpperCase() : null;
  const division = isNonEmptyString(entity.division) ? entity.division.trim().toUpperCase() : null;
  if (!ccp || !CCP_DATASET[ccp]) {
    rejected.push({ where: where + '.ccp', reason: 'unknown CCP -- v1 dataset covers FICC and ICE only (CME/LCH named but not built)', supplied: entity.ccp ?? null });
    return { ccp: ccp || null, division, valid: false };
  }
  if (!division || !CCP_DATASET[ccp].divisions[division]) {
    rejected.push({ where: where + '.division', reason: 'unknown division for ' + ccp, supplied: entity.division ?? null });
    return { ccp, division: division || null, valid: false };
  }
  return { ccp, division, valid: true };
}

function fieldValue(entity, fieldId) {
  if (!entity.valid) return { available: false, reason: 'entity not resolved' };
  const ccpData = CCP_DATASET[entity.ccp];
  if (CCP_LEVEL_FIELDS.has(fieldId)) {
    const v = ccpData.skin_in_the_game_total_usd;
    return v === undefined
      ? { available: false, reason: entity.ccp + ' does not disclose ' + fieldId + ' in the fixture' }
      : { available: true, value: v, scope: 'ccp_level' };
  }
  const div = ccpData.divisions[entity.division];
  const v = div[fieldId];
  return v === undefined
    ? { available: false, reason: entity.ccp + ' ' + entity.division + ' does not disclose ' + fieldId + ' in the fixture' }
    : { available: true, value: v, scope: 'division_level' };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const entity_a = lookupEntity(pp.entity_a, rejected_inputs, 'entity_a');
  const entity_b = lookupEntity(pp.entity_b, rejected_inputs, 'entity_b');

  const fieldsIn = Array.isArray(pp.fields) ? pp.fields : [];
  if (fieldsIn.length === 0) rejected_inputs.push({ where: 'fields', reason: 'absent or empty -- at least one field must be requested', supplied: pp.fields ?? null });

  const fields = fieldsIn.map((f, i) => {
    const fieldId = isNonEmptyString(f) ? f.trim() : null;
    if (!fieldId || !KNOWN_FIELDS.has(fieldId)) {
      rejected_inputs.push({ where: 'fields[' + i + ']', reason: 'not a known PQD field id', supplied: f ?? null });
      return null;
    }
    return fieldId;
  }).filter(Boolean);

  const field_rows = fields.map((fieldId) => {
    const a = fieldValue(entity_a, fieldId);
    const b = fieldValue(entity_b, fieldId);
    const row = { field_id: fieldId, entity_a: a, entity_b: b };
    if (a.available && b.available) {
      row.delta = +(b.value - a.value).toFixed(6);
      row.delta_pct = a.value !== 0 ? +(((b.value - a.value) / a.value) * 100).toFixed(4) : null;
    } else {
      row.delta = null;
      row.delta_pct = null;
    }
    return row;
  });

  const fully_available_field_count = field_rows.filter(r => r.entity_a.available && r.entity_b.available).length;
  const partially_available_field_count = field_rows.filter(r => (r.entity_a.available || r.entity_b.available) && !(r.entity_a.available && r.entity_b.available)).length;
  const unavailable_field_count = field_rows.filter(r => !r.entity_a.available && !r.entity_b.available).length;

  // Threshold: "<field> ratio > X% of <field>'s CCP's default fund requirement",
  // evaluated per-entity where both the field and the default-fund figure exist for that entity.
  let threshold_result = null;
  const thresholdIn = pp.threshold;
  if (thresholdIn !== undefined && thresholdIn !== null) {
    if (typeof thresholdIn !== 'object') {
      rejected_inputs.push({ where: 'threshold', reason: 'present but not an object', supplied: typeof thresholdIn });
    } else {
      const fieldId = isNonEmptyString(thresholdIn.field_id) ? thresholdIn.field_id.trim() : null;
      const operator = isNonEmptyString(thresholdIn.operator) ? thresholdIn.operator.trim().toLowerCase() : null;
      const valuePct = typeof thresholdIn.value_pct_of_default_fund === 'number' && Number.isFinite(thresholdIn.value_pct_of_default_fund)
        ? thresholdIn.value_pct_of_default_fund : null;
      if (!fieldId || !KNOWN_FIELDS.has(fieldId)) rejected_inputs.push({ where: 'threshold.field_id', reason: 'not a known PQD field id', supplied: thresholdIn.field_id ?? null });
      if (!operator || !KNOWN_OPERATORS.has(operator)) rejected_inputs.push({ where: 'threshold.operator', reason: 'must be one of gt, gte, lt, lte', supplied: thresholdIn.operator ?? null });
      if (valuePct === null) rejected_inputs.push({ where: 'threshold.value_pct_of_default_fund', reason: 'absent or not a finite number', supplied: thresholdIn.value_pct_of_default_fund ?? null });

      if (fieldId && KNOWN_FIELDS.has(fieldId) && operator && KNOWN_OPERATORS.has(operator) && valuePct !== null) {
        function evalEntity(entity, label) {
          const num = fieldValue(entity, fieldId);
          const denom = fieldValue(entity, 'default_fund_requirement_usd');
          if (!num.available || !denom.available || denom.value === 0) {
            return { entity: label, evaluable: false, reason: !num.available ? num.reason : (!denom.available ? denom.reason : 'default_fund_requirement_usd is zero') };
          }
          const ratio_pct = +((num.value / denom.value) * 100).toFixed(4);
          let breach;
          if (operator === 'gt') breach = ratio_pct > valuePct;
          else if (operator === 'gte') breach = ratio_pct >= valuePct;
          else if (operator === 'lt') breach = ratio_pct < valuePct;
          else breach = ratio_pct <= valuePct;
          return { entity: label, evaluable: true, ratio_pct, breach };
        }
        threshold_result = {
          field_id: fieldId,
          operator,
          value_pct_of_default_fund: valuePct,
          entity_a: evalEntity(entity_a, 'entity_a'),
          entity_b: evalEntity(entity_b, 'entity_b'),
        };
      }
    }
  }

  const cross_ccp = entity_a.valid && entity_b.valid && entity_a.ccp !== entity_b.ccp;

  const compliance_flags = [];
  if (entity_a.valid && entity_b.valid) {
    compliance_flags.push(cross_ccp ? 'PQD_COMPARISON_CROSS_CCP' : 'PQD_COMPARISON_SAME_CCP');
  } else {
    compliance_flags.push('PQD_CCP_UNKNOWN');
  }
  if (fully_available_field_count > 0) compliance_flags.push('PQD_FIELD_AVAILABLE_BOTH_SIDES');
  if (partially_available_field_count > 0) compliance_flags.push('PQD_FIELD_UNAVAILABLE_ONE_SIDE');
  if (unavailable_field_count > 0 && fields.length > 0) compliance_flags.push('PQD_FIELD_UNAVAILABLE_BOTH_SIDES');
  if (threshold_result) {
    if (threshold_result.entity_a.evaluable && threshold_result.entity_a.breach) compliance_flags.push('PQD_THRESHOLD_BREACH_ENTITY_A');
    if (threshold_result.entity_b.evaluable && threshold_result.entity_b.breach) compliance_flags.push('PQD_THRESHOLD_BREACH_ENTITY_B');
  }
  if (rejected_inputs.length > 0) compliance_flags.push('PQD_INPUTS_REJECTED');

  const rationale = [];
  rationale.push(entity_a.valid && entity_b.valid
    ? ('Comparing ' + entity_a.ccp + ' ' + entity_a.division + ' against ' + entity_b.ccp + ' ' + entity_b.division + (cross_ccp ? ' (cross-CCP).' : ' (same CCP).'))
    : 'One or both entities did not resolve to a known CCP/division in the v1 fixture.');
  rationale.push(fields.length + ' field(s) requested: ' + fully_available_field_count + ' available on both sides, ' + partially_available_field_count + ' available on one side only, ' + unavailable_field_count + ' available on neither side.');
  if (threshold_result) {
    rationale.push('Threshold ' + threshold_result.field_id + ' ' + threshold_result.operator + ' ' + threshold_result.value_pct_of_default_fund + '% of default_fund_requirement_usd evaluated per entity where both figures are disclosed.');
  }
  rationale.push('All figures are fixture data manually transcribed from each CCP\'s own published quarterly PDF disclosure -- never a live feed. This is comparison arithmetic only: no ranking and no soundness judgment is expressed.');

  const output_payload = {
    entity_a: { ccp: entity_a.ccp, division: entity_a.division, resolved: entity_a.valid },
    entity_b: { ccp: entity_b.ccp, division: entity_b.division, resolved: entity_b.valid },
    cross_ccp,
    fields: field_rows,
    fully_available_field_count,
    partially_available_field_count,
    unavailable_field_count,
    threshold: threshold_result,
    source_citations: {
      FICC: { publisher: CCP_DATASET.FICC.publisher, source_url: CCP_DATASET.FICC.source_url, source_period: CCP_DATASET.FICC.source_period },
      ICE:  { publisher: CCP_DATASET.ICE.publisher,  source_url: CCP_DATASET.ICE.source_url,  source_period: CCP_DATASET.ICE.source_period },
    },
    rejected_inputs,
    rationale,
    note: 'Compares caller-selected CPMI-IOSCO PQD fields across FICC and ICE using a manually-transcribed, source-cited fixture dataset (never a live feed). A field a CCP does not disclose is reported unavailable, never interpolated or defaulted. Comparison arithmetic and threshold flags only -- no ranking, no better/worse scoring language.',
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
