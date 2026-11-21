// art-582 — GENIUS Act Reserve-Disclosure Conformance Monitor: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-582-genius-reserve-disclosure-conformance-monitor.html
// Pure: no DOM, no window, no network.
//
// NARROWED SCOPE (Tim's ruling 2026-08-07, EDGE-WAVE-BUILD-SPEC.md, research/GENIUS-FINALRULE-CHECK-2026-08-07.md;
// updated 2026-10-29, LANDSCAPE-ART582-FINAL-RULE-FIX-1): The OCC issued its final implementing rule
// on 2026-10-21 (Bulletin 2026-50, effective 2027-01-18); final rules of the other
// primary Federal payment stablecoin regulators were not checked. This kernel checks ONLY the two
// statute-derived requirements it always checked: 1:1 reserve coverage arithmetic and attestation
// presence/timeliness against the statutory monthly cadence. The permitted-asset COMPOSITION check
// stays OUT OF SCOPE in this row (see the shipped art-06 / art-275 tools for the pre-issuance /
// statutory-restatement versions of that check). Re-verify this scope decision at any future build
// touching this file.
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

// Statutory monthly cadence — GENIUS Act, Pub. L. 119-27 (S.1582), Section 4(a)(3) requires a monthly reserve-composition
// report with independent examination. The OCC final rule of 2026-10-21 sets the monthly
// composition-report timing at publication by noon on the last day of each month of data as of noon on the
// last day of the previous month (paragraph (e)(1) of its reserve-asset section) and states no
// days-after-period-end number, so the 30-day
// monthly-cadence window stays as this kernel's interpretation (LANDSCAPE-ART582-FINAL-RULE-FIX-1, 2026-10-29).
const STATUTORY_ATTESTATION_WINDOW_DAYS = 30;
const COVERAGE_REF = 'GENIUS Act, Pub. L. 119-27 (S.1582) §4(a) — 1:1 reserve coverage requirement';
const ATTESTATION_REF = 'GENIUS Act, Pub. L. 119-27 (S.1582) §4(a)(3) — monthly reserve report, independent examination by a registered public accounting firm';

function daysBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * compute(pp) — pure GENIUS Act, Pub. L. 119-27 (S.1582) §4 narrowed conformance monitor.
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
    scope_note: 'NARROWED 2026-08-07, updated 2026-10-29: checks 1:1 coverage arithmetic and attestation presence/timeliness only; the permitted-asset composition check is out of scope in this row. The OCC issued its final implementing rule on 2026-10-21 (Bulletin 2026-50, 12 CFR Part 15, effective 2027-01-18); final rules of the other primary Federal payment stablecoin regulators were not checked. Never treated as compliance certification.',
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
