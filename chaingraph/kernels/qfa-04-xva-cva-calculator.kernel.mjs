/**
 * qfa-04-xva-cva-calculator.kernel.mjs
 * XVA / CVA Calculator — LCG + Box-Muller, Monte Carlo GBM path simulation.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

export const meta = {
  tool_id:      'qfa-04-xva-cva-calculator',
  mcp_name:     'calculate_xva',
  mandate_type: 'risk_parameter',
  version:      '1.0.0',
};

// ── LCG + Box-Muller (matches source HTML) ────────────────────────────────────
function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randn(rng) {
  const u1 = rng(), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-15)) * Math.cos(2 * Math.PI * u2);
}

// ── Presets (from source PRESETS) ─────────────────────────────────────────────
const PRESETS = {
  irs:        { notional:10000000, maturity:5,    vol:0.20, rfr:0.045, cpyPD:0.015, cpyLGD:0.60, ownPD:0.005, fundSprd:0.0080, nPaths:400, nSteps:40  },
  fx_forward: { notional:5000000,  maturity:0.25, vol:0.08, rfr:0.045, cpyPD:0.040, cpyLGD:0.70, ownPD:0.005, fundSprd:0.0120, nPaths:400, nSteps:20  },
  cds:        { notional:20000000, maturity:3,    vol:0.12, rfr:0.045, cpyPD:0.020, cpyLGD:0.60, ownPD:0.005, fundSprd:0.0060, nPaths:400, nSteps:36  },
};

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const preset    = pp.instrument ?? pp.preset;
  const pDef      = preset ? PRESETS[preset] : null;

  const notional  = pp.notional       ?? pDef?.notional  ?? 10000000;
  const T         = pp.maturity_years ?? pDef?.maturity  ?? 5;
  const vol       = (pp.vol_pct !== undefined ? pp.vol_pct / 100 : null) ?? pDef?.vol    ?? 0.20;
  const rfr       = (pp.rfr_pct !== undefined ? pp.rfr_pct / 100 : null) ?? pDef?.rfr    ?? 0.045;
  const cpyPD     = (pp.cpyPD_pct !== undefined ? pp.cpyPD_pct / 100 : null) ?? pDef?.cpyPD ?? 0.015;
  const cpyLGD    = (pp.cpyLGD_pct !== undefined ? pp.cpyLGD_pct / 100 : null) ?? pDef?.cpyLGD ?? 0.60;
  const ownPD     = (pp.ownPD_pct !== undefined ? pp.ownPD_pct / 100 : null) ?? pDef?.ownPD ?? 0.005;
  const fundSprd  = (pp.funding_bps !== undefined ? pp.funding_bps / 10000 : null) ?? pDef?.fundSprd ?? 0.0080;
  const nPaths    = Math.min(Math.max(pp.n_paths ?? pDef?.nPaths ?? 400, 50), 2000);
  const nSteps    = Math.min(Math.max(pp.n_steps ?? pDef?.nSteps ?? 40,  5), 200);
  const seed_base = pp.seed ?? 1999;

  const dt    = T / nSteps;
  const times = Array.from({ length: nSteps + 1 }, (_, i) => i * dt);

  const epeSum = new Float64Array(nSteps + 1);
  const eneSum = new Float64Array(nSteps + 1);

  for (let p = 0; p < nPaths; p++) {
    const rng = makeLCG(p * 6257 + seed_base);
    let V = 0;
    for (let t = 1; t <= nSteps; t++) {
      const z = randn(rng);
      V = V + rfr * V * dt + vol * Math.sqrt(dt) * z * notional * 0.1;
      epeSum[t] += Math.max(V, 0);
      eneSum[t] += Math.min(V, 0);
    }
  }

  const epe = Array.from(epeSum, v => v / nPaths);
  const ene = Array.from(eneSum, v => v / nPaths);

  const discountFactor = t => Math.exp(-rfr * t);
  const survCpy = t => Math.exp(-cpyPD * t);

  let cva = 0, dva = 0, fva = 0;
  for (let t = 1; t <= nSteps; t++) {
    const t0 = times[t - 1], t1 = times[t];
    const dPD_cpy = Math.exp(-cpyPD * t0) - Math.exp(-cpyPD * t1);
    const dPD_own = Math.exp(-ownPD  * t0) - Math.exp(-ownPD  * t1);
    const df      = discountFactor((t0 + t1) / 2);
    const epe_mid = (epe[t - 1] + epe[t]) / 2;
    const ene_mid = (ene[t - 1] + ene[t]) / 2;
    cva += cpyLGD * epe_mid * dPD_cpy * df;
    dva += (1 - cpyLGD) * (-ene_mid) * dPD_own * df;
    fva += fundSprd * epe_mid * survCpy(t0) * df * dt;
  }

  const xva        = cva - dva + fva;
  const peakEpe    = Math.max(...epe);
  const peakEpePct = notional > 0 ? peakEpe / notional * 100 : 0;
  const riskRating = cva > 200000 ? 'HIGH' : cva > 50000 ? 'MODERATE' : 'LOW';

  const compliance_flags = [
    'FRTB_CVA_DESK_COMPUTED',
    'BASEL_III_SA_CCR_ASSESSED',
    'IFRS13_FAIR_VALUE_HIERARCHY',
    `SA_CVA_${riskRating}_RISK`,
  ];

  return {
    verdict:                riskRating,
    cva:                    +cva.toFixed(2),
    dva:                    +dva.toFixed(2),
    fva:                    +fva.toFixed(2),
    xva:                    +xva.toFixed(2),
    peak_epe:               +peakEpe.toFixed(2),
    peak_epe_pct_notional:  +peakEpePct.toFixed(3),
    xva_risk_rating:        riskRating,
    cva_basis:              'Basel_III_SA-CVA_EPE_discounted',
    dva_basis:              'ENE_own_hazard_discounted',
    fva_basis:              'EPE_funding_spread_integral',
    n_paths:                nPaths,
    n_steps:                nSteps,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:               meta.tool_id,
    mandate_type:          meta.mandate_type,
    verdict:               r.verdict,
    cva:                   r.cva,
    dva:                   r.dva,
    fva:                   r.fva,
    xva:                   r.xva,
    peak_epe:              r.peak_epe,
    peak_epe_pct_notional: r.peak_epe_pct_notional,
    xva_risk_rating:       r.xva_risk_rating,
    compliance_flags:      r.compliance_flags,
    inputs:                pp,
  };
}
