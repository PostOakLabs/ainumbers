/**
 * ml-02-credit-default-risk-scorer.kernel.mjs
 * Credit Default Risk Scorer — LCG PRNG, logistic regression + IRB RWA formula.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

export const meta = {
  tool_id:      'ml-02-credit-default-risk-scorer',
  mcp_name:     'score_credit_default_risk',
  mandate_type: 'credit_assessment',
  version:      '1.0.0',
};

// ── LCG ──────────────────────────────────────────────────────────────────────
function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// ── Normal inverse (rational Horner, from source) ────────────────────────────
function normInv(p) {
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
  const x = (a[0] + t * (a[1] + t * a[2])) / (1 + t * (b[0] + t * (b[1] + t * b[2]))) - t;
  return p < 0.5 ? -x : x;
}

// ── Sector labels (from source SECTORS) ──────────────────────────────────────
const SECTORS = ['Retail','Real Estate','Manufacturing','Tech','Healthcare','Financial','Energy','Transport'];
const SECTOR_RISK = [0.2, 0.5, 0.35, 0.25, 0.15, 0.45, 0.55, 0.4];

// ── IRB RWA formula (Basel BCBS d424, from source irbRWA) ────────────────────
function irbRWA(pd, lgd, maturity, assetClass) {
  const pd_c = Math.max(pd, 0.0003);
  let R;
  if (assetClass === 'retail_mortgage') {
    R = 0.15;
  } else if (assetClass === 'consumer') {
    R = 0.04;
  } else {
    R = 0.12 * (1 - Math.exp(-50 * pd_c)) / (1 - Math.exp(-50))
      + 0.24 * (1 - (1 - Math.exp(-50 * pd_c)) / (1 - Math.exp(-50)));
  }
  const b    = (0.11852 - 0.05478 * Math.log(pd_c)) ** 2;
  const mAdj = (1 + (maturity - 2.5) * b) / (1 - 1.5 * b);
  const z    = normInv(0.999);
  const inner = (normInv(pd_c) / Math.sqrt(1 - R) + Math.sqrt(R / (1 - R)) * z);
  const K    = Math.max(lgd * sigmoid(inner) * mAdj - pd_c * lgd, 0);
  return K * 12.5;  // capital % → RWA density
}

// ── SA risk weights by asset class (from source SA_WEIGHTS) ──────────────────
const SA_WEIGHTS = { retail_mortgage: 0.35, sme: 0.75, consumer: 0.75, large_corp: 1.0 };

// ── Logistic regression weights (from source) ─────────────────────────────────
const W_INTERCEPT = -2.5;
const W = [2.5, 3.0, -1.2, 1.5, 0.8]; // ltv, cs_inv, empl, sector, recency

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = {
  retail_mortgage: { nLoans:500, assetClass:'retail_mortgage', defaultRate:0.025, lgd:0.25, maturity:2.5, pdThreshold:0.10, seed:42  },
  sme_lending:     { nLoans:300, assetClass:'sme',             defaultRate:0.06,  lgd:0.45, maturity:2.5, pdThreshold:0.10, seed:137 },
  corp_book:       { nLoans:200, assetClass:'large_corp',      defaultRate:0.015, lgd:0.45, maturity:3.0, pdThreshold:0.10, seed:999 },
};

// ── AUC via trapezoid ─────────────────────────────────────────────────────────
function computeAUC(sorted, nDefault, nNonDefault) {
  const rocPoints = [{ fpr: 0, tpr: 0 }];
  let cumD = 0, cumN = 0;
  for (const l of sorted) {
    if (l.defaulted) cumD++; else cumN++;
    rocPoints.push({ fpr: cumN / Math.max(nNonDefault, 1), tpr: cumD / Math.max(nDefault, 1) });
  }
  rocPoints.push({ fpr: 1, tpr: 1 });
  let auc = 0;
  for (let i = 1; i < rocPoints.length; i++) {
    auc += (rocPoints[i].fpr - rocPoints[i - 1].fpr) * (rocPoints[i].tpr + rocPoints[i - 1].tpr) / 2;
  }
  return auc;
}

// ── KS statistic ─────────────────────────────────────────────────────────────
function computeKS(sorted, nDefault, nNonDefault) {
  let cumD = 0, cumN = 0, maxKS = 0;
  for (const l of sorted) {
    if (l.defaulted) cumD++; else cumN++;
    const ks = Math.abs(cumD / Math.max(nDefault, 1) - cumN / Math.max(nNonDefault, 1));
    if (ks > maxKS) maxKS = ks;
  }
  return maxKS;
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const presetName  = pp.preset;
  const pDef        = presetName ? PRESETS[presetName] : null;

  const nLoans      = Math.min(Math.max(pp.n_loans      ?? pDef?.nLoans      ?? 500, 10), 5000);
  const assetClass  = pp.asset_class    ?? pDef?.assetClass  ?? 'retail_mortgage';
  const defaultRate = pp.target_default_rate ?? pDef?.defaultRate ?? 0.025;
  const lgd         = pp.lgd            ?? pDef?.lgd         ?? 0.45;
  const maturity    = pp.maturity_yrs   ?? pDef?.maturity    ?? 2.5;
  const pdThreshold = pp.pd_threshold   ?? pDef?.pdThreshold ?? 0.10;
  const seed        = pp.seed           ?? pDef?.seed        ?? 42;

  const rng = makeLCG(seed);
  const loans = [];

  for (let j = 0; j < nLoans; j++) {
    const ltv        = Math.min(rng() * 0.9 + 0.1, 1.0);
    const dti        = rng() * 0.6 + 0.1;
    const ltv_dti   = (ltv + dti) / 2;
    const csRaw      = Math.round(rng() * 400 + 400);
    const cs_norm    = 1 - (csRaw - 400) / 400;
    const employed   = rng() > 0.15 ? 1 : 0;
    const sectorIdx  = Math.floor(rng() * SECTORS.length);
    const sectorRisk = SECTOR_RISK[sectorIdx];
    const recency    = rng();
    const logit      = W_INTERCEPT + W[0]*ltv_dti + W[1]*cs_norm + W[2]*employed + W[3]*sectorRisk + W[4]*recency;
    const pd         = Math.min(Math.max(sigmoid(logit), 0.001), 0.999);
    const pdAdj      = pd * (defaultRate / 0.07);
    const defaulted  = rng() < Math.min(pdAdj, 0.99);
    const ead        = rng() * 900000 + 50000;

    loans.push({ pd, ltv, dti, csRaw, employed, sector: SECTORS[sectorIdx], sectorRisk, ead, defaulted, lgd });
  }

  // Sort by PD descending for ROC/KS
  const sorted = [...loans].sort((a, b) => b.pd - a.pd);
  const nDefault    = loans.filter(l => l.defaulted).length;
  const nNonDefault = nLoans - nDefault;

  if (nDefault === 0) {
    return {
      verdict: 'INSUFFICIENT_DEFAULTS',
      compliance_flags: ['INSUFFICIENT_DEFAULTS_FOR_MODEL_VALIDATION'],
    };
  }

  const auc = computeAUC(sorted, nDefault, nNonDefault);
  const maxKS = computeKS(sorted, nDefault, nNonDefault);
  const gini = 2 * auc - 1;

  // Portfolio metrics
  const portPD      = loans.reduce((s, l) => s + l.pd, 0) / nLoans;
  const totalEAD    = loans.reduce((s, l) => s + l.ead, 0);
  const totalEL     = loans.reduce((s, l) => s + l.pd * l.lgd * l.ead, 0);
  const irbRwaDensity = irbRWA(portPD, lgd, maturity, assetClass);
  const totalIRBRWA = totalEAD * irbRwaDensity;
  const totalSARWA  = totalEAD * (SA_WEIGHTS[assetClass] ?? 0.75);
  const irbCapital  = totalIRBRWA * 0.08;
  const saCapital   = totalSARWA  * 0.08;
  const irbVsSaSaving = (totalSARWA - totalIRBRWA) / totalSARWA;

  // Verdict
  let verdict;
  if (gini < 0.40 || portPD > 0.10) verdict = 'WEAK_MODEL_ELEVATED_RISK';
  else if (gini < 0.60)              verdict = 'ACCEPTABLE_MODEL';
  else                               verdict = 'STRONG_MODEL';

  const highPdLoans = loans.filter(l => l.pd >= pdThreshold).length;

  const compliance_flags = [
    'CREDIT_SCORING_COMPLETED',
    'BASEL3_IRB_CAPITAL_COMPUTED',
    'EU_AI_ACT_ANNEX3_PART5B_HIGH_RISK_SYSTEM',
    'EBA_GL_2017_16_MODEL_PERFORMANCE_ASSESSED',
    auc < 0.7 ? 'MODEL_PERFORMANCE_BELOW_0_70_AUC' : 'MODEL_PERFORMANCE_ACCEPTABLE',
    'BCBS_D424_IRB_FORMULA_APPLIED',
  ];

  return {
    verdict,
    auc_roc:          +auc.toFixed(6),
    ks_statistic:     +maxKS.toFixed(6),
    gini_coefficient: +gini.toFixed(6),
    portfolio_pd:     +portPD.toFixed(6),
    total_ead_gbp:    Math.round(totalEAD),
    expected_loss_gbp: Math.round(totalEL),
    irb_rwa_gbp:      Math.round(totalIRBRWA),
    sa_rwa_gbp:       Math.round(totalSARWA),
    irb_capital_gbp:  Math.round(irbCapital),
    sa_capital_gbp:   Math.round(saCapital),
    irb_vs_sa_saving: +irbVsSaSaving.toFixed(6),
    n_loans_scored:   nLoans,
    n_defaults_observed: nDefault,
    high_pd_loans:    highPdLoans,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:            meta.tool_id,
    mandate_type:       meta.mandate_type,
    verdict:            r.verdict,
    auc_roc:            r.auc_roc,
    ks_statistic:       r.ks_statistic,
    gini_coefficient:   r.gini_coefficient,
    portfolio_pd:       r.portfolio_pd,
    total_ead_gbp:      r.total_ead_gbp,
    expected_loss_gbp:  r.expected_loss_gbp,
    irb_rwa_gbp:        r.irb_rwa_gbp,
    sa_rwa_gbp:         r.sa_rwa_gbp,
    irb_capital_gbp:    r.irb_capital_gbp,
    sa_capital_gbp:     r.sa_capital_gbp,
    irb_vs_sa_saving:   r.irb_vs_sa_saving,
    n_loans_scored:     r.n_loans_scored,
    n_defaults_observed: r.n_defaults_observed,
    high_pd_loans:      r.high_pd_loans,
    compliance_flags:   r.compliance_flags,
    inputs:             pp,
  };
}
