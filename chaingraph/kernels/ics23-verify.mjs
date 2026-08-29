// ics23-verify.mjs — pure-JS, dependency-free ICS23-style declarative Merkle proof verifier.
// Existence proofs, non-existence proofs (full left/right neighbor-adjacency checking), and a
// ProofSpec that is ALWAYS a build-time-pinned constant, never accepted from the proof or caller.
//
// Spec sources (pinned, sha256 over fetched bytes, full pin table + retrieval date):
// ICS23-PROOFSPEC-BUILD-SPEC.md §1 (workspace root, not this repo).
//   - ICS 023 — Vector Commitments: cosmos/ibc spec/core/ics-023-vector-commitments/README.md
//   - proofs.proto (wire format):    cosmos/ics23 proto/cosmos/ics23/v1/proofs.proto
//   - Implementation guide:          cosmos/ics23 docs/README.md
// Algorithm transcribed from cosmos/ics23's own go/proof.go + go/ops.go (Apache-2.0), read at the
// commit pinned in BUILD-SPEC §1. Sibling to `_hash.mjs` — same "one shared, imported-not-duplicated
// primitives file" discipline; runs unchanged in browsers, Cloudflare Workers, and Node 18+ (all
// expose globalThis.crypto.subtle).
//
// ⛔⛔ THE RULE (BUILD-SPEC §2, normative — restated here because it is the load-bearing invariant
// of this module): a ProofSpec is a build-time-pinned constant, exported by NAME from this module's
// own source. There is no free-form spec constructor, and no code path here accepts spec bytes from
// a caller or from the proof being checked. This closes two failure modes: (1) VSA-2022-103, the
// October 2022 Verichains "Forging Membership Proof" finding, where an under-constrained prefix
// check (`HasPrefix` instead of exact bounds) let one valid proof be reshaped into a forged proof
// for a different key — fixed here by the domain-separation check in checkInnerAgainstSpec() and
// the exact min/max prefix-length + child-size bounds; (2) the deeper "self-consistent checker"
// shape (STANDING-ORDERS #34) — a spec bundled with the proof it constrains could simply declare a
// forged shape legal, so this module never reads a spec from proof data, only from its own exports.

const HashOp = Object.freeze({ NO_HASH: 0, SHA256: 1 });
const LengthOp = Object.freeze({ NO_PREFIX: 0, VAR_PROTO: 1 });
export { HashOp, LengthOp };

const EMPTY = new Uint8Array(0);

// ---------------------------------------------------------------------------------------------
// Byte-level primitives
// ---------------------------------------------------------------------------------------------

async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

function concatBytes(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrs) { out.set(a, offset); offset += a.length; }
  return out;
}

function bytesEqual(a, b) {
  const ab = a ?? EMPTY, bb = b ?? EMPTY;
  if (ab.length !== bb.length) return false;
  for (let i = 0; i < ab.length; i++) if (ab[i] !== bb[i]) return false;
  return true;
}

// Byte-lexicographic comparison (Go bytes.Compare semantics). STRICT ordering is the caller's
// job (BUILD-SPEC §4 step 2) — this function only reports order, never equality tolerance.
function compareBytes(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function prefixStartsWith(haystack, needle) {
  const n = needle ?? EMPTY;
  if (n.length === 0) return true;
  if (haystack.length < n.length) return false;
  for (let i = 0; i < n.length; i++) if (haystack[i] !== n[i]) return false;
  return true;
}

function encodeVarintProto(n) {
  const out = [];
  let l = n;
  while (l >= 0x80) { out.push((l & 0x7f) | 0x80); l >>>= 7; }
  out.push(l);
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------------------------
// LeafOp / InnerOp application (docs/README.md membership steps; go/ops.go Apply)
// ---------------------------------------------------------------------------------------------

async function doHash(hashOp, data) {
  if (hashOp === HashOp.SHA256) return sha256(data);
  throw new Error(`ics23-verify: unsupported HashOp ${hashOp} — the pinned presets need only SHA256`);
}

async function doHashOrNoop(hashOp, data) {
  if (hashOp === HashOp.NO_HASH || hashOp === undefined) return data;
  return doHash(hashOp, data);
}

function doLengthOp(lengthOp, data) {
  switch (lengthOp ?? LengthOp.NO_PREFIX) {
    case LengthOp.NO_PREFIX: return data;
    case LengthOp.VAR_PROTO: return concatBytes(encodeVarintProto(data.length), data);
    default:
      throw new Error(`ics23-verify: unsupported LengthOp ${lengthOp} — the pinned presets need only NO_PREFIX/VAR_PROTO`);
  }
}

async function prepareLeafData(hashOp, lengthOp, data) {
  const hashed = await doHashOrNoop(hashOp, data);
  return doLengthOp(lengthOp, hashed);
}

export const LeafOp = {
  // leafHash = hash(prefix || lengthOp(prehashKey(key)) || lengthOp(prehashValue(value)))
  async apply(op, key, value) {
    if (!key || key.length === 0) throw new Error('ics23-verify: leaf op needs key');
    if (!value || value.length === 0) throw new Error('ics23-verify: leaf op needs value');
    const pkey = await prepareLeafData(op.prehash_key, op.length, key);
    const pvalue = await prepareLeafData(op.prehash_value, op.length, value);
    return doHash(op.hash, concatBytes(op.prefix ?? EMPTY, pkey, pvalue));
  },
};

export const InnerOp = {
  // nextHash = hash(prefix || child || suffix)
  async apply(op, child) {
    if (!child || child.length === 0) throw new Error('ics23-verify: inner op needs child value');
    return doHash(op.hash, concatBytes(op.prefix ?? EMPTY, child, op.suffix ?? EMPTY));
  },
};

// ---------------------------------------------------------------------------------------------
// ProofSpec presets — BUILD-SPEC §2.2, transcribed byte-for-byte from cosmos/ics23/go/proof.go,
// plus ainumbers-simple-v1 (REGISTRY-TILES-BUILD-SPEC.md §4.2, transcribed field-by-field).
// These are the ONLY four specs this module knows about. No constructor exposed.
// ---------------------------------------------------------------------------------------------

export const IAVL_SPEC = Object.freeze({
  name: 'iavl',
  leaf_spec: Object.freeze({
    hash: HashOp.SHA256, prehash_key: HashOp.NO_HASH, prehash_value: HashOp.SHA256,
    length: LengthOp.VAR_PROTO, prefix: Uint8Array.of(0x00),
  }),
  inner_spec: Object.freeze({
    child_order: Object.freeze([0, 1]), min_prefix_length: 4, max_prefix_length: 12,
    child_size: 33, empty_child: EMPTY, hash: HashOp.SHA256,
  }),
  max_depth: 0, min_depth: 0, prehash_key_before_comparison: false,
});

export const TENDERMINT_SPEC = Object.freeze({
  name: 'tendermint',
  leaf_spec: Object.freeze({
    hash: HashOp.SHA256, prehash_key: HashOp.NO_HASH, prehash_value: HashOp.SHA256,
    length: LengthOp.VAR_PROTO, prefix: Uint8Array.of(0x00),
  }),
  inner_spec: Object.freeze({
    child_order: Object.freeze([0, 1]), min_prefix_length: 1, max_prefix_length: 1,
    child_size: 32, empty_child: EMPTY, hash: HashOp.SHA256,
  }),
  max_depth: 0, min_depth: 0, prehash_key_before_comparison: false,
});

export const SMT_SPEC = Object.freeze({
  name: 'smt',
  leaf_spec: Object.freeze({
    hash: HashOp.SHA256, prehash_key: HashOp.SHA256, prehash_value: HashOp.SHA256,
    length: LengthOp.NO_PREFIX, prefix: Uint8Array.of(0x00),
  }),
  inner_spec: Object.freeze({
    child_order: Object.freeze([0, 1]), min_prefix_length: 1, max_prefix_length: 1,
    child_size: 32, empty_child: new Uint8Array(32), hash: HashOp.SHA256,
  }),
  max_depth: 256, min_depth: 0, prehash_key_before_comparison: true,
});

// ainumbers-simple-v1 — the F2 absence-lane tree (REGISTRY-TILES-BUILD-SPEC.md §4.1/§4.2,
// transcribed field-by-field; ⛔ do not re-pick the shape). Sorted-key binary Merkle tree over
// the registry/kernel key set: keys are the raw 32 bytes of kernel_digest sorted by raw byte
// value (raw-byte sorting is what makes ICS23 neighbour-adjacency mechanically checkable),
// values are RFC 8785/JCS-canonical record bytes, RFC 6962 dense structure split at the largest
// power of two below n. Node hashes: leaf = SHA-256(0x00 ‖ key(32) ‖ SHA-256(value)),
// inner = SHA-256(0x01 ‖ left(32) ‖ right(32)) — identical in shape to the two RFC 6962
// implementations the estate already ships. empty_child is deliberately ABSENT: a dense,
// complete-left tree defines no placeholder and needs none. The two legal InnerOp shapes
// (left child: prefix len 1 / suffix len 32; right child: prefix len 33 / suffix len 0) derive
// from the bounds below via getPadding/orderFromPadding — nothing about them is hardcoded, and
// there is no IAVL-style varint prefix to confuse, so no tree-specific hardening pass applies
// (domain separation: inner prefix begins 0x01, leaf prefix is 0x00).
export const AINUMBERS_SIMPLE_SPEC = Object.freeze({
  name: 'ainumbers-simple-v1',
  leaf_spec: Object.freeze({
    hash: HashOp.SHA256, prehash_key: HashOp.NO_HASH, prehash_value: HashOp.SHA256,
    length: LengthOp.NO_PREFIX, prefix: Uint8Array.of(0x00),
  }),
  inner_spec: Object.freeze({
    child_order: Object.freeze([0, 1]), min_prefix_length: 1, max_prefix_length: 1,
    child_size: 32, hash: HashOp.SHA256,
  }),
  max_depth: 64, min_depth: 0, prehash_key_before_comparison: false,
});

// ---------------------------------------------------------------------------------------------
// Pinned-spec enforcement — REGISTRY-TILES-BUILD-SPEC.md §4.3, the pinning rule restated as
// code: the verify entry points accept ONLY one of the four frozen presets above, compared
// structurally field-by-field (a byte-equal behavioural clone of a preset constrains the proof
// identically and is accepted; any rule-bearing difference is not). A spec supplied alongside
// the proof, or constructed ad hoc by a caller, is rejected before any hash runs — a checker
// must never take the rule it checks against from the thing being checked (STANDING-ORDERS #34;
// the VSA-2022-103 lesson one level up). checkAgainstSpec() stays spec-agnostic by design: it
// is the step-attribution helper the upstream vector harness drives with decoded fixtures, not
// a verify entry point. sameBytes() treats undefined and length-0 alike: for empty_child the
// two are behaviourally indistinguishable in this module (both compare against EMPTY).
// ---------------------------------------------------------------------------------------------

const PINNED_SPECS = [IAVL_SPEC, TENDERMINT_SPEC, SMT_SPEC, AINUMBERS_SIMPLE_SPEC];

function sameBytes(a, b) {
  const aa = a ?? EMPTY, bb = b ?? EMPTY;
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}

function sameChildOrder(a, b) {
  const al = a?.length ?? -1, bl = b?.length ?? -1;
  if (al !== bl) return false;
  for (let i = 0; i < al; i++) if (a[i] !== b[i]) return false;
  return true;
}

function matchesPinnedSpec(spec, pinned) {
  if (spec === pinned) return true;
  if (!spec || typeof spec !== 'object') return false;
  const l = spec.leaf_spec, pl = pinned.leaf_spec;
  const i = spec.inner_spec, pi = pinned.inner_spec;
  if (!l || !i) return false;
  return spec.name === pinned.name
    && spec.max_depth === pinned.max_depth && spec.min_depth === pinned.min_depth
    && spec.prehash_key_before_comparison === pinned.prehash_key_before_comparison
    && (l.hash ?? HashOp.NO_HASH) === pl.hash
    && (l.prehash_key ?? HashOp.NO_HASH) === pl.prehash_key
    && (l.prehash_value ?? HashOp.NO_HASH) === pl.prehash_value
    && (l.length ?? LengthOp.NO_PREFIX) === pl.length
    && sameBytes(l.prefix, pl.prefix)
    && (i.hash ?? HashOp.NO_HASH) === pi.hash
    && sameChildOrder(i.child_order, pi.child_order)
    && i.min_prefix_length === pi.min_prefix_length && i.max_prefix_length === pi.max_prefix_length
    && i.child_size === pi.child_size
    && sameBytes(i.empty_child, pi.empty_child);
}

export function assertPinnedSpec(spec) {
  if (PINNED_SPECS.some((p) => matchesPinnedSpec(spec, p))) return spec;
  throw new Error("ics23-verify: spec is not one of this module's four pinned build-time presets (iavl/tendermint/smt/ainumbers-simple-v1) — a ProofSpec is a hash-pinned build-time constant selected by name (REGISTRY-TILES-BUILD-SPEC.md §4.3) and is never accepted from a caller or from the proof");
}

// over-declares equality (matches go/proof.go SpecEquals), used only to decide whether a spec's
// tree-specific hardening pass (validateIavlOps / validateTendermintOps) applies — never to accept
// spec bytes from a caller.
function specEquals(a, b) {
  const al = a.leaf_spec, bl = b.leaf_spec;
  const leafEq = al.hash === bl.hash && al.prehash_key === bl.prehash_key
    && al.prehash_value === bl.prehash_value && al.length === bl.length;
  const ai = a.inner_spec, bi = b.inner_spec;
  const innerEq = ai.hash === bi.hash && ai.min_prefix_length === bi.min_prefix_length
    && ai.max_prefix_length === bi.max_prefix_length && ai.child_size === bi.child_size
    && (ai.child_order?.length ?? 0) === (bi.child_order?.length ?? 0);
  return leafEq && innerEq;
}

// ---------------------------------------------------------------------------------------------
// IAVL / Tendermint tree-specific hardening (go/ops.go validateIavlOps / validateTendermintOps).
// Part of the 2022 fix set: closes the domain-confusion gap for the two tree shapes that need it.
// ---------------------------------------------------------------------------------------------

function readUvarint(bytes, pos) {
  let result = 0n, shift = 0n, b;
  do {
    if (pos >= bytes.length) throw new Error('ics23-verify: failed to read IAVL varint (truncated)');
    b = bytes[pos]; pos++;
    result |= BigInt(b & 0x7f) << shift;
    shift += 7n;
  } while (b & 0x80);
  return [result, pos];
}

// Go's encoding/binary ReadVarint: zigzag-decoded signed varint.
function readVarintZigzag(bytes, pos) {
  const [ux, next] = readUvarint(bytes, pos);
  let x = ux >> 1n;
  if (ux & 1n) x = -x - 1n;
  return [x, next];
}

function validateIavlOps(op, layerNum) {
  const prefix = op.prefix ?? EMPTY;
  let pos = 0, height, size, version;
  [height, pos] = readVarintZigzag(prefix, pos);
  if (height < 0n || height < BigInt(layerNum)) {
    throw new Error(`ics23-verify: IAVL height (${height}) must be non-negative and >= layer number (${layerNum})`);
  }
  [size, pos] = readVarintZigzag(prefix, pos);
  if (size < 0n) throw new Error('ics23-verify: IAVL size must be non-negative');
  [version, pos] = readVarintZigzag(prefix, pos);
  if (version < 0n) throw new Error('ics23-verify: IAVL version must be non-negative');
  const remLen = prefix.length - pos;
  if (layerNum === 0) {
    if (remLen !== 0) throw new Error(`ics23-verify: expected remaining IAVL prefix length to be 0, got ${remLen}`);
    if (height !== 0n) throw new Error('ics23-verify: expected IAVL leaf node height to be 0');
    if (size !== 1n) throw new Error('ics23-verify: expected IAVL leaf node size to be 1');
  } else {
    if (remLen !== 1 && remLen !== 34) {
      throw new Error(`ics23-verify: remainder of IAVL prefix must be length 1 or 34, got ${remLen}`);
    }
    if (op.hash !== HashOp.SHA256) throw new Error('ics23-verify: IAVL inner hash op must be SHA256');
  }
}

function validateTendermintOps(op) {
  const prefix = op.prefix ?? EMPTY;
  if (prefix.length === 0) throw new Error('ics23-verify: tendermint inner op prefix must not be empty');
  const innerPrefix = Uint8Array.of(1);
  const suffix = op.suffix;
  if (suffix !== undefined && suffix.length > 0) {
    if (!bytesEqual(prefix, innerPrefix)) {
      throw new Error('ics23-verify: expected tendermint inner op prefix to be exactly [1] when a suffix is present');
    }
  }
  if (!prefixStartsWith(prefix, innerPrefix)) {
    throw new Error('ics23-verify: expected tendermint inner op prefix to begin with [1]');
  }
}

// ---------------------------------------------------------------------------------------------
// checkAgainstSpec — BUILD-SPEC §2.3, the exact checks that close VSA-2022-103.
// ---------------------------------------------------------------------------------------------

function checkLeafAgainstSpec(leaf, spec) {
  const ls = spec.leaf_spec;
  if ((leaf.hash ?? HashOp.NO_HASH) !== ls.hash) throw new Error(`ics23-verify: leaf unexpected HashOp: ${leaf.hash}`);
  if ((leaf.prehash_key ?? HashOp.NO_HASH) !== ls.prehash_key) throw new Error(`ics23-verify: leaf unexpected PrehashKey: ${leaf.prehash_key}`);
  if ((leaf.prehash_value ?? HashOp.NO_HASH) !== ls.prehash_value) throw new Error(`ics23-verify: leaf unexpected PrehashValue: ${leaf.prehash_value}`);
  if ((leaf.length ?? LengthOp.NO_PREFIX) !== ls.length) throw new Error(`ics23-verify: leaf unexpected LengthOp: ${leaf.length}`);
  if (!prefixStartsWith(leaf.prefix ?? EMPTY, ls.prefix)) throw new Error('ics23-verify: leaf prefix does not start with spec.LeafSpec.prefix');
  if (specEquals(spec, IAVL_SPEC)) validateIavlOps(leaf, 0);
}

function checkInnerAgainstSpec(inner, spec, layerNum) {
  const is = spec.inner_spec;
  if ((inner.hash ?? HashOp.NO_HASH) !== is.hash) throw new Error(`ics23-verify: inner unexpected HashOp: ${inner.hash}`);
  if (specEquals(spec, IAVL_SPEC)) validateIavlOps(inner, layerNum);
  if (specEquals(spec, TENDERMINT_SPEC)) validateTendermintOps(inner);

  // ⛔⛔ THE 2022 FIX, restated as code: an inner node's prefix must be structurally
  // distinguishable from a leaf's, so a forged inner-op can never be reinterpreted as a leaf.
  if (prefixStartsWith(inner.prefix ?? EMPTY, spec.leaf_spec.prefix)) {
    throw new Error('ics23-verify: inner prefix starts with spec.LeafSpec.prefix (domain-separation violation)');
  }

  const prefixLen = (inner.prefix ?? EMPTY).length;
  if (prefixLen < is.min_prefix_length) throw new Error(`ics23-verify: innerOp prefix too short (${prefixLen})`);
  const maxLeftChildBytes = (is.child_order.length - 1) * is.child_size;
  if (prefixLen > is.max_prefix_length + maxLeftChildBytes) throw new Error(`ics23-verify: innerOp prefix too long (${prefixLen})`);
  if (is.child_size <= 0) throw new Error('ics23-verify: spec.InnerSpec.child_size must be >= 1');
  if (is.max_prefix_length >= is.min_prefix_length + is.child_size) {
    throw new Error('ics23-verify: spec.InnerSpec.max_prefix_length must be < min_prefix_length + child_size');
  }
  const suffixLen = (inner.suffix ?? EMPTY).length;
  if (suffixLen % is.child_size !== 0) throw new Error('ics23-verify: innerOp suffix malformed (not a multiple of child_size)');
}

// existenceProof: {key, value, leaf: LeafOp, path: [InnerOp]}
export function checkAgainstSpec(existenceProof, spec) {
  const leaf = existenceProof.leaf;
  if (!leaf) throw new Error('ics23-verify: existence proof needs a defined LeafOp');
  checkLeafAgainstSpec(leaf, spec);

  const path = existenceProof.path ?? [];
  const minDepth = spec.min_depth ?? 0;
  if (minDepth > 0 && path.length < minDepth) throw new Error(`ics23-verify: innerOps depth too short: ${path.length}`);
  const maxDepth = spec.max_depth > 0 ? spec.max_depth : 128;
  if (path.length > maxDepth) throw new Error(`ics23-verify: innerOps depth too long: ${path.length}`);

  let layerNum = 1;
  for (const inner of path) {
    checkInnerAgainstSpec(inner, spec, layerNum);
    layerNum++;
  }
}

// ---------------------------------------------------------------------------------------------
// Existence proof verification — BUILD-SPEC §3.
// ---------------------------------------------------------------------------------------------

async function calculateRoot(proof) {
  let res = await LeafOp.apply(proof.leaf, proof.key, proof.value);
  for (const step of proof.path ?? []) {
    res = await InnerOp.apply(step, res);
  }
  return res;
}

export async function verifyExistence(proof, spec, root, key, value) {
  assertPinnedSpec(spec);
  checkAgainstSpec(proof, spec);
  if (!bytesEqual(key, proof.key)) throw new Error('ics23-verify: provided key does not match proof');
  if (!bytesEqual(value, proof.value)) throw new Error('ics23-verify: provided value does not match proof');
  const calculated = await calculateRoot(proof);
  if (!bytesEqual(root, calculated)) throw new Error('ics23-verify: calculated root does not match provided root');
  return true;
}

// ---------------------------------------------------------------------------------------------
// Non-existence proof verification — BUILD-SPEC §4, the subtle half.
// ---------------------------------------------------------------------------------------------

async function keyForComparison(spec, key) {
  if (!spec.prehash_key_before_comparison) return key;
  return doHashOrNoop(spec.leaf_spec.prehash_key, key);
}

function getPosition(order, branch) {
  const idx = order.indexOf(branch);
  if (idx === -1) throw new Error(`ics23-verify: branch ${branch} not found in child_order ${order}`);
  return idx;
}

function getPadding(spec, branch) {
  const idx = getPosition(spec.child_order, branch);
  const leadingBytes = idx * spec.child_size;
  const minPrefix = leadingBytes + spec.min_prefix_length;
  const maxPrefix = leadingBytes + spec.max_prefix_length;
  const suffix = (spec.child_order.length - 1 - idx) * spec.child_size;
  return { minPrefix, maxPrefix, suffix };
}

function hasPadding(op, minPrefix, maxPrefix, suffix) {
  const prefixLen = (op.prefix ?? EMPTY).length;
  if (prefixLen < minPrefix || prefixLen > maxPrefix) return false;
  return (op.suffix ?? EMPTY).length === suffix;
}

function orderFromPadding(spec, inner) {
  for (let branch = 0; branch < spec.child_order.length; branch++) {
    const { minPrefix, maxPrefix, suffix } = getPadding(spec, branch);
    if (hasPadding(inner, minPrefix, maxPrefix, suffix)) return branch;
  }
  throw new Error('ics23-verify: cannot find any valid spacing for this inner node');
}

function leftBranchesAreEmpty(spec, op) {
  const idx = orderFromPadding(spec, op);
  const leftBranches = idx;
  if (leftBranches === 0) return false;
  const prefix = op.prefix ?? EMPTY;
  const actualPrefix = prefix.length - leftBranches * spec.child_size;
  if (actualPrefix < 0) return false;
  for (let i = 0; i < leftBranches; i++) {
    const bidx = getPosition(spec.child_order, i);
    const from = actualPrefix + bidx * spec.child_size;
    if (!bytesEqual(spec.empty_child, prefix.slice(from, from + spec.child_size))) return false;
  }
  return true;
}

function rightBranchesAreEmpty(spec, op) {
  const idx = orderFromPadding(spec, op);
  const rightBranches = spec.child_order.length - 1 - idx;
  if (rightBranches === 0) return false;
  const suffix = op.suffix ?? EMPTY;
  if (suffix.length !== rightBranches * spec.child_size) return false;
  for (let i = 0; i < rightBranches; i++) {
    const bidx = getPosition(spec.child_order, i);
    const from = bidx * spec.child_size;
    if (!bytesEqual(spec.empty_child, suffix.slice(from, from + spec.child_size))) return false;
  }
  return true;
}

// Reads padding rules from the pinned spec.InnerSpec (never hardcoded, never proof-derived —
// BUILD-SPEC §4's named implementation trap).
function isLeftMost(spec, path) {
  const { minPrefix, maxPrefix, suffix } = getPadding(spec, 0);
  for (const step of path) {
    if (!hasPadding(step, minPrefix, maxPrefix, suffix) && !leftBranchesAreEmpty(spec, step)) return false;
  }
  return true;
}

function isRightMost(spec, path) {
  const last = spec.child_order.length - 1;
  const { minPrefix, maxPrefix, suffix } = getPadding(spec, last);
  for (const step of path) {
    if (!hasPadding(step, minPrefix, maxPrefix, suffix) && !rightBranchesAreEmpty(spec, step)) return false;
  }
  return true;
}

function isLeftStep(spec, left, right) {
  const leftIdx = orderFromPadding(spec, left);
  const rightIdx = orderFromPadding(spec, right);
  return rightIdx === leftIdx + 1;
}

function isLeftNeighbor(spec, leftPath, rightPath) {
  if (leftPath.length === 0 || rightPath.length === 0) {
    throw new Error('ics23-verify: neighbor check needs non-empty inner paths on both sides');
  }
  const left = leftPath.slice();
  const right = rightPath.slice();
  let topleft = left.pop();
  let topright = right.pop();
  while (bytesEqual(topleft.prefix, topright.prefix) && bytesEqual(topleft.suffix, topright.suffix)) {
    if (left.length === 0 || right.length === 0) {
      throw new Error('ics23-verify: neighbor check ran out of common path before diverging');
    }
    topleft = left.pop();
    topright = right.pop();
  }
  if (!isLeftStep(spec, topleft, topright)) return false;
  if (!isRightMost(spec, left)) return false;
  if (!isLeftMost(spec, right)) return false;
  return true;
}

// nonExistenceProof: {key, left: ExistenceProof|null, right: ExistenceProof|null}
export async function verifyNonExistence(proof, spec, root, key) {
  assertPinnedSpec(spec);
  let leftKey = null, rightKey = null;
  if (proof.left) {
    await verifyExistence(proof.left, spec, root, proof.left.key, proof.left.value);
    leftKey = proof.left.key;
  }
  if (proof.right) {
    await verifyExistence(proof.right, spec, root, proof.right.key, proof.right.value);
    rightKey = proof.right.key;
  }
  if (!leftKey && !rightKey) throw new Error('ics23-verify: both left and right proofs missing');

  // ⛔⛔ STRICT lexicographic range-check (BUILD-SPEC §4 step 2) — a non-strict comparison here
  // would allow "proving" absence of a key that is actually present.
  const cmpKey = await keyForComparison(spec, key);
  if (rightKey) {
    const cmpRight = await keyForComparison(spec, rightKey);
    if (compareBytes(cmpKey, cmpRight) >= 0) throw new Error('ics23-verify: key is not strictly left of right proof');
  }
  if (leftKey) {
    const cmpLeft = await keyForComparison(spec, leftKey);
    if (compareBytes(cmpKey, cmpLeft) <= 0) throw new Error('ics23-verify: key is not strictly right of left proof');
  }

  if (!leftKey) {
    if (!isLeftMost(spec.inner_spec, proof.right.path ?? [])) {
      throw new Error('ics23-verify: left proof missing, right proof must be left-most');
    }
  } else if (!rightKey) {
    if (!isRightMost(spec.inner_spec, proof.left.path ?? [])) {
      throw new Error('ics23-verify: right proof missing, left proof must be right-most');
    }
  } else {
    if (!isLeftNeighbor(spec.inner_spec, proof.left.path ?? [], proof.right.path ?? [])) {
      throw new Error('ics23-verify: left and right proofs are not adjacent (no gap proven between them)');
    }
  }
  return true;
}
