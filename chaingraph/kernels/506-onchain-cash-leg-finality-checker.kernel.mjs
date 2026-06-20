import { executionHash } from './_hash.mjs';

const TOOL_ID = '506-onchain-cash-leg-finality-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_cash_leg_finality',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

export function compute(pp) {
  const {
    finality_model,
    jurisdiction,
    reserve_attestation,
    cash_pct = 0,
    tbills_pct = 0,
    repo_pct = 0,
    depeg_bps = 0,
    redemption_window,
  } = pp;

  // Finality model flags
  const FINALITY_MAP = {
    atomic_dvp_bound:       { flag: 'FINALITY_ATOMIC',          pass: true },
    conditional_irrevocable:{ flag: 'FINALITY_CONDITIONAL',     pass: true },
    standard_blockchain:    { flag: 'FINALITY_BLOCKCHAIN',       pass: true },
    traditional_wire:       { flag: 'FINALITY_TRADITIONAL_WIRE', pass: false },
  };

  const fm = FINALITY_MAP[finality_model] ?? { flag: 'FINALITY_BLOCKCHAIN', pass: true };
  const finality_flag = fm.flag;
  const finality_pass = fm.pass;

  // GENIUS reserve check
  const genius_sum = cash_pct + tbills_pct + repo_pct;
  const genius_fail = jurisdiction === 'us' && !reserve_attestation && genius_sum < 95;

  // Depeg
  const depeg_wide = (depeg_bps / 100) > 1.0;

  // MiCA gap
  const mica_gap = redemption_window === 't2_plus';

  // Verdict
  const has_critical = finality_model === 'traditional_wire' || genius_fail;
  const has_gaps = depeg_wide || mica_gap;

  let verdict;
  if (has_critical) {
    verdict = 'FAIL';
  } else if (has_gaps) {
    verdict = 'CONDITIONAL';
  } else {
    verdict = 'PASS';
  }

  const compliance_flags = {
    [finality_flag]: true,
  };

  if (genius_fail) compliance_flags.GENIUS_RESERVE_FAIL = true;
  if (depeg_wide) compliance_flags.DEPEG_RISK_WIDE = true;
  if (mica_gap) compliance_flags.MICA_REDEMPTION_LAG = true;
  if (verdict === 'PASS') compliance_flags.CASH_LEG_PASS = true;
  if (verdict === 'FAIL') compliance_flags.CASH_LEG_FAIL = true;
  if (verdict === 'CONDITIONAL') compliance_flags.CASH_LEG_CONDITIONAL = true;

  const output_payload = { verdict, finality_flag, finality_pass, has_critical, has_gaps, genius_sum: +genius_sum.toFixed(1), depeg_wide, mica_gap };
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
