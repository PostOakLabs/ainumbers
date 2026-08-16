// art-628 — Declarative Decision-Tree Evaluator: pure decision kernel.
// ACCT-DTREE-K-1, anchored on ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.0.1 (bundle + demonstrator
// structure), Sec.3 (full kernel spec), Sec.4 (composition contract), Sec.5 (row-level
// requirements) + RIDER-KERNEL.md (STANDING ORDER #6) + FORMALVERIF-BUILD-SPEC.md Sec.1/Sec.3/
// Sec.6.A/Sec.7 + SPEC.md Sec.17/Sec.18/Sec.18.5.
//
// Job (build spec Sec.3): one audited interpreter for hash-pinned, citation-gated decision
// trees delivered entirely as DATA in policy_parameters — never baked into kernel source
// (Sec.3.2/Sec.4). This kernel embeds NO tree of its own; every call supplies its own
// {tree, facts}. The demonstrator tree this row exercises (Reg D Rule 501(a) entity-type
// accredited-investor category test, citing 17 CFR 230.501(a)(1)/(2)/(3)/(8)/(9)) lives only in
// this kernel's fixtures and the row's clause snapshot — never hardcoded here, per the ruling
// that a tree edit must never move kernel_digest.
//
// Pure: no DOM, no window, no network, no host crypto in compute() (GUEST-BUILTIN-GATE-1,
// RIDER-KERNEL.md) — the inlined _dtree bundle below hand-rolls its own UTF-8 encoder and
// SHA-256, same construction already proven guest-safe in art-199/200/206/210/280/584/620.

import { executionHash } from './_hash.mjs';

/* ===== inlined _dtree (RISC0 guest provides only _hash; bundle import is unavailable in-guest) ===== */
// _dtree.bundle.mjs — declarative decision-tree evaluator, shared kernel infra.
// ACCT-DTREE-K-1, anchored on ACCT-INFRA-KERNELS-BUILD-SPEC.md Sec.3 (full kernel spec) +
// Sec.4 (composition contract) + RIDER-KERNEL.md (STANDING ORDER #6).
//
// PURPOSE: one audited interpreter for hash-pinned, citation-gated decision trees. A tree is
// inert DATA delivered via policy_parameters (Sec.3.2/Sec.4.1 of the build spec) -- this module
// is the ONLY code that walks it. No eval, no expression strings, no function-valued criteria:
// the closed operator set below is the entire evaluation vocabulary.
//
// GUEST SAFETY (GUEST-BUILTIN-GATE-1, RIDER-KERNEL.md): the RISC0 guest has no TextEncoder, no
// atob/btoa, no URL, no crypto.subtle. This module hand-rolls its own UTF-8 byte encoder and a
// pure-JS SHA-256 (same construction already proven guest-safe in art-199/200/206/210/280/584/620)
// so the in-guest tree_digest assertion (Sec.3.2/Sec.4's "never baked into kernel source" ruling,
// same as Sec.2.3's registry_digest) never touches a guest-absent builtin.
//
// COMPOSITION CONTRACT (build spec Sec.4.1): consumers paste this file VERBATIM between sentinel
// comments in their own .kernel.mjs and destructure what they need. NEVER `import` this module at
// runtime -- the RISC0 guest provides only `_hash`, so a bundle import is unavailable in-guest.
// This file is `_`-prefixed and exports NO `meta`/`compute` -- it must not be discovered as a node
// by check-kernel-exports.mjs / check-kernel-coverage.mjs.
//
// Zero-import, zero-network, zero-dependency. Pure JS only.

const _dtree = (function () {
'use strict';

// ── closed operator set (build spec Sec.3.1) ──────────────────────────────────────────────────
const CLOSED_OPERATORS = ['eq', 'in', 'lt', 'lte', 'gt', 'gte', 'between', 'all_of', 'any_of', 'none_of'];

// ── bounds (build spec Sec.3.4), declared and enforced, over-limit is a NAMED error ─────────────
const MAX_DEPTH = 12;
const MAX_NODES = 256;
const MAX_TREE_BYTES = 65536; // 64 KiB

// ── guest-safe UTF-8 byte encoder (no TextEncoder) ───────────────────────────────────────────────
function _utf8Bytes(str) {
  const s = String(str);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const hi = c, lo = s.charCodeAt(++i);
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

// ── guest-safe pure-JS SHA-256 (no crypto.subtle) — same construction as art-620 ────────────────
function _sha256(bytes) {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j = cs + i * 4; W[i] = (padded[j] << 24) | (padded[j+1] << 16) | (padded[j+2] << 8) | padded[j+3]; }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3);
      const s1 = rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const r = new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function (v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

function _sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(str))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── canonicalizer: recursive key sort, matches _hash.mjs's cgCanon (RFC 8785 / JCS shape) ───────
// Duplicated here (not imported) because a bundle inlined into a guest-executed compute() must
// never import _hash.mjs, whose executionHash() depends on crypto.subtle/TextEncoder.
function _dtCanon(v) {
  if (Array.isArray(v)) return v.map(_dtCanon);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort().forEach(function (k) { out[k] = _dtCanon(v[k]); });
    return out;
  }
  return v;
}

// ── tree_digest: sha256(canon(tree minus tree_digest field)) — bounded by MAX_TREE_BYTES ────────
function computeTreeDigest(tree) {
  const stripped = Object.assign({}, tree);
  delete stripped.tree_digest;
  return _sha256Hex(JSON.stringify(_dtCanon(stripped)));
}

function _validCitation(c) {
  return !!c && typeof c === 'object' &&
    typeof c.clause === 'string' && c.clause.length > 0 &&
    typeof c.source === 'string' && c.source.length > 0 &&
    typeof c.source_digest === 'string' && c.source_digest.length > 0 &&
    typeof c.snapshot_location === 'string' && c.snapshot_location.length > 0;
}

// ── structural validation: shape, bounds, citation-on-every-node, closed operator set, ──────────
// ── branch integrity, cycle-acyclicity + max_depth — ALL AT LOAD, before any evaluation. ────────
// Full-graph traversal is ITERATIVE over an explicit array-based stack, never recursive (build
// spec Sec.3.4: "a bounded stack is measurable; recursion depth in the guest is not").
function validateTree(tree) {
  if (!tree || typeof tree !== 'object') return { ok: false, error_code: 'TREE_MISSING', message: 'policy_parameters.tree is missing or not an object' };

  const nodes = tree.nodes;
  if (!nodes || typeof nodes !== 'object' || Array.isArray(nodes)) return { ok: false, error_code: 'TREE_MISSING_NODES', message: 'tree.nodes is missing or not an object' };
  const nodeIds = Object.keys(nodes);
  if (nodeIds.length === 0) return { ok: false, error_code: 'TREE_MISSING_NODES', message: 'tree.nodes is empty' };
  if (nodeIds.length > MAX_NODES) return { ok: false, error_code: 'TREE_MAX_NODES_EXCEEDED', message: `tree has ${nodeIds.length} nodes, exceeds max_nodes=${MAX_NODES}` };

  const byteLen = _utf8Bytes(JSON.stringify(tree)).length;
  if (byteLen > MAX_TREE_BYTES) return { ok: false, error_code: 'TREE_MAX_BYTES_EXCEEDED', message: `tree is ${byteLen} bytes, exceeds max_tree_bytes=${MAX_TREE_BYTES}` };

  const rootId = tree.root;
  if (typeof rootId !== 'string' || !Object.prototype.hasOwnProperty.call(nodes, rootId)) {
    return { ok: false, error_code: 'TREE_ROOT_NOT_FOUND', message: `tree.root "${String(rootId)}" is not a key of tree.nodes` };
  }

  for (const id of nodeIds) {
    const node = nodes[id];
    if (!node || typeof node !== 'object') return { ok: false, error_code: 'TREE_INVALID_NODE', message: `node "${id}" is not an object` };
    if (!_validCitation(node.citation)) return { ok: false, error_code: 'TREE_UNCITED_NODE', message: `node "${id}" carries no valid citation {clause, source, source_digest, snapshot_location} — REJECTED BY THE LOADER (internal criteria are cited, not leaves only)` };

    if (node.kind === 'leaf') {
      if (typeof node.verdict !== 'string' || node.verdict.length === 0) return { ok: false, error_code: 'TREE_INVALID_LEAF', message: `leaf "${id}" missing a non-empty string verdict` };
    } else if (node.kind === 'criterion') {
      if (!CLOSED_OPERATORS.includes(node.operator)) return { ok: false, error_code: 'TREE_INVALID_OPERATOR', message: `node "${id}" operator "${String(node.operator)}" is not in the closed operator set` };
      if (typeof node.field !== 'string' || node.field.length === 0) return { ok: false, error_code: 'TREE_INVALID_NODE', message: `node "${id}" missing a non-empty string field` };
      const branches = node.branches;
      if (!branches || typeof branches !== 'object' || Array.isArray(branches)) return { ok: false, error_code: 'TREE_INVALID_BRANCHES', message: `node "${id}" missing branches` };
      const bKeys = Object.keys(branches).slice().sort();
      if (bKeys.length !== 2 || bKeys[0] !== 'false' || bKeys[1] !== 'true') return { ok: false, error_code: 'TREE_INVALID_BRANCHES', message: `node "${id}" branches must be exactly {true, false}, got {${bKeys.join(',')}}` };
      if (!Object.prototype.hasOwnProperty.call(nodes, branches.true) || !Object.prototype.hasOwnProperty.call(nodes, branches.false)) {
        return { ok: false, error_code: 'TREE_INVALID_BRANCHES', message: `node "${id}" branch target not found in tree.nodes` };
      }
    } else {
      return { ok: false, error_code: 'TREE_INVALID_NODE', message: `node "${id}" has unknown kind "${String(node.kind)}" (must be "criterion" or "leaf")` };
    }
  }

  // Cycle-acyclicity + max_depth, iterative DFS over an explicit array stack.
  const stack = [{ id: rootId, depth: 1, path: new Set([rootId]) }];
  let maxDepthSeen = 0;
  let steps = 0;
  const STEP_CAP = MAX_NODES * 4; // defense in depth; node count already bounded above
  while (stack.length > 0) {
    steps++;
    if (steps > STEP_CAP) return { ok: false, error_code: 'TREE_CYCLE_DETECTED', message: 'traversal step cap exceeded during acyclicity check' };
    const frame = stack.pop();
    if (frame.depth > maxDepthSeen) maxDepthSeen = frame.depth;
    if (frame.depth > MAX_DEPTH) return { ok: false, error_code: 'TREE_MAX_DEPTH_EXCEEDED', message: `depth ${frame.depth} at node "${frame.id}" exceeds max_depth=${MAX_DEPTH}` };
    const node = nodes[frame.id];
    if (node.kind === 'criterion') {
      for (const branchKey of ['true', 'false']) {
        const nextId = node.branches[branchKey];
        if (frame.path.has(nextId)) return { ok: false, error_code: 'TREE_CYCLE_DETECTED', message: `cycle detected: "${frame.id}" --${branchKey}--> "${nextId}" revisits an ancestor on this path` };
        const nextPath = new Set(frame.path);
        nextPath.add(nextId);
        stack.push({ id: nextId, depth: frame.depth + 1, path: nextPath });
      }
    }
  }

  return { ok: true, max_depth_seen: maxDepthSeen, node_count: nodeIds.length, byte_length: byteLen };
}

// ── operator evaluation — the closed set, every branch returns boolean or a named error object ─
function evalOperator(operator, factValue, operand) {
  const numOk = typeof factValue === 'number' && Number.isFinite(factValue);
  switch (operator) {
    case 'eq':
      return factValue === operand;
    case 'in':
      if (!Array.isArray(operand)) return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "in" requires an array operand' };
      return operand.includes(factValue);
    case 'lt':
      if (!numOk || typeof operand !== 'number') return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "lt" requires a numeric field value and numeric operand' };
      return factValue < operand;
    case 'lte':
      if (!numOk || typeof operand !== 'number') return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "lte" requires a numeric field value and numeric operand' };
      return factValue <= operand;
    case 'gt':
      if (!numOk || typeof operand !== 'number') return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "gt" requires a numeric field value and numeric operand' };
      return factValue > operand;
    case 'gte':
      if (!numOk || typeof operand !== 'number') return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "gte" requires a numeric field value and numeric operand' };
      return factValue >= operand;
    case 'between':
      if (!Array.isArray(operand) || operand.length !== 2 || typeof operand[0] !== 'number' || typeof operand[1] !== 'number') {
        return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "between" requires operand [lo, hi] of two numbers' };
      }
      if (!numOk) return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "between" requires a numeric field value' };
      return factValue >= operand[0] && factValue <= operand[1];
    case 'all_of':
      if (!Array.isArray(factValue) || !Array.isArray(operand)) return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "all_of" requires an array field value and array operand' };
      return operand.every(function (o) { return factValue.includes(o); });
    case 'any_of':
      if (!Array.isArray(factValue) || !Array.isArray(operand)) return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "any_of" requires an array field value and array operand' };
      return operand.some(function (o) { return factValue.includes(o); });
    case 'none_of':
      if (!Array.isArray(factValue) || !Array.isArray(operand)) return { error_code: 'FACT_TYPE_MISMATCH', message: 'operator "none_of" requires an array field value and array operand' };
      return !operand.some(function (o) { return factValue.includes(o); });
    default:
      return { error_code: 'TREE_INVALID_OPERATOR', message: `unknown operator "${String(operator)}" (should have been rejected at load)` };
  }
}

// ── full run: load-validate -> digest fail-closed -> iterative evaluation loop (not recursive) ──
function runTree(pp) {
  pp = pp || {};
  const tree = pp.tree;
  const facts = (pp.facts && typeof pp.facts === 'object' && !Array.isArray(pp.facts)) ? pp.facts : {};

  const structural = validateTree(tree);
  if (!structural.ok) {
    return {
      verdict: null, error_code: structural.error_code, message: structural.message,
      matched_node_id: null, matched_citation: null, path: [], weight: null,
      tree_id: (tree && typeof tree.tree_id === 'string') ? tree.tree_id : null,
      tree_version: (tree && typeof tree.tree_version === 'string') ? tree.tree_version : null,
      tree_digest_recomputed: null,
    };
  }

  const recomputedDigest = computeTreeDigest(tree);
  const declaredDigest = typeof tree.tree_digest === 'string' ? tree.tree_digest.toLowerCase() : null;
  if (declaredDigest === null || declaredDigest !== recomputedDigest.toLowerCase()) {
    return {
      verdict: null, error_code: 'TREE_DIGEST_MISMATCH',
      message: `declared tree_digest "${String(tree.tree_digest)}" does not match recomputed digest "${recomputedDigest}" over the tree's own bytes`,
      matched_node_id: null, matched_citation: null, path: [], weight: null,
      tree_id: tree.tree_id, tree_version: tree.tree_version, tree_digest_recomputed: recomputedDigest,
    };
  }

  // Iterative evaluation loop over an explicit walk pointer — never recursive.
  let currentId = tree.root;
  const path = [currentId];
  let steps = 0;
  const STEP_CAP = MAX_NODES + 1; // defense in depth; acyclicity already proven above
  while (true) {
    steps++;
    if (steps > STEP_CAP) {
      return {
        verdict: null, error_code: 'TREE_EVAL_STEP_LIMIT_EXCEEDED', message: `evaluation exceeded ${STEP_CAP} steps`,
        matched_node_id: null, matched_citation: null, path, weight: null,
        tree_id: tree.tree_id, tree_version: tree.tree_version, tree_digest_recomputed: recomputedDigest,
      };
    }
    const node = tree.nodes[currentId];
    if (node.kind === 'leaf') {
      return {
        verdict: node.verdict, error_code: null, message: null,
        matched_node_id: currentId, matched_citation: node.citation, path,
        weight: (node.weight === undefined) ? null : node.weight,
        tree_id: tree.tree_id, tree_version: tree.tree_version, tree_digest_recomputed: recomputedDigest,
      };
    }
    const hasField = Object.prototype.hasOwnProperty.call(facts, node.field);
    const factValue = hasField ? facts[node.field] : undefined;
    if (!hasField || factValue === undefined) {
      return {
        verdict: null, error_code: 'FACT_FIELD_MISSING', message: `facts.${node.field} is required by node "${currentId}" and was not provided`,
        matched_node_id: null, matched_citation: null, path, weight: null,
        tree_id: tree.tree_id, tree_version: tree.tree_version, tree_digest_recomputed: recomputedDigest,
      };
    }
    const evalResult = evalOperator(node.operator, factValue, node.operand);
    if (evalResult && typeof evalResult === 'object' && evalResult.error_code) {
      return {
        verdict: null, error_code: evalResult.error_code, message: `at node "${currentId}": ${evalResult.message}`,
        matched_node_id: null, matched_citation: null, path, weight: null,
        tree_id: tree.tree_id, tree_version: tree.tree_version, tree_digest_recomputed: recomputedDigest,
      };
    }
    const outcomeKey = evalResult ? 'true' : 'false';
    currentId = node.branches[outcomeKey];
    path.push(currentId);
  }
}

return {
  CLOSED_OPERATORS, MAX_DEPTH, MAX_NODES, MAX_TREE_BYTES,
  validateTree, evalOperator, computeTreeDigest, runTree,
};
})();
/* ===== END inlined _dtree ===== */

const { runTree, MAX_DEPTH, MAX_NODES, MAX_TREE_BYTES, CLOSED_OPERATORS } = _dtree;

const TOOL_ID = 'art-628-declarative-decision-tree-evaluator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'evaluate_decision_tree',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const SCOPE_NOTE =
  'This kernel is a generic decision-tree interpreter. It carries no embedded classification ' +
  'rules of its own -- every call must supply its own {tree, facts} in policy_parameters. Any ' +
  'citation, verdict, or bound reported below comes entirely from the caller-supplied tree, ' +
  'never from anything hardcoded in this kernel.';

/**
 * compute(pp) — evaluate a caller-supplied, hash-pinned, citation-gated decision tree against
 * caller-supplied facts. Never trusts the caller's tree_digest as an oracle for itself: it is
 * recomputed from the tree's own bytes and compared fail-closed (STANDING-ORDERS.md #34).
 * pp: {
 *   tree?: { tree_id, tree_version, tree_digest, root, nodes: { <id>: {kind, ...} } },
 *   facts?: { [field: string]: any },
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const result = runTree(pp);

  const compliance_flags = {
    DTREE_OPERATOR_SET_CLOSED: true,
    DTREE_TREE_IS_DATA_NOT_CODE: true,
  };
  if (result.error_code === null) {
    compliance_flags.DTREE_EVAL_OK = true;
  } else {
    compliance_flags.DTREE_EVAL_REJECTED = true;
    if (result.error_code === 'TREE_UNCITED_NODE') compliance_flags.DTREE_UNCITED_NODE_REJECTED = true;
    if (result.error_code === 'TREE_DIGEST_MISMATCH') compliance_flags.DTREE_DIGEST_MISMATCH_REJECTED = true;
    if (result.error_code === 'TREE_CYCLE_DETECTED') compliance_flags.DTREE_CYCLE_REJECTED = true;
  }

  const output_payload = {
    verdict: result.verdict,
    error_code: result.error_code,
    message: result.message,
    matched_node_id: result.matched_node_id,
    matched_citation: result.matched_citation,
    path: result.path,
    weight: result.weight,
    tree_id: result.tree_id,
    tree_version: result.tree_version,
    tree_digest_recomputed: result.tree_digest_recomputed,
    bounds: { max_depth: MAX_DEPTH, max_nodes: MAX_NODES, max_tree_bytes: MAX_TREE_BYTES },
    closed_operator_set: CLOSED_OPERATORS,
    scope_note: SCOPE_NOTE,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
