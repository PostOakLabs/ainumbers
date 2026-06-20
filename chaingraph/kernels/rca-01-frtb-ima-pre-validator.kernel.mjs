import { executionHash } from './_hash.mjs';

const TOOL_ID = 'rca-01-frtb-ima-pre-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'simulate_frtb_es',
  mandate_type: 'risk_parameter',
  gpu: false,
};

const LH_DAYS = [10, 20, 40, 60, 120];

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
  const nPositions = Math.max(1, Number(pp.nPositions) || 50);
  const nScenarios = Math.max(1, Number(pp.nScenarios) || 2000);
  const confidenceLevel = Number(pp.confidenceLevel) || 0.975;
  const nRiskClasses = Math.max(1, Number(pp.nRiskClasses) || 3);
  const nmrfRate = Number(pp.nmrfRate) || 0.05;
  const seed = Number(pp.seed) || 42;

  // Position generation
  const rng = makeLCG(seed);
  const positions = [];
  for (let i = 0; i < nPositions; i++) {
    const weight = (rng() * 0.06 + 0.01) * (rng() > 0.5 ? 1 : -1);
    const vol = rng() * 0.15 + 0.05;
    const cls = Math.floor(rng() * nRiskClasses) % nRiskClasses;
    const lhDays = LH_DAYS[cls] != null ? LH_DAYS[cls] : LH_DAYS[0];
    const isNMRF = rng() < nmrfRate;
    positions.push({ weight, vol, cls, lhDays, isNMRF });
  }

  // Monte Carlo P&L
  const rng2 = makeLCG(seed + 100);
  const pnls = new Array(nScenarios);
  for (let s = 0; s < nScenarios; s++) {
    pnls[s] = positions.reduce(
      (sum, pos) => sum + pos.weight * pos.vol * randn(rng2) * Math.sqrt(pos.lhDays / 250),
      0
    );
  }

  // ES computation
  const esCount = Math.max(1, Math.floor(nScenarios * (1 - confidenceLevel)));
  const sorted = [...pnls].sort((a, b) => a - b);
  const es = -sorted.slice(0, esCount).reduce((a, b) => a + b, 0) / esCount;

  // ES by LH class
  const esByClass = LH_DAYS.map((lhd, cls) => {
    const rngCls = makeLCG(seed + 200 + cls);
    const clsPositions = positions.filter(p => p.cls === cls);
    if (clsPositions.length === 0) return 0;
    const clsPnls = Array.from({ length: nScenarios }, () =>
      clsPositions.reduce((s, p) => s + p.weight * p.vol * randn(rngCls) * Math.sqrt(lhd / 250), 0)
    );
    const sorted2 = [...clsPnls].sort((a, b) => a - b);
    return -sorted2.slice(0, esCount).reduce((a, b) => a + b, 0) / esCount;
  });

  // NMRF surcharge
  const nmrfPositions = positions.filter(p => p.isNMRF);
  let nmrfSurcharge = 0;
  if (nmrfPositions.length > 0) {
    const rngNmrf = makeLCG(seed + 777);
    const nmrfPnls = Array.from({ length: nScenarios }, () =>
      nmrfPositions.reduce((s, p) => s + p.weight * p.vol * randn(rngNmrf) * Math.sqrt(p.lhDays / 250), 0)
    );
    const sortedNmrf = [...nmrfPnls].sort((a, b) => a - b);
    const nmrfEs = -sortedNmrf.slice(0, esCount).reduce((a, b) => a + b, 0) / esCount;
    nmrfSurcharge = Math.max(0, 1.5 * nmrfEs);
  }

  // Undiversified ES (analytical)
  const undiversified = positions.reduce(
    (s, p) => s + Math.abs(p.weight) * p.vol * Math.sqrt(p.lhDays / 250) * 2.326,
    0
  );

  // PLA test
  const mean = pnls.reduce((a, b) => a + b, 0) / nScenarios;
  const simVar = pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / nScenarios;
  const theorVar = positions.reduce((s, p) => s + p.weight ** 2 * p.vol ** 2 * (p.lhDays / 250), 0);
  const plaRatio = Math.sqrt(simVar / (theorVar + 1e-15));
  const plaStatus = plaRatio >= 0.8 && plaRatio <= 1.2
    ? 'GREEN'
    : plaRatio >= 0.6 && plaRatio <= 1.5
      ? 'AMBER'
      : 'RED';

  // Capital
  const capitalIMA = 1.5 * es + nmrfSurcharge;
  const saFloor = 1.25 * es;
  const capitalReq = Math.max(capitalIMA, saFloor);
  const floorBinding = capitalIMA < saFloor;

  const verdict = plaStatus === 'RED'
    ? 'PLA Test Failure — IMA Ineligible'
    : plaStatus === 'AMBER' || floorBinding
      ? 'SA Floor Binding / PLA Test Amber'
      : 'IMA Pre-Validation Passed';

  const complianceFlags = [
    'FRTB_IMA_ES_COMPUTED',
    'MAR33_LIQUIDITY_HORIZONS_APPLIED',
    nmrfPositions.length > 0 ? 'NMRF_SURCHARGE_ESTIMATED' : 'NMRF_NOT_APPLICABLE',
    'PLA_TEST_' + plaStatus,
    'UK_IMA_PREVALIDATION_2028',
  ];

  const output_payload = {
    verdict,
    es_97_5_pct: +es.toFixed(2),
    undiversified_es: +undiversified.toFixed(2),
    nmrf_surcharge: +nmrfSurcharge.toFixed(2),
    pla_test_status: plaStatus,
    pla_ratio: +plaRatio.toFixed(4),
    capital_ima: +capitalIMA.toFixed(2),
    sa_floor: +saFloor.toFixed(2),
    capital_required: +capitalReq.toFixed(2),
    floor_binding: floorBinding,
    es_by_lh_class: esByClass.map(v => +v.toFixed(2)),
    n_positions: nPositions,
    n_scenarios: nScenarios,
    confidence_level: confidenceLevel,
  };

  return { output_payload, compliance_flags: complianceFlags };
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
