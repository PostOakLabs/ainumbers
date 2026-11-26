import { executionHash } from './_hash.mjs';

// art-843-tap-message-validator: structural check of pasted Transaction Authorization Protocol messages
// against hand-walked copies of the public TAIPs JSON Schemas (commit-pinned, see the node shard).
// Pure function of pp: no clock, no network, no filesystem, no schema library, no signature maths.

const TOOL_ID = 'art-843-tap-message-validator';
const TOOL_VERSION = '1.0.0';
const TAIPS_COMMIT = 'c160ae573a981828b5f8d589cda0493b04bdda95';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_tap_message',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_MESSAGES = 32;
const MAX_DEPTH = 8;

// ---- primitive formats (patterns copied from schemas/common at the pinned commit) ----
const RE = {
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  did: /^did:[a-z0-9]+:.+$/,
  iri: /^[a-zA-Z][a-zA-Z0-9+.-]*:.+$/,
  amount: /^[0-9]+(\.[0-9]+)?$/,
  ccy: /^[A-Z]{3}$/,
  lei: /^[A-Z0-9]{20}$/,
  base64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
  caip10: /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}:[a-zA-Z0-9]{1,64}$/,
  caip19: /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}\/[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,64}$/,
  caip220: /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}:[a-zA-Z0-9]{1,64}@[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}\/[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,64}$/,
  payto: /^payto:\/\/[a-z0-9]+\/[^?#]+(\?[^#]*)?(#.*)?$/,
  settleId: /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}:(tx|txn)\/[-%a-zA-Z0-9]{1,128}$/,
  uri: /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]+$/,
  mcc: /^[0-9]{4}$/,
  role: /^[A-Z][a-zA-Z]*$/,
  code4: /^[A-Z0-9]{4}$/,
  typeUri: /^https:\/\/tap\.rsvp\/schema\/[0-9]+\.[0-9]+#[A-Za-z]+$/,
  dateTime: /^([0-9]{4})-([0-9]{2})-([0-9]{2})[Tt]([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]+)?([Zz]|[+-]([0-9]{2}):([0-9]{2}))$/,
  syntheticMarker: /^\[len:[0-9]{1,6}\]$/,
  safeKey: /^[A-Za-z0-9_@:.-]{1,40}$/,
};

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function seg(k) { return RE.safeKey.test(k) ? k : '(key)'; }
function sortedKeys(o) { return Object.keys(o).sort(); }

// Gregorian calendar: leap year when divisible by 4, except centuries not divisible by 400.
function daysInMonth(y, mo) {
  if (mo === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return mo === 4 || mo === 6 || mo === 9 || mo === 11 ? 30 : 31;
}

function okDateTime(s) {
  const m = RE.dateTime.exec(s);
  if (m === null) return false;
  const mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], se = +m[6];
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || se > 60) return false;
  if (d > daysInMonth(+m[1], mo)) return false;
  if (m[9] !== undefined && (+m[9] > 23 || +m[10] > 59)) return false;
  return true;
}

const FORMAT = {
  uuid: (s) => RE.uuid.test(s),
  did: (s) => RE.did.test(s),
  didOrIri: (s) => RE.did.test(s) || (RE.iri.test(s) && s.slice(0, 4) !== 'did:'),
  amount: (s) => RE.amount.test(s),
  ccy: (s) => RE.ccy.test(s),
  lei: (s) => RE.lei.test(s),
  base64: (s) => RE.base64.test(s),
  caip19: (s) => RE.caip19.test(s),
  caip220: (s) => RE.caip220.test(s),
  settlementAddress: (s) => RE.caip10.test(s) || RE.payto.test(s),
  settleId: (s) => RE.settleId.test(s),
  uri: (s) => RE.uri.test(s),
  mcc: (s) => RE.mcc.test(s),
  role: (s) => RE.role.test(s),
  code4: (s) => RE.code4.test(s),
  dateTime: okDateTime,
};

// ---- message type registry: the seven types whose schemas are pinned ----
const HDR = 'https://tap.rsvp/schema/1.0#';
const LEGACY = 'https://taprsvp.com/034.56.789/protocols/transaction-authorization-protocol/1.0/';
const CTX = 'https://tap.rsvp/schema/1.0';

// Field spec: a format name string, or { t: kind, ... }.
const PARTY = { t: 'party' };
const AGENTS = { t: 'agents' };
const jsonLd = (name) => ({ '@context': { t: 'const', v: CTX }, '@type': { t: 'const', v: HDR + name } });

const TYPES = {
  Transfer: {
    schema: 'schemas/messages/transfer.json', taip: 'TAIP-3', uris: [HDR + 'Transfer', LEGACY + 'transfer'],
    open: true,
    required: ['asset', 'amount', 'settlementAddress', 'agents'],
    props: {
      '@context': { t: 'any' }, '@type': { t: 'any' },
      asset: 'caip19', assetId: 'caip220', amount: 'amount', settlementAddress: 'settlementAddress',
      originator: PARTY, beneficiary: PARTY, agents: AGENTS, constraints: { t: 'uncovered' },
      purpose: { t: 'string' }, memo: { t: 'free' },
      exchangeRate: { t: 'exchangeRate' }, transactionValue: { t: 'transactionValue' },
    },
  },
  Payment: {
    schema: 'schemas/messages/payment.json', taip: 'TAIP-14', uris: [HDR + 'Payment'],
    open: false,
    required: ['@context', '@type', 'amount', 'merchant', 'agents'],
    oneOf: ['asset', 'currency'],
    props: Object.assign(jsonLd('Payment'), {
      asset: 'caip19', currency: 'ccy', supportedAssets: { t: 'list', of: 'caip19' },
      fallbackSettlementAddresses: { t: 'list', of: 'settlementAddress' }, expiry: 'dateTime', amount: 'amount',
      invoice: { t: 'invoice' }, policies: { t: 'uncovered' }, customer: PARTY, merchant: PARTY, agents: AGENTS,
    }),
  },
  Authorize: {
    schema: 'schemas/messages/authorize.json', taip: 'TAIP-4', uris: [HDR + 'Authorize'],
    open: false, required: ['@context', '@type'],
    props: Object.assign(jsonLd('Authorize'), {
      settlementAddress: 'settlementAddress', settlementAsset: 'caip19', amount: 'amount', expiry: 'dateTime',
    }),
  },
  Reject: {
    schema: 'schemas/messages/reject.json', taip: 'TAIP-4', uris: [HDR + 'Reject'],
    open: false, required: ['@context', '@type'],
    props: Object.assign(jsonLd('Reject'), { reason: { t: 'free' }, code: 'code4' }),
  },
  Settle: {
    schema: 'schemas/messages/settle.json', taip: 'TAIP-4', uris: [HDR + 'Settle'],
    open: false, required: ['@context', '@type', 'settlementAddress'],
    props: Object.assign(jsonLd('Settle'), { settlementAddress: 'settlementAddress', settlementId: 'settleId', amount: 'amount' }),
  },
  Cancel: {
    schema: 'schemas/messages/cancel.json', taip: 'TAIP-4', uris: [HDR + 'Cancel', LEGACY + 'cancel'],
    open: true, required: ['reason', 'by'],
    props: {
      '@context': { t: 'any' }, '@type': { t: 'any' },
      reason: { t: 'free' }, reasonCode: { t: 'string' }, by: 'did', details: { t: 'freeobj' }, timestamp: 'dateTime',
    },
  },
  Revert: {
    schema: 'schemas/messages/revert.json', taip: 'TAIP-4', uris: [HDR + 'Revert'],
    open: false, required: ['@context', '@type', 'settlementAddress', 'reason'],
    props: Object.assign(jsonLd('Revert'), { settlementAddress: 'settlementAddress', reason: { t: 'free' } }),
  },
};
const TYPE_NAMES = Object.keys(TYPES);

// didcommHeader (schemas/common/didcomm-base.json): keys the schema names; all others are open extras.
const HEADER_KEYS = ['@context', 'id', 'type', 'thid', 'from', 'to', 'created_time', 'expires_time', 'please_ack', 'ack', 'body', 'attachments'];
const SIGNATURE_KEYS = ['signature', 'signatures', 'protected', 'jws'];

// IVMS101 zero-PII skeleton contract (same rule as the Travel Rule skeleton node): a string leaf is allowed
// only as a code-list value for a known code key, the literal "SYNTHETIC", or a length marker "[len:N]".
const IVMS_CODES = {
  nameIdentifierType: /^(ALIAS|BIRT|MAID|LEGL|SHRT|TRAD|LGNM|MISC)$/,
  addressType: /^(HOME|BIZZ|GEOG)$/,
  country: /^[A-Z]{2}$/, countryOfResidence: /^[A-Z]{2}$/, countryOfRegistration: /^[A-Z]{2}$/, issuingCountry: /^[A-Z]{2}$/,
  customerIdentificationType: /^(ARNU|CCPT|RAID|DRLC|FIIN|TXID|SOCS|IDCD|LEIX|MISC)$/,
};

function skeletonLeaf(key, v) {
  if (typeof v !== 'string') return false;
  if (v === 'SYNTHETIC' || RE.syntheticMarker.test(v)) return true;
  return Object.hasOwn(IVMS_CODES, key) && IVMS_CODES[key].test(v);
}

// Returns true when every leaf under node satisfies the skeleton rule; false otherwise (depth capped).
function skeletonOk(node, key, depth) {
  if (depth > MAX_DEPTH) return false;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) if (!skeletonOk(node[i], key, depth + 1)) return false;
    return true;
  }
  if (isObj(node)) {
    const ks = sortedKeys(node);
    for (let i = 0; i < ks.length; i++) if (!skeletonOk(node[ks[i]], ks[i], depth + 1)) return false;
    return true;
  }
  return skeletonLeaf(key, node);
}

// Hashability walk: the first value the shared _hash.mjs refuses before canonicalizing,
// mirroring the classes of its assertIJson() exactly (a non-finite value or an integer
// outside the 2^53 safe range: RFC 8785 3.2.2.3 / RFC 7493; nesting past its MAX_DEPTH;
// more values than its MAX_ELEMENTS), reported as { reason, detail } with the path and kind
// only, never the value; null when the whole subtree is safe to hash. compute() refuses a
// hit with the named reason before any artifact is built, and buildArtifact() re-runs the
// walk over the exact execution_hash preimage so it mints a refusal artifact instead of
// letting the hash throw. The shared _hash.mjs itself stays untouched.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS
// pp alone is held to tighter margins than the preimage limits: the {policy_parameters,
// output_payload} envelope wraps pp two levels deeper, and a report output_payload can
// carry several values per input value (findings, unexpected_fields), so a pp inside these
// margins keeps every envelope this kernel can build inside the canonicalizer limits.
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'input_hash_limit_refused', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'input_hash_limit_refused', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'unsafe_number_refused', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'unsafe_number_refused', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (isObj(v)) {
    const ks = sortedKeys(v);
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + seg(ks[i]), depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

function refuse(reason, detail) {
  // Flag earned by a stated refusal reason (conditional emission).
  const compliance_flags = [];
  if (reason) compliance_flags.push('INPUT_REFUSED');
  return {
    output_payload: { status: 'refused', reason, detail, warnings: compliance_flags.slice() },
    compliance_flags,
  };
}

// ---- walker ----
// ctx: { findings, unexpected, nameHashes, refusal }
function add(ctx, path, code) { ctx.findings.push({ path, code }); }

function checkFormat(ctx, fmt, v, path) {
  if (typeof v !== 'string') { add(ctx, path, 'WRONG_TYPE'); return; }
  if (!Object.hasOwn(FORMAT, fmt) || !FORMAT[fmt](v)) add(ctx, path, 'BAD_FORMAT');
}

function checkFree(ctx, v, path) {
  if (typeof v !== 'string') { add(ctx, path, 'WRONG_TYPE'); return; }
  if (v !== 'SYNTHETIC' && !RE.syntheticMarker.test(v) && ctx.refusal === null) ctx.refusal = { reason: 'free_text_leaf_refused', detail: path };
}

function checkObjectKeys(ctx, obj, known, path, forbidExtras) {
  const ks = sortedKeys(obj);
  for (let i = 0; i < ks.length; i++) {
    if (known.indexOf(ks[i]) === -1) {
      ctx.unexpected.push({ path: path + '.' + seg(ks[i]), schema_forbids: forbidExtras });
      checkSkeleton(ctx, obj[ks[i]], ks[i], path + '.' + seg(ks[i]));
    }
  }
}

// Zero-PII rule for a value the schema walk does not format-check: every string leaf must satisfy the skeleton rule.
function checkSkeleton(ctx, v, key, path) {
  if (!skeletonOk(v, key, 0) && ctx.refusal === null) ctx.refusal = { reason: 'free_text_leaf_refused', detail: path };
}

function checkParty(ctx, v, path, isAgent) {
  if (!isObj(v)) { add(ctx, path, 'WRONG_TYPE'); return; }
  const known = ['@id', '@type', 'lei:leiCode', 'name', 'nameHash', 'ivms101', 'mcc', 'url', 'logo', 'description', 'email', 'telephone'];
  if (isAgent) known.push('role', 'for', 'policies');
  if (v['@id'] == null) add(ctx, path + '.@id', 'MISSING_REQUIRED');
  else checkFormat(ctx, isAgent ? 'did' : 'didOrIri', v['@id'], path + '.@id');
  if (v['@type'] !== undefined) {
    const want = isAgent ? 'Agent' : 'Party';
    if (typeof v['@type'] !== 'string') add(ctx, path + '.@type', 'WRONG_TYPE');
    else if (v['@type'] !== want && !FORMAT.uri(v['@type'])) add(ctx, path + '.@type', 'BAD_FORMAT');
  }
  if (v['lei:leiCode'] !== undefined) checkFormat(ctx, 'lei', v['lei:leiCode'], path + '.lei:leiCode');
  if (v.nameHash !== undefined) {
    checkFormat(ctx, 'base64', v.nameHash, path + '.nameHash');
    if (typeof v.nameHash === 'string' && FORMAT.base64(v.nameHash)) {
      const pad = v.nameHash.endsWith('==') ? 2 : v.nameHash.endsWith('=') ? 1 : 0;
      ctx.nameHashes.push({ path: path + '.nameHash', decoded_bytes: (v.nameHash.length / 4) * 3 - pad });
    }
  }
  if (v.mcc !== undefined) checkFormat(ctx, 'mcc', v.mcc, path + '.mcc');
  if (v.url !== undefined) checkFormat(ctx, 'uri', v.url, path + '.url');
  if (v.logo !== undefined) checkFormat(ctx, 'uri', v.logo, path + '.logo');
  for (const k of ['name', 'description', 'email', 'telephone']) if (v[k] !== undefined) checkFree(ctx, v[k], path + '.' + k);
  if (v.ivms101 !== undefined) {
    if (!isObj(v.ivms101)) add(ctx, path + '.ivms101', 'WRONG_TYPE');
    else if (!skeletonOk(v.ivms101, 'ivms101', 0) && ctx.refusal === null) ctx.refusal = { reason: 'ivms101_non_skeleton_leaf_refused', detail: path + '.ivms101' };
  }
  if (isAgent) {
    if (v.role !== undefined) checkFormat(ctx, 'role', v.role, path + '.role');
    if (v['for'] !== undefined) {
      if (Array.isArray(v['for'])) {
        if (v['for'].length < 1) add(ctx, path + '.for', 'MIN_ITEMS');
        for (let i = 0; i < v['for'].length; i++) checkFormat(ctx, 'did', v['for'][i], path + '.for[' + i + ']');
      } else checkFormat(ctx, 'did', v['for'], path + '.for');
    }
    if (v.policies !== undefined && ctx.refusal === null) ctx.refusal = { reason: 'uncovered_subtree_refused', detail: path + '.policies' };
  }
  checkObjectKeys(ctx, v, known, path, false);
}

function checkField(ctx, spec, v, path) {
  if (typeof spec === 'string') { checkFormat(ctx, spec, v, path); return; }
  switch (spec.t) {
    case 'any':
      // JSON-LD @context / @type: a URI-shaped string passes, anything else must satisfy the skeleton rule.
      if (!(typeof v === 'string' && FORMAT.uri(v))) checkSkeleton(ctx, v, path, path);
      return;
    case 'string':
      if (typeof v !== 'string') add(ctx, path, 'WRONG_TYPE');
      else checkFree(ctx, v, path);
      return;
    case 'free': checkFree(ctx, v, path); return;
    case 'const':
      if (typeof v !== 'string') add(ctx, path, 'WRONG_TYPE');
      else if (v !== spec.v) add(ctx, path, 'BAD_CONST');
      return;
    case 'party': checkParty(ctx, v, path, false); return;
    case 'agents':
      if (!Array.isArray(v)) { add(ctx, path, 'WRONG_TYPE'); return; }
      if (v.length < 1) add(ctx, path, 'MIN_ITEMS');
      for (let i = 0; i < v.length; i++) checkParty(ctx, v[i], path + '[' + i + ']', true);
      return;
    case 'list':
      if (!Array.isArray(v)) { add(ctx, path, 'WRONG_TYPE'); return; }
      for (let i = 0; i < v.length; i++) checkFormat(ctx, spec.of, v[i], path + '[' + i + ']');
      return;
    case 'freeobj':
      if (!isObj(v)) add(ctx, path, 'WRONG_TYPE');
      else if (!skeletonOk(v, 'details', 0) && ctx.refusal === null) ctx.refusal = { reason: 'free_text_leaf_refused', detail: path };
      return;
    case 'uncovered':
      if (ctx.refusal === null) ctx.refusal = { reason: 'uncovered_subtree_refused', detail: path };
      return;
    case 'invoice':
      if (typeof v === 'string') { if (!FORMAT.uri(v)) add(ctx, path, 'BAD_FORMAT'); }
      else if (ctx.refusal === null) ctx.refusal = { reason: 'uncovered_subtree_refused', detail: path };
      return;
    case 'exchangeRate':
      if (!isObj(v)) { add(ctx, path, 'WRONG_TYPE'); return; }
      if (v.rate !== undefined && (typeof v.rate !== 'number' || !(v.rate > 0))) add(ctx, path + '.rate', typeof v.rate !== 'number' ? 'WRONG_TYPE' : 'BAD_FORMAT');
      if (v.from !== undefined) checkFormat(ctx, 'ccy', v.from, path + '.from');
      if (v.to !== undefined) checkFormat(ctx, 'ccy', v.to, path + '.to');
      checkObjectKeys(ctx, v, ['rate', 'from', 'to'], path, false);
      return;
    case 'transactionValue':
      if (!isObj(v)) { add(ctx, path, 'WRONG_TYPE'); return; }
      if (v.amount == null) add(ctx, path + '.amount', 'MISSING_REQUIRED'); else checkFormat(ctx, 'amount', v.amount, path + '.amount');
      if (v.currency == null) add(ctx, path + '.currency', 'MISSING_REQUIRED'); else checkFormat(ctx, 'ccy', v.currency, path + '.currency');
      checkObjectKeys(ctx, v, ['amount', 'currency'], path, false);
      return;
    default: add(ctx, path, 'WRONG_TYPE');
  }
}

function checkBody(ctx, def, body) {
  if (!isObj(body)) { add(ctx, 'body', 'WRONG_TYPE'); return; }
  for (let i = 0; i < def.required.length; i++) if (body[def.required[i]] == null) add(ctx, 'body.' + def.required[i], 'MISSING_REQUIRED');
  if (def.oneOf) {
    let n = 0;
    for (let i = 0; i < def.oneOf.length; i++) if (body[def.oneOf[i]] !== undefined) n++;
    if (n !== 1) add(ctx, 'body', 'ONE_OF_VIOLATION');
  }
  const ks = sortedKeys(body);
  for (let i = 0; i < ks.length; i++) {
    if (Object.hasOwn(def.props, ks[i])) checkField(ctx, def.props[ks[i]], body[ks[i]], 'body.' + seg(ks[i]));
  }
  checkObjectKeys(ctx, body, Object.keys(def.props), 'body', !def.open);
}

function checkMessage(msg, index) {
  const ctx = { findings: [], unexpected: [], nameHashes: [], refusal: null };
  const rec = {
    index, message_type: null, type_uri_form: null, coverage: 'not_covered', schema: null, taip: null,
    findings: [], unexpected_fields: [], name_hash_checks: [], signature_material: 'absent',
  };
  // header
  if (msg.id == null) add(ctx, 'id', 'MISSING_REQUIRED'); else checkFormat(ctx, 'uuid', msg.id, 'id');
  if (msg.type == null) add(ctx, 'type', 'MISSING_REQUIRED');
  if (msg.thid !== undefined) checkFormat(ctx, 'uuid', msg.thid, 'thid');
  if (msg.from !== undefined) checkFormat(ctx, 'did', msg.from, 'from');
  if (msg.to !== undefined) {
    if (!Array.isArray(msg.to)) add(ctx, 'to', 'WRONG_TYPE');
    else {
      if (msg.to.length < 1) add(ctx, 'to', 'MIN_ITEMS');
      for (let i = 0; i < msg.to.length; i++) checkFormat(ctx, 'did', msg.to[i], 'to[' + i + ']');
    }
  }
  if (msg.created_time !== undefined) checkFormat(ctx, 'dateTime', msg.created_time, 'created_time');
  if (msg.expires_time !== undefined) checkFormat(ctx, 'dateTime', msg.expires_time, 'expires_time');
  if (msg.please_ack !== undefined && typeof msg.please_ack !== 'boolean') add(ctx, 'please_ack', 'WRONG_TYPE');
  if (msg.ack !== undefined) {
    if (!Array.isArray(msg.ack)) add(ctx, 'ack', 'WRONG_TYPE');
    else for (let i = 0; i < msg.ack.length; i++) checkFormat(ctx, 'uuid', msg.ack[i], 'ack[' + i + ']');
  }
  if (msg.attachments !== undefined) {
    if (!Array.isArray(msg.attachments)) add(ctx, 'attachments', 'WRONG_TYPE');
    else if (msg.attachments.length > 0 && ctx.refusal === null) ctx.refusal = { reason: 'uncovered_subtree_refused', detail: 'attachments' };
  }
  const topKeys = sortedKeys(msg);
  for (let i = 0; i < topKeys.length; i++) {
    if (SIGNATURE_KEYS.indexOf(topKeys[i]) !== -1) rec.signature_material = 'present_not_verified';
    else if (HEADER_KEYS.indexOf(topKeys[i]) === -1) {
      ctx.unexpected.push({ path: seg(topKeys[i]), schema_forbids: false });
      checkSkeleton(ctx, msg[topKeys[i]], topKeys[i], seg(topKeys[i]));
    }
  }
  // type dispatch
  let def = null;
  if (typeof msg.type === 'string') {
    for (let i = 0; i < TYPE_NAMES.length && def === null; i++) {
      const t = TYPES[TYPE_NAMES[i]];
      const u = t.uris.indexOf(msg.type);
      if (u !== -1) { def = t; rec.message_type = TYPE_NAMES[i]; rec.type_uri_form = u === 0 ? 'header_pattern' : 'schema_const'; }
    }
    if (def === null && !RE.typeUri.test(msg.type)) add(ctx, 'type', 'BAD_FORMAT');
  } else if (msg.type != null) add(ctx, 'type', 'WRONG_TYPE');
  if (def !== null) {
    rec.coverage = 'covered'; rec.schema = def.schema; rec.taip = def.taip;
    if (msg.body == null) add(ctx, 'body', 'MISSING_REQUIRED'); else checkBody(ctx, def, msg.body);
  } else if (msg.body !== undefined) {
    // body of an uncovered type is never walked; its leaves are not inspected, so refuse anything with strings in it
    if (!skeletonOk(msg.body, 'body', 0) && ctx.refusal === null) {
      ctx.refusal = { reason: 'uncovered_subtree_refused', detail: 'body' };
    }
  }
  const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  rec.findings = ctx.findings.sort(byPath);
  rec.unexpected_fields = ctx.unexpected.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  rec.name_hash_checks = ctx.nameHashes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { rec, refusal: ctx.refusal };
}

/**
 * compute(pp): pp.messages is an array (1..32) of pasted TAP messages, in arrival order.
 */
export function compute(pp) {
  pp = pp || {};
  // Hashability first, before any other refusal: an unsafe integer or a non-finite number
  // anywhere in pp (exchangeRate.rate takes any finite number, and JSON 1e999 parses to
  // Infinity), or a shape past the canonicalizer's depth or size limits, sails through the
  // schema walk while the artifact hash refuses it. Refusing it at the very top means the
  // same named refusal fires whatever else is wrong with pp (a missing messages array
  // would otherwise shadow an unhashable value elsewhere in the document); only the path
  // and kind are echoed, never the value.
  const unhashable = findHashRefusal(pp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
  if (unhashable !== null) return refuse(unhashable.reason, unhashable.detail);
  const msgs = pp.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return refuse('messages_missing', 'messages must be a non-empty array');
  if (msgs.length > MAX_MESSAGES) return refuse('messages_too_many', 'at most ' + MAX_MESSAGES + ' messages');
  const records = [];
  for (let i = 0; i < msgs.length; i++) {
    if (!isObj(msgs[i])) return refuse('message_not_object', 'message ' + i);
    const r = checkMessage(msgs[i], i);
    if (r.refusal !== null) return refuse(r.refusal.reason, 'message ' + i + ' at ' + r.refusal.detail);
    records.push(r.rec);
  }

  // thread walk: a reply names (thid) an id carried by an EARLIER message in the pasted set
  const idsSeen = [];
  const dangling = [];
  const missing_thid = [];
  const duplicate_ids = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const name = records[i].message_type;
    const replyType = name !== null && name !== 'Transfer' && name !== 'Payment';
    if (typeof m.id === 'string' && idsSeen.indexOf(m.id) !== -1) duplicate_ids.push(i);
    if (m.thid != null) {
      if (typeof m.thid === 'string' && idsSeen.indexOf(m.thid) === -1 && m.thid !== m.id) dangling.push(i);
    } else if (replyType) missing_thid.push(i);
    if (typeof m.id === 'string') idsSeen.push(m.id);
  }
  const thread = {
    checked: msgs.length > 1,
    dangling_reply_indexes: msgs.length > 1 ? dangling : [],
    missing_thid_indexes: msgs.length > 1 ? missing_thid : [],
    duplicate_id_indexes: duplicate_ids,
  };

  const compliance_flags = [];
  const withFindings = records.filter((r) => r.findings.length > 0).length;
  const notCovered = records.filter((r) => r.coverage === 'not_covered').length;
  const withExtras = records.filter((r) => r.unexpected_fields.length > 0).length;
  const sigs = records.filter((r) => r.signature_material === 'present_not_verified').length;
  if (withFindings > 0) compliance_flags.push('TAP_STRUCTURE_FINDINGS');
  if (thread.dangling_reply_indexes.length > 0) compliance_flags.push('TAP_THREAD_DANGLING_REPLY');
  if (thread.missing_thid_indexes.length > 0) compliance_flags.push('TAP_THREAD_REPLY_WITHOUT_THID');
  if (thread.duplicate_id_indexes.length > 0) compliance_flags.push('TAP_DUPLICATE_MESSAGE_ID');
  if (notCovered > 0) compliance_flags.push('TAP_TYPE_NOT_COVERED');
  if (withExtras > 0) compliance_flags.push('TAP_UNEXPECTED_FIELDS');
  if (sigs > 0) compliance_flags.push('TAP_SIGNATURE_NOT_VERIFIED');
  const warnings = compliance_flags.slice();

  return {
    output_payload: {
      status: 'report',
      taips_commit: TAIPS_COMMIT,
      message_count: msgs.length,
      messages: records.map((r) => Object.assign({}, r, { status: r.coverage === 'not_covered' ? 'not_covered' : (r.findings.length === 0 ? 'no_findings' : 'findings') })),
      thread,
      covered_types: TYPE_NAMES,
      signatures_verified: false,
      identifiers_resolved: false,
      counterparty_contacted: false,
      compliance_determination: false,
      warnings,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // The object below is the exact execution_hash preimage. When the shared canonicalizer
  // would refuse it (compute() already refused the same input with the same named reason),
  // mint the refusal artifact with a null execution_hash and the reason echoed beside it
  // instead of letting the hash throw: buildArtifact never throws on an input compute
  // accepts or refuses. The shared _hash.mjs stays untouched.
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const hash = unhashable === null ? await executionHash(pp, output_payload) : null;
  const artifact = {
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
  if (unhashable !== null) {
    // Echo the refusal compute() already returned (same named reason, same pp-rooted path).
    // The envelope walk supplies the marker itself only if compute() somehow did not refuse
    // (the pp margins in compute() keep that from happening): the artifact then still
    // explains its null hash instead of throwing.
    artifact.hash_refusal = output_payload.status === 'refused' && output_payload.reason === unhashable.reason
      ? { reason: output_payload.reason, detail: output_payload.detail }
      : { reason: unhashable.reason, detail: unhashable.detail };
  }
  return artifact;
}
