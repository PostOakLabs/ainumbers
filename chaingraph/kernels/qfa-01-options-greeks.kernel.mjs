import { executionHash } from './_hash.mjs';

const TOOL_ID = 'qfa-01-options-greeks';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_options_greeks',
  mandate_type: 'risk_parameter',
  gpu: false,
};

function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422820 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return x >= 0 ? 1 - p : p;
}

function normPdf(x) {
  return Math.exp(-0.5 * x * x) / 2.5066282746;
}

export function compute(pp) {
  const complianceFlags = ['FRTB_SA_GREEKS_COMPUTED', 'BASEL_III_MARKET_RISK', 'IFRS13_FAIR_VALUE_ASSESSED'];

  const S = Number(pp.spot);
  const K = Number(pp.strike);
  const T = Number(pp.expiry_days) / 365;
  const sigma = Number(pp.vol) / 100;
  const r = Number(pp.rate) / 100;
  const q = Number(pp.div_yield != null ? pp.div_yield : 0) / 100;
  const isCall = (pp.type || 'call') === 'call';

  if (T <= 0) {
    const intrinsic = isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
    const delta = isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0);
    const output_payload = { price: intrinsic, delta, gamma: 0, theta_per_day: 0, vega_per_pct: 0, rho_per_pct: 0, d1: 0, d2: 0, delta_risk_band: 'LOW', type: pp.type || 'call' };
    return { output_payload, compliance_flags: complianceFlags };
  }

  const sqT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqT);
  const d2 = d1 - sigma * sqT;
  const eqT = Math.exp(-q * T);
  const erT = Math.exp(-r * T);

  const price = isCall
    ? S * eqT * normCdf(d1) - K * erT * normCdf(d2)
    : K * erT * normCdf(-d2) - S * eqT * normCdf(-d1);

  const delta = isCall ? eqT * normCdf(d1) : eqT * (normCdf(d1) - 1);
  const gamma = eqT * normPdf(d1) / (S * sigma * sqT);
  const theta = (-(S * sigma * eqT * normPdf(d1)) / (2 * sqT)
    - r * K * erT * (isCall ? normCdf(d2) : -normCdf(-d2))
    + q * S * eqT * (isCall ? normCdf(d1) : -normCdf(-d1))) / 365;
  const vega = S * eqT * sqT * normPdf(d1) / 100;
  const rho = isCall ? K * T * erT * normCdf(d2) / 100 : -K * T * erT * normCdf(-d2) / 100;

  const absDelta = Math.abs(delta);
  const deltaRiskBand = absDelta >= 0.7 ? 'HIGH' : absDelta >= 0.3 ? 'MODERATE' : 'LOW';

  const output_payload = {
    price: +price.toFixed(6),
    delta: +delta.toFixed(6),
    gamma: +gamma.toFixed(6),
    theta_per_day: +theta.toFixed(6),
    vega_per_pct: +vega.toFixed(6),
    rho_per_pct: +rho.toFixed(6),
    d1: +d1.toFixed(6),
    d2: +d2.toFixed(6),
    delta_risk_band: deltaRiskBand,
    type: pp.type || 'call',
  };

  return { output_payload, compliance_flags: complianceFlags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
