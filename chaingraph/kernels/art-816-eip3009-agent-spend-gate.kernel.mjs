import { executionHash } from './_hash.mjs';

// art-816-eip3009-agent-spend-gate: a pre-sign gate for ONE EIP-3009 authorization against a
// caller-declared spend policy and a caller-pasted authorization ledger. Returns SPEND, DENY,
// OVER_LIMIT or INDETERMINATE with per-rule reason codes.
//
// THE FIXED THIRTEEN-RULE ORDER (every failing rule listed; the first failing rule is the
// primary reason; DENY outranks OVER_LIMIT in the decision, both reason lists are returned):
//   DENY class
//   1  AUTH_FORMAT            an authorization field is not an address / uint256 decimal
//                             string, or `from` is the zero address (nonce shape is rule 4)
//   2  SIGNER_MISMATCH        authorization.from differs from policy.agent_address
//   3  DOMAIN_NOT_ALLOWED     domain chain not in allowed_chain_ids, or domain token not in
//                             allowed_tokens (an absent list leaves that half NOT_EVALUATED)
//   4  NONCE_ZERO             nonce is zero or not 32 bytes
//   5  NONCE_REUSED           same (from, token, chain, nonce) already in the pasted ledger,
//                             any status; sub_code NONCE_REUSED_IDENTICAL when every
//                             authorization field equals the ledger entry, else
//                             NONCE_REUSED_FIELDS_DIFFER. A missing domain.verifying_contract
//                             or domain.chain_id leaves this rule NOT_EVALUATED, and SPEND
//                             requires rule 5 evaluated: that case is INDETERMINATE
//   6 WINDOW_INVALID / NOT_YET_VALID / EXPIRED   strict open interval on the caller clock
//   7  WINDOW_TOO_LONG / START_TOO_FAR            declared ceiling checks
//   8  PAYEE_DENIED / PAYEE_NOT_ALLOWED           denylist hit; or absent from a DECLARED
//                                                 allowlist (an absent allowlist is
//                                                 NOT_EVALUATED, never allow-all)
//   9  VARIANT_REQUIRED_RECEIVE                   contract payee declared with the transfer
//                                                 variant
//   OVER_LIMIT class
//   10 OVER_PER_TX_CAP        value greater than the declared per-transaction cap
//   11 OVER_WINDOW_CAP        ledger sum in a declared window plus this value exceeds the cap
//   12 OVER_VELOCITY          ledger count in a declared velocity window plus one exceeds the
//                             declared maximum count
//   13 DUPLICATE_INTENT       fresh nonce, same economics inside a declared duplicate window,
//                             flagged DUPLICATE_INTENT_SUSPECTED; the window absent means the
//                             rule is NOT_EVALUATED
//
// COUNTING SEMANTICS (ruled): for the window caps and the velocity rule, an entry with
// status `settled` counts when it was signed inside the declared window, and an entry with
// status `signed` that is not yet expired counts regardless of age (a signed authorization
// stays live money until validBefore or cancel, so it is exposure in every window).
// `canceled` entries and expired unsettled entries never count in rules 11, 12 and 13; rule
// 5 matches any status. Rule 13 keeps its declared duplicate window for every entry class
// (the ruling's regardless-of-age clause is cited for rules 11 and 12 only) and never
// re-matches an entry already matched by rule 5 (it evaluates only entries with a different
// nonce).
//
// CARRIED, NOT BRANCHED (open with the desk): `authorization_intent_ref`, ledger `intent_ref`
// and `duplicate_requires_distinct_intent_ref` are validated and echoed; the intent-ref branch
// table of the duplicate rule is an open item in the build spec (section 14 item 1 needs a
// desk word), so this kernel implements only the ruled base case and the ruled
// window-absent NOT_EVALUATED outcome. No default was invented.
//
// DETERMINISM: compute() is a PURE function of pp. No clock, no network, no filesystem, no
// TextEncoder/atob/URL in compute (the QuickJS guest lacks them), no Date, no float, no
// BigInt. uint256 values are decimal strings throughout, compared and summed by the pure
// string-integer helpers below. Timestamps are integer epoch seconds in Number space.
//
// FIXED INPUT BOUNDS (the kernel envelope): ledger at most 256 entries; every policy list at
// most 64 entries; allowed chain/token sets, window caps and velocity rules at most 16
// entries; unknown-key scans walk at most 64 keys per object. A declared input that exceeds a
// bound or carries a malformed policy/ledger/domain shape is refused INPUT_REFUSED rather
// than guessed at; every threshold is a caller input and there are no defaults.
//
// This kernel performs no digest recomputation, no signature recovery and no chain reads:
// those belong to the sibling digest, signer and domain/nonce/window nodes. It hashes nothing
// inside compute(); the artifact execution_hash is computed by the shared _hash.mjs outside
// compute() (buildArtifact), the only permitted path.

const TOOL_ID = 'art-816-eip3009-agent-spend-gate';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'decide_eip3009_agent_spend',
  mandate_type: 'compliance_control', gpu: false,
};

// ---- fixed bounds (kernel envelope; see header) ----
const LEDGER_MAX = 256;
const LIST_MAX = 64;
const SETS_MAX = 16;
const KEY_SCAN_MAX = 64;
const TEXT_MAX = 128;

const U256_MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_NONCE = '0x0000000000000000000000000000000000000000000000000000000000000000';

const STATUSES = ['signed', 'settled', 'canceled'];
const VARIANTS = ['transfer', 'receive'];

const AUTH_KEYS = ['variant', 'from', 'to', 'value', 'validAfter', 'validBefore', 'nonce', 'authorization_intent_ref'];
const DOMAIN_KEYS = ['name', 'version', 'chain_id', 'verifying_contract'];
const POLICY_KEYS = [
  'agent_address', 'allowed_chain_ids', 'allowed_tokens', 'payee_allowlist', 'payee_denylist',
  'per_tx_cap', 'window_caps', 'velocity', 'max_validity_seconds', 'max_future_start_seconds',
  'duplicate_window_seconds', 'duplicate_requires_distinct_intent_ref', 'require_receive_for',
];
const LEDGER_KEYS = ['from', 'token', 'chain_id', 'nonce', 'to', 'value', 'validBefore', 'signed_at', 'intent_ref', 'status'];
const TOP_KEYS = ['authorization', 'domain', 'policy', 'ledger', 'now_unix'];

const SCOPE_NOTE = 'Decides SPEND, DENY, OVER_LIMIT or INDETERMINATE for one EIP-3009 authorization against a declared spend policy and a pasted authorization ledger, from declared inputs only. SPEND means within the declared policy, not an authorization to move funds and not proof funds moved; the nonce check runs against the pasted ledger only, and only the token contract enforces nonce uniqueness on chain. ERC-3009 is a Draft. No digest recomputation, no signature recovery, no chain reads, no network calls.';

const CLAUSE = {
  r1: 'zero address line 544 of the draft text; payload field shapes per the x402 exact scheme and v2 spec; field formats are policy-only',
  r2: 'policy-only; offline digest and signer proof stays with the sibling digest and signer nodes',
  r3: 'domain binding rationale lines 312-316 of the draft text; network error analogue in the v2 spec; membership policy-only',
  r4: 'nonce definition line 72 and bytes32 payload shape of the exact scheme',
  r5: 'nonce state model lines 412, 440, 458 and cancel interface lines 138-160 of the draft text; any-status ledger match ruled',
  r6: 'strict open interval lines 437-438 of the draft text; facilitator window error codes in the v2 spec',
  r7: 'window rationale lines 307-311 of the draft text; both ceilings are policy-only',
  r8: 'payee field identity in the exact scheme and v2 spec; membership policy-only; absent allowlist ruled NOT_EVALUATED',
  r9: 'receive variant caller-equals-payee requirement lines 110-122 and front-running note line 540 of the draft text',
  r10: 'policy-only; atomic-unit string amount shape per the exact scheme',
  r11: 'expiry boundary meaning of validBefore lines 437-438 of the draft text; counting semantics ruled',
  r12: 'policy-only; counting semantics ruled',
  r13: 'random-nonce rationale lines 296-305 of the draft text; classification and window-absent outcome ruled',
};

// ---- decimal-string uint256 arithmetic (no BigInt anywhere) ----

function stripZeros(s) {
  let i = 0;
  while (i < s.length - 1 && s.charCodeAt(i) === 48) i++;
  return s.slice(i);
}

function canonicalDec(s) { return stripZeros(s); }

function isDecString(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

// Accepts a canonical-ready decimal string or a non-negative safe integer; returns the
// canonical decimal string, or null when the value is not a uint256.
function toUint256String(v) {
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v) || v < 0) return null;
    return String(v);
  }
  if (!isDecString(v)) return null;
  const c = canonicalDec(v);
  if (c.length > U256_MAX.length) return null;
  if (c.length === U256_MAX.length && c > U256_MAX) return null;
  return c;
}

// Compare two canonical decimal strings: -1, 0 or 1.
function cmpDec(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// Sum of two canonical decimal strings, canonical result.
function addDec(a, b) {
  const A = a, B = b;
  let i = A.length - 1, j = B.length - 1, carry = 0;
  const out = [];
  while (i >= 0 || j >= 0 || carry > 0) {
    const x = i >= 0 ? A.charCodeAt(i) - 48 : 0;
    const y = j >= 0 ? B.charCodeAt(j) - 48 : 0;
    const t = x + y + carry;
    out.push(t % 10);
    carry = t > 9 ? 1 : 0;
    i--; j--;
  }
  let s = '';
  for (let k = out.length - 1; k >= 0; k--) s += String(out[k]);
  return stripZeros(s);
}

// Difference a - b of canonical decimal strings; null when b exceeds a (callers guard).
function subDec(a, b) {
  if (cmpDec(a, b) < 0) return null;
  let i = a.length - 1, j = b.length - 1, borrow = 0;
  const out = [];
  while (i >= 0) {
    const x = a.charCodeAt(i) - 48 - borrow;
    const y = j >= 0 ? b.charCodeAt(j) - 48 : 0;
    const t = x - y;
    if (t < 0) { out.push(t + 10); borrow = 1; } else { out.push(t); borrow = 0; }
    i--; j--;
  }
  let s = '';
  for (let k = out.length - 1; k >= 0; k--) s += String(out[k]);
  return stripZeros(s);
}

// ---- field shapes (same acceptance as the sibling digest node's echo shapes) ----

function stripHexPrefix(s) {
  return (s.startsWith('0x') || s.startsWith('0X')) ? s.slice(2) : s;
}

function normalizeAddress(v) {
  if (typeof v !== 'string') return null;
  const s = stripHexPrefix(v.trim());
  if (!/^[0-9a-fA-F]{40}$/.test(s)) return null;
  return '0x' + s.toLowerCase();
}

function normalizeBytes32(v) {
  if (typeof v !== 'string') return null;
  const s = stripHexPrefix(v.trim());
  if (!/^[0-9a-fA-F]{64}$/.test(s)) return null;
  return '0x' + s.toLowerCase();
}

// ---- small pure helpers ----

function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

function isText(v, max) {
  if (typeof v !== 'string' || v.length < 1 || v.length > max) return false;
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 32 || c === 127) return false;
  }
  return true;
}

function isSafeNonNegativeInt(v) {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

function unknownKeys(o, allowed) {
  const out = [];
  const ks = Object.keys(o);
  for (let i = 0; i < ks.length && i < KEY_SCAN_MAX; i++) {
    if (allowed.indexOf(ks[i]) < 0) out.push(ks[i]);
  }
  return out;
}

function listIsArray(v, max) {
  return Array.isArray(v) && v.length <= max;
}

function refusal(code, field, detail) { return { code, field, detail }; }

// Canonical member order for a ledger-ref descriptor in observed output; sorting by this
// tuple makes every reason string independent of the caller's ledger array order.
function refLess(x, y) {
  if (x.nonce !== y.nonce) return x.nonce < y.nonce ? -1 : 1;
  if (x.to !== y.to) return x.to < y.to ? -1 : 1;
  const c = cmpDec(x.value, y.value);
  if (c !== 0) return c;
  if (x.signed_at !== y.signed_at) return x.signed_at < y.signed_at ? -1 : 1;
  if (x.status !== y.status) return x.status < y.status ? -1 : 1;
  if (x.intent_ref !== y.intent_ref) return (x.intent_ref || '') < (y.intent_ref || '') ? -1 : 1;
  return 0;
}

function sortRefs(refs) {
  const out = refs.slice();
  for (let i = 1; i < out.length; i++) {
    const cur = out[i];
    let j = i - 1;
    while (j >= 0 && refLess(cur, out[j]) < 0) { out[j + 1] = out[j]; j--; }
    out[j + 1] = cur;
  }
  return out;
}

function refLabel(r) {
  return 'ledger nonce ' + r.nonce + ' status=' + r.status + ' signed_at=' + r.signed_at
    + ' to=' + r.to + ' value=' + r.value + (r.intent_ref !== null ? ' intent_ref=' + r.intent_ref : '');
}

function makeReason(code, rule, observed, policy_value, clause, sub_code) {
  return { code, rule, sub_code: sub_code || null, observed, policy_value, clause };
}

function makeNotEvaluated(rule, code, because) {
  return { rule, code, because };
}

// ---- structural validation: wrong shapes are refused, absent inputs are not ----
// Absent policy/ledger/domain members are legal and leave the touching rules NOT_EVALUATED;
// present-but-malformed policy, domain, ledger or clock shapes are refused INPUT_REFUSED.
// Authorization field FORMats are rule 1's business (AUTH_FORMAT), not refusals.

function validate(pp) {
  const r = [];
  if (!isObj(pp)) return [refusal('NOT_AN_OBJECT', 'policy_parameters', 'policy_parameters must be an object')];
  const uk = unknownKeys(pp, TOP_KEYS);
  for (let i = 0; i < uk.length; i++) r.push(refusal('UNKNOWN_FIELD', uk[i], 'field is not part of the input schema'));
  if (pp.now_unix !== undefined && !isSafeNonNegativeInt(pp.now_unix)) {
    r.push(refusal('BAD_CLOCK', 'now_unix', 'now_unix must be a non-negative integer epoch second'));
  }
  // authorization: container and its own key set; field formats are rule 1
  if (pp.authorization === undefined) {
    r.push(refusal('MISSING_OBJECT', 'authorization', 'the authorization under decision is required'));
  } else if (!isObj(pp.authorization)) {
    r.push(refusal('NOT_AN_OBJECT', 'authorization', 'authorization must be an object'));
  } else {
    const a = pp.authorization;
    const ak = unknownKeys(a, AUTH_KEYS);
    for (let i = 0; i < ak.length; i++) r.push(refusal('UNKNOWN_FIELD', 'authorization.' + ak[i], 'field is not part of the input schema'));
    if (a.variant === undefined) {
      r.push(refusal('MISSING_FIELD', 'authorization.variant', 'variant is required and must be transfer or receive'));
    } else if (VARIANTS.indexOf(a.variant) < 0) {
      r.push(refusal('BAD_VARIANT', 'authorization.variant', 'variant must be transfer or receive'));
    }
    if (a.authorization_intent_ref !== undefined && !isText(a.authorization_intent_ref, TEXT_MAX)) {
      r.push(refusal('BAD_TEXT', 'authorization.authorization_intent_ref', 'authorization_intent_ref must be a 1 to 128 character string without control characters when present'));
    }
  }
  // domain: container plus per-field types; membership is rule 3
  if (pp.domain !== undefined && !isObj(pp.domain)) {
    r.push(refusal('NOT_AN_OBJECT', 'domain', 'domain must be an object when present'));
  } else if (isObj(pp.domain)) {
    const d = pp.domain;
    const dk = unknownKeys(d, DOMAIN_KEYS);
    for (let i = 0; i < dk.length; i++) r.push(refusal('UNKNOWN_FIELD', 'domain.' + dk[i], 'field is not part of the input schema'));
    if (d.name !== undefined && !isText(d.name, TEXT_MAX)) r.push(refusal('BAD_TEXT', 'domain.name', 'domain.name must be a 1 to 128 character string without control characters when present'));
    if (d.version !== undefined && !isText(d.version, TEXT_MAX)) r.push(refusal('BAD_TEXT', 'domain.version', 'domain.version must be a 1 to 128 character string without control characters when present'));
    if (d.chain_id !== undefined && toUint256String(d.chain_id) === null) r.push(refusal('BAD_CHAIN_ID', 'domain.chain_id', 'domain.chain_id must be a uint256 decimal string when present'));
    if (d.verifying_contract !== undefined && normalizeAddress(d.verifying_contract) === null) r.push(refusal('BAD_ADDRESS', 'domain.verifying_contract', 'domain.verifying_contract must be a 20-byte hex address when present'));
  }
  // policy: container plus per-field types; absent thresholds are legal
  if (pp.policy !== undefined && !isObj(pp.policy)) {
    r.push(refusal('NOT_AN_OBJECT', 'policy', 'policy must be an object when present'));
  } else if (isObj(pp.policy)) {
    const p = pp.policy;
    const pk = unknownKeys(p, POLICY_KEYS);
    for (let i = 0; i < pk.length; i++) r.push(refusal('UNKNOWN_FIELD', 'policy.' + pk[i], 'field is not part of the input schema'));
    if (p.agent_address !== undefined && normalizeAddress(p.agent_address) === null) r.push(refusal('BAD_ADDRESS', 'policy.agent_address', 'policy.agent_address must be a 20-byte hex address when present'));
    if (p.allowed_chain_ids !== undefined && !listIsArray(p.allowed_chain_ids, SETS_MAX)) r.push(refusal('BOUND_EXCEEDED', 'policy.allowed_chain_ids', 'allowed_chain_ids must be a list of at most ' + SETS_MAX + ' uint256 decimal strings'));
    if (Array.isArray(p.allowed_chain_ids)) {
      for (let i = 0; i < p.allowed_chain_ids.length && i < SETS_MAX; i++) {
        if (toUint256String(p.allowed_chain_ids[i]) === null) r.push(refusal('BAD_CHAIN_ID', 'policy.allowed_chain_ids[' + i + ']', 'each allowed chain id must be a uint256 decimal string'));
      }
    }
    if (p.allowed_tokens !== undefined && !listIsArray(p.allowed_tokens, SETS_MAX)) r.push(refusal('BOUND_EXCEEDED', 'policy.allowed_tokens', 'allowed_tokens must be a list of at most ' + SETS_MAX + ' token contract addresses'));
    if (Array.isArray(p.allowed_tokens)) {
      for (let i = 0; i < p.allowed_tokens.length && i < SETS_MAX; i++) {
        if (normalizeAddress(p.allowed_tokens[i]) === null) r.push(refusal('BAD_ADDRESS', 'policy.allowed_tokens[' + i + ']', 'each allowed token must be a 20-byte hex address'));
      }
    }
    for (const lname of ['payee_allowlist', 'payee_denylist', 'require_receive_for']) {
      if (p[lname] !== undefined && !listIsArray(p[lname], LIST_MAX)) r.push(refusal('BOUND_EXCEEDED', 'policy.' + lname, lname + ' must be a list of at most ' + LIST_MAX + ' payee addresses'));
      if (Array.isArray(p[lname])) {
        for (let i = 0; i < p[lname].length && i < LIST_MAX; i++) {
          if (normalizeAddress(p[lname][i]) === null) r.push(refusal('BAD_ADDRESS', 'policy.' + lname + '[' + i + ']', 'each payee must be a 20-byte hex address'));
        }
      }
    }
    if (p.per_tx_cap !== undefined && toUint256String(p.per_tx_cap) === null) r.push(refusal('BAD_AMOUNT', 'policy.per_tx_cap', 'per_tx_cap must be a uint256 decimal string when present'));
    if (p.window_caps !== undefined && !listIsArray(p.window_caps, SETS_MAX)) r.push(refusal('BOUND_EXCEEDED', 'policy.window_caps', 'window_caps must be a list of at most ' + SETS_MAX + ' window cap entries'));
    if (Array.isArray(p.window_caps)) {
      for (let i = 0; i < p.window_caps.length && i < SETS_MAX; i++) {
        const w = p.window_caps[i];
        if (!isObj(w) || unknownKeys(w, ['window_seconds', 'cap']).length > 0) r.push(refusal('BAD_ENTRY', 'policy.window_caps[' + i + ']', 'each window cap must be an object with exactly window_seconds and cap'));
        else {
          if (!isSafeNonNegativeInt(w.window_seconds) || w.window_seconds <= 0) r.push(refusal('BAD_WINDOW', 'policy.window_caps[' + i + '].window_seconds', 'window_seconds must be a positive integer second count'));
          if (toUint256String(w.cap) === null) r.push(refusal('BAD_AMOUNT', 'policy.window_caps[' + i + '].cap', 'cap must be a uint256 decimal string'));
        }
      }
    }
    if (p.velocity !== undefined && !listIsArray(p.velocity, SETS_MAX)) r.push(refusal('BOUND_EXCEEDED', 'policy.velocity', 'velocity must be a list of at most ' + SETS_MAX + ' velocity rules'));
    if (Array.isArray(p.velocity)) {
      for (let i = 0; i < p.velocity.length && i < SETS_MAX; i++) {
        const w = p.velocity[i];
        if (!isObj(w) || unknownKeys(w, ['window_seconds', 'max_count']).length > 0) r.push(refusal('BAD_ENTRY', 'policy.velocity[' + i + ']', 'each velocity rule must be an object with exactly window_seconds and max_count'));
        else {
          if (!isSafeNonNegativeInt(w.window_seconds) || w.window_seconds <= 0) r.push(refusal('BAD_WINDOW', 'policy.velocity[' + i + '].window_seconds', 'window_seconds must be a positive integer second count'));
          if (!isSafeNonNegativeInt(w.max_count) || w.max_count <= 0) r.push(refusal('BAD_COUNT', 'policy.velocity[' + i + '].max_count', 'max_count must be a positive integer'));
        }
      }
    }
    for (const tname of ['max_validity_seconds', 'max_future_start_seconds', 'duplicate_window_seconds']) {
      if (p[tname] !== undefined && (!isSafeNonNegativeInt(p[tname]) || p[tname] <= 0)) r.push(refusal('BAD_WINDOW', 'policy.' + tname, tname + ' must be a positive integer second count when present'));
    }
    if (p.duplicate_requires_distinct_intent_ref !== undefined && typeof p.duplicate_requires_distinct_intent_ref !== 'boolean') {
      r.push(refusal('NOT_BOOLEAN', 'policy.duplicate_requires_distinct_intent_ref', 'must be true or false when present'));
    }
  }
  // ledger: array bound plus per-entry shapes
  if (pp.ledger !== undefined && !Array.isArray(pp.ledger)) r.push(refusal('NOT_AN_ARRAY', 'ledger', 'ledger must be an array when present'));
  if (Array.isArray(pp.ledger)) {
    if (pp.ledger.length > LEDGER_MAX) r.push(refusal('BOUND_EXCEEDED', 'ledger', 'the ledger carries at most ' + LEDGER_MAX + ' entries'));
    for (let i = 0; i < pp.ledger.length && i < LEDGER_MAX; i++) {
      const e = pp.ledger[i];
      const at = 'ledger[' + i + ']';
      if (!isObj(e)) { r.push(refusal('NOT_AN_OBJECT', at, 'each ledger entry must be an object')); continue; }
      const ek = unknownKeys(e, LEDGER_KEYS);
      for (let k = 0; k < ek.length; k++) r.push(refusal('UNKNOWN_FIELD', at + '.' + ek[k], 'field is not part of the input schema'));
      if (normalizeAddress(e.from) === null) r.push(refusal('BAD_ADDRESS', at + '.from', 'entry from must be a 20-byte hex address'));
      if (normalizeAddress(e.to) === null) r.push(refusal('BAD_ADDRESS', at + '.to', 'entry to must be a 20-byte hex address'));
      if (normalizeAddress(e.token) === null) r.push(refusal('BAD_ADDRESS', at + '.token', 'entry token must be a 20-byte hex address'));
      if (normalizeBytes32(e.nonce) === null) r.push(refusal('BAD_NONCE', at + '.nonce', 'entry nonce must be a 32-byte hex value'));
      if (toUint256String(e.value) === null) r.push(refusal('BAD_AMOUNT', at + '.value', 'entry value must be a uint256 decimal string'));
      if (toUint256String(e.validBefore) === null) r.push(refusal('BAD_AMOUNT', at + '.validBefore', 'entry validBefore must be a uint256 decimal string'));
      if (toUint256String(e.chain_id) === null) r.push(refusal('BAD_CHAIN_ID', at + '.chain_id', 'entry chain_id must be a uint256 decimal string'));
      if (!isSafeNonNegativeInt(e.signed_at)) r.push(refusal('BAD_CLOCK', at + '.signed_at', 'entry signed_at must be a non-negative integer epoch second'));
      if (STATUSES.indexOf(e.status) < 0) r.push(refusal('BAD_STATUS', at + '.status', 'entry status must be signed, settled or canceled'));
      if (e.intent_ref !== undefined && !isText(e.intent_ref, TEXT_MAX)) r.push(refusal('BAD_TEXT', at + '.intent_ref', 'entry intent_ref must be a 1 to 128 character string without control characters when present'));
    }
  }
  return r;
}

// Ruled counting classes for rules 11 and 12: a settled payment counts when it happened
// inside the declared window; a signed-unexpired authorization counts regardless of age
// (live exposure); a null clock disqualifies both halves.
function countsInWindow(entry, windowSeconds, nowNum, nowStr) {
  if (entry.status === 'settled') return entry.signed_at > nowNum - windowSeconds && entry.signed_at <= nowNum;
  if (entry.status !== 'signed' || nowStr === null) return false;
  return cmpDec(entry.validBefore, nowStr) > 0;
}

// Rule 13's class filter: signed-unexpired or settled, inside the declared duplicate window.
function countsInDupWindow(entry, windowSeconds, nowNum, nowStr) {
  if (!(entry.signed_at > nowNum - windowSeconds && entry.signed_at <= nowNum)) return false;
  if (entry.status === 'settled') return true;
  if (entry.status !== 'signed' || nowStr === null) return false;
  return cmpDec(entry.validBefore, nowStr) > 0;
}

// ---- compute ----

/**
 * compute(pp) pure pre-sign spend-gate kernel.
 * pp: {
 *   authorization: { variant, from, to, value, validAfter, validBefore, nonce,
 *                    authorization_intent_ref? },
 *   domain?:       { name?, version?, chain_id?, verifying_contract? },
 *   policy?:       { agent_address?, allowed_chain_ids?, allowed_tokens?, payee_allowlist?,
 *                    payee_denylist?, per_tx_cap?, window_caps?, velocity?,
 *                    max_validity_seconds?, max_future_start_seconds?,
 *                    duplicate_window_seconds?, duplicate_requires_distinct_intent_ref?,
 *                    require_receive_for? },
 *   ledger?:       [ { from, token, chain_id, nonce, to, value, validBefore, signed_at,
 *                      intent_ref?, status } ],
 *   now_unix?:     integer epoch seconds,
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  return computeNormalized(dropNullMembers(pp));
}

// An explicit null member answers exactly as an absent one: object members
// holding null are dropped before validation. Array elements are left untouched.
function dropNullMembers(x) {
  if (!isObj(x)) return x;
  const o = {};
  for (const k of Object.keys(x)) if (x[k] !== null) o[k] = dropNullMembers(x[k]);
  return o;
}

function computeNormalized(pp) {
  const refusals = validate(pp);
  if (refusals.length > 0) {
    return {
      output_payload: {
        decision: 'INDETERMINATE',
        primary_reason: null,
        reasons: [],
        not_evaluated: [],
        headroom: { per_tx: { evaluated: false }, window_caps: [], velocity: [] },
        exposure: { outstanding_signed_unexpired: null, settled_in_window: null },
        authorization_echo: null,
        authorization_meta: null,
        receipt: { gate: TOOL_ID, decision: 'INDETERMINATE', primary_code: null, rules_evaluated: 0, rules_not_evaluated: 0, now_unix: null, scope_note: SCOPE_NOTE },
        refusals,
        warn_count: 1,
      },
      compliance_flags: ['INPUT_REFUSED'],
    };
  }

  const a = isObj(pp.authorization) ? pp.authorization : {};
  const d = isObj(pp.domain) ? pp.domain : {};
  const p = isObj(pp.policy) ? pp.policy : {};
  const ledgerRaw = Array.isArray(pp.ledger) ? pp.ledger : [];
  const hasClock = isSafeNonNegativeInt(pp.now_unix);
  const nowStr = hasClock ? String(pp.now_unix) : null;

  // normalized authorization fields (formats are rule 1's findings, so nulls are expected)
  const aVariant = VARIANTS.indexOf(a.variant) >= 0 ? a.variant : null;
  const aFrom = normalizeAddress(a.from);
  const aTo = normalizeAddress(a.to);
  const aValue = toUint256String(a.value);
  const aValidAfter = toUint256String(a.validAfter);
  const aValidBefore = toUint256String(a.validBefore);
  const aNonce = normalizeBytes32(a.nonce);
  const dName = isText(d.name, TEXT_MAX) ? d.name : null;
  const dVersion = isText(d.version, TEXT_MAX) ? d.version : null;
  const dChain = d.chain_id !== undefined ? toUint256String(d.chain_id) : null;
  const dToken = d.verifying_contract !== undefined ? normalizeAddress(d.verifying_contract) : null;

  // normalized policy lists
  const agentAddress = p.agent_address !== undefined ? normalizeAddress(p.agent_address) : null;
  const allowedChains = Array.isArray(p.allowed_chain_ids) ? p.allowed_chain_ids.map(canonicalDec) : null;
  const allowedTokens = Array.isArray(p.allowed_tokens) ? p.allowed_tokens.map(normalizeAddress) : null;
  const payeeAllow = Array.isArray(p.payee_allowlist) ? p.payee_allowlist.map(normalizeAddress) : null;
  const payeeDeny = Array.isArray(p.payee_denylist) ? p.payee_denylist.map(normalizeAddress) : null;
  const requireReceive = Array.isArray(p.require_receive_for) ? p.require_receive_for.map(normalizeAddress) : null;
  const perTxCap = p.per_tx_cap !== undefined ? toUint256String(p.per_tx_cap) : null;
  const windowCaps = Array.isArray(p.window_caps)
    ? p.window_caps.map((w) => ({ window_seconds: w.window_seconds, cap: canonicalDec(w.cap) }))
    : null;
  const velocity = Array.isArray(p.velocity)
    ? p.velocity.map((w) => ({ window_seconds: w.window_seconds, max_count: w.max_count }))
    : null;
  const maxValidity = typeof p.max_validity_seconds === 'number' ? p.max_validity_seconds : null;
  const maxFutureStart = typeof p.max_future_start_seconds === 'number' ? p.max_future_start_seconds : null;
  const dupWindow = typeof p.duplicate_window_seconds === 'number' ? p.duplicate_window_seconds : null;
  const dupDistinctFlag = typeof p.duplicate_requires_distinct_intent_ref === 'boolean' ? p.duplicate_requires_distinct_intent_ref : null;

  // normalized ledger
  const ledger = ledgerRaw.map((e) => ({
    from: normalizeAddress(e.from),
    token: normalizeAddress(e.token),
    chain_id: canonicalDec(toUint256String(e.chain_id)),
    nonce: normalizeBytes32(e.nonce),
    to: normalizeAddress(e.to),
    value: toUint256String(e.value),
    validBefore: toUint256String(e.validBefore),
    signed_at: e.signed_at,
    intent_ref: typeof e.intent_ref === 'string' ? e.intent_ref : null,
    status: e.status,
  }));

  const deny = [];
  const over = [];
  const notEvaluated = [];

  // rule 1 AUTH_FORMAT: authorization field shapes and the zero address
  {
    const bad = [];
    if (aFrom === null) bad.push('from is absent or not a 20-byte hex address');
    else if (aFrom === ZERO_ADDRESS) bad.push('from is the zero address');
    if (aTo === null) bad.push('to is absent or not a 20-byte hex address');
    if (aValue === null) bad.push('value is absent or not a uint256 decimal string');
    if (aValidAfter === null) bad.push('validAfter is absent or not a uint256 decimal string');
    if (aValidBefore === null) bad.push('validBefore is absent or not a uint256 decimal string');
    if (bad.length > 0) {
      deny.push(makeReason('AUTH_FORMAT', 1, bad.join('; '), null, CLAUSE.r1));
    }
  }

  // rule 2 SIGNER_MISMATCH
  if (agentAddress === null) {
    notEvaluated.push(makeNotEvaluated(2, 'SIGNER_MISMATCH', 'policy.agent_address is absent'));
  } else if (aFrom !== null) {
    if (aFrom !== agentAddress) {
      deny.push(makeReason('SIGNER_MISMATCH', 2, 'authorization.from=' + aFrom, 'policy.agent_address=' + agentAddress, CLAUSE.r2));
    }
  } else {
    notEvaluated.push(makeNotEvaluated(2, 'SIGNER_MISMATCH', 'authorization.from is malformed (rule 1 lists it)'));
  }

  // rule 3 DOMAIN_NOT_ALLOWED (each half needs its declared list)
  {
    let chainHit = false, tokenHit = false;
    if (allowedChains === null) notEvaluated.push(makeNotEvaluated(3, 'DOMAIN_NOT_ALLOWED', 'policy.allowed_chain_ids is absent'));
    else if (dChain === null) notEvaluated.push(makeNotEvaluated(3, 'DOMAIN_NOT_ALLOWED', 'domain.chain_id is absent'));
    else if (allowedChains.indexOf(dChain) < 0) chainHit = true;
    if (allowedTokens === null) notEvaluated.push(makeNotEvaluated(3, 'DOMAIN_NOT_ALLOWED', 'policy.allowed_tokens is absent'));
    else if (dToken === null) notEvaluated.push(makeNotEvaluated(3, 'DOMAIN_NOT_ALLOWED', 'domain.verifying_contract is absent'));
    else if (allowedTokens.indexOf(dToken) < 0) tokenHit = true;
    if (chainHit || tokenHit) {
      const obs = [];
      if (chainHit) obs.push('chain_id=' + dChain + ' is not in allowed_chain_ids');
      if (tokenHit) obs.push('verifying_contract=' + dToken + ' is not in allowed_tokens');
      deny.push(makeReason('DOMAIN_NOT_ALLOWED', 3, obs.join('; '), null, CLAUSE.r3));
    }
  }

  // rule 4 NONCE_ZERO (nonce shape and zero)
  if (aNonce === null) {
    deny.push(makeReason('NONCE_ZERO', 4, 'nonce is absent or not a 32-byte hex value', null, CLAUSE.r4));
  } else if (aNonce === ZERO_NONCE) {
    deny.push(makeReason('NONCE_ZERO', 4, 'nonce is zero', null, CLAUSE.r4));
  }

  // rule 5 NONCE_REUSED (any ledger status)
  let rule5Evaluated = false;
  if (aFrom !== null && aNonce !== null && (dToken === null || dChain === null)) {
    notEvaluated.push(makeNotEvaluated(5, 'NONCE_REUSED', 'domain.verifying_contract or domain.chain_id is absent'));
  } else if (aFrom !== null && aNonce !== null) {
    rule5Evaluated = true;
    const hits = [];
    for (let i = 0; i < ledger.length; i++) {
      const e = ledger[i];
      if (e.from === aFrom && e.token === dToken && e.chain_id === dChain && e.nonce === aNonce) {
        hits.push({ nonce: e.nonce, to: e.to, value: e.value, valid_before: e.validBefore, status: e.status, signed_at: e.signed_at, intent_ref: e.intent_ref });
      }
    }
    if (hits.length > 0) {
      const sorted = sortRefs(hits);
      let allIdentical = true;
      for (let i = 0; i < sorted.length; i++) {
        const h = sorted[i];
        if (h.to !== aTo || h.value !== aValue || h.valid_before !== aValidBefore) { allIdentical = false; break; }
      }
      deny.push(makeReason(
        'NONCE_REUSED', 5,
        sorted.map(refLabel).join('; '),
        null,
        CLAUSE.r5,
        allIdentical ? 'NONCE_REUSED_IDENTICAL' : 'NONCE_REUSED_FIELDS_DIFFER',
      ));
    }
  } else {
    notEvaluated.push(makeNotEvaluated(5, 'NONCE_REUSED', 'authorization from or nonce is malformed (rule 1 lists it)'));
  }

  // rule 6 strict open interval
  if (aValidAfter !== null && aValidBefore !== null) {
    if (cmpDec(aValidAfter, aValidBefore) >= 0) {
      deny.push(makeReason('WINDOW_INVALID', 6, 'validAfter=' + aValidAfter + ' validBefore=' + aValidBefore, null, CLAUSE.r6));
    }
    if (nowStr === null) {
      notEvaluated.push(makeNotEvaluated(6, 'NOT_YET_VALID', 'now_unix is absent'));
      notEvaluated.push(makeNotEvaluated(6, 'EXPIRED', 'now_unix is absent'));
    } else {
      if (cmpDec(nowStr, aValidAfter) <= 0) {
        deny.push(makeReason('NOT_YET_VALID', 6, 'now=' + nowStr + ' validAfter=' + aValidAfter, null, CLAUSE.r6));
      }
      if (cmpDec(nowStr, aValidBefore) >= 0) {
        deny.push(makeReason('EXPIRED', 6, 'now=' + nowStr + ' validBefore=' + aValidBefore, null, CLAUSE.r6));
      }
    }
  } else {
    notEvaluated.push(makeNotEvaluated(6, 'WINDOW_INVALID', 'validAfter or validBefore is malformed (rule 1 lists it)'));
  }

  // rule 7 declared ceilings
  if (aValidAfter !== null && aValidBefore !== null && cmpDec(aValidAfter, aValidBefore) < 0) {
    if (maxValidity === null) {
      notEvaluated.push(makeNotEvaluated(7, 'WINDOW_TOO_LONG', 'policy.max_validity_seconds is absent'));
    } else {
      const len = subDec(aValidBefore, aValidAfter);
      if (len !== null && cmpDec(len, String(maxValidity)) > 0) {
        deny.push(makeReason('WINDOW_TOO_LONG', 7, 'window_length=' + len, 'max_validity_seconds=' + maxValidity, CLAUSE.r7));
      }
    }
  } else {
    notEvaluated.push(makeNotEvaluated(7, 'WINDOW_TOO_LONG', 'the window is malformed or inverted (rules 1 and 6 list it)'));
  }
  if (aValidAfter !== null && nowStr !== null) {
    if (maxFutureStart === null) {
      notEvaluated.push(makeNotEvaluated(7, 'START_TOO_FAR', 'policy.max_future_start_seconds is absent'));
    } else {
      const limit = addDec(nowStr, String(maxFutureStart));
      if (cmpDec(aValidAfter, limit) > 0) {
        deny.push(makeReason('START_TOO_FAR', 7, 'validAfter=' + aValidAfter + ' now=' + nowStr, 'max_future_start_seconds=' + maxFutureStart, CLAUSE.r7));
      }
    }
  } else {
    notEvaluated.push(makeNotEvaluated(7, 'START_TOO_FAR', 'validAfter is malformed (rule 1 lists it) or now_unix is absent'));
  }

  // rule 8 payee lists
  if (aTo === null) {
    notEvaluated.push(makeNotEvaluated(8, 'PAYEE_DENIED', 'authorization.to is malformed (rule 1 lists it)'));
    notEvaluated.push(makeNotEvaluated(8, 'PAYEE_NOT_ALLOWED', 'authorization.to is malformed (rule 1 lists it)'));
  } else {
    if (payeeDeny === null) notEvaluated.push(makeNotEvaluated(8, 'PAYEE_DENIED', 'policy.payee_denylist is absent'));
    else if (payeeDeny.indexOf(aTo) >= 0) {
      deny.push(makeReason('PAYEE_DENIED', 8, 'to=' + aTo + ' is on payee_denylist', null, CLAUSE.r8));
    }
    if (payeeAllow === null) notEvaluated.push(makeNotEvaluated(8, 'PAYEE_NOT_ALLOWED', 'policy.payee_allowlist is absent, so the allowlist rule is NOT_EVALUATED'));
    else if (payeeAllow.indexOf(aTo) < 0) {
      deny.push(makeReason('PAYEE_NOT_ALLOWED', 8, 'to=' + aTo + ' is not on payee_allowlist', null, CLAUSE.r8));
    }
  }

  // rule 9 receive variant for declared contract payees
  if (requireReceive === null) {
    notEvaluated.push(makeNotEvaluated(9, 'VARIANT_REQUIRED_RECEIVE', 'policy.require_receive_for is absent'));
  } else if (aTo === null || aVariant === null) {
    notEvaluated.push(makeNotEvaluated(9, 'VARIANT_REQUIRED_RECEIVE', 'authorization to or variant is malformed (rule 1 lists it)'));
  } else if (requireReceive.indexOf(aTo) >= 0 && aVariant === 'transfer') {
    deny.push(makeReason('VARIANT_REQUIRED_RECEIVE', 9, 'to=' + aTo + ' requires the receive variant; variant=' + aVariant, null, CLAUSE.r9));
  }

  // rule 10 per-transaction cap
  if (perTxCap === null) {
    notEvaluated.push(makeNotEvaluated(10, 'OVER_PER_TX_CAP', 'policy.per_tx_cap is absent'));
  } else if (aValue === null) {
    notEvaluated.push(makeNotEvaluated(10, 'OVER_PER_TX_CAP', 'value is malformed (rule 1 lists it)'));
  } else if (cmpDec(aValue, perTxCap) > 0) {
    over.push(makeReason('OVER_PER_TX_CAP', 10, 'value=' + aValue, 'per_tx_cap=' + perTxCap, CLAUSE.r10));
  }

  // ruled counting set for rules 11 and 12 (window sums and velocity counts)
  const countIn = (e, w) => countsInWindow(e, w, pp.now_unix, nowStr);
  const velocityCounts = velocity ? velocity.map(() => 0) : [];

  // rule 11 rolling window caps
  if (windowCaps === null || windowCaps.length === 0) {
    notEvaluated.push(makeNotEvaluated(11, 'OVER_WINDOW_CAP', 'policy.window_caps is absent or empty'));
  } else if (aValue === null) {
    notEvaluated.push(makeNotEvaluated(11, 'OVER_WINDOW_CAP', 'value is malformed (rule 1 lists it)'));
  } else if (nowStr === null) {
    notEvaluated.push(makeNotEvaluated(11, 'OVER_WINDOW_CAP', 'now_unix is absent'));
  } else {
    for (let v = 0; v < windowCaps.length; v++) {
      const w = windowCaps[v];
      let used = '0';
      for (let i = 0; i < ledger.length; i++) {
        if (countIn(ledger[i], w.window_seconds)) used = addDec(used, ledger[i].value);
      }
      const total = addDec(used, aValue);
      if (cmpDec(total, w.cap) > 0) {
        over.push(makeReason('OVER_WINDOW_CAP', 11, 'window_seconds=' + w.window_seconds + ' used=' + used + ' with this value=' + total, 'cap=' + w.cap, CLAUSE.r11));
      }
    }
  }

  // rule 12 velocity counts (same ruled inclusion and exclusion semantics as rule 11)
  if (velocity === null || velocity.length === 0) {
    notEvaluated.push(makeNotEvaluated(12, 'OVER_VELOCITY', 'policy.velocity is absent or empty'));
  } else if (nowStr === null) {
    notEvaluated.push(makeNotEvaluated(12, 'OVER_VELOCITY', 'now_unix is absent'));
  } else {
    for (let v = 0; v < velocity.length; v++) {
      let count = 0;
      for (let i = 0; i < ledger.length; i++) {
        if (countIn(ledger[i], velocity[v].window_seconds)) count++;
      }
      velocityCounts[v] = count;
      if (count + 1 > velocity[v].max_count) {
        over.push(makeReason('OVER_VELOCITY', 12, 'count=' + count + ' in window_seconds=' + velocity[v].window_seconds + ' plus this authorization', 'max_count=' + velocity[v].max_count, CLAUSE.r12));
      }
    }
  }

  // rule 13 duplicate intent (ruled base case only; the intent-ref branch table is an open
  // item with the desk, so no default is invented here)
  if (dupWindow === null) {
    notEvaluated.push(makeNotEvaluated(13, 'DUPLICATE_INTENT', 'policy.duplicate_window_seconds is absent, which rules the duplicate check NOT_EVALUATED'));
  } else if (aValue === null || aTo === null || aNonce === null) {
    notEvaluated.push(makeNotEvaluated(13, 'DUPLICATE_INTENT', 'authorization to, value or nonce is malformed (rule 1 or 4 lists it)'));
  } else if (nowStr === null) {
    notEvaluated.push(makeNotEvaluated(13, 'DUPLICATE_INTENT', 'now_unix is absent'));
  } else if (dToken === null || dChain === null) {
    notEvaluated.push(makeNotEvaluated(13, 'DUPLICATE_INTENT', 'domain.verifying_contract or domain.chain_id is absent'));
  } else {
    const dupHits = [];
    for (let i = 0; i < ledger.length; i++) {
      const e = ledger[i];
      if (e.nonce === aNonce) continue; // no double counting: rule 5 already matched by nonce
      if (!countsInDupWindow(e, dupWindow, pp.now_unix, nowStr)) continue;
      if (e.to !== aTo || e.value !== aValue || e.token !== dToken || e.chain_id !== dChain) continue;
      dupHits.push({ nonce: e.nonce, to: e.to, value: e.value, valid_before: e.validBefore, status: e.status, signed_at: e.signed_at, intent_ref: e.intent_ref });
    }
    if (dupHits.length > 0) {
      over.push(makeReason('DUPLICATE_INTENT', 13, sortRefs(dupHits).map(refLabel).join('; '), 'duplicate_window_seconds=' + dupWindow, CLAUSE.r13));
    }
  }

  // headroom (mirrors the rule 11 and rule 12 sums; this authorization's own value is not in `used`)
  const headroom = { per_tx: null, window_caps: [], velocity: [] };
  headroom.per_tx = perTxCap === null ? { evaluated: false } : {
    evaluated: true,
    cap: perTxCap,
    value: aValue,
    remaining: (aValue !== null && cmpDec(perTxCap, aValue) >= 0) ? subDec(perTxCap, aValue) : null,
  };
  if (windowCaps !== null && nowStr !== null) {
    for (let v = 0; v < windowCaps.length; v++) {
      const w = windowCaps[v];
      let used = '0';
      for (let i = 0; i < ledger.length; i++) {
        if (countIn(ledger[i], w.window_seconds)) used = addDec(used, ledger[i].value);
      }
      headroom.window_caps.push({
        window_seconds: w.window_seconds,
        used,
        cap: w.cap,
        remaining: cmpDec(w.cap, used) >= 0 ? subDec(w.cap, used) : null,
      });
    }
  }
  if (velocity !== null && nowStr !== null) {
    for (let v = 0; v < velocity.length; v++) {
      headroom.velocity.push({ window_seconds: velocity[v].window_seconds, count: velocityCounts[v], max: velocity[v].max_count });
    }
  }

  // exposure (a signed entry is outstanding while it is unexpired on the caller clock)
  let outstanding = nowStr === null ? null : '0';
  if (outstanding !== null) {
    for (let i = 0; i < ledger.length; i++) {
      const e = ledger[i];
      if (e.status === 'signed' && cmpDec(e.validBefore, nowStr) > 0 && e.value !== null) {
        outstanding = addDec(outstanding, e.value);
      }
    }
  }
  let settledInWindow = null;
  if (dupWindow !== null && nowStr !== null) {
    settledInWindow = '0';
    for (let i = 0; i < ledger.length; i++) {
      const e = ledger[i];
      if (e.status === 'settled' && e.signed_at > pp.now_unix - dupWindow && e.signed_at <= pp.now_unix && e.value !== null) {
        settledInWindow = addDec(settledInWindow, e.value);
      }
    }
  }
  const exposure = { outstanding_signed_unexpired: outstanding, settled_in_window: settledInWindow };

  // decision and primary reason. SPEND guard: no DENY, no OVER_LIMIT, at least one rule
  // evaluated, the per-transaction cap AND at least one window cap evaluated, and rule 5
  // (nonce reuse) evaluated: a missing domain.verifying_contract or domain.chain_id is
  // INDETERMINATE, never SPEND.
  const reasons = [];
  for (let i = 0; i < deny.length; i++) reasons.push(deny[i]);
  for (let i = 0; i < over.length; i++) reasons.push(over[i]);
  let decision;
  if (deny.length > 0) decision = 'DENY';
  else if (over.length > 0) decision = 'OVER_LIMIT';
  else {
    const evaluatedCount = 13 - distinctRuleCount(notEvaluated);
    const capChecked = perTxCap !== null;
    const windowChecked = windowCaps !== null && windowCaps.length > 0 && nowStr !== null;
    decision = (evaluatedCount > 0 && capChecked && windowChecked && rule5Evaluated) ? 'SPEND' : 'INDETERMINATE';
  }
  const primary = reasons.length > 0 ? reasons[0] : null;

  const flags = [];
  if (decision === 'SPEND') flags.push('WITHIN_DECLARED_POLICY');
  else if (decision === 'DENY') flags.push('DENY_OUTSIDE_DECLARED_POLICY');
  else if (decision === 'OVER_LIMIT') flags.push('OVER_LIMIT_OUTSIDE_DECLARED_POLICY');
  else flags.push('SPEND_GATE_INDETERMINATE');
  let dupSuspected = false;
  for (let i = 0; i < over.length; i++) {
    if (over[i].code === 'DUPLICATE_INTENT') dupSuspected = true;
  }
  if (dupSuspected) flags.push('DUPLICATE_INTENT_SUSPECTED');
  // mirror of the conditional flags: every flag except the clean
  // WITHIN_DECLARED_POLICY is a caveat, so warn_count is non-zero exactly when one is raised
  const warnCount = flags.length - (decision === 'SPEND' ? 1 : 0);

  const authorizationEcho = {
    name: dName,
    version: dVersion,
    chainId: dChain,
    verifyingContract: dToken,
    from: aFrom,
    to: aTo,
    value: aValue,
    validAfter: aValidAfter,
    validBefore: aValidBefore,
    nonce: aNonce,
  };
  const authorizationMeta = {
    variant: aVariant,
    authorization_intent_ref: typeof a.authorization_intent_ref === 'string' ? a.authorization_intent_ref : null,
  };
  const receipt = {
    gate: TOOL_ID,
    decision,
    primary_code: primary !== null ? primary.code : null,
    rules_evaluated: 13 - distinctRuleCount(notEvaluated),
    rules_not_evaluated: distinctRuleCount(notEvaluated),
    now_unix: hasClock ? pp.now_unix : null,
    scope_note: SCOPE_NOTE,
  };

  return {
    output_payload: {
      decision,
      primary_reason: primary,
      reasons,
      not_evaluated: notEvaluated,
      headroom,
      exposure,
      authorization_echo: authorizationEcho,
      authorization_meta: authorizationMeta,
      receipt,
      refusals: [],
      warn_count: warnCount,
    },
    compliance_flags: flags,
  };
}

// distinct rule numbers among the NOT_EVALUATED entries (a rule can be not evaluated in
// more than one half; it counts once)
function distinctRuleCount(notEvaluated) {
  const seen = {};
  let n = 0;
  for (let i = 0; i < notEvaluated.length; i++) {
    const r = notEvaluated[i].rule;
    if (!seen[r]) { seen[r] = true; n++; }
  }
  return n;
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
