import { executionHash } from './_hash.mjs';

// art-700-authorization-payload-linter -- pre-sign lint of an authorization payload against a
// caller-declared signing policy.
//
// BEHAVIOUR ONLY (KERNEL-CITATION-CLASS-1): the standard references, clause locators and digests
// this node is built from live in the node shard's description / cited_clause_digest, never here.
//
// DETERMINISM: compute() is a pure function of pp -- no clock, no network, no filesystem, no
// randomness. It runs unmodified inside the QuickJS-ng zkVM guest, a strict subset of a browser
// global environment: TextEncoder / atob / btoa / URL are all absent. Nothing below uses them.
// Classification is string equality over the canonical encodeType strings, so there is no keccak
// and no ECDSA on any path; the only arithmetic is BigInt comparison of declared quantities.
//
// EVERY chain fact is caller-declared and echoed back. Nothing here reads a chain, resolves an
// address, or originates a transaction. A check whose declared input is absent reports
// NOT_EVALUATED, never CLEAR.

const TOOL_ID = 'art-700-authorization-payload-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_authorization_payload',
  mandate_type: 'payment_policy', gpu: false,
};

const SCOPE_NOTE = 'Classifies an authorization payload that is about to be signed and reports how it '
  + 'stands against a signing policy the caller declares. Classification is string equality of the '
  + 'computed encodeType against canonical type strings, so a type this node does not recognise is '
  + 'reported as UNRECOGNIZED and never guessed. Every threshold, allowlist, counterparty set and '
  + 'clock reading is a caller-declared input: a check whose input was not declared reports '
  + 'NOT_EVALUATED and is listed separately, never folded into a CLEAR. This node performs no chain '
  + 'read, recovers no signer, computes no digest, and never submits anything. It reports flags '
  + 'against a declared policy; it does not judge a counterparty, a delegate contract, or an outcome.';

// ---------- declared modes ----------
const MODES = ['typed_data', 'eip7702_tuple', 'raw_hash'];

// ---------- canonical encodeType strings (the classification table) ----------
// Each entry: the exact encodeType string a conforming payload produces, and the label reported.
const CANONICAL_TYPES = [
  ['Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)',
    'ERC2612_PERMIT'],
  ['Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)',
    'DAI_LEGACY_PERMIT'],
  ['PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)',
    'PERMIT2_PERMIT_TRANSFER_FROM'],
  ['PermitBatchTransferFrom(TokenPermissions[] permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)',
    'PERMIT2_PERMIT_BATCH_TRANSFER_FROM'],
  ['PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)',
    'PERMIT2_PERMIT_SINGLE'],
  ['PermitBatch(PermitDetails[] details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)',
    'PERMIT2_PERMIT_BATCH'],
  ['TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)',
    'EIP3009_TRANSFER_WITH_AUTHORIZATION'],
  ['ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)',
    'EIP3009_RECEIVE_WITH_AUTHORIZATION'],
  ['CancelAuthorization(address authorizer,bytes32 nonce)',
    'EIP3009_CANCEL_AUTHORIZATION'],
  ['PackedUserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData)',
    'ERC4337_PACKED_USER_OPERATION'],
  ['ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)',
    'ERC2771_FORWARD_REQUEST'],
];

// PermitWitnessTransferFrom carries an author-chosen witness struct, so only its head is fixed.
const WITNESS_HEAD = 'PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,';
const TOKEN_PERMISSIONS_TYPE = 'TokenPermissions(address token,uint256 amount)';
const X402_WITNESS_TYPE = 'Witness(address to,uint256 validAfter)';

// Struct names that belong to a recognised standard. A payload whose primaryType is one of these
// but whose encodeType is not the canonical string is a lookalike.
const KNOWN_STRUCT_NAMES = [
  'Permit', 'PermitTransferFrom', 'PermitBatchTransferFrom', 'PermitWitnessTransferFrom',
  'PermitSingle', 'PermitBatch', 'TransferWithAuthorization', 'ReceiveWithAuthorization',
  'CancelAuthorization', 'PackedUserOperation', 'ForwardRequest',
];

const PERMIT2_SIGNATURE_TRANSFER = [
  'PERMIT2_PERMIT_TRANSFER_FROM', 'PERMIT2_PERMIT_BATCH_TRANSFER_FROM', 'PERMIT2_PERMIT_WITNESS_TRANSFER_FROM',
];
const PERMIT2_ALLOWANCE_TRANSFER = ['PERMIT2_PERMIT_SINGLE', 'PERMIT2_PERMIT_BATCH'];
const EIP3009_TYPES = [
  'EIP3009_TRANSFER_WITH_AUTHORIZATION', 'EIP3009_RECEIVE_WITH_AUTHORIZATION', 'EIP3009_CANCEL_AUTHORIZATION',
];

// ---------- pinned constants ----------
const CANONICAL_PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = (1n << 48n) - 1n;
const NONCE_CEILING_7702 = (1n << 64n) - 1n;
// The upper bound a canonical low-s signature must not exceed.
const SECP256K1N_HALF = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0n;
const S_MASK_255 = (1n << 255n) - 1n;
const MAGIC_6492 = '6492649264926492649264926492649264926492649264926492649264926492';

// ---------- small pure helpers ----------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isStr(v) { return typeof v === 'string' && v.length > 0; }

function lower(v) { return typeof v === 'string' ? v.toLowerCase() : v; }

/** 20-byte hex address, lowercased. Returns null when the value is not one. */
function addr(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(s) ? s.toLowerCase() : null;
}

/** Non-negative integer quantity from a decimal string, 0x-hex string, or safe number. */
function q(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return null;
    return BigInt(v);
  }
  if (typeof v === 'bigint') return v >= 0n ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^[0-9]+$/.test(s)) return BigInt(s);
  if (/^0x[0-9a-fA-F]+$/.test(s)) return BigInt(s);
  return null;
}

function qs(v) { const n = q(v); return n === null ? null : n.toString(); }

function inList(list, value) {
  if (!Array.isArray(list) || value === null || value === undefined) return null;
  const needle = lower(value);
  for (const entry of list) if (lower(entry) === needle) return true;
  return false;
}

function stripHex(s) { return typeof s === 'string' && /^0x/i.test(s) ? s.slice(2) : s; }

// ---------- EIP-712 encodeType ----------
/** One struct's own encoding: `Name(type name,type name)`. */
function typeString(name, types) {
  const fields = types[name];
  if (!Array.isArray(fields)) return null;
  const members = [];
  for (const f of fields) {
    if (!isObj(f) || !isStr(f.type) || !isStr(f.name)) return null;
    members.push(f.type + ' ' + f.name);
  }
  return name + '(' + members.join(',') + ')';
}

/** Base struct name of a member type, with any array suffix removed. */
function baseType(t) {
  const i = t.indexOf('[');
  return i === -1 ? t : t.slice(0, i);
}

/**
 * encodeType(primaryType, types): the primary struct's encoding followed by every referenced
 * struct, collected transitively and sorted by name. Returns null when the types object cannot
 * produce one (an absent or malformed struct definition).
 */
function encodeType(primaryType, types) {
  if (!isStr(primaryType) || !isObj(types) || !Array.isArray(types[primaryType])) return null;
  const found = {};
  const stack = [primaryType];
  while (stack.length > 0) {
    const name = stack.pop();
    const fields = types[name];
    if (!Array.isArray(fields)) return null;
    for (const f of fields) {
      if (!isObj(f) || !isStr(f.type)) return null;
      const base = baseType(f.type);
      if (base !== primaryType && Array.isArray(types[base]) && !found[base]) {
        found[base] = true;
        stack.push(base);
      }
    }
  }
  const head = typeString(primaryType, types);
  if (head === null) return null;
  const referenced = Object.keys(found).sort();
  let out = head;
  for (const name of referenced) {
    const piece = typeString(name, types);
    if (piece === null) return null;
    out += piece;
  }
  return out;
}

/** Recursively collect message keys absent from `types`, and declared members absent from message. */
function walkStructure(structName, types, value, path, extras, missing, seen) {
  if (!Array.isArray(types[structName])) return;
  const guard = structName + '@' + path;
  if (seen[guard]) return;
  seen[guard] = true;
  if (!isObj(value)) return;
  const declared = {};
  for (const f of types[structName]) {
    if (!isObj(f) || !isStr(f.name)) continue;
    declared[f.name] = f.type;
  }
  for (const key of Object.keys(value)) {
    if (!Object.prototype.hasOwnProperty.call(declared, key)) extras.push(path + key);
  }
  for (const key of Object.keys(declared)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) { missing.push(path + key); continue; }
    const t = declared[key];
    const base = baseType(t);
    if (!Array.isArray(types[base])) continue;
    const child = value[key];
    if (t.indexOf('[') !== -1) {
      if (!Array.isArray(child)) continue;
      for (let i = 0; i < child.length; i++) {
        walkStructure(base, types, child[i], path + key + '[' + i + '].', extras, missing, seen);
      }
    } else {
      walkStructure(base, types, child, path + key + '.', extras, missing, seen);
    }
  }
}

// ---------- check accumulator ----------
function makeChecks() {
  const rows = [];
  return {
    rows,
    /** status: 'FLAGGED' | 'CLEAR' | 'NOT_EVALUATED' */
    add(id, status, fieldPath, observed, policy, severity) {
      rows.push({
        id,
        status,
        severity: severity || 'policy',
        field_path: fieldPath === undefined ? null : fieldPath,
        observed: observed === undefined ? null : observed,
        policy: policy === undefined ? null : policy,
      });
    },
    /** Evaluate only when every declared input is present; otherwise NOT_EVALUATED with the reason. */
    gated(id, present, reason, fieldPath, evaluate, severity) {
      if (!present) { this.add(id, 'NOT_EVALUATED', fieldPath, null, reason, severity); return; }
      const r = evaluate();
      this.add(id, r.flagged ? 'FLAGGED' : 'CLEAR', r.field_path === undefined ? fieldPath : r.field_path,
        r.observed, r.policy, severity);
    },
  };
}

// ---------- classification ----------
function classify(primaryType, types) {
  const et = encodeType(primaryType, types);
  if (et === null) {
    return { label: 'UNRECOGNIZED', encode_type: null, witness_type: null, x402_witness: false, lookalike: false };
  }
  for (const row of CANONICAL_TYPES) {
    if (et === row[0]) {
      return { label: row[1], encode_type: et, witness_type: null, x402_witness: false, lookalike: false };
    }
  }
  if (primaryType === 'PermitWitnessTransferFrom'
    && et.indexOf(WITNESS_HEAD) === 0
    && et.indexOf(TOKEN_PERMISSIONS_TYPE) !== -1) {
    const witnessField = types[primaryType][types[primaryType].length - 1];
    const witnessStruct = isObj(witnessField) ? baseType(witnessField.type) : null;
    const witnessType = witnessStruct && Array.isArray(types[witnessStruct])
      ? typeString(witnessStruct, types) : null;
    return {
      label: 'PERMIT2_PERMIT_WITNESS_TRANSFER_FROM',
      encode_type: et,
      witness_type: witnessType,
      x402_witness: witnessType === X402_WITNESS_TYPE,
      lookalike: false,
    };
  }
  const lookalike = KNOWN_STRUCT_NAMES.indexOf(primaryType) !== -1;
  return { label: 'UNRECOGNIZED', encode_type: et, witness_type: null, x402_witness: false, lookalike };
}

// ---------- payload field extraction, per classification ----------
/**
 * Pulls the fields the checks need out of a classified message, so every downstream check reads
 * one shape. Anything a classification does not carry stays null.
 */
function extract(label, message, domain) {
  const out = {
    spender: null,
    payee: null,
    owner: null,
    token: null,
    amounts: [],        // [{ path, value(BigInt), token, ceiling(BigInt) }]
    deadline: null,     // { path, value(BigInt), ceiling(BigInt) }
    valid_after: null,
    expirations: [],    // Permit2 AllowanceTransfer per-entry expiration
    dai_allowed: null,
    entry_count: null,
  };
  const m = isObj(message) ? message : {};
  const domainToken = addr(domain && domain.verifyingContract);

  if (label === 'ERC2612_PERMIT') {
    out.owner = addr(m.owner);
    out.spender = addr(m.spender);
    out.token = domainToken;
    const v = q(m.value);
    if (v !== null) out.amounts.push({ path: 'message.value', value: v, token: domainToken, ceiling: MAX_UINT256 });
    const d = q(m.deadline);
    if (d !== null) out.deadline = { path: 'message.deadline', value: d, ceiling: MAX_UINT256 };
  } else if (label === 'DAI_LEGACY_PERMIT') {
    out.owner = addr(m.holder);
    out.spender = addr(m.spender);
    out.token = domainToken;
    out.dai_allowed = m.allowed === true;
    const e = q(m.expiry);
    // A zero expiry never expires here, so it is a no-expiry fact and not a deadline to compare.
    if (e !== null && e !== 0n) out.deadline = { path: 'message.expiry', value: e, ceiling: MAX_UINT256 };
  } else if (PERMIT2_SIGNATURE_TRANSFER.indexOf(label) !== -1) {
    out.spender = addr(m.spender);
    const permitted = m.permitted;
    if (Array.isArray(permitted)) {
      out.entry_count = permitted.length;
      for (let i = 0; i < permitted.length; i++) {
        const e = isObj(permitted[i]) ? permitted[i] : {};
        const v = q(e.amount);
        if (v !== null) out.amounts.push({ path: 'message.permitted[' + i + '].amount', value: v, token: addr(e.token), ceiling: MAX_UINT256 });
      }
      if (permitted.length > 0 && isObj(permitted[0])) out.token = addr(permitted[0].token);
    } else if (isObj(permitted)) {
      out.entry_count = 1;
      out.token = addr(permitted.token);
      const v = q(permitted.amount);
      if (v !== null) out.amounts.push({ path: 'message.permitted.amount', value: v, token: out.token, ceiling: MAX_UINT256 });
    }
    const d = q(m.deadline);
    if (d !== null) out.deadline = { path: 'message.deadline', value: d, ceiling: MAX_UINT256 };
    if (isObj(m.witness)) {
      out.payee = addr(m.witness.to);
      const va = q(m.witness.validAfter);
      if (va !== null) out.valid_after = { path: 'message.witness.validAfter', value: va };
    }
  } else if (PERMIT2_ALLOWANCE_TRANSFER.indexOf(label) !== -1) {
    out.spender = addr(m.spender);
    const details = m.details;
    const list = Array.isArray(details) ? details : (isObj(details) ? [details] : []);
    out.entry_count = list.length;
    const prefix = Array.isArray(details) ? 'message.details[' : 'message.details';
    for (let i = 0; i < list.length; i++) {
      const e = isObj(list[i]) ? list[i] : {};
      const base = Array.isArray(details) ? prefix + i + ']' : prefix;
      const t = addr(e.token);
      const v = q(e.amount);
      if (v !== null) out.amounts.push({ path: base + '.amount', value: v, token: t, ceiling: MAX_UINT160 });
      const x = q(e.expiration);
      if (x !== null) out.expirations.push({ path: base + '.expiration', value: x, ceiling: MAX_UINT48 });
      if (i === 0) out.token = t;
    }
    const d = q(m.sigDeadline);
    if (d !== null) out.deadline = { path: 'message.sigDeadline', value: d, ceiling: MAX_UINT256 };
  } else if (label === 'EIP3009_TRANSFER_WITH_AUTHORIZATION' || label === 'EIP3009_RECEIVE_WITH_AUTHORIZATION') {
    out.owner = addr(m.from);
    out.payee = addr(m.to);
    out.token = domainToken;
    const v = q(m.value);
    if (v !== null) out.amounts.push({ path: 'message.value', value: v, token: domainToken, ceiling: MAX_UINT256 });
    const vb = q(m.validBefore);
    if (vb !== null) out.deadline = { path: 'message.validBefore', value: vb, ceiling: MAX_UINT256 };
    const va = q(m.validAfter);
    if (va !== null) out.valid_after = { path: 'message.validAfter', value: va };
  } else if (label === 'ERC2771_FORWARD_REQUEST') {
    out.owner = addr(m.from);
    out.payee = addr(m.to);
    const v = q(m.value);
    if (v !== null) out.amounts.push({ path: 'message.value', value: v, token: null, ceiling: MAX_UINT256 });
    const d = q(m.deadline);
    if (d !== null) out.deadline = { path: 'message.deadline', value: d, ceiling: MAX_UINT48 };
  } else if (label === 'ERC4337_PACKED_USER_OPERATION') {
    out.owner = addr(m.sender);
  }
  return out;
}

// ---------- signature form ----------
function signatureForm(sig) {
  if (!isStr(sig)) return null;
  const hex = stripHex(sig.trim());
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length === 0 || hex.length % 2 !== 0) {
    return { length_class: 'not-hex', bytes: null, s: null, v: null, erc6492: false };
  }
  const bytes = hex.length / 2;
  const erc6492 = hex.length >= 64 && hex.slice(hex.length - 64).toLowerCase() === MAGIC_6492;
  if (erc6492) return { length_class: 'erc6492-wrapped', bytes, s: null, v: null, erc6492: true };
  if (bytes === 65) {
    const s = BigInt('0x' + hex.slice(64, 128));
    const v = parseInt(hex.slice(128, 130), 16);
    return { length_class: '65', bytes, s, v, erc6492: false };
  }
  if (bytes === 64) {
    const yParityAndS = BigInt('0x' + hex.slice(64, 128));
    return {
      length_class: '64-eip2098',
      bytes,
      s: yParityAndS & S_MASK_255,
      v: Number(yParityAndS >> 255n),
      erc6492: false,
    };
  }
  return { length_class: 'other-non-ecdsa', bytes, s: null, v: null, erc6492: false };
}

// ---------- display block, in the clear-signing field-format vocabulary ----------
function buildDisplay(label, cls, domain, message, ex, hints) {
  const decimals = isObj(hints.token_decimals) ? hints.token_decimals : {};
  const tickers = isObj(hints.token_ticker) ? hints.token_ticker : {};
  const labels = isObj(hints.address_labels) ? hints.address_labels : {};
  const rows = [];

  function addressRow(path, value, lbl) {
    if (!value) return;
    const named = labels[value] || labels[lower(value)] || null;
    rows.push({ path, label: lbl, format: 'addressName', value: named || value, params: { raw: value } });
  }
  function amountRow(a, lbl) {
    const token = a.token;
    const dec = token !== null && Object.prototype.hasOwnProperty.call(decimals, token) ? decimals[token] : null;
    const tick = token !== null && Object.prototype.hasOwnProperty.call(tickers, token) ? tickers[token] : null;
    rows.push({
      path: a.path,
      label: lbl,
      format: 'tokenAmount',
      value: a.value.toString(),
      params: { token, decimals: dec, ticker: tick, raw_base_units: true },
    });
  }

  const chainId = q(domain && domain.chainId);
  if (chainId !== null) {
    rows.push({ path: 'domain.chainId', label: 'Chain', format: 'chainId', value: chainId.toString(), params: {} });
  }
  addressRow('domain.verifyingContract', addr(domain && domain.verifyingContract), 'Verifying contract');
  addressRow('message.spender', ex.spender, 'Spender');
  addressRow('message.to', ex.payee, 'Recipient');
  for (const a of ex.amounts) amountRow(a, 'Amount');
  if (ex.deadline !== null) {
    rows.push({ path: ex.deadline.path, label: 'Expires', format: 'date', value: rfc3339(ex.deadline.value), params: { unix: ex.deadline.value.toString() } });
  }
  if (ex.valid_after !== null) {
    rows.push({ path: ex.valid_after.path, label: 'Valid from', format: 'date', value: rfc3339(ex.valid_after.value), params: { unix: ex.valid_after.value.toString() } });
  }
  for (const x of ex.expirations) {
    rows.push({ path: x.path, label: 'Allowance expiration', format: 'date', value: rfc3339(x.value), params: { unix: x.value.toString() } });
  }
  void label; void cls; void message;
  return rows;
}

/** Seconds since the epoch rendered as an RFC 3339 instant, computed without a Date object. */
function rfc3339(seconds) {
  if (seconds === null) return null;
  if (seconds > 253402300799n) return null; // beyond year 9999, not renderable as a calendar instant
  let days = Number(seconds / 86400n);
  let rem = Number(seconds % 86400n);
  const hh = Math.floor(rem / 3600); rem -= hh * 3600;
  const mm = Math.floor(rem / 60);
  const ss = rem - mm * 60;
  let year = 1970;
  for (;;) {
    const len = isLeap(year) ? 366 : 365;
    if (days < len) break;
    days -= len;
    year += 1;
  }
  const monthLens = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let month = 0;
  while (days >= monthLens[month]) { days -= monthLens[month]; month += 1; }
  return pad(year, 4) + '-' + pad(month + 1, 2) + '-' + pad(days + 1, 2)
    + 'T' + pad(hh, 2) + ':' + pad(mm, 2) + ':' + pad(ss, 2) + 'Z';
}
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function pad(n, w) { let s = String(n); while (s.length < w) s = '0' + s; return s; }

// ---------- handoffs ----------
function buildHandoffs(label, domain, message, sigParts) {
  const handoffs = {};
  const d = isObj(domain) ? domain : {};
  const m = isObj(message) ? message : {};
  const chainId = qs(d.chainId);
  const verifying = addr(d.verifyingContract);

  if (label === 'EIP3009_TRANSFER_WITH_AUTHORIZATION' || label === 'EIP3009_RECEIVE_WITH_AUTHORIZATION') {
    handoffs.art_590 = {
      name: isStr(d.name) ? d.name : null,
      version: isStr(d.version) ? d.version : null,
      chainId,
      verifyingContract: verifying,
      from: addr(m.from),
      to: addr(m.to),
      value: qs(m.value),
      validAfter: qs(m.validAfter),
      validBefore: qs(m.validBefore),
      nonce: isStr(m.nonce) ? lower(m.nonce) : null,
    };
  }
  if (label === 'ERC2612_PERMIT') {
    handoffs.art_612 = {
      name: isStr(d.name) ? d.name : null,
      version: isStr(d.version) ? d.version : null,
      chainId,
      verifyingContract: verifying,
      owner: addr(m.owner),
      spender: addr(m.spender),
      value: qs(m.value),
      nonce: qs(m.nonce),
      deadline: qs(m.deadline),
      r: sigParts.r,
      s: sigParts.s,
      yParity: sigParts.yParity,
    };
  }
  return handoffs;
}

function splitSignature(sig, form) {
  const out = { r: null, s: null, yParity: null };
  if (!isStr(sig) || form === null) return out;
  const hex = stripHex(sig.trim());
  if (form.length_class !== '65' && form.length_class !== '64-eip2098') return out;
  out.r = '0x' + hex.slice(0, 64).toLowerCase();
  out.s = '0x' + pad32(form.s);
  if (form.length_class === '65') {
    out.yParity = form.v === 27 || form.v === 28 ? form.v - 27 : (form.v === 0 || form.v === 1 ? form.v : null);
  } else {
    out.yParity = form.v;
  }
  return out;
}
function pad32(v) { let h = v.toString(16); while (h.length < 64) h = '0' + h; return h; }

// ---------- mode: typed_data ----------
function lintTypedData(pp, policy, warnings) {
  const td = isObj(pp.typed_data) ? pp.typed_data : {};
  const domain = isObj(td.domain) ? td.domain : {};
  const types = isObj(td.types) ? td.types : {};
  const message = isObj(td.message) ? td.message : {};
  const primaryType = isStr(td.primaryType) ? td.primaryType : null;
  const C = makeChecks();

  const cls = classify(primaryType, types);
  const label = cls.label;
  const ex = extract(label, message, domain);

  // ---- structure ----
  C.add('BLIND_SIGNATURE', 'CLEAR', 'mode', 'typed_data', 'a structured payload was supplied', 'structure');

  if (primaryType === null || !Array.isArray(types[primaryType])) {
    warnings.push('typed_data.primaryType is absent or has no matching entry in typed_data.types; structure checks could not run');
    C.add('MESSAGE_FIELD_NOT_IN_TYPES', 'NOT_EVALUATED', 'typed_data.types', null, 'primaryType has no struct definition', 'structure');
    C.add('MESSAGE_FIELD_MISSING', 'NOT_EVALUATED', 'typed_data.types', null, 'primaryType has no struct definition', 'structure');
  } else {
    const extras = [];
    const missing = [];
    walkStructure(primaryType, types, message, 'message.', extras, missing, {});
    C.add('MESSAGE_FIELD_NOT_IN_TYPES', extras.length > 0 ? 'FLAGGED' : 'CLEAR', 'typed_data.message',
      extras, 'every message member must be declared in types', 'structure');
    C.add('MESSAGE_FIELD_MISSING', missing.length > 0 ? 'FLAGGED' : 'CLEAR', 'typed_data.message',
      missing, 'every declared member must be present in message', 'structure');
  }

  C.add('LOOKALIKE_TYPE', cls.lookalike ? 'FLAGGED' : 'CLEAR', 'typed_data.primaryType',
    cls.lookalike ? { primary_type: primaryType, encode_type: cls.encode_type } : primaryType,
    'a known struct name must carry its canonical encodeType', 'structure');
  C.add('UNRECOGNIZED_TYPE', label === 'UNRECOGNIZED' ? 'FLAGGED' : 'CLEAR', 'typed_data.primaryType',
    cls.encode_type, 'classification by encodeType string equality', 'informational');

  // ---- domain ----
  const domainChain = q(domain.chainId);
  C.gated('CHAIN_MISMATCH_ACTIVE',
    policy.active_chain_id !== undefined && policy.active_chain_id !== null && domainChain !== null,
    'active_chain_id was not declared, or the payload carries no domain.chainId', 'domain.chainId',
    () => {
      const active = q(policy.active_chain_id);
      return { flagged: active === null || active !== domainChain, observed: domainChain === null ? null : domainChain.toString(), policy: active === null ? null : active.toString() };
    });
  C.gated('CHAIN_NOT_ALLOWED', Array.isArray(policy.allowed_chain_ids) && domainChain !== null,
    'allowed_chain_ids was not declared, or the payload carries no domain.chainId', 'domain.chainId',
    () => {
      const allowed = policy.allowed_chain_ids.map((x) => (q(x) === null ? null : q(x).toString()));
      return { flagged: allowed.indexOf(domainChain.toString()) === -1, observed: domainChain.toString(), policy: allowed };
    });
  const verifying = addr(domain.verifyingContract);
  C.gated('VERIFYING_CONTRACT_NOT_ALLOWED', Array.isArray(policy.allowed_verifying_contracts) && verifying !== null,
    'allowed_verifying_contracts was not declared, or the payload carries no domain.verifyingContract',
    'domain.verifyingContract',
    () => ({ flagged: inList(policy.allowed_verifying_contracts, verifying) !== true, observed: verifying, policy: policy.allowed_verifying_contracts.map(lower) }));

  const isPermit2 = PERMIT2_SIGNATURE_TRANSFER.indexOf(label) !== -1 || PERMIT2_ALLOWANCE_TRANSFER.indexOf(label) !== -1;
  C.gated('PERMIT2_DOMAIN_SHAPE', isPermit2,
    'the payload is not classified as one of the recognised allowance-router types', 'domain',
    () => {
      const declared = Array.isArray(types.EIP712Domain)
        ? types.EIP712Domain.map((f) => (isObj(f) && isStr(f.name) ? f.name : '?'))
        : Object.keys(domain);
      const shapeOk = declared.length === 3
        && declared.indexOf('name') !== -1 && declared.indexOf('chainId') !== -1
        && declared.indexOf('verifyingContract') !== -1;
      const nameOk = domain.name === 'Permit2';
      const addrOk = verifying === CANONICAL_PERMIT2;
      return {
        flagged: !(shapeOk && nameOk && addrOk),
        observed: { domain_fields: declared, name: isStr(domain.name) ? domain.name : null, verifying_contract: verifying },
        policy: { domain_fields: ['name', 'chainId', 'verifyingContract'], name: 'Permit2', verifying_contract: CANONICAL_PERMIT2 },
      };
    });

  // ---- amount ----
  const unlimited = [];
  for (const a of ex.amounts) if (a.value === a.ceiling) unlimited.push(a.path);
  const daiUnlimited = ex.dai_allowed === true;
  C.gated('UNLIMITED_AMOUNT', ex.amounts.length > 0 || ex.dai_allowed !== null,
    'the classified payload carries no amount member', ex.amounts.length > 0 ? ex.amounts[0].path : 'message.allowed',
    () => ({
      flagged: unlimited.length > 0 || daiUnlimited,
      observed: daiUnlimited ? { allowed: true, effect: 'grants the maximum allowance' } : unlimited,
      policy: 'an amount at its type ceiling is an unlimited allowance',
    }));

  C.gated('AMOUNT_ABOVE_POLICY', isObj(policy.max_amount_by_token) && ex.amounts.length > 0,
    'max_amount_by_token was not declared, or the classified payload carries no amount member',
    ex.amounts.length > 0 ? ex.amounts[0].path : 'message',
    () => {
      const over = [];
      const compared = [];
      for (const a of ex.amounts) {
        if (a.token === null) continue;
        const capRaw = Object.prototype.hasOwnProperty.call(policy.max_amount_by_token, a.token)
          ? policy.max_amount_by_token[a.token] : null;
        const cap = q(capRaw);
        if (cap === null) continue;
        compared.push({ path: a.path, token: a.token, amount: a.value.toString(), max: cap.toString() });
        if (a.value > cap) over.push({ path: a.path, token: a.token, amount: a.value.toString(), max: cap.toString() });
      }
      return {
        flagged: over.length > 0,
        observed: { over_policy: over, compared, entry_count: ex.entry_count },
        policy: policy.max_amount_by_token,
      };
    });

  // ---- time ----
  const noExpiryPaths = [];
  const blockOnly = [];
  if (ex.deadline !== null && ex.deadline.value === ex.deadline.ceiling) noExpiryPaths.push(ex.deadline.path);
  for (const x of ex.expirations) {
    if (x.value === x.ceiling) noExpiryPaths.push(x.path);
    if (x.value === 0n) blockOnly.push(x.path);
  }
  const daiNoExpiry = label === 'DAI_LEGACY_PERMIT' && q(message.expiry) === 0n;
  if (daiNoExpiry) noExpiryPaths.push('message.expiry');
  C.gated('NO_EXPIRY', ex.deadline !== null || ex.expirations.length > 0 || label === 'DAI_LEGACY_PERMIT',
    'the classified payload carries no deadline or expiration member', 'message',
    () => ({
      flagged: noExpiryPaths.length > 0,
      observed: { no_expiry: noExpiryPaths, expires_this_block: blockOnly },
      policy: 'a ceiling deadline, or a zero expiry on the legacy permit struct, never expires',
    }));

  const now = q(policy.now_unix);
  C.gated('VALIDITY_BEYOND_POLICY',
    policy.max_validity_seconds !== undefined && policy.max_validity_seconds !== null && now !== null && ex.deadline !== null,
    'max_validity_seconds, now_unix, or a deadline member was not present', ex.deadline === null ? 'message' : ex.deadline.path,
    () => {
      const maxWindow = q(policy.max_validity_seconds);
      if (maxWindow === null) return { flagged: false, observed: null, policy: null };
      const window = ex.deadline.value > now ? ex.deadline.value - now : 0n;
      return { flagged: window > maxWindow, observed: { seconds_until_deadline: window.toString() }, policy: maxWindow.toString() };
    });

  C.gated('EXPIRED', now !== null && ex.deadline !== null,
    'now_unix or a deadline member was not present', ex.deadline === null ? 'message' : ex.deadline.path,
    () => ({ flagged: ex.deadline.value < now, observed: ex.deadline.value.toString(), policy: now.toString() }), 'informational');
  C.gated('NOT_YET_VALID', now !== null && ex.valid_after !== null,
    'now_unix or a start-of-window member was not present', ex.valid_after === null ? 'message' : ex.valid_after.path,
    () => ({ flagged: ex.valid_after.value > now, observed: ex.valid_after.value.toString(), policy: now.toString() }), 'informational');

  // ---- counterparty ----
  C.gated('SPENDER_NOT_ALLOWLISTED', Array.isArray(policy.spender_allowlist) && ex.spender !== null,
    'spender_allowlist was not declared, or the classified payload carries no spender', 'message.spender',
    () => ({ flagged: inList(policy.spender_allowlist, ex.spender) !== true, observed: ex.spender, policy: policy.spender_allowlist.map(lower) }));
  C.gated('PAYEE_NOT_ALLOWLISTED', Array.isArray(policy.payee_allowlist) && ex.payee !== null,
    'payee_allowlist was not declared, or the classified payload carries no payee', 'message',
    () => ({ flagged: inList(policy.payee_allowlist, ex.payee) !== true, observed: ex.payee, policy: policy.payee_allowlist.map(lower) }));
  C.gated('SPENDER_NOT_DECLARED_CONTRACT', Array.isArray(policy.contract_addresses) && ex.spender !== null,
    'contract_addresses was not declared, or the classified payload carries no spender', 'message.spender',
    () => ({ flagged: inList(policy.contract_addresses, ex.spender) !== true, observed: ex.spender, policy: 'the spender must appear in the caller-declared set of known contract addresses' }));
  C.gated('EIP3009_TRANSFER_TO_CONTRACT',
    Array.isArray(policy.contract_addresses) && label === 'EIP3009_TRANSFER_WITH_AUTHORIZATION' && ex.payee !== null,
    'contract_addresses was not declared, or the payload is not the transfer-form authorization', 'message.to',
    () => ({ flagged: inList(policy.contract_addresses, ex.payee) === true, observed: ex.payee, policy: 'a declared contract payee should receive the receive-form authorization instead' }));

  // ---- signature form ----
  const form = signatureForm(pp.signature);
  const sigParts = splitSignature(pp.signature, form);
  C.gated('HIGH_S', form !== null && form.s !== null, 'no signature was supplied, or it carries no recoverable s', 'signature',
    () => ({ flagged: form.s > SECP256K1N_HALF, observed: '0x' + pad32(form.s), policy: 'the low-s half order' }));
  C.gated('V_FORM_RAW_YPARITY', form !== null && form.length_class === '65',
    'no 65-byte signature was supplied', 'signature',
    () => ({ flagged: form.v === 0 || form.v === 1, observed: form.v, policy: 'a 65-byte signature carries v of 27 or 28 on the paths that recover it' }));
  C.gated('NON_ECDSA_LENGTH', form !== null, 'no signature was supplied', 'signature',
    () => ({ flagged: form.length_class === 'other-non-ecdsa' || form.length_class === 'not-hex', observed: { length_class: form.length_class, bytes: form.bytes }, policy: '65-byte, 64-byte compact, or a wrapped smart-wallet form' }));
  C.gated('ERC6492_WRAPPED', form !== null, 'no signature was supplied', 'signature',
    () => ({ flagged: form.erc6492, observed: form.length_class, policy: 'the wrapper suffix marks a counterfactual smart-wallet signature, where key recovery does not apply' }), 'informational');

  // ---- payment-protocol binding ----
  const x402 = isObj(policy.expected_x402) ? policy.expected_x402 : null;
  const method = EIP3009_TYPES.indexOf(label) !== -1 ? 'eip3009'
    : (isPermit2 ? 'permit2' : 'not_detected');
  C.gated('X402_METHOD_NOT_OFFLINE_CHECKABLE', x402 !== null, 'expected_x402 was not declared', 'typed_data.primaryType',
    () => ({ flagged: method === 'not_detected', observed: method, policy: 'only the authorization-signature methods can be checked without a chain read' }));
  C.gated('X402_AMOUNT_MISMATCH', x402 !== null && isStr(x402.scheme) && q(x402.amount) !== null && ex.amounts.length > 0,
    'expected_x402.scheme, expected_x402.amount, or an amount member was not present',
    ex.amounts.length > 0 ? ex.amounts[0].path : 'message',
    () => {
      const want = q(x402.amount);
      const got = ex.amounts[0].value;
      if (x402.scheme === 'exact') return { flagged: got !== want, observed: got.toString(), policy: { scheme: 'exact', amount: want.toString(), rule: 'the signed amount equals the required amount' } };
      if (x402.scheme === 'upto') return { flagged: got < want, observed: got.toString(), policy: { scheme: 'upto', amount: want.toString(), rule: 'the signed amount is a ceiling and is at least the required amount' } };
      return { flagged: true, observed: { scheme: x402.scheme }, policy: 'scheme must be one of exact or upto' };
    });
  C.gated('X402_PAYTO_MISMATCH', x402 !== null && addr(x402.payTo) !== null && ex.payee !== null,
    'expected_x402.payTo was not declared, or the classified payload carries no payee', 'message',
    () => ({ flagged: ex.payee !== addr(x402.payTo), observed: ex.payee, policy: addr(x402.payTo) }));
  C.gated('X402_ASSET_MISMATCH', x402 !== null && addr(x402.asset) !== null && ex.token !== null,
    'expected_x402.asset was not declared, or the classified payload carries no token', 'message',
    () => ({ flagged: ex.token !== addr(x402.asset), observed: ex.token, policy: addr(x402.asset) }));
  C.gated('X402_NETWORK_MISMATCH',
    x402 !== null && isStr(x402.network) && isObj(policy.network_chain_ids) && domainChain !== null,
    'expected_x402.network, the caller-declared network_chain_ids map, or domain.chainId was not present',
    'domain.chainId',
    () => {
      const want = q(policy.network_chain_ids[x402.network]);
      if (want === null) return { flagged: true, observed: domainChain.toString(), policy: { network: x402.network, chain_id: null, rule: 'the declared map carries no chain id for this network name' } };
      return { flagged: want !== domainChain, observed: domainChain.toString(), policy: { network: x402.network, chain_id: want.toString() } };
    });

  // ---- intent binding ----
  const intent = isObj(policy.intent) ? policy.intent : null;
  C.gated('PAYLOAD_DIVERGES_FROM_INTENT', intent !== null, 'intent was not declared', 'message',
    () => {
      const diverging = [];
      const compared = [];
      if (addr(intent.payee) !== null && ex.payee !== null) {
        compared.push('payee');
        if (ex.payee !== addr(intent.payee)) diverging.push({ field: 'payee', observed: ex.payee, intent: addr(intent.payee) });
      }
      if (addr(intent.asset) !== null && ex.token !== null) {
        compared.push('asset');
        if (ex.token !== addr(intent.asset)) diverging.push({ field: 'asset', observed: ex.token, intent: addr(intent.asset) });
      }
      if (q(intent.max_amount) !== null && ex.amounts.length > 0) {
        compared.push('max_amount');
        const cap = q(intent.max_amount);
        for (const a of ex.amounts) {
          if (a.value > cap) diverging.push({ field: 'max_amount', observed: a.value.toString(), intent: cap.toString(), path: a.path });
        }
      }
      if (q(intent.chain_id) !== null && domainChain !== null) {
        compared.push('chain_id');
        if (q(intent.chain_id) !== domainChain) diverging.push({ field: 'chain_id', observed: domainChain.toString(), intent: q(intent.chain_id).toString() });
      }
      return { flagged: diverging.length > 0, observed: { diverging, compared }, policy: 'the payload must carry the values the request decided on' };
    });

  // ---- descriptor binding ----
  const desc = isObj(policy.erc7730_descriptor) ? policy.erc7730_descriptor : null;
  C.gated('ERC7730_DESCRIPTOR_MISMATCH', desc !== null, 'erc7730_descriptor was not declared', 'domain',
    () => {
      const ctx = isObj(desc.context) ? desc.context : {};
      const e712 = isObj(ctx.eip712) ? ctx.eip712 : {};
      const bound = isObj(e712.domain) ? e712.domain : {};
      const diverging = [];
      for (const key of Object.keys(bound)) {
        const want = bound[key];
        const got = domain[key];
        const same = (key === 'verifyingContract') ? (addr(want) !== null && addr(want) === addr(got))
          : (key === 'chainId') ? (q(want) !== null && q(got) !== null && q(want) === q(got))
            : String(want) === String(got);
        if (!same) diverging.push({ key, descriptor: want === undefined ? null : want, payload: got === undefined ? null : got });
      }
      const deployments = Array.isArray(e712.deployments) ? e712.deployments : null;
      if (deployments !== null) {
        let matched = false;
        for (const dep of deployments) {
          if (!isObj(dep)) continue;
          if (q(dep.chainId) !== null && domainChain !== null && q(dep.chainId) === domainChain
            && addr(dep.address) !== null && addr(dep.address) === verifying) { matched = true; break; }
        }
        if (!matched) diverging.push({ key: 'deployments', descriptor: deployments, payload: { chainId: domainChain === null ? null : domainChain.toString(), verifyingContract: verifying } });
      }
      return {
        flagged: diverging.length > 0,
        observed: diverging.length > 0 ? 'DESCRIPTOR_MISMATCH' : 'DESCRIPTOR_BINDS',
        policy: { diverging, bound_keys: Object.keys(bound) },
      };
    });

  // ---- inapplicable-mode checks ----
  for (const id of ['CROSS_CHAIN_AUTHORIZATION', 'DELEGATE_NOT_ALLOWLISTED', 'DELEGATION_CLEAR', 'EIP2_HIGH_S', 'Y_PARITY_OUT_OF_RANGE', 'NONCE_OUT_OF_RANGE']) {
    C.add(id, 'NOT_EVALUATED', 'mode', null, 'these checks read a delegation tuple; this payload is structured data', 'eip7702');
  }

  return {
    checks: C.rows,
    classification: {
      standard: label,
      primary_type: primaryType,
      encode_type: cls.encode_type,
      witness_type: cls.witness_type,
      witness_is_named_payment_witness: cls.x402_witness,
      lookalike: cls.lookalike,
      entry_count: ex.entry_count,
      payment_method: method,
    },
    display: buildDisplay(label, cls, domain, message, ex, isObj(pp.display_hints) ? pp.display_hints : {}),
    handoffs: buildHandoffs(label, domain, message, sigParts),
    signature_form: form === null ? null : { length_class: form.length_class, bytes: form.bytes, v: form.v },
  };
}

// ---------- mode: eip7702_tuple ----------
function lintTuple(pp, policy, warnings) {
  const t = isObj(pp.tuple) ? pp.tuple : {};
  const C = makeChecks();
  const chainId = q(t.chain_id);
  const delegate = addr(t.address);
  const nonce = q(t.nonce);
  const sig = isObj(pp.signature) ? pp.signature : null;

  if (chainId === null) warnings.push('tuple.chain_id is absent or not a non-negative integer; the cross-chain check could not run');
  if (delegate === null) warnings.push('tuple.address is absent or not a 20-byte hex address; the delegate checks could not run');
  if (nonce === null) warnings.push('tuple.nonce is absent or not a non-negative integer; the nonce-range check could not run');

  C.add('BLIND_SIGNATURE', 'CLEAR', 'mode', 'eip7702_tuple', 'a structured tuple was supplied', 'structure');

  C.gated('CROSS_CHAIN_AUTHORIZATION', chainId !== null, 'tuple.chain_id was not supplied', 'tuple.chain_id',
    () => ({ flagged: chainId === 0n, observed: chainId.toString(), policy: 'a zero chain id authorizes the delegation on every chain' }));
  C.gated('DELEGATION_CLEAR', delegate !== null, 'tuple.address was not supplied', 'tuple.address',
    () => ({ flagged: delegate === ZERO_ADDRESS, observed: delegate, policy: 'the zero address clears the account code rather than naming a delegate' }), 'informational');
  C.gated('DELEGATE_NOT_ALLOWLISTED',
    Array.isArray(policy.delegate_allowlist) && delegate !== null && delegate !== ZERO_ADDRESS,
    'delegate_allowlist was not declared, or the tuple clears the delegation instead of naming one', 'tuple.address',
    () => ({ flagged: inList(policy.delegate_allowlist, delegate) !== true, observed: delegate, policy: policy.delegate_allowlist.map(lower) }));
  C.gated('NONCE_OUT_OF_RANGE', nonce !== null, 'tuple.nonce was not supplied', 'tuple.nonce',
    () => ({ flagged: nonce >= NONCE_CEILING_7702, observed: nonce.toString(), policy: NONCE_CEILING_7702.toString() }));

  const s = sig === null ? null : q(sig.s);
  const yParity = sig === null || sig.y_parity === undefined || sig.y_parity === null ? null : q(sig.y_parity);
  C.gated('EIP2_HIGH_S', s !== null, 'signature.s was not supplied', 'signature.s',
    () => ({ flagged: s > SECP256K1N_HALF, observed: '0x' + pad32(s), policy: 'the low-s half order; a tuple above it is skipped by clients' }));
  C.gated('Y_PARITY_OUT_OF_RANGE', yParity !== null, 'signature.y_parity was not supplied', 'signature.y_parity',
    () => ({ flagged: yParity !== 0n && yParity !== 1n, observed: yParity.toString(), policy: '0 or 1' }));

  for (const id of ['MESSAGE_FIELD_NOT_IN_TYPES', 'MESSAGE_FIELD_MISSING', 'LOOKALIKE_TYPE', 'UNRECOGNIZED_TYPE',
    'CHAIN_MISMATCH_ACTIVE', 'CHAIN_NOT_ALLOWED', 'VERIFYING_CONTRACT_NOT_ALLOWED', 'PERMIT2_DOMAIN_SHAPE',
    'UNLIMITED_AMOUNT', 'AMOUNT_ABOVE_POLICY', 'NO_EXPIRY', 'VALIDITY_BEYOND_POLICY', 'EXPIRED', 'NOT_YET_VALID',
    'SPENDER_NOT_ALLOWLISTED', 'PAYEE_NOT_ALLOWLISTED', 'SPENDER_NOT_DECLARED_CONTRACT', 'EIP3009_TRANSFER_TO_CONTRACT',
    'HIGH_S', 'V_FORM_RAW_YPARITY', 'NON_ECDSA_LENGTH', 'ERC6492_WRAPPED',
    'X402_METHOD_NOT_OFFLINE_CHECKABLE', 'X402_AMOUNT_MISMATCH', 'X402_PAYTO_MISMATCH', 'X402_ASSET_MISMATCH',
    'X402_NETWORK_MISMATCH', 'PAYLOAD_DIVERGES_FROM_INTENT', 'ERC7730_DESCRIPTOR_MISMATCH']) {
    C.add(id, 'NOT_EVALUATED', 'mode', null, 'these checks read structured data; this payload is a delegation tuple', 'structure');
  }

  const display = [];
  if (chainId !== null) display.push({ path: 'tuple.chain_id', label: 'Chain', format: 'chainId', value: chainId.toString(), params: {} });
  if (delegate !== null) display.push({ path: 'tuple.address', label: 'Delegate', format: 'addressName', value: delegate, params: { raw: delegate } });

  const handoffs = {};
  handoffs.art_614 = {
    chainId: chainId === null ? null : chainId.toString(),
    address: delegate,
    nonce: nonce === null ? null : nonce.toString(),
    r: sig !== null && isStr(sig.r) ? lower(sig.r) : null,
    s: sig !== null && isStr(sig.s) ? lower(sig.s) : null,
    yParity: yParity === null ? null : Number(yParity),
  };

  return {
    checks: C.rows,
    classification: {
      standard: 'EIP7702_AUTHORIZATION_TUPLE',
      primary_type: null,
      encode_type: null,
      witness_type: null,
      witness_is_named_payment_witness: false,
      lookalike: false,
      entry_count: null,
      payment_method: 'not_detected',
    },
    display,
    handoffs,
    signature_form: null,
  };
}

// ---------- mode: raw_hash ----------
function lintRawHash(pp, warnings) {
  const C = makeChecks();
  const raw = isStr(pp.raw_hash) ? pp.raw_hash.trim() : null;
  const wellFormed = raw !== null && /^0x[0-9a-fA-F]{64}$/.test(raw);
  if (raw !== null && !wellFormed) warnings.push('raw_hash is not a 32-byte hex value; it is echoed as supplied');
  if (raw === null) warnings.push('raw_hash was not supplied; the payload is still reported as a blind signing request because the declared mode says so');

  C.add('BLIND_SIGNATURE', 'FLAGGED', 'raw_hash', wellFormed ? lower(raw) : raw,
    'a bare hash carries no readable structure, so nothing about what is being authorized can be checked', 'structure');

  for (const id of ['MESSAGE_FIELD_NOT_IN_TYPES', 'MESSAGE_FIELD_MISSING', 'LOOKALIKE_TYPE', 'UNRECOGNIZED_TYPE',
    'CHAIN_MISMATCH_ACTIVE', 'CHAIN_NOT_ALLOWED', 'VERIFYING_CONTRACT_NOT_ALLOWED', 'PERMIT2_DOMAIN_SHAPE',
    'UNLIMITED_AMOUNT', 'AMOUNT_ABOVE_POLICY', 'NO_EXPIRY', 'VALIDITY_BEYOND_POLICY', 'EXPIRED', 'NOT_YET_VALID',
    'SPENDER_NOT_ALLOWLISTED', 'PAYEE_NOT_ALLOWLISTED', 'SPENDER_NOT_DECLARED_CONTRACT', 'EIP3009_TRANSFER_TO_CONTRACT',
    'CROSS_CHAIN_AUTHORIZATION', 'DELEGATE_NOT_ALLOWLISTED', 'DELEGATION_CLEAR', 'EIP2_HIGH_S',
    'Y_PARITY_OUT_OF_RANGE', 'NONCE_OUT_OF_RANGE', 'HIGH_S', 'V_FORM_RAW_YPARITY', 'NON_ECDSA_LENGTH',
    'ERC6492_WRAPPED', 'X402_METHOD_NOT_OFFLINE_CHECKABLE', 'X402_AMOUNT_MISMATCH', 'X402_PAYTO_MISMATCH',
    'X402_ASSET_MISMATCH', 'X402_NETWORK_MISMATCH', 'PAYLOAD_DIVERGES_FROM_INTENT', 'ERC7730_DESCRIPTOR_MISMATCH']) {
    C.add(id, 'NOT_EVALUATED', 'raw_hash', null, 'a bare hash exposes no field to read', 'structure');
  }

  return {
    checks: C.rows,
    classification: {
      standard: 'BLIND_HASH',
      primary_type: null,
      encode_type: null,
      witness_type: null,
      witness_is_named_payment_witness: false,
      lookalike: false,
      entry_count: null,
      payment_method: 'not_detected',
    },
    // No display rows: the clear-signing vocabulary has no format for an opaque hash, and
    // inventing one would imply the bytes had been read.
    display: [],
    handoffs: {},
    signature_form: null,
  };
}

/**
 * compute(pp) -- pure lint_authorization_payload kernel.
 * pp: {
 *   mode: 'typed_data' | 'eip7702_tuple' | 'raw_hash',   -- mandatory, never inferred
 *   typed_data?: { domain, types, primaryType, message },
 *   tuple?: { chain_id, address, nonce },
 *   raw_hash?: '0x...32 bytes',
 *   signature?: hex string (typed_data) | { r, s, y_parity } (tuple),
 *   policy?: { ...every member optional; an absent member makes its checks NOT_EVALUATED },
 *   display_hints?: { token_decimals, token_ticker, address_labels },
 * }
 */
export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const warnings = [];
  const policy = isObj(pp.policy) ? pp.policy : {};

  const modeRaw = isStr(pp.mode) ? pp.mode.trim() : null;
  const mode = modeRaw !== null && MODES.indexOf(modeRaw) !== -1 ? modeRaw : null;

  if (mode === null) {
    const compliance_flags = [];
    compliance_flags.push('MODE_NOT_DECLARED');
    return {
      output_payload: {
        mode: null,
        classification: {
          standard: 'NOT_CLASSIFIED', primary_type: null, encode_type: null, witness_type: null,
          witness_is_named_payment_witness: false, lookalike: false, entry_count: null, payment_method: 'not_detected',
        },
        checks: [],
        not_evaluated: [],
        evaluated_count: 0,
        flagged_count: 0,
        policy_conformance: 'INDETERMINATE',
        display: [],
        handoffs: {},
        signature_form: null,
        warnings: ['mode is required and must be one of ' + MODES.join(', ') + '; nothing was read'],
        scope_note: SCOPE_NOTE,
      },
      compliance_flags,
    };
  }

  let r;
  if (mode === 'typed_data') r = lintTypedData(pp, policy, warnings);
  else if (mode === 'eip7702_tuple') r = lintTuple(pp, policy, warnings);
  else r = lintRawHash(pp, warnings);

  const checks = r.checks.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const notEvaluated = [];
  let flagged = 0;
  let evaluated = 0;
  const flaggedIds = [];
  for (const c of checks) {
    if (c.status === 'NOT_EVALUATED') { notEvaluated.push(c.id); continue; }
    evaluated += 1;
    if (c.status === 'FLAGGED') { flagged += 1; flaggedIds.push(c.id); }
  }

  let conformance;
  if (evaluated === 0) conformance = 'INDETERMINATE';
  else if (flagged > 0) conformance = 'DEVIATES';
  else conformance = 'CONFORMS';

  if (notEvaluated.length > 0) {
    warnings.push(notEvaluated.length + ' check(s) could not be evaluated because a declared input was absent; they are listed in not_evaluated and are never counted as CLEAR');
  }

  // FLAGS-COMPUTED-LINT-1 shape: every flag below is earned by the branch that produced it.
  const compliance_flags = [];
  if (conformance === 'DEVIATES') compliance_flags.push('PAYLOAD_DEVIATES_FROM_DECLARED_POLICY');
  if (conformance === 'CONFORMS') compliance_flags.push('PAYLOAD_CONFORMS_TO_DECLARED_POLICY');
  if (conformance === 'INDETERMINATE') compliance_flags.push('PAYLOAD_LINT_INDETERMINATE');
  for (const id of flaggedIds) compliance_flags.push('FLAGGED_' + id);

  return {
    output_payload: {
      mode,
      classification: r.classification,
      checks,
      not_evaluated: notEvaluated,
      evaluated_count: evaluated,
      flagged_count: flagged,
      policy_conformance: conformance,
      display: r.display,
      handoffs: r.handoffs,
      signature_form: r.signature_form,
      warnings,
      scope_note: SCOPE_NOTE,
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
