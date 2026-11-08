import { executionHash } from './_hash.mjs';

// art-819-ucp-request-constraints: check a pasted UCP request against a pasted set of
// `ucp.request_constraints` values (UCP 2026-08-25, spec tag v2026-08-25, commit
// 87dd4b1fcff9105d68173120897237fa784c74ef; Apache-2.0, UCP Authors). Verify-only: the caller pastes
// both documents, the kernel makes no network call and never fetches a profile or a key.
//
// DETERMINISM: compute() is a pure function of pp. It runs unmodified inside the QuickJS-ng zkVM
// guest, so it uses no TextEncoder, URL, atob/btoa, Date or Math.random.

const TOOL_ID = 'art-819-ucp-request-constraints';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'eval_ucp_request_constraints',
  mandate_type: 'compliance_control', gpu: false,
};

// Resource bounds. Anything over a bound returns INDETERMINATE, never a guess.
const MAX_NODES = 20000;       // JSON nodes across request + constraints
const MAX_DEPTH = 64;          // JSON nesting depth of any input
const MAX_EXPR_DEPTH = 16;     // nesting of one constraint expression
const MAX_VALUES = 64;         // request_constraints values in one set
const MAX_PATH_LEN = 512;      // characters in one path string
const MAX_SELECTED = 1024;     // objects one path may select
const MAX_VIOLATIONS = 200;    // violations listed before truncation

const SPEC_BASIS = 'UCP 2026-08-25 overview, Request Constraints (tag v2026-08-25, commit 87dd4b1fcff9105d68173120897237fa784c74ef)';
const SCOPE_NOTE = 'Verify-only preflight. Both documents are caller-pasted; no profile, key or merchant endpoint is fetched. SATISFIED covers only the constraint values this node could evaluate and says nothing about the resolved request schema or Business runtime rules. Path support is a subset of RFC 9535 (root, child member, index, wildcard, equality filters joined by &&); anything else is INDETERMINATE with UNSUPPORTED_PATH. Instances that are not objects satisfy required and properties vacuously, as in JSON Schema.';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (!hasOwn(b, ka[i]) || !deepEqual(a[ka[i]], b[ka[i]])) return false;
  }
  return true;
}

// Iterative size/depth walk so a hostile input cannot blow the stack or the budget.
function measure(root, budget) {
  const stack = [[root, 1]];
  while (stack.length) {
    const [v, d] = stack.pop();
    budget.nodes++;
    if (budget.nodes > MAX_NODES) return 'INPUT_BOUND_EXCEEDED';
    if (d > MAX_DEPTH) return 'DEPTH_EXCEEDED';
    if (v !== null && typeof v === 'object') {
      const kids = Array.isArray(v) ? v : Object.keys(v).map((k) => v[k]);
      for (let i = 0; i < kids.length; i++) stack.push([kids[i], d + 1]);
    }
  }
  return null;
}

// ── RFC 9535 subset ──────────────────────────────────────────────────────────────────────────
function quoteName(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const code = s.charCodeAt(i);
    if (c === '\\') out += '\\\\';
    else if (c === "'") out += "\\'";
    else if (c === '\b') out += '\\b';
    else if (c === '\f') out += '\\f';
    else if (c === '\n') out += '\\n';
    else if (c === '\r') out += '\\r';
    else if (c === '\t') out += '\\t';
    else if (code < 0x20) out += '\\u00' + (code < 16 ? '0' : '') + code.toString(16);
    else out += c;
  }
  return "'" + out + "'";
}
const childName = (p, k) => p + '[' + quoteName(k) + ']';
const childIndex = (p, i) => p + '[' + i + ']';

const NAME_FIRST = /^[A-Za-z_]$/;
const NAME_REST = /^[A-Za-z0-9_]$/;
const NUMBER_RE = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/;

function parsePath(src) {
  if (typeof src !== 'string' || src.length === 0 || src.length > MAX_PATH_LEN || src[0] !== '$') return null;
  let i = 1;
  const segs = [];
  const skipWs = () => { while (i < src.length && (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r')) i++; };
  const readString = () => {
    const q = src[i];
    if (q !== "'" && q !== '"') return null;
    i++;
    let out = '';
    while (i < src.length && src[i] !== q) {
      const c = src[i];
      if (c.charCodeAt(0) < 0x20) return null;
      if (c === '\\') {
        const n = src[i + 1];
        if (n === '\\' || n === q || n === '/') out += n;
        else return null; // other escapes are outside the supported subset
        i += 2;
      } else { out += c; i++; }
    }
    if (src[i] !== q) return null;
    i++;
    return out;
  };
  const readLiteral = () => {
    if (src[i] === "'" || src[i] === '"') { const s = readString(); return s === null ? undefined : s; }
    const rest = src.slice(i);
    const word = (w) => rest.startsWith(w) && !(rest[w.length] && NAME_REST.test(rest[w.length]));
    if (word('true')) { i += 4; return true; }
    if (word('false')) { i += 5; return false; }
    if (word('null')) { i += 4; return null; }
    const m = NUMBER_RE.exec(rest);
    if (!m) return undefined;
    i += m[0].length;
    return Number(m[0]);
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '.') {
      if (src[i + 1] === '.') return null; // recursive descent
      if (src[i + 1] === '*') { segs.push({ k: 'wild' }); i += 2; continue; }
      if (!NAME_FIRST.test(src[i + 1] || '')) return null;
      let j = i + 2;
      while (j < src.length && NAME_REST.test(src[j])) j++;
      segs.push({ k: 'name', v: src.slice(i + 1, j) });
      i = j;
    } else if (c === '[') {
      i++;
      skipWs();
      const d = src[i];
      if (d === "'" || d === '"') {
        const s = readString();
        if (s === null) return null;
        skipWs();
        if (src[i] !== ']') return null;
        i++;
        segs.push({ k: 'name', v: s });
      } else if (d === '*') {
        i++; skipWs();
        if (src[i] !== ']') return null;
        i++;
        segs.push({ k: 'wild' });
      } else if (d === '?') {
        i++;
        const conds = [];
        for (;;) {
          skipWs();
          if (src[i] !== '@') return null;
          i++;
          let name;
          if (src[i] === '[') {
            i++; skipWs();
            name = readString();
            if (name === null) return null;
            skipWs();
            if (src[i] !== ']') return null;
            i++;
          } else if (src[i] === '.' && NAME_FIRST.test(src[i + 1] || '')) {
            let j = i + 2;
            while (j < src.length && NAME_REST.test(src[j])) j++;
            name = src.slice(i + 1, j);
            i = j;
          } else return null;
          skipWs();
          if (src[i] !== '=' || src[i + 1] !== '=') return null;
          i += 2;
          skipWs();
          const lit = readLiteral();
          if (lit === undefined) return null;
          conds.push({ name, lit });
          skipWs();
          if (src[i] === '&' && src[i + 1] === '&') { i += 2; continue; }
          break;
        }
        if (src[i] !== ']') return null;
        i++;
        segs.push({ k: 'filter', conds });
      } else if (d === '-' || (d >= '0' && d <= '9')) {
        let j = i;
        if (src[j] === '-') j++;
        const s = j;
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
        const digits = src.slice(s, j);
        if (digits.length === 0 || (digits.length > 1 && digits[0] === '0') || (src[i] === '-' && digits === '0')) return null;
        const n = Number(src.slice(i, j));
        if (!Number.isSafeInteger(n)) return null;
        i = j;
        skipWs();
        if (src[i] !== ']') return null; // slice or union: outside the subset
        i++;
        segs.push({ k: 'index', v: n });
      } else return null;
    } else return null;
  }
  return segs;
}

function childrenOf(node) {
  const v = node.v;
  if (Array.isArray(v)) return v.map((c, i) => ({ v: c, p: childIndex(node.p, i) }));
  if (isObj(v)) return Object.keys(v).map((k) => ({ v: v[k], p: childName(node.p, k) }));
  return [];
}

// returns { nodes } or { code }
function selectPath(segs, root) {
  let nodes = [{ v: root, p: '$' }];
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const next = [];
    for (let n = 0; n < nodes.length; n++) {
      const node = nodes[n];
      if (seg.k === 'name') {
        if (isObj(node.v) && hasOwn(node.v, seg.v)) next.push({ v: node.v[seg.v], p: childName(node.p, seg.v) });
      } else if (seg.k === 'index') {
        if (Array.isArray(node.v)) {
          const idx = seg.v < 0 ? node.v.length + seg.v : seg.v;
          if (idx >= 0 && idx < node.v.length) next.push({ v: node.v[idx], p: childIndex(node.p, idx) });
        }
      } else if (seg.k === 'wild') {
        const kids = childrenOf(node);
        for (let c = 0; c < kids.length; c++) next.push(kids[c]);
      } else {
        const kids = childrenOf(node);
        for (let c = 0; c < kids.length; c++) {
          const kv = kids[c].v;
          let ok = isObj(kv);
          for (let q = 0; ok && q < seg.conds.length; q++) {
            const cond = seg.conds[q];
            ok = hasOwn(kv, cond.name) && kv[cond.name] === cond.lit;
          }
          if (ok) next.push(kids[c]);
        }
      }
      if (next.length > MAX_SELECTED) return { code: 'INPUT_BOUND_EXCEEDED' };
    }
    nodes = next;
  }
  return { nodes };
}

// ── constraint grammar ───────────────────────────────────────────────────────────────────────
const VALUE_KEYS = ['enum', 'const'];
const isValueConstraint = (c) => isObj(c) && (hasOwn(c, 'enum') || hasOwn(c, 'const'));

function uniqueValues(arr) {
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (deepEqual(arr[i], arr[j])) return false;
  return true;
}

// returns null when the expression conforms to the closed grammar, else a short reason
function checkExpression(c, outer, depth) {
  if (!isObj(c)) return 'constraint is not an object';
  if (depth > MAX_EXPR_DEPTH) return 'constraint nesting exceeds the bound';
  const keys = Object.keys(c);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!(k === 'required' || k === 'properties' || k === 'anyOf' || (outer && k === 'path'))) return 'member "' + k + '" is not admitted';
  }
  if (hasOwn(c, 'path') && typeof c.path !== 'string') return 'path is not a string';
  if (hasOwn(c, 'required')) {
    const r = c.required;
    if (!Array.isArray(r) || r.length === 0) return 'required must be a non-empty array';
    for (let i = 0; i < r.length; i++) if (typeof r[i] !== 'string') return 'required entries must be strings';
    if (!uniqueValues(r)) return 'required entries must be unique';
  }
  if (hasOwn(c, 'properties')) {
    const p = c.properties;
    if (!isObj(p) || Object.keys(p).length === 0) return 'properties must be a non-empty object';
    const pk = Object.keys(p);
    for (let i = 0; i < pk.length; i++) {
      const sub = p[pk[i]];
      if (!isObj(sub)) return 'property constraint for "' + pk[i] + '" is not an object';
      if (isValueConstraint(sub)) {
        const sk = Object.keys(sub);
        for (let j = 0; j < sk.length; j++) if (VALUE_KEYS.indexOf(sk[j]) === -1) return 'value constraint for "' + pk[i] + '" carries "' + sk[j] + '"';
        if (hasOwn(sub, 'enum') && (!Array.isArray(sub.enum) || sub.enum.length === 0 || !uniqueValues(sub.enum))) return 'enum for "' + pk[i] + '" must be a non-empty array of unique values';
      } else {
        const why = checkExpression(sub, false, depth + 1);
        if (why) return why;
      }
    }
  }
  if (hasOwn(c, 'anyOf')) {
    const a = c.anyOf;
    if (!Array.isArray(a) || a.length === 0) return 'anyOf must be a non-empty array';
    for (let i = 0; i < a.length; i++) {
      if (!isObj(a[i]) || Object.keys(a[i]).length === 0) return 'anyOf branch ' + i + ' must be a non-empty object constraint';
      const why = checkExpression(a[i], false, depth + 1);
      if (why) return why;
    }
  }
  return null;
}

// Evaluate an Object Constraint against an instance; pushes violations onto out.
function evalObject(c, inst, path, out) {
  if (isObj(inst)) {
    if (hasOwn(c, 'required')) {
      for (let i = 0; i < c.required.length; i++) {
        if (!hasOwn(inst, c.required[i])) out.push({ path: childName(path, c.required[i]), code: 'REQUIRED_MISSING', reason: 'required member "' + c.required[i] + '" is absent' });
      }
    }
    if (hasOwn(c, 'properties')) {
      const pk = Object.keys(c.properties);
      for (let i = 0; i < pk.length; i++) {
        if (!hasOwn(inst, pk[i])) continue; // properties constrain a member only when it is present
        const sub = c.properties[pk[i]];
        const mp = childName(path, pk[i]);
        if (isValueConstraint(sub)) evalValue(sub, inst[pk[i]], mp, out);
        else evalObject(sub, inst[pk[i]], mp, out);
      }
    }
  }
  if (hasOwn(c, 'anyOf')) {
    const firsts = [];
    let matched = false;
    for (let b = 0; b < c.anyOf.length && !matched; b++) {
      const tmp = [];
      evalObject(c.anyOf[b], inst, path, tmp);
      if (tmp.length === 0) matched = true;
      else firsts.push('branch ' + b + ': ' + tmp[0].reason);
    }
    if (!matched) out.push({ path, code: 'ANYOF_NO_BRANCH_MATCH', reason: 'no anyOf branch is satisfied (' + firsts.join('; ') + ')' });
  }
}

function evalValue(vc, v, path, out) {
  if (hasOwn(vc, 'const') && !deepEqual(vc.const, v)) out.push({ path, code: 'CONST_MISMATCH', reason: 'value differs from the required const' });
  if (hasOwn(vc, 'enum')) {
    let hit = false;
    for (let i = 0; i < vc.enum.length && !hit; i++) hit = deepEqual(vc.enum[i], v);
    if (!hit) out.push({ path, code: 'ENUM_MISMATCH', reason: 'value is not one of the enum members' });
  }
}

// Value-pins reachable without crossing an anyOf: { 'a/b': [candidate set] } merged into pins.
function collectPins(c, prefix, pins) {
  if (!hasOwn(c, 'properties')) return;
  const pk = Object.keys(c.properties);
  for (let i = 0; i < pk.length; i++) {
    const sub = c.properties[pk[i]];
    const key = prefix + '/' + pk[i];
    if (isValueConstraint(sub)) {
      const list = hasOwn(pins, key) ? pins[key] : (pins[key] = { set: null });
      if (hasOwn(sub, 'const')) list.set = list.set === null ? [sub.const] : list.set.filter((x) => deepEqual(x, sub.const));
      if (hasOwn(sub, 'enum')) list.set = list.set === null ? sub.enum.slice() : list.set.filter((x) => sub.enum.some((y) => deepEqual(x, y)));
    } else collectPins(sub, key, pins);
  }
}

function contradictions(values, selections) {
  // group value indexes by every object they select (and each value alone, for a static check)
  const groups = [];
  const find = (key) => { for (let g = 0; g < groups.length; g++) if (groups[g].key === key) return groups[g]; const ng = { key, idx: [] }; groups.push(ng); return ng; };
  for (let i = 0; i < values.length; i++) {
    find('static:' + i).idx.push(i);
    for (let s = 0; s < selections[i].length; s++) find('obj:' + selections[i][s]).idx.push(i);
  }
  const found = [];
  for (let g = 0; g < groups.length; g++) {
    const pins = {};
    for (let n = 0; n < groups[g].idx.length; n++) collectPins(values[groups[g].idx[n]], '', pins);
    const keys = Object.keys(pins);
    for (let k = 0; k < keys.length; k++) {
      if (pins[keys[k]].set !== null && pins[keys[k]].set.length === 0) {
        found.push({ object: groups[g].key.startsWith('obj:') ? groups[g].key.slice(4) : null, member: keys[k], constraints: groups[g].idx.slice() });
      }
    }
  }
  // de-duplicate (a single-value contradiction also shows up under its selected object)
  const out = [];
  for (let f = 0; f < found.length; f++) {
    let dup = false;
    for (let o = 0; o < out.length && !dup; o++) dup = out[o].member === found[f].member && deepEqual(out[o].constraints, found[f].constraints);
    if (!dup) out.push(found[f]);
  }
  return out;
}

function result(payload, refusal) {
  const compliance_flags = refusal ? ['INPUT_REFUSED'] : [];
  // flag mirror: `warnings` is non-empty exactly when a conditional flag is raised
  return { output_payload: Object.assign({}, payload, { warnings: compliance_flags.slice() }), compliance_flags };
}

function shell(verdict, extra) {
  return Object.assign({
    verdict,
    evaluated_count: 0,
    skipped_count: 0,
    violations: [],
    indeterminate: [],
    contradictions: [],
    truncated: false,
    refusal: null,
    notes: [],
    spec_basis: SPEC_BASIS,
    scope_note: SCOPE_NOTE,
  }, extra || {});
}

/**
 * compute(pp): pure decision kernel.
 * pp = {
 *   request: object,                       the UCP request the Platform is about to send
 *   constraints: [                         the ucp.request_constraints values from the last authoritative response
 *     { request_constraints: object, ambient_path?: string }   ambient_path = Normalized Path of the object
 *   ]                                      that held `ucp` (default "$"); used only when the value omits `path`
 * }
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const set = pp.constraints;
  if (set === undefined || set === null || (Array.isArray(set) && set.length === 0)) {
    return result(shell('SATISFIED', { notes: ['NOT_EVALUATED: no request_constraints supplied, nothing to check'] }), false);
  }
  if (!Array.isArray(set)) return result(shell('INDETERMINATE', { refusal: 'CONSTRAINTS_NOT_ARRAY' }), true);
  if (!isObj(pp.request)) return result(shell('INDETERMINATE', { refusal: 'REQUEST_NOT_OBJECT' }), true);

  const budget = { nodes: 0 };
  let bound = set.length > MAX_VALUES ? 'INPUT_BOUND_EXCEEDED' : null;
  bound = bound || measure(pp.request, budget) || measure(set, budget);
  if (bound) return result(shell('INDETERMINATE', { indeterminate: [{ constraint_index: null, code: bound, reason: 'input exceeds a resource bound; nothing was evaluated' }] }), false);

  const values = [];       // grammar-clean expressions, aligned with `selections`
  const selections = [];   // normalized paths of the objects each clean value selects
  const indeterminate = [];
  const violations = [];
  let evaluated = 0;
  let truncated = false;

  for (let i = 0; i < set.length; i++) {
    const entry = set[i];
    const rc = isObj(entry) ? entry.request_constraints : undefined;
    const skip = (code, reason) => indeterminate.push({ constraint_index: i, code, reason });
    if (!isObj(rc)) { skip('CONSTRAINT_MALFORMED', 'request_constraints is missing or not an object'); continue; }
    const why = checkExpression(rc, true, 1);
    if (why) { skip('CONSTRAINT_MALFORMED', why); continue; }

    const effective = hasOwn(rc, 'path') ? rc.path : (typeof entry.ambient_path === 'string' ? entry.ambient_path : '$');
    const segs = parsePath(effective);
    if (!segs) { skip('UNSUPPORTED_PATH', 'path is not in the supported RFC 9535 subset'); continue; }
    const sel = selectPath(segs, pp.request);
    if (sel.code) { skip(sel.code, 'path selects more objects than the bound allows'); continue; }
    let allObjects = true;
    for (let n = 0; n < sel.nodes.length; n++) if (!isObj(sel.nodes[n].v)) allObjects = false;
    if (!allObjects) { skip('PATH_SELECTS_NON_OBJECT', 'path selects a value that is not an object'); continue; }

    values.push(rc);
    selections.push(sel.nodes.map((n) => n.p));
    evaluated++;
    for (let n = 0; n < sel.nodes.length; n++) {
      const found = [];
      evalObject(rc, sel.nodes[n].v, sel.nodes[n].p, found);
      for (let f = 0; f < found.length; f++) {
        if (violations.length >= MAX_VIOLATIONS) { truncated = true; break; }
        violations.push({ constraint_index: i, path: found[f].path, code: found[f].code, reason: found[f].reason });
      }
    }
  }

  const contra = contradictions(values, selections);
  let verdict;
  if (contra.length) verdict = 'INDETERMINATE';
  else if (violations.length) verdict = 'VIOLATED';
  else if (indeterminate.length) verdict = 'INDETERMINATE';
  else verdict = 'SATISFIED';

  const contradictionRows = contra.map((c) => ({
    code: 'CONSTRAINT_CONTRADICTION',
    object: c.object,
    member: c.member,
    reason: 'the const/enum constraints on this member cannot all be satisfied; this is an authoring error in the constraint set',
  }));

  return result(shell(verdict, {
    evaluated_count: evaluated,
    skipped_count: indeterminate.length,
    violations,
    indeterminate,
    contradictions: contradictionRows,
    truncated,
    notes: ['skipped values are unavailable for preflight, not a pass and not a failure (spec, Platform guidelines)'],
  }), false);
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
