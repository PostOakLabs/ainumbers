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
// chaingraph/kernels/_noble-secp256k1.bundle.mjs (SPEC-X402-CRYPTO-CORE-1-2026-08-09.md
// section 3: reuse the existing vendored bundle, no second copy) and re-inlined for the same
// reason art-590 re-inlines it (RIDER-KERNEL #6 / the art-476 lesson: the chaingraph/vm QuickJS
// guest's ESM-strip only expects a kernel to import from ./_hash.mjs, and compute() must stay
// fully synchronous). Byte-identical to chaingraph/kernels/art-590-x402-eip712-digest-recomputer
// .kernel.mjs's copy of the same block, not hand-edited -- EXCEPT `utf8ToBytes`, which both
// files patch identically away from the pristine vendored source (see its own comment,
// ART595-ART590-UTF8-FIX-1-2026-08-13): the original called `new TextEncoder()`, which the
// zkVM guest does not reliably provide, so both copies now use a validated pure-JS UTF-8
// encoder instead. Every other function in this block is unmodified vendored source.
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
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
        return ch - asciis._0;
    if (ch >= asciis.A && ch <= asciis.F)
        return ch - (asciis.A - 10);
    if (ch >= asciis.a && ch <= asciis.f)
        return ch - (asciis.a - 10);
    return;
}
function hexToBytes_(hex) {
    if (typeof hex !== 'string')
        throw new TypeError('hex string expected, got ' + typeof hex);
    if (hasHexBuiltin) {
        try {
            return Uint8Array.fromHex(hex);
        }
        catch (error) {
            if (error instanceof SyntaxError)
                throw new RangeError(error.message);
            throw error;
        }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
        throw new RangeError('hex string expected, got unpadded hex of length ' + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === undefined || n2 === undefined) {
            const char = hex[hi] + hex[hi + 1];
            throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2;
    }
    return array;
}
function utf8ToBytes(str) {
    if (typeof str !== 'string')
        throw new TypeError('string expected');
    // Was `new Uint8Array(new TextEncoder().encode(str))`. Replaced -- the zkVM guest does not
    // provide a working TextEncoder at this call site (ART595-GUEST-ERROR-1-2026-08-13.md,
    // confirmed with the real proving stack trace: utf8ToBytes -> _canonBytes -> compute).
    // Pure-JS UTF-8 encoder, validated byte-identical to TextEncoder.encode across ASCII,
    // 2/3/4-byte sequences, surrogate pairs, and lone surrogates (which TextEncoder replaces
    // with U+FFFD, reproduced here) -- 22 named cases + 20,000 randomized fuzz cases against
    // Node's native TextEncoder, zero mismatches (ART595-ART590-UTF8-FIX-1-2026-08-13).
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
const oidNist = (suffix) => ({
    oid: Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, suffix]),
});

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

// art-595 -- AP2 CartMandate Hash-Chain Builder: pure decision kernel.
// SPEC-AGENT-COMMERCE-CHAIN-1-2026-08-09.md §5: an ordered-item hash-chain over cart_items[],
//   link_0 = keccak256(canon({index:0,item:cart_items[0]}))
//   link_i = keccak256(canon({index:i,item:cart_items[i],prev:link_(i-1)}))
//   cart_root = link_(n-1)
// canon(...) is the SAME RFC 8785/JCS cgCanon() this repo's _hash.mjs executionHash() already
// uses (imported directly -- cgCanon is pure sync JS, no crypto.subtle call, so importing it
// does not violate the fully-synchronous-compute() rule the async digest inlining exists for).
// keccak256 is the SAME vendored @noble/hashes bundle SPEC-X402-CRYPTO-CORE-1 §3 already named.
// Never a facilitator/proxy/settlement relay/gateway (spec §4). Zero network. Operates only on
// caller-supplied cart_items -- no merchant catalog fetch, no submission anywhere. A CartMandate
// hash-chain proves the ordered item list was not altered after the chain was built; nothing
// about authorization, delivery, settlement, or price correctness (spec §5). New node beside
// art-16 (spec §3) -- art-16's kernel file is untouched by this build.

const TOOL_ID = 'art-595-ap2-cartmandate-hashchain-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'build_ap2_cartmandate_hashchain',
  mandate_type: 'payment_policy',
  gpu: false,
};

const SCOPE_NOTE = 'Illustrative AP2 CartMandate hash-chain skeleton (external Google AP2 payments-protocol shape, ap2-protocol.org) -- distinct from the AINumbers Policy Mandate. This chain proves the ordered cart_items list was not altered after the chain was built -- nothing more. It does NOT prove the mandate was authorised by a human, that goods were delivered, that the merchant accepted the cart, that any payment occurred, or that item prices are correct or current (unit_price is caller-supplied, unchecked against any catalog). Zero network calls; never a facilitator, proxy, gateway, or settlement relay. Sign with the agent key and verify against the live AP2 spec before real use.';

function str(v, fallback) {
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

export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const reasons = [];

  const stage = pp.stage === 'closed' ? 'closed' : 'open';
  const agent_id = str(pp.agent_id, 'did:example:agent');
  const subject = str(pp.subject, 'did:example:subject');
  const merchant = str(pp.merchant, 'example-merchant');

  const rawItems = Array.isArray(pp.cart_items) ? pp.cart_items : null;
  if (!rawItems || rawItems.length === 0) {
    reasons.push('cart_items is required and must be a non-empty array');
  }

  const cart_items = [];
  if (rawItems) {
    for (let i = 0; i < rawItems.length; i++) {
      const item = _validateItem(rawItems[i], i, reasons);
      if (item) cart_items.push(item);
    }
  }

  // Optional broken-link check: caller supplies claimed_links, the per-item chain a prior
  // run of this kernel produced, to be re-verified against a (possibly tampered) cart_items.
  const claimed_links = Array.isArray(pp.claimed_links) ? pp.claimed_links : null;

  if (reasons.length > 0) {
    return {
      output_payload: {
        vdc: null,
        vdc_type: 'CartMandate',
        cart_root: null,
        chain_length: 0,
        chain_links: [],
        cart_chain_intact: null,
        first_divergent_index: null,
        note: SCOPE_NOTE,
        reasons,
      },
      compliance_flags: ['CARTMANDATE_INDETERMINATE', 'CARTMANDATE_MALFORMED_INPUT'],
    };
  }

  const links = [];
  for (let i = 0; i < cart_items.length; i++) {
    const preimage = i === 0
      ? { index: 0, item: cart_items[0] }
      : { index: i, item: cart_items[i], prev: links[i - 1] };
    links.push('0x' + bytesToHex_(keccak_256(_canonBytes(preimage))));
  }
  const cart_root = links[links.length - 1];

  let cart_chain_intact = true;
  let first_divergent_index = null;
  if (claimed_links) {
    const n = Math.max(claimed_links.length, links.length);
    for (let i = 0; i < n; i++) {
      if (claimed_links[i] !== links[i]) {
        cart_chain_intact = false;
        first_divergent_index = i;
        break;
      }
    }
  }

  const credentialSubject = {
    id: subject,
    mandateType: 'cart',
    stage,
    merchant,
    cart_items,
    cart_root,
    chain_length: cart_items.length,
  };

  const vdc = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://ap2-protocol.org/context/v1'],
    type: ['VerifiableCredential', 'CartMandate'],
    issuer: agent_id,
    credentialSubject,
    proof: {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-2022',
      verificationMethod: `${agent_id}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: '<ILLUSTRATIVE — sign with the agent key>',
    },
  };

  const output_payload = {
    vdc,
    vdc_type: 'CartMandate',
    cart_root,
    chain_length: cart_items.length,
    chain_links: links,
    cart_chain_intact,
    first_divergent_index,
    note: SCOPE_NOTE,
    reasons: [],
  };

  const compliance_flags = ['CARTMANDATE_CHAIN_BUILT'];
  compliance_flags.push(stage === 'closed' ? 'STAGE_CLOSED' : 'STAGE_OPEN');
  compliance_flags.push(cart_chain_intact ? 'CART_CHAIN_INTACT' : 'CART_CHAIN_BROKEN');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    compute_proof_ready: 'deferred',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
