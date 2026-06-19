export const meta = {
  tool_id: 'ml-03-timeseries-anomaly-detector',
  mcp_name: 'detect_timeseries_anomalies',
  mandate_type: 'risk_control',
};

function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randn(rng) {
  const u1 = rng() + 1e-15;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function compute(pp) {
  const nP = Math.min(Number(pp.nPeriods) || 365, 720);
  const sP = Number(pp.seasonPeriod) || 7;
  const winSize = Number(pp.windowSize) || 21;
  const zThr = Number(pp.zThreshold) || 3.0;
  const nAnom = Number(pp.nAnomalies) || 3;
  const trend = pp.trendType || 'flat';
  const seed = Number(pp.seed) || 42;
  const BASE = 1000;

  const genRng = makeLCG(seed);
  const raw = new Array(nP);

  for (let t = 0; t < nP; t++) {
    let trendMult;
    if (trend === 'flat') {
      trendMult = 1;
    } else if (trend === 'growth') {
      trendMult = 1 + (t / nP) * 0.05;
    } else if (trend === 'decline') {
      trendMult = 1 - (t / nP) * 0.05;
    } else {
      // stress
      const mid = Math.floor(nP / 2);
      trendMult = t < mid ? 1 - (t / mid) * 0.30 : 0.70 + ((t - mid) / mid) * 0.30;
    }
    const seasonal = 0.15 * Math.sin(2 * Math.PI * t / sP) + 0.05 * Math.sin(4 * Math.PI * t / sP);
    const noise = randn(genRng) * 0.04;
    raw[t] = BASE * trendMult * (1 + seasonal + noise);
  }

  // Anomaly injection
  const validStart = Math.max(winSize, sP);
  const usedPositions = new Set();
  for (let a = 0; a < nAnom; a++) {
    let idx;
    do {
      idx = validStart + Math.floor(genRng() * (nP - validStart - 20));
    } while (usedPositions.has(idx));
    usedPositions.add(idx);
    const dir = genRng() > 0.3 ? 1 : -1;
    const mag = 2.5 + genRng() * 3.5;
    raw[idx] += dir * BASE * 0.15 * mag;
    if (a === 1 && idx + 1 < nP) raw[idx + 1] += dir * BASE * 0.08;
  }

  // Trend decomposition (rolling mean)
  const half = Math.floor(winSize / 2);
  const trendArr = raw.map((_, t) => {
    const wStart = Math.max(0, t - half);
    const wEnd = Math.min(nP, t + half + 1);
    const win = raw.slice(wStart, wEnd);
    return win.reduce((a, b) => a + b, 0) / win.length;
  });

  // Seasonal decomposition
  const seasonAvg = new Array(sP).fill(0);
  const seasonCnt = new Array(sP).fill(0);
  raw.forEach((v, t) => {
    const p = t % sP;
    seasonAvg[p] += v - trendArr[t];
    seasonCnt[p]++;
  });
  for (let p = 0; p < sP; p++) {
    if (seasonCnt[p] > 0) seasonAvg[p] /= seasonCnt[p];
  }
  const seasonal = raw.map((_, t) => seasonAvg[t % sP]);
  // residual available if needed:
  // const residual = raw.map((v, t) => v - trendArr[t] - seasonal[t]);

  // Rolling z-score and flagging
  const zScores = new Array(nP).fill(0);
  const flagged = [];
  for (let t = winSize; t < nP; t++) {
    const win = raw.slice(t - winSize, t);
    const mu = win.reduce((a, b) => a + b, 0) / winSize;
    const std = Math.sqrt(win.reduce((s, v) => s + (v - mu) ** 2, 0) / winSize) + 1e-6;
    const z = (raw[t] - mu) / std;
    zScores[t] = z;
    if (Math.abs(z) >= zThr) {
      const sev = Math.abs(z) >= 5 ? 'HIGH' : Math.abs(z) >= 3.5 ? 'MEDIUM' : 'LOW';
      flagged.push({ t, z: +z.toFixed(3), severity: sev, direction: z > 0 ? 'Spike-Up' : 'Spike-Down' });
    }
  }

  const maxZ = flagged.length > 0 ? Math.max(...flagged.map(f => Math.abs(f.z))) : 0;
  const highFlags = flagged.filter(f => f.severity === 'HIGH').length;

  const verdict = (flagged.length > 8 || highFlags >= 3 || maxZ >= 6)
    ? 'Elevated Anomaly Rate — Review Required'
    : (flagged.length > 2 || maxZ >= 4)
      ? 'Moderate Anomaly Detection — Monitor'
      : 'Normal Operating Range';

  const complianceFlags = [
    'TIMESERIES_ANOMALY_DETECTION_COMPLETED',
    'DORA_ART17_MONITORING_CONTEXT',
    'EBA_GL_2021_03_OPERATIONAL_RISK',
    'PSD2_ART96_FRAUD_REPORTING_CONTEXT',
    flagged.length > 5 ? 'ELEVATED_ANOMALY_RATE_FLAG' : 'ANOMALY_RATE_NORMAL',
    highFlags > 0 ? 'HIGH_SEVERITY_ANOMALIES_DETECTED' : 'NO_HIGH_SEVERITY_ANOMALIES',
  ];

  return {
    verdict,
    anomalies_flagged: flagged.length,
    flag_rate: +(flagged.length / nP).toFixed(4),
    max_abs_z_score: +maxZ.toFixed(3),
    high_severity_flags: highFlags,
    medium_severity_flags: flagged.filter(f => f.severity === 'MEDIUM').length,
    n_periods: nP,
    flagged_periods: flagged.slice(0, 10),
    compliance_flags: complianceFlags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    output_payload: result,
    compliance_flags: result.compliance_flags,
  };
}
