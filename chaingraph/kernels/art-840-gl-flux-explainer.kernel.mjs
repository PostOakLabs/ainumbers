import { executionHash } from './_hash.mjs';

// art-840-gl-flux-explainer -- period-over-period movement per declared GL account against a declared
// threshold policy; every breach needs a declared explanation id or the gate reads blocked.
//
// Conceptual sibling of art-485 (regulatory-report variance), re-implemented here by copy of the
// idea only -- no kernel import. Differences: GL account ids instead of report line items, integer
// minor units with exact basis-point arithmetic, an explicit one-or-both threshold rule, a declared
// zero-prior-balance rule, and explanations restricted to a caller-declared reason-code list
// (no free text is ever accepted).
//
// Flags movements over a declared threshold and requires a declared explanation id for each. It
// does not judge whether an explanation is adequate: that is a human review step, and the gate
// status this kernel returns is a routing input for it, not a decision.
//
// Inputs (policy_parameters):
//   accounts              array of declared account ids (ids only, never account numbers)
//   prior_balances        [{account_id, minor_units}]   integer minor units, |v| <= 1e15
//   current_balances      [{account_id, minor_units}]
//   threshold_policy      { version?, abs_minor_units>0, pct_bps>0, rule: 'either'|'both',
//                           zero_prior_rule: 'abs_only'|'any_movement',
//                           overrides?: [{account_id, abs_minor_units?, pct_bps?}] }
//                         A threshold that is present must be a positive integer (0 or negative is
//                         refused THRESHOLD_NOT_POSITIVE). A threshold that is absent means that test
//                         is not configured. rule 'both' needs both thresholds present, rule 'either'
//                         needs at least one (else THRESHOLD_FIELD_MISSING); an override inherits the
//                         base value for a field it omits and the same check applies to the result.
//                         version, when given, must match the id pattern (no free text).
//                         Unknown keys at the top level, in threshold_policy or in an override are
//                         refused (UNKNOWN_KEY_REFUSED).
//
// Declared limits (each is a named behaviour, not a silent one):
//   - a breach is movement >= threshold (the threshold itself breaches);
//   - movement_bps is floored; the breach test uses the exact cross-multiplication, not the floor;
//   - balances and thresholds are capped at 1e15 minor units, bps at 100000000, every list at 5000;
//   - ids are screened by shape plus a digit-run heuristic (6 or more consecutive digits reads as
//     account-number-like); it is a screen, not proof that an id carries no account number;
//   - a zero-prior account whose declared zero_prior_rule is abs_only and which has no absolute
//     threshold cannot be tested; a non-zero movement there carries ZERO_PRIOR_NOT_EVALUATED and the
//     gate reads review_required at best, never clear.
//   reason_codes          array of caller-declared explanation ids
//   explanations          [{account_id, explanation_id}] -- exactly those two keys
//
// Percentage movement is |movement| * 10000 / |prior| (basis points, floored), computed with BigInt
// and returned as a decimal string; a zero prior balance yields the string "NOT_EVALUATED", never
// infinity. Breach comparisons are exact cross-multiplications, so the floor never moves a verdict.
//
// DETERMINISM: compute() is a PURE function of pp -- no Date.now()/Math.random(), no network, no
// filesystem, no TextEncoder/atob/btoa/URL (absent in the QuickJS-ng zkVM guest).

const TOOL_ID = 'art-840-gl-flux-explainer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'explain_gl_flux_with_gate',
  mandate_type: 'assurance', gpu: false,
};

const MAX_ABS = 1000000000000000; // 1e15 minor units
const MAX_ITEMS = 5000;
const ID_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,39}$/;
const DIGIT_RUN_RE = /[0-9]{6,}/; // an account-number-like run of digits
const NOTE = 'Flags movements over a declared threshold and requires a declared explanation id for each. It does not judge whether an explanation is adequate.';

function isInt(v) { return typeof v === 'number' && Number.isSafeInteger(v); }
function isArr(v) { return Array.isArray(v); }
function isObj(v) { return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v); }
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function idProblem(v) {
  if (typeof v !== 'string' || !ID_RE.test(v)) return 'ID_SHAPE';
  if (DIGIT_RUN_RE.test(v)) return 'ID_ACCOUNT_NUMBER_LIKE';
  return null;
}
function absBig(n) { return n < 0n ? -n : n; }

function refusal(code, detail) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      gate_status: null,
      gate_policy_equivalent: null,
      accounts: [],
      breaches: [],
      unexplained_breaches: [],
      orphan_explanations: [],
      summary: null,
      warnings: code ? ['INPUT_REFUSED'] : [],
      note: NOTE,
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

function readBalances(list, label, declared) {
  if (!isArr(list) || list.length > MAX_ITEMS) return { code: 'BALANCES_SHAPE', detail: label + ' must be an array of {account_id, minor_units}' };
  const map = new Map();
  for (const row of list) {
    if (!isObj(row)) return { code: 'BALANCES_SHAPE', detail: label + ' entry is not an object' };
    const keys = Object.keys(row).filter((k) => row[k] !== undefined && row[k] !== null);
    for (const k of keys) {
      if (k !== 'account_id' && k !== 'minor_units') return { code: 'FREE_TEXT_REFUSED', detail: label + ' entry carries a field other than account_id and minor_units' };
    }
    const p = idProblem(row.account_id);
    if (p) return { code: p, detail: label + ' account_id is not an acceptable account id' };
    if (!declared.has(row.account_id)) return { code: 'ACCOUNT_NOT_DECLARED', detail: label + ' names an account that is not in the declared list' };
    if (map.has(row.account_id)) return { code: 'DUPLICATE_BALANCE', detail: label + ' repeats an account id' };
    if (!isInt(row.minor_units) || Math.abs(row.minor_units) > MAX_ABS) return { code: 'BALANCE_NOT_INTEGER', detail: label + ' minor_units must be a safe integer within 1e15' };
    map.set(row.account_id, row.minor_units);
  }
  for (const id of declared) {
    if (!map.has(id)) return { code: 'BALANCE_MISSING', detail: label + ' has no balance for a declared account' };
  }
  return { map };
}

const MAX_BPS = 100000000;
const PP_KEYS = ['accounts', 'prior_balances', 'current_balances', 'threshold_policy', 'reason_codes', 'explanations'];
const POLICY_KEYS = ['version', 'abs_minor_units', 'pct_bps', 'rule', 'zero_prior_rule', 'overrides'];
const OVERRIDE_KEYS = ['account_id', 'abs_minor_units', 'pct_bps'];

function hasUnknownKey(o, allowed) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) return true;
  return false;
}

// One threshold field: absent (undefined or null) is "not configured"; present must be a positive integer.
function readLimit(v, name, max) {
  if (v === undefined || v === null) return { value: null };
  if (!isInt(v)) return { code: 'THRESHOLD_INVALID', detail: name + ' must be a positive integer' };
  if (v <= 0) return { code: 'THRESHOLD_NOT_POSITIVE', detail: name + ' must be greater than zero; omit it to leave that test unconfigured' };
  if (v > max) return { code: 'THRESHOLD_INVALID', detail: name + ' exceeds the cap' };
  return { value: v };
}

// The rule decides which thresholds must be present on the effective policy for an account.
function ruleProblem(rule, abs, bps, who) {
  if (rule === 'both' && (abs === null || bps === null)) return { code: 'THRESHOLD_FIELD_MISSING', detail: who + ': rule both needs abs_minor_units and pct_bps' };
  if (abs === null && bps === null) return { code: 'THRESHOLD_FIELD_MISSING', detail: who + ': at least one of abs_minor_units and pct_bps is required' };
  return null;
}

function readThreshold(v) {
  if (!isObj(v)) return { code: 'THRESHOLD_POLICY_MISSING', detail: 'threshold_policy is required' };
  if (hasUnknownKey(v, POLICY_KEYS)) return { code: 'UNKNOWN_KEY_REFUSED', detail: 'threshold_policy carries a key outside the declared set' };
  if (v.rule !== 'either' && v.rule !== 'both') return { code: 'THRESHOLD_RULE_UNDECLARED', detail: 'rule must be either or both' };
  if (v.zero_prior_rule !== 'abs_only' && v.zero_prior_rule !== 'any_movement') return { code: 'ZERO_PRIOR_RULE_UNDECLARED', detail: 'zero_prior_rule must be abs_only or any_movement' };
  if (v.version !== undefined && v.version !== null && (typeof v.version !== 'string' || !ID_RE.test(v.version))) return { code: 'VERSION_SHAPE', detail: 'version must be an id (letters, digits, . _ : -), not free text' };
  const a = readLimit(v.abs_minor_units, 'abs_minor_units', MAX_ABS);
  if (a.code) return a;
  const b = readLimit(v.pct_bps, 'pct_bps', MAX_BPS);
  if (b.code) return b;
  const abs = a.value;
  const bps = b.value;
  const rp = ruleProblem(v.rule, abs, bps, 'threshold_policy');
  if (rp) return rp;
  const overrides = new Map();
  const ov = v.overrides == null ? [] : v.overrides;
  if (!isArr(ov) || ov.length > MAX_ITEMS) return { code: 'THRESHOLD_INVALID', detail: 'overrides must be an array' };
  for (const o of ov) {
    if (!isObj(o)) return { code: 'THRESHOLD_INVALID', detail: 'override entry is not an object' };
    if (hasUnknownKey(o, OVERRIDE_KEYS)) return { code: 'UNKNOWN_KEY_REFUSED', detail: 'an override carries a key outside the declared set' };
    const p = idProblem(o.account_id);
    if (p) return { code: p, detail: 'override account_id is not an acceptable account id' };
    if (overrides.has(o.account_id)) return { code: 'THRESHOLD_INVALID', detail: 'override repeats an account id' };
    const oa = readLimit(o.abs_minor_units, 'override abs_minor_units', MAX_ABS);
    if (oa.code) return oa;
    const ob = readLimit(o.pct_bps, 'override pct_bps', MAX_BPS);
    if (ob.code) return ob;
    const ea = oa.value === null ? abs : oa.value;
    const eb = ob.value === null ? bps : ob.value;
    const orp = ruleProblem(v.rule, ea, eb, 'override');
    if (orp) return orp;
    overrides.set(o.account_id, { abs: ea, bps: eb });
  }
  return {
    policy: {
      version: v.version == null ? null : v.version,
      abs, bps, rule: v.rule, zero_prior_rule: v.zero_prior_rule, overrides,
    },
  };
}

export function compute(pp) {
  pp = pp || {};
  if (!isObj(pp) || hasUnknownKey(pp, PP_KEYS)) return refusal('UNKNOWN_KEY_REFUSED', 'policy_parameters carries a key outside the declared set');

  // ---- declared accounts
  const accIn = pp.accounts;
  if (!isArr(accIn) || accIn.length === 0 || accIn.length > MAX_ITEMS) return refusal('ACCOUNTS_SHAPE', 'accounts must be a non-empty array of account ids');
  const declared = new Set();
  for (const id of accIn) {
    const p = idProblem(id);
    if (p) return refusal(p, 'an entry in accounts is not an acceptable account id');
    if (declared.has(id)) return refusal('DUPLICATE_ACCOUNT', 'accounts repeats an id');
    declared.add(id);
  }

  // ---- balances
  const prior = readBalances(pp.prior_balances, 'prior_balances', declared);
  if (prior.code) return refusal(prior.code, prior.detail);
  const current = readBalances(pp.current_balances, 'current_balances', declared);
  if (current.code) return refusal(current.code, current.detail);

  // ---- threshold policy
  const th = readThreshold(pp.threshold_policy);
  if (th.code) return refusal(th.code, th.detail);
  const policy = th.policy;
  for (const id of policy.overrides.keys()) {
    if (!declared.has(id)) return refusal('ACCOUNT_NOT_DECLARED', 'an override names an account that is not in the declared list');
  }

  // ---- reason codes and explanations (codes only, never text)
  const rcIn = pp.reason_codes == null ? [] : pp.reason_codes;
  if (!isArr(rcIn) || rcIn.length > MAX_ITEMS) return refusal('REASON_CODES_SHAPE', 'reason_codes must be an array of ids');
  const reasonCodes = new Set();
  for (const c of rcIn) {
    const p = idProblem(c);
    if (p) return refusal(p === 'ID_SHAPE' ? 'FREE_TEXT_REFUSED' : p, 'a reason code is not an acceptable id');
    reasonCodes.add(c);
  }
  const exIn = pp.explanations == null ? [] : pp.explanations;
  if (!isArr(exIn) || exIn.length > MAX_ITEMS) return refusal('EXPLANATIONS_SHAPE', 'explanations must be an array');
  const explByAccount = new Map();
  const explList = [];
  for (const e of exIn) {
    if (!isObj(e)) return refusal('EXPLANATIONS_SHAPE', 'an explanation entry is not an object');
    for (const k of Object.keys(e)) {
      if (e[k] === undefined || e[k] === null) continue;
      if (k !== 'account_id' && k !== 'explanation_id') return refusal('FREE_TEXT_REFUSED', 'an explanation carries a field other than account_id and explanation_id');
    }
    const pa = idProblem(e.account_id);
    if (pa) return refusal(pa, 'an explanation account_id is not an acceptable account id');
    if (typeof e.explanation_id !== 'string' || idProblem(e.explanation_id)) return refusal('FREE_TEXT_REFUSED', 'explanation_id must be a declared reason code id, not free text');
    if (!reasonCodes.has(e.explanation_id)) return refusal('EXPLANATION_CODE_UNDECLARED', 'explanation_id is not in the declared reason_codes list');
    explList.push({ account_id: e.account_id, explanation_id: e.explanation_id });
    if (!explByAccount.has(e.account_id)) explByAccount.set(e.account_id, new Set());
    explByAccount.get(e.account_id).add(e.explanation_id);
  }

  // ---- movement per account
  const rows = [];
  for (const id of declared) {
    const pv = prior.map.get(id);
    const cv = current.map.get(id);
    const movement = cv - pv;
    const absMovement = Math.abs(movement);
    const ov = policy.overrides.get(id);
    const tAbs = ov ? ov.abs : policy.abs;
    const tBps = ov ? ov.bps : policy.bps;
    const zeroPrior = pv === 0;

    const bpsFloor = zeroPrior ? null : (absBig(BigInt(movement)) * 10000n) / absBig(BigInt(pv));
    const absConfigured = tAbs !== null;
    const pctConfigured = tBps !== null && !zeroPrior;
    const absExceeded = absConfigured ? absMovement >= tAbs : null;
    // exact: |mov| * 10000 >= tBps * |prior|
    const pctExceeded = pctConfigured ? absBig(BigInt(movement)) * 10000n >= BigInt(tBps) * absBig(BigInt(pv)) : null;

    let breach;
    if (zeroPrior && policy.zero_prior_rule === 'any_movement') {
      breach = movement !== 0;
    } else {
      const tests = [];
      if (absExceeded !== null) tests.push(absExceeded);
      if (pctExceeded !== null) tests.push(pctExceeded);
      if (tests.length === 0) breach = false;
      else if (policy.rule === 'both') breach = tests.every((t) => t);
      else breach = tests.some((t) => t);
    }
    // a non-zero movement on a zero-prior account with no evaluable test is named, never a silent pass
    const notEvaluated = zeroPrior && movement !== 0 && !breach && !(policy.zero_prior_rule === 'any_movement') && !absConfigured;

    const ex = explByAccount.get(id);
    const explanationIds = ex ? [...ex].sort(cmp) : [];
    rows.push({
      account_id: id,
      prior_minor_units: pv,
      current_minor_units: cv,
      movement_minor_units: movement,
      abs_movement_minor_units: absMovement,
      movement_bps: bpsFloor === null ? 'NOT_EVALUATED' : bpsFloor.toString(),
      threshold_abs_minor_units: tAbs,
      threshold_pct_bps: tBps,
      abs_exceeded: absExceeded,
      pct_exceeded: pctExceeded,
      breach,
      not_evaluated: notEvaluated,
      explanation_ids: explanationIds,
      explained: breach && explanationIds.length > 0,
    });
  }
  rows.sort((a, b) => cmp(a.account_id, b.account_id));

  // ---- breach ranking: largest absolute movement first, ties by account id
  const breaches = rows
    .filter((r) => r.breach)
    .sort((a, b) => (b.abs_movement_minor_units - a.abs_movement_minor_units) || cmp(a.account_id, b.account_id))
    .map((r, i) => ({ rank: i + 1, account_id: r.account_id, abs_movement_minor_units: r.abs_movement_minor_units, movement_minor_units: r.movement_minor_units, explained: r.explained }));
  const unexplained = breaches.filter((b) => !b.explained).map((b) => b.account_id);

  // ---- explanations that match no breach
  const breachIds = new Set(breaches.map((b) => b.account_id));
  const orphanKeys = new Set();
  const orphans = [];
  for (const e of explList) {
    if (breachIds.has(e.account_id)) continue;
    const key = e.account_id + '\u0000' + e.explanation_id;
    if (orphanKeys.has(key)) continue;
    orphanKeys.add(key);
    orphans.push({ account_id: e.account_id, explanation_id: e.explanation_id, reason: declared.has(e.account_id) ? 'NO_BREACH' : 'ACCOUNT_NOT_DECLARED' });
  }
  orphans.sort((a, b) => cmp(a.account_id, b.account_id) || cmp(a.explanation_id, b.explanation_id));

  // ---- gate (SPEC section 27.4 vocabulary): auto_pass / review_required / hold
  let gate_status = 'clear';
  let gate_policy_equivalent = 'auto_pass';
  if (unexplained.length > 0) { gate_status = 'blocked'; gate_policy_equivalent = 'hold'; }
  else if (breaches.length > 0) { gate_status = 'review_required'; gate_policy_equivalent = 'review_required'; }
  const notEvaluatedCount = rows.filter((r) => r.not_evaluated).length;
  if (notEvaluatedCount > 0 && gate_status === 'clear') { gate_status = 'review_required'; gate_policy_equivalent = 'review_required'; }

  const compliance_flags = [];
  if (unexplained.length > 0) compliance_flags.push('FLUX_BREACH_UNEXPLAINED');
  if (notEvaluatedCount > 0) compliance_flags.push('ZERO_PRIOR_NOT_EVALUATED');
  if (orphans.length > 0) compliance_flags.push('EXPLANATION_ORPHANED');
  const warnings = compliance_flags.slice();

  const output_payload = {
    policy_version: policy.version,
    threshold_rule: policy.rule,
    zero_prior_rule: policy.zero_prior_rule,
    gate_status,
    gate_policy_equivalent,
    accounts: rows,
    breaches,
    unexplained_breaches: unexplained,
    orphan_explanations: orphans,
    summary: {
      account_count: rows.length,
      breach_count: breaches.length,
      unexplained_count: unexplained.length,
      not_evaluated_count: notEvaluatedCount,
      orphan_explanation_count: orphans.length,
    },
    warnings,
    note: NOTE,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
