import { executionHash } from './_hash.mjs';

// art-830-eip3009-spend-exposure-reconciler: reconciles a caller-pasted EIP-3009 authorization
// ledger (the sibling spend gate's ledger shape, parsing logic shared by copy, never by import)
// against caller-pasted AuthorizationUsed and AuthorizationCanceled event rows, on a caller
// clock. Each ledger entry is classified settled, canceled, expired-unspent or outstanding;
// the outstanding exposure is totaled; disagreements between the pasted events and the ledger's
// own status claims are listed as discrepancies.
//
// THE FIVE CLASSES (closed enum; a sixth sentinel not_evaluated marks entries the declared
// inputs cannot classify):
//   settled          a pasted use event applies to the entry, or (with no applying event) the
//                    ledger itself claims settled
//   canceled         a pasted cancel event applies to the entry, or (with no applying event)
//                    the ledger itself claims canceled
//   not_yet_valid    ledger says signed, no applying event, and the clock has not passed the
//                    entry's validAfter (now <= validAfter): the token contract would reject it
//                    today, so it is excluded from total_outstanding and disclosed beside it
//   expired_unspent  ledger says signed, no applying event, and on the caller clock the entry's
//                    validBefore has passed
//   outstanding      ledger says signed, no applying event, and the clock is strictly inside the
//                    open window validAfter < now < validBefore (the reference implementation's
//                    rule, both bounds strict): live money the token contract can still move
//   not_evaluated    either the caller clock is absent (a signed entry cannot be split between
//                    outstanding and expired-unspent), or pasted rows carry BOTH a use event and
//                    a cancel event for the entry identity, which the pasted rows cannot order
//
// THE DISCREPANCY CODES (closed set):
//   LEDGER_SAYS_SIGNED_EVENTS_SETTLED      use event applies, ledger status signed
//   LEDGER_SAYS_CANCELED_EVENTS_SETTLED    use event applies, ledger status canceled
//   LEDGER_SAYS_SIGNED_EVENTS_CANCELED     cancel event applies, ledger status signed
//   LEDGER_SAYS_SETTLED_EVENTS_CANCELED    cancel event applies, ledger status settled
//   EVENT_CONFLICT                         use and cancel events both apply to one identity;
//                                          class not_evaluated, value excluded from every total
//                                          and disclosed separately
//   EVENT_WITHOUT_LEDGER_ENTRY             a pasted event matches no ledger entry
//   AMBIGUOUS_EVENT_SCOPE                  an event without a declared token or chain scope
//                                          matches entries spanning more than one token and
//                                          chain pair, so it is applied to none of them
//   DUPLICATE_NONCE_LEDGER                 two or more ledger entries share authorizer, token, chain
//                                          and nonce; only one authorization per identity can ever
//                                          settle, so the FIRST entry in canonical sort order is
//                                          evaluated and counted and every extra is classed
//                                          not_evaluated, excluded from every total (the ledger is
//                                          flagged, not refused)
//   DUPLICATE_EVENT_ROW                    the same event row (identity plus scope) is pasted
//                                          twice into one list; the second row is not applied
//
// EVENT SCOPE: an event row is authorizer plus nonce (the two indexed fields of the pasted
// event shape), with OPTIONAL token and chain_id narrowing. Without the narrowing fields an
// event applies to every entry sharing authorizer and nonce within a single token and chain
// pair; when such an unscoped event spans several pairs it is not applied at all. Events never
// cross tokens silently.
//
// EXPOSURE ARITHMETIC: total_outstanding sums the values of entries classified outstanding,
// decimal-string uint256, and is null whenever a clock-absent not_evaluated entry exists (an
// unclassifiable signed entry could be live money, so a partial total would understate
// exposure). Not-yet-valid entries are never inside that total either; their count and summed
// value are disclosed as not_yet_valid_entries and not_yet_valid_value, and duplicate-nonce
// extras are counted in duplicate_nonce_entries. Entries unresolved by an event conflict are never inside that total; their count
// and summed value are disclosed next to it. Canceled and expired-unspent entries never count.
//
// DETERMINISM: compute() is a PURE function of pp. No clock, no network, no filesystem, no
// TextEncoder/atob/URL in compute (the QuickJS guest lacks them), no Date, no float, no
// BigInt. uint256 values are decimal strings throughout, compared and summed by the pure
// string-integer helpers below. Timestamps are integer epoch seconds in Number space. Entries
// and discrepancies are emitted in a canonical sort order, so the output does not depend on
// the caller's array ordering.
//
// FIXED INPUT BOUNDS (the kernel envelope): ledger at most 256 entries; each event list at
// most 256 rows; unknown-key scans walk at most 64 keys per object. A declared input that
// exceeds a bound or carries a malformed ledger, event or clock shape is refused INPUT_REFUSED
// rather than guessed at. There are no thresholds and no defaults: the caller clock is the
// only caller-declared temporal input, and absent inputs leave their aspect NOT_EVALUATED.
//
// This kernel performs no chain reads, no signature recovery and no digest recomputation; the
// event rows and the ledger are caller-attested and may be incomplete. It hashes nothing
// inside compute(); the artifact execution_hash is computed by the shared _hash.mjs outside
// compute() (buildArtifact), the only permitted path.

const TOOL_ID = 'art-830-eip3009-spend-exposure-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_eip3009_spend_exposure',
  mandate_type: 'compliance_control', gpu: false,
};

// ---- fixed bounds (kernel envelope; see header) ----
const LEDGER_MAX = 256;
const EVENTS_MAX = 256;
const KEY_SCAN_MAX = 64;
const TEXT_MAX = 128;

const U256_MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const STATUSES = ['signed', 'settled', 'canceled'];

const LEDGER_KEYS = ['from', 'token', 'chain_id', 'nonce', 'to', 'value', 'validAfter', 'validBefore', 'signed_at', 'intent_ref', 'status'];
const EVENT_KEYS = ['authorizer', 'nonce', 'token', 'chain_id'];
const TOP_KEYS = ['ledger', 'used_events', 'canceled_events', 'now_unix'];

const SCOPE_NOTE = 'Reconciles a caller-pasted EIP-3009 authorization ledger against caller-pasted AuthorizationUsed and AuthorizationCanceled event rows on a caller clock: each entry is classified settled, canceled, not-yet-valid, expired-unspent or outstanding, the outstanding exposure is totaled (an entry is outstanding only while validAfter < now < validBefore), and disagreements between the pasted events and the ledger status are listed as discrepancies. All inputs are caller-attested and may be incomplete; the reconciler performs no chain reads, no signature recovery and no digest recomputation, and only the token contract enforces nonce uniqueness on chain. ERC-3009 is a Draft. The classification is not a conformance verdict about any token implementation, not an authorization to move funds and not proof that funds moved.';

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

// ---- field shapes (same acceptance as the sibling gate node's ledger parsing) ----

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

function refusal(code, field, detail) { return { code, field, detail }; }

// Canonical member order for emitted ledger entries: sorting by this tuple makes the whole
// output independent of the caller's ledger array order.
function entryLess(x, y) {
  if (x.nonce !== y.nonce) return x.nonce < y.nonce ? -1 : 1;
  if (x.from !== y.from) return x.from < y.from ? -1 : 1;
  if (x.token !== y.token) return x.token < y.token ? -1 : 1;
  if (x.chain_id !== y.chain_id) return x.chain_id < y.chain_id ? -1 : 1;
  if (x.to !== y.to) return x.to < y.to ? -1 : 1;
  const cv = cmpDec(x.value, y.value);
  if (cv !== 0) return cv;
  const ca = cmpDec(x.validAfter, y.validAfter);
  if (ca !== 0) return ca;
  const cb = cmpDec(x.validBefore, y.validBefore);
  if (cb !== 0) return cb;
  if (x.signed_at !== y.signed_at) return x.signed_at < y.signed_at ? -1 : 1;
  if (x.status !== y.status) return x.status < y.status ? -1 : 1;
  const xi = x.intent_ref == null ? '' : x.intent_ref;
  const yi = y.intent_ref == null ? '' : y.intent_ref;
  if (xi !== yi) return xi < yi ? -1 : 1;
  return 0;
}

function sortEntries(entries) {
  const out = entries.slice();
  for (let i = 1; i < out.length; i++) {
    const cur = out[i];
    let j = i - 1;
    while (j >= 0 && entryLess(cur, out[j]) < 0) { out[j + 1] = out[j]; j--; }
    out[j + 1] = cur;
  }
  return out;
}

// Canonical member order for emitted discrepancy rows.
function discLess(x, y) {
  if (x.code !== y.code) return x.code < y.code ? -1 : 1;
  if (x.authorizer !== y.authorizer) return x.authorizer < y.authorizer ? -1 : 1;
  if (x.nonce !== y.nonce) return x.nonce < y.nonce ? -1 : 1;
  const xt = x.token == null ? '' : x.token;
  const yt = y.token == null ? '' : y.token;
  if (xt !== yt) return xt < yt ? -1 : 1;
  const xc = x.chain_id == null ? '' : x.chain_id;
  const yc = y.chain_id == null ? '' : y.chain_id;
  if (xc !== yc) return xc < yc ? -1 : 1;
  return 0;
}

function sortDiscs(list) {
  const out = list.slice();
  for (let i = 1; i < out.length; i++) {
    const cur = out[i];
    let j = i - 1;
    while (j >= 0 && discLess(cur, out[j]) < 0) { out[j + 1] = out[j]; j--; }
    out[j + 1] = cur;
  }
  return out;
}

// ---- structural validation: wrong shapes are refused, absent inputs are not ----
// Absent event lists and clock are legal and leave their aspects NOT_EVALUATED; present but
// malformed ledger, event or clock shapes are refused INPUT_REFUSED. An explicit null is
// read as absent everywhere an input is optional (null-as-absent), so the two pasted forms
// of "no value" can never diverge.

function validateLedger(pp, r) {
  if (pp.ledger != null && !Array.isArray(pp.ledger)) {
    r.push(refusal('NOT_AN_ARRAY', 'ledger', 'ledger must be an array when present'));
    return;
  }
  if (!Array.isArray(pp.ledger)) return;
  if (pp.ledger.length > LEDGER_MAX) {
    r.push(refusal('BOUND_EXCEEDED', 'ledger', 'the ledger carries at most ' + LEDGER_MAX + ' entries'));
  }
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
    if (toUint256String(e.validAfter) === null) r.push(refusal('BAD_AMOUNT', at + '.validAfter', 'entry validAfter must be a uint256 decimal string'));
    if (toUint256String(e.validBefore) === null) r.push(refusal('BAD_AMOUNT', at + '.validBefore', 'entry validBefore must be a uint256 decimal string'));
    if (toUint256String(e.chain_id) === null) r.push(refusal('BAD_CHAIN_ID', at + '.chain_id', 'entry chain_id must be a uint256 decimal string'));
    if (!isSafeNonNegativeInt(e.signed_at)) r.push(refusal('BAD_CLOCK', at + '.signed_at', 'entry signed_at must be a non-negative integer epoch second'));
    if (STATUSES.indexOf(e.status) < 0) r.push(refusal('BAD_STATUS', at + '.status', 'entry status must be signed, settled or canceled'));
    if (e.intent_ref != null && !isText(e.intent_ref, TEXT_MAX)) r.push(refusal('BAD_TEXT', at + '.intent_ref', 'entry intent_ref must be a 1 to 128 character string without control characters when present'));
  }
}

function validateEvents(pp, name, r) {
  const list = pp[name];
  if (list != null && !Array.isArray(list)) {
    r.push(refusal('NOT_AN_ARRAY', name, name + ' must be an array when present'));
    return;
  }
  if (!Array.isArray(list)) return;
  if (list.length > EVENTS_MAX) {
    r.push(refusal('BOUND_EXCEEDED', name, name + ' carries at most ' + EVENTS_MAX + ' rows'));
  }
  for (let i = 0; i < list.length && i < EVENTS_MAX; i++) {
    const e = list[i];
    const at = name + '[' + i + ']';
    if (!isObj(e)) { r.push(refusal('NOT_AN_OBJECT', at, 'each event row must be an object')); continue; }
    const ek = unknownKeys(e, EVENT_KEYS);
    for (let k = 0; k < ek.length; k++) r.push(refusal('UNKNOWN_FIELD', at + '.' + ek[k], 'field is not part of the input schema'));
    if (normalizeAddress(e.authorizer) === null) r.push(refusal('BAD_ADDRESS', at + '.authorizer', 'event authorizer must be a 20-byte hex address'));
    if (normalizeBytes32(e.nonce) === null) r.push(refusal('BAD_NONCE', at + '.nonce', 'event nonce must be a 32-byte hex value'));
    if (e.token != null && normalizeAddress(e.token) === null) r.push(refusal('BAD_ADDRESS', at + '.token', 'event token must be a 20-byte hex address when present'));
    if (e.chain_id != null && toUint256String(e.chain_id) === null) r.push(refusal('BAD_CHAIN_ID', at + '.chain_id', 'event chain_id must be a uint256 decimal string when present'));
  }
}

function validate(pp) {
  const r = [];
  if (!isObj(pp)) return [refusal('NOT_AN_OBJECT', 'policy_parameters', 'policy_parameters must be an object')];
  const uk = unknownKeys(pp, TOP_KEYS);
  for (let i = 0; i < uk.length; i++) r.push(refusal('UNKNOWN_FIELD', uk[i], 'field is not part of the input schema'));
  if (pp.now_unix != null && !isSafeNonNegativeInt(pp.now_unix)) {
    r.push(refusal('BAD_CLOCK', 'now_unix', 'now_unix must be a non-negative integer epoch second'));
  }
  validateLedger(pp, r);
  validateEvents(pp, 'used_events', r);
  validateEvents(pp, 'canceled_events', r);
  return r;
}

// ---- event application ----

// Returns { hit: boolean[] } over the normalized ledger: which entries the event applies to,
// plus a scope verdict for the discrepancy path.
function resolveEvent(ev, ledger) {
  const matches = [];
  for (let i = 0; i < ledger.length; i++) {
    const e = ledger[i];
    if (e.from !== ev.authorizer) continue;
    if (e.nonce !== ev.nonce) continue;
    if (ev.token !== null && e.token !== ev.token) continue;
    if (ev.chain_id !== null && e.chain_id !== ev.chain_id) continue;
    matches.push(i);
  }
  if (matches.length === 0) return { kind: 'no_entry', matches };
  const pairs = {};
  let distinct = 0;
  for (let m = 0; m < matches.length; m++) {
    const key = ledger[matches[m]].token + '|' + ledger[matches[m]].chain_id;
    if (!pairs[key]) { pairs[key] = true; distinct++; }
  }
  if (distinct > 1) return { kind: 'ambiguous', matches };
  return { kind: 'applied', matches };
}

function eventKey(ev) {
  return ev.authorizer + '|' + ev.nonce + '|' + (ev.token == null ? '' : ev.token) + '|' + (ev.chain_id == null ? '' : ev.chain_id);
}

// ---- compute ----

/**
 * compute(pp) pure exposure-reconciler kernel.
 * pp: {
 *   ledger?:         [ { from, token, chain_id, nonce, to, value, validAfter, validBefore, signed_at,
 *                        intent_ref?, status } ],
 *   used_events?:    [ { authorizer, nonce, token?, chain_id? } ],
 *   canceled_events?: [ { authorizer, nonce, token?, chain_id? } ],
 *   now_unix?:       integer epoch seconds,
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const refusals = validate(pp);
  if (refusals.length > 0) {
    return {
      output_payload: {
        entries: [],
        class_counts: { settled: 0, canceled: 0, expired_unspent: 0, outstanding: 0, not_yet_valid: 0, not_evaluated: 0 },
        exposure: { total_outstanding: null, entries_in_total: null, unresolved_conflict_value: null, unresolved_conflict_entries: 0, not_yet_valid_value: null, not_yet_valid_entries: null, duplicate_nonce_entries: null },
        discrepancies: [],
        not_evaluated: [],
        warnings: ['INPUT_REFUSED'],
        receipt: {
          reconciler: TOOL_ID, ledger_entries: 0, used_events_pasted: 0, canceled_events_pasted: 0,
          used_events_applied: 0, canceled_events_applied: 0, discrepancies_total: 0,
          now_unix: null, scope_note: SCOPE_NOTE,
        },
        refusals,
      },
      compliance_flags: ['INPUT_REFUSED'],
    };
  }

  const hasClock = isSafeNonNegativeInt(pp.now_unix);
  const nowStr = hasClock ? String(pp.now_unix) : null;
  const hasUsed = pp.used_events != null;
  const hasCanceled = pp.canceled_events != null;

  // normalized ledger (same acceptance and canonical forms as the sibling gate)
  const ledgerRaw = Array.isArray(pp.ledger) ? pp.ledger : [];
  const ledger = ledgerRaw.map((e) => ({
    from: normalizeAddress(e.from),
    token: normalizeAddress(e.token),
    chain_id: canonicalDec(toUint256String(e.chain_id)),
    nonce: normalizeBytes32(e.nonce),
    to: normalizeAddress(e.to),
    value: toUint256String(e.value),
    validAfter: toUint256String(e.validAfter),
    validBefore: toUint256String(e.validBefore),
    signed_at: e.signed_at,
    intent_ref: typeof e.intent_ref === 'string' ? e.intent_ref : null,
    status: e.status,
  }));

  const normalizeEvent = (e) => ({
    authorizer: normalizeAddress(e.authorizer),
    nonce: normalizeBytes32(e.nonce),
    token: e.token == null ? null : normalizeAddress(e.token),
    chain_id: e.chain_id == null ? null : canonicalDec(toUint256String(e.chain_id)),
  });
  const usedRaw = Array.isArray(pp.used_events) ? pp.used_events : [];
  const canceledRaw = Array.isArray(pp.canceled_events) ? pp.canceled_events : [];
  const usedEvents = usedRaw.map(normalizeEvent);
  const canceledEvents = canceledRaw.map(normalizeEvent);

  const discrepancies = [];
  const usedHit = ledger.map(() => false);
  const canceledHit = ledger.map(() => false);
  let usedApplied = 0;
  let canceledApplied = 0;

  // apply one event list; duplicates inside a list are flagged and not re-applied
  function applyList(events, hitArr, code, isUsed) {
    const seen = {};
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const key = eventKey(ev);
      if (seen[key]) {
        discrepancies.push({
          code: 'DUPLICATE_EVENT_ROW', authorizer: ev.authorizer, nonce: ev.nonce,
          token: ev.token, chain_id: ev.chain_id, ledger_status: null,
          observed: 'the same ' + code + ' row is pasted more than once; only the first row is applied',
        });
        continue;
      }
      seen[key] = true;
      const res = resolveEvent(ev, ledger);
      if (res.kind === 'no_entry') {
        discrepancies.push({
          code: 'EVENT_WITHOUT_LEDGER_ENTRY', authorizer: ev.authorizer, nonce: ev.nonce,
          token: ev.token, chain_id: ev.chain_id, ledger_status: null,
          observed: code + ' row matches no ledger entry with this authorizer and nonce',
        });
      } else if (res.kind === 'ambiguous') {
        discrepancies.push({
          code: 'AMBIGUOUS_EVENT_SCOPE', authorizer: ev.authorizer, nonce: ev.nonce,
          token: ev.token, chain_id: ev.chain_id, ledger_status: null,
          observed: 'event row without a declared token or chain scope matches ledger entries spanning more than one token and chain pair, so it is applied to none of them',
        });
      } else {
        let fresh = false;
        for (let m = 0; m < res.matches.length; m++) {
          if (!hitArr[res.matches[m]]) { hitArr[res.matches[m]] = true; fresh = true; }
        }
        if (fresh) { if (isUsed) usedApplied++; else canceledApplied++; }
      }
    }
  }

  applyList(usedEvents, usedHit, 'AuthorizationUsed', true);
  applyList(canceledEvents, canceledHit, 'AuthorizationCanceled', false);

  // duplicate ledger identity: only one authorization per (authorizer, token, chain, nonce) can
  // ever settle, so the first entry in canonical sort order is evaluated and the extras are not
  const order = ledger.map((_, i) => i);
  for (let a = 1; a < order.length; a++) {
    const cur = order[a];
    let b = a - 1;
    while (b >= 0 && entryLess(ledger[cur], ledger[order[b]]) < 0) { order[b + 1] = order[b]; b--; }
    order[b + 1] = cur;
  }
  const dupExtra = ledger.map(() => false);
  const seenIdentity = {};
  for (let a = 0; a < order.length; a++) {
    const e = ledger[order[a]];
    const k = e.from + '|' + e.token + '|' + e.chain_id + '|' + e.nonce;
    if (seenIdentity[k]) dupExtra[order[a]] = true; else seenIdentity[k] = true;
  }

  // per-entry classification (caller order; sorted for emission below)
  const classOf = [];
  const entryDiscs = [];
  const notEvaluatedBecause = [];
  for (let i = 0; i < ledger.length; i++) {
    const e = ledger[i];
    const discs = [];
    let cls;
    let because = null;
    if (dupExtra[i]) {
      cls = 'not_evaluated';
      because = 'another ledger entry with the same authorizer, token, chain and nonce sorts first and is the only one counted';
      discs.push('DUPLICATE_NONCE_LEDGER');
    } else if (usedHit[i] && canceledHit[i]) {
      cls = 'not_evaluated';
      because = 'pasted rows carry both a use event and a cancel event for this identity, and the pasted rows cannot be ordered';
      discs.push('EVENT_CONFLICT');
    } else if (usedHit[i]) {
      cls = 'settled';
      if (e.status === 'signed') discs.push('LEDGER_SAYS_SIGNED_EVENTS_SETTLED');
      else if (e.status === 'canceled') discs.push('LEDGER_SAYS_CANCELED_EVENTS_SETTLED');
    } else if (canceledHit[i]) {
      cls = 'canceled';
      if (e.status === 'signed') discs.push('LEDGER_SAYS_SIGNED_EVENTS_CANCELED');
      else if (e.status === 'settled') discs.push('LEDGER_SAYS_SETTLED_EVENTS_CANCELED');
    } else if (e.status === 'settled') {
      cls = 'settled';
    } else if (e.status === 'canceled') {
      cls = 'canceled';
    } else {
      // ledger says signed and no event applies: the caller clock splits outstanding from
      // expired-unspent (strict window rule: live only while the clock is below validBefore)
      if (nowStr === null) {
        cls = 'not_evaluated';
        because = 'caller clock absent: a signed entry cannot be split between outstanding and expired-unspent';
      } else if (cmpDec(e.validAfter, nowStr) >= 0) {
        cls = 'not_yet_valid';
      } else if (cmpDec(e.validBefore, nowStr) > 0) {
        cls = 'outstanding';
      } else {
        cls = 'expired_unspent';
      }
    }
    classOf.push(cls);
    entryDiscs.push(discs);
    notEvaluatedBecause.push(because);
    for (let d = 0; d < discs.length; d++) {
      discrepancies.push({
        code: discs[d], authorizer: e.from, nonce: e.nonce,
        token: e.token, chain_id: e.chain_id, ledger_status: e.status,
        observed: discs[d] === 'DUPLICATE_NONCE_LEDGER'
          ? 'this entry repeats the authorizer, token, chain and nonce of an earlier entry in canonical order; only that first entry is evaluated and counted'
          : discs[d] === 'EVENT_CONFLICT'
          ? 'pasted rows carry both a use event and a cancel event for this identity, so the terminal state cannot be reconciled'
          : 'reconciled class ' + cls + ' disagrees with the ledger status ' + e.status,
      });
    }
  }

  // class counts and exposure totals
  const classCounts = { settled: 0, canceled: 0, expired_unspent: 0, outstanding: 0, not_yet_valid: 0, not_evaluated: 0 };
  let nyvSum = '0';
  let nyvCount = 0;
  let dupCount = 0;
  let outstandingSum = '0';
  let outstandingCount = 0;
  let conflictSum = '0';
  let conflictCount = 0;
  let clockBlocked = false;
  for (let i = 0; i < ledger.length; i++) {
    classCounts[classOf[i]]++;
    if (classOf[i] === 'outstanding') {
      outstandingSum = addDec(outstandingSum, ledger[i].value);
      outstandingCount++;
    } else if (classOf[i] === 'not_yet_valid') {
      nyvSum = addDec(nyvSum, ledger[i].value);
      nyvCount++;
    } else if (classOf[i] === 'not_evaluated') {
      if (dupExtra[i]) {
        dupCount++;
      } else if (usedHit[i] && canceledHit[i]) {
        conflictSum = addDec(conflictSum, ledger[i].value);
        conflictCount++;
      } else {
        clockBlocked = true;
      }
    }
  }
  const exposure = {
    total_outstanding: clockBlocked ? null : outstandingSum,
    entries_in_total: clockBlocked ? null : outstandingCount,
    unresolved_conflict_value: conflictCount > 0 ? conflictSum : '0',
    unresolved_conflict_entries: conflictCount,
    not_yet_valid_value: nyvSum,
    not_yet_valid_entries: nyvCount,
    duplicate_nonce_entries: dupCount,
  };

  // top-level NOT_EVALUATED aspects, fixed order
  const notEvaluated = [];
  if (!hasUsed) notEvaluated.push({ aspect: 'used_events', because: 'input absent: no use event rows were supplied, so use-event reconciliation is not evaluated' });
  if (!hasCanceled) notEvaluated.push({ aspect: 'canceled_events', because: 'input absent: no cancel event rows were supplied, so cancel-event reconciliation is not evaluated' });
  if (!hasClock) notEvaluated.push({ aspect: 'now_unix', because: 'input absent: caller clock missing, so expiry classification and the outstanding total are not evaluated' });

  // emitted entries in canonical order
  const emitted = [];
  for (let i = 0; i < ledger.length; i++) {
    emitted.push({
      from: ledger[i].from,
      token: ledger[i].token,
      chain_id: ledger[i].chain_id,
      nonce: ledger[i].nonce,
      to: ledger[i].to,
      value: ledger[i].value,
      validAfter: ledger[i].validAfter,
      validBefore: ledger[i].validBefore,
      signed_at: ledger[i].signed_at,
      intent_ref: ledger[i].intent_ref,
      ledger_status: ledger[i].status,
      class: classOf[i],
      used_event_applied: usedHit[i],
      canceled_event_applied: canceledHit[i],
      discrepancies: entryDiscs[i],
      not_evaluated_because: notEvaluatedBecause[i],
    });
  }
  const sortedEntries = sortEntries(emitted);
  const sortedDiscs = sortDiscs(discrepancies);

  // conditional flags (computed, never literal) and the warnings mirror
  const compliance_flags = [];
  if (sortedDiscs.length > 0) compliance_flags.push('LEDGER_EVENT_DISCREPANCY');
  if (conflictCount > 0) compliance_flags.push('EVENT_DATA_CONFLICT');
  if (notEvaluated.length > 0 || classCounts.not_evaluated > 0) compliance_flags.push('INPUT_ASPECT_NOT_EVALUATED');
  if (exposure.total_outstanding !== null && exposure.total_outstanding !== '0') compliance_flags.push('OUTSTANDING_EXPOSURE_PRESENT');
  const warnings = compliance_flags.slice();

  const receipt = {
    reconciler: TOOL_ID,
    ledger_entries: ledger.length,
    used_events_pasted: usedEvents.length,
    canceled_events_pasted: canceledEvents.length,
    used_events_applied: usedApplied,
    canceled_events_applied: canceledApplied,
    discrepancies_total: sortedDiscs.length,
    now_unix: hasClock ? pp.now_unix : null,
    scope_note: SCOPE_NOTE,
  };

  return {
    output_payload: {
      entries: sortedEntries,
      class_counts: classCounts,
      exposure,
      discrepancies: sortedDiscs,
      not_evaluated: notEvaluated,
      warnings,
      receipt,
      refusals: [],
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
