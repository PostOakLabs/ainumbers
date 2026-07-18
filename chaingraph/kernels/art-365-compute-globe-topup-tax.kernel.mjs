import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-365-compute-globe-topup-tax';
const TOOL_VERSION = '1.0.0';
const CONSTANTS_VERSION = 'oecd-globe-sbie-2024-2027-transitional-v1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_globe_topup_tax',
  mandate_type: 'compliance_mandate', gpu: false,
};

// OECD Pillar Two GloBE Model Rules -- per-jurisdiction top-up tax and
// IIR/QDMTT/UTPR allocation (ports tools/473-globe-etr-jurisdiction-calculator.html
// ETR/SBIE stage + tools/474-topup-tax-qdmtt-calculator.html topup/allocation stage
// into one kernel, per TOOLIFY-1-BUILD-SPEC.md TF-2).
//
//   SBIE = payroll x sbie_payroll_rate + tangible_assets x 0.05 (assets rate held
//          flat at the steady-state 5% by the source tools regardless of fy --
//          ported as-is, not "corrected", to preserve tool<->kernel parity)
//   ETR  = covered_taxes / globe_income  (0 if income <= 0)
//   income_net_sbie = max(globe_income - SBIE, 0)
//   top_up_rate = max(0.15 - ETR, 0)
//   top_up_amount = income_net_sbie x top_up_rate
//   qdmtt_collected = min(top_up_amount, income_net_sbie x qdmtt_rate) if qdmtt_enacted else 0
//   after_qdmtt = max(top_up_amount - qdmtt_collected, 0)
//   IIR at parent unless parent is US-HQ (OECD Jan-2026 side-by-side exemption);
//   UTPR picks up the US-exempt residual.
//
// SBIE_RATES and GLOBE_MIN_RATE are OECD-published transitional table values
// (Art. 9.1 / Administrative Guidance) pinned behind constants_version below --
// a rate change is a version bump, never a silent recompute.
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no Math.random.

const SBIE_RATES = {
  2024: { payroll: 0.098, assets: 0.078 },
  2025: { payroll: 0.096, assets: 0.064 },
  2026: { payroll: 0.094, assets: 0.050 },
  2027: { payroll: 0.050, assets: 0.050 },
};
const SBIE_ASSETS_RATE = 0.05;
const GLOBE_MIN_RATE = 0.15;

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }

function defaultSbiePayrollRate(fy) {
  const table = SBIE_RATES[fy] || SBIE_RATES[2027];
  return table.payroll;
}

export function compute(pp) {
  pp = pp || {};
  const parentHq = String(pp.parent_hq || '').trim().toUpperCase();
  const fy = Number.isFinite(Number(pp.fy)) ? Math.trunc(Number(pp.fy)) : 2026;
  const usExempt = parentHq === 'US';
  const jurisdictions = Array.isArray(pp.jurisdictions) ? pp.jurisdictions : [];

  const compliance_flags = [];
  const rows = jurisdictions.map((j) => {
    j = j || {};
    const jur = String(j.jur || '').trim().toUpperCase();
    const income = safeNum(j.income, 0);
    const taxes = safeNum(j.taxes, 0);
    const payroll = safeNum(j.payroll, 0);
    const assets = safeNum(j.assets, 0);
    const sbiePayrollRate = j.sbie_payroll_rate != null
      ? safeNum(j.sbie_payroll_rate, defaultSbiePayrollRate(fy))
      : defaultSbiePayrollRate(fy);
    const qdmttEnacted = !!j.qdmtt_enacted;
    const qdmttRate = safeNum(j.qdmtt_rate, 0);

    const sbie = r6(payroll * sbiePayrollRate + assets * SBIE_ASSETS_RATE);
    const incomeNetSbie = r6(Math.max(income - sbie, 0));
    const etr = income > 0 ? taxes / income : 0;
    const belowMin = etr < GLOBE_MIN_RATE;
    const topUpRate = belowMin ? r6(GLOBE_MIN_RATE - etr) : 0;
    const topUpAmount = r6(incomeNetSbie * topUpRate);
    const qdmttCollected = qdmttEnacted ? r6(Math.min(topUpAmount, incomeNetSbie * qdmttRate)) : 0;
    const afterQdmtt = r6(Math.max(topUpAmount - qdmttCollected, 0));
    const iirCollected = usExempt ? 0 : afterQdmtt;
    const utprCollected = usExempt ? afterQdmtt : 0;

    if (income <= 0) compliance_flags.push(`GLOBE_ZERO_INCOME_JURISDICTION:${jur || 'UNKNOWN'}`);

    return {
      jur, income: r6(income), taxes: r6(taxes), payroll: r6(payroll), assets: r6(assets),
      sbie_payroll_rate: sbiePayrollRate, sbie, income_net_sbie: incomeNetSbie,
      etr: r6(etr), below_min_etr: belowMin, top_up_rate: topUpRate, top_up_amount: topUpAmount,
      qdmtt_enacted: qdmttEnacted, qdmtt_rate: qdmttRate, qdmtt_collected: qdmttCollected,
      iir_collected: iirCollected, utpr_collected: utprCollected,
    };
  });

  const totalIncome = r6(rows.reduce((s, r) => s + r.income, 0));
  const totalTaxes = r6(rows.reduce((s, r) => s + r.taxes, 0));
  const aggEtr = totalIncome > 0 ? r6(totalTaxes / totalIncome) : 0;
  const lowEtrCount = rows.filter((r) => r.below_min_etr).length;
  const totalTopUp = r6(rows.reduce((s, r) => s + r.top_up_amount, 0));
  const totalQdmtt = r6(rows.reduce((s, r) => s + r.qdmtt_collected, 0));
  const totalIir = r6(rows.reduce((s, r) => s + r.iir_collected, 0));
  const totalUtpr = r6(rows.reduce((s, r) => s + r.utpr_collected, 0));

  if (lowEtrCount > 0) compliance_flags.push('GLOBE_TOPUP_DUE');

  const output_payload = {
    parent_hq: parentHq, fy, us_exempt: usExempt,
    jurisdictions: rows,
    total_income: totalIncome, total_taxes: totalTaxes, aggregate_etr: aggEtr, low_etr_count: lowEtrCount,
    total_top_up_tax: totalTopUp, total_qdmtt_collected: totalQdmtt,
    total_iir_collected: totalIir, total_utpr_collected: totalUtpr,
    constants_version: CONSTANTS_VERSION,
    globe_min_rate: GLOBE_MIN_RATE,
    regulatory_basis: 'OECD Pillar Two GloBE Model Rules (Dec 2021) + GloBE Commentary (Mar 2022) + Administrative Guidance (2023-2024) + OECD side-by-side package US IIR/UTPR exemption (Jan 2026)',
    note: 'SBIE payroll rate defaults to the OECD transitional table for fy when not supplied; the tangible-assets SBIE rate is held at the published steady-state 5% regardless of fy, matching the source tools. Jurisdiction-level qdmtt_rate/qdmtt_enacted are caller-supplied, not vendored.',
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
