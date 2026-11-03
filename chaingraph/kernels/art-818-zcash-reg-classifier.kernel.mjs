import { executionHash } from './_hash.mjs';

// art-818-zcash-reg-classifier: classifies caller-declared properties of a privacy-feature
// coin and of the declaring entity against two pinned provisions of the Official Journal text:
//   R1  the MiCA paragraph on inbuilt anonymisation functions on trading platforms
//   R2  the AMLR paragraph on accounts allowing anonymisation or obfuscation, with its two dates
//       (the citations and dates are in the node metadata and the pin note)
// The output places the declared inputs against the text. It is technical documentation, not
// legal advice and not a legal conclusion: whether a given coin has an "inbuilt anonymisation
// function", or whether an account "allows anonymisation or increased obfuscation of
// transactions", is declared by the caller and is never judged here.
//
// DETERMINISM: compute() is a PURE function of pp. No clock, no network, no filesystem, no
// TextEncoder/atob/URL (the QuickJS guest lacks them). Every loop is bounded by a fixed cap.

const TOOL_ID = 'art-818-zcash-reg-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_privacy_coin_regulatory_treatment',
  mandate_type: 'compliance_mandate', gpu: false,
};

const ROLES = ['casp_operating_trading_platform', 'casp_other', 'credit_or_financial_institution', 'other'];
const TOP_KEYS = ['assessment_date', 'coin_label', 'declared_properties', 'entity'];
const PROP_KEYS = ['inbuilt_anonymisation_function', 'holders_identifiable_by_platform_casp', 'transaction_history_identifiable_by_platform_casp', 'account_allows_anonymisation_or_obfuscation'];
const ENTITY_KEYS = ['role', 'obliged_entity_art_3_3_n_or_o'];
const LABEL_MAX = 64;

const MICA_76_3_FROM = '2024-12-30';
const AMLR_79_1_FROM = '2027-07-10';
const AMLR_79_1_FROM_N_O = '2029-07-10';

const DISCLAIMER = 'technical documentation, not legal advice';
const SCOPE = 'declared inputs placed against pinned Official Journal text; not a legal conclusion';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

function validDate(s) {
  if (typeof s !== 'string' || s.length !== 10) return false;
  for (let i = 0; i < 10; i++) {
    const c = s.charCodeAt(i);
    if (i === 4 || i === 7) { if (c !== 45) return false; } else if (c < 48 || c > 57) return false;
  }
  const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
  if (y < 1900 || y > 2200 || m < 1 || m > 12) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = m === 2 && leap ? 29 : DAYS[m - 1];
  return d >= 1 && d <= dim;
}

function unknownKeys(o, allowed) {
  const out = [];
  const ks = Object.keys(o);
  for (let i = 0; i < ks.length && i < 64; i++) if (allowed.indexOf(ks[i]) < 0) out.push(ks[i]);
  return out;
}

function validLabel(s) {
  if (typeof s !== 'string' || s.length < 1 || s.length > LABEL_MAX) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 || c === 127) return false;
  }
  return true;
}

function refusal(code, field, detail) { return { code, field, detail }; }

function validate(pp) {
  const r = [];
  if (!isObj(pp)) return [refusal('NOT_AN_OBJECT', 'policy_parameters', 'policy_parameters must be an object')];
  const uk = unknownKeys(pp, TOP_KEYS);
  for (let i = 0; i < uk.length; i++) r.push(refusal('UNKNOWN_FIELD', uk[i], 'field is not part of the input schema'));
  if (!validDate(pp.assessment_date)) r.push(refusal('BAD_DATE', 'assessment_date', 'assessment_date must be a real calendar date YYYY-MM-DD'));
  if (!validLabel(pp.coin_label)) r.push(refusal('BAD_LABEL', 'coin_label', 'coin_label must be a 1 to 64 character string without control characters'));
  if (!isObj(pp.entity)) {
    r.push(refusal('MISSING_OBJECT', 'entity', 'entity must be an object'));
  } else {
    const e = pp.entity;
    const ek = unknownKeys(e, ENTITY_KEYS);
    for (let i = 0; i < ek.length; i++) r.push(refusal('UNKNOWN_FIELD', 'entity.' + ek[i], 'field is not part of the input schema'));
    if (ROLES.indexOf(e.role) < 0) r.push(refusal('BAD_ROLE', 'entity.role', 'role must be one of ' + ROLES.join(', ')));
    if (e.obliged_entity_art_3_3_n_or_o !== undefined && typeof e.obliged_entity_art_3_3_n_or_o !== 'boolean') {
      r.push(refusal('NOT_BOOLEAN', 'entity.obliged_entity_art_3_3_n_or_o', 'must be true or false when present'));
    }
  }
  if (!isObj(pp.declared_properties)) {
    r.push(refusal('MISSING_OBJECT', 'declared_properties', 'declared_properties must be an object'));
  } else {
    const d = pp.declared_properties;
    const dk = unknownKeys(d, PROP_KEYS);
    for (let i = 0; i < dk.length; i++) r.push(refusal('UNKNOWN_FIELD', 'declared_properties.' + dk[i], 'field is not part of the input schema'));
    for (let i = 0; i < PROP_KEYS.length; i++) {
      const k = PROP_KEYS[i];
      if (d[k] !== undefined && typeof d[k] !== 'boolean') r.push(refusal('NOT_BOOLEAN', 'declared_properties.' + k, 'must be true or false when present'));
    }
  }
  return r;
}

function str(x) { return x === true ? 'true' : x === false ? 'false' : 'not declared'; }

// R1: addressed to the operating rules of a trading platform for crypto-assets,
// so the declared role must be casp_operating_trading_platform.
function ruleMica763(pp) {
  const d = pp.declared_properties, role = pp.entity.role;
  const base = {
    rule_id: 'R1',
    citation: 'Regulation (EU) 2023/1114 Article 76(3)',
    applies_from: MICA_76_3_FROM,
    applies_from_citation: 'Regulation (EU) 2023/1114 Article 149(2)',
  };
  if (pp.assessment_date < MICA_76_3_FROM) {
    return { ...base, status: 'NOT_YET_APPLICABLE', reason: 'assessment_date is before the date from which the text states the Regulation applies (' + MICA_76_3_FROM + ')' };
  }
  if (role !== 'casp_operating_trading_platform') {
    return { ...base, status: 'ROLE_NOT_ADDRESSED', reason: 'the paragraph addresses the operating rules of a trading platform for crypto-assets; the declared role is ' + role };
  }
  if (d.inbuilt_anonymisation_function !== true) {
    return { ...base, status: 'OUTSIDE_DECLARED_SCOPE', reason: 'inbuilt_anonymisation_function is ' + str(d.inbuilt_anonymisation_function) + '; the paragraph is about crypto-assets that have an inbuilt anonymisation function' };
  }
  if (d.holders_identifiable_by_platform_casp === true && d.transaction_history_identifiable_by_platform_casp === true) {
    return { ...base, status: 'WITHIN_TEXT_EXCEPTION_ON_DECLARED_INPUTS', reason: 'holders and transaction history are both declared identifiable by the platform operator, which is the condition in the paragraph\'s unless clause; the declaration is not verified here' };
  }
  return { ...base, status: 'WITHIN_TEXT_RESTRICTION_ON_DECLARED_INPUTS', reason: 'inbuilt anonymisation function declared; holders identifiable is ' + str(d.holders_identifiable_by_platform_casp) + ' and transaction history identifiable is ' + str(d.transaction_history_identifiable_by_platform_casp) + ', so the unless clause is not declared met' };
}

// R2: addressed to credit institutions, financial institutions and
// crypto-asset service providers; the later date applies to the declared special entities.
function ruleAmlr791(pp) {
  const d = pp.declared_properties, e = pp.entity;
  const special = e.obliged_entity_art_3_3_n_or_o === true;
  const from = special ? AMLR_79_1_FROM_N_O : AMLR_79_1_FROM;
  const base = {
    rule_id: 'R2',
    citation: 'Regulation (EU) 2024/1624 Article 79(1)',
    applies_from: from,
    applies_from_citation: 'Regulation (EU) 2024/1624 Article 90',
  };
  if (e.role === 'other') {
    return { ...base, status: 'ROLE_NOT_ADDRESSED', reason: 'the paragraph addresses credit institutions, financial institutions and crypto-asset service providers; the declared role is other' };
  }
  if (pp.assessment_date < from) {
    return { ...base, status: 'NOT_YET_APPLICABLE', reason: 'assessment_date is before the date from which the text states the Regulation applies to this entity (' + from + '); nothing here treats Article 79(1) as in force earlier' };
  }
  if (d.account_allows_anonymisation_or_obfuscation !== true) {
    return { ...base, status: 'OUTSIDE_DECLARED_SCOPE', reason: 'account_allows_anonymisation_or_obfuscation is ' + str(d.account_allows_anonymisation_or_obfuscation) };
  }
  return { ...base, status: 'WITHIN_TEXT_PROHIBITION_ON_DECLARED_INPUTS', reason: 'an account allowing anonymisation of the account holder, or anonymisation or increased obfuscation of transactions (including through anonymity-enhancing coins), is declared' };
}

/**
 * compute(pp) pure classification kernel.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const refusals = validate(pp);
  if (refusals.length > 0) {
    return {
      output_payload: { classification_scope: SCOPE, disclaimer: DISCLAIMER, refusals, rules: [], errors: ['INPUT_REFUSED'] },
      compliance_flags: ['INPUT_REFUSED'],
    };
  }
  const rules = [ruleMica763(pp), ruleAmlr791(pp)];
  const flags = [];
  let within = 0, notYet = 0;
  for (let i = 0; i < rules.length; i++) {
    const s = rules[i].status;
    if (s.indexOf('WITHIN_TEXT_') === 0) within++;
    if (s === 'NOT_YET_APPLICABLE') notYet++;
  }
  if (rules[0].status === 'WITHIN_TEXT_RESTRICTION_ON_DECLARED_INPUTS') flags.push('MICA_76_3_RESTRICTION_DECLARED');
  if (rules[1].status === 'WITHIN_TEXT_PROHIBITION_ON_DECLARED_INPUTS') flags.push('AMLR_79_1_PROHIBITION_DECLARED');
  if (rules[1].status === 'NOT_YET_APPLICABLE') flags.push('AMLR_79_1_NOT_YET_APPLICABLE');
  return {
    output_payload: {
      classification_scope: SCOPE,
      disclaimer: DISCLAIMER,
      coin_label: pp.coin_label,
      assessment_date: pp.assessment_date,
      declared_role: pp.entity.role,
      rules,
      summary: { rules_evaluated: rules.length, within_text_count: within, not_yet_applicable_count: notYet },
      refusals: [],
      errors: flags.slice(),
    },
    compliance_flags: flags,
  };
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
