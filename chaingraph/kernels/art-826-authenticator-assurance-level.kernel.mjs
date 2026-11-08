import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-826-authenticator-assurance-level';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_authn_assurance_level',
  mandate_type: 'compliance_control', gpu: false,
};

// Authentication assurance-level evaluator — the authentication counterpart to the
// art-523 identity-proofing evaluator, on the same art-444 policy-input pattern.
// Rates a DECLARED authenticator set + session policy against a caller-supplied,
// versioned assurance framework -- NIST SP 800-63B AAL1-3, eIDAS LoA
// low/substantial/high, or any other framework are all the SAME input shape:
// framework.levels[] ordered lowest-to-highest, each level carrying criteria in a
// shared generic vocabulary (min_factors = distinct factor categories across the
// declared set, required_factor_kinds,
// phishing_resistant_required, verifier_impersonation_resistant_required,
// hardware_bound_required, dynamic_authentication_required,
// max_reauth_interval_minutes, max_idle_minutes, restricted_authenticator_kinds).
// The kernel never interprets a framework it was not given: every threshold,
// required kind and restriction comes from the pp.framework the caller declares,
// never from a table inside this source. Authenticator `kind` values come from the
// closed node-contract enum (the vocabulary the node itself owns); factor_kinds are
// the caller's own category vocabulary and are only ever tested for set membership.
//
// Undecidable vs shortfall, never conflated (mirrors art-523): a criterion whose
// declared value is malformed (e.g. min_factors is not a finite non-negative number,
// required_factor_kinds is not an array) is UNDECIDABLE -- the definition cannot
// express what it is asking for (AAL_DEFINITION_INSUFFICIENT). Declared data that
// fails a WELL-FORMED criterion (too few factors, no phishing-resistant
// authenticator, session reauthentication longer than the level allows) is a
// shortfall -- reported per criterion as {criterion, required, found}. A missing
// session value is also a shortfall (found: null), because the criterion is
// expressible and the declaration simply does not demonstrate it.
//
// Honest posture: this evidences that a DECLARED authenticator set was measured
// against a DECLARED policy. It does NOT assert anyone controls any authenticator,
// does not verify possession or biometrics, and carries no user identifiers -- the
// inputs are kinds, boolean capabilities and minute intervals, nothing else.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random, no
// TextEncoder/atob/btoa/URL (QuickJS-ng zkVM guest subset).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function str(v, def) { return (typeof v === 'string' && v) ? v : def; }
function arr(v) { return Array.isArray(v) ? v : []; }

// The closed authenticator-kind enum owned by this node's contract. Restricted-kind
// criteria and kind validation operate on these strings only.
const AUTHENTICATOR_KINDS = [
  'password', 'otp_device', 'otp_sms', 'crypto_software', 'crypto_hardware',
  'passkey_synced', 'passkey_device_bound', 'biometric_local',
];

// Capability criteria: framework key -> (authenticator field, flag fired when missing).
const CAPABILITY_CRITERIA = [
  ['phishing_resistant_required', 'phishing_resistant', 'AAL_PHISHING_RESISTANCE_MISSING'],
  ['verifier_impersonation_resistant_required', 'verifier_impersonation_resistant', 'AAL_VERIFIER_IMPERSONATION_UNRESISTANT'],
  ['hardware_bound_required', 'hardware_bound', 'AAL_HARDWARE_BINDING_MISSING'],
  ['dynamic_authentication_required', 'dynamic', 'AAL_DYNAMIC_AUTHENTICATION_MISSING'],
];

function findLevelIndex(levels, levelId) {
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] && levels[i].level_id === levelId) return i;
  }
  return -1;
}

function numericCriterion(level, key) {
  if (level[key] === undefined || level[key] === null) return { present: false };
  const n = Number(level[key]);
  if (!Number.isFinite(n) || n < 0) return { present: true, ok: false };
  return { present: true, ok: true, required: n };
}

function arrayCriterion(level, key) {
  if (level[key] === undefined || level[key] === null) return { present: false };
  if (!Array.isArray(level[key])) return { present: true, ok: false };
  return { present: true, ok: true, required: level[key].filter((k) => typeof k === 'string' && k) };
}

function boolCriterion(level, key) {
  if (level[key] === undefined || level[key] === null) return { present: false };
  if (typeof level[key] !== 'boolean') return { present: true, ok: false };
  return { present: true, ok: true, required: level[key] };
}

// Distinct factor categories across the whole declared set, in the caller's own
// vocabulary. Non-string factor_kinds entries contribute nothing.
function declaredFactorKinds(authenticators) {
  const set = new Set();
  for (const a of authenticators) {
    for (const k of arr(a.factor_kinds)) if (typeof k === 'string' && k) set.add(k);
  }
  return set;
}

function criteriaCount(level) {
  let n = 0;
  for (const k of ['min_factors', 'required_factor_kinds', 'max_reauth_interval_minutes', 'max_idle_minutes', 'restricted_authenticator_kinds']) {
    if (level[k] !== undefined && level[k] !== null) n++;
  }
  for (const [key] of CAPABILITY_CRITERIA) if (boolCriterion(level, key).present) n++;
  return n;
}

// Evaluate one level's criteria against the declared authenticator set + session.
// Returns { criteria_evaluated, unmet: [{criterion, required, found}],
//           undecidable: [{criterion, reason}], flags: [] }.
// unmet carries ONLY criteria the declared data actually fails.
function evalLevel(level, authenticators, session, factorKinds) {
  const unmet = [];
  const undecidable = [];
  const flags = [];

  // -- min_factors: distinct factor categories across the declared set (a
  //    multi-factor unit carries several categories and counts for each) --
  const mf = numericCriterion(level, 'min_factors');
  if (mf.present) {
    if (!mf.ok) undecidable.push({ criterion: 'min_factors', reason: 'min_factors is not a finite non-negative number -- the definition cannot express the factor floor it is asking for' });
    else if (factorKinds.size < mf.required) {
      flags.push('AAL_FACTOR_COUNT_SHORT');
      unmet.push({ criterion: 'min_factors', required: mf.required, found: factorKinds.size });
    }
  }

  // -- required_factor_kinds: union coverage across the set --
  const rfk = arrayCriterion(level, 'required_factor_kinds');
  if (rfk.present) {
    if (!rfk.ok) undecidable.push({ criterion: 'required_factor_kinds', reason: 'required_factor_kinds is not an array of strings -- the definition cannot express which factor categories it is asking for' });
    else {
      for (const k of rfk.required) {
        if (!factorKinds.has(k)) {
          unmet.push({ criterion: 'required_factor_kinds', required: k, found: null });
        }
      }
      if (rfk.required.some((k) => !factorKinds.has(k))) flags.push('AAL_FACTOR_COUNT_SHORT');
    }
  }

  // -- capability booleans: satisfied iff at least one declared authenticator carries it --
  for (const [key, field, flag] of CAPABILITY_CRITERIA) {
    const c = boolCriterion(level, key);
    if (!c.present) continue;
    if (!c.ok) { undecidable.push({ criterion: key, reason: `${key} is present but not a boolean -- the definition cannot express whether it requires the capability` }); continue; }
    if (!c.required) continue; // a false requirement is met vacuously
    const found = authenticators.some((a) => a[field] === true);
    if (!found) {
      flags.push(flag);
      unmet.push({ criterion: key, required: true, found: false });
    }
  }

  // -- session intervals (a missing session value is a shortfall: found null) --
  const s = session && typeof session === 'object' ? session : {};
  const mr = numericCriterion(level, 'max_reauth_interval_minutes');
  if (mr.present) {
    if (!mr.ok) undecidable.push({ criterion: 'max_reauth_interval_minutes', reason: 'max_reauth_interval_minutes is not a finite non-negative number -- the definition cannot express the interval ceiling it is asking for' });
    else {
      const raw = s.reauth_interval_minutes;
      const found = raw === undefined || raw === null ? null : safeNum(raw, null);
      if (found === null || found > mr.required) {
        flags.push('AAL_REAUTH_INTERVAL_EXCEEDED');
        unmet.push({ criterion: 'max_reauth_interval_minutes', required: mr.required, found });
      }
    }
  }
  const mi = numericCriterion(level, 'max_idle_minutes');
  if (mi.present) {
    if (!mi.ok) undecidable.push({ criterion: 'max_idle_minutes', reason: 'max_idle_minutes is not a finite non-negative number -- the definition cannot express the idle ceiling it is asking for' });
    else {
      const raw = s.idle_timeout_minutes;
      const found = raw === undefined || raw === null ? null : safeNum(raw, null);
      if (found === null || found > mi.required) {
        flags.push('AAL_IDLE_TIMEOUT_EXCEEDED');
        unmet.push({ criterion: 'max_idle_minutes', required: mi.required, found });
      }
    }
  }

  // -- restricted authenticator kinds (framework restriction + per-item declaration) --
  const rk = arrayCriterion(level, 'restricted_authenticator_kinds');
  if (rk.present && !rk.ok) {
    undecidable.push({ criterion: 'restricted_authenticator_kinds', reason: 'restricted_authenticator_kinds is not an array of strings -- the definition cannot express which kinds it restricts' });
  } else {
    const banned = rk.present ? new Set(rk.required) : new Set();
    const restrictedUsed = [];
    for (const a of authenticators) {
      const kind = str(a.kind, null);
      if ((kind && banned.has(kind)) || a.restricted === true) restrictedUsed.push(kind || 'unknown');
    }
    if (restrictedUsed.length > 0) {
      flags.push('AAL_RESTRICTED_AUTHENTICATOR_USED');
      unmet.push({ criterion: 'restricted_authenticator_kinds', required: rk.present ? rk.required : [], found: restrictedUsed });
    }
  }

  return { criteria_evaluated: criteriaCount(level), unmet, undecidable, flags };
}

export function compute(pp) {
  pp = pp || {};

  const framework = pp.framework && typeof pp.framework === 'object' ? pp.framework : {};
  const frameworkId = str(framework.id, null);
  const frameworkVersion = str(framework.version, null);
  const levels = arr(framework.levels);
  const authenticators = arr(pp.authenticators).filter((a) => a && typeof a === 'object');
  const session = pp.session && typeof pp.session === 'object' ? pp.session : null;
  const targetLevel = str(pp.target_level, null);

  const compliance_flags = [];

  // Node-contract input validation (closed kind enum, not a framework interpretation):
  // every declared authenticator must carry a kind from the node's own enum.
  const unknownKinds = authenticators.filter((a) => {
    const kind = str(a.kind, null);
    return !kind || !AUTHENTICATOR_KINDS.includes(kind);
  }).map((a) => str(a.kind, null));

  const targetIdx = targetLevel ? findLevelIndex(levels, targetLevel) : -1;
  const definitionUsable = frameworkId !== null && frameworkVersion !== null && levels.length > 0 && targetIdx >= 0 && unknownKinds.length === 0;

  let achievedLevel = null;
  let targetMet = false;
  let unmet = [];
  let undecidable = [];
  let criteriaEvaluated = 0;
  let flags = [];

  if (definitionUsable) {
    const factorKinds = declaredFactorKinds(authenticators);
    const targetResult = evalLevel(levels[targetIdx], authenticators, session, factorKinds);
    unmet = targetResult.unmet;
    undecidable = targetResult.undecidable;
    criteriaEvaluated = targetResult.criteria_evaluated;
    flags = targetResult.flags;

    const decidableAtTarget = criteriaEvaluated - undecidable.length;
    targetMet = decidableAtTarget > 0 && unmet.length === 0;
    if (criteriaEvaluated === 0) targetMet = true; // vacuous: level declares no criteria

    if (targetMet) {
      achievedLevel = targetLevel;
    } else {
      // Walk down from the level below target to find the highest fully-met level.
      for (let i = targetIdx - 1; i >= 0; i--) {
        const r = evalLevel(levels[i], authenticators, session, factorKinds);
        const decidable = r.criteria_evaluated - r.undecidable.length;
        const passes = r.criteria_evaluated === 0 || (decidable > 0 && r.unmet.length === 0);
        if (passes) { achievedLevel = levels[i].level_id; break; }
      }
    }
  }

  if (!definitionUsable || undecidable.length > 0) compliance_flags.push('AAL_DEFINITION_INSUFFICIENT');
  if (authenticators.length === 0) compliance_flags.push('AAL_AUTHENTICATOR_UNDECLARED');
  if (definitionUsable) {
    if (targetMet) compliance_flags.push('AAL_MET');
    else if (unmet.length > 0) compliance_flags.push('AAL_SHORTFALL');
    for (const f of flags) compliance_flags.push(f);
  }

  const output_payload = {
    framework_ref: { id: frameworkId, version: frameworkVersion },
    target_level: targetLevel,
    target_level_found: definitionUsable,
    levels_defined: levels.length,
    authenticator_count: authenticators.length,
    session_declared: session !== null,
    criteria_evaluated: criteriaEvaluated,
    achieved_level: achievedLevel,
    meets_target: targetMet,
    unmet_criteria: unmet,
    undecidable_count: undecidable.length,
    undecidable,
    // Flag-mirror doctrine: warnings is truthy exactly when compliance_flags is non-empty.
    warnings: compliance_flags.slice(),
    note: 'Rates a DECLARED authenticator set and session policy against a caller-supplied, versioned assurance framework -- never a hardcoded one. Every threshold, required factor category and restriction comes from the framework the caller declares; the kernel never interprets a framework it was not given. A criterion the definition cannot express (malformed criterion value) is reported as AAL_DEFINITION_INSUFFICIENT, distinct from AAL_SHORTFALL (declared data failing a well-formed criterion, reported per criterion as {criterion, required, found}) -- the two are never conflated. When the target level is not met, achieved_level falls back to the highest fully-met level below it. Measures declared capabilities only: it does not assert anyone controls any authenticator, and carries no user identifiers.',
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
