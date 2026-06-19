export const meta = {
  tool_id: '503-canton-tokenization-readiness-diagnostic',
  mcp_name: 'diagnose_canton_readiness',
  mandate_type: 'readiness_diagnostic',
};

const DOMAINS = [
  { key: 'settlement_ops',      weight: 20, qs: ['q1','q2'] },
  { key: 'custody_eligibility', weight: 18, qs: ['q3','q4'] },
  { key: 'cash_leg',            weight: 18, qs: ['q5','q6'] },
  { key: 'privacy_disclosure',  weight: 14, qs: ['q7','q8'] },
  { key: 'aml_kya',             weight: 15, qs: ['q9','q10'] },
  { key: 'capital_governance',  weight: 15, qs: ['q11','q12'] },
];

const GAP_THRESHOLDS = {
  settlement_ops:      10,
  custody_eligibility:  9,
  cash_leg:             9,
  privacy_disclosure:   7,
  aml_kya:              7.5,
  capital_governance:   7.5,
};

const GAP_FLAG_KEYS = {
  settlement_ops:      'SETTLEMENT_OPS_GAP',
  custody_eligibility: 'CUSTODY_ELIGIBILITY_GAP',
  cash_leg:            'CASH_LEG_GAP',
  privacy_disclosure:  'PRIVACY_DISCLOSURE_GAP',
  aml_kya:             'AML_KYA_GAP',
  capital_governance:  'CAPITAL_GOVERNANCE_GAP',
};

function getGrade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  if (score >= 25) return 'E';
  return 'F';
}

export function compute(pp) {
  const domain_scores = {};
  const gaps = [];

  for (const d of DOMAINS) {
    const yesCount = d.qs.filter(q => pp[q] === 'yes').length;
    const dScore = (yesCount / 2) * d.weight;
    domain_scores[d.key] = dScore;
    if (dScore < GAP_THRESHOLDS[d.key]) {
      gaps.push(d.key);
    }
  }

  const total_score = +Object.values(domain_scores).reduce((a, b) => a + b, 0).toFixed(1);
  const grade = getGrade(total_score);
  const isReady = grade === 'A' || grade === 'B';

  const compliance_flags = {
    CANTON_READINESS_SCORED: true,
    CANTON_READY: isReady,
    NOT_CANTON_READY: !isReady,
  };

  for (const [key, flagKey] of Object.entries(GAP_FLAG_KEYS)) {
    compliance_flags[flagKey] = gaps.includes(key);
  }

  return {
    verdict: grade,
    total_score,
    domain_scores,
    gaps,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    entity_name: pp.entity_name ?? null,
    lei: pp.lei ?? null,
    entity_type: pp.entity_type ?? null,
    ...result,
  };
}
