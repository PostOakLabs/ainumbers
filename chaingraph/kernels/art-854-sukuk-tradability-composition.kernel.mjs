import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-854-sukuk-tradability-composition';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_sukuk_tradability_composition',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_PERIODS = 120;
const MAX_AUTHORITIES = 4;
const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

const SUKUK_TYPES = ['wakalah_bi_al_istithmar', 'mixed_portfolio'];
const AUTHORITIES = ['sc_malaysia', 'sbp_pakistan'];
// Named refusals for known-but-unpinned authorities (behaviour strings, not source citations).
const KNOWN_UNPINNED = {
  aaoifi_ss_17: 'AAOIFI Shariah Standard No. 17',
  aaoifi_ss_59: 'AAOIFI Shariah Standard No. 59 as published',
  aaoifi_ss_62: 'AAOIFI draft Shariah Standard No. 62 (draft, not final)',
  aaoifi_draft_ss_62: 'AAOIFI draft Shariah Standard No. 62 (draft, not final)',
  iifa: 'IIFA',
  cbb: 'CBB',
  dfsa: 'DFSA',
  dsn_mui: 'DSN-MUI',
  cma: 'CMA',
};
const AUTHORITY_LABEL = {
  sc_malaysia: 'SC Malaysia Shariah Advisory Council, 266th meeting, 16 March 2023',
  sbp_pakistan: 'State Bank of Pakistan, IFPD Circular 10 of 2024, Appendix A',
};
// SC issuance threshold: at least 33 percent of proceeds in non-debt assets (exact integer form).
const SC_NUM = 33n, SC_DEN = 100n;
// SBP tangible threshold: at least 33 percent of asset value (exact integer form).
const SBP_NUM = 33n, SBP_DEN = 100n;

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
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
  }
  return null;
}

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const hasOwn = (o, k) => Object.hasOwn(o, k);
const refuse = (errors, code, detail) => { errors.push(code + ': ' + detail); };

function pctString(bp) {
  const neg = bp < 0n;
  const a = neg ? -bp : bp;
  return (neg ? '-' : '') + String(a / 100n) + '.' + String(a % 100n).padStart(2, '0');
}

function emptyPayload() {
  return {
    not_a_shariah_ruling: true,
    valid_input: false,
    domain_errors: [],
    refusal_code: null,
    sukuk_type: null,
    commingled_entity: null,
    authorities: [],
    results: [],
    all_tradable: null,
    warnings: [],
  };
}

function refusedResult(errors) {
  const output_payload = emptyPayload();
  output_payload.domain_errors = errors;
  output_payload.refusal_code = errors[0].split(':')[0];
  const compliance_flags = [];
  if (errors.length > 0) compliance_flags.push('INPUT_REFUSED', output_payload.refusal_code);
  output_payload.warnings = compliance_flags.slice();
  return { output_payload, compliance_flags };
}

// Basis-point share of a component over the period total; display only, verdicts compare exact integers.
function shareBp(component, total) {
  return (component * 10000n) / total;
}

function validate(pp) {
  const errors = [];

  let sukukType = null;
  if (!hasOwn(pp, 'sukuk_type') || typeof pp.sukuk_type !== 'string' || !SUKUK_TYPES.includes(pp.sukuk_type)) {
    refuse(errors, 'REFUSED_SUKUK_TYPE', 'sukuk_type must be exactly one of ' + SUKUK_TYPES.join(', '));
  } else sukukType = pp.sukuk_type;

  let authorities = null;
  if (!hasOwn(pp, 'authorities') || !Array.isArray(pp.authorities) || pp.authorities.length < 1 || pp.authorities.length > MAX_AUTHORITIES) {
    refuse(errors, 'REFUSED_AUTHORITIES', 'authorities must be an array of 1 to ' + MAX_AUTHORITIES + ' authority names');
  } else {
    authorities = [];
    const seen = new Set();
    for (let i = 0; i < pp.authorities.length; i++) {
      const a = pp.authorities[i], path = 'authorities[' + i + ']';
      if (typeof a !== 'string') {
        refuse(errors, 'REFUSED_AUTHORITIES', path + ' must be a string');
      } else if (AUTHORITIES.includes(a)) {
        if (seen.has(a)) refuse(errors, 'REFUSED_AUTHORITIES', path + ' repeats authority ' + a);
        else { seen.add(a); authorities.push(a); }
      } else if (Object.hasOwn(KNOWN_UNPINNED, a)) {
        const unpinned = KNOWN_UNPINNED[a];
        let detail = unpinned + ' is not pinned by this node; supported authorities: ' + AUTHORITIES.join(', ');
        if (a === 'aaoifi_ss_62' || a === 'aaoifi_draft_ss_62') {
          detail = unpinned + '; no verdict is given for it. Supported authorities: ' + AUTHORITIES.join(', ');
        }
        refuse(errors, 'AUTHORITY_NOT_PINNED', detail);
      } else {
        refuse(errors, 'AUTHORITY_NOT_PINNED', 'authority ' + a + ' is not pinned; supported authorities: ' + AUTHORITIES.join(', '));
      }
    }
  }

  let commingled = null;
  if (!hasOwn(pp, 'commingled_entity') || typeof pp.commingled_entity !== 'boolean') {
    refuse(errors, 'REFUSED_COMMINGLED_ENTITY', 'commingled_entity must be a boolean (whether the assets sit in an entity where the pinned commingling principle is materialised)');
  } else commingled = pp.commingled_entity;

  let periods = null;
  if (!hasOwn(pp, 'periods') || !Array.isArray(pp.periods) || pp.periods.length < 1 || pp.periods.length > MAX_PERIODS) {
    refuse(errors, 'REFUSED_PERIODS', 'periods must be an array of 1 to ' + MAX_PERIODS + ' composition records');
  } else {
    periods = [];
    for (let i = 0; i < pp.periods.length; i++) {
      const p = pp.periods[i], path = 'periods[' + i + ']';
      const before = errors.length;
      if (!isPlainObject(p)) {
        refuse(errors, 'REFUSED_INPUT_TYPE', path + ' must be an object');
        continue;
      }
      const amounts = {};
      for (const key of ['non_debt_minor_units', 'debt_minor_units', 'cash_minor_units']) {
        const v = hasOwn(p, key) ? p[key] : undefined;
        if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) {
          refuse(errors, 'REFUSED_AMOUNT', path + '.' + key + ' must be a non-negative safe integer of minor units');
        } else amounts[key] = v;
      }
      if (!hasOwn(p, 'is_issuance_date') || typeof p.is_issuance_date !== 'boolean') {
        refuse(errors, 'REFUSED_ISSUANCE_FLAG', path + '.is_issuance_date must be a boolean');
      }
      if (errors.length === before) {
        const total = BigInt(amounts.non_debt_minor_units) + BigInt(amounts.debt_minor_units) + BigInt(amounts.cash_minor_units);
        if (total === 0n) {
          refuse(errors, 'REFUSED_EMPTY_PERIOD', path + ' composition sums to zero; supply the portfolio composition for every period');
        } else {
          periods.push({
            nonDebt: BigInt(amounts.non_debt_minor_units),
            debt: BigInt(amounts.debt_minor_units),
            cash: BigInt(amounts.cash_minor_units),
            total,
            isIssuance: p.is_issuance_date,
          });
        }
      }
    }
  }
  return { errors, sukukType, authorities, commingled, periods };
}

function scVerdict(p) {
  // Issuance test: non-debt at least 33 percent of proceeds, exact integer comparison.
  if (p.isIssuance && p.nonDebt * SC_DEN < SC_NUM * p.total) {
    return { verdict: 'issuance_test_failed', para: 'resolution (A)(i)', reason: 'non-debt share of proceeds is below the minimum at issuance' };
  }
  if (p.nonDebt === 0n) {
    return { verdict: 'sale_of_debt_rules_apply', para: 'resolutions (A)(ii) and (B)(ii)', reason: 'the non-debt component is absent, so the portfolio is treated as debt' };
  }
  return { verdict: 'tradable_at_negotiated_price', para: 'resolutions (B)(i) and (B)(ii)', reason: 'a non-debt component is present, so the portfolio is not categorised as debt' };
}

function sbpVerdict(p, commingled) {
  // Tangible test: tangible and like assets at least 33 percent of asset value, exact integer comparison.
  if (p.nonDebt * SBP_DEN >= SBP_NUM * p.total) {
    return { verdict: 'tradable_at_negotiated_price', para: 'item 24, clauses 8/2/2(i)-(ii)', reason: 'tangible and like assets meet the minimum share of asset value' };
  }
  if (commingled && p.nonDebt > 0n) {
    return { verdict: 'tradable_at_negotiated_price', para: 'item 22, clause 8/1', reason: 'the assets sit in a commingled entity that is not entirely composed of debt' };
  }
  if (commingled && p.nonDebt === 0n) {
    return { verdict: 'sale_of_debt_rules_apply', para: 'item 22, clause 8/1 proviso', reason: 'the entity is entirely composed of debt' };
  }
  return { verdict: 'sale_of_debt_rules_apply', para: 'item 25, clause 8/3', reason: 'debts and tangibles are combined without a commingled entity, so the sale-of-debt provisions apply' };
}

export function compute(pp) {
  if (!isPlainObject(pp)) return refusedResult(['REFUSED_INPUT_WRONG_TYPE: policy_parameters must be an object']);
  const unhashable = findHashRefusal(pp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
  if (unhashable !== null) return refusedResult([unhashable.reason + ': ' + unhashable.detail]);

  const v = validate(pp);
  if (v.errors.length > 0) return refusedResult(v.errors);

  const requestedSc = v.authorities.includes('sc_malaysia');
  if (requestedSc && !v.periods.some((p) => p.isIssuance)) {
    return refusedResult(['REFUSED_NO_ISSUANCE_PERIOD: the SC Malaysia profile tests the composition at each issuance, so at least one period must carry is_issuance_date true']);
  }

  const compliance_flags = [];
  const results = [];
  for (const authority of v.authorities) {
    const rows = [];
    let firstFailing = null;
    for (let i = 0; i < v.periods.length; i++) {
      const p = v.periods[i];
      const judged = authority === 'sc_malaysia' ? scVerdict(p) : sbpVerdict(p, v.commingled);
      if (judged.verdict !== 'tradable_at_negotiated_price' && firstFailing === null) firstFailing = i;
      rows.push({
        period: i,
        is_issuance_date: p.isIssuance,
        non_debt_share_pct: pctString(shareBp(p.nonDebt, p.total)),
        non_debt_share_bp: Number(shareBp(p.nonDebt, p.total)),
        total_minor_units: p.total.toString(),
        verdict: judged.verdict,
        para: judged.para,
        reason: judged.reason,
      });
    }
    const authorityTag = authority === 'sc_malaysia' ? 'SC' : 'SBP';
    const allTradable = rows.every((r) => r.verdict === 'tradable_at_negotiated_price');
    if (!allTradable) {
      const codes = new Set(rows.filter((r) => r.verdict !== 'tradable_at_negotiated_price').map((r) => r.verdict));
      for (const c of codes) compliance_flags.push(authorityTag + '_' + c.toUpperCase());
    }
    results.push({
      authority,
      authority_label: Object.hasOwn(AUTHORITY_LABEL, authority) ? AUTHORITY_LABEL[authority] : authority,
      periods: rows,
      first_failing_period: firstFailing,
      all_tradable: allTradable,
    });
  }

  const output_payload = {
    not_a_shariah_ruling: true,
    valid_input: true,
    domain_errors: [],
    refusal_code: null,
    sukuk_type: v.sukukType,
    commingled_entity: v.commingled,
    authorities: v.authorities.slice(),
    results,
    all_tradable: results.every((r) => r.all_tradable),
    warnings: compliance_flags.slice(),
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'preimage', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now,
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
