import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-807-erc3643-transfer-decision';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_erc3643_transfer_decision',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Recomputes the transfer decision of a permissioned token for ONE proposed
// transfer or mint, from caller-declared state only: identity registry
// entries (identity present, investor country, claims), required claim
// topics, trusted issuers per topic, bound compliance modules, and token
// state (paused, frozen wallets, frozen token amounts, balances, supply).
// Nothing is read from any chain; the node cannot know whether the declared
// state matches a deployed contract, and says so in declared_context.
//
// Gate order for a transfer (first failure denies, later gates are still
// reported): token paused, either party frozen, amount above the sender's
// unfrozen balance, receiver identity not verified, then every bound module
// in declared order (logical AND, first failing module named). A mint
// (from = zero address) skips the pause, freeze and balance gates and runs
// identity then modules.
//
// Receiver verification: an identity must be present; with no required
// topics it is verified; otherwise every required topic needs at least one
// trusted issuer, and at least one claim on that topic from a trusted issuer
// that the caller declares valid. Claim validity itself is caller-declared.
//
// Required inputs are fail-closed: an absent or null required_claim_topics,
// trusted_issuers or compliance_modules refuses (INPUT_REFUSED, no decision);
// an explicit empty list is the caller's own statement that nothing is
// required, trusted or bound, and evaluates as such.
//
// Modules re-implemented as pure rules over declared params:
//   max_balance          deny if amount > max, or receiver identity balance
//                        (params.identity_balance, else balances[to]) plus
//                        amount > max
//   supply_limit         mint only: deny if total_supply + amount > limit;
//                        an ordinary transfer passes
//   country_restriction  deny if the receiver's registry country is in
//                        blocked_countries (unregistered country reads as 0)
//   country_whitelist    deny unless the receiver's registry country is in
//                        allowed_countries
//   pass_through         caller-declared outcome {passes, reason}; the node
//                        aggregates it, it does not judge it
//
// Optional fund_covenant is evaluated independently over the same declared
// state and compared with the token-level decision (divergence output).
//
// Exact integer arithmetic only (BigInt over decimal strings). No Date, no
// Math.random, no network. Every loop is bounded by the hard caps below.

const ZERO = '0x0000000000000000000000000000000000000000';
const ADDR_RE = /^0x[0-9a-f]{40}$/;
const UINT_RE = /^(0|[1-9][0-9]{0,77})$/;
const MODULE_TYPES = ['max_balance', 'supply_limit', 'country_restriction', 'country_whitelist', 'pass_through'];
const CAP_REGISTRY = 64;
const CAP_TOPICS = 16;
const CAP_ISSUERS = 16;
const CAP_CLAIMS = 32;
const CAP_MODULES = 16;
const CAP_COUNTRIES = 300;
const CAP_MAP = 64;
const TOP_KEYS = ['transfer', 'identity_registry', 'required_claim_topics', 'trusted_issuers', 'compliance_modules', 'token_state', 'fund_covenant', 'chain_id', 'network_label'];

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// An explicit null at the top level reads exactly as the absent key.
function dropTopNulls(pp) {
  const out = {};
  for (const k of TOP_KEYS) if (pp[k] !== undefined && pp[k] !== null) out[k] = pp[k];
  return out;
}

function normAddr(v) {
  if (typeof v !== 'string') return null;
  const a = v.toLowerCase();
  return ADDR_RE.test(a) ? a : null;
}

// Non-negative integer from a decimal string or a safe non-negative integer
// number; anything else (fraction, negative, exponent form, NaN) is null so
// the caller refuses rather than coerces.
function toUint(v) {
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v) || v < 0) return null;
    return BigInt(v);
  }
  if (typeof v === 'string' && UINT_RE.test(v)) return BigInt(v);
  return null;
}

function toTopic(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return v;
  return null;
}

function toCountry(v) {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 65535) return v;
  return null;
}

function countryList(v, refuse, label) {
  if (!Array.isArray(v) || v.length > CAP_COUNTRIES) { refuse(label + '_MALFORMED'); return []; }
  const out = [];
  for (const c of v) {
    const n = toCountry(c);
    if (n === null) { refuse(label + '_MALFORMED'); return []; }
    out.push(n);
  }
  return out;
}

// Address-keyed map of uints or booleans; keys normalised to lowercase.
function addrMap(v, kind, refuse, label) {
  const out = {};
  if (v === undefined) return out;
  if (!isObj(v)) { refuse(label + '_MALFORMED'); return out; }
  const keys = Object.keys(v);
  if (keys.length > CAP_MAP) { refuse(label + '_CAP_EXCEEDED'); return out; }
  for (const k of keys) {
    const a = normAddr(k);
    if (a === null) { refuse(label + '_MALFORMED'); return {}; }
    if (kind === 'bool') {
      if (typeof v[k] !== 'boolean') { refuse(label + '_MALFORMED'); return {}; }
      out[a] = v[k];
    } else {
      const n = toUint(v[k]);
      if (n === null) { refuse(label + '_MALFORMED'); return {}; }
      out[a] = n;
    }
  }
  return out;
}

function parseInputs(pp, refuse) {
  const t = pp.transfer;
  let from = null, to = null, amount = null;
  if (!isObj(t) || t.from === undefined || t.to === undefined) {
    refuse('TRANSFER_PARTIES_MISSING');
  } else {
    from = normAddr(t.from);
    to = normAddr(t.to);
    if (from === null || to === null) refuse('ADDRESS_MALFORMED');
    else if (to === ZERO) refuse('RECEIVER_ZERO_ADDRESS');
    amount = toUint(t.amount);
    if (amount === null) refuse('AMOUNT_MALFORMED');
    else if (amount === 0n) refuse('AMOUNT_ZERO');
  }

  // Required claim topics are a required input: absence or null refuses
  // (fail-closed); an explicit empty list is the caller's statement.
  if (pp.required_claim_topics === undefined) refuse('REQUIRED_CLAIM_TOPICS_MISSING');
  const rawTopics = pp.required_claim_topics === undefined ? [] : pp.required_claim_topics;
  const topics = [];
  if (!Array.isArray(rawTopics) || rawTopics.length > CAP_TOPICS) {
    refuse('REQUIRED_TOPICS_MALFORMED');
  } else {
    for (const x of rawTopics) {
      const n = toTopic(x);
      if (n === null) { refuse('REQUIRED_TOPICS_MALFORMED'); break; }
      if (topics.includes(n)) { refuse('DUPLICATE_REQUIRED_TOPIC'); break; }
      topics.push(n);
    }
  }

  const registry = {};
  if (pp.identity_registry === undefined) {
    if (topics.length > 0) refuse('IDENTITY_REGISTRY_MISSING');
  } else if (!Array.isArray(pp.identity_registry) || pp.identity_registry.length > CAP_REGISTRY) {
    refuse('IDENTITY_REGISTRY_MALFORMED');
  } else {
    for (const e of pp.identity_registry) {
      const a = isObj(e) ? normAddr(e.address) : null;
      if (a === null || typeof e.identity_present !== 'boolean') { refuse('IDENTITY_REGISTRY_MALFORMED'); break; }
      if (registry[a]) { refuse('DUPLICATE_REGISTRY_ADDRESS'); break; }
      const country = e.country === undefined ? 0 : toCountry(e.country);
      if (country === null) { refuse('IDENTITY_REGISTRY_MALFORMED'); break; }
      const rawClaims = e.claims === undefined ? [] : e.claims;
      if (!Array.isArray(rawClaims) || rawClaims.length > CAP_CLAIMS) { refuse('IDENTITY_REGISTRY_MALFORMED'); break; }
      const claims = [];
      let bad = false;
      for (const c of rawClaims) {
        const topic = isObj(c) ? toTopic(c.topic) : null;
        const issuer = isObj(c) ? normAddr(c.issuer) : null;
        if (topic === null || issuer === null || typeof c.claim_valid !== 'boolean') { bad = true; break; }
        // One claim slot per (issuer, topic) pair on an identity.
        if (claims.some((x) => x.topic === topic && x.issuer === issuer)) { refuse('DUPLICATE_CLAIM'); bad = true; break; }
        claims.push({ topic, issuer, claim_valid: c.claim_valid });
      }
      if (bad) { refuse('IDENTITY_REGISTRY_MALFORMED'); break; }
      registry[a] = { identity_present: e.identity_present, country, claims };
    }
  }

  // Trusted issuers are a required input: absence or null refuses (fail-closed).
  if (pp.trusted_issuers === undefined) refuse('TRUSTED_ISSUERS_MISSING');
  const trusted = {};
  if (pp.trusted_issuers !== undefined) {
    if (!isObj(pp.trusted_issuers) || Object.keys(pp.trusted_issuers).length > CAP_TOPICS) {
      refuse('TRUSTED_ISSUERS_MALFORMED');
    } else {
      for (const k of Object.keys(pp.trusted_issuers)) {
        const topic = /^(0|[1-9][0-9]{0,15})$/.test(k) ? Number(k) : null;
        const list = pp.trusted_issuers[k];
        if (topic === null || !Array.isArray(list) || list.length > CAP_ISSUERS) { refuse('TRUSTED_ISSUERS_MALFORMED'); break; }
        const addrs = [];
        for (const i of list) {
          const a = normAddr(i);
          if (a === null) { refuse('TRUSTED_ISSUERS_MALFORMED'); break; }
          if (!addrs.includes(a)) addrs.push(a);
        }
        trusted[topic] = addrs;
      }
    }
  }

  const ts = pp.token_state === undefined ? {} : pp.token_state;
  const token = { paused: false, frozen: {}, frozen_tokens: {}, balances: {}, total_supply: null };
  if (!isObj(ts)) {
    refuse('TOKEN_STATE_MALFORMED');
  } else {
    if (ts.paused !== undefined && typeof ts.paused !== 'boolean') refuse('TOKEN_STATE_MALFORMED');
    token.paused = ts.paused === true;
    token.frozen = addrMap(ts.frozen, 'bool', refuse, 'FROZEN');
    token.frozen_tokens = addrMap(ts.frozen_tokens, 'uint', refuse, 'FROZEN_TOKENS');
    token.balances = addrMap(ts.balances, 'uint', refuse, 'BALANCES');
    if (ts.total_supply !== undefined) {
      token.total_supply = toUint(ts.total_supply);
      if (token.total_supply === null) refuse('TOTAL_SUPPLY_MALFORMED');
    }
  }

  const modules = [];
  // Bound compliance modules are a required input: absence or null refuses
  // (fail-closed); an explicit empty list binds zero modules by the caller's
  // own statement.
  if (pp.compliance_modules === undefined) refuse('COMPLIANCE_MODULES_MISSING');
  const rawModules = pp.compliance_modules === undefined ? [] : pp.compliance_modules;
  if (!Array.isArray(rawModules) || rawModules.length > CAP_MODULES) {
    refuse('COMPLIANCE_MODULES_MALFORMED');
  } else {
    for (const m of rawModules) {
      if (!isObj(m) || typeof m.id !== 'string' || m.id.length === 0 || m.id.length > 64) { refuse('COMPLIANCE_MODULES_MALFORMED'); break; }
      if (modules.some((x) => x.id === m.id)) { refuse('DUPLICATE_MODULE_ID'); break; }
      if (!MODULE_TYPES.includes(m.type)) { refuse('UNKNOWN_MODULE_TYPE'); break; }
      const p = m.params === undefined ? {} : m.params;
      if (!isObj(p)) { refuse('MODULE_PARAMS_MALFORMED'); break; }
      const mod = { id: m.id, type: m.type };
      if (m.type === 'max_balance') {
        mod.max_balance = toUint(p.max_balance);
        mod.identity_balance = p.identity_balance === undefined ? undefined : toUint(p.identity_balance);
        if (mod.max_balance === null || mod.identity_balance === null) { refuse('MODULE_PARAMS_MALFORMED'); break; }
      } else if (m.type === 'supply_limit') {
        mod.supply_limit = toUint(p.supply_limit);
        if (mod.supply_limit === null) { refuse('MODULE_PARAMS_MALFORMED'); break; }
      } else if (m.type === 'country_restriction') {
        mod.blocked = countryList(p.blocked_countries, refuse, 'MODULE_PARAMS');
      } else if (m.type === 'country_whitelist') {
        mod.allowed = countryList(p.allowed_countries, refuse, 'MODULE_PARAMS');
      } else {
        if (typeof p.passes !== 'boolean') { refuse('MODULE_PARAMS_MALFORMED'); break; }
        mod.passes = p.passes;
        mod.reason = typeof p.reason === 'string' ? p.reason.slice(0, 200) : null;
      }
      modules.push(mod);
    }
  }

  let covenant = null;
  if (pp.fund_covenant !== undefined) {
    const c = pp.fund_covenant;
    if (!isObj(c)) {
      refuse('FUND_COVENANT_MALFORMED');
    } else {
      covenant = { allow: undefined, max_holders: undefined, holders: undefined, lockup_until: undefined, as_of: undefined };
      if (c.jurisdiction_allowlist !== undefined) covenant.allow = countryList(c.jurisdiction_allowlist, refuse, 'FUND_COVENANT');
      if (c.max_holder_count !== undefined || c.holder_count !== undefined) {
        covenant.max_holders = toUint(c.max_holder_count);
        covenant.holders = toUint(c.holder_count);
        if (covenant.max_holders === null || covenant.holders === null) refuse('FUND_COVENANT_MALFORMED');
      }
      if (c.lockup_until_unix !== undefined || c.as_of_unix !== undefined) {
        covenant.lockup_until = toUint(c.lockup_until_unix);
        covenant.as_of = toUint(c.as_of_unix);
        if (covenant.lockup_until === null || covenant.as_of === null) refuse('FUND_COVENANT_MALFORMED');
      }
    }
  }

  // A mint checked against a supply limit needs the declared supply; never assume 0.
  if (from === ZERO && token.total_supply === null && modules.some((m) => m.type === 'supply_limit')) {
    refuse('TOTAL_SUPPLY_MISSING');
  }

  return { from, to, amount, topics, registry, trusted, token, modules, covenant };
}

function bal(map, a) { return map[a] === undefined ? 0n : map[a]; }

function identityCheck(inp) {
  const entry = inp.registry[inp.to];
  const present = !!(entry && entry.identity_present);
  const report = [];
  const failing = [];
  for (const topic of inp.topics) {
    const issuers = inp.trusted[topic] || [];
    const claims = present ? entry.claims.filter((c) => c.topic === topic && issuers.includes(c.issuer)) : [];
    const found = claims.length > 0;
    const valid = claims.some((c) => c.claim_valid);
    const ok = issuers.length > 0 && valid;
    report.push({ topic, trusted_issuer_count: issuers.length, trusted_claim_found: found, trusted_claim_valid: valid, satisfied: present && ok });
    if (!ok) failing.push(topic);
  }
  const verified = present && failing.length === 0;
  return { identity_present: present, verified, failing_topics: present ? failing : inp.topics.slice(), topics: report };
}

function moduleCheck(m, inp, isMint) {
  const entry = inp.registry[inp.to];
  const country = entry ? entry.country : 0;
  if (m.type === 'max_balance') {
    const held = m.identity_balance !== undefined ? m.identity_balance : bal(inp.token.balances, inp.to);
    const after = held + inp.amount;
    const passes = inp.amount <= m.max_balance && after <= m.max_balance;
    return { id: m.id, type: m.type, passes, detail: 'identity_balance_after ' + after.toString() + (passes ? ' <= ' : ' > ') + 'max_balance ' + m.max_balance.toString() };
  }
  if (m.type === 'supply_limit') {
    if (!isMint) return { id: m.id, type: m.type, passes: true, detail: 'not a mint; supply limit applies to mints only' };
    const after = inp.token.total_supply + inp.amount;
    const passes = after <= m.supply_limit;
    return { id: m.id, type: m.type, passes, detail: 'supply_after_mint ' + after.toString() + (passes ? ' <= ' : ' > ') + 'supply_limit ' + m.supply_limit.toString() };
  }
  if (m.type === 'country_restriction') {
    const passes = !m.blocked.includes(country);
    return { id: m.id, type: m.type, passes, detail: 'receiver_country ' + country + (passes ? ' not in' : ' in') + ' blocked_countries' };
  }
  if (m.type === 'country_whitelist') {
    const passes = m.allowed.includes(country);
    return { id: m.id, type: m.type, passes, detail: 'receiver_country ' + country + (passes ? ' in' : ' not in') + ' allowed_countries' };
  }
  return { id: m.id, type: m.type, passes: m.passes, detail: m.reason === null ? 'caller-declared outcome' : 'caller-declared outcome: ' + m.reason };
}

function covenantCheck(inp, isMint) {
  const c = inp.covenant;
  const failures = [];
  const entry = inp.registry[inp.to];
  const country = entry ? entry.country : 0;
  if (c.allow !== undefined && !c.allow.includes(country)) {
    failures.push('receiver_country ' + country + ' not in jurisdiction_allowlist');
  }
  if (c.max_holders !== undefined && c.max_holders !== null && c.holders !== null) {
    const joins = bal(inp.token.balances, inp.to) === 0n ? 1n : 0n;
    const leaves = !isMint && bal(inp.token.balances, inp.from) === inp.amount ? 1n : 0n;
    const after = c.holders + joins - leaves;
    if (after > c.max_holders) failures.push('holder_count_after ' + after.toString() + ' > max_holder_count ' + c.max_holders.toString());
  }
  if (c.lockup_until !== undefined && c.lockup_until !== null && c.as_of !== null && !isMint && c.as_of < c.lockup_until) {
    failures.push('as_of_unix ' + c.as_of.toString() + ' < lockup_until_unix ' + c.lockup_until.toString());
  }
  return { decision: failures.length === 0 ? 'ALLOWED' : 'DENIED', failures };
}

export function compute(pp) {
  pp = isObj(pp) ? dropTopNulls(pp) : {};
  const refusals = [];
  const refuse = (r) => { if (!refusals.includes(r)) refusals.push(r); };
  const inp = parseInputs(isObj(pp) ? pp : {}, refuse);

  const declared_context = {
    chain_id: pp.chain_id === undefined ? null : String(pp.chain_id).slice(0, 32),
    network_label: pp.network_label === undefined ? null : String(pp.network_label).slice(0, 64),
    caveat: 'Recomputed from caller-declared state only. No chain was read; the node cannot confirm that the declared registry, claims, modules or token state match any deployed contract. Not legal advice and not a determination that a transfer is lawful.',
  };

  const compliance_flags = refusals.length > 0 ? ['INPUT_REFUSED'] : [];
  if (refusals.length > 0) {
    return {
      output_payload: {
        decision: null,
        denied_by: null,
        failing_module: null,
        operation: null,
        gates: [],
        identity_report: null,
        compliance_report: [],
        covenant_decision: null,
        covenant_divergence: null,
        covenant_failures: [],
        refusal_reasons: refusals,
        declared_context,
        errors: compliance_flags.slice(),
      },
      compliance_flags,
    };
  }

  const isMint = inp.from === ZERO;
  const gates = [];
  if (!isMint) {
    gates.push({ gate: 'TOKEN_PAUSED', passes: !inp.token.paused });
    const frozenTo = inp.token.frozen[inp.to] === true;
    const frozenFrom = inp.token.frozen[inp.from] === true;
    gates.push({ gate: 'FROZEN', passes: !frozenTo && !frozenFrom, detail: 'sender_frozen ' + frozenFrom + ', receiver_frozen ' + frozenTo });
    const balance = bal(inp.token.balances, inp.from);
    const locked = bal(inp.token.frozen_tokens, inp.from);
    const unfrozen = balance >= locked ? balance - locked : 0n;
    gates.push({ gate: 'INSUFFICIENT_UNFROZEN_BALANCE', passes: inp.amount <= unfrozen, detail: 'amount ' + inp.amount.toString() + ', unfrozen_balance ' + unfrozen.toString() });
  }
  const identity = identityCheck(inp);
  gates.push({ gate: 'IDENTITY_NOT_VERIFIED', passes: identity.verified, detail: identity.identity_present ? 'failing_topics [' + identity.failing_topics.join(',') + ']' : 'no identity for receiver' });
  const report = inp.modules.map((m) => moduleCheck(m, inp, isMint));
  const firstFail = report.find((r) => r.passes !== true);
  gates.push({ gate: 'COMPLIANCE_MODULE', passes: firstFail === undefined, detail: firstFail === undefined ? 'all ' + report.length + ' modules pass' : 'first failing module ' + firstFail.id });

  const failedGate = gates.find((g) => !g.passes);
  const decision = failedGate === undefined ? 'ALLOWED' : 'DENIED';
  let denied_by = null;
  let failing_module = null;
  if (failedGate) {
    if (failedGate.gate === 'COMPLIANCE_MODULE') {
      failing_module = firstFail.id;
      denied_by = 'COMPLIANCE_MODULE:' + firstFail.id;
    } else {
      denied_by = failedGate.gate;
    }
  }

  let covenant_decision = null;
  let covenant_divergence = 'NOT_DECLARED';
  let covenant_failures = [];
  if (inp.covenant !== null) {
    const cv = covenantCheck(inp, isMint);
    covenant_decision = cv.decision;
    covenant_failures = cv.failures;
    if (decision === cv.decision) covenant_divergence = 'NONE';
    else covenant_divergence = decision === 'ALLOWED' ? 'token_allows_covenant_denies' : 'token_denies_covenant_allows';
  }

  return {
    output_payload: {
      decision,
      denied_by,
      failing_module,
      operation: isMint ? 'mint' : 'transfer',
      gates,
      identity_report: identity,
      compliance_report: report,
      covenant_decision,
      covenant_divergence,
      covenant_failures,
      refusal_reasons: [],
      declared_context,
      errors: compliance_flags.slice(),
    },
    compliance_flags,
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
