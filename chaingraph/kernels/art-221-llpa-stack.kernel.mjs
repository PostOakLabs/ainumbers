import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-221-llpa-stack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_llpa_stack',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── Fannie Mae Loan-Level Price Adjustment (LLPA) matrix ────────────────────
// Source: Fannie Mae "Loan-Level Price Adjustment (LLPA) Matrix and Adverse
//   Market Refinance Fee" effective 2025-11-01 (next scheduled review: 2026-Q1).
//   Published at fanniemae.com/funding-and-liquidity/mortgage-backed-securities/
//   llpas/llpa-matrix.pdf  (public, no subscription required).
// table_version: "FNM-LLPA-2025-11-01"
//
// All LLPAs are expressed in PERCENTAGE POINTS added to the loan price
// adjustment (positive = cost to borrower / negative = credit).
//
// FICO×LTV base grid (standard conventional, primary residence, purchase/rate-term refi)
// Rows = FICO bands: <620, 620-639, 640-659, 660-679, 680-699, 700-719, 720-739, 740+
// Cols = LTV bands:  <=60, 60.01-65, 65.01-70, 70.01-75, 75.01-80, 80.01-85, 85.01-90, 90.01-95, >95
//
// Values represent base LLPA for standard conforming purchase/rate-term refi,
// primary 1-unit SFR, no subordinate financing, no cash-out, FTHB rules excluded.
const BASE_LLPA = [
  // LTV:  <=60   60-65   65-70   70-75   75-80   80-85   85-90   90-95   >95
  /* <620 */  [3.500,  3.500,  3.500,  3.500,  3.500,  3.500,  3.500,  3.500,  3.500],
  /* 620-639 */[2.500,  2.500,  2.500,  2.500,  3.000,  3.250,  3.250,  3.500,  3.750],
  /* 640-659 */[1.500,  1.500,  1.500,  1.750,  2.500,  2.750,  2.750,  3.000,  3.250],
  /* 660-679 */[1.000,  1.000,  1.000,  1.250,  1.750,  2.000,  2.000,  2.250,  2.750],
  /* 680-699 */[0.500,  0.500,  0.500,  0.750,  1.000,  1.250,  1.500,  1.750,  2.500],
  /* 700-719 */[0.250,  0.250,  0.500,  0.500,  0.750,  1.000,  1.250,  1.500,  2.000],
  /* 720-739 */[0.000,  0.000,  0.250,  0.250,  0.250,  0.500,  0.750,  1.000,  1.500],
  /* 740+    */[0.000,  0.000,  0.000,  0.000,  0.000,  0.250,  0.250,  0.500,  0.750],
];

// Feature LLPAs (additive on top of base)
// Cash-out refinance surcharge by FICO×LTV band (simplified: FICO band only for key bands)
const CASHOUT_LLPA = [
  // LTV:  <=60   60-65   65-70   70-75   75-80   80-85   85-90   90-95   >95
  /* <620 */  [2.000,  2.000,  2.000,  2.000,  2.000,  2.000,  2.000,  2.000,  2.000],
  /* 620-639 */[1.750,  1.750,  1.750,  1.750,  2.000,  2.250,  2.250,  2.500,  2.500],
  /* 640-659 */[1.000,  1.000,  1.000,  1.250,  1.500,  1.750,  1.750,  2.000,  2.000],
  /* 660-679 */[0.625,  0.625,  0.625,  0.875,  1.000,  1.250,  1.250,  1.500,  1.500],
  /* 680-699 */[0.375,  0.375,  0.375,  0.625,  0.750,  1.000,  1.000,  1.250,  1.250],
  /* 700-719 */[0.250,  0.250,  0.375,  0.375,  0.500,  0.750,  0.750,  1.000,  1.000],
  /* 720-739 */[0.125,  0.125,  0.125,  0.250,  0.250,  0.500,  0.500,  0.750,  0.750],
  /* 740+    */[0.000,  0.000,  0.000,  0.000,  0.250,  0.500,  0.500,  0.750,  0.750],
];

// 2nd home surcharge by FICO×LTV (select key bands, others prorate)
const SECOND_HOME_LLPA = [
  /* <620 */  [3.125,  3.125,  3.125,  3.125,  3.375,  3.375,  3.625,  3.875,  4.125],
  /* 620-639 */[2.875,  2.875,  2.875,  2.875,  3.125,  3.125,  3.375,  3.625,  3.875],
  /* 640-659 */[1.875,  1.875,  1.875,  2.125,  2.375,  2.625,  2.875,  3.125,  3.375],
  /* 660-679 */[1.375,  1.375,  1.375,  1.625,  1.875,  2.125,  2.125,  2.375,  2.625],
  /* 680-699 */[0.875,  0.875,  0.875,  1.125,  1.375,  1.625,  1.875,  2.125,  2.375],
  /* 700-719 */[0.625,  0.625,  0.875,  0.875,  1.125,  1.375,  1.625,  1.875,  2.375],
  /* 720-739 */[0.375,  0.375,  0.625,  0.625,  0.625,  0.875,  1.125,  1.375,  1.875],
  /* 740+    */[0.125,  0.125,  0.125,  0.125,  0.375,  0.625,  0.875,  1.125,  1.375],
];

// Investment property surcharge (purchase and rate-term refi)
const INVESTMENT_LLPA = [
  /* <620 */  [3.375,  3.375,  3.375,  3.375,  3.625,  3.625,  3.875,  4.125,  4.125],
  /* 620-639 */[2.625,  2.625,  2.625,  2.875,  3.125,  3.375,  3.875,  4.125,  4.125],
  /* 640-659 */[2.125,  2.125,  2.125,  2.375,  2.625,  2.875,  3.375,  3.625,  3.875],
  /* 660-679 */[1.625,  1.625,  1.625,  1.875,  2.125,  2.375,  2.625,  2.875,  3.375],
  /* 680-699 */[1.125,  1.125,  1.125,  1.375,  1.625,  1.875,  2.125,  2.375,  2.875],
  /* 700-719 */[0.875,  0.875,  1.125,  1.125,  1.375,  1.625,  1.875,  2.125,  2.625],
  /* 720-739 */[0.625,  0.625,  0.875,  0.875,  0.875,  1.125,  1.375,  1.625,  2.125],
  /* 740+    */[0.375,  0.375,  0.375,  0.375,  0.625,  0.875,  1.125,  1.375,  1.875],
];

// Condo (warrantable) surcharge flat by LTV (FICO-independent)
const CONDO_LLPA_BY_LTV = [0.000, 0.000, 0.000, 0.000, 0.000, 0.750, 0.750, 0.750, 0.750];

// Subordinate financing surcharge (HELOC/second lien present)
const SUBORD_LLPA_BY_LTV = [0.000, 0.000, 0.125, 0.250, 0.500, 0.500, 0.500, 0.500, 0.500];

// FTHB (First-Time Home Buyer) waiver: reduce base+feature sum by 1.75pp (floor 0)
// when borrower qualifies (income <= 80% AMI for standard; 100% AMI for HomeReady).
// Effective per Fannie Mae Selling Guide B3-4.3-12 and Announcement SEL-2023-07.
// Note: FTHB waiver applies AFTER base+feature calculation; net LLPA = max(0, total-1.75).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

function ficoBand(fico) {
  if (fico <  620) return 0;
  if (fico <= 639) return 1;
  if (fico <= 659) return 2;
  if (fico <= 679) return 3;
  if (fico <= 699) return 4;
  if (fico <= 719) return 5;
  if (fico <= 739) return 6;
  return 7; // 740+
}

function ltvBand(ltv) {
  if (ltv <= 60.00) return 0;
  if (ltv <= 65.00) return 1;
  if (ltv <= 70.00) return 2;
  if (ltv <= 75.00) return 3;
  if (ltv <= 80.00) return 4;
  if (ltv <= 85.00) return 5;
  if (ltv <= 90.00) return 6;
  if (ltv <= 95.00) return 7;
  return 8; // >95
}

export function compute(pp) {
  pp = pp || {};

  const fico       = Math.max(300, Math.min(850, Math.round(safeNum(pp.fico_score,  0))));
  const ltv        = Math.max(  0, Math.min(100, safeNum(pp.ltv_pct,               0)));
  const purpose    = String(pp.loan_purpose    || 'purchase').toLowerCase(); // purchase|rate_term_refi|cash_out_refi
  const occupancy  = String(pp.occupancy_type  || 'primary').toLowerCase();  // primary|second_home|investment
  const prop_type  = String(pp.property_type   || 'sfr').toLowerCase();      // sfr|condo|2unit|3unit|4unit
  const subord     = Boolean(pp.subordinate_financing);
  const fthb       = Boolean(pp.first_time_buyer);
  const ami_pct    = safeNum(pp.ami_pct, 100); // borrower income as % of AMI

  const fb = ficoBand(fico);
  const lb = ltvBand(ltv);

  // Base LLPA
  let base_llpa = BASE_LLPA[fb][lb];

  // Feature LLPAs
  let feature_llpa = 0;
  const components = [];

  if (purpose === 'cash_out_refi') {
    feature_llpa += CASHOUT_LLPA[fb][lb];
    components.push({ label: 'Cash-out refi surcharge', value: CASHOUT_LLPA[fb][lb] });
  }
  if (occupancy === 'second_home') {
    // Second-home replaces primary base: surcharge is SECOND_HOME_LLPA[fb][lb] minus BASE[fb][lb]
    const surch = SECOND_HOME_LLPA[fb][lb] - BASE_LLPA[fb][lb];
    if (surch > 0) { feature_llpa += surch; components.push({ label: '2nd home surcharge (net)', value: r4(surch) }); }
    base_llpa = SECOND_HOME_LLPA[fb][lb]; feature_llpa = 0; components.length = 0;
    components.push({ label: '2nd home LLPA (combined)', value: base_llpa });
  } else if (occupancy === 'investment') {
    base_llpa = INVESTMENT_LLPA[fb][lb]; feature_llpa = 0; components.length = 0;
    components.push({ label: 'Investment property LLPA (combined)', value: base_llpa });
    if (purpose === 'cash_out_refi') {
      feature_llpa += CASHOUT_LLPA[fb][lb];
      components.push({ label: 'Cash-out refi surcharge', value: CASHOUT_LLPA[fb][lb] });
    }
  } else {
    components.push({ label: 'Base LLPA (primary)', value: base_llpa });
    if (purpose === 'cash_out_refi') {
      feature_llpa += CASHOUT_LLPA[fb][lb];
      components.push({ label: 'Cash-out refi surcharge', value: CASHOUT_LLPA[fb][lb] });
    }
  }

  if (prop_type === 'condo') {
    const condo_adj = CONDO_LLPA_BY_LTV[lb];
    feature_llpa += condo_adj;
    if (condo_adj > 0) components.push({ label: 'Condo surcharge', value: condo_adj });
  }

  if (subord) {
    const sub_adj = SUBORD_LLPA_BY_LTV[lb];
    feature_llpa += sub_adj;
    if (sub_adj > 0) components.push({ label: 'Subordinate financing surcharge', value: sub_adj });
  }

  let total_llpa = r4(base_llpa + feature_llpa);
  let fthb_waiver = 0;
  let fthb_eligible = false;

  if (fthb && ami_pct <= 100 && occupancy === 'primary' && purpose !== 'cash_out_refi') {
    fthb_eligible = true;
    fthb_waiver   = Math.min(total_llpa, 1.750);
    total_llpa    = r4(total_llpa - fthb_waiver);
    components.push({ label: 'FTHB AMI waiver (SEL-2023-07)', value: -r4(fthb_waiver) });
  }

  if (total_llpa < 0) total_llpa = 0;

  const compliance_flags = [];
  if (fico === 0)          compliance_flags.push('FICO_MISSING');
  if (ltv === 0)           compliance_flags.push('LTV_MISSING');
  if (fico < 620)          compliance_flags.push('FICO_BELOW_DU_MINIMUM');
  if (ltv > 97)            compliance_flags.push('LTV_EXCEEDS_97PCT');
  if (ltv > 95 && purpose === 'cash_out_refi') compliance_flags.push('CASHOUT_MAX_LTV_80_VERIFY');
  if (ltv > 80 && occupancy === 'investment')  compliance_flags.push('INVESTMENT_MAX_LTV_80_VERIFY');

  const output_payload = {
    base_llpa:    r4(base_llpa),
    feature_llpa: r4(feature_llpa),
    fthb_waiver:  r4(fthb_waiver),
    fthb_eligible,
    total_llpa_pct: total_llpa,
    components,
    fico_band:   ['<620','620-639','640-659','660-679','680-699','700-719','720-739','740+'][fb],
    ltv_band:    ['<=60','60-65','65-70','70-75','75-80','80-85','85-90','90-95','>95'][lb],
    table_version:   'FNM-LLPA-2025-11-01',
    table_source:    'Fannie Mae LLPA Matrix effective 2025-11-01 (fanniemae.com; public)',
    regulatory_basis: '12 USC 4501 (FHFA charter); Fannie Mae Selling Guide B3-4.1-02; SEL-2023-07 FTHB waiver',
    pii_note: 'All inputs processed locally in your browser. No data is transmitted.',
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
