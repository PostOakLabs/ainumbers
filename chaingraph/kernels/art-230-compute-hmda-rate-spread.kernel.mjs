import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-230-compute-hmda-rate-spread';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_hmda_rate_spread',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── HMDA Rate Spread Calculator ─────────────────────────────────────────────
// Computes the HMDA rate spread (APR minus APOR) per FFIEC methodology and
//   determines HMDA reportability under 12 CFR §1003.4(a)(12).
// table_version: "HMDA-FFIEC-RATE-SPREAD-2024-12CFR1003"
//
// FFIEC methodology: rate_spread = APR at lock date minus Average Prime Offer
//   Rate (APOR) for a comparable transaction on the lock date. APOR is published
//   weekly by FFIEC at ffiec.gov/ratespread. The FFIEC Rate Spread Calculator
//   (public tool) implements this same logic.
//
// Reportability thresholds (12 CFR §1003.4(a)(12), effective Jan 2018 HMDA rule):
//   First lien:   APR - APOR >= 1.5 percentage points
//   Subordinate:  APR - APOR >= 3.5 percentage points
//   Home equity lines: APR - APOR >= 6.5 percentage points (first lien)
//
// Inputs: apr_pct and apor_pct from the lock date. The user must supply the
//   APOR for the applicable lock date from the FFIEC weekly table
//   (https://www.ffiec.gov/ratespread/apors.aspx). This kernel validates the
//   arithmetic; it does not fetch the live APOR table (zero-network design).
//
// Disambiguation: compute_hmda_rate_spread calculates the HMDA reporting rate
//   spread (APR minus APOR, threshold 1.5/3.5pp). This is distinct from
//   classify_qm_apr_apor_spread which tests QM safe-harbor thresholds (+2.25/
//   3.5/6.5pp ATR/QM rule) -- those thresholds serve a different legal function.

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function r3(v) { return Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : 0; }

// Reportability thresholds per 12 CFR §1003.4(a)(12) (2018 HMDA Final Rule)
const FIRST_LIEN_THRESHOLD_PCT = 1.5;
const SUBORDINATE_LIEN_THRESHOLD_PCT = 3.5;
const HELOC_FIRST_LIEN_THRESHOLD_PCT = 6.5; // home equity lines, first lien

export function compute(pp) {
  pp = pp || {};

  const apr_pct = safeNum(pp.apr_pct, 0);
  const apor_pct = safeNum(pp.apor_pct, 0);
  const lien_type = safeStr(pp.lien_type || 'first'); // 'first' | 'subordinate'
  const product_type = safeStr(pp.product_type || 'closed_end'); // 'closed_end' | 'heloc'
  const lock_date = safeStr(pp.lock_date || '');

  // Guard: empty inputs return finite zero-state
  if (apr_pct === 0 && apor_pct === 0) {
    return {
      output_payload: {
        rate_spread_pct: 0,
        apr_pct: 0,
        apor_pct: 0,
        lien_type: lien_type || 'first',
        product_type: product_type || 'closed_end',
        reportability_threshold_pct: FIRST_LIEN_THRESHOLD_PCT,
        is_reportable: false,
        hmda_report_code: 'NA',
        lock_date,
        regulatory_basis: '12 CFR §1003.4(a)(12); HMDA 12 USC §2801; FFIEC Rate Spread methodology',
        table_version: 'HMDA-FFIEC-RATE-SPREAD-2024-12CFR1003',
        table_source: '12 CFR §1003.4(a)(12) (2018 HMDA Final Rule, effective Jan 2018); FFIEC Rate Spread Calculator (ffiec.gov/ratespread)',
        pii_note: 'All inputs are processed locally in your browser. No data is transmitted.',
      },
      compliance_flags: [],
    };
  }

  const rate_spread_pct = r3(apr_pct - apor_pct);

  // Determine applicable threshold
  let reportability_threshold_pct;
  if (product_type === 'heloc' && lien_type === 'first') {
    reportability_threshold_pct = HELOC_FIRST_LIEN_THRESHOLD_PCT;
  } else if (lien_type === 'subordinate') {
    reportability_threshold_pct = SUBORDINATE_LIEN_THRESHOLD_PCT;
  } else {
    reportability_threshold_pct = FIRST_LIEN_THRESHOLD_PCT;
  }

  const is_reportable = rate_spread_pct >= reportability_threshold_pct;

  // HMDA LAR field value: NA (not applicable), or the numeric rate spread to 3 decimal places
  const hmda_report_code = is_reportable ? String(rate_spread_pct.toFixed(3)) : 'NA';

  const compliance_flags = [];
  if (is_reportable) compliance_flags.push('HMDA_RATE_SPREAD_REPORTABLE');
  if (rate_spread_pct < 0) compliance_flags.push('NEGATIVE_RATE_SPREAD_VERIFY');
  if (apr_pct > 36) compliance_flags.push('APR_EXCEEDS_36PCT_VERIFY');

  const output_payload = {
    rate_spread_pct,
    apr_pct,
    apor_pct,
    lien_type,
    product_type,
    reportability_threshold_pct,
    is_reportable,
    hmda_report_code,
    lock_date,
    apor_source_note: 'APOR must be sourced from FFIEC weekly table at ffiec.gov/ratespread for the applicable lock date and comparable transaction term.',
    regulatory_basis: '12 CFR §1003.4(a)(12); HMDA 12 USC §2801; FFIEC Rate Spread methodology',
    table_version: 'HMDA-FFIEC-RATE-SPREAD-2024-12CFR1003',
    table_source: '12 CFR §1003.4(a)(12) (2018 HMDA Final Rule FR 2015-26607, effective Jan 2018); FFIEC Rate Spread Calculator (ffiec.gov/ratespread); first-lien threshold 1.5pp; subordinate 3.5pp; HELOC first-lien 6.5pp',
    pii_note: 'All inputs are processed locally in your browser. No data is transmitted.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
