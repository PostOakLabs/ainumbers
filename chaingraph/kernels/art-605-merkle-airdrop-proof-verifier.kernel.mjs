import { executionHash } from './_hash.mjs';

// Vendored: @noble/hashes (utils.js, _u64.js, sha3.js -- keccak_256 only) v2.2.0 (MIT,
// (c) Paul Miller paulmillr.com). Source: https://github.com/paulmillr/noble-hashes,
// pinned to npm tag v2.2.0 -- same pin already vendored in
// chaingraph/kernels/_noble-secp256k1.bundle.mjs (SPEC-X402-CRYPTO-CORE-1-2026-08-09.md
// section 3: reuse the existing vendored bundle, no second copy) and re-inlined for the same
// reason art-590/art-595 re-inline it (RIDER-KERNEL #6 / the art-476 lesson: the chaingraph/vm
// QuickJS guest's ESM-strip only expects a kernel to import from ./_hash.mjs, and compute()
// must stay fully synchronous). Byte-identical to
// chaingraph/kernels/art-595-ap2-cartmandate-hashchain-builder.kernel.mjs's copy of the same
// block, not hand-edited.
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

// art-605 -- Merkle Airdrop-Proof Verifier: pure decision kernel.
// ETHMATH-WAVE-BUILD-SPEC.md sec 4: leaf + sibling path -> root, OpenZeppelin MerkleProof.verify
// shape (openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol, processProof/
// _hashPair). Leaf derivation follows OpenZeppelin's StandardMerkleTree convention for a
// (address, uint256) leaf: leaf = keccak256(bytes.concat(keccak256(abi.encode(address, amount))))
// -- the "double hash" that guards against a second-preimage attack where a 64-byte internal node
// could otherwise be replayed as a leaf. A `single-hash` variant (leaf = keccak256(abi.encode(...))
// with no outer hash) is also supported as a DECLARED encoding_variant, since some deployed airdrop
// contracts use it and confusing the two is a real, documented bug class in Merkle-airdrop
// postmortems -- this kernel never assumes which one a caller means.
// _hashPair sorted-pair hashing (a<b ? keccak(a,b) : keccak(b,a), OpenZeppelin's default,
// commutative so proof-step order doesn't matter) is a DECLARED pair_sort param, never an
// assumption; when pair_sort is false each proof step must declare an explicit position
// ('left'|'right') telling which side of the current hash the sibling concatenates on.
// An optional claimed_path (a previously-computed sequence of per-step running hashes) lets a
// caller re-verify a proof against a possibly-altered leaf/proof/sibling-order and get back the
// exact step index where the recompute first diverges from what was claimed, instead of only a
// final match/no-match -- the same "diverges at step k" shape the CartMandate hash-chain builder
// (art-595) uses for its claimed_links. No chain reads: this kernel never knows whether
// claimed_root is the value actually on-chain, whether the airdrop claim was already made/
// redeemed, or whether the tree itself was constructed correctly -- it only recomputes hashes.

const TOOL_ID = 'art-605-merkle-airdrop-proof-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'verify_merkle_airdrop_proof',
  mandate_type: 'payment_policy',
  gpu: false,
};

const SCOPE_NOTE = 'Pure hash recomputation over caller-declared leaf fields and sibling path -- OpenZeppelin MerkleProof.verify shape (leaf, then _hashPair per proof step, compared to claimed_root). This kernel does NOT know whether claimed_root is the root actually recorded on any chain, whether this leaf\'s airdrop allocation has already been claimed/redeemed, whether the underlying Merkle tree was constructed correctly from the full allocation list, or who controls the address. It only reports whether the supplied leaf + proof recompute to claimed_root, and (when a claimed_path is supplied for re-verification) the earliest step at which the recompute diverges from that claim.';

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const MAX_UINT256 = (1n << 256n) - 1n;

function str(v, fallback) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

function parseAmount(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  try {
    if (/^0x[0-9a-fA-F]+$/.test(t)) {
      const n = BigInt(t);
      return (n >= 0n && n <= MAX_UINT256) ? n : null;
    }
    if (/^[0-9]+$/.test(t)) {
      const n = BigInt(t);
      return (n >= 0n && n <= MAX_UINT256) ? n : null;
    }
  } catch { return null; }
  return null;
}

// left-pad a BigInt to `bytesLen` bytes, big-endian.
function bigIntToBytes(n, bytesLen) {
  const hex = n.toString(16).padStart(bytesLen * 2, '0');
  return hexToBytes_(hex);
}

function addressToWord(addressHex) {
  // abi.encode(address) shape: 12 zero bytes + 20 address bytes = 32-byte word.
  const addrBytes = hexToBytes_(addressHex.slice(2).toLowerCase());
  return concatBytes_(new Uint8Array(12), addrBytes);
}

function hexOf(bytes) {
  return '0x' + bytesToHex_(bytes);
}

// OpenZeppelin _hashPair: commutative sorted-pair hash. Byte-lexicographic compare over the raw
// 32-byte values (equivalent to numeric compare since both operands are fixed 32-byte width).
function hashPairSorted(aBytes, bBytes) {
  for (let i = 0; i < 32; i++) {
    if (aBytes[i] !== bBytes[i]) {
      return aBytes[i] < bBytes[i] ? keccak_256(concatBytes_(aBytes, bBytes)) : keccak_256(concatBytes_(bBytes, aBytes));
    }
  }
  return keccak_256(concatBytes_(aBytes, bBytes)); // equal (degenerate duplicate-leaf case)
}

function hashPairOrdered(currentBytes, siblingBytes, position) {
  // position names which side the SIBLING sits on relative to the running hash.
  return position === 'left'
    ? keccak_256(concatBytes_(siblingBytes, currentBytes))
    : keccak_256(concatBytes_(currentBytes, siblingBytes));
}

export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const reasons = [];

  const address = str(pp.address, null);
  if (address === null || !ADDR_RE.test(address)) {
    reasons.push('address is required and must be a 0x-prefixed 20-byte (40 hex char) address');
  }

  const amount = parseAmount(pp.amount);
  if (amount === null) {
    reasons.push('amount is required and must be a non-negative uint256, as a decimal or 0x-hex string');
  }

  const encoding_variant = (pp.encoding_variant === 'single-hash') ? 'single-hash'
    : (pp.encoding_variant === 'double-hash' || pp.encoding_variant === undefined) ? 'double-hash'
    : null;
  if (encoding_variant === null) {
    reasons.push('encoding_variant, if supplied, must be "double-hash" or "single-hash"');
  }

  const pair_sort = pp.pair_sort === false ? false : true;

  const claimed_root = str(pp.claimed_root, null);
  if (claimed_root === null || !HASH_RE.test(claimed_root)) {
    reasons.push('claimed_root is required and must be a 0x-prefixed 32-byte (64 hex char) hash');
  }

  const rawProof = Array.isArray(pp.proof) ? pp.proof : null;
  if (rawProof === null) {
    reasons.push('proof is required and must be an array (empty array means the leaf is the root)');
  }

  const proofSteps = [];
  if (rawProof) {
    for (let i = 0; i < rawProof.length; i++) {
      const step = rawProof[i];
      let sibling, position;
      if (typeof step === 'string') {
        sibling = step;
        position = (typeof step === 'object') ? null : null;
      } else if (step !== null && typeof step === 'object' && !Array.isArray(step)) {
        sibling = step.sibling;
        position = step.position;
      } else {
        sibling = null;
        position = null;
      }
      if (typeof sibling !== 'string' || !HASH_RE.test(sibling)) {
        reasons.push(`proof[${i}].sibling must be a 0x-prefixed 32-byte (64 hex char) hash`);
        continue;
      }
      if (!pair_sort) {
        if (position !== 'left' && position !== 'right') {
          reasons.push(`proof[${i}].position is required ("left" or "right") when pair_sort is false`);
          continue;
        }
      }
      proofSteps.push({ sibling, position: position === 'left' || position === 'right' ? position : null });
    }
  }

  const rawClaimedPath = Array.isArray(pp.claimed_path) ? pp.claimed_path : null;
  if (rawClaimedPath !== null) {
    for (let i = 0; i < rawClaimedPath.length; i++) {
      if (typeof rawClaimedPath[i] !== 'string' || !HASH_RE.test(rawClaimedPath[i])) {
        reasons.push(`claimed_path[${i}] must be a 0x-prefixed 32-byte (64 hex char) hash`);
      }
    }
  }

  if (reasons.length > 0) {
    return {
      output_payload: {
        leaf: null,
        computed_root: null,
        path: [],
        encoding_variant_used: null,
        pair_sort_used: pair_sort,
        root_matches_claimed: null,
        path_intact: null,
        first_divergent_step: null,
        note: SCOPE_NOTE,
        reasons,
      },
      compliance_flags: ['MERKLE_INDETERMINATE', 'MERKLE_MALFORMED_INPUT'],
    };
  }

  // ── leaf derivation: abi.encode(address, uint256) then encoding_variant's hash depth ──
  const addrWord = addressToWord(address);
  const amountWord = bigIntToBytes(amount, 32);
  const innerHash = keccak_256(concatBytes_(addrWord, amountWord));
  const leafBytes = (encoding_variant === 'double-hash') ? keccak_256(innerHash) : innerHash;

  // ── walk the sibling path, recording every intermediate running hash ──
  let runningBytes = leafBytes;
  const path = [];
  for (let i = 0; i < proofSteps.length; i++) {
    const { sibling, position } = proofSteps[i];
    const siblingBytes = hexToBytes_(sibling.slice(2));
    const nextBytes = pair_sort
      ? hashPairSorted(runningBytes, siblingBytes)
      : hashPairOrdered(runningBytes, siblingBytes, position);
    runningBytes = nextBytes;
    path.push({ step: i, sibling, position_used: pair_sort ? null : position, running_hash: hexOf(nextBytes) });
  }

  const computed_root = hexOf(runningBytes);
  const root_matches_claimed = computed_root.toLowerCase() === claimed_root.toLowerCase();

  let path_intact = null;
  let first_divergent_step = null;
  if (rawClaimedPath !== null) {
    path_intact = true;
    const n = Math.max(rawClaimedPath.length, path.length);
    for (let i = 0; i < n; i++) {
      const claimedHash = rawClaimedPath[i] ? rawClaimedPath[i].toLowerCase() : null;
      const gotHash = path[i] ? path[i].running_hash.toLowerCase() : null;
      if (claimedHash !== gotHash) {
        path_intact = false;
        first_divergent_step = i;
        break;
      }
    }
  }

  const output_payload = {
    leaf: hexOf(leafBytes),
    computed_root,
    path,
    encoding_variant_used: encoding_variant,
    pair_sort_used: pair_sort,
    root_matches_claimed,
    path_intact,
    first_divergent_step,
    note: SCOPE_NOTE,
    reasons: [],
  };

  const compliance_flags = [
    root_matches_claimed ? 'MERKLE_ROOT_MATCH' : 'MERKLE_ROOT_MISMATCH',
    encoding_variant === 'double-hash' ? 'MERKLE_LEAF_DOUBLE_HASH' : 'MERKLE_LEAF_SINGLE_HASH',
    pair_sort ? 'MERKLE_PAIR_SORTED' : 'MERKLE_PAIR_ORDERED',
  ];
  if (path_intact !== null) compliance_flags.push(path_intact ? 'MERKLE_PATH_INTACT' : 'MERKLE_PATH_BROKEN');

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
