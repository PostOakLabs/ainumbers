import { executionHash } from './_hash.mjs';

// 844-workload-identity-claims: lints DECODED claims of a workload-identity token and of an
// exchanged token against a caller-declared policy. Values only. No signature is verified,
// no identity provider is contacted, and any compact-JWS-shaped or signature-bearing input
// is refused. compute() is a pure function of pp (no clock, no network, no TextEncoder).

const TOOL_ID = '844-workload-identity-claims';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_workload_identity_token_claims',
  mandate_type: 'compliance_control', gpu: false,
};

const CLAIM_KEYS = ['sub', 'aud', 'exp', 'iat', 'nbf', 'scope', 'act', 'may_act', 'resource'];
// Per-claim value typing: exp/iat/nbf are integer epoch seconds (NumericDate), aud/scope/resource
// are a string or a list of strings, sub is a string, act/may_act are actor objects whose sub is
// a required string. Any other value shape is refused with a named code before the lint runs,
// so string dates, negative epochs, numeric scope or resource entries, and may_act values that
// are not one well-formed actor object can never reach a WITHIN_POLICY verdict.
const NUMERIC_DATE_KEYS = ['exp', 'iat', 'nbf'];
const STRING_LIST_KEYS = ['aud', 'scope', 'resource'];
const SIG_KEY = /sig|header|jws|jwt|token|proof|secret|key/i;
const JWS_HEAD = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
const JWS_ANY = /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]*$/;
const TRUST_DOMAIN = /^[a-z0-9._-]+$/;
const PATH_SEG = /^[A-Za-z0-9._-]+$/;
const SCOPE_TOKEN = /^[\x21\x23-\x5b\x5d-\x7e]+$/;
const MAX_STRING = 256;
const MAX_ITEMS = 64;
const MAX_ACT_WALK = 32;

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isInt(v) { return typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 9007199254740991; }

function refuseString(s, out) {
  if (s.length > MAX_STRING) out.push('FREE_TEXT_REFUSED');
  if (s.indexOf('@') >= 0) out.push('IDENTITY_TEXT_REFUSED');
  const parts = s.split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    if (JWS_HEAD.test(parts[i]) || JWS_ANY.test(parts[i])) { out.push('COMPACT_JWS_REFUSED'); break; }
  }
}

function scanClaims(c, label, out, depth) {
  if (!isObj(c)) { out.push('CLAIMS_NOT_OBJECT'); return; }
  const keys = Object.keys(c);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (SIG_KEY.test(k)) { out.push('SIGNATURE_MATERIAL_REFUSED'); continue; }
    if (CLAIM_KEYS.indexOf(k) < 0) { out.push('UNKNOWN_CLAIM_REFUSED'); continue; }
    const v = c[k];
    if (k === 'act' || k === 'may_act') {
      if (depth > MAX_ACT_WALK) out.push('ACT_NESTING_REFUSED');
      else if (isObj(v)) {
        const ak = Object.keys(v);
        for (let j = 0; j < ak.length; j++) {
          if (SIG_KEY.test(ak[j])) out.push('SIGNATURE_MATERIAL_REFUSED');
          else if (ak[j] !== 'sub' && !(k === 'act' && ak[j] === 'act')) out.push('UNKNOWN_CLAIM_REFUSED');
        }
        if (typeof v.sub !== 'string') out.push('CLAIM_TYPE_REFUSED');
        else refuseString(v.sub, out);
        if (k === 'act' && v.act !== undefined) scanClaims({ act: v.act }, label, out, depth + 1);
      } else out.push('CLAIM_TYPE_REFUSED');
    } else if (NUMERIC_DATE_KEYS.indexOf(k) >= 0) {
      if (!isInt(v)) out.push('CLAIM_TYPE_REFUSED');
      else if (v < 0) out.push('NUMERIC_DATE_OUT_OF_RANGE');
    } else if (STRING_LIST_KEYS.indexOf(k) >= 0) {
      if (typeof v === 'string') refuseString(v, out);
      else if (Array.isArray(v)) {
        if (v.length > MAX_ITEMS) out.push('TOO_MANY_ITEMS_REFUSED');
        for (let j = 0; j < v.length && j < MAX_ITEMS; j++) {
          if (typeof v[j] === 'string') refuseString(v[j], out); else out.push('CLAIM_TYPE_REFUSED');
        }
      } else out.push('CLAIM_TYPE_REFUSED');
    } else if (k === 'sub') {
      if (typeof v !== 'string') out.push('CLAIM_TYPE_REFUSED');
      else refuseString(v, out);
    }
  }
}

function parseSpiffe(id) {
  if (typeof id !== 'string' || id.indexOf('spiffe://') !== 0) return null;
  const rest = id.slice(9);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const td = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  if (!TRUST_DOMAIN.test(td)) return null;
  if (path.length === 0) return null;
  const segs = path.split('/');
  for (let i = 0; i < segs.length; i++) {
    if (!PATH_SEG.test(segs[i]) || segs[i] === '.' || segs[i] === '..') return null;
  }
  return td;
}

function toList(v) {
  if (v === undefined || v === null) return null;
  return Array.isArray(v) ? v.slice() : [v];
}

function scopeSet(v) {
  if (typeof v === 'string') {
    const parts = v.split(' ');
    for (let i = 0; i < parts.length; i++) if (!SCOPE_TOKEN.test(parts[i])) return undefined;
    return parts;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) if (!SCOPE_TOKEN.test(v[i])) return undefined;
    return v.slice();
  }
  return null;
}

function actorChain(act) {
  const subs = [];
  let node = act;
  let bad = false;
  while (node !== undefined && node !== null && subs.length <= MAX_ACT_WALK) {
    if (!isObj(node) || parseSpiffe(node.sub) === null) { bad = true; subs.push(null); } else subs.push(node.sub);
    node = isObj(node) ? node.act : undefined;
  }
  return { depth: subs.length, subs, bad };
}

function lintToken(c, p, label, out, indet) {
  const out_ = (code) => out.push(label + ':' + code);
  const ind_ = (code) => indet.push(label + ':' + code);
  const td = c.sub === undefined ? undefined : parseSpiffe(c.sub);
  if (c.sub === undefined) ind_('SUB_ABSENT');
  else if (td === null) out_('SUB_NOT_SPIFFE_ID');
  else if (p.allowed_trust_domains.indexOf(td) < 0) out_('TRUST_DOMAIN_NOT_ALLOWED');

  const aud = toList(c.aud);
  if (aud === null || aud.length === 0) ind_('AUD_ABSENT');
  else if (label === 'subject') {
    for (let i = 0; i < p.required_audiences.length; i++) {
      if (aud.indexOf(p.required_audiences[i]) < 0) { out_('REQUIRED_AUDIENCE_MISSING'); break; }
    }
  }

  if (c.exp === undefined) ind_('EXP_ABSENT');
  if (c.iat === undefined) ind_('IAT_ABSENT');
  if (c.exp !== undefined) {
    if (c.exp <= p.clock_now_epoch_seconds) out_('EXPIRED_AT_CLOCK');
    if (c.iat !== undefined) {
      const life = c.exp - c.iat;
      if (life < 0) out_('EXP_BEFORE_IAT');
      else if (life > p.max_lifetime_seconds) out_('LIFETIME_EXCEEDS_POLICY');
    }
  }
  if (c.iat !== undefined && c.iat > p.clock_now_epoch_seconds) out_('IAT_IN_FUTURE');
  if (c.nbf !== undefined) {
    if (c.nbf > p.clock_now_epoch_seconds) out_('NBF_IN_FUTURE');
    if (c.exp !== undefined && c.nbf > c.exp) out_('NBF_AFTER_EXP');
  }

  // A present scope is judged by the same scope-token vocabulary whether or not an exchange
  // accompanies the request: present-but-malformed (an empty token in the list, a bad
  // character) is SCOPE_MALFORMED here for this token, and absent stays indeterminate in the
  // exchange narrowing check below. Consistency rule: the same code both request shapes.
  if (p.scope_must_narrow && c.scope !== undefined && scopeSet(c.scope) === undefined) out_('SCOPE_MALFORMED');

  if (c.act !== undefined) {
    const ch = actorChain(c.act);
    if (ch.depth > p.max_actor_depth) out_('ACTOR_CHAIN_TOO_DEEP');
    if (ch.bad) out_('ACTOR_NOT_SPIFFE_ID');
  }
}

export function compute(pp) {
  pp = pp || {};
  const refusals = [];
  const policy = pp.policy;
  if (!isObj(policy)) refusals.push('POLICY_INCOMPLETE');
  else {
    const okList = (l) => Array.isArray(l) && l.length > 0 && l.length <= MAX_ITEMS && l.every((x) => typeof x === 'string' && x.length <= MAX_STRING);
    if (!isInt(policy.max_lifetime_seconds) || policy.max_lifetime_seconds <= 0) refusals.push('POLICY_INCOMPLETE');
    else if (!isInt(policy.max_actor_depth) || policy.max_actor_depth < 0) refusals.push('POLICY_INCOMPLETE');
    else if (!okList(policy.required_audiences) || !okList(policy.allowed_trust_domains)) refusals.push('POLICY_INCOMPLETE');
    else if (typeof policy.scope_must_narrow !== 'boolean') refusals.push('POLICY_INCOMPLETE');
    else if (!isInt(policy.clock_now_epoch_seconds)) refusals.push('POLICY_INCOMPLETE');
  }
  scanClaims(pp.subject_claims, 'subject', refusals, 0);
  const hasExchange = pp.exchanged_claims !== undefined && pp.exchanged_claims !== null;
  if (hasExchange) scanClaims(pp.exchanged_claims, 'exchanged', refusals, 0);
  const seen = [];
  for (let i = 0; i < refusals.length; i++) if (seen.indexOf(refusals[i]) < 0) seen.push(refusals[i]);
  const code = seen.length > 0;

  if (code) {
    const compliance_flags = code ? ['INPUT_REFUSED'] : [];
    return {
      output_payload: {
        verdict: 'INPUT_REFUSED', refusal_codes: seen.slice().sort(), outside_findings: [], indeterminate_findings: [],
        signature_verified: false, warnings: compliance_flags.slice(),
      },
      compliance_flags,
    };
  }

  const out = [];
  const indet = [];
  const s = pp.subject_claims;
  lintToken(s, policy, 'subject', out, indet);
  if (hasExchange) {
    const x = pp.exchanged_claims;
    lintToken(x, policy, 'exchanged', out, indet);

    const xa = toList(x.aud);
    const sa = toList(s.aud);
    if (xa !== null && xa.length > 0) {
      let wider = false;
      for (let i = 0; i < xa.length; i++) if (policy.required_audiences.indexOf(xa[i]) < 0) wider = true;
      if (wider) out.push('exchanged:AUDIENCE_OUTSIDE_POLICY');
      if (sa !== null && xa.length > sa.length) out.push('exchanged:AUDIENCE_WIDER_THAN_SUBJECT');
    }
    const xr = toList(x.resource);
    const sr = toList(s.resource);
    // An exchanged resource is checked against the subject resource set whether or not the
    // subject carries one: with no subject resource every exchanged resource is wider, so the
    // exchange can never gain a resource the subject never had.
    if (xr !== null) {
      const srList = sr === null ? [] : sr;
      for (let i = 0; i < xr.length; i++) if (srList.indexOf(xr[i]) < 0) { out.push('exchanged:RESOURCE_WIDER_THAN_SUBJECT'); break; }
    }

    if (policy.scope_must_narrow) {
      const ss = scopeSet(s.scope);
      const xs = scopeSet(x.scope);
      // Malformed scopes were already flagged per token in lintToken; absent stays indeterminate.
      if (ss === null || xs === null) indet.push('exchanged:SCOPE_ABSENT');
      else if (ss !== undefined && xs !== undefined) {
        for (let i = 0; i < xs.length; i++) if (ss.indexOf(xs[i]) < 0) { out.push('exchanged:SCOPE_WIDENED'); break; }
      }
    }

    // scanClaims guarantees a present may_act is one well-formed actor object with a string
    // sub, and a present act is the same, so the consistency check is a direct comparison.
    if (s.may_act !== undefined && x.act !== undefined) {
      if (x.act.sub !== s.may_act.sub) out.push('exchanged:MAY_ACT_MISMATCH');
    }
  }

  const verdict = out.length > 0 ? 'OUTSIDE_POLICY' : (indet.length > 0 ? 'INDETERMINATE' : 'WITHIN_POLICY');
  const compliance_flags = [];
  if (verdict === 'OUTSIDE_POLICY') compliance_flags.push('OUTSIDE_POLICY');
  if (verdict === 'INDETERMINATE') compliance_flags.push('INDETERMINATE');
  const warnings = compliance_flags.slice();
  return {
    output_payload: {
      verdict,
      refusal_codes: [],
      outside_findings: out.slice().sort(),
      indeterminate_findings: indet.slice().sort(),
      exchange_checked: hasExchange,
      signature_verified: false,
      warnings,
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
