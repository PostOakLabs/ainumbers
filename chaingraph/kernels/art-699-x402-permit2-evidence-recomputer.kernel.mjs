import { executionHash } from './_hash.mjs';

// art-699 -- x402 Permit2 evidence recomputer: pure decision kernel.
//
// Recomputes the typed-data digest a payer's wallet signs for the three single-item Permit2
// message shapes used by the x402 exact and upto payment schemes, then reports binding facts
// about that signed message against a caller-declared payment requirement. It never recovers a
// signer (that is the downstream recovery node's job, and this kernel emits the handoff record in
// that node's exact input shape), never reads a chain, and never originates or relays anything.
// Every chain-side fact -- whether a nonce was already spent, what allowance is stored, whether a
// contract has code -- is a caller-declared input that is echoed back. A check whose input is
// absent reports NOT_EVALUATED and never a pass.
//
// Wording discipline: this kernel recomputes and compares. It never reports that a payment is
// valid, approved, accepted, settled or final.
//
// secp256k1 keccak256 is vendored (@noble/hashes, MIT, pinned v2.2.0, (c) Paul Miller
// paulmillr.com). The vendored block below is copied byte-identical from
// chaingraph/kernels/art-612-erc2612-permit-binding-verifier.kernel.mjs's own inlined copy, which
// carries the post-sweep pure-JS UTF-8 encoder. Inlined rather than imported: the chaingraph/vm
// QuickJS guest's ESM-strip only expects a kernel to import from ./_hash.mjs, and compute() must
// stay fully synchronous. DO NOT hand-edit the vendored block -- regenerate from
// chaingraph/kernels/_noble-secp256k1.bundle.mjs.
// Full licence text: https://github.com/paulmillr/noble-curves/blob/main/LICENSE
// ---- vendored inline: @noble/hashes keccak256 path only (see header) ----
// ---- @noble/hashes utils.js (v2.2.0, MIT, Paul Miller) ----
/**
 * Checks if something is Uint8Array. Be careful: nodejs Buffer will return true.
 * @param a - value to test
 * @returns `true` when the value is a Uint8Array-compatible view.
 * @example
 * Check whether a value is a Uint8Array-compatible view.
 * ```ts
 * isBytes_(new Uint8Array([1, 2, 3]));
 * ```
 */
function isBytes_(a) {
    // Plain `instanceof Uint8Array` is too strict for some Buffer / proxy / cross-realm cases.
    // The fallback still requires a real ArrayBuffer view, so plain
    // JSON-deserialized `{ constructor: ... }` spoofing is rejected, and
    // `BYTES_PER_ELEMENT === 1` keeps the fallback on byte-oriented views.
    return (a instanceof Uint8Array ||
        (ArrayBuffer.isView(a) &&
            a.constructor.name === 'Uint8Array' &&
            'BYTES_PER_ELEMENT' in a &&
            a.BYTES_PER_ELEMENT === 1));
}
/**
 * Asserts something is a non-negative integer.
 * @param n - number to validate
 * @param title - label included in thrown errors
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a non-negative integer option.
 * ```ts
 * anumber(32, 'length');
 * ```
 */
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
/**
 * Asserts something is Uint8Array.
 * @param value - value to validate
 * @param length - optional exact length constraint
 * @param title - label included in thrown errors
 * @returns The validated byte array.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate that a value is a byte array.
 * ```ts
 * abytes(new Uint8Array([1, 2, 3]));
 * ```
 */
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
/**
 * Copies bytes into a fresh Uint8Array.
 * Buffer-style slices can alias the same backing store, so callers that need ownership should copy.
 * @param bytes - source bytes to clone
 * @returns Freshly allocated copy of `bytes`.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Clone a byte array before mutating it.
 * ```ts
 * const copy = copyBytes_(new Uint8Array([1, 2, 3]));
 * ```
 */
function copyBytes_(bytes) {
    // `Uint8Array.from(...)` would also accept arrays / other typed arrays. Keep this helper strict
    // because callers use it at byte-validation boundaries before mutating the detached copy.
    return Uint8Array.from(abytes(bytes));
}
/**
 * Asserts something is a wrapped hash constructor.
 * @param h - hash constructor to validate
 * @throws On wrong argument types or invalid hash wrapper shape. {@link TypeError}
 * @throws On invalid hash metadata ranges or values. {@link RangeError}
 * @throws If the hash metadata allows empty outputs or block sizes. {@link Error}
 * @example
 * Validate a callable hash wrapper.
 * ```ts
 * import { ahash } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * ahash(sha256);
 * ```
 */
function ahash(h) {
    if (typeof h !== 'function' || typeof h.create !== 'function')
        throw new TypeError('Hash must wrapped by utils.createHasher');
    anumber(h.outputLen);
    anumber(h.blockLen);
    // HMAC and KDF callers treat these as real byte lengths; allowing zero lets fake wrappers pass
    // validation and can produce empty outputs instead of failing fast.
    if (h.outputLen < 1)
        throw new Error('"outputLen" must be >= 1');
    if (h.blockLen < 1)
        throw new Error('"blockLen" must be >= 1');
}
/**
 * Asserts a hash instance has not been destroyed or finished.
 * @param instance - hash instance to validate
 * @param checkFinished - whether to reject finalized instances
 * @throws If the hash instance has already been destroyed or finalized. {@link Error}
 * @example
 * Validate that a hash instance is still usable.
 * ```ts
 * import { aexists } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const hash = sha256.create();
 * aexists(hash);
 * ```
 */
function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
/**
 * Asserts output is a sufficiently-sized byte array.
 * @param out - destination buffer
 * @param instance - hash instance providing output length
 * Oversized buffers are allowed; downstream code only promises to fill the first `outputLen` bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a caller-provided digest buffer.
 * ```ts
 * import { aoutput } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const hash = sha256.create();
 * aoutput(new Uint8Array(hash.outputLen), hash);
 * ```
 */
function aoutput(out, instance) {
    abytes(out, undefined, 'digestInto() output');
    const min = instance.outputLen;
    if (out.length < min) {
        throw new RangeError('"digestInto() output" expected to be of length >=' + min);
    }
}
/**
 * Casts a typed array view to Uint8Array.
 * @param arr - source typed array
 * @returns Uint8Array view over the same buffer.
 * @example
 * Reinterpret a typed array as bytes.
 * ```ts
 * u8(new Uint32Array([1, 2]));
 * ```
 */
function u8(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
/**
 * Casts a typed array view to Uint32Array.
 * `arr.byteOffset` must already be 4-byte aligned or the platform
 * Uint32Array constructor will throw.
 * @param arr - source typed array
 * @returns Uint32Array view over the same buffer.
 * @example
 * Reinterpret a byte array as 32-bit words.
 * ```ts
 * u32(new Uint8Array(8));
 * ```
 */
function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
/**
 * Zeroizes typed arrays in place. Warning: JS provides no guarantees.
 * @param arrays - arrays to overwrite with zeros
 * @example
 * Zeroize sensitive buffers in place.
 * ```ts
 * clean(new Uint8Array([1, 2, 3]));
 * ```
 */
function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
/**
 * Creates a DataView for byte-level manipulation.
 * @param arr - source typed array
 * @returns DataView over the same buffer region.
 * @example
 * Create a DataView over an existing buffer.
 * ```ts
 * createView(new Uint8Array(4));
 * ```
 */
function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
/**
 * Rotate-right operation for uint32 values.
 * @param word - source word
 * @param shift - shift amount in bits
 * @returns Rotated word.
 * @example
 * Rotate a 32-bit word to the right.
 * ```ts
 * rotr(0x12345678, 8);
 * ```
 */
function rotr(word, shift) {
    return (word << (32 - shift)) | (word >>> shift);
}
/**
 * Rotate-left operation for uint32 values.
 * @param word - source word
 * @param shift - shift amount in bits
 * @returns Rotated word.
 * @example
 * Rotate a 32-bit word to the left.
 * ```ts
 * rotl(0x12345678, 8);
 * ```
 */
function rotl(word, shift) {
    return (word << shift) | ((word >>> (32 - shift)) >>> 0);
}
/** Whether the current platform is little-endian. */
const isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
/**
 * Byte-swap operation for uint32 values.
 * @param word - source word
 * @returns Word with reversed byte order.
 * @example
 * Reverse the byte order of a 32-bit word.
 * ```ts
 * byteSwap(0x11223344);
 * ```
 */
function byteSwap(word) {
    return (((word << 24) & 0xff000000) |
        ((word << 8) & 0xff0000) |
        ((word >>> 8) & 0xff00) |
        ((word >>> 24) & 0xff));
}
/**
 * Conditionally byte-swaps one 32-bit word on big-endian platforms.
 * @param n - source word
 * @returns Original or byte-swapped word depending on platform endianness.
 * @example
 * Normalize a 32-bit word for host endianness.
 * ```ts
 * swap8IfBE(0x11223344);
 * ```
 */
const swap8IfBE = isLE
    ? (n) => n
    : (n) => byteSwap(n) >>> 0;
/**
 * Byte-swaps every word of a Uint32Array in place.
 * @param arr - array to mutate
 * @returns The same array after mutation; callers pass live state arrays here.
 * @example
 * Reverse the byte order of every word in place.
 * ```ts
 * byteSwap32(new Uint32Array([0x11223344]));
 * ```
 */
function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = byteSwap(arr[i]);
    }
    return arr;
}
/**
 * Conditionally byte-swaps a Uint32Array on big-endian platforms.
 * @param u - array to normalize for host endianness
 * @returns Original or byte-swapped array depending on platform endianness.
 *   On big-endian runtimes this mutates `u` in place via `byteSwap32(...)`.
 * @example
 * Normalize a word array for host endianness.
 * ```ts
 * swap32IfBE(new Uint32Array([0x11223344]));
 * ```
 */
const swap32IfBE = isLE
    ? (u) => u
    : byteSwap32;
// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
const hasHexBuiltin = /* @__PURE__ */ (() => 
// @ts-ignore
typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
/**
 * Convert byte array to hex string.
 * Uses the built-in function when available and assumes it matches the tested
 * fallback semantics.
 * @param bytes - bytes to encode
 * @returns Lowercase hexadecimal string.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Convert bytes to lowercase hexadecimal.
 * ```ts
 * bytesToHex_(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])); // 'cafe0123'
 * ```
 */
function bytesToHex_(bytes) {
    abytes(bytes);
    // @ts-ignore
    if (hasHexBuiltin)
        return bytes.toHex();
    // pre-caching improves the speed 6x
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
    }
    return hex;
}
// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
        return ch - asciis._0; // '2' => 50-48
    if (ch >= asciis.A && ch <= asciis.F)
        return ch - (asciis.A - 10); // 'B' => 66-(65-10)
    if (ch >= asciis.a && ch <= asciis.f)
        return ch - (asciis.a - 10); // 'b' => 98-(97-10)
    return;
}
/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @param hex - hexadecimal string to decode
 * @returns Decoded bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Decode lowercase hexadecimal into bytes.
 * ```ts
 * hexToBytes_('cafe0123'); // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 * ```
 */
function hexToBytes_(hex) {
    if (typeof hex !== 'string')
        throw new TypeError('hex string expected, got ' + typeof hex);
    if (hasHexBuiltin) {
        try {
            // @ts-ignore
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
        array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
    }
    return array;
}
/**
 * There is no setImmediate in browser and setTimeout is slow.
 * This yields to the Promise/microtask scheduler queue, not to timers or the
 * full macrotask event loop.
 * @example
 * Yield to the next scheduler tick.
 * ```ts
 * await nextTick();
 * ```
 */
const nextTick = async () => { };
/**
 * Converts string to bytes using UTF8 encoding.
 * Built-in doesn't validate input to be string: we do the check.
 * Non-ASCII details are delegated to the platform `TextEncoder`.
 * @param str - string to encode
 * @returns UTF-8 encoded bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Encode a string as UTF-8 bytes.
 * ```ts
 * utf8ToBytes('abc'); // Uint8Array.from([97, 98, 99])
 * ```
 */
function utf8ToBytes(str) {
    if (typeof str !== 'string')
        throw new TypeError('string expected');
    // Was `new Uint8Array(new TextEncoder().encode(str))`. Replaced -- the zkVM guest does not
    // provide a working TextEncoder ANYWHERE, including inside compute() (confirmed via the
    // chaingraph/vm QuickJS-ng harness with TextEncoder genuinely deleted post-prelude,
    // TEXTENCODER-SWEEP-FIX-1-2026-08-13). This kernel was branched BEFORE that fix landed, so it
    // carried the pre-fix noble utils body while art-606/art-607 already carry the corrected one
    // on main; all five of its fixture vectors were guest-fatal here
    // (ART612-GUEST-ERROR-1-2026-08-16, reproduced with check-guest-builtin-safety.mjs before the
    // edit). ART607-EAGER-INIT-FIX-1's lesson applies to the sweep, not to a second fix here: the
    // T1 (module top-level) and T2 (inside compute()) call sites in art-612 both funnel through
    // THIS one function -- the EIP-712 typehash/domain constants at module scope and the runtime
    // domain-separator rebuild in compute() -- so replacing the encoder itself, rather than any
    // single call site, is what closes both levels. Pure-JS UTF-8 encoder, validated
    // byte-identical to TextEncoder.encode across ASCII, 2/3/4-byte sequences, surrogate pairs,
    // and lone surrogates (which TextEncoder replaces with U+FFFD, reproduced here) -- 22 named
    // cases + 20,000 randomized fuzz cases against Node's native TextEncoder, zero mismatches
    // (ART595-ART590-UTF8-FIX-1-2026-08-13); reused verbatim, not re-derived.
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
/**
 * Helper for KDFs: consumes Uint8Array or string.
 * String inputs are UTF-8 encoded; byte-array inputs stay aliased to the caller buffer.
 * @param data - user-provided KDF input
 * @param errorTitle - label included in thrown errors
 * @returns Byte representation of the input.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Normalize KDF input to bytes.
 * ```ts
 * kdfInputToBytes('password');
 * ```
 */
function kdfInputToBytes(data, errorTitle = '') {
    if (typeof data === 'string')
        return utf8ToBytes(data);
    return abytes(data, undefined, errorTitle);
}
/**
 * Copies several Uint8Arrays into one.
 * @param arrays - arrays to concatenate
 * @returns Concatenated byte array.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Concatenate multiple byte arrays.
 * ```ts
 * concatBytes_(new Uint8Array([1]), new Uint8Array([2]));
 * ```
 */
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
/**
 * Merges default options and passed options.
 * @param defaults - base option object
 * @param opts - user overrides
 * @returns Merged option object. The merge mutates `defaults` in place.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Merge user overrides onto default options.
 * ```ts
 * checkOpts({ dkLen: 32 }, { asyncTick: 10 });
 * ```
 */
function checkOpts(defaults, opts) {
    if (opts !== undefined && {}.toString.call(opts) !== '[object Object]')
        throw new TypeError('options must be object or undefined');
    const merged = Object.assign(defaults, opts);
    return merged;
}
/**
 * Creates a callable hash function from a stateful class constructor.
 * @param hashCons - hash constructor or factory
 * @param info - optional metadata such as DER OID
 * @returns Frozen callable hash wrapper with `.create()`.
 *   Wrapper construction eagerly calls `hashCons(undefined)` once to read
 *   `outputLen` / `blockLen`, so constructor side effects happen at module
 *   init time.
 * @example
 * Wrap a stateful hash constructor into a callable helper.
 * ```ts
 * import { createHasher } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const wrapped = createHasher(sha256.create, { oid: sha256.oid });
 * wrapped(new Uint8Array([1]));
 * ```
 */
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
// The bundle's randomness helper is omitted here: nothing in a keccak-only kernel draws random
// bytes, and the guest has no host randomness to draw them from.
/**
 * Creates OID metadata for NIST hashes with prefix `06 09 60 86 48 01 65 03 04 02`.
 * @param suffix - final OID byte for the selected hash.
 *   The helper accepts any byte even though only the documented NIST hash
 *   suffixes are meaningful downstream.
 * @returns Object containing the DER-encoded OID.
 * @example
 * Build OID metadata for a NIST hash.
 * ```ts
 * oidNist(0x01);
 * ```
 */
const oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, suffix]),
});
//# sourceMappingURL=utils.js.map

// ---- Rename/dedup notes (collision-only; values untouched) ----
// @noble/hashes utils.js: bytesToHex/concatBytes/hexToBytes/isBytes/randomBytes/copyBytes ->
//   *_ (trailing underscore) -- these 6 names are ALSO defined by @noble/curves utils.js as its
//   own (behaviourally-identical passthrough) wrappers; renaming the hashes-package originals lets
//   both live in one flattened scope. abytes/anumber were NOT renamed (curves' own abytes/anumber
//   wrappers were deleted instead, see below) because @noble/hashes' sha2.js/sha3.js/hmac.js/_md.js
//   call the plain (unsuffixed) abytes/anumber directly and are NOT touched by this rename.
// @noble/curves utils.js: the 7 pure-passthrough wrapper exports (abytes, anumber, bytesToHex,
//   concatBytes, hexToBytes, isBytes, randomBytes) are DELETED -- each was a one-line passthrough
//   to the identically-behaved @noble/hashes original, so once both packages share one scope the
//   hashes original already serves every caller. copyBytes is CURVES' OWN distinct implementation
//   (not a passthrough) and is kept, unrenamed -- only the hashes-side copyBytes was suffixed above.
// abytes_ / anumber_ -- curves/utils.js's internal helpers (e.g. bytesToNumberLE) call the
//   underscore-suffixed names per the original @noble/hashes import aliasing; this const restores
//   that aliasing against the plain (unrenamed) hashes abytes/anumber.
const abytes_ = abytes, anumber_ = anumber;
// Per-file BigInt literal constants (_0n, _1n, _2n, _3n, _4n, ...) are redeclared independently in
// utils.js, modular.js, curve.js, weierstrass.js, and secp256k1.js in the original package layout
// (each file is its own module scope there). Flattened into one scope here, each file's copies are
// suffixed per-file (_u / _m / _c / _w / _s) to avoid "Identifier has already been declared".


// ---- @noble/hashes _u64.js (v2.2.0, MIT, Paul Miller) ----
const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
const _32n = /* @__PURE__ */ BigInt(32);
// Split bigint into two 32-bit halves. With `le=true`, returned fields become `{ h: low, l: high
// }` to match little-endian word order rather than the property names.
function fromBig(n, le = false) {
    if (le)
        return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
    return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
// Split bigint list into `[highWords, lowWords]` when `le=false`; with `le=true`, the first array
// holds the low halves because `fromBig(...)` swaps the semantic meaning of `h` and `l`.
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
// Combine explicit `(high, low)` 32-bit halves into a bigint; `>>> 0` normalizes signed JS
// bitwise results back to uint32 first, and little-endian callers must swap.
const toBig = (h, l) => (BigInt(h >>> 0) << _32n) | BigInt(l >>> 0);
// High 32-bit half of a 64-bit logical right shift for `s` in `0..31`.
const shrSH = (h, _l, s) => h >>> s;
// Low 32-bit half of a 64-bit logical right shift, valid for `s` in `1..31`.
const shrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
// High 32-bit half of a 64-bit right rotate, valid for `s` in `1..31`.
const rotrSH = (h, l, s) => (h >>> s) | (l << (32 - s));
// Low 32-bit half of a 64-bit right rotate, valid for `s` in `1..31`.
const rotrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
// High 32-bit half of a 64-bit right rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
const rotrBH = (h, l, s) => (h << (64 - s)) | (l >>> (s - 32));
// Low 32-bit half of a 64-bit right rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
const rotrBL = (h, l, s) => (h >>> (s - 32)) | (l << (64 - s));
// High 32-bit half of a 64-bit right rotate for `s === 32`; this is just the swapped low half.
const rotr32H = (_h, l) => l;
// Low 32-bit half of a 64-bit right rotate for `s === 32`; this is just the swapped high half.
const rotr32L = (h, _l) => h;
// High 32-bit half of a 64-bit left rotate, valid for `s` in `1..31`.
const rotlSH = (h, l, s) => (h << s) | (l >>> (32 - s));
// Low 32-bit half of a 64-bit left rotate, valid for `s` in `1..31`.
const rotlSL = (h, l, s) => (l << s) | (h >>> (32 - s));
// High 32-bit half of a 64-bit left rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
const rotlBH = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));
// Low 32-bit half of a 64-bit left rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
const rotlBL = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));
// Add two split 64-bit words and return the split `{ h, l }` sum.
// JS uses 32-bit signed integers for bitwise operations, so we cannot simply shift the carry out
// of the low sum and instead use division.
function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: (Ah + Bh + ((l / 2 ** 32) | 0)) | 0, l: l | 0 };
}
// Addition with more than 2 elements
// Unmasked low-word accumulator for 3-way addition; pass the raw result into `add3H(...)`.
const add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
// High-word finalize step for 3-way addition; `low` must be the untruncated output of `add3L(...)`.
const add3H = (low, Ah, Bh, Ch) => (Ah + Bh + Ch + ((low / 2 ** 32) | 0)) | 0;
// Unmasked low-word accumulator for 4-way addition; pass the raw result into `add4H(...)`.
const add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
// High-word finalize step for 4-way addition; `low` must be the untruncated output of `add4L(...)`.
const add4H = (low, Ah, Bh, Ch, Dh) => (Ah + Bh + Ch + Dh + ((low / 2 ** 32) | 0)) | 0;
// Unmasked low-word accumulator for 5-way addition; pass the raw result into `add5H(...)`.
const add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
// High-word finalize step for 5-way addition; `low` must be the untruncated output of `add5L(...)`.
const add5H = (low, Ah, Bh, Ch, Dh, Eh) => (Ah + Bh + Ch + Dh + Eh + ((low / 2 ** 32) | 0)) | 0;
// prettier-ignore

// Canonical grouped namespace for callers that prefer one object.
// Named exports stay for direct imports.
// prettier-ignore
const u64 = {
    fromBig, split, toBig,
    shrSH, shrSL,
    rotrSH, rotrSL, rotrBH, rotrBL,
    rotr32H, rotr32L,
    rotlSH, rotlSL, rotlBH, rotlBL,
    add, add3L, add3H, add4L, add4H, add5H, add5L,
};
// Default export mirrors named `u64` for compatibility with object-style imports.

//# sourceMappingURL=_u64.js.map
// ---- @noble/hashes sha3.js (v2.2.0, MIT, Paul Miller) -- Keccak/SHA3 ----
/**
 * SHA3 (keccak) hash function, based on a new "Sponge function" design.
 * Different from older hashes, the internal state is bigger than output size.
 *
 * Check out
 * {@link https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf | FIPS-202},
 * {@link https://keccak.team/keccak.html | Website}, and
 * {@link https://crypto.stackexchange.com/q/15727 | the differences between
 * SHA-3 and Keccak}.
 *
 * Check out `sha3-addons` module for cSHAKE, k12, and others.
 * @module
 */

// prettier-ignore

// No __PURE__ annotations in sha3 header:
// EVERYTHING is in fact used on every export.
// Various per round constants calculations
const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const _7n = BigInt(7);
const _256n = BigInt(256);
// FIPS 202 Algorithm 5 rc(): when the outgoing bit is 1, the 8-bit LFSR xors
// taps 0, 4, 5, and 6, which compresses to the feedback mask `0x71`.
const _0x71n = BigInt(0x71);
const SHA3_PI = [];
const SHA3_ROTL = [];
const _SHA3_IOTA = []; // no pure annotation: var is always used
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
    // Pi
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    // Rotational
    SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
    // Iota
    let t = _0n;
    for (let j = 0; j < 7; j++) {
        R = ((R << _1n) ^ ((R >> _7n) * _0x71n)) % _256n;
        if (R & _2n)
            t ^= _1n << ((_1n << BigInt(j)) - _1n);
    }
    _SHA3_IOTA.push(t);
}
const IOTAS = split(_SHA3_IOTA, true);
// `split(..., true)` keeps the local little-endian lane-word layout used by
// `state32`, so these `H` / `L` tables follow the file's first-word /
// second-word lane slots rather than `_u64.ts`'s usual high/low naming.
const SHA3_IOTA_H = IOTAS[0];
const SHA3_IOTA_L = IOTAS[1];
// Left rotation (without 0, 32, 64)
const rotlH = (h, l, s) => (s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s));
const rotlL = (h, l, s) => (s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s));
/**
 * `keccakf1600` internal permutation, additionally allows adjusting the round count.
 * @param s - 5x5 Keccak state encoded as 25 lanes split into 50 uint32 words
 *   in this file's local little-endian lane-word order
 * @param rounds - number of rounds to execute
 * @throws If `rounds` is outside the supported `1..24` range. {@link Error}
 * @example
 * Permute a Keccak state with the default 24 rounds.
 * ```ts
 * keccakP(new Uint32Array(50));
 * ```
 */
function keccakP(s, rounds = 24) {
    anumber(rounds, 'rounds');
    // This implementation precomputes only the standard Keccak-f[1600] 24-round Iota table.
    if (rounds < 1 || rounds > 24)
        throw new Error('"rounds" expected integer 1..24');
    const B = new Uint32Array(5 * 2);
    // NOTE: all indices are x2 since we store state as u32 instead of u64 (bigints to slow in js)
    for (let round = 24 - rounds; round < 24; round++) {
        // Theta θ
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
        // Rho (ρ) and Pi (π)
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
        // Chi (χ)
        // Same as:
        // for (let x = 0; x < 10; x++) B[x] = s[y + x];
        // for (let x = 0; x < 10; x++) s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
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
        // Iota (ι)
        s[0] ^= SHA3_IOTA_H[round];
        s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
}
/**
 * Keccak sponge function.
 * @param blockLen - absorb/squeeze rate in bytes
 * @param suffix - domain separation suffix byte
 * @param outputLen - default digest length in bytes. This base sponge only
 *   requires a non-negative integer; wrappers that need positive output
 *   lengths must enforce that themselves.
 * @param enableXOF - whether XOF output is allowed
 * @param rounds - number of Keccak-f rounds
 * @example
 * Build a sponge state, absorb bytes, then finalize a digest.
 * ```ts
 * const hash = new Keccak(136, 0x06, 32);
 * hash.update(new Uint8Array([1, 2, 3]));
 * hash.digest();
 * ```
 */
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
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.canXOF = enableXOF;
        this.rounds = rounds;
        // Can be passed from user as dkLen
        anumber(outputLen, 'outputLen');
        // 1600 = 5x5 matrix of 64bit.  1600 bits === 200 bytes
        // 0 < blockLen < 200
        if (!(0 < blockLen && blockLen < 200))
            throw new Error('only keccak-f1600 function is supported');
        this.state = new Uint8Array(200);
        this.state32 = u32(this.state);
    }
    clone() {
        return this._cloneInto();
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
        // FIPS 202 appends the SHA3/SHAKE domain-separation suffix before pad10*1.
        // These byte values already include the first padding bit, while the
        // final `0x80` below supplies the closing `1` bit in the last rate byte.
        state[pos] ^= suffix;
        // If that combined suffix lands in the last rate byte and already sets
        // bit 7, absorb it first so the final pad10*1 bit can be xored into a
        // fresh block.
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
    xofInto(out) {
        // Plain SHA3/Keccak usage with XOF is probably a mistake, but this base
        // class is also reused by SHAKE/cSHAKE/KMAC/TupleHash/ParallelHash/
        // TurboSHAKE/KangarooTwelve wrappers that intentionally enable XOF.
        if (!this.enableXOF)
            throw new Error('XOF is not possible for this instance');
        return this.writeInto(out);
    }
    xof(bytes) {
        anumber(bytes);
        return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
        aoutput(out, this);
        if (this.finished)
            throw new Error('digest() was already called');
        // `aoutput(...)` allows oversized buffers; digestInto() must fill only the advertised digest.
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
    _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to ||= new Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
        // Reused destinations can come from a different rate/capacity variant, so clone must rewrite
        // the sponge geometry as well as the state words.
        to.blockLen = blockLen;
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        // Suffix can change in cSHAKE
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        // Clones must preserve the public capability bit too; `_KMAC` reuses this path and deep clone
        // tests compare instance fields directly, so leaving `canXOF` behind makes the clone lie.
        to.canXOF = this.canXOF;
        to.destroyed = this.destroyed;
        return to;
    }
}
const genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info);
/**
 * SHA3-224 hash function.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA3-224.
 * ```ts
 * sha3_224(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha3_224 = /* @__PURE__ */ genKeccak(0x06, 144, 28, 
/* @__PURE__ */ oidNist(0x07));
/**
 * SHA3-256 hash function. Different from keccak-256.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA3-256.
 * ```ts
 * sha3_256(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha3_256 = /* @__PURE__ */ genKeccak(0x06, 136, 32, 
/* @__PURE__ */ oidNist(0x08));
/**
 * SHA3-384 hash function.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA3-384.
 * ```ts
 * sha3_384(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha3_384 = /* @__PURE__ */ genKeccak(0x06, 104, 48, 
/* @__PURE__ */ oidNist(0x09));
/**
 * SHA3-512 hash function.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA3-512.
 * ```ts
 * sha3_512(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha3_512 = /* @__PURE__ */ genKeccak(0x06, 72, 64, 
/* @__PURE__ */ oidNist(0x0a));
/**
 * Keccak-224 hash function.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with Keccak-224.
 * ```ts
 * keccak_224(new Uint8Array([97, 98, 99]));
 * ```
 */
const keccak_224 = /* @__PURE__ */ genKeccak(0x01, 144, 28);
/**
 * Keccak-256 hash function. Different from SHA3-256.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with Keccak-256.
 * ```ts
 * keccak_256(new Uint8Array([97, 98, 99]));
 * ```
 */
const keccak_256 = /* @__PURE__ */ genKeccak(0x01, 136, 32);
/**
 * Keccak-384 hash function.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with Keccak-384.
 * ```ts
 * keccak_384(new Uint8Array([97, 98, 99]));
 * ```
 */
const keccak_384 = /* @__PURE__ */ genKeccak(0x01, 104, 48);
/**
 * Keccak-512 hash function.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with Keccak-512.
 * ```ts
 * keccak_512(new Uint8Array([97, 98, 99]));
 * ```
 */
const keccak_512 = /* @__PURE__ */ genKeccak(0x01, 72, 64);
const genShake = (suffix, blockLen, outputLen, info = {}) => createHasher((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === undefined ? outputLen : opts.dkLen, true), info);
/**
 * SHAKE128 XOF with 128-bit security and a 16-byte default output.
 * @param msg - message bytes to hash
 * @param opts - Optional output-length override. See {@link ShakeOpts}.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHAKE128.
 * ```ts
 * shake128(new Uint8Array([97, 98, 99]), { dkLen: 32 });
 * ```
 */
const shake128 = 
/* @__PURE__ */
genShake(0x1f, 168, 16, /* @__PURE__ */ oidNist(0x0b));
/**
 * SHAKE256 XOF with 256-bit security and a 32-byte default output.
 * @param msg - message bytes to hash
 * @param opts - Optional output-length override. See {@link ShakeOpts}.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHAKE256.
 * ```ts
 * shake256(new Uint8Array([97, 98, 99]), { dkLen: 64 });
 * ```
 */
const shake256 = 
/* @__PURE__ */
genShake(0x1f, 136, 32, /* @__PURE__ */ oidNist(0x0c));
/**
 * SHAKE128 XOF with 256-bit output (NIST version).
 * @param msg - message bytes to hash
 * @param opts - Optional output-length override. See {@link ShakeOpts}.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHAKE128 using a 32-byte default output.
 * ```ts
 * shake128_32(new Uint8Array([97, 98, 99]), { dkLen: 32 });
 * ```
 */
const shake128_32 = 
/* @__PURE__ */
genShake(0x1f, 168, 32, /* @__PURE__ */ oidNist(0x0b));
/**
 * SHAKE256 XOF with 512-bit output (NIST version).
 * @param msg - message bytes to hash
 * @param opts - Optional output-length override. See {@link ShakeOpts}.
 * @returns Digest bytes.
 * @example
 * Hash a message with SHAKE256 using a 64-byte default output.
 * ```ts
 * shake256_64(new Uint8Array([97, 98, 99]), { dkLen: 64 });
 * ```
 */
const shake256_64 = 
/* @__PURE__ */
genShake(0x1f, 136, 64, /* @__PURE__ */ oidNist(0x0c));
//# sourceMappingURL=sha3.js.map

// The secp256k1 group order, copied from the vendored bundle's own curve literal. Used only to
// report whether s sits above half the order; no curve arithmetic happens in this kernel.
const SECP256K1_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
// -- art-699 Permit2 digest + binding logic --------------------------------------------------
//
// Every type string below is the literal ASCII the on-chain library hashes. Typehashes are
// DERIVED from these strings at call time and never written as hex: a hand-transcribed digest is
// the one defect class this kernel exists to make impossible for its callers.
//
// Derivation is deliberately lazy (a memo filled on the first compute() call) rather than done at
// module scope: keccak at module top level runs during guest module init, outside the harness's
// error surface, and that is how a guest-fatal kernel gets discovered hours later on the prover.

const DOMAIN_TYPE_STRING = 'EIP712Domain(string name,uint256 chainId,address verifyingContract)';
const DOMAIN_NAME = 'Permit2';

const TOKEN_PERMISSIONS_TYPE_STRING = 'TokenPermissions(address token,uint256 amount)';
const WITNESS_TYPE_STRING = 'Witness(address to,uint256 validAfter)';
const PERMIT_WITNESS_TRANSFER_FROM_STUB = 'PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,';
const X402_WITNESS_TYPE_SUFFIX = 'Witness witness)' + TOKEN_PERMISSIONS_TYPE_STRING + WITNESS_TYPE_STRING;
const PERMIT_WITNESS_TRANSFER_FROM_TYPE_STRING = PERMIT_WITNESS_TRANSFER_FROM_STUB + X402_WITNESS_TYPE_SUFFIX;
const PERMIT_TRANSFER_FROM_TYPE_STRING = 'PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)' + TOKEN_PERMISSIONS_TYPE_STRING;
const PERMIT_DETAILS_TYPE_STRING = 'PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)';
const PERMIT_SINGLE_TYPE_STRING = 'PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)' + PERMIT_DETAILS_TYPE_STRING;

const VARIANTS = ['x402_witness_transfer', 'permit_transfer_from', 'permit_single'];
const BATCH_VARIANTS = ['permit_batch_transfer_from', 'x402_batch_witness_transfer', 'permit_batch'];

// Deployed addresses, pinned as facts to compare against and never assumed. A caller may sign a
// message naming some other spender or some other verifying contract; this kernel says so rather
// than rejecting it, because a non-canonical address is a finding and not a malformed input.
const CANONICAL_PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const X402_EXACT_PERMIT2_PROXY = '0x402085c248eea27d92e8b30b2c58ed07f9e20001';

// The counterfactual-wrapper marker: 0x6492 repeated 16 times, built rather than transcribed.
const ERC6492_SUFFIX_HEX = '6492'.repeat(16);

const MAX_UINT48 = (1n << 48n) - 1n;
const MAX_UINT160 = (1n << 160n) - 1n;

const SCOPE_NOTE = 'Recomputes the Permit2 typed-data digest for a single-item x402 witness transfer, an unwitnessed signature transfer, or an allowance permit, from caller-supplied domain and message fields, and reports binding facts against a caller-supplied payment requirement. It proves nothing about who signed: signer recovery is the downstream recovery node\'s job and this kernel emits its input record instead. It reads no chain, so nonce spend state, stored allowance, contract code and the current block time are caller-declared inputs echoed back, and an absent input reports NOT_EVALUATED. Zero network calls. Never a facilitator, proxy or settlement relay.';

let _TYPEHASH_MEMO = null;

function _typehashes() {
  if (_TYPEHASH_MEMO === null) {
    _TYPEHASH_MEMO = {
      domain: keccak_256(utf8ToBytes(DOMAIN_TYPE_STRING)),
      tokenPermissions: keccak_256(utf8ToBytes(TOKEN_PERMISSIONS_TYPE_STRING)),
      witness: keccak_256(utf8ToBytes(WITNESS_TYPE_STRING)),
      permitWitnessTransferFrom: keccak_256(utf8ToBytes(PERMIT_WITNESS_TRANSFER_FROM_TYPE_STRING)),
      permitTransferFrom: keccak_256(utf8ToBytes(PERMIT_TRANSFER_FROM_TYPE_STRING)),
      permitDetails: keccak_256(utf8ToBytes(PERMIT_DETAILS_TYPE_STRING)),
      permitSingle: keccak_256(utf8ToBytes(PERMIT_SINGLE_TYPE_STRING)),
    };
  }
  return _TYPEHASH_MEMO;
}

function _stripHexPrefix(hex) {
  const s = String(hex ?? '');
  return s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
}

function _pad32Left(bytes) {
  const out = new Uint8Array(32);
  out.set(bytes, 32 - bytes.length);
  return out;
}

function _normalizeAddress(v) {
  if (typeof v !== 'string') return null;
  const s = _stripHexPrefix(v.trim());
  if (!/^[0-9a-fA-F]{40}$/.test(s)) return null;
  return '0x' + s.toLowerCase();
}

// Accepts a decimal string, a 0x-hex string, a bigint, or a safe-integer number; never throws.
function _toUint256BigInt(v) {
  try {
    let bi;
    if (typeof v === 'bigint') {
      bi = v;
    } else if (typeof v === 'number') {
      if (!Number.isFinite(v) || !Number.isInteger(v)) return null;
      bi = BigInt(v);
    } else if (typeof v === 'string') {
      const s = v.trim();
      if (s === '') return null;
      if (/^0x[0-9a-fA-F]+$/.test(s)) bi = BigInt(s);
      else if (/^[0-9]+$/.test(s)) bi = BigInt(s);
      else return null;
    } else {
      return null;
    }
    if (bi < 0n || bi >= (1n << 256n)) return null;
    return bi;
  } catch (e) {
    return null;
  }
}

function _uint256Word(bi) {
  let hex = bi.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return _pad32Left(hexToBytes_(hex));
}

function _addressWord(addrHex) {
  return _pad32Left(hexToBytes_(_stripHexPrefix(addrHex)));
}

function _hex32(bytes) {
  return '0x' + bytesToHex_(bytes);
}

function _isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function _str(v) {
  return (typeof v === 'string' && v.trim() !== '') ? v.trim() : null;
}

// A caller-declared boolean stays tri-state: true, false, or absent. An absent chain fact is
// never folded into false.
function _triBool(v) {
  if (v === true || v === false) return v;
  return null;
}

// CAIP-2 style network identifiers. Only the eip155 namespace carries a chain id this kernel can
// compare; anything else is reported as not comparable rather than guessed at.
function _networkChainId(network) {
  const s = _str(network);
  if (s === null) return { chainId: null, comparable: false, reason: 'network absent' };
  const m = /^eip155:([0-9]+)$/.exec(s);
  if (m) return { chainId: BigInt(m[1]), comparable: true, reason: null };
  if (/^[0-9]+$/.test(s)) return { chainId: BigInt(s), comparable: true, reason: null };
  return { chainId: null, comparable: false, reason: 'network "' + s + '" is not an eip155 chain reference, so no chain id can be compared' };
}

// Signature form facts. No recovery happens here: the downstream recovery node owns that, and
// this kernel only classifies the bytes it was handed.
function _signatureForm(raw) {
  const out = {
    present: false,
    signature_length_class: null,
    signature_byte_length: null,
    s_above_half_order: null,
    v_form: null,
    v_onchain_compatible: null,
    erc6492_wrapped: false,
    ecdsa_recovery_applicable: null,
    r: null,
    s: null,
    y_parity: null,
    notes: [],
  };
  const hex = _str(raw);
  if (hex === null) return out;
  out.present = true;
  const body = _stripHexPrefix(hex);
  if (!/^[0-9a-fA-F]*$/.test(body) || body.length % 2 !== 0) {
    out.signature_length_class = 'other-non-ecdsa';
    out.ecdsa_recovery_applicable = false;
    out.notes.push('signature is not an even-length hex string, so no signature form can be read from it');
    return out;
  }
  out.signature_byte_length = body.length / 2;

  if (body.length >= 64 && body.slice(-64).toLowerCase() === ERC6492_SUFFIX_HEX) {
    out.signature_length_class = 'erc6492-wrapped';
    out.erc6492_wrapped = true;
    out.ecdsa_recovery_applicable = false;
    out.notes.push('signature carries the counterfactual-deployment wrapper marker, so it wraps a contract-wallet signature and elliptic-curve recovery does not apply to these bytes');
    return out;
  }

  let rHex = null;
  let sBig = null;
  let yParity = null;

  if (body.length === 130) {
    out.signature_length_class = '65';
    rHex = body.slice(0, 64).toLowerCase();
    sBig = BigInt('0x' + body.slice(64, 128));
    const v = parseInt(body.slice(128, 130), 16);
    if (v === 0 || v === 1) {
      out.v_form = 'raw_y_parity';
      out.v_onchain_compatible = false;
      yParity = v;
      out.notes.push('the 65-byte form carries a raw y-parity byte of ' + v + ' where the on-chain recovery precompile expects 27 or 28, so an unmodified submission of these bytes recovers nothing');
    } else if (v === 27 || v === 28) {
      out.v_form = 'legacy_27_28';
      out.v_onchain_compatible = true;
      yParity = v - 27;
    } else {
      out.v_form = 'unrecognised';
      out.v_onchain_compatible = false;
      out.notes.push('the final byte of the 65-byte form is ' + v + ', which is neither a raw y-parity bit nor the 27/28 the on-chain recovery precompile expects');
    }
    out.ecdsa_recovery_applicable = yParity !== null;
  } else if (body.length === 128) {
    out.signature_length_class = '64-eip2098';
    rHex = body.slice(0, 64).toLowerCase();
    const vs = BigInt('0x' + body.slice(64, 128));
    yParity = Number(vs >> 255n);
    sBig = vs & ((1n << 255n) - 1n);
    out.v_form = 'compact_packed_y_parity';
    out.v_onchain_compatible = true;
    out.ecdsa_recovery_applicable = true;
    out.notes.push('compact 64-byte form: the y-parity bit was unpacked from the high bit of the second word and the s value was masked back out');
  } else {
    out.signature_length_class = 'other-non-ecdsa';
    out.ecdsa_recovery_applicable = false;
    out.notes.push('signature is ' + out.signature_byte_length + ' bytes, which is neither the 65-byte nor the 64-byte elliptic-curve form, so recovery does not apply and a contract-wallet verification path would be the one to read these bytes');
    return out;
  }

  if (sBig !== null) {
    const halfOrder = SECP256K1_ORDER >> 1n;
    out.s_above_half_order = sBig > halfOrder;
    let sHex = sBig.toString(16);
    while (sHex.length < 64) sHex = '0' + sHex;
    out.s = '0x' + sHex;
    if (out.s_above_half_order) {
      out.notes.push('s sits above half the curve order. The Permit2 signature-verification library masks only the compact form\'s parity bit and applies no low-s rule, so it accepts this; other token implementations reject it outright, which is why the fact travels with the digest');
    }
  }
  if (rHex !== null) out.r = '0x' + rHex;
  out.y_parity = yParity;
  return out;
}

/**
 * compute(pp) -- pure recompute_x402_permit2_digest kernel.
 * pp: {
 *   variant,                                   -- mandatory, one of the three single-item shapes
 *   chainId, verifyingContract,                -- mandatory domain fields (the domain has no version)
 *   permitted: { token, amount },              -- signature-transfer variants
 *   spender, nonce, deadline,                  -- signature-transfer variants
 *   witness: { to, validAfter },               -- x402_witness_transfer only
 *   details: { token, amount, expiration, nonce }, sigDeadline,  -- permit_single only
 *   from,                                      -- claimed signer, echoed into the handoff record
 *   requirement: { scheme, network, asset, payTo, amount, extra }, now_unix,   -- optional context
 *   signature,                                 -- optional, form facts only
 *   eip2612GasSponsoring,                      -- optional sponsored-approval extension payload
 *   nonce_already_used,                        -- optional caller-declared chain fact
 * }
 */
export function compute(pp) {
  pp = _isPlainObject(pp) ? pp : {};
  const errors = [];
  const warnings = [];
  const flags = [];
  const th = _typehashes();

  // ---- variant ----
  const variantRaw = _str(pp.variant);
  let variant = null;
  if (variantRaw === null) {
    errors.push('variant is required and must be one of ' + VARIANTS.join(', ') + ' (never inferred from the other fields)');
  } else if (VARIANTS.indexOf(variantRaw) >= 0) {
    variant = variantRaw;
  } else if (BATCH_VARIANTS.indexOf(variantRaw) >= 0) {
    errors.push('variant "' + variantRaw + '" is a batch message shape and is refused in this version: a batch hashes an array of items and this kernel encodes single items only');
    flags.push('X402_PERMIT2_VARIANT_REFUSED');
  } else {
    errors.push('variant "' + variantRaw + '" is not recognised and is refused rather than approximated; supported: ' + VARIANTS.join(', '));
    flags.push('X402_PERMIT2_VARIANT_REFUSED');
  }

  // ---- domain ----
  const chainId = _toUint256BigInt(pp.chainId);
  const verifyingContract = _normalizeAddress(pp.verifyingContract);
  if (chainId === null) errors.push('chainId is required and must be a non-negative uint256 (domain field, never defaulted)');
  if (verifyingContract === null) errors.push('verifyingContract is required and must be a 20-byte hex address (domain field, never defaulted: a guessed value defeats domain separation)');
  if (pp.version !== undefined || (_isPlainObject(pp.domain) && pp.domain.version !== undefined)) {
    errors.push('a version field was supplied for the domain, and this domain has exactly three fields (name, chainId, verifyingContract). Hashing a four-field domain produces a different separator and therefore a different digest, so the field is refused rather than dropped');
    flags.push('X402_PERMIT2_DOMAIN_VERSION_REFUSED');
  }

  const verifyingContractIsCanonical = verifyingContract === null ? null : (verifyingContract === CANONICAL_PERMIT2);
  if (verifyingContractIsCanonical === false) {
    warnings.push('verifyingContract is not the canonical Permit2 deployment, so this digest belongs to some other deployment of the same message shape');
    flags.push('X402_PERMIT2_DOMAIN_NOT_CANONICAL');
  }

  // ---- message fields, per variant ----
  let permittedToken = null;
  let permittedAmount = null;
  let spender = null;
  let nonce = null;
  let deadline = null;
  let witnessTo = null;
  let witnessValidAfter = null;
  let detailsToken = null;
  let detailsAmount = null;
  let detailsExpiration = null;
  let detailsNonce = null;
  let sigDeadline = null;

  if (variant === 'x402_witness_transfer' || variant === 'permit_transfer_from') {
    const permitted = _isPlainObject(pp.permitted) ? pp.permitted : {};
    permittedToken = _normalizeAddress(permitted.token);
    permittedAmount = _toUint256BigInt(permitted.amount);
    spender = _normalizeAddress(pp.spender);
    nonce = _toUint256BigInt(pp.nonce);
    deadline = _toUint256BigInt(pp.deadline);
    if (permittedToken === null) errors.push('permitted.token is required and must be a 20-byte hex address');
    if (permittedAmount === null) errors.push('permitted.amount is required and must be a non-negative uint256');
    if (spender === null) errors.push('spender is required and must be a 20-byte hex address');
    if (nonce === null) errors.push('nonce is required and must be a non-negative uint256');
    if (deadline === null) errors.push('deadline is required and must be a non-negative uint256 (unix seconds)');
    if (variant === 'x402_witness_transfer') {
      const witness = _isPlainObject(pp.witness) ? pp.witness : {};
      witnessTo = _normalizeAddress(witness.to);
      witnessValidAfter = _toUint256BigInt(witness.validAfter);
      if (witnessTo === null) errors.push('witness.to is required and must be a 20-byte hex address (it is the destination the witness binds)');
      if (witnessValidAfter === null) errors.push('witness.validAfter is required and must be a non-negative uint256 (unix seconds)');
    }
  } else if (variant === 'permit_single') {
    const details = _isPlainObject(pp.details) ? pp.details : {};
    detailsToken = _normalizeAddress(details.token);
    detailsAmount = _toUint256BigInt(details.amount);
    detailsExpiration = _toUint256BigInt(details.expiration);
    detailsNonce = _toUint256BigInt(details.nonce);
    spender = _normalizeAddress(pp.spender);
    sigDeadline = _toUint256BigInt(pp.sigDeadline);
    if (detailsToken === null) errors.push('details.token is required and must be a 20-byte hex address');
    if (detailsAmount === null) errors.push('details.amount is required and must be a non-negative integer');
    else if (detailsAmount > MAX_UINT160) errors.push('details.amount exceeds the 160-bit width this message shape encodes');
    if (detailsExpiration === null) errors.push('details.expiration is required and must be a non-negative integer');
    else if (detailsExpiration > MAX_UINT48) errors.push('details.expiration exceeds the 48-bit width this message shape encodes');
    if (detailsNonce === null) errors.push('details.nonce is required and must be a non-negative integer');
    else if (detailsNonce > MAX_UINT48) errors.push('details.nonce exceeds the 48-bit width this message shape encodes');
    if (spender === null) errors.push('spender is required and must be a 20-byte hex address');
    if (sigDeadline === null) errors.push('sigDeadline is required and must be a non-negative uint256 (unix seconds)');
  }

  const from = _normalizeAddress(pp.from);
  const signature_form = _signatureForm(pp.signature);
  for (let i = 0; i < signature_form.notes.length; i++) warnings.push(signature_form.notes[i]);
  if (signature_form.v_onchain_compatible === false) flags.push('X402_PERMIT2_SIGNATURE_V_NOT_ONCHAIN_COMPATIBLE');
  if (signature_form.s_above_half_order === true) flags.push('X402_PERMIT2_SIGNATURE_HIGH_S');
  if (signature_form.present && signature_form.ecdsa_recovery_applicable === false) flags.push('X402_PERMIT2_SIGNATURE_NOT_ECDSA');

  const domain_echo = {
    name: DOMAIN_NAME,
    chain_id: chainId !== null ? chainId.toString() : null,
    verifying_contract: verifyingContract,
    verifying_contract_is_canonical_permit2: verifyingContractIsCanonical,
    field_count: 3,
  };

  if (errors.length > 0) {
    flags.push('X402_PERMIT2_INDETERMINATE');
    return {
      output_payload: {
        verdict: 'INDETERMINATE',
        variant: variantRaw,
        errors,
        warnings,
        reasons: errors.slice(),
        domain: domain_echo,
        type_string: null,
        typehash: null,
        domain_typehash: _hex32(th.domain),
        domain_separator: null,
        struct_hash: null,
        digest: null,
        message: null,
        x402_binding: null,
        window: null,
        nonce_facts: null,
        allowance_expiry: null,
        signature_form,
        handoff_591: null,
        sponsored_approval: null,
        handoff_612: null,
        scope_note: SCOPE_NOTE,
      },
      compliance_flags: flags,
    };
  }

  // ---- domain separator ----
  const domainSeparator = keccak_256(concatBytes_(
    th.domain,
    keccak_256(utf8ToBytes(DOMAIN_NAME)),
    _uint256Word(chainId),
    _addressWord(verifyingContract),
  ));

  // ---- struct hash, per variant ----
  let typeString = null;
  let typehash = null;
  let structHash = null;
  let message = null;

  if (variant === 'x402_witness_transfer' || variant === 'permit_transfer_from') {
    const tokenPermissionsHash = keccak_256(concatBytes_(
      th.tokenPermissions,
      _addressWord(permittedToken),
      _uint256Word(permittedAmount),
    ));
    if (variant === 'x402_witness_transfer') {
      typeString = PERMIT_WITNESS_TRANSFER_FROM_TYPE_STRING;
      typehash = th.permitWitnessTransferFrom;
      const witnessHash = keccak_256(concatBytes_(
        th.witness,
        _addressWord(witnessTo),
        _uint256Word(witnessValidAfter),
      ));
      structHash = keccak_256(concatBytes_(
        typehash,
        tokenPermissionsHash,
        _addressWord(spender),
        _uint256Word(nonce),
        _uint256Word(deadline),
        witnessHash,
      ));
      message = {
        permitted: { token: permittedToken, amount: permittedAmount.toString() },
        spender,
        nonce: nonce.toString(),
        deadline: deadline.toString(),
        witness: { to: witnessTo, valid_after: witnessValidAfter.toString() },
        witness_type_string: WITNESS_TYPE_STRING,
        witness_hash: _hex32(witnessHash),
        token_permissions_hash: _hex32(tokenPermissionsHash),
      };
    } else {
      typeString = PERMIT_TRANSFER_FROM_TYPE_STRING;
      typehash = th.permitTransferFrom;
      structHash = keccak_256(concatBytes_(
        typehash,
        tokenPermissionsHash,
        _addressWord(spender),
        _uint256Word(nonce),
        _uint256Word(deadline),
      ));
      message = {
        permitted: { token: permittedToken, amount: permittedAmount.toString() },
        spender,
        nonce: nonce.toString(),
        deadline: deadline.toString(),
        token_permissions_hash: _hex32(tokenPermissionsHash),
      };
    }
  } else {
    typeString = PERMIT_SINGLE_TYPE_STRING;
    typehash = th.permitSingle;
    const detailsHash = keccak_256(concatBytes_(
      th.permitDetails,
      _addressWord(detailsToken),
      _uint256Word(detailsAmount),
      _uint256Word(detailsExpiration),
      _uint256Word(detailsNonce),
    ));
    structHash = keccak_256(concatBytes_(
      typehash,
      detailsHash,
      _addressWord(spender),
      _uint256Word(sigDeadline),
    ));
    message = {
      details: {
        token: detailsToken,
        amount: detailsAmount.toString(),
        expiration: detailsExpiration.toString(),
        nonce: detailsNonce.toString(),
      },
      spender,
      sig_deadline: sigDeadline.toString(),
      details_hash: _hex32(detailsHash),
    };
  }

  const digest = keccak_256(concatBytes_(
    Uint8Array.from([0x19, 0x01]),
    domainSeparator,
    structHash,
  ));
  const digestHex = _hex32(digest);

  // ---- caller-declared time ----
  const nowUnix = _toUint256BigInt(pp.now_unix);

  // ---- binding facts against the declared payment requirement ----
  const requirement = _isPlainObject(pp.requirement) ? pp.requirement : null;
  const schemeRaw = requirement ? _str(requirement.scheme) : null;
  const scheme = (schemeRaw === 'exact' || schemeRaw === 'upto') ? schemeRaw : null;
  const reqAsset = requirement ? _normalizeAddress(requirement.asset) : null;
  const reqPayTo = requirement ? _normalizeAddress(requirement.payTo) : null;
  const reqAmount = requirement ? _toUint256BigInt(requirement.amount) : null;
  const net = requirement ? _networkChainId(requirement.network) : { chainId: null, comparable: false, reason: 'no payment requirement was supplied' };

  const signedToken = variant === 'permit_single' ? detailsToken : permittedToken;
  const signedAmount = variant === 'permit_single' ? detailsAmount : permittedAmount;

  const spenderIsProxy = spender === null ? null : (spender === X402_EXACT_PERMIT2_PROXY);
  if (spenderIsProxy === false && variant === 'x402_witness_transfer') {
    warnings.push('the signed spender is not the pinned x402 exact proxy, so the destination binding this witness pattern relies on would be enforced by some other contract');
    flags.push('X402_PERMIT2_SPENDER_NOT_PROXY');
  }

  let witnessToMatchesPayTo = null;
  if (variant === 'x402_witness_transfer') {
    if (reqPayTo === null) {
      witnessToMatchesPayTo = null;
    } else {
      witnessToMatchesPayTo = witnessTo === reqPayTo;
      if (!witnessToMatchesPayTo) {
        warnings.push('the destination bound into the witness is not the payTo address of the declared requirement');
        flags.push('X402_PERMIT2_PAYTO_MISMATCH');
      }
    }
  }

  let tokenMatchesAsset = null;
  if (reqAsset !== null) {
    tokenMatchesAsset = signedToken === reqAsset;
    if (!tokenMatchesAsset) {
      warnings.push('the token in the signed message is not the asset of the declared requirement');
      flags.push('X402_PERMIT2_ASSET_MISMATCH');
    }
  }

  let chainMatchesNetwork = null;
  if (net.comparable) {
    chainMatchesNetwork = chainId === net.chainId;
    if (!chainMatchesNetwork) {
      warnings.push('the signed chain id does not match the chain the declared requirement names, and a wallet asked to sign for a chain other than the active one should refuse');
      flags.push('X402_PERMIT2_NETWORK_MISMATCH');
    }
  }

  let amountRelation = 'NOT_EVALUATED';
  if (reqAmount !== null && scheme !== null) {
    if (scheme === 'exact') {
      amountRelation = signedAmount === reqAmount ? 'EQUAL' : 'NOT_EQUAL';
    } else if (signedAmount === reqAmount) {
      amountRelation = 'EQUAL_TO_CEILING';
    } else if (reqAmount < signedAmount) {
      amountRelation = 'WITHIN_CEILING';
    } else {
      amountRelation = 'EXCEEDS_CEILING';
    }
    if (amountRelation === 'NOT_EQUAL' || amountRelation === 'EXCEEDS_CEILING') {
      warnings.push('under the "' + scheme + '" scheme the requirement amount ' + reqAmount.toString() + ' does not hold against the signed amount ' + signedAmount.toString());
      flags.push('X402_PERMIT2_AMOUNT_MISMATCH');
    }
  } else if (requirement !== null && reqAmount !== null && scheme === null) {
    warnings.push('the requirement declares no recognised scheme, so the amount comparison has no rule to apply and is reported as not evaluated');
  }

  const x402_binding = {
    requirement_declared: requirement !== null,
    scheme,
    spender_is_x402_permit2_proxy: spenderIsProxy,
    witness_to_matches_pay_to: witnessToMatchesPayTo,
    token_matches_asset: tokenMatchesAsset,
    chain_matches_network: chainMatchesNetwork,
    network_comparison_note: net.comparable ? null : net.reason,
    amount_vs_requirement: amountRelation,
    signed_amount: signedAmount.toString(),
    requirement_amount: reqAmount !== null ? reqAmount.toString() : null,
  };

  // ---- window facts ----
  const effectiveDeadline = variant === 'permit_single' ? sigDeadline : deadline;
  let deadlineStatus = 'NOT_EVALUATED';
  let validAfterStatus = 'NOT_EVALUATED';
  if (nowUnix !== null) {
    deadlineStatus = nowUnix <= effectiveDeadline ? 'WITHIN' : 'EXPIRED';
    if (deadlineStatus === 'EXPIRED') {
      warnings.push('the declared current time is past the signed deadline');
      flags.push('X402_PERMIT2_WINDOW_EXPIRED');
    }
    if (variant === 'x402_witness_transfer') {
      validAfterStatus = nowUnix >= witnessValidAfter ? 'ACTIVE' : 'NOT_YET_VALID';
      if (validAfterStatus === 'NOT_YET_VALID') {
        warnings.push('the declared current time is earlier than the witness validAfter, and the proxy rejects a settlement attempted before that point');
        flags.push('X402_PERMIT2_NOT_YET_VALID');
      }
    }
  }
  const window = {
    now_unix: nowUnix !== null ? nowUnix.toString() : null,
    deadline: effectiveDeadline.toString(),
    deadline_status: deadlineStatus,
    valid_after: variant === 'x402_witness_transfer' ? witnessValidAfter.toString() : null,
    valid_after_status: validAfterStatus,
  };

  // ---- nonce facts ----
  const nonceUsed = _triBool(pp.nonce_already_used);
  if (nonceUsed === true) {
    warnings.push('the caller declares this nonce already spent against its own record, and this kernel reads no chain to confirm or contradict that');
    flags.push('X402_PERMIT2_NONCE_DECLARED_USED');
  }
  let nonce_facts;
  if (variant === 'permit_single') {
    nonce_facts = {
      nonce_space: 'allowance_transfer_sequential',
      sequential_nonce: detailsNonce.toString(),
      nonce_word_pos: null,
      nonce_bit_pos: null,
      nonce_already_used: nonceUsed,
      space_note: 'The allowance message shape uses a sequential per-owner-token-spender counter. It is a different space from the unordered bitmap the transfer shapes use, and the two are never conflated.',
    };
  } else {
    nonce_facts = {
      nonce_space: 'signature_transfer_unordered_bitmap',
      sequential_nonce: null,
      nonce_word_pos: (nonce >> 8n).toString(),
      nonce_bit_pos: Number(nonce & 0xffn),
      nonce_already_used: nonceUsed,
      space_note: 'The transfer message shapes use an unordered bitmap: the upper 248 bits index the word and the low 8 bits index the bit within it. It is a different space from the allowance shape\'s sequential counter, and the two are never conflated.',
    };
  }

  // ---- allowance expiry, allowance shape only ----
  let allowance_expiry = null;
  if (variant === 'permit_single') {
    const isZero = detailsExpiration === 0n;
    let classification;
    if (isZero) {
      classification = 'CURRENT_BLOCK_ONLY';
      warnings.push('an expiration of zero does not mean the allowance never expires: the stored expiration is set to the block timestamp, so the allowance lasts only the duration of that block');
      flags.push('X402_PERMIT2_ALLOWANCE_CURRENT_BLOCK_ONLY');
    } else if (nowUnix === null) {
      classification = 'NOT_EVALUATED';
    } else {
      classification = nowUnix <= detailsExpiration ? 'WITHIN' : 'EXPIRED';
      if (classification === 'EXPIRED') flags.push('X402_PERMIT2_ALLOWANCE_EXPIRED');
    }
    allowance_expiry = {
      expiration: detailsExpiration.toString(),
      expiration_is_zero: isZero,
      classification,
      rule_note: 'If the inputted expiration is 0, the stored expiration is set to block.timestamp, so the allowance only lasts the duration of the block.',
    };
  }

  // ---- handoff to the signer-recovery node ----
  let handoff_591 = null;
  if (signature_form.ecdsa_recovery_applicable === true && signature_form.r !== null && signature_form.s !== null && signature_form.y_parity !== null) {
    handoff_591 = {
      digest: digestHex,
      claimedFrom: from,
      r: signature_form.r,
      s: signature_form.s,
      yParity: signature_form.y_parity,
    };
    if (from === null) {
      warnings.push('no claimed signer was supplied, so the handoff record carries a null claimedFrom and the receiving node will report that rather than a binding');
    }
  }

  // ---- sponsored approval leg ----
  let sponsored_approval = null;
  let handoff_612 = null;
  const ext = _isPlainObject(pp.eip2612GasSponsoring) ? pp.eip2612GasSponsoring : null;
  if (ext !== null) {
    flags.push('X402_PERMIT2_SPONSORED_APPROVAL_PRESENT');
    const extFrom = _normalizeAddress(ext.from);
    const extAsset = _normalizeAddress(ext.asset);
    const extSpender = _normalizeAddress(ext.spender);
    const extAmount = _toUint256BigInt(ext.amount);
    const extNonce = _toUint256BigInt(ext.nonce);
    const extDeadline = _toUint256BigInt(ext.deadline);
    const extSignature = _str(ext.signature);

    const extErrors = [];
    if (extFrom === null) extErrors.push('eip2612GasSponsoring.from must be a 20-byte hex address');
    if (extAsset === null) extErrors.push('eip2612GasSponsoring.asset must be a 20-byte hex address');
    if (extSpender === null) extErrors.push('eip2612GasSponsoring.spender must be a 20-byte hex address');
    if (extAmount === null) extErrors.push('eip2612GasSponsoring.amount must be a non-negative uint256');
    if (extNonce === null) extErrors.push('eip2612GasSponsoring.nonce must be a non-negative uint256');
    if (extDeadline === null) extErrors.push('eip2612GasSponsoring.deadline must be a non-negative uint256');
    if (extSignature === null) extErrors.push('eip2612GasSponsoring.signature must be supplied');
    const extVersion = _str(ext.version);
    if (extVersion === null) extErrors.push('eip2612GasSponsoring.version must be supplied');
    if (extSignature !== null && _signatureForm(extSignature).signature_length_class !== '65') extErrors.push('eip2612GasSponsoring.signature must be the 65-byte concatenated form');

    const spenderIsCanonicalPermit2 = extSpender === null ? null : (extSpender === CANONICAL_PERMIT2);
    const ownerMatchesFrom = (extFrom === null || from === null) ? null : (extFrom === from);
    const coversPermittedAmount = extAmount === null ? null : (extAmount >= signedAmount);
    let extDeadlineStatus = 'NOT_EVALUATED';
    if (extDeadline !== null && nowUnix !== null) {
      extDeadlineStatus = nowUnix <= extDeadline ? 'WITHIN' : 'EXPIRED';
    }
    if (spenderIsCanonicalPermit2 === false) {
      warnings.push('the sponsored approval names a spender other than the canonical Permit2 deployment, so it would not put the transfer contract in funds');
      flags.push('X402_PERMIT2_SPONSORED_SPENDER_NOT_CANONICAL');
    }
    if (ownerMatchesFrom === false) {
      warnings.push('the sponsored approval owner is not the payer claimed for the transfer message');
      flags.push('X402_PERMIT2_SPONSORED_OWNER_MISMATCH');
    }
    if (coversPermittedAmount === false) {
      warnings.push('the sponsored approval amount is below the amount the transfer message signs for');
      flags.push('X402_PERMIT2_SPONSORED_AMOUNT_SHORT');
    }
    if (extDeadlineStatus === 'EXPIRED') {
      warnings.push('the declared current time is past the sponsored approval deadline');
      flags.push('X402_PERMIT2_SPONSORED_WINDOW_EXPIRED');
    }

    // The token's own typed-data domain name and version are NOT the extension's schema version.
    // They travel in the requirement's extra block, and when they are absent the handoff record
    // carries nulls rather than a guess: the receiving node cannot rebuild a separator without
    // them and must say so itself.
    const extra = (requirement && _isPlainObject(requirement.extra)) ? requirement.extra : null;
    const tokenName = extra ? _str(extra.name) : null;
    const tokenVersion = extra ? _str(extra.version) : null;
    if (tokenName === null || tokenVersion === null) {
      warnings.push('the token typed-data domain name or version was not declared in the requirement extra block, so the sponsored-approval handoff record carries nulls for them rather than an assumed value. The extension payload\'s own version field is a schema version and is never used here');
      flags.push('X402_PERMIT2_SPONSORED_DOMAIN_INCOMPLETE');
    }

    sponsored_approval = {
      errors: extErrors,
      spender_is_canonical_permit2: spenderIsCanonicalPermit2,
      owner_matches_from: ownerMatchesFrom,
      amount_covers_permitted: coversPermittedAmount,
      amount: extAmount !== null ? extAmount.toString() : null,
      deadline: extDeadline !== null ? extDeadline.toString() : null,
      deadline_status: extDeadlineStatus,
      extension_schema_version: extVersion,
    };

    handoff_612 = {
      name: tokenName,
      version: tokenVersion,
      chainId: chainId.toString(),
      verifyingContract: extAsset,
      owner: extFrom,
      spender: extSpender,
      value: extAmount !== null ? extAmount.toString() : null,
      nonce: extNonce !== null ? extNonce.toString() : null,
      deadline: extDeadline !== null ? extDeadline.toString() : null,
      signature: extSignature,
    };
  }

  // The recomputed marker is earned by the digest actually existing, so it is emitted behind
  // that condition rather than asserted on the way out.
  if (digestHex !== null) flags.push('X402_PERMIT2_DIGEST_RECOMPUTED');

  const output_payload = {
    verdict: 'DIGEST_RECOMPUTED',
    variant,
    errors,
    warnings,
    reasons: [],
    domain: domain_echo,
    type_string: typeString,
    typehash: _hex32(typehash),
    domain_typehash: _hex32(th.domain),
    domain_separator: _hex32(domainSeparator),
    struct_hash: _hex32(structHash),
    digest: digestHex,
    message,
    x402_binding,
    window,
    nonce_facts,
    allowance_expiry,
    signature_form,
    handoff_591,
    sponsored_approval,
    handoff_612,
    scope_note: SCOPE_NOTE,
  };

  return { output_payload, compliance_flags: flags };
}

const TOOL_ID = 'art-699-x402-permit2-evidence-recomputer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_x402_permit2_digest',
  mandate_type: 'compliance_control',
  gpu: false,
};

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
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
