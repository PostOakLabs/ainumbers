// replay-lib.mjs: read a receipt, verify it, re-run it, diff the result, classify the difference.
//
// No DOM, no network, no storage, no filesystem at module level. The kernel for a node is
// supplied by the caller as `loadKernel(toolId) -> { compute } | null`, so the same library
// serves node tests, a later page and a later local command. A node-only loader is exported
// separately at the bottom (it imports node:fs lazily, only when called).
//
// The execution hash comes from executionHash() in kernels/_hash.mjs and nowhere else. The
// verdict classes come from the shared verdict reader in scripts/check-kernel-missing-input-failclosed.mjs.
//
// A result states that the output differs under the stated condition. It never says the old
// receipt was wrong; whether an older kernel was wrong is a kernel erratum's claim.

import { executionHash, jcsStringify } from './kernels/_hash.mjs';
import { readVerdict } from '../scripts/check-kernel-missing-input-failclosed.mjs';

export const STATES = Object.freeze({
  SAME: 'SAME',
  CHANGED_VERDICT: 'CHANGED-VERDICT',
  CHANGED_VALUE: 'CHANGED-VALUE',
  REFUSED: 'REFUSED',
  UNRESOLVED: 'UNRESOLVED',
  // Not a replay result: the file failed its own hash check or could not be read, so it takes no further part.
  TAMPERED_OR_MALFORMED: 'TAMPERED-OR-MALFORMED',
});

export const MODES = Object.freeze({ A: 'A', B: 'B', C: 'C' });
export const MAX_POINTERS = 20;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const HEX64 = /^[0-9a-f]{64}$/;

function bad(reason) {
  return { ok: false, state: STATES.TAMPERED_OR_MALFORMED, reason };
}

/**
 * Parse one receipt from JSON text or an already parsed value.
 * Accepts a bare artifact ({ tool_id, policy_parameters, output_payload, execution_hash })
 * or the same object under an `artifact` member (the export wrapper form).
 * @returns {{ok:true, receipt:object} | {ok:false, state:string, reason:string}}
 */
export function parseReceipt(input) {
  let doc = input;
  if (typeof input === 'string') {
    try { doc = JSON.parse(input); } catch (e) { return bad(`not valid JSON: ${e.message}`); }
  }
  if (isObj(doc) && !('execution_hash' in doc) && isObj(doc.artifact)) doc = doc.artifact;
  if (!isObj(doc)) return bad('top level is not a JSON object');
  if (typeof doc.tool_id !== 'string' || !doc.tool_id) return bad('missing tool_id');
  if (!isObj(doc.policy_parameters)) return bad('missing policy_parameters object');
  if (!isObj(doc.output_payload)) return bad('missing output_payload object');
  if (typeof doc.execution_hash !== 'string' || !HEX64.test(doc.execution_hash)) return bad('missing or malformed execution_hash');
  // tool_id becomes a module path in the node loader; refuse anything that is not a plain id.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(doc.tool_id)) return bad('tool_id is not a plain node id');
  return { ok: true, receipt: doc };
}

/**
 * Recompute the execution hash from the receipt's own parameters and payload.
 * @returns {{ok:true, hash:string} | {ok:false, state:string, reason:string}}
 */
export async function verifyReceipt(receipt) {
  let hash;
  try {
    hash = await executionHash(receipt.policy_parameters, receipt.output_payload);
  } catch (e) {
    return bad(`cannot canonicalize: ${e.message}`);
  }
  if (hash !== receipt.execution_hash) return bad('execution_hash does not match the receipt\'s own parameters and payload');
  return { ok: true, hash };
}

// ---- diff -------------------------------------------------------------------------------

const escPtr = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');

/** JSON pointers (RFC 6901) at which a and b differ, in sorted order. Leaves compared by canonical form. */
export function diffPointers(a, b, base = '', out = []) {
  if (jcsStringify(a) === jcsStringify(b)) return out;
  const bothArr = Array.isArray(a) && Array.isArray(b);
  if ((isObj(a) && isObj(b)) || bothArr) {
    const keys = bothArr
      ? Array.from({ length: Math.max(a.length, b.length) }, (_, i) => String(i))
      : [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) {
      const p = `${base}/${escPtr(k)}`;
      if (!(k in a) || !(k in b)) out.push(p);
      else diffPointers(a[k], b[k], p, out);
    }
    return out;
  }
  out.push(base === '' ? '' : base);
  return out;
}

/** Classify a stored payload against a fresh one. Pure. */
export function classifyDiff(oldPayload, newPayload) {
  if (jcsStringify(oldPayload) === jcsStringify(newPayload)) return { state: STATES.SAME, pointers: [] };
  const nv = readVerdict(newPayload);
  if (nv && nv.cls === 'refusal') {
    return { state: STATES.REFUSED, pointers: diffPointers(oldPayload, newPayload).slice(0, MAX_POINTERS), reason: `new run returned a refusal verdict (${nv.key}=${String(nv.value)})` };
  }
  const pointers = diffPointers(oldPayload, newPayload).slice(0, MAX_POINTERS);
  const ov = readVerdict(oldPayload);
  const classOf = (v) => (v ? v.cls : 'none');
  const verdictChanged = classOf(ov) !== classOf(nv)
    // Two verdict labels the reader has no class for (a grade like "F" against "B"): a different label is a different verdict.
    // A non-string member that happens to carry a verdict key name (a count called `pass`) is a value, not a verdict.
    || (ov && nv && ov.cls === 'unclassified' && typeof ov.value === 'string' && typeof nv.value === 'string' && ov.value !== nv.value)
    || (ov && nv && ov.key !== nv.key);
  return { state: verdictChanged ? STATES.CHANGED_VERDICT : STATES.CHANGED_VALUE, pointers };
}

// ---- running a kernel -------------------------------------------------------------------

const clone = (o) => JSON.parse(JSON.stringify(o));

const hasErr = (res) => isObj(res) && ((res.error !== undefined && res.error !== null && res.error !== false)
  || (Array.isArray(res.errors) ? res.errors.length > 0 : (res.errors !== undefined && res.errors !== null)));

/**
 * Run the kernel and normalise to { payload } or { refused, reason } or { unresolved, reason }. Never throws.
 * A kernel that exports buildArtifact() is run through it, because that is the path that mints a receipt
 * (it can add auxiliary digests and finish async checks that compute() alone does not). The builder must
 * take the receipt's policy_parameters as its input and return the same ones; if it does not (a private
 * witness node, or a page-summary form), the receipt cannot be re-run from its file and is UNRESOLVED.
 */
async function runKernel(kernel, pp) {
  try {
    if (typeof kernel.buildArtifact === 'function') {
      const art = await kernel.buildArtifact(clone(pp), { now: null });
      if (hasErr(art) && !isObj(art.output_payload)) return { refused: true, reason: `buildArtifact returned a structured error: ${String(art.error || JSON.stringify(art.errors)).slice(0, 120)}` };
      if (!isObj(art) || !isObj(art.output_payload) || !isObj(art.policy_parameters)) return { refused: true, reason: 'buildArtifact returned no artifact' };
      if (jcsStringify(art.policy_parameters) !== jcsStringify(pp)) {
        return { unresolved: true, reason: 'the node builds from inputs that are not in the receipt (private witness or page summary form)' };
      }
      return { payload: art.output_payload, pp: art.policy_parameters };
    }
    const res = await kernel.compute(clone(pp));
    if (hasErr(res)) return { refused: true, reason: `compute returned a structured error: ${String(res.error || JSON.stringify(res.errors)).slice(0, 120)}` };
    const payload = isObj(res) && 'output_payload' in res ? res.output_payload : res;
    if (!isObj(payload)) return { refused: true, reason: 'compute returned no output_payload object' };
    return { payload, pp };
  } catch (e) {
    return { refused: true, reason: `kernel threw: ${String((e && e.message) || e).slice(0, 120)}` };
  }
}

/** Set a value at an RFC 6901 pointer on a copy of obj. Refuses a pointer that does not already exist. */
export function applyEdit(obj, pointer, value) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) throw new Error(`edit pointer must start with "/": ${String(pointer)}`);
  const copy = clone(obj);
  const parts = pointer.slice(1).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = copy;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, parts[i])) throw new Error(`edit pointer not found: ${pointer}`);
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, last)) throw new Error(`edit pointer not found: ${pointer}`);
  cur[last] = value;
  return copy;
}

function row(receipt, extra) {
  return {
    node_id: receipt ? receipt.tool_id : null,
    receipt_kernel_digest: receipt && typeof receipt.kernel_digest === 'string' ? receipt.kernel_digest : null,
    old_execution_hash: receipt ? receipt.execution_hash : null,
    new_execution_hash: null,
    pointers: [],
    reason: null,
    ...extra,
  };
}

/**
 * Replay one parsed receipt.
 * @param {object} receipt   result of parseReceipt().receipt
 * @param {object} opts
 *   mode        'A' | 'B' | 'C'
 *   loadKernel  (toolId) => {compute}|null|Promise of either. Required.
 *   edits       mode C: array of { pointer, value } applied to policy_parameters
 *   digests     optional { [toolId]: currentDigest } map (kernel-digests.json shape) for the report
 */
export async function replayReceipt(receipt, opts = {}) {
  const mode = opts.mode || MODES.A;
  const digests = opts.digests || {};
  const current = typeof digests[receipt.tool_id] === 'string' ? digests[receipt.tool_id] : null;
  const base = (extra) => ({ ...row(receipt, extra), mode, current_kernel_digest: current });

  const v = await verifyReceipt(receipt);
  if (!v.ok) return base({ state: v.state, reason: v.reason });

  if (mode === MODES.B) {
    return base({ state: STATES.UNRESOLVED, reason: 'vintage mode is not available yet: no dated-fact table exists for this node' });
  }
  if (mode !== MODES.A && mode !== MODES.C) return base({ state: STATES.UNRESOLVED, reason: `unknown mode ${String(mode)}` });

  let kernel = null;
  try { kernel = typeof opts.loadKernel === 'function' ? await opts.loadKernel(receipt.tool_id) : null; } catch { kernel = null; }
  if (!kernel || (typeof kernel.compute !== 'function' && typeof kernel.buildArtifact !== 'function')) {
    return base({ state: STATES.UNRESOLVED, reason: 'node is not on this site' });
  }

  // A private-input node (OCG §25) builds from a witness that is not in the file; its verdict cannot be re-run here.
  if (kernel.meta && typeof kernel.meta.private_input_profile === 'string') {
    return base({ state: STATES.UNRESOLVED, reason: `private-input node (${kernel.meta.private_input_profile}): the witness is not in the receipt` });
  }

  let pp = receipt.policy_parameters;
  if (mode === MODES.C) {
    const edits = Array.isArray(opts.edits) ? opts.edits : [];
    if (edits.length === 0) return base({ state: STATES.UNRESOLVED, reason: 'mode C needs at least one edit' });
    try {
      for (const e of edits) pp = applyEdit(pp, e.pointer, e.value);
    } catch (e) {
      return base({ state: STATES.UNRESOLVED, reason: e.message });
    }
  }

  const ran = await runKernel(kernel, pp);
  if (ran.refused) return base({ state: STATES.REFUSED, reason: ran.reason });
  if (ran.unresolved) return base({ state: STATES.UNRESOLVED, reason: ran.reason });

  let newHash;
  try { newHash = await executionHash(pp, ran.payload); } catch (e) {
    return base({ state: STATES.REFUSED, reason: `new output cannot be canonicalized: ${e.message}` });
  }
  const c = classifyDiff(receipt.output_payload, ran.payload);
  let state = c.state;
  // Mode A states the identity claim: SAME means equal payloads AND equal hashes.
  if (mode === MODES.A && state === STATES.SAME && newHash !== receipt.execution_hash) {
    return base({ state: STATES.UNRESOLVED, new_execution_hash: newHash, reason: 'payloads are equal but hashes differ; the hash path is inconsistent' });
  }
  return base({ state, new_execution_hash: newHash, pointers: c.pointers, reason: c.reason || null });
}

/** Parse, then replay. Accepts JSON text or a value. Never throws. */
export async function replayFile(name, input, opts = {}) {
  const p = parseReceipt(input);
  if (!p.ok) return { file: name, mode: opts.mode || MODES.A, node_id: null, state: p.state, reason: p.reason, pointers: [], old_execution_hash: null, new_execution_hash: null, receipt_kernel_digest: null, current_kernel_digest: null };
  return { file: name, ...(await replayReceipt(p.receipt, opts)) };
}

/** Totals by result and by node for a list of rows. */
export function summarize(rows) {
  const byState = {};
  const byNode = {};
  for (const r of rows) {
    byState[r.state] = (byState[r.state] || 0) + 1;
    const n = r.node_id || '(unreadable)';
    byNode[n] = byNode[n] || {};
    byNode[n][r.state] = (byNode[n][r.state] || 0) + 1;
  }
  return { total: rows.length, byState, byNode };
}

// ---- node-only loader -------------------------------------------------------------------

/**
 * Loader for node/bun: imports <kernelsDir>/<toolId>.kernel.mjs. Returns null when the file is absent.
 * node:fs and node:url are imported on call, so the module itself stays free of node built-ins.
 */
export function nodeKernelLoader(kernelsDir) {
  const cache = new Map();
  return async (toolId) => {
    if (cache.has(toolId)) return cache.get(toolId);
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const p = join(kernelsDir, `${toolId}.kernel.mjs`);
    let mod = null;
    if (existsSync(p)) mod = await import(pathToFileURL(p).href);
    cache.set(toolId, mod);
    return mod;
  };
}
