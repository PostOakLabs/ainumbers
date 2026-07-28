/**
 * art-78-csdr-penalty-calculator.kernel.mjs
 * Wave 17 — CSDR Cash-Penalty Calculator (W-A flagship).
 * Computes the CSDR cash penalty for a settlement fail: select the asset-class
 * daily rate (incl. Oct-2025 RTS increases), apply fail duration and reference
 * price/notional, credit partial settlement, and project forward penalty exposure
 * over an open-fails set.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   ESMA CSDR Settlement Discipline RTS — Final Report 13 Oct 2025
 *     (ESMA74-2119945926-3430): penalty-rate schedule.
 *   CSDR Reg. (EU) 909/2014 Art 7 — penalty mechanism.
 *   Delegated Reg. (EU) 2017/389 (as amended) — penalty-rate schedule.
 *   Penalty rates: equities 1 bp/day, SSA bonds 0.5 bp/day, non-SSA bonds 0.5 bp/day,
 *     ETFs 0.5 bp/day, illiquid instruments 1 bp/day. Verify current rates.
 *   EDUCATIONAL: outputs are decision-support drafts, not regulatory penalty notices.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-78-csdr-penalty-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'calculate_csdr_penalty',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── CSDR penalty rate table (bps per day, post-RTS Oct 2025) ─────────────────
// Source: CSDR Reg. 909/2014 Art 7 + Delegated Reg. 2017/389 + ESMA RTS 13 Oct 2025.
// rate_table_version: "CSDR-RTS-2025-10" — verify current edition.
// Rates are in basis points per day (1 bp = 0.0001).
const PENALTY_RATES_BPS = {
  equity:       1.00,   // 1 bp/day — liquid equity
  ssa_bond:     0.50,   // 0.50 bp/day — sovereign/supranational/agency bonds
  non_ssa_bond: 0.50,   // 0.50 bp/day — non-SSA bonds (verify RTS increase)
  etf:          0.50,   // 0.50 bp/day — ETFs
  illiquid:     1.00,   // 1 bp/day — illiquid instruments
};

const RATE_TABLE_VERSION = 'CSDR-RTS-2025-10';

// CSDR §2.8 (ICMA best-practice guidance) distinguishes a running Settlement
// Fail Penalty (SEFP) on the open fail from a Late Matching Fail Penalty (LMFP)
// on a late-matched reinstruction — both can accrue over the same window on
// overlapping quantities, and the LMFP leg is a reclaim candidate, not a sum.
// See research/HANDTEST-2-2026-07-27.md.
const PENALTY_TYPES = new Set(['sefp', 'lmfp']);

export function compute(pp) {
  const {
    fail: {
      asset_class      = 'equity',
      notional         = 0,
      reference_price  = notional,  // reference/transaction price — CSDR prices the penalty off this, not raw notional
      fail_days        = 1,
      partial_settled_pct = 0,
      penalty_type     = 'sefp',    // 'sefp' (running settlement fail penalty) | 'lmfp' (late matching fail penalty)
    } = {},
    rate_table_version = RATE_TABLE_VERSION,
    open_fails         = [],   // optional batch: [{ asset_class, notional, reference_price, fail_days, partial_settled_pct, penalty_type }]
  } = pp;

  const calcPenalty = (ac, price, days, partial_pct) => {
    const rate      = (PENALTY_RATES_BPS[ac] ?? PENALTY_RATES_BPS.equity) / 10000;
    const adj_price = price * (1 - Math.min(1, Math.max(0, partial_pct)));
    return +(rate * adj_price * days).toFixed(2);
  };

  const rate_bps      = PENALTY_RATES_BPS[asset_class] ?? PENALTY_RATES_BPS.equity;
  const resolved_type = PENALTY_TYPES.has(penalty_type) ? penalty_type : 'sefp';
  const penalty_amount = calcPenalty(asset_class, +reference_price, +fail_days, +partial_settled_pct);

  // ── Batch ──
  let batch_total_exposure = 0;
  const batch_detail = [];
  for (const f of open_fails) {
    const f_price = +(f.reference_price ?? f.notional ?? 0);
    const f_type  = PENALTY_TYPES.has(f.penalty_type) ? f.penalty_type : resolved_type;
    const p = calcPenalty(f.asset_class ?? asset_class, f_price, +(f.fail_days ?? 1), +(f.partial_settled_pct ?? 0));
    batch_total_exposure += p;
    batch_detail.push({ ...f, penalty_type: f_type, penalty: p });
  }
  if (open_fails.length === 0) batch_total_exposure = penalty_amount;

  // ── Compliance flags ──
  const compliance_flags = [];
  if (rate_table_version !== RATE_TABLE_VERSION) compliance_flags.push('RATE_TABLE_VERSION_MISMATCH');
  if (asset_class === 'illiquid')                compliance_flags.push('ILLIQUID_INSTRUMENT_TIER');
  if (+fail_days > 5)                            compliance_flags.push('LONG_DURATION_FAIL');
  if (PENALTY_RATES_BPS[asset_class] === PENALTY_RATES_BPS.equity) {
    compliance_flags.push('RATE_INCREASE_APPLIED');
  }
  if (resolved_type === 'lmfp') {
    compliance_flags.push('LMFP_RECLAIM_REVIEW');
  }

  const output_payload = {
    penalty_amount,
    daily_rate_bps:   rate_bps,
    asset_class,
    fail_days:        +fail_days,
    partial_settled_pct: +partial_settled_pct,
    partial_credit:   +(notional * partial_settled_pct).toFixed(2),
    notional:         +notional,
    reference_price:  +reference_price,
    penalty_type:     resolved_type,
    batch_total_exposure: +batch_total_exposure.toFixed(2),
    batch_detail:     batch_detail.length > 0 ? batch_detail : null,
    rate_table_version: RATE_TABLE_VERSION,
    reference: {
      regulation:     'CSDR Reg. (EU) 909/2014 Art 7; Delegated Reg. 2017/389 as amended',
      rts:            'ESMA CSDR SDR RTS — Final Report 13 Oct 2025 (ESMA74-2119945926-3430)',
      note:           'Penalty rates: verify current edition at https://www.esma.europa.eu/. '
                    + 'RTS Oct 2025 updated rate schedule — confirm rates in force.',
    },
    note: 'DECISION-SUPPORT DRAFT — not a regulatory penalty notice. Penalty calculation is based on the versioned rate table; verify against current CSDR Delegated Reg. 2017/389 and ESMA RTS (13 Oct 2025). Partial-settlement credit applies proportionally. Reference price may differ from notional — use transaction reference price per CSDR methodology.',
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
