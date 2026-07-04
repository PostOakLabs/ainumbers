import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-232-compute-scra-rate-cap';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_scra_rate_cap',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── SCRA Interest Rate Cap Calculator ──────────────────────────────────────
// Servicemembers Civil Relief Act (SCRA) 50 USC §3937 (formerly §527):
//   Caps interest rate on pre-service obligations at 6% per year during and
//   after qualifying active-duty service periods. The excess over 6% is FORGIVEN,
//   not deferred. The cap also applies retroactively from activation date.
//
// Key provisions (50 USC §3937):
//   (a)(1): No obligation exceeding 6% interest during active-duty period.
//   (a)(2): Excess interest FORGIVEN (creditor may not collect deferred interest).
//   (b)(1): Creditor shall forgive the difference between the contractual rate
//           and 6% for the covered period.
//   (d): Member must provide written notice + copy of military orders within
//        180 days of the end of military service.
//
// Rate cap applies to: mortgages, car loans, credit cards, student loans,
//   pre-service business obligations. Does NOT apply to obligations incurred
//   during active duty.
//
// Retroactive delta: if activation date is before first payment, excess
//   interest already charged must be refunded/credited retroactively.
// table_version: "SCRA-50USC3937-2024"

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 1e2) / 1e2 : 0; }

const SCRA_CAP_PCT = 6.0; // 50 USC §3937(a)(1)

export function compute(pp) {
  pp = pp || {};

  const original_rate_pct = Math.max(0, safeNum(pp.original_rate_pct, 0));
  const loan_balance = Math.max(0, safeNum(pp.loan_balance, 0));
  const covered_months = Math.max(0, Math.round(safeNum(pp.covered_months, 0)));
  const is_pre_service_obligation = Boolean(pp.is_pre_service_obligation !== false);
  const servicemember_notified = Boolean(pp.servicemember_notified);

  // Guard: empty inputs return finite zero-state
  if (original_rate_pct === 0 && loan_balance === 0) {
    return {
      output_payload: {
        original_rate_pct: 0,
        capped_rate_pct: SCRA_CAP_PCT,
        excess_rate_pct: 0,
        exceeds_cap: false,
        excess_forgiven: true,
        total_interest_at_original_rate: 0,
        total_interest_at_cap: 0,
        interest_delta_forgiven: 0,
        retroactive_credit: 0,
        covered_months: 0,
        loan_balance: 0,
        is_pre_service_obligation,
        servicemember_notified,
        regulatory_basis: '50 USC §3937 (SCRA); formerly Soldiers and Sailors Civil Relief Act 50 USC §527; DoD Financial Management Regulation 7000.14-R Vol 7A Chapter 40',
        table_version: 'SCRA-50USC3937-2024',
        table_source: '50 USC §3937 (SCRA, codified 2003); 50 USC §3937(a)(1) 6% rate cap; 50 USC §3937(a)(2) excess forgiven not deferred; Pub. L. 108-189 §108-189 (Dec 19, 2003)',
        pii_note: 'All inputs are processed locally in your browser. No data is transmitted.',
      },
      compliance_flags: [],
    };
  }

  const effective_cap = Math.min(original_rate_pct, SCRA_CAP_PCT);
  const excess_rate_pct = Math.max(0, r4(original_rate_pct - SCRA_CAP_PCT));
  const exceeds_cap = original_rate_pct > SCRA_CAP_PCT;

  // Interest calculations (simple interest for coverage period)
  // total_interest = balance * rate_pct/100 * covered_months/12
  const total_interest_at_original = loan_balance > 0 && covered_months > 0
    ? r2(loan_balance * (original_rate_pct / 100) * (covered_months / 12))
    : 0;
  const total_interest_at_cap = loan_balance > 0 && covered_months > 0
    ? r2(loan_balance * (SCRA_CAP_PCT / 100) * (covered_months / 12))
    : 0;
  const interest_delta_forgiven = r2(total_interest_at_original - total_interest_at_cap);

  // Retroactive credit: same as interest delta if excess was already collected
  const retroactive_credit = exceeds_cap ? interest_delta_forgiven : 0;

  const compliance_flags = [];
  if (exceeds_cap && is_pre_service_obligation) {
    compliance_flags.push('SCRA_RATE_EXCEEDS_6PCT_CAP');
    if (interest_delta_forgiven > 0) compliance_flags.push('SCRA_EXCESS_INTEREST_MUST_BE_FORGIVEN');
  }
  if (!servicemember_notified) {
    compliance_flags.push('SCRA_BORROWER_NOTICE_PENDING');
  }
  if (!is_pre_service_obligation) {
    compliance_flags.push('SCRA_NOT_APPLICABLE_POST_SERVICE_OBLIGATION');
  }

  const output_payload = {
    original_rate_pct,
    capped_rate_pct: SCRA_CAP_PCT,
    effective_rate_pct: exceeds_cap ? SCRA_CAP_PCT : original_rate_pct,
    excess_rate_pct,
    exceeds_cap,
    excess_forgiven: true, // 50 USC §3937(a)(2) -- always forgiven, not deferred
    total_interest_at_original_rate: total_interest_at_original,
    total_interest_at_cap,
    interest_delta_forgiven,
    retroactive_credit,
    covered_months,
    loan_balance,
    is_pre_service_obligation,
    servicemember_notified,
    scra_note: 'Per 50 USC §3937(a)(2), excess interest above 6% must be forgiven -- creditor may not collect deferred excess after active duty ends. This is not a deferral.',
    regulatory_basis: '50 USC §3937 (SCRA); formerly Soldiers and Sailors Civil Relief Act 50 USC §527; DoD Financial Management Regulation 7000.14-R Vol 7A Chapter 40',
    table_version: 'SCRA-50USC3937-2024',
    table_source: '50 USC §3937 (SCRA codified 2003, Pub. L. 108-189 Dec 19 2003); 50 USC §3937(a)(1) 6% annual rate cap; 50 USC §3937(a)(2) excess forgiven not deferred; 50 USC §3937(d) 180-day notice requirement',
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
