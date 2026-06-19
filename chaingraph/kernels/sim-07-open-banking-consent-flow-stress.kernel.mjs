export const meta = {
  tool_id: 'sim-07-open-banking-consent-flow-stress',
  mcp_name: 'simulate_consent_stress',
  mandate_type: 'compliance_mandate',
};

function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function compute(pp) {
  const n = Math.min(Number(pp.nConsents) || 2000, 10000);
  const seed = Number(pp.seed) || 42;
  const regime = pp.regime || 'psd2';

  // Normalize inputs: if value > 1, divide by 100
  const rawR = Number(pp.pRedirectFail) || 0.03;
  const rawA = Number(pp.pAuthFail) || 0.08;
  const rawT = Number(pp.pTokenFail) || 0.02;
  const rawE = Number(pp.pExpiry) || 0.05;
  const rawV = Number(pp.pRevoke) || 0.04;

  const rFail = rawR > 1 ? rawR / 100 : rawR;
  const aFail = rawA > 1 ? rawA / 100 : rawA;
  const tFail = rawT > 1 ? rawT / 100 : rawT;
  const exp = rawE > 1 ? rawE / 100 : rawE;
  const rev = rawV > 1 ? rawV / 100 : rawV;

  const rng = makeLCG(seed);
  const counts = { ACTIVE: 0, FAILED: 0, EXPIRED: 0, REVOKED: 0 };
  const stageFails = { redirect: 0, auth: 0, token: 0 };
  let totalSteps = 0;

  for (let i = 0; i < n; i++) {
    let steps = 2; // INIT → REDIRECT
    if (rng() < rFail) { stageFails.redirect++; counts.FAILED++; continue; }
    steps++;
    if (rng() < aFail) { stageFails.auth++; counts.FAILED++; continue; }
    steps++;
    if (rng() < tFail) { stageFails.token++; counts.FAILED++; continue; }
    steps++;
    if (rng() < exp) { counts.EXPIRED++; totalSteps += steps; continue; }
    if (rng() < rev) { counts.REVOKED++; totalSteps += steps; continue; }
    counts.ACTIVE++;
    totalSteps += steps;
  }

  const successRate = counts.ACTIVE / n;
  const meanSteps = totalSteps / n;

  const verdict = successRate < 0.90
    ? 'CRITICAL — Consent API Below Regulatory Threshold'
    : successRate < 0.95
      ? 'WARNING — Below 95% SCA Compliance Target'
      : 'COMPLIANT — Consent API Meets Regulatory Threshold';

  const complianceFlags = ['PSD2_CONSENT_FSM_SIMULATED'];

  if (regime === 'fapi2') {
    complianceFlags.push('FAPI2_AUTHORIZATION_FLOW_MODELLED');
  } else if (regime === 'cdr') {
    complianceFlags.push('CDR_CONSENT_RULES_APPLIED');
  } else {
    complianceFlags.push('OPEN_BANKING_UK_PROFILED');
  }

  if (successRate >= 0.95) {
    complianceFlags.push('SCA_AVAILABILITY_TARGET_MET');
  } else if (successRate >= 0.90) {
    complianceFlags.push('SCA_AVAILABILITY_WARN');
  } else {
    complianceFlags.push('SCA_AVAILABILITY_BREACH');
  }

  complianceFlags.push(
    stageFails.auth / n > 0.10 ? 'AUTH_FAILURE_RATE_ELEVATED' : 'AUTH_FAILURE_RATE_NOMINAL'
  );

  return {
    verdict,
    success_rate: +successRate.toFixed(4),
    consents_active: counts.ACTIVE,
    consents_failed: counts.FAILED,
    consents_expired: counts.EXPIRED,
    consents_revoked: counts.REVOKED,
    stage_failures: stageFails,
    mean_fsm_steps: +meanSteps.toFixed(2),
    total_flows: n,
    regulatory_regime: pp.regime || 'psd2',
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
