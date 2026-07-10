// art-275 — GENIUS Act Monthly Reserve Disclosure Checker: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-275-genius-reserve-disclosure-checker.html
// Pure: no DOM, no window, no network.
// GENIUS Act S.394 §4 — post-issuance MONTHLY reserve disclosure (successor to the
// pre-issuance art-06 attestation pre-check; do not conflate the two tools).
// Linter of EXTRACTED disclosure fields only — NEVER claims cryptographic
// verification of the source PDF filing.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-275-genius-reserve-disclosure-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_genius_reserve_disclosure',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Asset composition categories — GENIUS Act S.394 §4(a) permitted-reserve-asset classes.
// Mirrors art-06's table (clean-room reimplementation; kernels may only import _hash.mjs).
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

function analyzeAssets(assets, issuerType) {
  const totalReserve = assets.reduce((s, a) => s + Number(a.usd ?? 0), 0);
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
    return {
      type: a.type, usd: Number(a.usd ?? 0), maturity: a.maturity ?? null,
      custodian: a.custodian ?? null, def, issues, has_fail: issues.length > 0,
      pct: parseFloat(pct.toFixed(2)),
    };
  });
  return { totalReserve, assetResults };
}

/**
 * compute(pp) — pure GENIUS Act §4 monthly reserve disclosure linter.
 * pp: {
 *   report_month?:              string,   // e.g. '2027-02'
 *   outstanding_tokens_reported: number,
 *   token_price?:                number,   // USD par value, default 1.00
 *   issuer_type?:                'bank' | 'nonbank_federal' | 'nonbank_state',
 *   assets?:                     Array<{ type, usd, maturity?, custodian? }>,
 *   ceo_cfo_certification_present?: boolean,
 *   registered_examiner_named?:  boolean,
 *   examiner_name?:              string,
 *   onchain_supply_check?:       number|null,  // user-pasted on-chain supply figure
 *   prior_month?: {
 *     report_month: string,
 *     outstanding_tokens_reported: number,
 *     assets: Array<{ type, usd }>,
 *   },
 * }
 */
export function compute(pp) {
  const reportMonth  = pp.report_month ?? '';
  const tokens        = Number(pp.outstanding_tokens_reported ?? 0);
  const price         = Number(pp.token_price ?? 1);
  const issuerType     = pp.issuer_type ?? 'nonbank_state';
  const assets         = pp.assets ?? [];
  const certPresent    = pp.ceo_cfo_certification_present === true;
  const examinerNamed  = pp.registered_examiner_named === true;
  const examinerName   = pp.examiner_name ?? null;
  const onchainSupply  = pp.onchain_supply_check ?? null;
  const priorMonth     = pp.prior_month ?? null;

  const totalLiab = tokens * price;
  const { totalReserve, assetResults } = analyzeAssets(assets, issuerType);
  const coverageRatio = totalLiab > 0 ? totalReserve / totalLiab : 0;

  const prohibitedTotal  = assetResults.filter(a => a.def.eligibility === 'prohibited').reduce((s, a) => s + a.usd, 0);
  const conditionalTotal = assetResults.filter(a => a.def.eligibility === 'conditional' && a.has_fail).reduce((s, a) => s + a.usd, 0);

  const custodyLocations = [...new Set(assets.map(a => a.custodian).filter(c => !!c))];
  const custodyDisclosed = assets.length > 0 && assets.every(a => !!a.custodian);

  // Month-over-month diff
  let mom_diff = null;
  if (priorMonth) {
    const priorTokens = Number(priorMonth.outstanding_tokens_reported ?? 0);
    const priorAssets = priorMonth.assets ?? [];
    const priorReserve = priorAssets.reduce((s, a) => s + Number(a.usd ?? 0), 0);

    const priorPctByType = {};
    priorAssets.forEach(a => {
      priorPctByType[a.type] = (priorPctByType[a.type] ?? 0) + Number(a.usd ?? 0);
    });
    const currentPctByType = {};
    assetResults.forEach(a => {
      currentPctByType[a.type] = (currentPctByType[a.type] ?? 0) + a.usd;
    });
    const allTypes = [...new Set([...Object.keys(priorPctByType), ...Object.keys(currentPctByType)])];
    const composition_drift = allTypes.map(type => {
      const priorPct = priorReserve > 0 ? (priorPctByType[type] ?? 0) / priorReserve * 100 : 0;
      const currentPct = totalReserve > 0 ? (currentPctByType[type] ?? 0) / totalReserve * 100 : 0;
      return {
        type,
        prior_pct: parseFloat(priorPct.toFixed(2)),
        current_pct: parseFloat(currentPct.toFixed(2)),
        drift_pct: parseFloat((currentPct - priorPct).toFixed(2)),
      };
    });

    const tokensDelta = tokens - priorTokens;
    const tokensDeltaPct = priorTokens > 0 ? (tokensDelta / priorTokens * 100) : 0;
    const reserveDelta = totalReserve - priorReserve;
    const reserveDeltaPct = priorReserve > 0 ? (reserveDelta / priorReserve * 100) : 0;
    const largeSwingFlag = Math.abs(tokensDeltaPct) > 20 || Math.abs(reserveDeltaPct) > 20;

    mom_diff = {
      prior_report_month: priorMonth.report_month ?? '',
      tokens_delta: tokensDelta,
      tokens_delta_pct: parseFloat(tokensDeltaPct.toFixed(2)),
      reserve_delta_usd: parseFloat(reserveDelta.toFixed(2)),
      reserve_delta_pct: parseFloat(reserveDeltaPct.toFixed(2)),
      composition_drift,
      large_swing_flag: largeSwingFlag,
    };
  }

  // On-chain supply cross-check — user-pasted figure, numeric compare only. Zero-fetch.
  const onchain_supply_check = {
    provided: onchainSupply !== null,
    onchain_supply: onchainSupply,
    reported_outstanding_tokens: tokens,
    match: onchainSupply === null ? null : Math.abs(onchainSupply - tokens) < 0.01,
    delta: onchainSupply === null ? null : parseFloat((onchainSupply - tokens).toFixed(2)),
    note: 'User-pasted on-chain supply figure compared numerically against the reported outstanding-tokens field. NOT a live network fetch and NOT a cryptographic verification of the source disclosure PDF (zero-fetch, zero-PII tool).',
  };

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
  if (!certPresent) {
    failingDimensions.push({ dim: 'CEO/CFO certification', detail: 'Monthly report is missing the required CEO/CFO certification.', ref: 'GENIUS Act S.394 §4' });
  }
  if (!examinerNamed) {
    failingDimensions.push({ dim: 'Registered accounting-firm examiner', detail: 'No registered public accounting firm named as examiner for this report.', ref: 'GENIUS Act S.394 §4' });
  }
  if (!custodyDisclosed && assets.length > 0) {
    failingDimensions.push({ dim: 'Custody location disclosure', detail: 'One or more reserve assets are missing a disclosed custodian/location.', ref: 'GENIUS Act S.394 §4' });
  }
  if (onchain_supply_check.provided && onchain_supply_check.match === false) {
    failingDimensions.push({
      dim: 'On-chain supply cross-check',
      detail: `Pasted on-chain supply (${onchainSupply}) does not match reported outstanding tokens (${tokens}).`,
      ref: 'GENIUS Act S.394 §4 — issuer self-attested figures',
    });
  }

  // Determination
  let determination;
  const hardFail = coverageRatio < 1 || prohibitedTotal > 0 || !certPresent || (onchain_supply_check.provided && onchain_supply_check.match === false);
  const softWarn = conditionalTotal > 0 || !examinerNamed || !custodyDisclosed || (mom_diff && mom_diff.large_swing_flag);
  if (hardFail) determination = 'FAIL';
  else if (softWarn) determination = 'WARN';
  else determination = 'PASS';

  const compliance_flags = [];
  if (determination === 'FAIL') compliance_flags.push('GENIUS_MONTHLY_DISCLOSURE_FAIL');
  if (coverageRatio < 1) compliance_flags.push('RESERVE_DEFICIENCY');
  if (prohibitedTotal > 0) compliance_flags.push('PROHIBITED_ASSETS_PRESENT');
  if (!certPresent) compliance_flags.push('CERTIFICATION_MISSING');
  if (!examinerNamed) compliance_flags.push('EXAMINER_MISSING');
  if (!custodyDisclosed && assets.length > 0) compliance_flags.push('CUSTODY_DISCLOSURE_INCOMPLETE');
  if (onchain_supply_check.provided && onchain_supply_check.match === false) compliance_flags.push('ONCHAIN_SUPPLY_MISMATCH');
  if (mom_diff && mom_diff.large_swing_flag) compliance_flags.push('MOM_LARGE_SWING');
  if (compliance_flags.length === 0) compliance_flags.push('GENIUS_MONTHLY_DISCLOSURE_CLEAN');

  const output_payload = {
    monthly_disclosure_determination: determination,
    report_month: reportMonth,
    coverage_ratio_pct: parseFloat((coverageRatio * 100).toFixed(4)),
    total_reserves_usd: totalReserve,
    total_liabilities_usd: totalLiab,
    reserve_shortfall_usd: parseFloat(Math.max(0, totalLiab - totalReserve).toFixed(2)),
    prohibited_assets_usd: prohibitedTotal,
    conditional_assets_usd: conditionalTotal,
    custody_locations: custodyLocations,
    custody_disclosed: custodyDisclosed,
    ceo_cfo_certification_present: certPresent,
    registered_examiner_named: examinerNamed,
    examiner_name: examinerName,
    asset_results: assetResults.map(a => ({ type: a.type, usd: a.usd, pct: a.pct, custodian: a.custodian, eligibility: a.def.eligibility, has_fail: a.has_fail, issues: a.issues })),
    failing_dimensions: failingDimensions,
    mom_diff,
    onchain_supply_check,
    applicable_deadline: '2027-01-18',
    regulatory_framework: 'GENIUS Act S.394 §4 — Monthly Reserve Composition Report',
    pdf_extraction_note: 'This linter operates on extracted disclosure fields (JSON), not the source PDF filing. It does NOT cryptographically verify the underlying published PDF — PDF-only publishing is the industry gap (see XBRL US comment letters). Successor to the pre-issuance art-06 attestation pre-check; not a substitute for it. Re-verify against GENIUS Act final-rule text on/after 2026-07-18.',
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
