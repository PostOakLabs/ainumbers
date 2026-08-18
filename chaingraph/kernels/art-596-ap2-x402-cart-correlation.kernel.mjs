import { executionHash } from './_hash.mjs';

// cgCanon inlined (not imported) -- the chaingraph/vm QuickJS guest's ESM-strip only injects
// the ./_hash.mjs bindings it knows about (executionHash), not cgCanon, and compute() must stay
// fully synchronous and self-contained per RIDER-KERNEL #6 / the art-476 lesson. Byte-identical
// to _hash.mjs's own cgCanon -- pure recursive key-sort, no crypto, safe to duplicate verbatim.
const cgCanon = (v) =>
  Array.isArray(v) ? v.map(cgCanon)
  : (v && typeof v === 'object')
    ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {})
    : v;

// Vendored: @noble/hashes (utils.js, _u64.js, sha3.js -- keccak_256 only) v2.2.0 (MIT,
// (c) Paul Miller paulmillr.com). Source: https://github.com/paulmillr/noble-hashes,
// pinned to npm tag v2.2.0 -- same pin already vendored in
// chaingraph/kernels/art-590-x402-eip712-digest-recomputer.kernel.mjs and
// chaingraph/kernels/art-595-ap2-cartmandate-hashchain-builder.kernel.mjs (this row reuses the
// SAME cart-hash-chain algorithm art-595 defines, to independently re-derive cart_chain_intact
// rather than trust the CartMandate's own self-reported flag -- SO #34's independent-derivation
// rule: a correlation check that merely echoed a self-attested cart_chain_intact field would be a
// self-consistent checker, not an independent one). `utf8ToBytes` uses the validated pure-JS
// encoder (ART595-ART590-UTF8-FIX-1) instead of `new TextEncoder()`, which the zkVM guest does not
// reliably provide. Every other function in this block is unmodified vendored source.
// License: MIT, (c) Paul Miller paulmillr.com. Full text:
// https://github.com/paulmillr/noble-hashes/blob/main/LICENSE

// ── keccak_256, vendored inline (see header) ────────────────────────────────────────────
// ---- @noble/hashes utils.js (v2.2.0, MIT, Paul Miller) ----
function isBytes_(a) {
    return (a instanceof Uint8Array ||
        (ArrayBuffer.isView(a) &&
            a.constructor.name === 'Uint8Array' &&
            'BYTES_PER_ELEMENT' in a &&
            a.BYTES_PER_ELEMENT === 1));
}
function anumber(n, title = '') {
    if (typeof n !== 'number') {
        const prefix = title && `"${title}" `;
        throw new TypeError(`${prefix}expected number, got ${typeof n}`);
    }
    if (!Number.isSafeInteger(n) || n < 0) {
        const prefix = title && `"${title}" `;
        throw new RangeError(`${prefix}expected integer >= 0, got ${n}`);
    }
}
function abytes(value, length, title = '') {
    const bytes = isBytes_(value);
    const len = value?.length;
    const needsLen = length !== undefined;
    if (!bytes || (needsLen && len !== length)) {
        const prefix = title && `"${title}" `;
        const ofLen = needsLen ? ` of length ${length}` : '';
        const got = bytes ? `length=${len}` : `type=${typeof value}`;
        const message = prefix + 'expected Uint8Array' + ofLen + ', got ' + got;
        if (!bytes)
            throw new TypeError(message);
        throw new RangeError(message);
    }
    return value;
}
function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
function aoutput(out, instance) {
    abytes(out, undefined, 'digestInto() output');
    const min = instance.outputLen;
    if (out.length < min) {
        throw new RangeError('"digestInto() output" expected to be of length >=' + min);
    }
}
function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
const isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
function byteSwap(word) {
    return (((word << 24) & 0xff000000) |
        ((word << 8) & 0xff0000) |
        ((word >>> 8) & 0xff00) |
        ((word >>> 24) & 0xff));
}
function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = byteSwap(arr[i]);
    }
    return arr;
}
const swap32IfBE = isLE
    ? (u) => u
    : byteSwap32;
const hasHexBuiltin = /* @__PURE__ */ (() =>
// @ts-ignore
typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
function bytesToHex_(bytes) {
    abytes(bytes);
    // @ts-ignore
    if (hasHexBuiltin)
        return bytes.toHex();
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
    }
    return hex;
}
function utf8ToBytes(str) {
    if (typeof str !== 'string')
        throw new TypeError('string expected');
    // Was `new Uint8Array(new TextEncoder().encode(str))`. Replaced -- the zkVM guest does not
    // provide a working TextEncoder at this call site (ART595-GUEST-ERROR-1-2026-08-13.md).
    // Pure-JS UTF-8 encoder, validated byte-identical to TextEncoder.encode across ASCII,
    // 2/3/4-byte sequences, surrogate pairs, and lone surrogates (ART595-ART590-UTF8-FIX-1).
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
            if (next >= 0xdc00 && next <= 0xdfff) {
                code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
                i++;
            }
            else {
                code = 0xfffd; // unpaired high surrogate
            }
        }
        else if (code >= 0xdc00 && code <= 0xdfff) {
            code = 0xfffd; // lone low surrogate
        }
        if (code < 0x80) {
            bytes.push(code);
        }
        else if (code < 0x800) {
            bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        }
        else if (code < 0x10000) {
            bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
        else {
            bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
    }
    return Uint8Array.from(bytes);
}
function concatBytes_(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        abytes(a);
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}
function createHasher(hashCons, info = {}) {
    const hashC = (msg, opts) => hashCons(opts)
        .update(msg)
        .digest();
    const tmp = hashCons(undefined);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
}

// ---- @noble/hashes _u64.js (v2.2.0, MIT, Paul Miller) ----
function fromBig(n, le = false) {
    if (le)
        return { h: Number(n & BigInt(2 ** 32 - 1)), l: Number((n >> BigInt(32)) & BigInt(2 ** 32 - 1)) };
    return { h: Number((n >> BigInt(32)) & BigInt(2 ** 32 - 1)) | 0, l: Number(n & BigInt(2 ** 32 - 1)) | 0 };
}
function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
        const { h, l } = fromBig(lst[i], le);
        [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
}
const rotlSH = (h, l, s) => (h << s) | (l >>> (32 - s));
const rotlSL = (h, l, s) => (l << s) | (h >>> (32 - s));
const rotlBH = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));
const rotlBL = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));

// ---- @noble/hashes sha3.js (v2.2.0, MIT, Paul Miller) -- Keccak/SHA3 ----
const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const _7n = BigInt(7);
const _256n = BigInt(256);
const _0x71n = BigInt(0x71);
const SHA3_PI = [];
const SHA3_ROTL = [];
const _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
    let t = _0n;
    for (let j = 0; j < 7; j++) {
        R = ((R << _1n) ^ ((R >> _7n) * _0x71n)) % _256n;
        if (R & _2n)
            t ^= _1n << ((_1n << BigInt(j)) - _1n);
    }
    _SHA3_IOTA.push(t);
}
const IOTAS = split(_SHA3_IOTA, true);
const SHA3_IOTA_H = IOTAS[0];
const SHA3_IOTA_L = IOTAS[1];
const rotlH = (h, l, s) => (s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s));
const rotlL = (h, l, s) => (s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s));
function keccakP(s, rounds = 24) {
    anumber(rounds, 'rounds');
    if (rounds < 1 || rounds > 24)
        throw new Error('"rounds" expected integer 1..24');
    const B = new Uint32Array(5 * 2);
    for (let round = 24 - rounds; round < 24; round++) {
        for (let x = 0; x < 10; x++)
            B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
        for (let x = 0; x < 10; x += 2) {
            const idx1 = (x + 8) % 10;
            const idx0 = (x + 2) % 10;
            const B0 = B[idx0];
            const B1 = B[idx0 + 1];
            const Th = rotlH(B0, B1, 1) ^ B[idx1];
            const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
            for (let y = 0; y < 50; y += 10) {
                s[x + y] ^= Th;
                s[x + y + 1] ^= Tl;
            }
        }
        let curH = s[2];
        let curL = s[3];
        for (let t = 0; t < 24; t++) {
            const shift = SHA3_ROTL[t];
            const Th = rotlH(curH, curL, shift);
            const Tl = rotlL(curH, curL, shift);
            const PI = SHA3_PI[t];
            curH = s[PI];
            curL = s[PI + 1];
            s[PI] = Th;
            s[PI + 1] = Tl;
        }
        for (let y = 0; y < 50; y += 10) {
            const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
            s[y] ^= ~s[y + 2] & s[y + 4];
            s[y + 1] ^= ~s[y + 3] & s[y + 5];
            s[y + 2] ^= ~s[y + 4] & s[y + 6];
            s[y + 3] ^= ~s[y + 5] & s[y + 7];
            s[y + 4] ^= ~s[y + 6] & s[y + 8];
            s[y + 5] ^= ~s[y + 7] & s[y + 9];
            s[y + 6] ^= ~s[y + 8] & b0;
            s[y + 7] ^= ~s[y + 9] & b1;
            s[y + 8] ^= ~b0 & b2;
            s[y + 9] ^= ~b1 & b3;
        }
        s[0] ^= SHA3_IOTA_H[round];
        s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
}
class Keccak {
    state;
    pos = 0;
    posOut = 0;
    finished = false;
    state32;
    destroyed = false;
    blockLen;
    suffix;
    outputLen;
    canXOF;
    enableXOF = false;
    rounds;
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.canXOF = enableXOF;
        this.rounds = rounds;
        anumber(outputLen, 'outputLen');
        if (!(0 < blockLen && blockLen < 200))
            throw new Error('only keccak-f1600 function is supported');
        this.state = new Uint8Array(200);
        this.state32 = u32(this.state);
    }
    keccak() {
        swap32IfBE(this.state32);
        keccakP(this.state32, this.rounds);
        swap32IfBE(this.state32);
        this.posOut = 0;
        this.pos = 0;
    }
    update(data) {
        aexists(this);
        abytes(data);
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            for (let i = 0; i < take; i++)
                state[this.pos++] ^= data[pos++];
            if (this.pos === blockLen)
                this.keccak();
        }
        return this;
    }
    finish() {
        if (this.finished)
            return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        state[pos] ^= suffix;
        if ((suffix & 0x80) !== 0 && pos === blockLen - 1)
            this.keccak();
        state[blockLen - 1] ^= 0x80;
        this.keccak();
    }
    writeInto(out) {
        aexists(this, false);
        abytes(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len;) {
            if (this.posOut >= blockLen)
                this.keccak();
            const take = Math.min(blockLen - this.posOut, len - pos);
            out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
            this.posOut += take;
            pos += take;
        }
        return out;
    }
    digestInto(out) {
        aoutput(out, this);
        if (this.finished)
            throw new Error('digest() was already called');
        this.writeInto(out.subarray(0, this.outputLen));
        this.destroy();
    }
    digest() {
        const out = new Uint8Array(this.outputLen);
        this.digestInto(out);
        return out;
    }
    destroy() {
        this.destroyed = true;
        clean(this.state);
    }
}
const genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info);
const keccak_256 = /* @__PURE__ */ genKeccak(0x01, 136, 32);

// art-596 -- AP2 x402 Cart Correlation: pure decision kernel.
// Consumes a built AP2 CartMandate (cart_root, cart_items, merchant -- the fields art-595's
// output_payload/credentialSubject carries) and an x402_spend_evidence object (the caller-
// assembled pack from the x402-spend-evidence chain, BUILD-X402-SPENDEVIDENCE-CHAIN-1). Checks
// whether fields that SHOULD agree if the two artifacts describe the same real-world transaction
// actually agree: does sum(quantity*unit_price) per currency match authorization.value; does
// merchant map to authorization.to. cart_chain_intact is INDEPENDENTLY RE-DERIVED here by
// recomputing the cart hash-chain from cart_items (SAME algorithm as art-595's compute()) and
// comparing against the caller-supplied cart_root -- never trusted as a self-reported flag from
// the CartMandate (a checker must recompute the value it validates, not read the artifact's own
// claim about itself).
//
// ⛔⛔ CORRELATION, NOT VERIFICATION. Google has not shipped an AP2-compatible x402 extension;
// no kernel anywhere in this repo, and no published AP2 spec text, defines a cryptographic
// binding between an AP2 mandate and an x402 payment authorization. This kernel's verdict field
// is CORRELATION_STATUS (CORRELATED / NOT_CORRELATED / INDETERMINATE) -- NEVER a word implying
// cryptographic linkage. A party could present a valid CartMandate alongside an unrelated valid
// x402 authorization and this check would still report CORRELATED: no signature, hash, or
// on-chain reference ties this specific CartMandate to this specific x402 authorization.
//
// ⛔⛔ Never a facilitator/proxy/settlement relay/gateway. Zero network. Operates only on
// caller-supplied bytes -- no merchant catalog fetch, no live lookup of a merchant's settlement
// address, no submission anywhere.

const TOOL_ID = 'art-596-ap2-x402-cart-correlation';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'correlate_ap2_cartmandate_x402',
  mandate_type: 'compliance_control',
  gpu: false,
};

const DISCLOSURE = 'This tool observes that the cart total and merchant identity are consistent with the x402 authorization\'s amount and recipient. It does not cryptographically bind the two -- no signature, hash, or on-chain reference ties this specific CartMandate to this specific x402 authorization. A party could present a valid CartMandate alongside an unrelated valid x402 authorization and this check would still report CORRELATED.';

function str(v, fallback = null) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

function _canonBytes(obj) {
  return utf8ToBytes(JSON.stringify(cgCanon(obj)));
}

function _validateItem(item, index, reasons) {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    reasons.push(`cart_items[${index}] must be an object`);
    return null;
  }
  const sku = str(item.sku, null);
  const description = str(item.description, null);
  const currency = str(item.currency, null);
  const quantity = typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : null;
  const unit_price = typeof item.unit_price === 'number' && Number.isFinite(item.unit_price) && item.unit_price >= 0 ? item.unit_price : null;
  if (!sku) reasons.push(`cart_items[${index}].sku is required (non-empty string)`);
  if (!description) reasons.push(`cart_items[${index}].description is required (non-empty string)`);
  if (!currency) reasons.push(`cart_items[${index}].currency is required (non-empty string)`);
  if (quantity === null) reasons.push(`cart_items[${index}].quantity is required and must be a positive finite number`);
  if (unit_price === null) reasons.push(`cart_items[${index}].unit_price is required and must be a non-negative finite number`);
  if (!sku || !description || !currency || quantity === null || unit_price === null) return null;
  return { sku, description, quantity, unit_price, currency };
}

function _recomputeCartChain(cart_items) {
  const links = [];
  for (let i = 0; i < cart_items.length; i++) {
    const preimage = i === 0
      ? { index: 0, item: cart_items[0] }
      : { index: i, item: cart_items[i], prev: links[i - 1] };
    links.push('0x' + bytesToHex_(keccak_256(_canonBytes(preimage))));
  }
  return links;
}

function _stripHexPrefix(hex) {
  const s = String(hex ?? '');
  return s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
}

function _normalizeAddress(v) {
  if (typeof v !== 'string') return null;
  const s = _stripHexPrefix(v.trim());
  if (!/^[0-9a-fA-F]{40}$/.test(s)) return null;
  return '0x' + s.toLowerCase();
}

// Sum quantity*unit_price per currency. Returns { singleCurrency: string|null, total: number|null }
// -- null total when cart_items span more than one currency (no single number to compare against
// a single authorization.value; ambiguous, not a defect -- reported as indeterminate, never guessed).
function _cartTotalsByCurrency(cart_items) {
  const currencies = new Set(cart_items.map((it) => it.currency));
  if (currencies.size !== 1) return { singleCurrency: null, total: null };
  const [currency] = currencies;
  let total = 0;
  for (const it of cart_items) total += it.quantity * it.unit_price;
  total = Math.round(total * 1e8) / 1e8; // clear float dust without hiding real mismatches
  return { singleCurrency: currency, total };
}

export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const reasons = [];

  const cart_root = str(pp.cart_root, null);
  if (!cart_root) reasons.push('cart_root is required (the built CartMandate\'s own cart_root, e.g. from art-595)');

  const merchant = str(pp.merchant, null);
  if (!merchant) reasons.push('merchant is required (the built CartMandate\'s own merchant field)');

  const rawItems = Array.isArray(pp.cart_items) ? pp.cart_items : null;
  if (!rawItems || rawItems.length === 0) reasons.push('cart_items is required and must be a non-empty array');

  const cart_items = [];
  if (rawItems) {
    for (let i = 0; i < rawItems.length; i++) {
      const item = _validateItem(rawItems[i], i, reasons);
      if (item) cart_items.push(item);
    }
  }
  const evidence = (pp.x402_spend_evidence !== null && typeof pp.x402_spend_evidence === 'object') ? pp.x402_spend_evidence : null;
  if (!evidence) reasons.push('x402_spend_evidence is required (the caller-assembled §8-shaped object from the x402-spend-evidence chain)');
  const authorization = evidence && evidence.authorization !== null && typeof evidence.authorization === 'object' ? evidence.authorization : null;
  if (evidence && !authorization) reasons.push('x402_spend_evidence.authorization is required');

  if (reasons.length > 0) {
    return {
      output_payload: {
        correlation_status: 'INDETERMINATE',
        cart_total_matches_authorization_value: null,
        merchant_matches_authorization_to: null,
        cart_chain_intact: false,
        disclosure: DISCLOSURE,
        reasons,
      },
      compliance_flags: ['AP2_X402_CORRELATION_INDETERMINATE', 'AP2_X402_MALFORMED_INPUT'],
    };
  }

  // ── cart_chain_intact: independently re-derived, never trusted from the CartMandate's own
  // self-reported flag (SO #34 independent-derivation rule) ──
  const recomputedLinks = _recomputeCartChain(cart_items);
  const recomputedCartRoot = recomputedLinks[recomputedLinks.length - 1] ?? null;
  const cart_chain_intact = recomputedCartRoot !== null && recomputedCartRoot === cart_root;

  // ── cart total vs authorization.value ──
  const { singleCurrency, total } = _cartTotalsByCurrency(cart_items);
  const authValue = authorization && (typeof authorization.value === 'string' || typeof authorization.value === 'number')
    ? Number(authorization.value)
    : null;
  let cart_total_matches_authorization_value = null;
  if (total !== null && authValue !== null && Number.isFinite(authValue)) {
    cart_total_matches_authorization_value = Math.abs(total - authValue) < 1e-6;
  }

  // ── merchant vs authorization.to ──
  // No merchant->address registry exists here (zero network, out of scope by design) -- a decisive answer is
  // only possible when the caller supplied merchant as an on-chain address itself (the shape a
  // real x402-paid CartMandate would use for its settlement party). Anything else is honestly
  // INDETERMINATE, not guessed at via a free-text string compare.
  const merchantAddr = _normalizeAddress(merchant);
  const toAddr = authorization ? _normalizeAddress(authorization.to) : null;
  let merchant_matches_authorization_to = null;
  if (merchantAddr && toAddr) {
    merchant_matches_authorization_to = merchantAddr === toAddr;
  }

  const checks = [cart_chain_intact, cart_total_matches_authorization_value, merchant_matches_authorization_to];
  let correlation_status;
  if (checks.some((c) => c === false)) {
    correlation_status = 'NOT_CORRELATED';
  } else if (checks.every((c) => c === true)) {
    correlation_status = 'CORRELATED';
  } else {
    correlation_status = 'INDETERMINATE';
  }

  const output_payload = {
    correlation_status,
    cart_total_matches_authorization_value,
    merchant_matches_authorization_to,
    cart_chain_intact,
    disclosure: DISCLOSURE,
    reasons: [],
  };

  const compliance_flags = [
    cart_chain_intact ? 'CART_CHAIN_INTACT' : 'CART_CHAIN_BROKEN',
    cart_total_matches_authorization_value === true ? 'CART_TOTAL_MATCH'
      : cart_total_matches_authorization_value === false ? 'CART_TOTAL_MISMATCH' : 'CART_TOTAL_INDETERMINATE',
    merchant_matches_authorization_to === true ? 'MERCHANT_MATCH'
      : merchant_matches_authorization_to === false ? 'MERCHANT_MISMATCH' : 'MERCHANT_INDETERMINATE',
    correlation_status === 'CORRELATED' ? 'AP2_X402_CORRELATED'
      : correlation_status === 'NOT_CORRELATED' ? 'AP2_X402_NOT_CORRELATED' : 'AP2_X402_CORRELATION_INDETERMINATE',
  ];

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
