// art-06 — GENIUS Act Reserve Attestation Pre-Check: pure decision kernel.
// Faithful port of runAttestation() in
//   repo/chaingraph/art-06-genius-act-reserve-attestation.html
// Pure: no DOM, no window, no network.
// GENIUS Act S.394 · AICPA 2025 Attestation Criteria.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-06-genius-act-reserve-attestation';
const TOOL_VERSION = '1.0.0';

// Asset type definitions — GENIUS Act S.394 §4(a)
// eligibility: 'permitted' | 'conditional' | 'prohibited'
// maturityRequired: true = maturityDays field must be ≤ maxMaturityDays
const ASSET_TYPES = [
  { value:'us_coins_currency',   label:'US coins and currency',                    eligibility:'permitted',   maturityRequired:false, maxMaturityDays:null },
  { value:'demand_deposit',      label:'Demand deposit — insured depository inst.',eligibility:'permitted',   maturityRequired:false, maxMaturityDays:null },
  { value:'tbill',               label:'US Treasury Bill',                         eligibility:'permitted',   maturityRequired:true,  maxMaturityDays:93   },
  { value:'tnote_tbond',         label:'US Treasury Note / Bond',                  eligibility:'permitted',   maturityRequired:false, maxMaturityDays:null },
  { value:'agency_mbs',          label:'US agency / GSE securities',               eligibility:'conditional', maturityRequired:false, maxMaturityDays:null },
  { value:'repo_treasury',       label:'Repo secured by US Treasuries',            eligibility:'permitted',   maturityRequired:true,  maxMaturityDays:93   },
  { value:'mmmf',                label:'Money market mutual fund (Treasury-only)', eligibility:'permitted',   maturityRequired:false, maxMaturityDays:null },
  { value:'fed_reserve_balance', label:'Federal Reserve balance / master account', eligibility:'permitted',   maturityRequired:false, maxMaturityDays:null },
  { value:'other_fiat',          label:'Foreign fiat currency / foreign T-bills',  eligibility:'prohibited',  maturityRequired:false, maxMaturityDays:null },
  { value:'crypto_asset',        label:'Crypto asset (BTC/ETH/other)',             eligibility:'prohibited',  maturityRequired:false, maxMaturityDays:null },
  { value:'corporate_bond',      label:'Corporate bond / commercial paper',        eligibility:'prohibited',  maturityRequired:false, maxMaturityDays:null },
  { value:'other',               label:'Other / unclassified',                     eligibility:'conditional', maturityRequired:false, maxMaturityDays:null },
];
const ASSET_MAP = Object.fromEntries(ASSET_TYPES.map(a => [a.value, a]));

// AICPA 2025 attestation checklist — total weighted points: 19
const AICPA_ITEMS = [
  { id:'a1',  weight:2 }, // tokens outstanding identified
  { id:'a2',  weight:2 }, // reserve asset categories with USD value
  { id:'a3',  weight:1 }, // custodian name/location disclosed
  { id:'a4',  weight:1 }, // outstanding issuance series disclosed
  { id:'a5',  weight:2 }, // CEO/CFO certification prepared
  { id:'a6',  weight:2 }, // CEO/CFO explicitly attests ≥100% permitted assets
  { id:'a7',  weight:2 }, // independent PCAOB/AICPA firm engaged
  { id:'a8',  weight:1 }, // management written assertion prepared
  { id:'a9',  weight:2 }, // issuance/redemption controls documented
  { id:'a10', weight:2 }, // reserve asset segregation procedures exist
  { id:'a11', weight:1 }, // publication policy exists
  { id:'a12', weight:1 }, // internal audit/compliance review scheduled
];

/**
 * compute(pp) — pure GENIUS Act attestation readiness engine.
 * pp: {
 *   issuer_name?:        string,
 *   outstanding_tokens:  number,   // tokens in circulation
 *   token_price?:        number,   // USD par value, default 1.00
 *   issuer_type?:        'bank' | 'nonbank_federal' | 'nonbank_state',
 *   report_month?:       string,
 *   assets?:             Array<{ type: string, usd: number, maturity?: number|null, custodian?: string }>,
 *   aicpa_answers?:      Record<string, boolean|null>,  // a1–a12
 * }
 */
export function compute(pp) {
  const tokens     = Number(pp.outstanding_tokens ?? 0);
  const price      = Number(pp.token_price ?? 1);
  const issuerType = pp.issuer_type ?? 'nonbank_state';
  const assets     = pp.assets ?? [];
  const aicpaAnswers = pp.aicpa_answers ?? {};

  const totalLiab    = tokens * price;
  const totalReserve = assets.reduce((s, a) => s + Number(a.usd ?? 0), 0);
  const coverageRatio = totalLiab > 0 ? totalReserve / totalLiab : 0;

  // Per-asset eligibility analysis
  const assetResults = assets.map(a => {
    const def = ASSET_MAP[a.type] ?? ASSET_MAP['other'];
    const issues = [];
    if (def.eligibility === 'prohibited') {
      issues.push(`${def.label} is not a permitted reserve asset under GENIUS Act S.394 §4(a)`);
    } else if (def.eligibility === 'conditional') {
      if (a.type === 'agency_mbs' && issuerType !== 'bank') {
        issues.push('Agency/GSE securities are only permitted for insured depository institution issuers');
      } else if (a.type !== 'agency_mbs') {
        issues.push(`${def.label}: verify eligibility with counsel — classified as conditional`);
      }
    }
    if (def.maturityRequired && def.maxMaturityDays != null) {
      const mat = a.maturity != null ? Number(a.maturity) : null;
      if (mat === null) {
        issues.push(`Maturity not specified — ${def.label} requires maturity ≤ ${def.maxMaturityDays} days`);
      } else if (mat > def.maxMaturityDays) {
        issues.push(`Maturity ${mat} days exceeds ${def.maxMaturityDays}-day limit for ${def.label}`);
      }
    }
    const pct = totalReserve > 0 ? (Number(a.usd ?? 0) / totalReserve * 100) : 0;
    return { type: a.type, usd: Number(a.usd ?? 0), maturity: a.maturity ?? null, def, issues, has_fail: issues.length > 0, pct: parseFloat(pct.toFixed(2)) };
  });

  const prohibitedTotal  = assetResults.filter(a => a.def.eligibility === 'prohibited').reduce((s, a) => s + a.usd, 0);
  const conditionalTotal = assetResults.filter(a => a.def.eligibility === 'conditional' && a.has_fail).reduce((s, a) => s + a.usd, 0);

  // AICPA 2025 attestation score
  let aicpaEarned = 0, aicpaTotal = 0;
  const aicpaMissing = [];
  for (const item of AICPA_ITEMS) {
    aicpaTotal += item.weight;
    if (aicpaAnswers[item.id] === true) aicpaEarned += item.weight;
    else if (aicpaAnswers[item.id] === false) aicpaMissing.push(item);
  }
  const aicpaScore = aicpaTotal > 0 ? aicpaEarned / aicpaTotal : 1;

  // Failing dimensions
  const failingDimensions = [];
  if (coverageRatio < 1) {
    failingDimensions.push({
      dim: 'Coverage ratio < 100%',
      detail: `Reserves (${totalReserve.toFixed(2)}) cover only ${(coverageRatio * 100).toFixed(2)}% of outstanding tokens. Shortfall: ${(totalLiab - totalReserve).toFixed(2)}.`,
      ref: 'GENIUS Act S.394 §4(a)',
    });
  }
  for (const a of assetResults.filter(r => r.has_fail)) {
    for (const issue of a.issues) {
      failingDimensions.push({ dim: `Asset issue — ${a.def.label}`, detail: issue, ref: 'GENIUS Act S.394 §4(a)' });
    }
  }
  for (const item of aicpaMissing.filter(i => i.weight > 1)) {
    failingDimensions.push({ dim: `AICPA attestation — ${item.id.toUpperCase()}`, detail: 'Required attestation item not met', ref: 'AICPA 2025 Criteria' });
  }

  // Determination
  const highWeightAicpaFail = AICPA_ITEMS.filter(i => i.weight > 1).some(i => aicpaAnswers[i.id] === false);
  let determination;
  if (coverageRatio < 1 || prohibitedTotal > 0 || highWeightAicpaFail) determination = 'FAIL';
  else if (conditionalTotal > 0 || aicpaScore < 0.80)                  determination = 'WARN';
  else                                                                   determination = 'PASS';

  const output_payload = {
    attestation_readiness_determination: determination,
    coverage_ratio_pct:     parseFloat((coverageRatio * 100).toFixed(4)),
    total_reserves_usd:     totalReserve,
    total_liabilities_usd:  totalLiab,
    reserve_shortfall_usd:  parseFloat(Math.max(0, totalLiab - totalReserve).toFixed(2)),
    prohibited_assets_usd:  prohibitedTotal,
    conditional_assets_usd: conditionalTotal,
    aicpa_2025_score_pct:   Math.round(aicpaScore * 100),
    asset_results:          assetResults.map(a => ({ type: a.type, usd: a.usd, pct: a.pct, eligibility: a.def.eligibility, has_fail: a.has_fail, issues: a.issues })),
    failing_dimensions:     failingDimensions,
    applicable_deadline:    '2027-01-18',
    regulatory_framework:   'GENIUS Act S.394 · AICPA 2025 Attestation Criteria',
  };

  const compliance_flags = determination === 'FAIL'
    ? ['GENIUS_ACT_ATTESTATION_FAIL', 'RESERVE_DEFICIENCY']
    : determination === 'WARN'
      ? ['GENIUS_ACT_ATTESTATION_WARN', 'CONDITIONAL_ASSETS_PRESENT']
      : ['GENIUS_ACT_ATTESTATION_READY'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       'attestation_mandate',
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'attestation_mandate' };
