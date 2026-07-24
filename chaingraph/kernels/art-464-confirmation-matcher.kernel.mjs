import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-464-confirmation-matcher';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'match_confirmations',
  mandate_type: 'compliance_control', gpu: false,
};

// Bank / accounts-receivable confirmation-matching substantive audit
// procedure. Joins caller-supplied third-party confirmation responses
// against caller-supplied ledger balances on (counterparty_id, type), and
// classifies each pair EXACT_MATCH / TOLERANCE_MATCH / MISMATCH, plus
// confirmations with no corresponding ledger balance and ledger balances
// with no corresponding confirmation. The match tolerance (tolerance_abs,
// tolerance_pct) is a caller-declared policy input; the explicit, echoed
// default is 0/0 (exact match required) when the caller declares neither --
// there is no silent, unrecorded tolerance. A duplicate (counterparty_id,
// type) key on either side is reported as a data-quality flag rather than
// silently overwritten -- only the first occurrence on each side is joined,
// so a second confirmation or ledger balance for the same key surfaces in
// duplicate_confirmation_keys / duplicate_ledger_keys instead of vanishing.
// Pure ECMA-262 arithmetic only -- no Date, no Math.random. NaN-safe.

function num(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function s(v) { return String(v == null ? '' : v).trim(); }
function key(counterparty_id, type) { return `${counterparty_id}::${type}`; }

function withinTolerance(variance, base, tolAbs, tolPct) {
  const absOk = tolAbs != null ? Math.abs(variance) <= tolAbs : null;
  const pctOk = (tolPct != null && base !== 0) ? Math.abs((variance / base) * 100) <= tolPct : null;
  if (absOk !== null || pctOk !== null) {
    const passes = [absOk, pctOk].filter((x) => x !== null);
    return passes.every((p) => p === true);
  }
  return variance === 0;
}

export function compute(pp) {
  pp = pp || {};
  const tolAbs = num(pp.tolerance_abs, 0);
  const tolPct = num(pp.tolerance_pct, 0);
  const tolerance_declared = pp.tolerance_abs != null || pp.tolerance_pct != null;

  const confirmations = arr(pp.confirmations).map((c) => ({
    confirmation_id: s(c && c.confirmation_id),
    counterparty_id: s(c && c.counterparty_id),
    type: s(c && c.type) || 'bank',
    confirmed_balance: num(c && c.confirmed_balance, 0),
    confirmation_date: s(c && c.confirmation_date) || null,
  })).filter((c) => c.confirmation_id && c.counterparty_id);

  const ledger = arr(pp.ledger_balances).map((l) => ({
    counterparty_id: s(l && l.counterparty_id),
    type: s(l && l.type) || 'bank',
    ledger_balance: num(l && l.ledger_balance, 0),
    as_of_date: s(l && l.as_of_date) || null,
  })).filter((l) => l.counterparty_id);

  const ledgerByKey = new Map();
  const duplicate_ledger_keys = [];
  for (const l of ledger) {
    const k = key(l.counterparty_id, l.type);
    if (ledgerByKey.has(k)) duplicate_ledger_keys.push(k);
    else ledgerByKey.set(k, l);
  }

  const confirmationKeysSeen = new Set();
  const duplicate_confirmation_keys = [];
  const matched = [];
  const unmatched = [];
  const matchedLedgerKeys = new Set();

  for (const c of confirmations) {
    const k = key(c.counterparty_id, c.type);
    if (confirmationKeysSeen.has(k)) { duplicate_confirmation_keys.push(k); continue; }
    confirmationKeysSeen.add(k);

    const l = ledgerByKey.get(k);
    if (!l) {
      unmatched.push({
        confirmation_id: c.confirmation_id, counterparty_id: c.counterparty_id, type: c.type,
        confirmed_balance: r2(c.confirmed_balance), ledger_balance: null, variance: null,
        reason: 'NO_LEDGER_BALANCE',
      });
      continue;
    }
    matchedLedgerKeys.add(k);
    const variance = r2(c.confirmed_balance - l.ledger_balance);
    const isExact = variance === 0;
    const isTolerance = !isExact && withinTolerance(variance, l.ledger_balance, tolAbs, tolPct);

    const record = {
      confirmation_id: c.confirmation_id, counterparty_id: c.counterparty_id, type: c.type,
      confirmed_balance: r2(c.confirmed_balance), ledger_balance: r2(l.ledger_balance), variance,
    };
    if (isExact) {
      matched.push({ ...record, match_type: 'EXACT_MATCH' });
    } else if (isTolerance) {
      matched.push({ ...record, match_type: 'TOLERANCE_MATCH' });
    } else {
      unmatched.push({ ...record, reason: 'MISMATCH' });
    }
  }

  for (const [k, l] of ledgerByKey) {
    if (!matchedLedgerKeys.has(k)) {
      unmatched.push({
        confirmation_id: null, counterparty_id: l.counterparty_id, type: l.type,
        confirmed_balance: null, ledger_balance: r2(l.ledger_balance), variance: null,
        reason: 'NO_CONFIRMATION',
      });
    }
  }

  const exact_count = matched.filter((m) => m.match_type === 'EXACT_MATCH').length;
  const tolerance_count = matched.filter((m) => m.match_type === 'TOLERANCE_MATCH').length;

  const compliance_flags = ['CONFIRM_MATCH_RUN'];
  if (!tolerance_declared) compliance_flags.push('CONFIRM_MATCH_TOLERANCE_NOT_DECLARED');
  if (unmatched.length > 0) compliance_flags.push('CONFIRM_MATCH_UNMATCHED_ITEMS');
  if (duplicate_confirmation_keys.length > 0 || duplicate_ledger_keys.length > 0) compliance_flags.push('CONFIRM_MATCH_DUPLICATE_KEYS');
  if (confirmations.length > 0 && unmatched.length === 0) compliance_flags.push('CONFIRM_MATCH_ALL_MATCHED');

  return {
    output_payload: {
      tolerance_used: { abs: tolAbs, pct: tolPct, declared_by_caller: tolerance_declared },
      total_confirmations: confirmations.length,
      total_ledger_balances: ledger.length,
      matched_count: matched.length,
      exact_count,
      tolerance_count,
      unmatched_count: unmatched.length,
      duplicate_confirmation_keys,
      duplicate_ledger_keys,
      matched,
      unmatched,
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
