import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-513-public-money-settlement-receipt';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_public_money_settlement_receipt',
  mandate_type: 'compliance_control', gpu: false,
};

// Public-money settlement receipt: a payment of public money reconciles,
// provably, from payer to the correct government revenue line -- verifiable
// by an audit authority with no access to the operator's database. Portable
// to any government payment platform, any treasury-single-account regime,
// any supreme audit institution -- not specific to any one platform or
// jurisdiction.
//
// The event is TRANSCRIBED by the caller, exactly as art-497 transcribes a
// validator change: no rail connector, no switch, no live payment
// observation. Finality per rail is the caller's OWN declared basis, echoed
// back -- this kernel does not classify finality itself (art-492 and art-59
// already do that; a chain composes them upstream of this node).
//
// Single-settlement verdict: exactly one declared rail leg may carry
// settled=true for the obligation to be discharged once. Zero settled rails
// means the obligation is unresolved; more than one is a double-count risk
// the caller needs surfaced, not silently netted away.
//
// Ministry attribution: the declared revenue code is checked against the
// CALLER's own revenue-code table (never a hardcoded jurisdiction list --
// same discipline art-445/art-497 apply to their own caller-declared
// policies). An empty or missing table cannot resolve a match.
//
// At-par verdict: fees are itemised inputs, never netted. Expected credit =
// amount collected minus the sum of itemised fees; the verdict compares that
// to the amount actually credited.
//
// No clock: as_of and reconciliation_window are caller-supplied opaque
// values, echoed only. Zero PII: payer is a class plus an opaque reference,
// never a name, account number, or address.

const PAYER_CLASSES = ['citizen', 'business', 'agency'];
const RAIL_TYPES = ['ach', 'rtgs', 'cbdc', 'card', 'other'];
const MAX_SAFE = 9007199254740991;
const EPS = 0.01;

function g(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function gz(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : 0; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }
function jnum(v) { return Number.isFinite(v) && Math.abs(v) > MAX_SAFE ? String(v) : (Number.isFinite(v) ? v : 0); }
function str(v) { return String(v == null ? '' : v).trim(); }

export function compute(pp) {
  pp = pp || {};
  const exceptions = [];
  const compliance_flags = [];

  const payment_ref = str(pp.payment_ref) || null;
  if (!payment_ref) exceptions.push('PAYMENT_REF_MISSING');

  const rawPayerClass = str(pp.payer_class);
  const payer_class_valid = PAYER_CLASSES.indexOf(rawPayerClass) >= 0;
  const payer_class = payer_class_valid ? rawPayerClass : (rawPayerClass || 'unstated');
  if (!payer_class_valid) exceptions.push('UNKNOWN_PAYER_CLASS');

  const declared_revenue_code = str(pp.declared_revenue_code) || null;
  if (!declared_revenue_code) exceptions.push('DECLARED_REVENUE_CODE_MISSING');

  const revenue_code_table = Array.isArray(pp.revenue_code_table)
    ? pp.revenue_code_table.map((r) => ({ code: str((r && r.code) || ''), ministry: str((r && r.ministry) || '') })).filter((r) => r.code)
    : [];
  if (revenue_code_table.length === 0) exceptions.push('REVENUE_CODE_TABLE_EMPTY');

  const matchedRow = declared_revenue_code
    ? revenue_code_table.find((r) => r.code === declared_revenue_code)
    : undefined;
  const attribution_matched = !!matchedRow;
  const attributed_ministry = matchedRow ? matchedRow.ministry || null : null;
  if (!attribution_matched) exceptions.push('ATTRIBUTION_UNRESOLVED');

  const treasury_account_credited = str(pp.treasury_account_credited) || null;
  if (!treasury_account_credited) exceptions.push('TREASURY_ACCOUNT_CREDITED_MISSING');

  const currency = str(pp.currency) || null;
  if (!currency) exceptions.push('CURRENCY_MISSING');

  const amount_collected = gz(pp.amount_collected);
  if (amount_collected <= 0) exceptions.push('AMOUNT_COLLECTED_ZERO_OR_ABSENT');

  const fees = Array.isArray(pp.fees)
    ? pp.fees.map((f) => ({ type: str((f && f.type) || '') || 'unspecified', amount: gz(f && f.amount) }))
    : [];
  const total_fees = r2(fees.reduce((s, f) => s + f.amount, 0));

  const amount_credited = gz(pp.amount_credited);
  if (amount_credited <= 0) exceptions.push('AMOUNT_CREDITED_ZERO_OR_ABSENT');

  const expected_credit = r2(amount_collected - total_fees);
  const at_par_discrepancy = r2(amount_credited - expected_credit);
  const at_par = Math.abs(at_par_discrepancy) <= EPS;
  if (!at_par && at_par_discrepancy > 0) exceptions.push('AMOUNT_CREDITED_EXCEEDS_EXPECTED');
  else if (!at_par && at_par_discrepancy < 0) exceptions.push('AMOUNT_CREDITED_SHORT_OF_EXPECTED');

  const rawRails = Array.isArray(pp.rails) ? pp.rails : [];
  let settledCount = 0;
  let finalityUndecidable = false;
  const rails = rawRails.map((r) => {
    r = r || {};
    const rawRail = str(r.rail);
    const rail_valid = RAIL_TYPES.indexOf(rawRail) >= 0;
    const rail = rail_valid ? rawRail : (rawRail || 'unstated');
    if (!rail_valid) exceptions.push('UNKNOWN_RAIL_TYPE:' + (rawRail || 'blank'));
    const settlement_ref = str(r.settlement_ref) || null;
    if (!settlement_ref) exceptions.push('RAIL_SETTLEMENT_REF_MISSING:' + rail);
    const finality_basis = str(r.declared_finality_basis) || null;
    if (!finality_basis) { finalityUndecidable = true; exceptions.push('RAIL_FINALITY_BASIS_MISSING:' + rail); }
    const settled = r.settled === true;
    if (settled) settledCount += 1;
    return { rail, rail_valid, settlement_ref, declared_finality_basis: finality_basis, settled };
  });
  if (rawRails.length === 0) exceptions.push('NO_RAILS_DECLARED');

  let single_settlement_status;
  if (rawRails.length === 0) {
    single_settlement_status = 'UNRESOLVED';
  } else if (settledCount === 1) {
    single_settlement_status = 'SINGLE';
  } else if (settledCount > 1) {
    single_settlement_status = 'DOUBLE_COUNT_RISK';
    exceptions.push('MULTIPLE_RAILS_SETTLED');
  } else {
    single_settlement_status = 'UNRESOLVED';
    exceptions.push('NO_RAIL_SETTLED');
  }

  const reconciliation_window = str(pp.reconciliation_window) || null;
  const as_of = str(pp.as_of) || null;

  if (single_settlement_status === 'SINGLE') compliance_flags.push('PMR_SINGLE_SETTLEMENT');
  else if (single_settlement_status === 'DOUBLE_COUNT_RISK') compliance_flags.push('PMR_DOUBLE_COUNT_RISK');

  if (attribution_matched) compliance_flags.push('PMR_ATTRIBUTION_MATCHED');
  else compliance_flags.push('PMR_ATTRIBUTION_UNRESOLVED');

  if (at_par) compliance_flags.push('PMR_AT_PAR');
  else compliance_flags.push('PMR_SHORTFALL');

  if (finalityUndecidable) compliance_flags.push('PMR_FINALITY_UNDECIDABLE');

  const reconciled = exceptions.length === 0;
  if (reconciled) compliance_flags.push('PMR_RECONCILED');

  return {
    output_payload: {
      payment_ref,
      payer_class,
      payer_class_valid,
      declared_revenue_code,
      attribution_matched,
      attributed_ministry,
      treasury_account_credited,
      currency,
      amount_collected: jnum(amount_collected),
      fees,
      total_fees_itemised: jnum(total_fees),
      amount_credited: jnum(amount_credited),
      expected_credit: jnum(expected_credit),
      at_par_discrepancy: jnum(at_par_discrepancy),
      at_par,
      rails,
      single_settlement_status,
      reconciliation_window,
      as_of,
      reconciled,
      exceptions,
    },
    compliance_flags,
  };
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
