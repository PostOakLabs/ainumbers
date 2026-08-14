import { executionHash } from './_hash.mjs';

// Vendored: @noble/hashes (utils.js, _u64.js, sha3.js -- keccak_256 only) v2.2.0 (MIT,
// (c) Paul Miller paulmillr.com). Source: https://github.com/paulmillr/noble-hashes,
// pinned to npm tag v2.2.0 -- same pin already vendored in
// chaingraph/kernels/_noble-secp256k1.bundle.mjs (ETHMATH-WAVE-BUILD-SPEC.md: reuse the
// existing vendored bundle, never vendor a second crypto lib for this wave). This kernel
// needs only keccak_256 (no ECDSA), so only the hashes-side utils/u64/sha3 sections are
// inlined here -- copied byte-identically from the corresponding lines of
// chaingraph/kernels/art-590-x402-eip712-digest-recomputer.kernel.mjs (itself byte-identical
// to _noble-secp256k1.bundle.mjs for these sections), verbatim, not hand-edited. That copy
// already carries the one deliberate patch both x402 kernels apply: `utf8ToBytes` uses a
// validated pure-JS UTF-8 encoder instead of `new TextEncoder()`, which the zkVM guest does
// not reliably provide (ART595-ART590-UTF8-FIX-1-2026-08-13). Every other function here is
// unmodified vendored source. Inlined rather than imported per RIDER-KERNEL #6 / the art-476
// lesson: the chaingraph/vm QuickJS guest's ESM-strip only expects a kernel to import from
// ./_hash.mjs, and compute() must stay fully synchronous.
// License: MIT, (c) Paul Miller paulmillr.com. Full text:
// https://github.com/paulmillr/noble-hashes/blob/main/LICENSE
// ── keccak_256, vendored inline (see header) ────────────────────────────────────────────
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
    // reliably provide TextEncoder (ART595-GUEST-ERROR-1-2026-08-13.md; ART595-ART590-UTF8-FIX-1
    // -2026-08-13.md's own harness probe additionally showed art-587's non-empty-input
    // TextEncoder calls fail identically once actually reached, so a lazy-init-only fix here
    // would very likely reproduce the same crash one level down -- see this kernel's own
    // ART595-ART590-UTF8-FIX-1 note below on why this file gets BOTH fixes, not lazy-init
    // alone). Pure-JS UTF-8 encoder, validated byte-identical to TextEncoder.encode across
    // ASCII, 2/3/4-byte sequences, surrogate pairs, and lone surrogates (which TextEncoder
    // replaces with U+FFFD, reproduced here) -- 22 named cases + 20,000 randomized fuzz cases
    // against Node's native TextEncoder, zero mismatches.
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
 * const key = randomBytes_(16);
 * ```
 */
function randomBytes_(bytesLength = 32) {
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


// art-613 -- ERC-4337 UserOperation Math: pure decision kernel.
// ETHMATH-WAVE-BUILD-SPEC.md section 3 -- three legs, one kernel, honest boundaries:
//   1. UserOp hash recompute: keccak256(abi.encode(keccak256(packedUserOp), entryPoint, chainId)),
//      over the v0.6 UserOperation layout or the v0.7 PackedUserOperation layout.
//   2. Prefund / gas arithmetic over CALLER-SUPPLIED limits -- pure uint256 math, no chain read.
//   3. Paymaster-spend reconciliation over DECLARED fee inputs only.
//
// keccak256 comes ONLY from the vendored bundle above (RIDER-KERNEL #6, spec: reuse the existing
// vendored bundle). The ABI encoding scheme (word-packing of the typed fields) is public-spec
// arithmetic implemented directly here -- the same "hashing primitive vendored, encoding scheme
// direct" split art-590 already established for EIP-712 over the same vendored keccak_256.
//
// ⛔⛔ ZERO NETWORK, ZERO CHAIN READ. Every field is caller-declared and echoed, never resolved.
// This kernel recomputes and reconciles; it makes no claim that any operation was settled,
// accepted, included, or final (Corda-tripwire vocabulary ban, spec preamble).
//
// ⛔⛔ L1 DATA / BLOB FEES ARE NEVER DERIVED. On rollups the total charge includes an L1 data-fee
// component that, post-EIP-4844, depends on the inclusion-time L1 basefee and blob basefee. Those
// are not offline-derivable, so this kernel never computes them: an L1 data fee participates in
// reconciliation ONLY when the caller declares it, and its absence is reported as an explicit
// named gap rather than silently absorbed into a residual. The same boundary applies to
// block.basefee, which the effective-gas-price formula needs: absent a declared value the price is
// reported as null with the reason, never guessed. Both facts are stated in output copy
// (`never_fetched`) on every single run, including INDETERMINATE ones.
//
// ENTRYPOINT VERSION IS A DECLARED PARAMETER, never inferred. v0.6 and v0.7 differ in the struct
// that gets hashed AND in the prefund formula, so guessing would silently produce a wrong hash:
//   v0.6 UserOperation      -- 10 abi.encode words; prefund multiplies verificationGasLimit by 3
//                              when a paymaster is present (postOp may be called twice).
//   v0.7 PackedUserOperation -- 8 abi.encode words; verificationGasLimit/callGasLimit pack into
//                              accountGasLimits, maxPriorityFeePerGas/maxFeePerGas pack into
//                              gasFees, and the prefund adds the paymaster's own two gas limits
//                              (parsed out of paymasterAndData) instead of using a multiplier.
// Both are supported. An unrecognised version is INDETERMINATE, never a fallback to either one.
//
// Self-checks run inside compute() (art-607's lazy-init pattern, ART607-EAGER-INIT-FIX-1
// -- never at module top level, which would call utf8ToBytes before compute() and reproduce
// art-607's eager-top-level guest failure). They anchor the vendored primitive on two externally
// published Keccak-256 constants; a mismatch throws rather than silently emitting a wrong hash.

// Widely published canonical EntryPoint deployment addresses, held ONLY to flag a declared address
// that does not match the declared version. ⛔ Advisory: the caller's entryPoint value is what is
// hashed, always -- this table never substitutes, defaults, or overrides it.
const CANONICAL_ENTRYPOINT = {
  '0.6': '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789',
  '0.7': '0x0000000071727de22e5e9d8baf0edac6f37da032',
};

// v0.7 paymasterAndData layout (ERC-4337 v0.7 UserOperationLib offsets):
//   [0:20] paymaster address | [20:36] paymasterVerificationGasLimit (uint128)
//   [36:52] paymasterPostOpGasLimit (uint128) | [52:] paymasterData
const PM_VALIDATION_GAS_OFFSET = 20;
const PM_POSTOP_GAS_OFFSET = 36;
const PM_DATA_OFFSET = 52;

const KECCAK_EMPTY_EXPECT = 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
const KECCAK_ABC_EXPECT = '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45';

// Rebuilt (not memoized) on every compute() call, matching art-590's/art-607's pattern -- two
// keccak_256 calls over short fixed inputs. Throws if either published constant fails to
// reproduce, which would mean the vendored primitive is not the Keccak-256 it claims to be.
function _verifyKeccakPrimitive() {
  const empty = bytesToHex_(keccak_256(new Uint8Array(0)));
  if (empty !== KECCAK_EMPTY_EXPECT) {
    throw new Error('art-613 keccak_256 self-check FAILED (empty input): got ' + empty + ' expected ' + KECCAK_EMPTY_EXPECT);
  }
  const abc = bytesToHex_(keccak_256(utf8ToBytes('abc')));
  if (abc !== KECCAK_ABC_EXPECT) {
    throw new Error('art-613 keccak_256 self-check FAILED (abc vector): got ' + abc + ' expected ' + KECCAK_ABC_EXPECT);
  }
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

// Arbitrary-length byte string (initCode / callData / paymasterAndData). Empty is legal and
// distinct from missing: '0x' means "no initCode", which hashes to the empty-bytes keccak.
function _normalizeByteString(v) {
  if (typeof v !== 'string') return null;
  const s = _stripHexPrefix(v.trim());
  if (s === '') return '0x';
  if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2 !== 0) return null;
  return '0x' + s.toLowerCase();
}

// Accepts a decimal string, a 0x-hex string, or a safe-integer number; never throws.
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

function _bytesOf(byteStringHex) {
  const s = _stripHexPrefix(byteStringHex);
  return s === '' ? new Uint8Array(0) : hexToBytes_(s);
}

// Normalizes the declared EntryPoint version to '0.6' or '0.7'. ⛔ Never infers a default:
// an unrecognised value returns null and the run is INDETERMINATE.
function _normalizeEntryPointVersion(v) {
  if (typeof v === 'number') {
    if (v === 0.6) return '0.6';
    if (v === 0.7) return '0.7';
    return null;
  }
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().replace(/^v/, '');
  if (s === '0.6' || s === '0.6.0') return '0.6';
  if (s === '0.7' || s === '0.7.0') return '0.7';
  return null;
}

// Packs two uint128 values into one 32-byte word: `high` in the top 16 bytes, `low` in the
// bottom 16. v0.7 uses this for accountGasLimits (verificationGasLimit high, callGasLimit low)
// and gasFees (maxPriorityFeePerGas high, maxFeePerGas low).
function _packTwoUint128(high, low) {
  return '0x' + bytesToHex_(_uint256Word((high << 128n) | low));
}

const UINT128_MAX = (1n << 128n) - 1n;

const SCOPE_NOTE = 'Recomputes the ERC-4337 userOpHash from a caller-supplied UserOperation under a DECLARED EntryPoint version (v0.6 or v0.7), computes the required prefund from caller-supplied gas limits, and reconciles a declared paymaster charge against a charge recomputed from declared inputs. Zero network calls and zero chain reads: every field is caller-declared and echoed back, never independently resolved. L1 data and blob fees are NEVER derived -- post-EIP-4844 they depend on the inclusion-time L1 basefee, which is not offline-derivable, so they participate only when the caller declares them and their absence is reported as a named gap. block.basefee is likewise never fetched: absent a declared value the effective gas price is reported as null with the reason. This node recomputes and reconciles; it makes no claim that any operation was settled, accepted, included, or final, and no claim about signature validity (the signature field is excluded from the hashed struct by the ERC-4337 spec itself).';

const TOOL_ID = 'art-613-erc4337-userop-math';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_erc4337_userop_math',
  mandate_type: 'compliance_control',
  gpu: false,
};

const NEVER_FETCHED = [
  'L1 data fee / blob fee: never derived. Post-EIP-4844 it depends on the inclusion-time L1 basefee and blob basefee, neither of which is offline-derivable. Supply declaredL1DataFeeWei to include it in reconciliation.',
  'block.basefee: never fetched. Supply declaredBaseFeePerGas to derive an effective gas price when maxFeePerGas and maxPriorityFeePerGas differ.',
  'EntryPoint contract state: never read. Deposits, stakes, nonce-sequence validity, and prior spend are not consulted.',
  'Chain state of any kind: no RPC, no indexer, no receipt lookup. actualGasUsed and actualGasCost are reconciled only as caller-declared values.',
];

/**
 * compute(pp) -- pure recompute_erc4337_userop_math kernel.
 * pp: {
 *   entryPointVersion, entryPoint, chainId,                              -- mandatory, never guessed
 *   sender, nonce, initCode, callData, paymasterAndData,                 -- UserOp fields
 *   callGasLimit, verificationGasLimit, preVerificationGas,              -- caller-supplied limits
 *   maxFeePerGas, maxPriorityFeePerGas,
 *   declaredBaseFeePerGas?,                                              -- optional, never fetched
 *   declaredActualGasUsed?, declaredActualGasCostWei?,                   -- optional reconciliation
 *   declaredL1DataFeeWei?, reconciliationToleranceWei?,
 * }
 */
export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  _verifyKeccakPrimitive();
  const reasons = [];

  const version = _normalizeEntryPointVersion(pp.entryPointVersion);
  if (version === null) {
    reasons.push('entryPointVersion is required and must be one of "0.6" or "0.7" (declared, never inferred -- the two versions hash different structs and use different prefund formulas, so a guess silently produces a wrong userOpHash)');
  }

  const entryPoint = _normalizeAddress(pp.entryPoint);
  const chainId = _toUint256BigInt(pp.chainId);
  const sender = _normalizeAddress(pp.sender);
  const nonce = _toUint256BigInt(pp.nonce);
  const initCode = _normalizeByteString(pp.initCode);
  const callData = _normalizeByteString(pp.callData);
  const paymasterAndData = _normalizeByteString(pp.paymasterAndData);
  const callGasLimit = _toUint256BigInt(pp.callGasLimit);
  const verificationGasLimit = _toUint256BigInt(pp.verificationGasLimit);
  const preVerificationGas = _toUint256BigInt(pp.preVerificationGas);
  const maxFeePerGas = _toUint256BigInt(pp.maxFeePerGas);
  const maxPriorityFeePerGas = _toUint256BigInt(pp.maxPriorityFeePerGas);

  if (!entryPoint) reasons.push('entryPoint is required and must be a 20-byte hex address (it is hashed into the userOpHash, so it is never defaulted)');
  if (chainId === null) reasons.push('chainId is required and must be a non-negative uint256 (declared input, never a chain selector and never resolved)');
  if (!sender) reasons.push('sender is required and must be a 20-byte hex address');
  if (nonce === null) reasons.push('nonce is required and must be a non-negative uint256');
  if (initCode === null) reasons.push('initCode is required and must be an even-length hex byte string ("0x" for none)');
  if (callData === null) reasons.push('callData is required and must be an even-length hex byte string ("0x" for none)');
  if (paymasterAndData === null) reasons.push('paymasterAndData is required and must be an even-length hex byte string ("0x" for none)');
  if (callGasLimit === null) reasons.push('callGasLimit is required and must be a non-negative uint256');
  if (verificationGasLimit === null) reasons.push('verificationGasLimit is required and must be a non-negative uint256');
  if (preVerificationGas === null) reasons.push('preVerificationGas is required and must be a non-negative uint256');
  if (maxFeePerGas === null) reasons.push('maxFeePerGas is required and must be a non-negative uint256');
  if (maxPriorityFeePerGas === null) reasons.push('maxPriorityFeePerGas is required and must be a non-negative uint256');

  // v0.7 packs these into uint128 halves; a value that does not fit is a genuine input error,
  // not something to truncate silently.
  if (version === '0.7') {
    if (verificationGasLimit !== null && verificationGasLimit > UINT128_MAX) reasons.push('verificationGasLimit exceeds uint128 and cannot be packed into the v0.7 accountGasLimits word');
    if (callGasLimit !== null && callGasLimit > UINT128_MAX) reasons.push('callGasLimit exceeds uint128 and cannot be packed into the v0.7 accountGasLimits word');
    if (maxFeePerGas !== null && maxFeePerGas > UINT128_MAX) reasons.push('maxFeePerGas exceeds uint128 and cannot be packed into the v0.7 gasFees word');
    if (maxPriorityFeePerGas !== null && maxPriorityFeePerGas > UINT128_MAX) reasons.push('maxPriorityFeePerGas exceeds uint128 and cannot be packed into the v0.7 gasFees word');
  }

  // Optional declared inputs. Present-but-malformed is an error; absent is a named gap, never zero.
  const declaredBaseFeePerGas = pp.declaredBaseFeePerGas === undefined || pp.declaredBaseFeePerGas === null
    ? null : _toUint256BigInt(pp.declaredBaseFeePerGas);
  if (pp.declaredBaseFeePerGas !== undefined && pp.declaredBaseFeePerGas !== null && declaredBaseFeePerGas === null) {
    reasons.push('declaredBaseFeePerGas was supplied but is not a non-negative uint256');
  }
  const declaredActualGasUsed = pp.declaredActualGasUsed === undefined || pp.declaredActualGasUsed === null
    ? null : _toUint256BigInt(pp.declaredActualGasUsed);
  if (pp.declaredActualGasUsed !== undefined && pp.declaredActualGasUsed !== null && declaredActualGasUsed === null) {
    reasons.push('declaredActualGasUsed was supplied but is not a non-negative uint256');
  }
  const declaredActualGasCostWei = pp.declaredActualGasCostWei === undefined || pp.declaredActualGasCostWei === null
    ? null : _toUint256BigInt(pp.declaredActualGasCostWei);
  if (pp.declaredActualGasCostWei !== undefined && pp.declaredActualGasCostWei !== null && declaredActualGasCostWei === null) {
    reasons.push('declaredActualGasCostWei was supplied but is not a non-negative uint256');
  }
  const declaredL1DataFeeWei = pp.declaredL1DataFeeWei === undefined || pp.declaredL1DataFeeWei === null
    ? null : _toUint256BigInt(pp.declaredL1DataFeeWei);
  if (pp.declaredL1DataFeeWei !== undefined && pp.declaredL1DataFeeWei !== null && declaredL1DataFeeWei === null) {
    reasons.push('declaredL1DataFeeWei was supplied but is not a non-negative uint256');
  }
  const reconciliationToleranceWei = pp.reconciliationToleranceWei === undefined || pp.reconciliationToleranceWei === null
    ? 0n : _toUint256BigInt(pp.reconciliationToleranceWei);
  if (pp.reconciliationToleranceWei !== undefined && pp.reconciliationToleranceWei !== null && reconciliationToleranceWei === null) {
    reasons.push('reconciliationToleranceWei was supplied but is not a non-negative uint256');
  }

  const user_op_echo = {
    sender,
    nonce: nonce !== null ? nonce.toString() : null,
    init_code: initCode,
    call_data: callData,
    paymaster_and_data: paymasterAndData,
    call_gas_limit: callGasLimit !== null ? callGasLimit.toString() : null,
    verification_gas_limit: verificationGasLimit !== null ? verificationGasLimit.toString() : null,
    pre_verification_gas: preVerificationGas !== null ? preVerificationGas.toString() : null,
    max_fee_per_gas: maxFeePerGas !== null ? maxFeePerGas.toString() : null,
    max_priority_fee_per_gas: maxPriorityFeePerGas !== null ? maxPriorityFeePerGas.toString() : null,
  };
  const canonicalForVersion = version !== null ? CANONICAL_ENTRYPOINT[version] : null;
  const entry_point_echo = {
    declared_version: version,
    address: entryPoint,
    canonical_address_for_declared_version: canonicalForVersion,
    address_matches_canonical: (entryPoint !== null && canonicalForVersion !== null)
      ? (entryPoint === canonicalForVersion) : null,
  };

  if (reasons.length > 0) {
    return {
      output_payload: {
        verdict: 'INDETERMINATE',
        reasons,
        entry_point: entry_point_echo,
        chain_id: chainId !== null ? chainId.toString() : null,
        user_op: user_op_echo,
        packed_words: null,
        field_hashes: null,
        packed_user_op_hash: null,
        user_op_hash: null,
        gas_accounting: null,
        paymaster_reconciliation: null,
        never_fetched: NEVER_FETCHED,
        scope_note: SCOPE_NOTE,
      },
      compliance_flags: ['ERC4337_USEROP_INDETERMINATE', 'ERC4337_MALFORMED_INPUT'],
    };
  }

  // ── Leg 1: userOpHash recompute ───────────────────────────────────────────────────────
  // Both versions finish identically:
  //   userOpHash = keccak256(abi.encode(keccak256(packed), entryPoint, chainId))
  // They differ only in `packed`. Every abi.encode member below is a static 32-byte type
  // (address / uint256 / bytes32), so abi.encode is exactly the concatenation of the words --
  // no dynamic head/tail offsets are involved, which is why direct word-packing is faithful here.
  const initCodeHash = keccak_256(_bytesOf(initCode));
  const callDataHash = keccak_256(_bytesOf(callData));
  const paymasterAndDataHash = keccak_256(_bytesOf(paymasterAndData));

  let packedBytes;
  let packed_words;
  if (version === '0.6') {
    packedBytes = concatBytes_(
      _addressWord(sender),
      _uint256Word(nonce),
      initCodeHash,
      callDataHash,
      _uint256Word(callGasLimit),
      _uint256Word(verificationGasLimit),
      _uint256Word(preVerificationGas),
      _uint256Word(maxFeePerGas),
      _uint256Word(maxPriorityFeePerGas),
      paymasterAndDataHash,
    );
    packed_words = {
      layout: 'v0.6 UserOperation -- abi.encode(address sender, uint256 nonce, bytes32 keccak(initCode), bytes32 keccak(callData), uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes32 keccak(paymasterAndData))',
      word_count: 10,
      account_gas_limits: null,
      gas_fees: null,
    };
  } else {
    // v0.7 PackedUserOperation: the two packed words replace four separate uint256 fields.
    const accountGasLimits = _packTwoUint128(verificationGasLimit, callGasLimit);
    const gasFees = _packTwoUint128(maxPriorityFeePerGas, maxFeePerGas);
    packedBytes = concatBytes_(
      _addressWord(sender),
      _uint256Word(nonce),
      initCodeHash,
      callDataHash,
      hexToBytes_(_stripHexPrefix(accountGasLimits)),
      _uint256Word(preVerificationGas),
      hexToBytes_(_stripHexPrefix(gasFees)),
      paymasterAndDataHash,
    );
    packed_words = {
      layout: 'v0.7 PackedUserOperation -- abi.encode(address sender, uint256 nonce, bytes32 keccak(initCode), bytes32 keccak(callData), bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes32 keccak(paymasterAndData))',
      word_count: 8,
      account_gas_limits: accountGasLimits,
      gas_fees: gasFees,
    };
  }

  const packedUserOpHashBytes = keccak_256(packedBytes);
  const userOpHashBytes = keccak_256(concatBytes_(
    packedUserOpHashBytes,
    _addressWord(entryPoint),
    _uint256Word(chainId),
  ));

  // ── Leg 2: prefund / gas arithmetic over caller-supplied limits ────────────────────────
  const pmBytes = _bytesOf(paymasterAndData);
  const paymasterAddress = pmBytes.length >= 20 ? '0x' + bytesToHex_(pmBytes.slice(0, 20)) : null;
  const paymasterPresent = pmBytes.length > 0;

  let requiredGas;
  let paymasterVerificationGasLimit = null;
  let paymasterPostOpGasLimit = null;
  let paymasterMultiplierApplied = null;
  let paymasterFieldsNote = null;

  if (version === '0.6') {
    // v0.6 _getRequiredPrefund: verificationGasLimit is multiplied by 3 when a paymaster is
    // present, because that same limit also caps the postOp call, which the security model may
    // invoke twice.
    paymasterMultiplierApplied = paymasterPresent ? '3' : '1';
    const mul = paymasterPresent ? 3n : 1n;
    requiredGas = callGasLimit + verificationGasLimit * mul + preVerificationGas;
  } else {
    // v0.7 _getRequiredPrefund sums the paymaster's own two limits instead of multiplying.
    // They are packed inside paymasterAndData at fixed offsets; a paymasterAndData too short to
    // carry them is reported, never back-filled with zeros pretending to be declared values.
    if (paymasterPresent) {
      if (pmBytes.length >= PM_DATA_OFFSET) {
        paymasterVerificationGasLimit = BigInt('0x' + bytesToHex_(pmBytes.slice(PM_VALIDATION_GAS_OFFSET, PM_POSTOP_GAS_OFFSET)));
        paymasterPostOpGasLimit = BigInt('0x' + bytesToHex_(pmBytes.slice(PM_POSTOP_GAS_OFFSET, PM_DATA_OFFSET)));
      } else {
        paymasterFieldsNote = 'paymasterAndData is ' + pmBytes.length + ' bytes, shorter than the 52-byte v0.7 header that carries paymasterVerificationGasLimit and paymasterPostOpGasLimit. Those two limits are therefore not declared, and the required prefund below omits them -- it is a LOWER BOUND, not the EntryPoint figure.';
      }
    }
    requiredGas = verificationGasLimit + callGasLimit + preVerificationGas
      + (paymasterVerificationGasLimit ?? 0n) + (paymasterPostOpGasLimit ?? 0n);
  }
  const requiredPrefund = requiredGas * maxFeePerGas;

  // Effective gas price. min(maxFeePerGas, maxPriorityFeePerGas + block.basefee), with the
  // EntryPoint's own legacy shortcut: when the two fee caps are equal the basefee drops out of
  // the formula entirely, so the price IS derivable offline. Otherwise it requires a declared
  // basefee, and absent one the price is null with the reason -- never a guess.
  let effectiveGasPrice = null;
  let effectiveGasPriceBasis;
  if (maxFeePerGas === maxPriorityFeePerGas) {
    effectiveGasPrice = maxFeePerGas;
    effectiveGasPriceBasis = 'legacy_equal_fee_caps -- maxFeePerGas equals maxPriorityFeePerGas, so the EntryPoint returns maxFeePerGas directly and no basefee is involved';
  } else if (declaredBaseFeePerGas !== null) {
    const withTip = maxPriorityFeePerGas + declaredBaseFeePerGas;
    effectiveGasPrice = withTip < maxFeePerGas ? withTip : maxFeePerGas;
    effectiveGasPriceBasis = 'declared_base_fee -- min(maxFeePerGas, maxPriorityFeePerGas + declaredBaseFeePerGas), using the CALLER-DECLARED basefee, never a fetched one';
  } else {
    effectiveGasPriceBasis = 'requires_declared_base_fee -- the fee caps differ, so the price depends on block.basefee, which this kernel never fetches. Supply declaredBaseFeePerGas.';
  }

  const gas_accounting = {
    entry_point_version: version,
    required_gas: requiredGas.toString(),
    required_prefund_wei: requiredPrefund.toString(),
    prefund_formula: version === '0.6'
      ? 'v0.6: (callGasLimit + verificationGasLimit * paymasterMultiplier + preVerificationGas) * maxFeePerGas'
      : 'v0.7: (verificationGasLimit + callGasLimit + preVerificationGas + paymasterVerificationGasLimit + paymasterPostOpGasLimit) * maxFeePerGas',
    paymaster_present: paymasterPresent,
    paymaster_address: paymasterAddress,
    paymaster_multiplier_applied: paymasterMultiplierApplied,
    paymaster_verification_gas_limit: paymasterVerificationGasLimit !== null ? paymasterVerificationGasLimit.toString() : null,
    paymaster_post_op_gas_limit: paymasterPostOpGasLimit !== null ? paymasterPostOpGasLimit.toString() : null,
    paymaster_fields_note: paymasterFieldsNote,
    declared_base_fee_per_gas: declaredBaseFeePerGas !== null ? declaredBaseFeePerGas.toString() : null,
    effective_gas_price_wei: effectiveGasPrice !== null ? effectiveGasPrice.toString() : null,
    effective_gas_price_basis: effectiveGasPriceBasis,
  };

  // ── Leg 3: paymaster-spend reconciliation over DECLARED inputs only ────────────────────
  // Reconciles the caller's declared charge against a charge recomputed from the caller's own
  // declared gas usage and price. ⛔ Nothing here is fetched, and no missing component is ever
  // inferred: if a residual cannot be explained from declared inputs it is reported as a
  // residual, with the un-declared components named.
  const missingForReconciliation = [];
  if (declaredActualGasUsed === null) missingForReconciliation.push('declaredActualGasUsed');
  if (declaredActualGasCostWei === null) missingForReconciliation.push('declaredActualGasCostWei');
  if (effectiveGasPrice === null) missingForReconciliation.push('an effective gas price (supply declaredBaseFeePerGas)');

  let paymaster_reconciliation;
  if (missingForReconciliation.length > 0) {
    paymaster_reconciliation = {
      status: 'NOT_ATTEMPTED',
      missing_declared_inputs: missingForReconciliation,
      declared_actual_gas_used: declaredActualGasUsed !== null ? declaredActualGasUsed.toString() : null,
      declared_actual_gas_cost_wei: declaredActualGasCostWei !== null ? declaredActualGasCostWei.toString() : null,
      declared_l1_data_fee_wei: declaredL1DataFeeWei !== null ? declaredL1DataFeeWei.toString() : null,
      recomputed_execution_cost_wei: null,
      recomputed_total_charge_wei: null,
      residual_wei: null,
      tolerance_wei: reconciliationToleranceWei.toString(),
      notes: ['Reconciliation was not attempted because the inputs above were not declared. This kernel never substitutes a fetched or assumed value for a missing declared one.'],
    };
  } else {
    const recomputedExecutionCost = declaredActualGasUsed * effectiveGasPrice;
    const recomputedTotal = recomputedExecutionCost + (declaredL1DataFeeWei ?? 0n);
    const residual = declaredActualGasCostWei - recomputedTotal;
    const absResidual = residual < 0n ? -residual : residual;
    const reconciled = absResidual <= reconciliationToleranceWei;
    const notes = [];
    if (declaredL1DataFeeWei === null) {
      notes.push('No declaredL1DataFeeWei was supplied, so the recomputed total covers execution gas only. On rollups the charge commonly also includes an L1 data fee, which this kernel NEVER derives -- post-EIP-4844 it depends on the inclusion-time L1 basefee and blob basefee. A positive residual is consistent with an undeclared L1 data fee, and this kernel does not assert which.');
    }
    if (!reconciled) {
      notes.push('The declared charge and the charge recomputed from declared inputs differ by more than the declared tolerance. This is a reported difference, not a finding of error: an undeclared fee component, a different effective gas price at inclusion time, or a postOp refund would each produce it.');
    }
    paymaster_reconciliation = {
      status: reconciled ? 'RECONCILED' : 'RESIDUAL_UNEXPLAINED',
      missing_declared_inputs: [],
      declared_actual_gas_used: declaredActualGasUsed.toString(),
      declared_actual_gas_cost_wei: declaredActualGasCostWei.toString(),
      declared_l1_data_fee_wei: declaredL1DataFeeWei !== null ? declaredL1DataFeeWei.toString() : null,
      recomputed_execution_cost_wei: recomputedExecutionCost.toString(),
      recomputed_total_charge_wei: recomputedTotal.toString(),
      residual_wei: residual.toString(),
      tolerance_wei: reconciliationToleranceWei.toString(),
      notes,
    };
  }

  const output_payload = {
    verdict: 'USEROP_RECOMPUTED',
    reasons: [],
    entry_point: entry_point_echo,
    chain_id: chainId.toString(),
    user_op: user_op_echo,
    packed_words,
    field_hashes: {
      init_code_hash: '0x' + bytesToHex_(initCodeHash),
      call_data_hash: '0x' + bytesToHex_(callDataHash),
      paymaster_and_data_hash: '0x' + bytesToHex_(paymasterAndDataHash),
    },
    packed_user_op_hash: '0x' + bytesToHex_(packedUserOpHashBytes),
    user_op_hash: '0x' + bytesToHex_(userOpHashBytes),
    gas_accounting,
    paymaster_reconciliation,
    never_fetched: NEVER_FETCHED,
    scope_note: SCOPE_NOTE,
  };

  const compliance_flags = ['ERC4337_USEROP_RECOMPUTED', 'ERC4337_ENTRYPOINT_V' + version.replace('.', '_')];
  if (entry_point_echo.address_matches_canonical === false) {
    compliance_flags.push('ERC4337_ENTRYPOINT_ADDRESS_NON_CANONICAL');
  }
  if (paymaster_reconciliation.status === 'RESIDUAL_UNEXPLAINED') {
    compliance_flags.push('ERC4337_PAYMASTER_RESIDUAL_UNEXPLAINED');
  }
  if (paymaster_reconciliation.status === 'RECONCILED') {
    compliance_flags.push('ERC4337_PAYMASTER_RECONCILED');
  }

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
