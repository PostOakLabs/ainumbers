// art-582 — GENIUS Act Reserve-Disclosure Conformance Monitor: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-582-genius-reserve-disclosure-conformance-monitor.html
// Pure: no DOM, no window, no network.
//
// NARROWED SCOPE (Tim's ruling 2026-08-07, EDGE-WAVE-BUILD-SPEC.md §1, research/GENIUS-FINALRULE-CHECK-2026-08-07.md):
// as of 2026-08-07 no final GENIUS Act implementing regulations exist (every OCC/FDIC/Treasury/
// FinCEN/NCUA instrument is still NPRM/ANPRM). This kernel checks ONLY the two statute-derived
// requirements that do not depend on a final implementing rule: 1:1 reserve coverage arithmetic
// and attestation presence/timeliness against the statutory monthly cadence. The permitted-asset
// COMPOSITION check is deliberately OUT OF SCOPE — no final asset-eligibility text exists to check
// against (see the shipped art-06 / art-275 tools for the pre-issuance / statutory-restatement
// versions of that check). Re-verify this scope decision at any future build touching this file.
//
// Verdict per requirement: MET | NOT_MET | INDETERMINATE (never a monolithic PASS/FAIL —
// row EDGE-GENIUS-1's explicit contract).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-582-genius-reserve-disclosure-conformance-monitor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_genius_reserve_disclosure_conformance',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Statutory monthly cadence — GENIUS Act S.394 §4(b) requires a monthly reserve-composition
// report with independent examination. No final implementing rule specifies an exact
// days-after-period-end filing deadline as of 2026-08-07; this kernel uses a 30-day monthly-cadence
// window as the statute-derived interpretation (dated observation, re-verify against final rule text
// when one publishes — research/GENIUS-FINALRULE-CHECK-2026-08-07.md).
const STATUTORY_ATTESTATION_WINDOW_DAYS = 30;
const COVERAGE_REF = 'GENIUS Act S.394 §4(a) — 1:1 reserve coverage requirement';
const ATTESTATION_REF = 'GENIUS Act S.394 §4(b) — monthly reserve report, independent examination by a registered public accounting firm';

function daysBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * compute(pp) — pure GENIUS Act S.394 §4 narrowed conformance monitor.
 * pp: {
 *   report_period?:               string,        // e.g. '2027-02'
 *   period_end_date?:             string,        // ISO date, e.g. '2027-02-28'
 *   outstanding_tokens_reported?: number,
 *   token_price?:                 number,        // USD par value, default 1.00
 *   total_reserves_usd?:          number,        // pasted/summed reserve total
 *   attestation_present?:         boolean,       // monthly report was published
 *   attestation_date?:            string|null,   // ISO date the report/examination was published
 *   examiner_registered?:         boolean,       // registered public accounting firm named
 *   examiner_name?:               string|null,
 *   onchain_supply_check?:        number|null,   // DECLARED input, informational only — not a verdict
 * }
 */
export function compute(pp) {
  const reportPeriod   = pp.report_period ?? '';
  const periodEndDate  = pp.period_end_date ?? null;
  const tokens         = Number(pp.outstanding_tokens_reported ?? 0);
  const price          = Number(pp.token_price ?? 1);
  const totalReserves  = Number(pp.total_reserves_usd ?? 0);
  const attestationPresent    = pp.attestation_present === true;
  const attestationDate       = pp.attestation_date ?? null;
  const examinerRegistered    = pp.examiner_registered === true;
  const examinerName          = pp.examiner_name ?? null;
  const onchainSupply         = pp.onchain_supply_check ?? null;

  const totalLiabilities = tokens * price;

  // Requirement 1 — 1:1 coverage arithmetic.
  let coverageVerdict, coverageDetail, coverageRatioPct = null, shortfallUsd = null;
  if (tokens <= 0) {
    coverageVerdict = 'INDETERMINATE';
    coverageDetail = 'outstanding_tokens_reported is missing or non-positive — coverage ratio cannot be computed.';
  } else {
    const coverageRatio = totalReserves / totalLiabilities;
    coverageRatioPct = parseFloat((coverageRatio * 100).toFixed(4));
    shortfallUsd = parseFloat(Math.max(0, totalLiabilities - totalReserves).toFixed(2));
    if (coverageRatio >= 1) {
      coverageVerdict = 'MET';
      coverageDetail = `Reserves (${totalReserves.toFixed(2)}) cover ${coverageRatioPct.toFixed(2)}% of outstanding liabilities (${totalLiabilities.toFixed(2)}).`;
    } else {
      coverageVerdict = 'NOT_MET';
      coverageDetail = `Reserves (${totalReserves.toFixed(2)}) cover only ${coverageRatioPct.toFixed(2)}% of outstanding liabilities (${totalLiabilities.toFixed(2)}). Shortfall: ${shortfallUsd.toFixed(2)}.`;
    }
  }

  // Requirement 2 — attestation presence/timeliness.
  let attestationVerdict, attestationDetail, daysAfterPeriodEnd = null;
  if (!attestationPresent) {
    attestationVerdict = 'NOT_MET';
    attestationDetail = 'No monthly reserve report/attestation has been published for this period.';
  } else if (!periodEndDate || !attestationDate) {
    attestationVerdict = 'INDETERMINATE';
    attestationDetail = 'Attestation is marked present but period_end_date or attestation_date is missing — timeliness cannot be evaluated.';
  } else {
    daysAfterPeriodEnd = daysBetween(periodEndDate, attestationDate);
    if (daysAfterPeriodEnd === null) {
      attestationVerdict = 'INDETERMINATE';
      attestationDetail = 'period_end_date or attestation_date could not be parsed as a date.';
    } else if (daysAfterPeriodEnd < 0) {
      attestationVerdict = 'INDETERMINATE';
      attestationDetail = `attestation_date (${attestationDate}) is before period_end_date (${periodEndDate}) — check input data.`;
    } else if (!examinerRegistered) {
      attestationVerdict = 'NOT_MET';
      attestationDetail = `Attestation published ${daysAfterPeriodEnd} day(s) after period end, but no registered public accounting firm is named as examiner.`;
    } else if (daysAfterPeriodEnd > STATUTORY_ATTESTATION_WINDOW_DAYS) {
      attestationVerdict = 'NOT_MET';
      attestationDetail = `Attestation published ${daysAfterPeriodEnd} day(s) after period end, exceeding the ${STATUTORY_ATTESTATION_WINDOW_DAYS}-day statute-derived monthly window.`;
    } else {
      attestationVerdict = 'MET';
      attestationDetail = `Attestation published ${daysAfterPeriodEnd} day(s) after period end by registered examiner${examinerName ? ' (' + examinerName + ')' : ''}, within the ${STATUTORY_ATTESTATION_WINDOW_DAYS}-day statute-derived monthly window.`;
    }
  }

  const requirement_verdicts = [
    { requirement: 'coverage_arithmetic_1to1', verdict: coverageVerdict, detail: coverageDetail, ref: COVERAGE_REF },
    { requirement: 'attestation_presence_timeliness', verdict: attestationVerdict, detail: attestationDetail, ref: ATTESTATION_REF },
  ];

  const verdicts = requirement_verdicts.map(r => r.verdict);
  let overall_determination;
  if (verdicts.includes('NOT_MET')) overall_determination = 'NOT_MET';
  else if (verdicts.includes('INDETERMINATE')) overall_determination = 'INDETERMINATE';
  else overall_determination = 'MET';

  // On-chain supply cross-check — DECLARED input, informational only. No verdict.
  const onchain_supply_check = {
    provided: onchainSupply !== null,
    onchain_supply: onchainSupply,
    reported_outstanding_tokens: tokens,
    match: onchainSupply === null ? null : Math.abs(onchainSupply - tokens) < 0.01,
    delta: onchainSupply === null ? null : parseFloat((onchainSupply - tokens).toFixed(2)),
    note: 'User-pasted on-chain supply figure compared numerically against the reported outstanding-tokens field. Informational only, does not feed a requirement verdict. Never performs a network fetch, zero-fetch and zero-PII.',
  };

  const compliance_flags = [];
  if (overall_determination === 'NOT_MET') compliance_flags.push('GENIUS_CONFORMANCE_NOT_MET');
  if (overall_determination === 'INDETERMINATE') compliance_flags.push('GENIUS_CONFORMANCE_INDETERMINATE');
  if (coverageVerdict === 'NOT_MET') compliance_flags.push('RESERVE_DEFICIENCY');
  if (attestationVerdict === 'NOT_MET' && !attestationPresent) compliance_flags.push('ATTESTATION_MISSING');
  if (attestationVerdict === 'NOT_MET' && attestationPresent) compliance_flags.push('ATTESTATION_LATE_OR_UNEXAMINED');
  if (onchain_supply_check.provided && onchain_supply_check.match === false) compliance_flags.push('ONCHAIN_SUPPLY_MISMATCH');
  if (overall_determination === 'MET') compliance_flags.push('GENIUS_CONFORMANCE_CLEAN');

  const output_payload = {
    overall_determination,
    requirement_verdicts,
    report_period: reportPeriod,
    period_end_date: periodEndDate,
    coverage_ratio_pct: coverageRatioPct,
    total_reserves_usd: totalReserves,
    total_liabilities_usd: totalLiabilities,
    reserve_shortfall_usd: shortfallUsd,
    attestation_present: attestationPresent,
    attestation_date: attestationDate,
    examiner_registered: examinerRegistered,
    examiner_name: examinerName,
    days_after_period_end: daysAfterPeriodEnd,
    statutory_attestation_window_days: STATUTORY_ATTESTATION_WINDOW_DAYS,
    onchain_supply_check,
    scope_note: 'NARROWED 2026-08-07: checks 1:1 coverage arithmetic and attestation presence/timeliness only. The permitted-asset composition check is out of scope pending final GENIUS Act implementing regulations (none exist as of 2026-08-07 — research/GENIUS-FINALRULE-CHECK-2026-08-07.md). Never treated as compliance certification.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
