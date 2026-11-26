import { executionHash } from './_hash.mjs';

// art-855-murabahah-tawarruq-sequence: an order-of-steps and rule checklist for a murabahah or
// tawarruq structure, values only. The caller lists dated step records; the kernel runs a fixed
// table of pass/fail checks and reports order and rules as two separate questions.
// DETERMINISM: compute() is a pure function of its input. No clock, no randomness, no network.
// It uses no TextEncoder, atob, btoa or URL, so it runs unmodified in the zkVM guest.

const TOOL_ID = 'art-855-murabahah-tawarruq-sequence';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_murabahah_tawarruq_seq',
  mandate_type: 'compliance_control', gpu: false,
};

// ── closed vocabularies ──────────────────────────────────────────────────────────
export const STRUCTURES = ['murabahah', 'tawarruq'];
export const STEPS = [
  'ifi_acquires_asset', 'wad_executed', 'agent_purchases_asset', 'sale_contract',
  'possession_transfer', 'wakalah_contract', 'onsale_contract', 'payment_to_seller',
];
export const FLAG_KEYS = [
  'agent_role', 'delivery_restricted', 'onsale_obligation', 'promise_to_sell_third_party',
  'promise_to_sell_original_seller', 'payment_before_contract', 'embedded_in_sale_contract',
];
const RECORD_KEYS = ['step', 't', 'evidence_present'].concat(FLAG_KEYS);
const PP_KEYS = ['structure', 'steps', 'authority_profile'];
export const MAX_STEPS = 64;
export const SUPPORTED_AUTHORITIES = ['BNM'];
export const AUTHORITY_NOTE = 'BNM profile; other authorities may differ, not assessed';

// ── authority profile table (one entry per rule, never merged across authorities) ─
const BNM_MURABAHAH = {
  authority: 'BNM', doc: 'BNM-MURABAHAH-PD-2013', as_of: '2013-12-23',
  pin_sha256: 'e9665bdc5644b1ef23b40d0d11aa06eca3366eb1a8eb49ed38d1fa7473dfb935',
};
const BNM_TAWARRUQ = {
  authority: 'BNM', doc: 'BNM-TAWARRUQ-PD028-8-2018', as_of: '2018-12-28',
  pin_sha256: '5a239d878960ddf6d216f843b7a9def9dcfea38f81f09b2a511f3cf6014d8a34',
};

// kind 'order' = a sequencing question; kind 'rule' = a content question.
export const CHECKS = [
  { id: 'M_OWNERSHIP_BEFORE_SALE', kind: 'order', structure: 'murabahah', profile: BNM_MURABAHAH, para: '23.17' },
  { id: 'M_OWNERSHIP_TRANSFER_EVIDENCED', kind: 'rule', structure: 'murabahah', profile: BNM_MURABAHAH, para: '13.5-13.7' },
  { id: 'M_WAD_SEPARATE_AND_BEFORE', kind: 'order', structure: 'murabahah', profile: BNM_MURABAHAH, para: '15.2-15.3' },
  { id: 'M_AGENT_PURCHASE_BEFORE_SALE', kind: 'order', structure: 'murabahah', profile: BNM_MURABAHAH, para: '16.9' },
  { id: 'T_CONTRACTS_SEPARATE_EVIDENCED', kind: 'rule', structure: 'tawarruq', profile: BNM_TAWARRUQ, para: '15.2-15.3' },
  { id: 'T_POSSESSION_BEFORE_ONSALE', kind: 'order', structure: 'tawarruq', profile: BNM_TAWARRUQ, para: '13.8' },
  { id: 'T_DELIVERY_UNRESTRICTED', kind: 'rule', structure: 'tawarruq', profile: BNM_TAWARRUQ, para: '15.4-15.5' },
  { id: 'T_NO_ONSALE_OBLIGATION', kind: 'rule', structure: 'tawarruq', profile: BNM_TAWARRUQ, para: '15.5' },
  { id: 'T_NO_PAYMENT_BEFORE_CONTRACT', kind: 'order', structure: 'tawarruq', profile: BNM_TAWARRUQ, para: '15.6' },
  { id: 'T_WAKALAH_SEPARATE_ROLE_SPECIFIED', kind: 'rule', structure: 'tawarruq', profile: BNM_TAWARRUQ, para: '16.3, 16.7' },
  { id: 'T_NO_THIRD_PARTY_PROMISE', kind: 'rule', structure: 'tawarruq', profile: BNM_TAWARRUQ, para: '18.2-18.3' },
];
export const CHECK_IDS = CHECKS.map((c) => c.id);

// ── hashability walk (never-throw) ───────────────────────────────────────────────
const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (typeof v === 'bigint') return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': bigint' };
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// ── refusal payload ──────────────────────────────────────────────────────────────
function refuse(code, detail) {
  const flag = code;
  return {
    output_payload: {
      refused: true,
      refusal_code: code,
      refusal_detail: detail,
      supported_authorities: SUPPORTED_AUTHORITIES.slice(),
      authority_note: AUTHORITY_NOTE,
      not_a_shariah_ruling: true,
      warnings: [flag],
    },
    compliance_flags: [flag],
  };
}

// ── validation: exact allowlists, no coercion, no caller-key indexing ─────────────
function validate(pp) {
  // Returns { refusal } or { structure, steps }.
  const ppKeys = Object.keys(pp);
  for (let i = 0; i < ppKeys.length; i++) {
    if (!PP_KEYS.includes(ppKeys[i])) return { refusal: refuse('REFUSED_UNKNOWN_FIELD', 'input field not in the values-only allowlist (position ' + i + ')') };
  }
  if (pp.authority_profile !== undefined) {
    if (typeof pp.authority_profile !== 'string' || !SUPPORTED_AUTHORITIES.includes(pp.authority_profile)) {
      return { refusal: refuse('REFUSED_AUTHORITY_NOT_PINNED', 'authority_profile is not pinned; supported: ' + SUPPORTED_AUTHORITIES.join(', ')) };
    }
  }
  if (typeof pp.structure !== 'string' || !STRUCTURES.includes(pp.structure)) {
    return { refusal: refuse('REFUSED_STRUCTURE', 'structure must be exactly one of ' + STRUCTURES.join(', ')) };
  }
  if (!Array.isArray(pp.steps) || pp.steps.length < 1 || pp.steps.length > MAX_STEPS) {
    return { refusal: refuse('REFUSED_STEPS', 'steps must be an array of 1 to ' + MAX_STEPS + ' step records') };
  }
  const seen = [];
  const steps = [];
  for (let i = 0; i < pp.steps.length; i++) {
    const r = pp.steps[i];
    if (!isPlainObject(r)) return { refusal: refuse('REFUSED_STEP_RECORD', 'steps[' + i + '] must be an object') };
    const ks = Object.keys(r);
    for (let j = 0; j < ks.length; j++) {
      if (!RECORD_KEYS.includes(ks[j])) return { refusal: refuse('REFUSED_UNKNOWN_FIELD', 'steps[' + i + '] carries a field outside the values-only allowlist') };
    }
    if (typeof r.step !== 'string' || !STEPS.includes(r.step)) return { refusal: refuse('REFUSED_STEP_RECORD', 'steps[' + i + '].step must be exactly one of the declared step names') };
    if (typeof r.t !== 'number' || !Number.isSafeInteger(r.t) || r.t < 0) return { refusal: refuse('REFUSED_STEP_RECORD', 'steps[' + i + '].t must be a non-negative integer ordinal') };
    if (typeof r.evidence_present !== 'boolean') return { refusal: refuse('REFUSED_STEP_RECORD', 'steps[' + i + '].evidence_present must be a boolean') };
    const rec = { step: r.step, t: r.t, evidence_present: r.evidence_present };
    for (let j = 0; j < FLAG_KEYS.length; j++) {
      const k = FLAG_KEYS[j];
      const v = r[k];
      if (v !== undefined && typeof v !== 'boolean') return { refusal: refuse('REFUSED_STEP_RECORD', 'steps[' + i + '].' + k + ' must be a boolean when given') };
      rec[k] = v === true;
    }
    if (seen.includes(r.step)) return { refusal: refuse('REFUSED_STEP_RECORD', 'steps[' + i + '] repeats a step already listed; each step appears once') };
    seen.push(r.step);
    steps.push(rec);
  }
  return { structure: pp.structure, steps };
}

// ── checks ───────────────────────────────────────────────────────────────────────
function find(steps, name) {
  for (let i = 0; i < steps.length; i++) if (steps[i].step === name) return steps[i];
  return null;
}
function before(a, b) { return a !== null && b !== null && a.t < b.t; }

// Each runner returns { verdict: 'pass'|'fail'|'not_applicable', step, reason }.
const RUNNERS = {
  M_OWNERSHIP_BEFORE_SALE(s) {
    const own = find(s, 'ifi_acquires_asset'); const sale = find(s, 'sale_contract');
    if (own === null) return { verdict: 'fail', step: 'ifi_acquires_asset', reason: 'no asset acquisition step before the sale contract' };
    if (sale === null) return { verdict: 'fail', step: 'sale_contract', reason: 'no sale contract step listed' };
    if (!own.evidence_present) return { verdict: 'fail', step: 'ifi_acquires_asset', reason: 'ownership not evidenced' };
    if (!before(own, sale)) return { verdict: 'fail', step: 'sale_contract', reason: 'sale contract is not after asset acquisition' };
    return { verdict: 'pass', step: null, reason: 'ownership evidenced and secured before the sale contract' };
  },
  M_OWNERSHIP_TRANSFER_EVIDENCED(s) {
    const tr = find(s, 'possession_transfer'); const sale = find(s, 'sale_contract');
    if (tr === null) return { verdict: 'fail', step: 'possession_transfer', reason: 'no takhliyah and tamkin step listed' };
    if (!tr.evidence_present) return { verdict: 'fail', step: 'possession_transfer', reason: 'transfer not evidenced' };
    if (sale !== null && tr.t < sale.t) return { verdict: 'fail', step: 'possession_transfer', reason: 'transfer step precedes the sale contract it effects' };
    return { verdict: 'pass', step: null, reason: 'ownership transfer step present, evidenced and not before the sale contract' };
  },
  M_WAD_SEPARATE_AND_BEFORE(s) {
    const wad = find(s, 'wad_executed'); const sale = find(s, 'sale_contract');
    if (wad === null) return { verdict: 'fail', step: 'wad_executed', reason: 'no wa\'d step listed' };
    if (sale === null) return { verdict: 'fail', step: 'sale_contract', reason: 'no sale contract step listed' };
    if (!wad.evidence_present) return { verdict: 'fail', step: 'wad_executed', reason: 'wa\'d not evidenced' };
    if (!before(wad, sale)) return { verdict: 'fail', step: 'wad_executed', reason: 'wa\'d is not strictly before the sale contract' };
    return { verdict: 'pass', step: null, reason: 'wa\'d executed separately and before the sale contract' };
  },
  M_AGENT_PURCHASE_BEFORE_SALE(s) {
    const ag = find(s, 'agent_purchases_asset'); const sale = find(s, 'sale_contract');
    if (ag === null) return { verdict: 'not_applicable', step: null, reason: 'no purchasing agent step listed' };
    if (sale === null) return { verdict: 'fail', step: 'sale_contract', reason: 'no sale contract step listed' };
    if (!before(ag, sale)) return { verdict: 'fail', step: 'sale_contract', reason: 'sale contract is not after the agent purchase' };
    return { verdict: 'pass', step: null, reason: 'sale contract follows the agent purchase' };
  },
  T_CONTRACTS_SEPARATE_EVIDENCED(s) {
    const a = find(s, 'sale_contract'); const b = find(s, 'onsale_contract');
    if (a === null) return { verdict: 'fail', step: 'sale_contract', reason: 'no first sale contract step listed' };
    if (b === null) return { verdict: 'fail', step: 'onsale_contract', reason: 'no onward sale contract step listed' };
    if (!a.evidence_present) return { verdict: 'fail', step: 'sale_contract', reason: 'first sale contract not evidenced' };
    if (!b.evidence_present) return { verdict: 'fail', step: 'onsale_contract', reason: 'onward sale contract not evidenced' };
    if (a.t === b.t) return { verdict: 'fail', step: 'onsale_contract', reason: 'the two sale contracts share one ordinal, so they are not separate executions' };
    return { verdict: 'pass', step: null, reason: 'two separate evidenced sale contracts' };
  },
  T_POSSESSION_BEFORE_ONSALE(s) {
    const p = find(s, 'possession_transfer'); const on = find(s, 'onsale_contract');
    if (p === null) return { verdict: 'fail', step: 'possession_transfer', reason: 'no possession step listed' };
    if (on === null) return { verdict: 'fail', step: 'onsale_contract', reason: 'no onward sale contract step listed' };
    if (!p.evidence_present) return { verdict: 'fail', step: 'possession_transfer', reason: 'possession not evidenced' };
    if (!before(p, on)) return { verdict: 'fail', step: 'onsale_contract', reason: 'onward sale is not after possession' };
    return { verdict: 'pass', step: null, reason: 'possession taken before the onward sale' };
  },
  T_DELIVERY_UNRESTRICTED(s) {
    for (let i = 0; i < s.length; i++) {
      if (s[i].delivery_restricted) return { verdict: 'fail', step: s[i].step, reason: 'delivery right restricted' };
    }
    return { verdict: 'pass', step: null, reason: 'no delivery restriction flagged' };
  },
  T_NO_ONSALE_OBLIGATION(s) {
    for (let i = 0; i < s.length; i++) {
      if (s[i].onsale_obligation) return { verdict: 'fail', step: s[i].step, reason: 'obligation to sell the asset on' };
    }
    return { verdict: 'pass', step: null, reason: 'no on-sale obligation flagged' };
  },
  T_NO_PAYMENT_BEFORE_CONTRACT(s) {
    const sale = find(s, 'sale_contract'); const pay = find(s, 'payment_to_seller');
    for (let i = 0; i < s.length; i++) {
      if (s[i].payment_before_contract) return { verdict: 'fail', step: s[i].step, reason: 'payment flagged as made before the contract' };
    }
    if (pay !== null && sale !== null && !(sale.t < pay.t)) return { verdict: 'fail', step: 'payment_to_seller', reason: 'payment is not after the sale contract' };
    return { verdict: 'pass', step: null, reason: 'no payment before the contract' };
  },
  T_WAKALAH_SEPARATE_ROLE_SPECIFIED(s) {
    const w = find(s, 'wakalah_contract');
    if (w === null) return { verdict: 'not_applicable', step: null, reason: 'no wakalah step listed' };
    if (w.embedded_in_sale_contract) return { verdict: 'fail', step: 'wakalah_contract', reason: 'wakalah sits inside the sale contract' };
    if (!w.evidence_present) return { verdict: 'fail', step: 'wakalah_contract', reason: 'wakalah not evidenced' };
    if (!w.agent_role) return { verdict: 'fail', step: 'wakalah_contract', reason: 'agent role and responsibilities not specified' };
    return { verdict: 'pass', step: null, reason: 'wakalah is a separate contract with the agent role specified' };
  },
  T_NO_THIRD_PARTY_PROMISE(s) {
    for (let i = 0; i < s.length; i++) {
      if (s[i].promise_to_sell_third_party) return { verdict: 'fail', step: s[i].step, reason: 'condition requires a promise to sell to a third party' };
      if (s[i].promise_to_sell_original_seller) return { verdict: 'fail', step: s[i].step, reason: 'condition requires a promise to sell to its original seller' };
    }
    return { verdict: 'pass', step: null, reason: 'no third-party or original-seller promise condition flagged' };
  },
};

const RUNNER_MAP = new Map(Object.entries(RUNNERS));

// ── compute ──────────────────────────────────────────────────────────────────────
export function compute(rawPp) {
  if (!isPlainObject(rawPp)) return refuse('REFUSED_INPUT_NOT_OBJECT', 'input must be a plain object');
  const unhashable = findHashRefusal(rawPp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
  if (unhashable !== null) return refuse(unhashable.reason, unhashable.detail);
  const v = validate(rawPp);
  if (v.refusal) return v.refusal;

  const results = [];
  let orderOk = true;
  let rulesOk = true;
  let first = null;
  for (let i = 0; i < CHECKS.length; i++) {
    const c = CHECKS[i];
    let r;
    if (c.structure !== v.structure) r = { verdict: 'not_applicable', step: null, reason: 'check belongs to the other structure' };
    else r = RUNNER_MAP.get(c.id)(v.steps);
    if (r.verdict === 'fail') {
      if (c.kind === 'order') orderOk = false; else rulesOk = false;
      if (first === null) first = { check_id: c.id, kind: c.kind, step: r.step, authority: c.profile.authority, doc: c.profile.doc, para: c.para };
    }
    results.push({
      check_id: c.id, kind: c.kind, verdict: r.verdict, reason: r.reason, implicated_step: r.step,
      authority: c.profile.authority, doc: c.profile.doc, para: c.para,
      pin_sha256: c.profile.pin_sha256, as_of: c.profile.as_of,
    });
  }
  const compliance_flags = [];
  if (!orderOk) compliance_flags.push('ORDER_NOT_OK');
  if (!rulesOk) compliance_flags.push('RULES_NOT_OK');
  const warnings = compliance_flags.slice();
  return {
    output_payload: {
      refused: false,
      structure: v.structure,
      authority_profile: 'BNM',
      authority_note: AUTHORITY_NOTE,
      not_a_shariah_ruling: true,
      step_count: v.steps.length,
      checks: results,
      order_ok: orderOk,
      rules_ok: rulesOk,
      first_failing_step: first,
      warnings,
    },
    compliance_flags,
  };
}

// buildArtifact never throws: an input the shared canonicalizer would refuse gets a null
// execution_hash and the reason beside it.
export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: unhashable === null ? await executionHash(pp, output_payload) : null,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
