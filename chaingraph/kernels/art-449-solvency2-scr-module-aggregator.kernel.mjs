import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-449-solvency2-scr-module-aggregator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'aggregate_solvency2_scr_modules',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Solvency II standard-formula Basic SCR: aggregates the five major
// risk-module capital charges (market, counterparty default, life
// underwriting, health underwriting, non-life underwriting) via the
// prescribed correlation matrix (Del. Reg. (EU) 2015/35 Annex IV), then
// adds the operational risk charge and subtracts the loss-absorbing
// adjustment for deferred taxes/technical provisions to reach total SCR.
// Delta over art-180 (SCR ratio calculator), which takes `scr` as a given
// input and does not derive it from sub-module charges. NOT the US NAIC
// RBC action-level ladder (a different jurisdiction/regime). NaN-safe.
const CORR = {
  market:  { default: 0.25, life: 0.25, health: 0.25, nonlife: 0.25 },
  default: { life: 0.25, health: 0.25, nonlife: 0.5 },
  life:    { health: 0.25, nonlife: 0 },
  health:  { nonlife: 0 },
};
const MODULES = ['market', 'default', 'life', 'health', 'nonlife'];

export function compute(pp) {
  const { modules = {}, operational = {} } = pp;

  const g = (v) => Number.isFinite(Number(v)) ? Math.max(Number(v), 0) : 0;
  const scr = Object.fromEntries(MODULES.map((m) => [m, g(modules[m])]));

  let sumSquares = 0;
  for (const m of MODULES) sumSquares += scr[m] * scr[m];

  let sumCross = 0;
  for (const [a, row] of Object.entries(CORR)) {
    for (const [b, corr] of Object.entries(row)) {
      sumCross += 2 * corr * scr[a] * scr[b];
    }
  }

  const bscr = Math.sqrt(Math.max(sumSquares + sumCross, 0));

  const g2 = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const scr_operational = Math.max(g2(operational.scr_operational), 0);
  const loss_absorbing_adjustment = Math.max(g2(operational.loss_absorbing_adjustment), 0);

  const scr_total = Math.max(bscr + scr_operational - loss_absorbing_adjustment, 0);
  const adjustment_exceeds_bscr_plus_op = loss_absorbing_adjustment > bscr + scr_operational;

  const compliance_flags = [];
  compliance_flags.push('SII_BSCR_AGGREGATED');
  compliance_flags.push('SII_SCR_TOTAL_COMPUTED');
  if (adjustment_exceeds_bscr_plus_op) compliance_flags.push('SII_LAC_ADJUSTMENT_EXCESS');

  return {
    output_payload: {
      bscr: Math.round(bscr * 100) / 100,
      scr_operational,
      loss_absorbing_adjustment,
      scr_total: Math.round(scr_total * 100) / 100,
      market_scr: scr.market,
      default_scr: scr.default,
      life_scr: scr.life,
      health_scr: scr.health,
      nonlife_scr: scr.nonlife,
      adjustment_exceeds_bscr_plus_op,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
