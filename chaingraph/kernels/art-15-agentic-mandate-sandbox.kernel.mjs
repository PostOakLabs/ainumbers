/**
 * art-15-agentic-mandate-sandbox.kernel.mjs
 * Server-side port of the deterministic mandate-drafting path of the browser tool
 * (ORPHANNODE-ONBOARD-2). The browser page also runs a randomized synthetic-transaction
 * simulator for interactive exploration; that simulator is NOT ported here because
 * Math.random() output cannot be part of a hashed, reproducible artifact. This kernel
 * builds the deterministic Agent Guardrail Mandate skeleton from caller-declared spend
 * caps, velocity rules, time windows, approval thresholds, and compliance flags only —
 * the same policy_parameters the browser tool's own hash chain already scopes to.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-15-agentic-mandate-sandbox';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'simulate_agent_spend_policy',
  mandate_type: 'agent_guardrail_mandate',
  gpu: false,
};

const MCC_CATEGORIES = [
  { code: '5411', label: 'Grocery', group: 'retail' }, { code: '5541', label: 'Gas / Fuel', group: 'retail' },
  { code: '5912', label: 'Pharmacy', group: 'retail' }, { code: '5812', label: 'Restaurants', group: 'retail' },
  { code: '5311', label: 'Dept. Stores', group: 'retail' }, { code: '7011', label: 'Hotels', group: 'travel' },
  { code: '4511', label: 'Airlines', group: 'travel' }, { code: '7512', label: 'Car Rental', group: 'travel' },
  { code: '4814', label: 'Telecom', group: 'services' }, { code: '7372', label: 'SaaS / Tech', group: 'services' },
  { code: '8011', label: 'Healthcare', group: 'services' }, { code: '4900', label: 'Utilities', group: 'services' },
  { code: '6010', label: 'Banking', group: 'financial' }, { code: '6051', label: 'Crypto Exchange', group: 'financial' },
  { code: '7995', label: 'Gambling', group: 'blocked' }, { code: '5999', label: 'Misc. Retail', group: 'retail' },
];
const MCC_CODES = MCC_CATEGORIES.map((m) => m.code);
const BLOCKED_BY_DEFAULT = ['6051', '7995'];
const DEFAULT_MCCS = MCC_CODES.filter((c) => !BLOCKED_BY_DEFAULT.includes(c));

function num(v, fallback) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function intNum(v, fallback) {
  const n = Number.isFinite(v) ? Math.trunc(v) : parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback;
}

export function compute(pp) {
  pp = pp || {};

  const capSingle = num(pp.capSingle, 500);
  const capDaily = num(pp.capDaily, 2000);
  const capMonthly = num(pp.capMonthly, 20000);
  const capFlag = num(pp.capFlag, 1000);
  const velHour = intNum(pp.velHour, 3);
  const velDay = intNum(pp.velDay, 20);
  const velCooldown = intNum(pp.velCooldown, 5);
  const timeStart = typeof pp.timeStart === 'string' ? pp.timeStart : '06:00';
  const timeEnd = typeof pp.timeEnd === 'string' ? pp.timeEnd : '22:00';
  const allowWeekend = bool(pp.allowWeekend, false);
  const blockHoliday = bool(pp.blockHoliday, true);
  const singleSig = bool(pp.singleSig, true);
  const dualSig = bool(pp.dualSig, false);
  const boardSig = bool(pp.boardSig, false);
  const approvalTimeout = intNum(pp.approvalTimeout, 30);
  const rail = typeof pp.rail === 'string' ? pp.rail : 'a2a';
  const origJurisdiction = typeof pp.origJurisdiction === 'string' ? pp.origJurisdiction : 'US';
  const destJurisdiction = typeof pp.destJurisdiction === 'string' ? pp.destJurisdiction : 'US';
  const kycCheck = bool(pp.kycCheck, true);
  const ofacCheck = bool(pp.ofacCheck, true);
  const requestedMccs = Array.isArray(pp.activeMCCs) ? pp.activeMCCs.filter((c) => MCC_CODES.includes(c)) : null;
  const activeMCCs = requestedMccs && requestedMccs.length > 0 ? requestedMccs : DEFAULT_MCCS;

  const rejected_inputs = [];
  if (Array.isArray(pp.activeMCCs)) {
    pp.activeMCCs.filter((c) => !MCC_CODES.includes(c)).forEach((c) => rejected_inputs.push({ where: 'activeMCCs', reason: 'unrecognised MCC code', supplied: c }));
  }

  const blocklist = MCC_CODES.filter((c) => !activeMCCs.includes(c));

  const mandate_id = `MANDATE-${TOOL_ID}-${Math.round(capSingle)}-${Math.round(capDaily)}-${Math.round(capFlag)}`;

  const output_payload = {
    mandate_id,
    schema: 'AP2-Agentic-Mandate',
    rail,
    corridor: { origin: origJurisdiction, destination: destJurisdiction },
    spend_caps: {
      single_transaction: { amount: capSingle, currency: 'USD' },
      daily_aggregate: { amount: capDaily, currency: 'USD' },
      monthly_aggregate: { amount: capMonthly, currency: 'USD' },
      flag_threshold: { amount: capFlag, currency: 'USD' },
    },
    mcc_constraints: { allowlist: activeMCCs, blocklist },
    velocity_rules: { max_txns_per_hour: velHour, max_txns_per_day: velDay, cooldown_minutes: velCooldown },
    time_windows: { allowed_utc: `${timeStart}–${timeEnd}`, allow_weekends: allowWeekend, block_holidays: blockHoliday },
    approval_thresholds: { single_sig_auto: singleSig, dual_sig_required: dualSig, board_approval_gate: boardSig, timeout_minutes: approvalTimeout },
    compliance: { kyc_check: kycCheck, ofac_screen: ofacCheck },
    rejected_inputs,
    note: 'Deterministic Agent Guardrail Mandate skeleton built from declared spend caps, velocity rules, time windows and approval thresholds. The browser tool additionally runs an interactive randomized synthetic-transaction simulator against this mandate; that exploratory step is not part of this deterministic server artifact.',
  };

  const compliance_flags = ['MANDATE_SKELETON_BUILT'];
  if (dualSig) compliance_flags.push('DUAL_SIG_REQUIRED');
  if (boardSig) compliance_flags.push('BOARD_APPROVAL_GATE');
  if (kycCheck) compliance_flags.push('KYC_CHECK_ENABLED');
  if (ofacCheck) compliance_flags.push('OFAC_SCREEN_ENABLED');
  if (rejected_inputs.length > 0) compliance_flags.push('INPUTS_REJECTED');

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
