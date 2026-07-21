import { executionHash } from './_hash.mjs';

// Vendored inline (NOT imported) so this kernel stays a self-contained script the
// chaingraph/vm QuickJS harness can run unmodified (its ESM-strip only expects kernels to
// import from ./_hash.mjs — see chaingraph/vm/kernel-vm.mjs stripEsmSyntaxForVm). Byte-identical
// to chaingraph/kernels/_proof.mjs lines 21-2939 (Keccak/SHA3 + NTT + ML-DSA, @noble, MIT,
// Paul Miller) through the ml_dsa44 definition. DO NOT hand-edit — resync from _proof.mjs.
// ── §PQC-1 hybrid ML-DSA proof (OCG SPEC.md §PQC-1, NORMATIVE OPTIONAL) — vendored FIPS 204 impl ──
// Vendored verbatim (function bodies unmodified; only import/export boilerplate stripped and a
// handful of same-name top-level bindings disambiguated — see rename notes below) from three
// MIT-licensed noble packages by Paul Miller (paulmillr.com), pinned to the exact versions used
// by the already-shipped _noble-bn254.bundle.mjs precedent's sibling packages:
//   @noble/post-quantum  v0.6.1  (ml-dsa.js, _crystals.js, utils.js)  — FIPS 204 ML-DSA reference
//   @noble/hashes        v2.2.0  (sha3.js, _u64.js, utils.js)         — Keccak/SHAKE + byte utils
//   @noble/curves        v2.2.0  (abstract/fft.js; utils.js:abool() only) — NTT/FFT core
// Source: https://registry.npmjs.org/@noble/{post-quantum,hashes,curves}/-/*.tgz (npm registry
// tarballs, license MIT verified against the registry manifest + each package's LICENSE file).
// DO NOT hand-edit the vendored block below — regenerate from the pinned tarballs + the same
// merge/rename recipe as CW-2 if the pin ever moves. Rename notes (collision-only, values
// untouched): sha3.js's BigInt `_1n` -> `_1n_sha3` (name-only clash with fft.js's `_1n`);
// @noble/hashes/utils.js's `randomBytes`/`copyBytes` -> `randomBytesRaw`/`copyBytesRaw` (name-only
// clash with @noble/post-quantum/utils.js's own higher-level `randomBytes`/`copyBytes` wrappers);
// import aliases `abytes_`/`randb` collapsed to their unaliased targets. Functional round-trip
// (keygen/sign/verify + tamper-rejection) verified against upstream noble-post-quantum's own
// public API shape before vendoring — see CW-2 check-off note.
// Exposes `ml_dsa65` (ML-DSA-65 / Category 3, the row-mandated default parameter set; ml_dsa44/87
// ride along unused but harmless — dead-code-eliminated by nothing here since there's no bundler,
// left in for parity with upstream and in case a future pinned-high-assurance ml_dsa87 path wants
// them without a re-vendor).
// ── @noble/hashes _u64.js (v2.2.0, MIT, Paul Miller) — 64-bit word helpers for Keccak ──────────
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
//# sourceMappingURL=_u64.js.map
// ── @noble/hashes utils.js (v2.2.0, MIT, Paul Miller) — byte/hash utilities ─────────────────────
/**
 * Checks if something is Uint8Array. Be careful: nodejs Buffer will return true.
 * @param a - value to test
 * @returns `true` when the value is a Uint8Array-compatible view.
 * @example
 * Check whether a value is a Uint8Array-compatible view.
 * ```ts
 * isBytes(new Uint8Array([1, 2, 3]));
 * ```
 */
function isBytes(a) {
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
    const bytes = isBytes(value);
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
 * const copy = copyBytesRaw(new Uint8Array([1, 2, 3]));
 * ```
 */
function copyBytesRaw(bytes) {
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
 * bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])); // 'cafe0123'
 * ```
 */
function bytesToHex(bytes) {
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
 * hexToBytes('cafe0123'); // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 * ```
 */
function hexToBytes(hex) {
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
// asyncLoop() (the @noble/hashes long-loop yield helper) is DELETED here — it used Date.now()
// (banned by the kernel-determinism lint) and this kernel never calls it (verify-only, no
// long-running key-generation loops). Dead code in the original vendor; not needed for parity.
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
    return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
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
 * concatBytes(new Uint8Array([1]), new Uint8Array([2]));
 * ```
 */
function concatBytes(...arrays) {
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
/**
 * Cryptographically secure PRNG backed by `crypto.getRandomValues`.
 * @param bytesLength - number of random bytes to generate
 * @returns Random bytes.
 * The platform `getRandomValues()` implementation still defines any
 * single-call length cap, and this helper rejects oversize requests
 * with a stable library `RangeError` instead of host-specific errors.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @throws If the current runtime does not provide `crypto.getRandomValues`. {@link Error}
 * @example
 * Generate a fresh random key or nonce.
 * ```ts
 * const key = randomBytesRaw(16);
 * ```
 */
function randomBytesRaw(bytesLength = 32) {
    // Match the repo's other length-taking helpers instead of relying on Uint8Array coercion.
    anumber(bytesLength, 'bytesLength');
    const cr = typeof globalThis === 'object' ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== 'function')
        throw new Error('crypto.getRandomValues must be defined');
    // Web Cryptography API Level 2 §10.1.1:
    // if `byteLength > 65536`, throw `QuotaExceededError`.
    // Keep the guard explicit so callers can see the quota in code
    // instead of discovering it by reading the spec or host errors.
    // This wrapper surfaces the same quota as a stable library RangeError.
    if (bytesLength > 65536)
        throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
}
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
// ── @noble/hashes sha3.js (v2.2.0, MIT, Paul Miller) — Keccak/SHA3/SHAKE ────────────────────────
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
const _1n_sha3 = BigInt(1);
const _2n = BigInt(2);
const _7n = BigInt(7);
const _256n = BigInt(256);
// FIPS 202 Algorithm 5 rc(): when the outgoing bit is 1, the 8-bit LFSR xors
// taps 0, 4, 5, and 6, which compresses to the feedback mask `0x71`.
const _0x71n = BigInt(0x71);
const SHA3_PI = [];
const SHA3_ROTL = [];
const _SHA3_IOTA = []; // no pure annotation: var is always used
for (let round = 0, R = _1n_sha3, x = 1, y = 0; round < 24; round++) {
    // Pi
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    // Rotational
    SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
    // Iota
    let t = _0n;
    for (let j = 0; j < 7; j++) {
        R = ((R << _1n_sha3) ^ ((R >> _7n) * _0x71n)) % _256n;
        if (R & _2n)
            t ^= _1n_sha3 << ((_1n_sha3 << BigInt(j)) - _1n_sha3);
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
// ── @noble/curves abstract/fft.js (v2.2.0, MIT, Paul Miller) — NTT/FFT core for CRYSTALS ────────
function checkU32(n) {
    // 0xff_ff_ff_ff
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff)
        throw new Error('wrong u32 integer:' + n);
    return n;
}
/**
 * Checks if integer is in form of `1 << X`.
 * @param x - Integer to inspect.
 * @returns `true` when the value is a power of two.
 * @throws If `x` is not a valid unsigned 32-bit integer. {@link Error}
 * @example
 * Validate that an FFT size is a power of two.
 *
 * ```ts
 * isPowerOfTwo(8);
 * ```
 */
function isPowerOfTwo(x) {
    checkU32(x);
    return (x & (x - 1)) === 0 && x !== 0;
}
/**
 * @param n - Input value.
 * @returns Next power of two within the u32/array-length domain.
 * @throws If `n` is not a valid unsigned 32-bit integer. {@link Error}
 * @example
 * Round an integer up to the FFT size it needs.
 *
 * ```ts
 * nextPowerOfTwo(9);
 * ```
 */
function nextPowerOfTwo(n) {
    checkU32(n);
    if (n <= 1)
        return 1;
    // FFT sizes here are used as JS array lengths, so `2^32` is not a meaningful result:
    // keep the fast u32 bit-twiddling path and fail explicitly instead of wrapping to 1.
    if (n > 0x8000_0000)
        throw new Error('nextPowerOfTwo overflow: result does not fit u32');
    return (1 << (log2(n - 1) + 1)) >>> 0;
}
/**
 * @param n - Value to reverse.
 * @param bits - Number of bits to use.
 * @returns Bit-reversed integer.
 * @throws If `n` is not a valid unsigned 32-bit integer. {@link Error}
 * @example
 * Reverse the low `bits` bits of one index.
 *
 * ```ts
 * reverseBits(3, 3);
 * ```
 */
function reverseBits(n, bits) {
    checkU32(n);
    if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
        throw new Error(`expected integer 0 <= bits <= 32, got ${bits}`);
    let reversed = 0;
    for (let i = 0; i < bits; i++, n >>>= 1)
        reversed = (reversed << 1) | (n & 1);
    // JS bitwise ops are signed i32; cast back so 32-bit reversals stay in the unsigned u32 domain.
    return reversed >>> 0;
}
/**
 * Similar to `bitLen(x)-1` but much faster for small integers, like indices.
 * @param n - Input value.
 * @returns Base-2 logarithm. For `n = 0`, the current implementation returns `-1`.
 * @throws If `n` is not a valid unsigned 32-bit integer. {@link Error}
 * @example
 * Compute the radix-2 stage count for one transform size.
 *
 * ```ts
 * log2(8);
 * ```
 */
function log2(n) {
    checkU32(n);
    return 31 - Math.clz32(n);
}
/**
 * Moves lowest bit to highest position, which at first step splits
 * array on even and odd indices, then it applied again to each part,
 * which is core of fft
 * @param values - Mutable coefficient array.
 * @returns Mutated input array.
 * @throws If the array length is not a positive power of two. {@link Error}
 * @example
 * Reorder coefficients into bit-reversed order in place.
 *
 * ```ts
 * const values = Uint8Array.from([0, 1, 2, 3]);
 * bitReversalInplace(values);
 * ```
 */
function bitReversalInplace(values) {
    const n = values.length;
    // Size-1 FFT is the identity, so bit-reversal must stay a no-op there instead of rejecting it.
    if (!isPowerOfTwo(n))
        throw new Error('expected positive power-of-two length, got ' + n);
    const bits = log2(n);
    for (let i = 0; i < n; i++) {
        const j = reverseBits(i, bits);
        if (i < j) {
            const tmp = values[i];
            values[i] = values[j];
            values[j] = tmp;
        }
    }
    return values;
}
/**
 * @param values - Input values.
 * @returns Reordered copy.
 * @throws If the array length is not a positive power of two. {@link Error}
 * @example
 * Return a reordered copy instead of mutating the input in place.
 *
 * ```ts
 * const reordered = bitReversalPermutation([0, 1, 2, 3]);
 * ```
 */
function bitReversalPermutation(values) {
    return bitReversalInplace(values.slice());
}
const _1n = /** @__PURE__ */ BigInt(1);
function findGenerator(field) {
    let G = BigInt(2);
    for (; field.eql(field.pow(G, field.ORDER >> _1n), field.ONE); G++)
        ;
    return G;
}
/**
 * We limit roots up to 2**31, which is a lot: 2-billion polynomimal should be rare.
 * @param field - Field implementation.
 * @param generator - Optional generator override.
 * @returns Roots-of-unity cache.
 * @example
 * Cache roots once, then ask for the omega table of one FFT size.
 *
 * ```ts
 * import { rootsOfUnity } from '@noble/curves/abstract/fft.js';
 * import { Field } from '@noble/curves/abstract/modular.js';
 * const roots = rootsOfUnity(Field(17n));
 * const omega = roots.omega(4);
 * ```
 */
function rootsOfUnity(field, generator) {
    // Factor field.ORDER-1 as oddFactor * 2^powerOfTwo
    let oddFactor = field.ORDER - _1n;
    let powerOfTwo = 0;
    for (; (oddFactor & _1n) !== _1n; powerOfTwo++, oddFactor >>= _1n)
        ;
    // Find non quadratic residue
    let G = generator !== undefined ? BigInt(generator) : findGenerator(field);
    // Powers of generator
    const omegas = new Array(powerOfTwo + 1);
    omegas[powerOfTwo] = field.pow(G, oddFactor);
    for (let i = powerOfTwo; i > 0; i--)
        omegas[i - 1] = field.sqr(omegas[i]);
    // Compute all roots of unity for powers up to maxPower
    const rootsCache = [];
    const checkBits = (bits) => {
        checkU32(bits);
        if (bits > 31 || bits > powerOfTwo)
            throw new Error('rootsOfUnity: wrong bits ' + bits + ' powerOfTwo=' + powerOfTwo);
        return bits;
    };
    const precomputeRoots = (maxPower) => {
        checkBits(maxPower);
        for (let power = maxPower; power >= 0; power--) {
            if (rootsCache[power])
                continue; // Skip if we've already computed roots for this power
            const rootsAtPower = [];
            for (let j = 0, cur = field.ONE; j < 2 ** power; j++, cur = field.mul(cur, omegas[power]))
                rootsAtPower.push(cur);
            rootsCache[power] = rootsAtPower;
        }
        return rootsCache[maxPower];
    };
    const brpCache = new Map();
    const inverseCache = new Map();
    // roots()/brp()/inverse() expose shared cached arrays by reference for speed; callers must treat them as read-only.
    // NOTE: we use bits instead of power, because power = 2**bits,
    // but power is not neccesary isPowerOfTwo(power)!
    return {
        info: { G, powerOfTwo, oddFactor },
        roots: (bits) => {
            const b = checkBits(bits);
            return precomputeRoots(b);
        },
        brp(bits) {
            const b = checkBits(bits);
            if (brpCache.has(b))
                return brpCache.get(b);
            else {
                const res = bitReversalPermutation(this.roots(b));
                brpCache.set(b, res);
                return res;
            }
        },
        inverse(bits) {
            const b = checkBits(bits);
            if (inverseCache.has(b))
                return inverseCache.get(b);
            else {
                const res = field.invertBatch(this.roots(b));
                inverseCache.set(b, res);
                return res;
            }
        },
        omega: (bits) => omegas[checkBits(bits)],
        clear: () => {
            rootsCache.splice(0, rootsCache.length);
            brpCache.clear();
            inverseCache.clear();
        },
    };
}
/**
 * Constructs different flavors of FFT. radix2 implementation of low level mutating API. Flavors:
 *
 * - DIT (Decimation-in-Time): Bottom-Up (leaves to root), Cool-Turkey
 * - DIF (Decimation-in-Frequency): Top-Down (root to leaves), Gentleman-Sande
 *
 * DIT takes brp input, returns natural output.
 * DIF takes natural input, returns brp output.
 *
 * The output is actually identical. Time / frequence distinction is not meaningful
 * for Polynomial multiplication in fields.
 * Which means if protocol supports/needs brp output/inputs, then we can skip this step.
 *
 * Cyclic NTT: Rq = Zq[x]/(x^n-1). butterfly_DIT+loop_DIT OR butterfly_DIF+loop_DIT, roots are omega
 * Negacyclic NTT: Rq = Zq[x]/(x^n+1). butterfly_DIT+loop_DIF, at least for mlkem / mldsa
 * @param F - Field operations.
 * @param coreOpts - FFT configuration:
 *   - `N`: Transform size. Must be a power of two.
 *   - `roots`: Stage roots for the selected transform size.
 *   - `dit`: Whether to run the DIT variant instead of DIF.
 *   - `invertButterflies` (optional): Whether to invert butterfly placement.
 *   - `skipStages` (optional): Number of initial stages to skip.
 *   - `brp` (optional): Whether to apply bit-reversal permutation at the boundary.
 * @returns Low-level FFT loop.
 * @throws If the FFT options or cached roots are invalid for the requested size. {@link Error}
 * @example
 * Constructs different flavors of FFT.
 *
 * ```ts
 * import { FFTCore, rootsOfUnity } from '@noble/curves/abstract/fft.js';
 * import { Field } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const roots = rootsOfUnity(Fp).roots(2);
 * const loop = FFTCore(Fp, { N: 4, roots, dit: true });
 * const values = loop([1n, 2n, 3n, 4n]);
 * ```
 */
const FFTCore = (F, coreOpts) => {
    const { N, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
    const bits = log2(N);
    if (!isPowerOfTwo(N))
        throw new Error('FFT: Polynomial size should be power of two');
    // Wrong-sized root tables can stay in-bounds for some loop shapes and silently compute nonsense.
    if (roots.length !== N)
        throw new Error(`FFT: wrong roots length: expected ${N}, got ${roots.length}`);
    const isDit = dit !== invertButterflies;
    isDit;
    return (values) => {
        if (values.length !== N)
            throw new Error('FFT: wrong Polynomial length');
        if (dit && brp)
            bitReversalInplace(values);
        for (let i = 0, g = 1; i < bits - skipStages; i++) {
            // For each stage s (sub-FFT length m = 2^s)
            const s = dit ? i + 1 + skipStages : bits - i;
            const m = 1 << s;
            const m2 = m >> 1;
            const stride = N >> s;
            // Loop over each subarray of length m
            for (let k = 0; k < N; k += m) {
                // Loop over each butterfly within the subarray
                for (let j = 0, grp = g++; j < m2; j++) {
                    const rootPos = invertButterflies ? (dit ? N - grp : grp) : j * stride;
                    const i0 = k + j;
                    const i1 = k + j + m2;
                    const omega = roots[rootPos];
                    const b = values[i1];
                    const a = values[i0];
                    // Inlining gives us 10% perf in kyber vs functions
                    if (isDit) {
                        const t = F.mul(b, omega); // Standard DIT butterfly
                        values[i0] = F.add(a, t);
                        values[i1] = F.sub(a, t);
                    }
                    else if (invertButterflies) {
                        values[i0] = F.add(b, a); // DIT loop + inverted butterflies (Kyber decode)
                        values[i1] = F.mul(F.sub(b, a), omega);
                    }
                    else {
                        values[i0] = F.add(a, b); // Standard DIF butterfly
                        values[i1] = F.mul(F.sub(a, b), omega);
                    }
                }
            }
        }
        if (!dit && brp)
            bitReversalInplace(values);
        return values;
    };
};
/**
 * NTT aka FFT over finite field (NOT over complex numbers).
 * Naming mirrors other libraries.
 * @param roots - Roots-of-unity cache.
 * @param opts - Field operations. See {@link FFTOpts}.
 * @returns Forward and inverse FFT helpers.
 * @example
 * NTT aka FFT over finite field (NOT over complex numbers).
 *
 * ```ts
 * import { FFT, rootsOfUnity } from '@noble/curves/abstract/fft.js';
 * import { Field } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const fft = FFT(rootsOfUnity(Fp), Fp);
 * const values = fft.direct([1n, 2n, 3n, 4n]);
 * ```
 */
function FFT(roots, opts) {
    const getLoop = (N, roots, brpInput = false, brpOutput = false) => {
        if (brpInput && brpOutput) {
            // we cannot optimize this case, but lets support it anyway
            return (values) => FFTCore(opts, { N, roots, dit: false, brp: false })(bitReversalInplace(values));
        }
        if (brpInput)
            return FFTCore(opts, { N, roots, dit: true, brp: false });
        if (brpOutput)
            return FFTCore(opts, { N, roots, dit: false, brp: false });
        return FFTCore(opts, { N, roots, dit: true, brp: true }); // all natural
    };
    return {
        direct(values, brpInput = false, brpOutput = false) {
            const N = values.length;
            if (!isPowerOfTwo(N))
                throw new Error('FFT: Polynomial size should be power of two');
            const bits = log2(N);
            return getLoop(N, roots.roots(bits), brpInput, brpOutput)(values.slice());
        },
        inverse(values, brpInput = false, brpOutput = false) {
            const N = values.length;
            if (!isPowerOfTwo(N))
                throw new Error('FFT: Polynomial size should be power of two');
            const bits = log2(N);
            const res = getLoop(N, roots.inverse(bits), brpInput, brpOutput)(values.slice());
            const ivm = opts.inv(BigInt(values.length)); // scale
            // we can get brp output if we use dif instead of dit!
            for (let i = 0; i < res.length; i++)
                res[i] = opts.mul(res[i], ivm);
            // Allows to re-use non-inverted roots, but is VERY fragile
            // return [res[0]].concat(res.slice(1).reverse());
            // inverse calculated as pow(-1), which transforms into ω^{-kn} (-> reverses indices)
            return res;
        },
    };
}
function poly(field, roots, create, fft, length) {
    const F = field;
    const _create = create ||
        ((len, elm) => new Array(len).fill(elm ?? F.ZERO));
    // `poly.mul(a, b)` distinguishes polynomial-vs-scalar at runtime, so keep accepted
    // polynomial containers concrete instead of trying to support arbitrary wrappers.
    const isPoly = (x) => {
        if (Array.isArray(x))
            return true;
        if (!ArrayBuffer.isView(x))
            return false;
        const v = x;
        return (typeof v.length === 'number' &&
            typeof v.slice === 'function' &&
            typeof v[Symbol.iterator] === 'function');
    };
    const checkLength = (...lst) => {
        if (!lst.length)
            return 0;
        for (const i of lst)
            if (!isPoly(i))
                throw new Error('poly: not polynomial: ' + i);
        const L = lst[0].length;
        for (let i = 1; i < lst.length; i++)
            if (lst[i].length !== L)
                throw new Error(`poly: mismatched lengths ${L} vs ${lst[i].length}`);
        if (length !== undefined && L !== length)
            throw new Error(`poly: expected fixed length ${length}, got ${L}`);
        return L;
    };
    function findOmegaIndex(x, n, brp = false) {
        const bits = log2(n);
        const omega = brp ? roots.brp(bits) : roots.roots(bits);
        for (let i = 0; i < n; i++)
            if (F.eql(x, omega[i]))
                return i;
        return -1;
    }
    // TODO: mutating versions for mlkem/mldsa
    return {
        roots,
        create: _create,
        length,
        extend: (a, len) => {
            checkLength(a);
            const out = _create(len, F.ZERO);
            // Plain arrays grow when writing past `out.length`, so cap the copy explicitly to keep
            // `extend()` consistent with typed arrays and with its documented truncate behavior.
            for (let i = 0; i < Math.min(a.length, len); i++)
                out[i] = a[i];
            return out;
        },
        degree: (a) => {
            checkLength(a);
            for (let i = a.length - 1; i >= 0; i--)
                if (!F.is0(a[i]))
                    return i;
            return -1;
        },
        add: (a, b) => {
            const len = checkLength(a, b);
            const out = _create(len);
            for (let i = 0; i < len; i++)
                out[i] = F.add(a[i], b[i]);
            return out;
        },
        sub: (a, b) => {
            const len = checkLength(a, b);
            const out = _create(len);
            for (let i = 0; i < len; i++)
                out[i] = F.sub(a[i], b[i]);
            return out;
        },
        dot: (a, b) => {
            const len = checkLength(a, b);
            const out = _create(len);
            for (let i = 0; i < len; i++)
                out[i] = F.mul(a[i], b[i]);
            return out;
        },
        mul: (a, b) => {
            if (isPoly(b)) {
                const len = checkLength(a, b);
                if (fft) {
                    const A = fft.direct(a, false, true);
                    const B = fft.direct(b, false, true);
                    for (let i = 0; i < A.length; i++)
                        A[i] = F.mul(A[i], B[i]);
                    return fft.inverse(A, true, false);
                }
                else {
                    // NOTE: this is quadratic and mostly for compat tests with FFT
                    const res = _create(len);
                    for (let i = 0; i < len; i++) {
                        for (let j = 0; j < len; j++) {
                            const k = (i + j) % len; // wrap mod length
                            res[k] = F.add(res[k], F.mul(a[i], b[j]));
                        }
                    }
                    return res;
                }
            }
            else {
                const out = _create(checkLength(a));
                for (let i = 0; i < out.length; i++)
                    out[i] = F.mul(a[i], b);
                return out;
            }
        },
        convolve(a, b) {
            const len = nextPowerOfTwo(a.length + b.length - 1);
            return this.mul(this.extend(a, len), this.extend(b, len));
        },
        shift(p, factor) {
            const out = _create(checkLength(p));
            out[0] = p[0];
            for (let i = 1, power = F.ONE; i < p.length; i++) {
                power = F.mul(power, factor);
                out[i] = F.mul(p[i], power);
            }
            return out;
        },
        clone: (a) => {
            checkLength(a);
            const out = _create(a.length);
            for (let i = 0; i < a.length; i++)
                out[i] = a[i];
            return out;
        },
        eval: (a, basis) => {
            checkLength(a, basis);
            let acc = F.ZERO;
            for (let i = 0; i < a.length; i++)
                acc = F.add(acc, F.mul(a[i], basis[i]));
            return acc;
        },
        monomial: {
            basis: (x, n) => {
                const out = _create(n);
                let pow = F.ONE;
                for (let i = 0; i < n; i++) {
                    out[i] = pow;
                    pow = F.mul(pow, x);
                }
                return out;
            },
            eval: (a, x) => {
                checkLength(a);
                // Same as eval(a, monomialBasis(x, a.length)), but it is faster this way
                let acc = F.ZERO;
                for (let i = a.length - 1; i >= 0; i--)
                    acc = F.add(F.mul(acc, x), a[i]);
                return acc;
            },
        },
        lagrange: {
            basis: (x, n, brp = false, weights) => {
                const bits = log2(n);
                const cache = weights || (brp ? roots.brp(bits) : roots.roots(bits)); // [ω⁰, ω¹, ..., ωⁿ⁻¹]
                const out = _create(n);
                // Fast Kronecker-δ shortcut
                const idx = findOmegaIndex(x, n, brp);
                if (idx !== -1) {
                    out[idx] = F.ONE;
                    return out;
                }
                const tm = F.pow(x, BigInt(n));
                const c = F.mul(F.sub(tm, F.ONE), F.inv(BigInt(n))); // c = (xⁿ - 1)/n
                const denom = _create(n);
                for (let i = 0; i < n; i++)
                    denom[i] = F.sub(x, cache[i]);
                const inv = F.invertBatch(denom);
                for (let i = 0; i < n; i++)
                    out[i] = F.mul(c, F.mul(cache[i], inv[i]));
                return out;
            },
            eval(a, x, brp = false) {
                checkLength(a);
                const idx = findOmegaIndex(x, a.length, brp);
                if (idx !== -1)
                    return a[idx]; // fast path
                const L = this.basis(x, a.length, brp); // Lᵢ(x)
                let acc = F.ZERO;
                for (let i = 0; i < a.length; i++)
                    if (!F.is0(a[i]))
                        acc = F.add(acc, F.mul(a[i], L[i]));
                return acc;
            },
        },
        vanishing(roots) {
            checkLength(roots);
            const out = _create(roots.length + 1, F.ZERO);
            out[0] = F.ONE;
            for (const r of roots) {
                const neg = F.neg(r);
                for (let j = out.length - 1; j > 0; j--)
                    out[j] = F.add(F.mul(out[j], neg), out[j - 1]);
                out[0] = F.mul(out[0], neg);
            }
            return out;
        },
    };
}
//# sourceMappingURL=fft.js.map
// ── @noble/curves utils.js (v2.2.0, MIT, Paul Miller) — abool() only ────────────────────────────
function abool(value, title = '') {
    if (typeof value !== 'boolean') {
        const prefix = title && `"${title}" `;
        throw new TypeError(prefix + 'expected boolean, got type=' + typeof value);
    }
    return value;
}

// ── @noble/post-quantum utils.js (v0.6.1, MIT, Paul Miller) ─────────────────────────────────────
/**
 * Utilities for hex, bytearray and number handling.
 * @module
 */
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
/**
 * Asserts that a value is a byte array and optionally checks its length.
 * Returns the original reference unchanged on success, and currently also accepts Node `Buffer`
 * values through the upstream validator.
 * This helper throws on malformed input, so APIs that must return `false` need to guard lengths
 * before decoding or before calling it.
 * @example
 * Validate that a value is a byte array with the expected length.
 * ```ts
 * abytes(new Uint8Array([1]), 1);
 * ```
 */
const abytesDoc = abytes;
/**
 * Concatenates byte arrays into a new `Uint8Array`.
 * Zero arguments return an empty `Uint8Array`.
 * Invalid segments throw before allocation because each argument is validated first.
 * @example
 * Concatenate two byte arrays into one result.
 * ```ts
 * concatBytes(new Uint8Array([1]), new Uint8Array([2]));
 * ```
 */
const concatBytesDoc = concatBytes;
/**
 * Returns cryptographically secure random bytes.
 * Requires `globalThis.crypto.getRandomValues` and throws if that API is unavailable.
 * `bytesLength` is validated by the upstream helper as a non-negative integer before allocation,
 * so negative and fractional values both throw instead of truncating through JS `ToIndex`.
 * @param bytesLength - Number of random bytes to generate.
 * @returns Fresh random bytes.
 * @example
 * Generate a fresh random seed.
 * ```ts
 * const seed = randomBytes(4);
 * ```
 */
const randomBytes = randomBytesRaw;
/**
 * Compares two byte arrays in a length-constant way for equal lengths.
 * Unequal lengths return `false` immediately, and there is no runtime type validation.
 * @param a - First byte array.
 * @param b - Second byte array.
 * @returns Whether both arrays contain the same bytes.
 * @example
 * Compare two byte arrays for equality.
 * ```ts
 * equalBytes(new Uint8Array([1]), new Uint8Array([1]));
 * ```
 */
function equalBytes(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a[i] ^ b[i];
    return diff === 0;
}
/**
 * Copies bytes into a fresh `Uint8Array`.
 * Returns a detached plain `Uint8Array` after validating that the input is real bytes.
 * @param bytes - Source bytes.
 * @returns Copy of the input bytes.
 * @example
 * Copy bytes into a fresh array.
 * ```ts
 * copyBytes(new Uint8Array([1, 2]));
 * ```
 */
function copyBytes(bytes) {
    // `Uint8Array.from(...)` would also accept arrays / other typed arrays. Keep this helper strict
    // because callers use it at byte-validation boundaries before mutating the detached copy.
    return Uint8Array.from(abytes(bytes));
}
/**
 * Byte-swaps each 64-bit lane in place.
 * Falcon's exact binary64 tables are stored as little-endian byte payloads, so BE runtimes need
 * this boundary helper before aliasing them as host `Float64Array` lanes.
 * @param arr - Byte buffer whose length is a multiple of 8.
 * @returns The same buffer after in-place 64-bit lane byte swaps.
 * @example
 * Byte-swap one 64-bit lane in place.
 * ```ts
 * byteSwap64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
 * ```
 */
function byteSwap64(arr) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    for (let i = 0; i < bytes.length; i += 8) {
        const a0 = bytes[i + 0];
        const a1 = bytes[i + 1];
        const a2 = bytes[i + 2];
        const a3 = bytes[i + 3];
        bytes[i + 0] = bytes[i + 7];
        bytes[i + 1] = bytes[i + 6];
        bytes[i + 2] = bytes[i + 5];
        bytes[i + 3] = bytes[i + 4];
        bytes[i + 4] = a3;
        bytes[i + 5] = a2;
        bytes[i + 6] = a1;
        bytes[i + 7] = a0;
    }
    return arr;
}
/**
 * Byte-swaps 64-bit lanes on big-endian runtimes and returns the input unchanged on little-endian.
 * This keeps Falcon's binary64 tables in canonical little-endian order before aliasing them as
 * `Float64Array` lanes on the current host.
 * @param arr - Buffer to pass through or swap in place.
 * @returns The same buffer, normalized for Falcon's little-endian table layout.
 * @example
 * Normalize one host-endian buffer for Falcon's float tables.
 * ```ts
 * baswap64If(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
 * ```
 */
const baswap64If = isLE
    ? (arr) => arr
    : byteSwap64;
/**
 * Validates that an options bag is a plain object.
 * @param opts - Options object to validate.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Validate that an options bag is a plain object.
 * ```ts
 * validateOpts({});
 * ```
 */
function validateOpts(opts) {
    // Arrays silently passed here before, but these call sites expect named option-bag fields.
    if (Object.prototype.toString.call(opts) !== '[object Object]')
        throw new TypeError('expected valid options object');
}
/**
 * Validates common verification options.
 * `context` itself is validated with `abytes(...)`, and individual algorithms may narrow support
 * further after this shared plain-object gate.
 * @param opts - Verification options. See {@link VerOpts}.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Validate common verification options.
 * ```ts
 * validateVerOpts({ context: new Uint8Array([1]) });
 * ```
 */
function validateVerOpts(opts) {
    validateOpts(opts);
    if (opts.context !== undefined)
        abytes(opts.context, undefined, 'opts.context');
}
/**
 * Validates common signing options.
 * `extraEntropy` is validated with `abytes(...)`; exact lengths and extra algorithm-specific
 * restrictions are enforced later by callers.
 * @param opts - Signing options. See {@link SigOpts}.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Validate common signing options.
 * ```ts
 * validateSigOpts({ extraEntropy: new Uint8Array([1]) });
 * ```
 */
function validateSigOpts(opts) {
    validateVerOpts(opts);
    if (opts.extraEntropy !== false && opts.extraEntropy !== undefined)
        abytes(opts.extraEntropy, undefined, 'opts.extraEntropy');
}
/**
 * Builds a fixed-layout coder from byte lengths and nested coders.
 * Raw-length fields decode as zero-copy `subarray(...)` views, and nested coders may preserve that
 * aliasing too. Nested coder `encode(...)` results are treated as owned scratch: `splitCoder`
 * copies them into the output and then zeroizes them with `fill(0)`. If a nested encoder forwards
 * caller-owned bytes, it must do so only after detaching them into a disposable copy.
 * @param label - Label used in validation errors.
 * @param lengths - Field lengths or nested coders.
 * @returns Composite fixed-length coder.
 * @example
 * Build a fixed-layout coder from byte lengths and nested coders.
 * ```ts
 * splitCoder('demo', 1, 2).encode([new Uint8Array([1]), new Uint8Array([2, 3])]);
 * ```
 */
function splitCoder(label, ...lengths) {
    const getLength = (c) => typeof c === 'number' ? c : c.bytesLen;
    const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
    return {
        bytesLen,
        encode: (bufs) => {
            const res = new Uint8Array(bytesLen);
            for (let i = 0, pos = 0; i < lengths.length; i++) {
                const c = lengths[i];
                const l = getLength(c);
                const b = typeof c === 'number' ? bufs[i] : c.encode(bufs[i]);
                abytes(b, l, label);
                res.set(b, pos);
                if (typeof c !== 'number')
                    b.fill(0); // clean
                pos += l;
            }
            return res;
        },
        decode: (buf) => {
            abytes(buf, bytesLen, label);
            const res = [];
            for (const c of lengths) {
                const l = getLength(c);
                const b = buf.subarray(0, l);
                res.push(typeof c === 'number' ? b : c.decode(b));
                buf = buf.subarray(l);
            }
            return res;
        },
    };
}
// nano-packed.array (fixed size)
/**
 * Builds a fixed-length vector coder from another fixed-length coder.
 * Element decoding receives `subarray(...)` views, so aliasing depends on the element coder.
 * Element coder `encode(...)` results are treated as owned scratch: `vecCoder` copies them into
 * the output and then zeroizes them with `fill(0)`. If an element encoder forwards caller-owned
 * bytes, it must do so only after detaching them into a disposable copy. `vecCoder` also trusts
 * the `BytesCoderLen` contract: each encoded element must already be exactly `c.bytesLen` bytes.
 * @param c - Element coder.
 * @param vecLen - Number of elements in the vector.
 * @returns Fixed-length vector coder.
 * @example
 * Build a fixed-length vector coder from another fixed-length coder.
 * ```ts
 * vecCoder(
 *   { bytesLen: 1, encode: (n: number) => Uint8Array.of(n), decode: (b: Uint8Array) => b[0] || 0 },
 *   2
 * ).encode([1, 2]);
 * ```
 */
function vecCoder(c, vecLen) {
    const coder = c;
    const bytesLen = vecLen * coder.bytesLen;
    return {
        bytesLen,
        encode: (u) => {
            if (u.length !== vecLen)
                throw new RangeError(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
            const res = new Uint8Array(bytesLen);
            for (let i = 0, pos = 0; i < u.length; i++) {
                const b = coder.encode(u[i]);
                res.set(b, pos);
                b.fill(0); // clean
                pos += b.length;
            }
            return res;
        },
        decode: (a) => {
            abytes(a, bytesLen);
            const r = [];
            for (let i = 0; i < a.length; i += coder.bytesLen)
                r.push(coder.decode(a.subarray(i, i + coder.bytesLen)));
            return r;
        },
    };
}
/**
 * Overwrites supported typed-array inputs with zeroes in place.
 * Accepts direct typed arrays and one-level arrays of them.
 * @param list - Typed arrays or one-level lists of typed arrays to clear.
 * @example
 * Overwrite typed arrays with zeroes.
 * ```ts
 * const buf = Uint8Array.of(1, 2, 3);
 * cleanBytes(buf);
 * ```
 */
function cleanBytes(...list) {
    for (const t of list) {
        if (Array.isArray(t))
            for (const b of t)
                b.fill(0);
        else
            t.fill(0);
    }
}
/**
 * Creates a 32-bit mask with the lowest `bits` bits set.
 * @param bits - Number of low bits to keep.
 * @returns Bit mask with `bits` ones.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Create a low-bit mask for packed-field operations.
 * ```ts
 * const mask = getMask(4);
 * ```
 */
function getMask(bits) {
    if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
        throw new RangeError(`expected bits in [0..32], got ${bits}`);
    // JS shifts are modulo 32, so bit 32 needs an explicit full-width mask.
    return bits === 32 ? 0xffffffff : ~(-1 << bits) >>> 0;
}
/** Shared empty byte array used as the default context. */
const EMPTY = /* @__PURE__ */ Uint8Array.of();
/**
 * Builds the domain-separated message payload for the pure sign/verify paths.
 * Context length `255` is valid; only `ctx.length > 255` is rejected.
 * @param msg - Message bytes.
 * @param ctx - Optional context bytes.
 * @returns Domain-separated message payload.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Build the domain-separated payload before direct signing.
 * ```ts
 * const payload = getMessage(new Uint8Array([1, 2]));
 * ```
 */
function getMessage(msg, ctx = EMPTY) {
    abytes(msg);
    abytes(ctx);
    if (ctx.length > 255)
        throw new RangeError('context should be 255 bytes or less');
    return concatBytes(new Uint8Array([0, ctx.length]), ctx, msg);
}
// DER tag+length plus the shared NIST hash OID arc 2.16.840.1.101.3.4.2.* used by the
// FIPS 204 / FIPS 205 pre-hash wrappers; the final byte selects SHA-256, SHA-512, SHAKE128,
// SHAKE256, or another approved hash/XOF under that subtree.
// 06 09 60 86 48 01 65 03 04 02
const oidNistP = /* @__PURE__ */ Uint8Array.from([6, 9, 0x60, 0x86, 0x48, 1, 0x65, 3, 4, 2]);
/**
 * Validates that a hash exposes a NIST hash OID and enough collision resistance.
 * Current accepted surface is broader than the FIPS algorithm tables: any hash/XOF under the NIST
 * `2.16.840.1.101.3.4.2.*` subtree is accepted if its effective `outputLen` is strong enough.
 * XOF callers must pass a callable whose `outputLen` matches the digest length they actually intend
 * to sign; bare `shake128` / `shake256` defaults are too short for the stronger prehash modes.
 * @param hash - Hash function to validate.
 * @param requiredStrength - Minimum required collision-resistance strength in bits.
 * @throws If the hash metadata or collision resistance is insufficient. {@link Error}
 * @example
 * Validate that a hash exposes a NIST hash OID and enough collision resistance.
 * ```ts
 * import { sha256 } from '@noble/hashes/sha2.js';
 * import { checkHash } from '@noble/post-quantum/utils.js';
 * checkHash(sha256, 128);
 * ```
 */
function checkHash(hash, requiredStrength = 0) {
    if (!hash.oid || !equalBytes(hash.oid.subarray(0, 10), oidNistP))
        throw new Error('hash.oid is invalid: expected NIST hash');
    // FIPS 204 / FIPS 205 require both collision and second-preimage strength; for approved NIST
    // hashes/XOFs under this OID subtree, the collision bound from the configured digest length is
    // the tighter runtime check, so enforce that lower bound here.
    const collisionResistance = (hash.outputLen * 8) / 2;
    if (requiredStrength > collisionResistance) {
        throw new Error('Pre-hash security strength too low: ' +
            collisionResistance +
            ', required: ' +
            requiredStrength);
    }
}
/**
 * Builds the domain-separated prehash payload for the prehash sign/verify paths.
 * Callers are expected to vet `hash.oid` first, e.g. via `checkHash(...)`; calling this helper
 * directly with a hash object that lacks `oid` currently throws later inside `concatBytes(...)`.
 * Context length `255` is valid; only `ctx.length > 255` is rejected.
 * @param hash - Prehash function.
 * @param msg - Message bytes.
 * @param ctx - Optional context bytes.
 * @returns Domain-separated prehash payload.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Build the domain-separated prehash payload for external hashing.
 * ```ts
 * import { sha256 } from '@noble/hashes/sha2.js';
 * import { getMessagePrehash } from '@noble/post-quantum/utils.js';
 * getMessagePrehash(sha256, new Uint8Array([1, 2]));
 * ```
 */
function getMessagePrehash(hash, msg, ctx = EMPTY) {
    abytes(msg);
    abytes(ctx);
    if (ctx.length > 255)
        throw new RangeError('context should be 255 bytes or less');
    const hashed = hash(msg);
    return concatBytes(new Uint8Array([1, ctx.length]), ctx, hash.oid, hashed);
}
//# sourceMappingURL=utils.js.map
// ── @noble/post-quantum _crystals.js (v0.6.1, MIT, Paul Miller) — shared CRYSTALS/lattice helpers ─
/**
 * Internal methods for lattice-based ML-KEM and ML-DSA.
 * @module
 */
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
/**
 * Creates shared modular arithmetic, NTT, and packing helpers for CRYSTALS schemes.
 * @param opts - Polynomial and transform parameters. See {@link CrystalOpts}.
 * @returns CRYSTALS arithmetic and encoding helpers.
 * @example
 * Create shared modular arithmetic and NTT helpers for a CRYSTALS parameter set.
 * ```ts
 * const crystals = genCrystals({
 *   newPoly: (n) => new Uint16Array(n),
 *   N: 256,
 *   Q: 3329,
 *   F: 3303,
 *   ROOT_OF_UNITY: 17,
 *   brvBits: 7,
 *   isKyber: true,
 * });
 * const reduced = crystals.mod(-1);
 * ```
 */
const genCrystals = (opts) => {
    // isKyber: true means Kyber, false means Dilithium
    const { newPoly, N, Q, F, ROOT_OF_UNITY, brvBits, isKyber } = opts;
    // Normalize JS `%` into the canonical Z_m representative `[0, modulo-1]` expected by
    // FIPS 203 §2.3 / FIPS 204 §2.3 before downstream mod-q arithmetic.
    const mod = (a, modulo = Q) => {
        const result = a % modulo | 0;
        return (result >= 0 ? result | 0 : (modulo + result) | 0) | 0;
    };
    // FIPS 204 §7.4 uses the centered `mod ±` representative for low bits, keeping the
    // positive midpoint when `modulo` is even.
    // Center to `[-floor((modulo-1)/2), floor(modulo/2)]`.
    const smod = (a, modulo = Q) => {
        const r = mod(a, modulo) | 0;
        return (r > modulo >> 1 ? (r - modulo) | 0 : r) | 0;
    };
    // Kyber uses the FIPS 203 Appendix A `BitRev_7` table here via the first 128 entries, while
    // Dilithium uses the FIPS 204 §7.5 / Appendix B `BitRev_8` zetas table over all 256 entries.
    function getZettas() {
        const out = newPoly(N);
        for (let i = 0; i < N; i++) {
            const b = reverseBits(i, brvBits);
            const p = BigInt(ROOT_OF_UNITY) ** BigInt(b) % BigInt(Q);
            out[i] = Number(p) | 0;
        }
        return out;
    }
    const nttZetas = getZettas();
    // Number-Theoretic Transform
    // Explained: https://electricdusk.com/ntt.html
    // Kyber has slightly different params, since there is no 512th primitive root of unity mod q,
    // only 256th primitive root of unity mod. Which also complicates MultiplyNTT.
    const field = {
        add: (a, b) => mod((a | 0) + (b | 0)) | 0,
        sub: (a, b) => mod((a | 0) - (b | 0)) | 0,
        mul: (a, b) => mod((a | 0) * (b | 0)) | 0,
        inv: (_a) => {
            throw new Error('not implemented');
        },
    };
    const nttOpts = {
        N,
        roots: nttZetas,
        invertButterflies: true,
        skipStages: isKyber ? 1 : 0,
        brp: false,
    };
    const dif = FFTCore(field, { dit: false, ...nttOpts });
    const dit = FFTCore(field, { dit: true, ...nttOpts });
    const NTT = {
        encode: (r) => {
            return dif(r);
        },
        decode: (r) => {
            dit(r);
            // The inverse-NTT normalization factor is family-specific: FIPS 203 Algorithm 10 line 14
            // uses `128^-1 mod q` for Kyber, while FIPS 204 Algorithm 42 lines 21-23 use `256^-1 mod q`.
            // kyber uses 128 here, because brv && stuff
            for (let i = 0; i < r.length; i++)
                r[i] = mod(F * r[i]);
            return r;
        },
    };
    // Pack one little-endian `d`-bit word per coefficient, matching FIPS 203 ByteEncode /
    // ByteDecode and the FIPS 204 BitsToBytes-based polynomial packing helpers.
    const bitsCoder = (d, c) => {
        const mask = getMask(d);
        const bytesLen = d * (N / 8);
        return {
            bytesLen,
            encode: (poly_) => {
                const poly = poly_;
                const r = new Uint8Array(bytesLen);
                for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
                    buf |= (c.encode(poly[i]) & mask) << bufLen;
                    bufLen += d;
                    for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
                        r[pos++] = buf & getMask(bufLen);
                }
                return r;
            },
            decode: (bytes) => {
                const r = newPoly(N);
                for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
                    buf |= bytes[i] << bufLen;
                    bufLen += 8;
                    for (; bufLen >= d; bufLen -= d, buf >>= d)
                        r[pos++] = c.decode(buf & mask);
                }
                return r;
            },
        };
    };
    return {
        mod,
        smod,
        nttZetas: nttZetas,
        NTT: {
            encode: (r) => NTT.encode(r),
            decode: (r) => NTT.decode(r),
        },
        bitsCoder: bitsCoder,
    };
};
const createXofShake = (shake) => (seed, blockLen) => {
    if (!blockLen)
        blockLen = shake.blockLen;
    // Optimizations that won't mater:
    // - cached seed update (two .update(), on start and on the end)
    // - another cache which cloned into working copy
    // Faster than multiple updates, since seed less than blockLen
    const _seed = new Uint8Array(seed.length + 2);
    _seed.set(seed);
    const seedLen = seed.length;
    const buf = new Uint8Array(blockLen); // == shake128.blockLen
    let h = shake.create({});
    let calls = 0;
    let xofs = 0;
    return {
        stats: () => ({ calls, xofs }),
        get: (x, y) => {
            // Rebind to `seed || x || y` so callers can implement the spec's per-coordinate
            // SHAKE inputs like `rho || j || i` and `rho || IntegerToBytes(counter, 2)`.
            _seed[seedLen + 0] = x;
            _seed[seedLen + 1] = y;
            h.destroy();
            h = shake.create({}).update(_seed);
            calls++;
            return () => {
                xofs++;
                return h.xofInto(buf);
            };
        },
        clean: () => {
            h.destroy();
            cleanBytes(buf, _seed);
        },
    };
};
/**
 * SHAKE128-based extendable-output reader factory used by ML-KEM.
 * `get(x, y)` selects one coordinate pair at a time; calling it again invalidates previously
 * returned readers, and each squeeze reuses one mutable internal output buffer.
 * @param seed - Seed bytes for the reader.
 * @param blockLen - Optional output block length.
 * @returns Stateful XOF reader.
 * @example
 * Build the ML-KEM SHAKE128 matrix expander and read one block.
 * ```ts
 * import { randomBytes } from '@noble/post-quantum/utils.js';
 * import { XOF128 } from '@noble/post-quantum/_crystals.js';
 * const reader = XOF128(randomBytes(32));
 * const block = reader.get(0, 0)();
 * ```
 */
const XOF128 = /* @__PURE__ */ createXofShake(shake128);
/**
 * SHAKE256-based extendable-output reader factory used by ML-DSA.
 * `get(x, y)` appends raw one-byte coordinates to the seed, invalidates previously returned
 * readers, and reuses one mutable internal output buffer for each squeeze.
 * @param seed - Seed bytes for the reader.
 * @param blockLen - Optional output block length.
 * @returns Stateful XOF reader.
 * @example
 * Build the ML-DSA SHAKE256 coefficient expander and read one block.
 * ```ts
 * import { randomBytes } from '@noble/post-quantum/utils.js';
 * import { XOF256 } from '@noble/post-quantum/_crystals.js';
 * const reader = XOF256(randomBytes(32));
 * const block = reader.get(0, 0)();
 * ```
 */
const XOF256 = /* @__PURE__ */ createXofShake(shake256);
//# sourceMappingURL=_crystals.js.map
// ── @noble/post-quantum ml-dsa.js (v0.6.1, MIT, Paul Miller) — FIPS 204 ML-DSA ──────────────────
/**
 * ML-DSA: Module Lattice-based Digital Signature Algorithm from
 * [FIPS-204](https://csrc.nist.gov/pubs/fips/204/ipd). A.k.a. CRYSTALS-Dilithium.
 *
 * Has similar internals to ML-KEM, but their keys and params are different.
 * Check out [official site](https://www.pq-crystals.org/dilithium/index.shtml),
 * [repo](https://github.com/pq-crystals/dilithium).
 * @module
 */
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
function validateInternalOpts(opts) {
    validateOpts(opts);
    if (opts.externalMu !== undefined)
        abool(opts.externalMu, 'opts.externalMu');
}
// Constants
// FIPS 204 fixes ML-DSA over R = Z[X]/(X^256 + 1), so every polynomial has 256 coefficients.
const N = 256;
// 2**23 − 2**13 + 1, 23 bits: multiply will be 46. We have enough precision in JS to avoid bigints
const Q = 8380417;
// FIPS 204 §2.5 / Table 1 fixes zeta = 1753 as the 512th root of unity used by ML-DSA's NTT.
const ROOT_OF_UNITY = 1753;
// f = 256**−1 mod q, pow(256, -1, q) = 8347681 (python3)
const F = 8347681;
// FIPS 204 Table 1 / §7.4 fixes d = 13 dropped low bits for Power2Round on t.
const D = 13;
// FIPS 204 Table 1 fixes gamma2 to (q-1)/88 for ML-DSA-44 and (q-1)/32 for ML-DSA-65/87;
// §7.4 then uses alpha = 2*gamma2 for Decompose / MakeHint / UseHint.
// Dilithium is kinda parametrized over GAMMA2, but everything will break with any other value.
const GAMMA2_1 = Math.floor((Q - 1) / 88) | 0;
const GAMMA2_2 = Math.floor((Q - 1) / 32) | 0;
/** Internal params for different versions of ML-DSA  */
// prettier-ignore
/** Built-in ML-DSA parameter presets keyed by security categories `2/3/5`
 * for `ml_dsa44` / `ml_dsa65` / `ml_dsa87`.
 * This is only the Table 1 subset used directly here: `BETA = TAU * ETA` is derived later,
 * while `C_TILDE_BYTES`, `TR_BYTES`, `CRH_BYTES`, and `securityLevel` live in the preset wrappers.
 */
const PARAMS = /* @__PURE__ */ (() => Object.freeze({
    2: Object.freeze({
        K: 4, L: 4, D, GAMMA1: 2 ** 17, GAMMA2: GAMMA2_1, TAU: 39, ETA: 2, OMEGA: 80
    }),
    3: Object.freeze({
        K: 6, L: 5, D, GAMMA1: 2 ** 19, GAMMA2: GAMMA2_2, TAU: 49, ETA: 4, OMEGA: 55
    }),
    5: Object.freeze({
        K: 8, L: 7, D, GAMMA1: 2 ** 19, GAMMA2: GAMMA2_2, TAU: 60, ETA: 2, OMEGA: 75
    }),
}))();
const newPoly = (n) => new Int32Array(n);
// Shared CRYSTALS helper in the ML-DSA branch: non-Kyber mode, 8-bit bit-reversal,
// and Int32Array polys because ordinary-form coefficients can be negative / centered.
const crystals = /* @__PURE__ */ genCrystals({
    N,
    Q,
    F,
    ROOT_OF_UNITY,
    newPoly,
    isKyber: false,
    brvBits: 8,
});
const id = (n) => n;
// compress()/verify() must be compatible in both directions:
// wrap the shared d-bit packer with the FIPS 204 SimpleBitPack / BitPack coefficient maps.
// malformed-input rejection only happens through the optional verify hook.
const polyCoder = (d, compress = id, verify = id) => crystals.bitsCoder(d, {
    encode: (i) => compress(verify(i)),
    decode: (i) => verify(compress(i)),
});
// Mutates `a` in place; callers must pass same-length polynomials.
const polyAdd = (a_, b_) => {
    const a = a_;
    const b = b_;
    for (let i = 0; i < a.length; i++)
        a[i] = crystals.mod(a[i] + b[i]);
    return a;
};
// Mutates `a` in place; callers must pass same-length polynomials.
const polySub = (a_, b_) => {
    const a = a_;
    const b = b_;
    for (let i = 0; i < a.length; i++)
        a[i] = crystals.mod(a[i] - b[i]);
    return a;
};
// Mutates `p` in place and assumes it is a decoded `t1`-range polynomial.
const polyShiftl = (p_) => {
    const p = p_;
    for (let i = 0; i < N; i++)
        p[i] <<= D;
    return p;
};
const polyChknorm = (p_, B) => {
    const p = p_;
    // FIPS 204 Algorithms 7 and 8 express the same centered-norm check with explicit inequalities.
    for (let i = 0; i < N; i++)
        if (Math.abs(crystals.smod(p[i])) >= B)
            return true;
    return false;
};
// Both inputs must already be in NTT / `T_q` form.
const MultiplyNTTs = (a_, b_) => {
    const a = a_;
    const b = b_;
    // NOTE: we don't use montgomery reduction in code, since it requires 64 bit ints,
    // which is not available in JS. mod(a[i] * b[i]) is ok, since Q is 23 bit,
    // which means a[i] * b[i] is 46 bit, which is safe to use in JS. (number is 53 bits).
    // Barrett reduction is slower than mod :(
    const c = newPoly(N);
    for (let i = 0; i < a.length; i++)
        c[i] = crystals.mod(a[i] * b[i]);
    return c;
};
// Return poly in NTT representation
function RejNTTPoly(xof_) {
    const xof = xof_;
    // Samples a polynomial ∈ Tq. xof() must return byte lengths divisible by 3.
    const r = newPoly(N);
    // NOTE: we can represent 3xu24 as 4xu32, but it doesn't improve perf :(
    for (let j = 0; j < N;) {
        const b = xof();
        if (b.length % 3)
            throw new Error('RejNTTPoly: unaligned block');
        for (let i = 0; j < N && i <= b.length - 3; i += 3) {
            // FIPS 204 Algorithm 14 clears the top bit of b2 before forming the 23-bit candidate.
            const t = (b[i + 0] | (b[i + 1] << 8) | (b[i + 2] << 16)) & 0x7fffff; // 3 bytes
            if (t < Q)
                r[j++] = t;
        }
    }
    return r;
}
// Instantiate one ML-DSA parameter set from the Table 1 lattice constants plus the
// Table 2 byte lengths / hash-width choices used by the public wrappers below.
function getDilithium(opts_) {
    const opts = opts_;
    const { K, L, GAMMA1, GAMMA2, TAU, ETA, OMEGA } = opts;
    const { CRH_BYTES, TR_BYTES, C_TILDE_BYTES, XOF128, XOF256, securityLevel } = opts;
    if (![2, 4].includes(ETA))
        throw new Error('Wrong ETA');
    if (![1 << 17, 1 << 19].includes(GAMMA1))
        throw new Error('Wrong GAMMA1');
    if (![GAMMA2_1, GAMMA2_2].includes(GAMMA2))
        throw new Error('Wrong GAMMA2');
    const BETA = TAU * ETA;
    const decompose = (r) => {
        // Decomposes r into (r1, r0) such that r ≡ r1(2γ2) + r0 mod q.
        const rPlus = crystals.mod(r);
        const r0 = crystals.smod(rPlus, 2 * GAMMA2) | 0;
        // FIPS 204 Algorithm 36 folds the top bucket `q-1` back to `(r1, r0) = (0, r0-1)`.
        if (rPlus - r0 === Q - 1)
            return { r1: 0 | 0, r0: (r0 - 1) | 0 };
        const r1 = Math.floor((rPlus - r0) / (2 * GAMMA2)) | 0;
        return { r1, r0 }; // r1 = HighBits, r0 = LowBits
    };
    const HighBits = (r) => decompose(r).r1;
    const LowBits = (r) => decompose(r).r0;
    const MakeHint = (z, r) => {
        // Compute hint bit indicating whether adding z to r alters the high bits of r.
        // FIPS 204 §6.2 also permits the Section 5.1 alternative from [6], which uses the
        // transformed low-bits/high-bits state at this call site instead of Algorithm 39 literally.
        // This optimized predicate only applies to those transformed Section 5.1 inputs; it is
        // not a drop-in replacement for Algorithm 39 on arbitrary `(z, r)` pairs.
        // From dilithium code
        const res0 = z <= GAMMA2 || z > Q - GAMMA2 || (z === Q - GAMMA2 && r === 0) ? 0 : 1;
        // from FIPS204:
        // // const r1 = HighBits(r);
        // // const v1 = HighBits(r + z);
        // // const res1 = +(r1 !== v1);
        // But they return different results! However, decompose is same.
        // So, either there is a bug in Dilithium ref implementation or in FIPS204.
        // For now, lets use dilithium one, so test vectors can be passed.
        // The round-3 Dilithium / ML-DSA code uses the same low-bits / high-bits convention after
        // `r0 += ct0`.
        // See dilithium-py README section "Optimising decomposition and making hints".
        return res0;
    };
    const UseHint = (h, r) => {
        // Returns the high bits of r adjusted according to hint h
        const m = Math.floor((Q - 1) / (2 * GAMMA2));
        const { r1, r0 } = decompose(r);
        // 3: if h = 1 and r0 > 0 return (r1 + 1) mod m
        // 4: if h = 1 and r0 ≤ 0 return (r1 − 1) mod m
        if (h === 1)
            return r0 > 0 ? crystals.mod(r1 + 1, m) | 0 : crystals.mod(r1 - 1, m) | 0;
        return r1 | 0;
    };
    const Power2Round = (r) => {
        // Decomposes r into (r1, r0) such that r ≡ r1*(2**d) + r0 mod q.
        const rPlus = crystals.mod(r);
        const r0 = crystals.smod(rPlus, 2 ** D) | 0;
        return { r1: Math.floor((rPlus - r0) / 2 ** D) | 0, r0 };
    };
    const hintCoder = {
        bytesLen: OMEGA + K,
        encode: (h_) => {
            const h = h_;
            if (h === false)
                throw new Error('hint.encode: hint is false'); // should never happen
            const res = new Uint8Array(OMEGA + K);
            for (let i = 0, k = 0; i < K; i++) {
                for (let j = 0; j < N; j++)
                    if (h[i][j] !== 0)
                        res[k++] = j;
                res[OMEGA + i] = k;
            }
            return res;
        },
        decode: (buf) => {
            const h = [];
            let k = 0;
            for (let i = 0; i < K; i++) {
                const hi = newPoly(N);
                if (buf[OMEGA + i] < k || buf[OMEGA + i] > OMEGA)
                    return false;
                for (let j = k; j < buf[OMEGA + i]; j++) {
                    if (j > k && buf[j] <= buf[j - 1])
                        return false;
                    hi[buf[j]] = 1;
                }
                k = buf[OMEGA + i];
                h.push(hi);
            }
            for (let j = k; j < OMEGA; j++)
                if (buf[j] !== 0)
                    return false;
            return h;
        },
    };
    const ETACoder = polyCoder(ETA === 2 ? 3 : 4, (i) => ETA - i, (i) => {
        if (!(-ETA <= i && i <= ETA))
            throw new Error(`malformed key s1/s3 ${i} outside of ETA range [${-ETA}, ${ETA}]`);
        return i;
    });
    const T0Coder = polyCoder(13, (i) => (1 << (D - 1)) - i);
    const T1Coder = polyCoder(10);
    // Requires smod. Need to fix!
    const ZCoder = polyCoder(GAMMA1 === 1 << 17 ? 18 : 20, (i) => crystals.smod(GAMMA1 - i));
    const W1Coder = polyCoder(GAMMA2 === GAMMA2_1 ? 6 : 4);
    const W1Vec = vecCoder(W1Coder, K);
    // Main structures
    const publicCoder = splitCoder('publicKey', 32, vecCoder(T1Coder, K));
    const secretCoder = splitCoder('secretKey', 32, 32, TR_BYTES, vecCoder(ETACoder, L), vecCoder(ETACoder, K), vecCoder(T0Coder, K));
    const sigCoder = splitCoder('signature', C_TILDE_BYTES, vecCoder(ZCoder, L), hintCoder);
    const CoefFromHalfByte = ETA === 2
        ? (n) => (n < 15 ? 2 - (n % 5) : false)
        : (n) => (n < 9 ? 4 - n : false);
    // Return poly in ordinary representation.
    // This helper returns ordinary-form `[-ETA, ETA]` coefficients for ExpandS; callers apply
    // `NTT.encode()` later when needed.
    function RejBoundedPoly(xof_) {
        const xof = xof_;
        // Samples an element a ∈ Rq with coeffcients in [−η, η] computed via rejection sampling from ρ.
        const r = newPoly(N);
        for (let j = 0; j < N;) {
            const b = xof();
            for (let i = 0; j < N && i < b.length; i += 1) {
                // half byte. Should be superfast with vector instructions. But very slow with js :(
                const d1 = CoefFromHalfByte(b[i] & 0x0f);
                const d2 = CoefFromHalfByte((b[i] >> 4) & 0x0f);
                if (d1 !== false)
                    r[j++] = d1;
                if (j < N && d2 !== false)
                    r[j++] = d2;
            }
        }
        return r;
    }
    const SampleInBall = (seed) => {
        // Samples a polynomial c ∈ Rq with coeffcients from {−1, 0, 1} and Hamming weight τ
        const pre = newPoly(N);
        const s = shake256.create({}).update(seed);
        const buf = new Uint8Array(shake256.blockLen);
        s.xofInto(buf);
        // FIPS 204 Algorithm 29 uses the first 8 squeezed bytes as the 64 sign bits `h`,
        // then rejection-samples coefficient positions from the remaining XOF stream.
        const masks = buf.slice(0, 8);
        for (let i = N - TAU, pos = 8, maskPos = 0, maskBit = 0; i < N; i++) {
            let b = i + 1;
            for (; b > i;) {
                b = buf[pos++];
                if (pos < shake256.blockLen)
                    continue;
                s.xofInto(buf);
                pos = 0;
            }
            pre[i] = pre[b];
            pre[b] = 1 - (((masks[maskPos] >> maskBit++) & 1) << 1);
            if (maskBit >= 8) {
                maskPos++;
                maskBit = 0;
            }
        }
        return pre;
    };
    const polyPowerRound = (p_) => {
        const p = p_;
        const res0 = newPoly(N);
        const res1 = newPoly(N);
        for (let i = 0; i < p.length; i++) {
            const { r0, r1 } = Power2Round(p[i]);
            res0[i] = r0;
            res1[i] = r1;
        }
        return { r0: res0, r1: res1 };
    };
    const polyUseHint = (u_, h_) => {
        const u = u_;
        const h = h_;
        // In-place on `u`: verification only needs the recovered high bits, so reuse the
        // temporary `wApprox` buffer instead of allocating another polynomial.
        for (let i = 0; i < N; i++)
            u[i] = UseHint(h[i], u[i]);
        return u;
    };
    const polyMakeHint = (a_, b_) => {
        const a = a_;
        const b = b_;
        const v = newPoly(N);
        let cnt = 0;
        for (let i = 0; i < N; i++) {
            const h = MakeHint(a[i], b[i]);
            v[i] = h;
            cnt += h;
        }
        return { v, cnt };
    };
    const signRandBytes = 32;
    const seedCoder = splitCoder('seed', 32, 64, 32);
    // API & argument positions are exactly as in FIPS204.
    const internal = Object.freeze({
        info: Object.freeze({ type: 'internal-ml-dsa' }),
        lengths: Object.freeze({
            secretKey: secretCoder.bytesLen,
            publicKey: publicCoder.bytesLen,
            seed: 32,
            signature: sigCoder.bytesLen,
            signRand: signRandBytes,
        }),
        keygen: (seed) => {
            // H(𝜉||IntegerToBytes(𝑘, 1)||IntegerToBytes(ℓ, 1), 128) 2: ▷ expand seed
            const seedDst = new Uint8Array(32 + 2);
            const randSeed = seed === undefined;
            if (randSeed)
                seed = randomBytes(32);
            abytes(seed, 32, 'seed');
            seedDst.set(seed);
            if (randSeed)
                cleanBytes(seed);
            seedDst[32] = K;
            seedDst[33] = L;
            const [rho, rhoPrime, K_] = seedCoder.decode(shake256(seedDst, { dkLen: seedCoder.bytesLen }));
            const xofPrime = XOF256(rhoPrime);
            const s1 = [];
            for (let i = 0; i < L; i++)
                s1.push(RejBoundedPoly(xofPrime.get(i & 0xff, (i >> 8) & 0xff)));
            const s2 = [];
            for (let i = L; i < L + K; i++)
                s2.push(RejBoundedPoly(xofPrime.get(i & 0xff, (i >> 8) & 0xff)));
            const s1Hat = s1.map((i) => crystals.NTT.encode(i.slice()));
            const t0 = [];
            const t1 = [];
            const xof = XOF128(rho);
            const t = newPoly(N);
            for (let i = 0; i < K; i++) {
                // t ← NTT−1(A*NTT(s1)) + s2
                cleanBytes(t); // don't-reallocate
                for (let j = 0; j < L; j++) {
                    const aij = RejNTTPoly(xof.get(j, i)); // super slow!
                    polyAdd(t, MultiplyNTTs(aij, s1Hat[j]));
                }
                crystals.NTT.decode(t);
                const { r0, r1 } = polyPowerRound(polyAdd(t, s2[i])); // (t1, t0) ← Power2Round(t, d)
                t0.push(r0);
                t1.push(r1);
            }
            const publicKey = publicCoder.encode([rho, t1]); // pk ← pkEncode(ρ, t1)
            const tr = shake256(publicKey, { dkLen: TR_BYTES }); // tr ← H(BytesToBits(pk), 512)
            // sk ← skEncode(ρ, K,tr, s1, s2, t0)
            const secretKey = secretCoder.encode([rho, K_, tr, s1, s2, t0]);
            xof.clean();
            xofPrime.clean();
            // STATS
            // Kyber512: { calls: 4, xofs: 12 }, Kyber768: { calls: 9, xofs: 27 },
            // Kyber1024: { calls: 16, xofs: 48 }
            // DSA44: { calls: 24, xofs: 24 }, DSA65: { calls: 41, xofs: 41 },
            // DSA87: { calls: 71, xofs: 71 }
            cleanBytes(rho, rhoPrime, K_, s1, s2, s1Hat, t, t0, t1, tr, seedDst);
            return {
                publicKey: publicKey,
                secretKey: secretKey,
            };
        },
        getPublicKey: (secretKey) => {
            // (ρ, K,tr, s1, s2, t0) ← skDecode(sk)
            const [rho, _K, _tr, s1, s2, _t0] = secretCoder.decode(secretKey);
            const xof = XOF128(rho);
            const s1Hat = s1.map((p) => crystals.NTT.encode(p.slice()));
            const t1 = [];
            const tmp = newPoly(N);
            for (let i = 0; i < K; i++) {
                tmp.fill(0);
                for (let j = 0; j < L; j++) {
                    const aij = RejNTTPoly(xof.get(j, i)); // A_ij in NTT
                    polyAdd(tmp, MultiplyNTTs(aij, s1Hat[j])); // += A_ij * s1_j
                }
                crystals.NTT.decode(tmp); // NTT⁻¹
                polyAdd(tmp, s2[i]); // t_i = A·s1 + s2
                const { r1 } = polyPowerRound(tmp); // r1 = t1, r0 ≈ t0
                t1.push(r1);
            }
            xof.clean();
            cleanBytes(tmp, s1Hat, _t0, s1, s2);
            return publicCoder.encode([rho, t1]);
        },
        // NOTE: random is optional.
        sign: (msg, secretKey, opts = {}) => {
            validateSigOpts(opts);
            validateInternalOpts(opts);
            let { extraEntropy: random, externalMu = false } = opts;
            // This part can be pre-cached per secretKey, but there is only minor performance improvement,
            // since we re-use a lot of variables to computation.
            // (ρ, K,tr, s1, s2, t0) ← skDecode(sk)
            const [rho, _K, tr, s1, s2, t0] = secretCoder.decode(secretKey);
            // Cache matrix to avoid re-compute later
            const A = []; // A ← ExpandA(ρ)
            const xof = XOF128(rho);
            for (let i = 0; i < K; i++) {
                const pv = [];
                for (let j = 0; j < L; j++)
                    pv.push(RejNTTPoly(xof.get(j, i)));
                A.push(pv);
            }
            xof.clean();
            for (let i = 0; i < L; i++)
                crystals.NTT.encode(s1[i]); // sˆ1 ← NTT(s1)
            for (let i = 0; i < K; i++) {
                crystals.NTT.encode(s2[i]); // sˆ2 ← NTT(s2)
                crystals.NTT.encode(t0[i]); // tˆ0 ← NTT(t0)
            }
            // This part is per msg
            const mu = externalMu
                ? msg
                : // 6: µ ← H(tr||M, 512)
                    //    ▷ Compute message representative µ
                    shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest();
            // Compute private random seed
            const rnd = random === false
                ? new Uint8Array(32)
                : random === undefined
                    ? randomBytes(signRandBytes)
                    : random;
            abytes(rnd, 32, 'extraEntropy');
            const rhoprime = shake256
                .create({ dkLen: CRH_BYTES })
                .update(_K)
                .update(rnd)
                .update(mu)
                .digest(); // ρ′← H(K||rnd||µ, 512)
            abytes(rhoprime, CRH_BYTES);
            const x256 = XOF256(rhoprime, ZCoder.bytesLen);
            //  Rejection sampling loop
            main_loop: for (let kappa = 0;;) {
                const y = [];
                // y ← ExpandMask(ρ , κ)
                for (let i = 0; i < L; i++, kappa++)
                    y.push(ZCoder.decode(x256.get(kappa & 0xff, kappa >> 8)()));
                const z = y.map((i) => crystals.NTT.encode(i.slice()));
                const w = [];
                for (let i = 0; i < K; i++) {
                    // w ← NTT−1(A ◦ NTT(y))
                    const wi = newPoly(N);
                    for (let j = 0; j < L; j++)
                        polyAdd(wi, MultiplyNTTs(A[i][j], z[j]));
                    crystals.NTT.decode(wi);
                    w.push(wi);
                }
                const w1 = w.map((j) => j.map(HighBits)); // w1 ← HighBits(w)
                // Commitment hash: c˜ ∈{0, 1 2λ } ← H(µ||w1Encode(w1), 2λ)
                const cTilde = shake256
                    .create({ dkLen: C_TILDE_BYTES })
                    .update(mu)
                    .update(W1Vec.encode(w1))
                    .digest();
                // Verifer’s challenge
                // c ← SampleInBall(c˜1); cˆ ← NTT(c)
                const cHat = crystals.NTT.encode(SampleInBall(cTilde));
                // ⟨⟨cs1⟩⟩ ← NTT−1(cˆ◦ sˆ1)
                const cs1 = s1.map((i) => MultiplyNTTs(i, cHat));
                for (let i = 0; i < L; i++) {
                    polyAdd(crystals.NTT.decode(cs1[i]), y[i]); // z ← y + ⟨⟨cs1⟩⟩
                    if (polyChknorm(cs1[i], GAMMA1 - BETA))
                        continue main_loop; // ||z||∞ ≥ γ1 − β
                }
                // cs1 is now z (▷ Signer’s response)
                let cnt = 0;
                const h = [];
                for (let i = 0; i < K; i++) {
                    const cs2 = crystals.NTT.decode(MultiplyNTTs(s2[i], cHat)); // ⟨⟨cs2⟩⟩ ← NTT−1(cˆ◦ sˆ2)
                    const r0 = polySub(w[i], cs2).map(LowBits); // r0 ← LowBits(w − ⟨⟨cs2⟩⟩)
                    if (polyChknorm(r0, GAMMA2 - BETA))
                        continue main_loop; // ||r0||∞ ≥ γ2 − β
                    const ct0 = crystals.NTT.decode(MultiplyNTTs(t0[i], cHat)); // ⟨⟨ct0⟩⟩ ← NTT−1(cˆ◦ tˆ0)
                    if (polyChknorm(ct0, GAMMA2))
                        continue main_loop;
                    polyAdd(r0, ct0);
                    // ▷ Signer’s hint
                    const hint = polyMakeHint(r0, w1[i]); // h ← MakeHint(−⟨⟨ct0⟩⟩, w− ⟨⟨cs2⟩⟩ + ⟨⟨ct0⟩⟩)
                    h.push(hint.v);
                    cnt += hint.cnt;
                }
                if (cnt > OMEGA)
                    continue; // the number of 1’s in h is greater than ω
                x256.clean();
                const res = sigCoder.encode([cTilde, cs1, h]); // σ ← sigEncode(c˜, z mod±q, h)
                // rho, _K, tr is subarray of secretKey, cannot clean.
                cleanBytes(cTilde, cs1, h, cHat, w1, w, z, y, rhoprime, s1, s2, t0, ...A);
                // `externalMu` hands ownership of `mu` to the caller,
                // so only wipe the internally derived digest form here;
                // zeroizing caller memory would break the caller's own reuse / verify path.
                if (!externalMu)
                    cleanBytes(mu);
                return res;
            }
            // @ts-ignore
            throw new Error('Unreachable code path reached, report this error');
        },
        verify: (sig, msg, publicKey, opts = {}) => {
            validateInternalOpts(opts);
            const { externalMu = false } = opts;
            // ML-DSA.Verify(pk, M, σ): Verifes a signature σ for a message M.
            const [rho, t1] = publicCoder.decode(publicKey); // (ρ, t1) ← pkDecode(pk)
            const tr = shake256(publicKey, { dkLen: TR_BYTES }); // 6: tr ← H(BytesToBits(pk), 512)
            if (sig.length !== sigCoder.bytesLen)
                return false; // return false instead of exception
            // (c˜, z, h) ← sigDecode(σ)
            // ▷ Signer’s commitment hash c ˜, response z and hint
            const [cTilde, z, h] = sigCoder.decode(sig);
            if (h === false)
                return false; // if h = ⊥ then return false
            for (let i = 0; i < L; i++)
                if (polyChknorm(z[i], GAMMA1 - BETA))
                    return false;
            const mu = externalMu
                ? msg
                : // 7: µ ← H(tr||M, 512)
                    shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest();
            // Compute verifer’s challenge from c˜
            const c = crystals.NTT.encode(SampleInBall(cTilde)); // c ← SampleInBall(c˜1)
            const zNtt = z.map((i) => i.slice()); // zNtt = NTT(z)
            for (let i = 0; i < L; i++)
                crystals.NTT.encode(zNtt[i]);
            const wTick1 = [];
            const xof = XOF128(rho);
            for (let i = 0; i < K; i++) {
                const ct12d = MultiplyNTTs(crystals.NTT.encode(polyShiftl(t1[i])), c); //c * t1 * (2**d)
                const Az = newPoly(N); // // A * z
                for (let j = 0; j < L; j++) {
                    const aij = RejNTTPoly(xof.get(j, i)); // A[i][j] inplace
                    polyAdd(Az, MultiplyNTTs(aij, zNtt[j]));
                }
                // wApprox = A*z - c*t1 * (2**d)
                const wApprox = crystals.NTT.decode(polySub(Az, ct12d));
                // Reconstruction of signer’s commitment
                wTick1.push(polyUseHint(wApprox, h[i])); // w ′ ← UseHint(h, w'approx )
            }
            xof.clean();
            // c˜′← H (µ||w1Encode(w′1), 2λ),  Hash it; this should match c˜
            const c2 = shake256
                .create({ dkLen: C_TILDE_BYTES })
                .update(mu)
                .update(W1Vec.encode(wTick1))
                .digest();
            // Additional checks in FIPS-204:
            // [[ ||z||∞ < γ1 − β ]] and [[c ˜ = c˜′]] and [[number of 1’s in h is ≤ ω]]
            for (const t of h) {
                const sum = t.reduce((acc, i) => acc + i, 0);
                if (!(sum <= OMEGA))
                    return false;
            }
            for (const t of z)
                if (polyChknorm(t, GAMMA1 - BETA))
                    return false;
            return equalBytes(cTilde, c2);
        },
    });
    return Object.freeze({
        info: Object.freeze({ type: 'ml-dsa' }),
        internal,
        securityLevel: securityLevel,
        keygen: internal.keygen,
        lengths: internal.lengths,
        getPublicKey: internal.getPublicKey,
        sign: (msg, secretKey, opts = {}) => {
            validateSigOpts(opts);
            const M = getMessage(msg, opts.context);
            const res = internal.sign(M, secretKey, opts);
            cleanBytes(M);
            return res;
        },
        verify: (sig, msg, publicKey, opts = {}) => {
            validateVerOpts(opts);
            return internal.verify(sig, getMessage(msg, opts.context), publicKey);
        },
        prehash: (hash) => {
            checkHash(hash, securityLevel);
            return Object.freeze({
                info: Object.freeze({ type: 'hashml-dsa' }),
                securityLevel: securityLevel,
                lengths: internal.lengths,
                keygen: internal.keygen,
                getPublicKey: internal.getPublicKey,
                sign: (msg, secretKey, opts = {}) => {
                    validateSigOpts(opts);
                    const M = getMessagePrehash(hash, msg, opts.context);
                    const res = internal.sign(M, secretKey, opts);
                    cleanBytes(M);
                    return res;
                },
                verify: (sig, msg, publicKey, opts = {}) => {
                    validateVerOpts(opts);
                    return internal.verify(sig, getMessagePrehash(hash, msg, opts.context), publicKey);
                },
            });
        },
    });
}
/** ML-DSA-44 for 128-bit security level. Not recommended after 2030, as per ASD. */
const ml_dsa44 = /* @__PURE__ */ (() => getDilithium({
    ...PARAMS[2],
    CRH_BYTES: 64,
    TR_BYTES: 64,
    C_TILDE_BYTES: 32,
    XOF128,
    XOF256,
    securityLevel: 128,
}))();

const TOOL_ID = 'art-424-witness-cosignature-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_witness_cosignatures',
  mandate_type: 'cryptographic_mandate', gpu: false,
};

// SPEC.md §20.2 — verifies a C2SP tlog-checkpoint + witness-cosignature note (k-of-n
// independent witness cosignatures over a batch anchor's Merkle root) against a caller-
// supplied pinned witness key set. VERIFY-SIDE ONLY: this tool never operates, mirrors,
// or serves a log — it consumes a checkpoint note text the caller already has (e.g. from
// a c2sp.org/tlog-proof bundle) and performs zero network fetches. Two witness signature
// suites: Ed25519 cosignature/v1 (the C2SP-shipped suite) and ML-DSA-44 (the suite our own
// §20.2 text names alongside it, per the §PQC-1 reserved-extension discipline — no
// C2SP-assigned type byte exists yet for ML-DSA in the note-signature registry, so the
// 0xf0 type byte used below is a PROVISIONAL, locally-declared id for this verifier's own
// key-id derivation only, not an external standard).
//
// COPY FENCE (row requirement): a verdict here states ONLY that ≥k pinned witnesses signed
// THIS root. It says nothing about whether the log itself is honest or complete, or whether
// the pinned witness keys truly belong to the parties they claim to be — both are trust
// decisions made before this tool runs, not by it.

const ED25519_NOTE_ALG = 0x01;      // Go sumdb note package's assigned Ed25519 algorithm byte
const MLDSA44_NOTE_ALG = 0xf0;      // provisional local id — see header note above

function _str(v) { return typeof v === 'string' ? v : ''; }
function _int(v) { return Number.isInteger(v) ? v : null; }
function _arr(v) { return Array.isArray(v) ? v : []; }

function b64decode(s) {
  const bin = atob(String(s || '').trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function readUint64BE(bytes) {
  let v = 0n;
  for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(bytes[i]);
  return v; // BigInt — timestamps stay exact past 2^53
}

async function sha256(bytes) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(d);
}

// Parses a C2SP tlog-checkpoint signed note: "<origin>\n<size>\n<base64 root>\n" (+ optional
// extension lines), a blank line, then one "— <name> <base64 blob>" line per cosignature.
function parseNote(text) {
  const raw = _str(text);
  const sep = raw.indexOf('\n\n');
  if (sep < 0) return { error: 'note has no header/signature separator (blank line)' };
  const header = raw.slice(0, sep);
  const sigBlock = raw.slice(sep + 2);
  const headerLines = header.split('\n').filter(l => l.length > 0);
  if (headerLines.length < 3) return { error: 'note header needs origin, size, and root lines' };
  const [origin, sizeStr, rootB64, ...extensionLines] = headerLines;
  const size = Number(sizeStr);
  if (!Number.isInteger(size) || size < 0) return { error: 'note size line is not a non-negative integer' };
  let rootBytes;
  try { rootBytes = b64decode(rootB64); } catch { return { error: 'note root line is not valid base64' }; }
  const noteText = header + '\n';
  const sigLines = sigBlock.split('\n')
    .filter(l => l.startsWith('— ') || l.startsWith('- '))
    .map(l => {
      const body = l.startsWith('— ') ? l.slice(2) : l.slice(2);
      const spaceAt = body.indexOf(' ');
      if (spaceAt < 0) return null;
      return { name: body.slice(0, spaceAt), blob_b64: body.slice(spaceAt + 1).trim() };
    })
    .filter(Boolean);
  return { origin, size, rootHex: toHex(rootBytes), extensionLines, noteText, sigLines };
}

async function witnessKeyId(name, algNoteByte, rawPubKey) {
  const msg = new Uint8Array([...new TextEncoder().encode(name + '\n'), algNoteByte, ...rawPubKey]);
  const digest = await sha256(msg);
  return digest.slice(0, 4);
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function b64uEncodeRaw(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// JWK import (not 'raw') — the ONLY key format the chaingraph/vm QuickJS harness's
// deterministic WebCrypto bridge marshals through (see kernel-vm.mjs's `__ocgVerify` host
// function, which re-imports as 'jwk' unconditionally). Using 'raw' here would verify
// correctly on the real Worker but silently diverge inside the VM (§24 VM<->worker parity).
async function verifyEd25519(sig, msg, rawPubKey) {
  try {
    const jwk = { kty: 'OKP', crv: 'Ed25519', x: b64uEncodeRaw(rawPubKey) };
    const key = await globalThis.crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
    return await globalThis.crypto.subtle.verify('Ed25519', key, sig, msg);
  } catch { return false; }
}
function verifyMldsa44(sig, msg, rawPubKey) {
  try { return ml_dsa44.verify(sig, msg, rawPubKey); } catch { return false; }
}

async function verifyOneWitness(witnessKey, sigLine) {
  const algorithm = _str(witnessKey.algorithm).toLowerCase();
  const algNoteByte = algorithm === 'ml-dsa-44' ? MLDSA44_NOTE_ALG : algorithm === 'ed25519' ? ED25519_NOTE_ALG : null;
  if (algNoteByte === null) return { name: witnessKey.name, algorithm, error: 'unsupported algorithm (expected ed25519 or ml-dsa-44)' };
  let rawPubKey;
  try { rawPubKey = b64decode(witnessKey.public_key_b64); } catch { return { name: witnessKey.name, algorithm, error: 'public_key_b64 is not valid base64' }; }
  if (!sigLine) return { name: witnessKey.name, algorithm, present: false, valid: false, keyid_match: false };

  let blob;
  try { blob = b64decode(sigLine.blob_b64); } catch { return { name: witnessKey.name, algorithm, present: true, valid: false, keyid_match: false, error: 'signature blob is not valid base64' }; }
  if (blob.length < 13) return { name: witnessKey.name, algorithm, present: true, valid: false, keyid_match: false, error: 'cosignature/v1 blob too short (need keyid[4] + timestamp[8] + signature)' };

  const keyId = blob.slice(0, 4);
  const timestampBytes = blob.slice(4, 12);
  const sig = blob.slice(12);
  const expectedKeyId = await witnessKeyId(witnessKey.name, algNoteByte, rawPubKey);
  const keyid_match = bytesEqual(keyId, expectedKeyId);
  const timestamp = readUint64BE(timestampBytes).toString();

  return { keyId, timestamp, sig, algNoteByte, rawPubKey, keyid_match,
    name: witnessKey.name, algorithm, present: true };
}

// ── Log consistency-proof verification (SPEC.md §20.2 extension, AV-CONSISTENCY-1) ──
// Given two checkpoints a caller already observed (old + new, e.g. fetched at different
// times from the same log), verifies the log did NOT rewrite history between them — a
// proper RFC 6962 §2.1.2 consistency proof, not a re-check of either checkpoint's own
// witness cosignatures or single-entry inclusion (that is WITNESS-VERIFY-1's / SPEC.md
// §20.1's job; this mode is the complementary "did the log fork/equivocate" check).
// Hash scheme matches RFC 6962: leaf hash = SHA-256(0x00 || data) (unused here — this
// mode never sees leaf data, only checkpoint roots), interior node hash =
// SHA-256(0x01 || left || right). Algorithm below is the standard iterative consistency-
// proof verifier (RFC 6962bis reference form, as shipped by Certificate Transparency
// implementations e.g. Trillian's LogVerifier.VerifyConsistencyProof) — hand-rolled here,
// not imported, per the site repo's zero-dependency rule.
async function hashChildren(left, right) {
  const buf = new Uint8Array(1 + left.length + right.length);
  buf[0] = 0x01;
  buf.set(left, 1);
  buf.set(right, 1 + left.length);
  return sha256(buf);
}

async function verifyConsistencyProof(proof, snapshot1, snapshot2, root1, root2) {
  if (snapshot1 === snapshot2) {
    if (proof.length !== 0) return { ok: false, reason: 'equal-size checkpoints must carry an empty consistency proof' };
    if (!bytesEqual(root1, root2)) return { ok: false, reason: 'equal-size checkpoints have different roots' };
    return { ok: true };
  }
  if (snapshot1 === 0) {
    if (proof.length !== 0) return { ok: false, reason: 'a consistency proof from an empty log must be empty' };
    return { ok: true };
  }
  let node = BigInt(snapshot1 - 1);
  let lastNode = BigInt(snapshot2 - 1);
  while (node % 2n === 1n) { node /= 2n; lastNode /= 2n; }

  let idx = 0;
  if (proof.length === 0) return { ok: false, reason: 'consistency proof is empty' };
  let newHash, oldHash;
  if (node > 0n) { newHash = proof[idx++]; oldHash = newHash; }
  else { newHash = root1; oldHash = root1; }

  while (node > 0n) {
    if (node % 2n === 1n) {
      if (idx >= proof.length) return { ok: false, reason: 'consistency proof is too short' };
      const h = proof[idx++];
      oldHash = await hashChildren(h, oldHash);
      newHash = await hashChildren(h, newHash);
    } else if (node < lastNode) {
      if (idx >= proof.length) return { ok: false, reason: 'consistency proof is too short' };
      const h = proof[idx++];
      newHash = await hashChildren(newHash, h);
    }
    node /= 2n; lastNode /= 2n;
  }

  if (!bytesEqual(oldHash, root1)) {
    return { ok: false, reason: 'proof does not reconstruct the old checkpoint root (the old tree was not a prefix of the new tree)' };
  }

  while (lastNode > 0n) {
    if (idx >= proof.length) return { ok: false, reason: 'consistency proof is too short' };
    const h = proof[idx++];
    newHash = await hashChildren(newHash, h);
    lastNode /= 2n;
  }

  if (!bytesEqual(newHash, root2)) {
    return { ok: false, reason: 'proof does not reconstruct the new checkpoint root' };
  }
  if (idx !== proof.length) return { ok: false, reason: 'consistency proof has unused trailing elements' };
  return { ok: true };
}

const CONSISTENCY_NOT_PROVEN = [
  { item: 'Log honesty before the old checkpoint', detail: 'A consistency proof shows the new tree is an append-only extension of the old tree. It says nothing about whether entries older than the old checkpoint were ever honestly logged.' },
  { item: 'Authenticity of either checkpoint', detail: 'This mode assumes both checkpoint notes are ones you already trust (e.g. each independently verified via its own witness cosignatures — see this tool\'s cosignature mode). It does not re-verify signatures over either checkpoint here.' },
  { item: 'Inclusion of any specific artifact leaf', detail: 'This mode verifies only that the new tree extends the old tree without rewriting it. It does not verify a Merkle inclusion path for any individual leaf (see SPEC.md §20.1 for that check).' },
];

function computeConsistency(pp) {
  const checks = [];
  const old_note = _str(pp.old_checkpoint_note);
  const new_note = _str(pp.new_checkpoint_note);
  const log_origin = _str(pp.log_origin).trim();
  const consistency_proof = _arr(pp.consistency_proof);

  const oldParsed = parseNote(old_note);
  const newParsed = parseNote(new_note);
  checks.push({ check: 'old_checkpoint_parses', pass: !oldParsed.error, detail: oldParsed.error || 'ok' });
  checks.push({ check: 'new_checkpoint_parses', pass: !newParsed.error, detail: newParsed.error || 'ok' });

  let proofBytes = [];
  let proofDecodeError = null;
  for (const p of consistency_proof) {
    try { proofBytes.push(b64decode(p)); } catch { proofDecodeError = 'consistency_proof contains a non-base64 entry'; break; }
  }
  checks.push({ check: 'consistency_proof_decodes', pass: !proofDecodeError, detail: proofDecodeError || (proofBytes.length + ' proof node(s)') });

  const structural_error = oldParsed.error || newParsed.error || proofDecodeError || null;
  const preconditionsOk = checks.every(c => c.pass);

  if (!preconditionsOk) {
    return {
      output_payload: {
        mode: 'consistency_proof',
        old_origin: oldParsed.origin ?? null, old_size: oldParsed.size ?? null, old_root_hash: oldParsed.rootHex ?? null,
        new_origin: newParsed.origin ?? null, new_size: newParsed.size ?? null, new_root_hash: newParsed.rootHex ?? null,
        origin_match: false, size_order_valid: false, consistency_verified: false, consistency_failure_reason: null,
        consistency_proof_result: 'FAIL', structural_error: structural_error || 'input validation failed',
        not_proven: CONSISTENCY_NOT_PROVEN,
      },
      compliance_flags: ['LOG_CONSISTENCY_INPUT_INVALID', 'ZERO_LOG_OPERATION_VERIFY_SIDE_ONLY'],
      checks,
    };
  }

  return { __async: true, mode: 'consistency_proof', oldParsed, newParsed, proofBytes, log_origin, checks };
}

async function computeConsistencyAsync(sync) {
  const { oldParsed, newParsed, proofBytes, log_origin, checks } = sync;

  const origin_match = oldParsed.origin === newParsed.origin && (!log_origin || oldParsed.origin === log_origin);
  const size_order_valid = newParsed.size >= oldParsed.size;

  let consistency_verified = false, consistency_failure_reason = null;
  if (size_order_valid) {
    const oldRootBytes = hexToBytes(oldParsed.rootHex);
    const newRootBytes = hexToBytes(newParsed.rootHex);
    const result = await verifyConsistencyProof(proofBytes, oldParsed.size, newParsed.size, oldRootBytes, newRootBytes);
    consistency_verified = result.ok;
    consistency_failure_reason = result.ok ? null : result.reason;
  } else {
    consistency_failure_reason = 'new checkpoint size must be >= old checkpoint size';
  }

  const pass = origin_match && size_order_valid && consistency_verified;

  checks.push({ check: 'origin_matches', pass: origin_match,
    detail: origin_match ? 'ok' : 'old and new checkpoint origins differ (or do not match the expected log_origin)' });
  checks.push({ check: 'size_order_valid', pass: size_order_valid,
    detail: size_order_valid ? 'ok' : 'new checkpoint size must be >= old checkpoint size' });
  checks.push({ check: 'consistency_proof_verified', pass: consistency_verified,
    detail: consistency_verified ? 'ok' : (consistency_failure_reason || 'consistency proof failed') });

  const output_payload = {
    mode: 'consistency_proof',
    old_origin: oldParsed.origin, old_size: oldParsed.size, old_root_hash: oldParsed.rootHex,
    new_origin: newParsed.origin, new_size: newParsed.size, new_root_hash: newParsed.rootHex,
    origin_match, size_order_valid, consistency_verified, consistency_failure_reason,
    consistency_proof_result: pass ? 'PASS' : 'FAIL', structural_error: null,
    not_proven: CONSISTENCY_NOT_PROVEN,
  };

  const compliance_flags = ['C2SP_TLOG_CONSISTENCY_PROOF', 'ZERO_LOG_OPERATION_VERIFY_SIDE_ONLY'];
  compliance_flags.push(pass ? 'LOG_CONSISTENCY_VERIFIED' : 'LOG_CONSISTENCY_FAILED');

  return { output_payload, compliance_flags, checks };
}

function computeCosignature(pp) {
  pp = pp || {};
  const checks = [];

  const anchored_hash_raw = _str(pp.anchored_hash).trim();
  const anchored_hash = anchored_hash_raw.replace(/^sha256:/, '').toLowerCase();
  const log_origin = _str(pp.log_origin).trim();
  const checkpoint_note = _str(pp.checkpoint_note);
  const witness_keys = _arr(pp.witness_keys);
  const threshold = _int(pp.threshold) ?? 1;

  checks.push({ check: 'anchored_hash_present', pass: /^[0-9a-f]{64}$/.test(anchored_hash),
    detail: /^[0-9a-f]{64}$/.test(anchored_hash) ? 'ok' : 'anchored_hash must be a 64-hex-char SHA-256 digest (bare or sha256:-prefixed)' });
  checks.push({ check: 'witness_keys_present', pass: witness_keys.length > 0,
    detail: witness_keys.length > 0 ? witness_keys.length + ' pinned witness key(s)' : 'witness_keys must name at least one pinned key' });
  checks.push({ check: 'threshold_valid', pass: threshold >= 1 && threshold <= witness_keys.length,
    detail: (threshold >= 1 && threshold <= witness_keys.length) ? 'ok' : 'threshold must be between 1 and the number of pinned witness_keys' });

  const parsed = parseNote(checkpoint_note);
  const structural_error = parsed.error || null;
  checks.push({ check: 'checkpoint_note_parses', pass: !structural_error, detail: structural_error || 'ok' });

  const preconditionsOk = checks.every(c => c.pass);

  const not_proven = [
    { item: 'Log honesty or completeness', detail: 'A witness cosignature closes anchor equivocation (one root shown to two verifiers) but says nothing about whether the log operator omitted entries or is otherwise dishonest.' },
    { item: 'Witness key ownership', detail: 'This tool verifies signatures against the pinned public keys supplied by the caller. It does not establish that those keys belong to the parties they claim to be — that trust decision is made before pinning, not by this verification.' },
    { item: 'Inclusion of any specific artifact leaf', detail: 'This tool verifies the checkpoint root and its witness cosignatures only. It does not recompute or verify a Merkle inclusion path for any individual leaf (see SPEC.md §20.1 for that check).' },
  ];

  if (!preconditionsOk) {
    return {
      output_payload: {
        origin: parsed.origin ?? null, note_size: parsed.size ?? null, note_root_hash: parsed.rootHex ?? null,
        anchored_hash_match: false, origin_match: false, threshold, valid_witness_count: 0,
        cosignatures: [], witness_verification_result: 'FAIL', structural_error: structural_error || 'input validation failed',
        not_proven,
      },
      compliance_flags: ['WITNESS_COSIGNATURE_INPUT_INVALID', 'ZERO_LOG_OPERATION_VERIFY_SIDE_ONLY'],
      checks,
    };
  }

  return { __async: true, mode: 'cosignature', parsed, anchored_hash, log_origin, witness_keys, threshold, checks, not_proven };
}

// Two verification modes share this tool: default 'cosignature' (SPEC.md §20.2 witness
// cosignatures) and 'consistency_proof' (AV-CONSISTENCY-1, above). compute() dispatches on
// pp.mode and stays synchronous for callers that only want the precondition checks.
export function compute(pp) {
  pp = pp || {};
  return _str(pp.mode) === 'consistency_proof' ? computeConsistency(pp) : computeCosignature(pp);
}

// Signature verification is async (WebCrypto / noble ML-DSA), so buildArtifact drives the
// async continuation of compute() above rather than forcing compute() itself to be async —
// keeps compute() usable synchronously by callers that only want the precondition checks.
async function computeAsync(pp) {
  const sync = compute(pp);
  if (!sync.__async) return sync;
  if (sync.mode === 'consistency_proof') return computeConsistencyAsync(sync);
  const { parsed, anchored_hash, log_origin, witness_keys, threshold, checks, not_proven } = sync;

  const anchored_hash_match = parsed.rootHex === anchored_hash;
  const origin_match = !log_origin || parsed.origin === log_origin;

  const byName = new Map(parsed.sigLines.map(l => [l.name, l]));
  const resolved = [];
  for (const wk of witness_keys) {
    resolved.push(await verifyOneWitness(wk, byName.get(_str(wk.name))));
  }

  const cosignatures = [];
  let valid_witness_count = 0;
  const seenValidNames = new Set();
  for (const r of resolved) {
    if (r.error || !r.present) {
      cosignatures.push({ name: r.name, algorithm: r.algorithm, present: !!r.present, valid: false,
        keyid_match: !!r.keyid_match, error: r.error || 'no cosignature line matched this witness name' });
      continue;
    }
    let sig_valid = false;
    if (r.keyid_match) {
      const msg = new TextEncoder().encode('cosignature/v1\n' + r.timestamp + '\n' + parsed.noteText);
      sig_valid = r.algorithm === 'ml-dsa-44' ? verifyMldsa44(r.sig, msg, r.rawPubKey) : await verifyEd25519(r.sig, msg, r.rawPubKey);
    }
    if (sig_valid && !seenValidNames.has(r.name)) { valid_witness_count++; seenValidNames.add(r.name); }
    cosignatures.push({ name: r.name, algorithm: r.algorithm, present: true, keyid_match: r.keyid_match,
      timestamp: r.timestamp, valid: sig_valid });
  }

  const pass = anchored_hash_match && origin_match && valid_witness_count >= threshold;

  checks.push({ check: 'anchored_hash_matches_note_root', pass: anchored_hash_match,
    detail: anchored_hash_match ? 'ok' : 'note root does not match the batch anchor\'s anchored_hash' });
  checks.push({ check: 'origin_matches', pass: origin_match,
    detail: origin_match ? 'ok' : 'note origin does not match the expected log_origin' });
  checks.push({ check: 'threshold_met', pass: valid_witness_count >= threshold,
    detail: valid_witness_count + ' of ' + threshold + ' required valid witness cosignature(s)' });

  const output_payload = {
    origin: parsed.origin, note_size: parsed.size, note_root_hash: parsed.rootHex,
    anchored_hash_match, origin_match, threshold, valid_witness_count,
    cosignatures, witness_verification_result: pass ? 'PASS' : 'FAIL', structural_error: null,
    not_proven,
  };

  const compliance_flags = ['C2SP_TLOG_CHECKPOINT_FORMAT', 'ZERO_LOG_OPERATION_VERIFY_SIDE_ONLY'];
  compliance_flags.push(pass ? 'WITNESS_COSIGNATURE_VERIFIED' : 'WITNESS_COSIGNATURE_FAILED');

  return { output_payload, compliance_flags, checks };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await computeAsync(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
