import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-218-qm-points-and-fees';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_qm_points_and_fees',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Qualified Mortgage points-and-fees test per Reg Z §1026.43(e)(3).
// 2026 thresholds (Federal Register 2025-22773, effective 1 Jan 2026):
//   >= $137,958: 3% of loan amount
//   $82,775 -- $137,957.99: $4,139
//   $27,592 -- $82,774.99: 5% of loan amount
//   $17,245 -- $27,591.99: $1,380
//   < $17,245: 8% of loan amount
//
// Version-pinned fixture table with Federal Register citations.
// This node exists because agents reliably hallucinate current-year thresholds.

// VERSION-PINNED QM POINTS-AND-FEES TIER TABLE
// Source: CFPB annual threshold updates under §1026.43(e)(3)(ii), published in
// the Federal Register each January. Thresholds indexed to CPI-W.
// History includes 2021-2026; update in a new yearly session.
const QM_TIERS_BY_YEAR = {
  2021: {
    fr_citation: 'FR 2020-27416 (Dec 18, 2020), 85 FR 83720',
    effective: '2021-01-01',
    tiers: [
      { threshold_min: 110260, limit_type: 'pct', limit_pct: 3.0, label: '>= $110,260: 3%' },
      { threshold_min: 66156, threshold_max: 110259.99, limit_type: 'fixed', limit_fixed: 3308, label: '$66,156 - $110,259.99: $3,308' },
      { threshold_min: 22052, threshold_max: 66155.99, limit_type: 'pct', limit_pct: 5.0, label: '$22,052 - $66,155.99: 5%' },
      { threshold_min: 13782, threshold_max: 22051.99, limit_type: 'fixed', limit_fixed: 1103, label: '$13,782 - $22,051.99: $1,103' },
      { threshold_max: 13781.99, limit_type: 'pct', limit_pct: 8.0, label: '< $13,782: 8%' },
    ],
  },
  2022: {
    fr_citation: 'FR 2021-27322 (Dec 16, 2021), 86 FR 71487',
    effective: '2022-01-01',
    tiers: [
      { threshold_min: 114847, limit_type: 'pct', limit_pct: 3.0, label: '>= $114,847: 3%' },
      { threshold_min: 68908, threshold_max: 114846.99, limit_type: 'fixed', limit_fixed: 3445, label: '$68,908 - $114,846.99: $3,445' },
      { threshold_min: 22969, threshold_max: 68907.99, limit_type: 'pct', limit_pct: 5.0, label: '$22,969 - $68,907.99: 5%' },
      { threshold_min: 14356, threshold_max: 22968.99, limit_type: 'fixed', limit_fixed: 1148, label: '$14,356 - $22,968.99: $1,148' },
      { threshold_max: 14355.99, limit_type: 'pct', limit_pct: 8.0, label: '< $14,356: 8%' },
    ],
  },
  2023: {
    fr_citation: 'FR 2022-27762 (Dec 20, 2022), 87 FR 77143',
    effective: '2023-01-01',
    tiers: [
      { threshold_min: 124331, limit_type: 'pct', limit_pct: 3.0, label: '>= $124,331: 3%' },
      { threshold_min: 74599, threshold_max: 124330.99, limit_type: 'fixed', limit_fixed: 3730, label: '$74,599 - $124,330.99: $3,730' },
      { threshold_min: 24866, threshold_max: 74598.99, limit_type: 'pct', limit_pct: 5.0, label: '$24,866 - $74,598.99: 5%' },
      { threshold_min: 15541, threshold_max: 24865.99, limit_type: 'fixed', limit_fixed: 1243, label: '$15,541 - $24,865.99: $1,243' },
      { threshold_max: 15540.99, limit_type: 'pct', limit_pct: 8.0, label: '< $15,541: 8%' },
    ],
  },
  2024: {
    fr_citation: 'FR 2023-27060 (Dec 11, 2023), 88 FR 86062',
    effective: '2024-01-01',
    tiers: [
      { threshold_min: 130867, limit_type: 'pct', limit_pct: 3.0, label: '>= $130,867: 3%' },
      { threshold_min: 78520, threshold_max: 130866.99, limit_type: 'fixed', limit_fixed: 3926, label: '$78,520 - $130,866.99: $3,926' },
      { threshold_min: 26173, threshold_max: 78519.99, limit_type: 'pct', limit_pct: 5.0, label: '$26,173 - $78,519.99: 5%' },
      { threshold_min: 16358, threshold_max: 26172.99, limit_type: 'fixed', limit_fixed: 1309, label: '$16,358 - $26,172.99: $1,309' },
      { threshold_max: 16357.99, limit_type: 'pct', limit_pct: 8.0, label: '< $16,358: 8%' },
    ],
  },
  2025: {
    fr_citation: 'FR 2024-28929 (Dec 10, 2024), 89 FR 99882',
    effective: '2025-01-01',
    tiers: [
      { threshold_min: 134500, limit_type: 'pct', limit_pct: 3.0, label: '>= $134,500: 3%' },
      { threshold_min: 80700, threshold_max: 134499.99, limit_type: 'fixed', limit_fixed: 4035, label: '$80,700 - $134,499.99: $4,035' },
      { threshold_min: 26900, threshold_max: 80699.99, limit_type: 'pct', limit_pct: 5.0, label: '$26,900 - $80,699.99: 5%' },
      { threshold_min: 16812, threshold_max: 26899.99, limit_type: 'fixed', limit_fixed: 1345, label: '$16,812 - $26,899.99: $1,345' },
      { threshold_max: 16811.99, limit_type: 'pct', limit_pct: 8.0, label: '< $16,812: 8%' },
    ],
  },
  2026: {
    fr_citation: 'FR 2025-22773 (effective Jan 1, 2026)',
    effective: '2026-01-01',
    tiers: [
      { threshold_min: 137958, limit_type: 'pct', limit_pct: 3.0, label: '>= $137,958: 3%' },
      { threshold_min: 82775, threshold_max: 137957.99, limit_type: 'fixed', limit_fixed: 4139, label: '$82,775 - $137,957.99: $4,139' },
      { threshold_min: 27592, threshold_max: 82774.99, limit_type: 'pct', limit_pct: 5.0, label: '$27,592 - $82,774.99: 5%' },
      { threshold_min: 17245, threshold_max: 27591.99, limit_type: 'fixed', limit_fixed: 1380, label: '$17,245 - $27,591.99: $1,380' },
      { threshold_max: 17244.99, limit_type: 'pct', limit_pct: 8.0, label: '< $17,245: 8%' },
    ],
  },
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

function findTier(loan_amount, tiers) {
  for (const tier of tiers) {
    const min = typeof tier.threshold_min === 'number' ? tier.threshold_min : 0;
    const max = typeof tier.threshold_max === 'number' ? tier.threshold_max : Infinity;
    if (loan_amount >= min && loan_amount <= max) return tier;
  }
  return null;
}

export function compute(pp) {
  pp = pp || {};

  const loan_amount = safeNum(pp.loan_amount, 0);
  const points_and_fees = safeNum(pp.points_and_fees, 0);
  const year = Math.round(safeNum(pp.year, 2026));

  const yearData = QM_TIERS_BY_YEAR[year] || QM_TIERS_BY_YEAR[2026];
  const tier = findTier(loan_amount, yearData.tiers);

  if (!tier) {
    return {
      output_payload: {
        pass: false, error: 'no_tier_matched', loan_amount: r2(loan_amount),
        points_and_fees: r2(points_and_fees), year,
      },
      compliance_flags: ['QM_TIER_LOOKUP_FAILED'],
    };
  }

  const limit = tier.limit_type === 'pct'
    ? r2(loan_amount * tier.limit_pct / 100)
    : tier.limit_fixed;

  const pass = points_and_fees <= limit + 0.005; // 0.5-cent rounding tolerance
  const headroom = r2(limit - points_and_fees);

  const compliance_flags = [];
  if (!pass) compliance_flags.push('QM_POINTS_AND_FEES_EXCEEDED');

  const output_payload = {
    pass,
    points_and_fees: r2(points_and_fees),
    loan_amount: r2(loan_amount),
    year,
    tier_label: tier.label,
    limit_type: tier.limit_type,
    limit_pct: tier.limit_type === 'pct' ? tier.limit_pct : null,
    limit_fixed: tier.limit_type === 'fixed' ? tier.limit_fixed : null,
    limit: limit,
    headroom,
    fr_citation: yearData.fr_citation,
    effective_date: yearData.effective,
    regulatory_basis: 'Reg Z §1026.43(e)(3)(ii), QM points-and-fees test',
    note: 'Thresholds are version-pinned. Run lookup_reg_z_thresholds for year-by-year table. Points-and-fees definition: §1026.32(b)(1). Confirm current thresholds at consumerfinance.gov/rules-policy/final-rules.',
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
