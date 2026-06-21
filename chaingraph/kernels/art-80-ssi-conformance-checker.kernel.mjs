/**
 * art-80-ssi-conformance-checker.kernel.mjs
 * Wave 17 — SSI Conformance Checker.
 * Lints standing settlement instructions for completeness, staleness, and format —
 * the ~30%-of-fails root cause — and scores golden-source match rate.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   SSI fail data: ~30% of fails from incorrect/stale SSIs
 *     (EquiLend, FinOps; S&P Global SSI Automate live Mar 2026).
 *   T+1 readiness guidance: EquiLend, S&P Global SSI Automate.
 *   ISO standing-instruction conventions + BIC (ISO 9362). Verify current edition.
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-80-ssi-conformance-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_ssi_conformance',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// BIC validation: 8 or 11 uppercase alphanumeric characters (ISO 9362)
const isBicValid = (bic) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(bic ?? ''));

const REMEDIATION = {
  stale:       'Update SSI with golden-source provider. Target ≤90-day verification cadence for T+1.',
  incomplete:  'Complete all required settlement instruction fields (BIC, account number, place of settlement).',
  bad_bic:     'Correct BIC format (ISO 9362: 4-char institution + 2-char country + 2-char location [+ 3-char branch]).',
  non_golden:  'Migrate to golden-source SSI provider (S&P Global SSI Automate, DTCC / Omgeo).',
};

const IMPACT = { stale: 'HIGH', incomplete: 'CRITICAL', bad_bic: 'HIGH', non_golden: 'MEDIUM' };

export function compute(pp) {
  const {
    ssi_records         = [],  // [{ market, instrument_class, place_of_settlement, account_fields_complete, bic_valid, last_verified_age_days, source }]
    staleness_threshold_days = 90,
  } = pp;

  const records_flagged = [];
  let stale_count     = 0;
  let incomplete_count = 0;
  let format_errors   = 0;
  let non_golden      = 0;
  let golden_source   = 0;

  for (const rec of ssi_records) {
    const issues = [];
    const age    = +(rec.last_verified_age_days ?? 0);
    const bicOk  = rec.bic_valid !== false && (rec.bic_valid === true || rec.bic_valid === 'true'
      || (rec.bic ?? '') === '' || isBicValid(rec.bic));

    if (age > staleness_threshold_days) {
      issues.push({ issue: 'SSI_STALE', remediation: REMEDIATION.stale, impact: IMPACT.stale });
      stale_count++;
    }
    if (rec.account_fields_complete === false || rec.account_fields_complete === 'false') {
      issues.push({ issue: 'SSI_INCOMPLETE', remediation: REMEDIATION.incomplete, impact: IMPACT.incomplete });
      incomplete_count++;
    }
    if (!bicOk) {
      issues.push({ issue: 'BIC_FORMAT_INVALID', remediation: REMEDIATION.bad_bic, impact: IMPACT.bad_bic });
      format_errors++;
    }
    if (rec.source !== 'golden') {
      issues.push({ issue: 'NON_GOLDEN_SOURCE', remediation: REMEDIATION.non_golden, impact: IMPACT.non_golden });
      non_golden++;
    } else {
      golden_source++;
    }

    if (issues.length > 0) {
      records_flagged.push({
        market:              rec.market ?? '',
        instrument_class:    rec.instrument_class ?? '',
        place_of_settlement: rec.place_of_settlement ?? '',
        issues,
        last_verified_age_days: age,
        source:              rec.source ?? 'unknown',
      });
    }
  }

  const total = ssi_records.length;
  const clean = total - records_flagged.length;
  const match_rate = total > 0 ? +(clean / total * 100).toFixed(1) : 100;
  const golden_source_coverage_pct = total > 0 ? +(golden_source / total * 100).toFixed(1) : 0;

  const compliance_flags = [];
  if (stale_count > 0)      compliance_flags.push('SSI_STALE');
  if (incomplete_count > 0) compliance_flags.push('SSI_INCOMPLETE');
  if (format_errors > 0)    compliance_flags.push('BIC_FORMAT_INVALID');
  if (non_golden > 0)       compliance_flags.push('NON_GOLDEN_SOURCE');

  const output_payload = {
    match_rate,
    total_records:            total,
    clean_records:            clean,
    records_flagged,
    staleness_breaches:       stale_count,
    incomplete_records:       incomplete_count,
    format_errors,
    non_golden_source_count:  non_golden,
    golden_source_coverage_pct,
    staleness_threshold_days: +staleness_threshold_days,
    reference: {
      ssi_fail_rate:    '~30% of settlement fails trace to incorrect/stale SSIs (EquiLend / FinOps — verify current data)',
      golden_providers: 'S&P Global SSI Automate (live Mar 2026), DTCC / Omgeo',
      bic_standard:     'ISO 9362:2022',
    },
    note: 'DECISION-SUPPORT DRAFT — SSI lint results are based on the provided field data. Completeness and staleness checks are configurable. For production use, validate directly against your golden-source SSI provider. ~30% of settlement fails are SSI-related (EquiLend / FinOps — verify); highest-leverage T+1 prep action.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
