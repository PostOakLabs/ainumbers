import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-832-card-data-flow-scope';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_card_data_flow_scope',
  mandate_type: 'compliance_control', gpu: false,
};

const KINDS = ['frontend', 'backend', 'logs', 'analytics', 'browser_automation_provider', 'psp', 'other'];
const FLAG_KEYS = ['sees_raw_pan', 'sees_token_only', 'stores', 'logs', 'records_sessions', 'unrestricted_connectivity_to_pan_component', 'could_impact_pan_security'];

function refuse(reason, detail) {
  // The flag is earned by a stated refusal reason (conditional emission, FLAGS-COMPUTED-LINT-1).
  const compliance_flags = [];
  if (reason) compliance_flags.push('INPUT_REFUSED');
  return {
    output_payload: { status: 'refused', reason, detail, warnings: compliance_flags.slice() },
    compliance_flags,
  };
}

/**
 * compute(pp) — worksheet over DECLARED inputs. Places each declared system node into one of four
 * sets and lists capture leaks. It never decides scope; it reads the flags it was given.
 * pp.components: [{ id, kind, sees_raw_pan, sees_token_only, stores, logs, records_sessions,
 *   unrestricted_connectivity_to_pan_component, could_impact_pan_security, captures_from: [id] }]
 */
export function compute(pp) {
  pp = pp || {};
  const comps = pp.components;
  if (!Array.isArray(comps) || comps.length === 0) return refuse('components_missing', 'components must be a non-empty array');
  const ids = [];
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    if (c == null || typeof c !== 'object') return refuse('component_invalid', 'component ' + i + ' is not an object');
    if (typeof c.id !== 'string' || c.id === '') return refuse('component_id_invalid', 'component ' + i + ' has no id');
    if (ids.indexOf(c.id) !== -1) return refuse('component_id_duplicate', c.id);
    if (KINDS.indexOf(c.kind) === -1) return refuse('component_kind_invalid', c.id);
    for (let k = 0; k < FLAG_KEYS.length; k++) {
      const v = c[FLAG_KEYS[k]];
      if (v != null && typeof v !== 'boolean') return refuse('component_flag_invalid', c.id + '.' + FLAG_KEYS[k]);
    }
    if (c.captures_from != null && !Array.isArray(c.captures_from)) return refuse('captures_from_invalid', c.id);
    const keys = Object.keys(c);
    for (let k = 0; k < keys.length; k++) {
      if (keys[k] !== 'id' && keys[k] !== 'kind' && keys[k] !== 'captures_from' && FLAG_KEYS.indexOf(keys[k]) === -1) {
        return refuse('component_field_unknown', c.id + '.' + keys[k]);
      }
    }
    ids.push(c.id);
  }
  for (let i = 0; i < comps.length; i++) {
    const cf = comps[i].captures_from == null ? [] : comps[i].captures_from;
    for (let j = 0; j < cf.length; j++) {
      if (ids.indexOf(cf[j]) === -1) return refuse('captures_from_unknown_id', comps[i].id + ' -> ' + (cf[j] !== null && typeof cf[j] === 'object' ? '[' + (Array.isArray(cf[j]) ? 'array' : 'object') + ']' : String(cf[j])));
    }
  }

  const byId = {};
  for (let i = 0; i < comps.length; i++) byId[comps[i].id] = comps[i];

  const cde = [];
  const connected_to = [];
  const security_impacting = [];
  const unplaced = [];
  const capture_leaks = [];
  const stores_pan = [];
  const conflicts = [];
  const token_only_with_path = [];

  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const raw = c.sees_raw_pan === true;
    const tok = c.sees_token_only === true;
    if (raw && tok) conflicts.push(c.id);
    if (raw) {
      cde.push(c.id);
      if (c.stores === true) stores_pan.push(c.id);
      if (c.logs === true) capture_leaks.push({ component: c.id, channel: 'logs', via: 'declared_raw_pan_view' });
      if (c.records_sessions === true) capture_leaks.push({ component: c.id, channel: 'session_recording', via: 'declared_raw_pan_view' });
    }
    const cf = (c.captures_from == null ? [] : c.captures_from).filter((v, idx, arr) => arr.indexOf(v) === idx);
    for (let j = 0; j < cf.length; j++) {
      const src = byId[cf[j]];
      if (src.sees_raw_pan === true) {
        if (c.stores === true) {
          if (stores_pan.indexOf(c.id) === -1) stores_pan.push(c.id);
          capture_leaks.push({ component: c.id, channel: 'storage', via: 'captures_from:' + src.id });
        }
        if (c.logs === true) capture_leaks.push({ component: c.id, channel: 'logs', via: 'captures_from:' + src.id });
        if (c.records_sessions === true) capture_leaks.push({ component: c.id, channel: 'session_recording', via: 'captures_from:' + src.id });
        if (c.logs !== true && c.records_sessions !== true && c.kind === 'analytics') capture_leaks.push({ component: c.id, channel: 'analytics_capture', via: 'captures_from:' + src.id });
      }
    }
  }
  const cdeSet = {};
  for (let i = 0; i < cde.length; i++) cdeSet[cde[i]] = true;
  // A component that captures from a raw-PAN view and holds the capture is itself a PAN-handling placement.
  for (let i = 0; i < capture_leaks.length; i++) {
    if (!cdeSet[capture_leaks[i].component]) { cdeSet[capture_leaks[i].component] = true; cde.push(capture_leaks[i].component); }
  }
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    if (cdeSet[c.id]) continue;
    if (c.unrestricted_connectivity_to_pan_component === true) connected_to.push(c.id);
    else if (c.could_impact_pan_security === true) security_impacting.push(c.id);
    else unplaced.push(c.id);
    if (c.sees_token_only === true && c.sees_raw_pan !== true &&
        (c.unrestricted_connectivity_to_pan_component === true || c.could_impact_pan_security === true)) token_only_with_path.push(c.id);
  }

  const compliance_flags = [];
  const hasChannel = (ch) => capture_leaks.some((l) => l.channel === ch);
  if (hasChannel('logs')) compliance_flags.push('CAPTURE_LEAK_LOGS');
  if (hasChannel('session_recording')) compliance_flags.push('CAPTURE_LEAK_SESSION_RECORDING');
  if (hasChannel('analytics_capture')) compliance_flags.push('CAPTURE_LEAK_ANALYTICS');
  if (stores_pan.length > 0) compliance_flags.push('PAN_STORAGE_DECLARED');
  if (conflicts.length > 0) compliance_flags.push('INPUT_CONFLICT_RAW_AND_TOKEN_ONLY');
  if (token_only_with_path.length > 0) compliance_flags.push('TOKEN_ONLY_COMPONENT_WITH_DECLARED_PATH');
  const warnings = compliance_flags.slice();

  return {
    output_payload: {
      status: 'worksheet',
      stores_processes_transmits_placed: cde,
      unrestricted_connectivity_placed: connected_to,
      security_impacting_placed: security_impacting,
      not_placed_by_declared_inputs: unplaced,
      capture_leaks,
      pan_storage_declared: stores_pan,
      input_conflicts: conflicts,
      token_only_with_declared_path: token_only_with_path,
      segmentation_adequacy_evaluated: false,
      warnings,
    },
    compliance_flags,
  };
}

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes _hash.mjs assertIJson() refuses before canonicalizing: a non-finite
// number or an integer outside the 2^53 safe range, nesting past its MAX_DEPTH, more values
// than its MAX_ELEMENTS. Reports { reason, detail } with the path and kind only, never the
// value; null when the subtree is safe to hash. The shared _hash.mjs stays untouched.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // The object walked below is the exact execution_hash preimage. When the shared
  // canonicalizer would refuse it, mint the artifact with a null execution_hash and the
  // reason beside it instead of letting the hash throw (D6): buildArtifact never throws.
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const hash = unhashable === null ? await executionHash(pp, output_payload) : null;
  const artifact = {
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
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
