// OpenChainGraph shared decision-gate evaluator (OCG Standard §21.4+).
// SINGLE SOURCE OF TRUTH for gate evaluation — imported by the Worker
// run_chain (mcp-apps-poc/worker.mjs), the embedded runChain
// (mcp-apps-poc/embed/runChain.mjs, via its byte-identical lib/ copy), and any
// other executing surface. Vendored by generate.mjs (worker) + embed/vendor.mjs
// (embed) so the runtimes can never drift; byte-parity is CI-gated.
//
// PURE ECMA-262: no Date, no Math.random, no locale/Intl, no crypto, no I/O.
// Deterministic and total — every gate resolves to exactly one `next` (a step
// id or the literal "end"), so an agent runs a gated chain end-to-end with no
// human in the loop. Comparisons are STRICT (no type coercion): a value op on a
// type-mismatched or absent operand yields no-match and falls through to the
// mandatory `default` (existence is tested only with present/absent). Numeric
// ops require FINITE numbers on both sides (the kernel finite-gate guarantees
// kernel outputs are finite; a non-finite operand simply does not match).
//
// The evaluator is graph-agnostic: acyclicity / forward-only targets / no
// unreachable step are STATIC properties enforced by validate-chains (§15),
// not here. This module only answers "given this step's output_payload, which
// rule fires and where does control go next".

// Closed op enum (OCG §21.4). No other operator is valid.
export const GATE_OPS = Object.freeze(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'present', 'absent']);
const OP_SET = new Set(GATE_OPS);
// Ops that carry a comparison `value` (present/absent do not).
export const VALUE_OPS = Object.freeze(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in']);
const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte']);

const isFiniteNum = (x) => typeof x === 'number' && Number.isFinite(x);

// Structural strict equality (no coercion). Used by eq/neq/in.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

// A valid RFC 6901 JSON Pointer is "" (whole document) or a string of "/"-
// prefixed tokens. Escapes: ~1 -> "/", ~0 -> "~"; a "~" not part of ~0/~1 is
// invalid. Syntax-only (does not resolve). Exported for validate-chains.
export function isPointerSyntaxValid(pointer) {
  if (typeof pointer !== 'string') return false;
  if (pointer === '') return true;
  if (pointer[0] !== '/') return false;
  // Every "~" must be immediately followed by "0" or "1".
  return !/~(?![01])/.test(pointer);
}

// Resolve an RFC 6901 pointer against a document.
// Returns { found, value }. found=false when any token is missing / out of
// range / the pointer is syntactically invalid.
export function rfc6901(doc, pointer) {
  if (!isPointerSyntaxValid(pointer)) return { found: false, value: undefined };
  if (pointer === '') return { found: true, value: doc };
  const tokens = pointer.slice(1).split('/').map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = doc;
  for (const tok of tokens) {
    if (cur === null || typeof cur !== 'object') return { found: false, value: undefined };
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9][0-9]*)$/.test(tok)) return { found: false, value: undefined };
      const idx = Number(tok);
      if (idx >= cur.length) return { found: false, value: undefined };
      cur = cur[idx];
    } else {
      if (!Object.prototype.hasOwnProperty.call(cur, tok)) return { found: false, value: undefined };
      cur = cur[tok];
    }
  }
  return { found: true, value: cur };
}

// Apply one op. `found` = pointer resolved; `observed` = resolved value.
// Value ops (all but present/absent) require found=true, else no-match.
export function applyOp(op, found, observed, value) {
  switch (op) {
    case 'present': return found;
    case 'absent': return !found;
    case 'eq': return found && deepEqual(observed, value);
    case 'neq': return found && !deepEqual(observed, value);
    case 'gt': return found && isFiniteNum(observed) && isFiniteNum(value) && observed > value;
    case 'gte': return found && isFiniteNum(observed) && isFiniteNum(value) && observed >= value;
    case 'lt': return found && isFiniteNum(observed) && isFiniteNum(value) && observed < value;
    case 'lte': return found && isFiniteNum(observed) && isFiniteNum(value) && observed <= value;
    case 'in': return found && Array.isArray(value) && value.some((v) => deepEqual(observed, v));
    default: return false; // unknown op never matches (validate-chains rejects it statically)
  }
}

export function isValidOp(op) { return OP_SET.has(op); }

/**
 * Evaluate a gate against THIS step's output_payload.
 * @param {{input:string, rules:Array<{op:string,value?:any,next:string}>, default:string}} gate
 * @param {object} outputPayload
 * @returns {{input_pointer:string, observed_value:any, matched_rule_index:number|null, op:string|null, value:any, next:string}}
 *   A decision record (minus step_id, which the caller merges in). Deterministic
 *   and recomputable by a verifier from the recorded outputPayload.
 */
export function evaluateGate(gate, outputPayload) {
  const { found, value: observed } = rfc6901(outputPayload, gate.input);
  const observed_value = found ? observed : null;
  const rules = Array.isArray(gate.rules) ? gate.rules : [];
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (applyOp(r.op, found, observed, r.value)) {
      return {
        input_pointer: gate.input,
        observed_value,
        matched_rule_index: i,
        op: r.op,
        value: VALUE_OPS.includes(r.op) ? (r.value === undefined ? null : r.value) : null,
        next: r.next,
      };
    }
  }
  // First-match failed for every rule → mandatory default (total function).
  return {
    input_pointer: gate.input,
    observed_value,
    matched_rule_index: null,
    op: null,
    value: null,
    next: gate.default,
  };
}

// Canonical step identifier: explicit `id`, else the step's tool_id (OCG §21.4).
export function stepId(step, index) {
  return (step && typeof step.id === 'string' && step.id.length) ? step.id : step.tool_id;
}
