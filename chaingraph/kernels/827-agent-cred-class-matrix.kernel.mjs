import { executionHash } from './_hash.mjs';

// 827-agent-cred-class-matrix -- agent credential class matrix (AGENT-CRED-CLASS-MATRIX-1-RESUME-1).
//
// One row per agent payment-credential class, five columns: scope, expiry, replay_protection,
// revocability, what-the-agent-can-learn. Scope/expiry/replay cells are CHAINED to the sibling
// node that already covers that class (closed per-column source sets below) or, for the two
// classes no sibling covers, LOCAL FACTS from a closed per-class vocabulary. Revocability and
// learn are local columns for every class; the caller declares the facts, the kernel validates
// vocabulary and completeness. Refused branches never throw: they raise a flag in
// compliance_flags and mirror it into output_payload.manual_review_required (flag-mirror doctrine).
// LOCAL_FACT_UNPINNED fires when a declared local fact is the honest "no pinned fact" marker, so
// an unpinned cell can never masquerade as evidence.
//
// BEHAVIOUR ONLY (KERNEL-CITATION-CLASS-1): every pinned fact behind the vocabularies and chain
// sets is registered in the clause-snapshot registry and cited from the node shard metadata and
// the node page, never from this file.
//
// DETERMINISM + GUEST SAFETY: compute() is a pure function of pp -- no Date.now()/Math.random(),
// no network, no filesystem, no guest-absent builtins (no TextEncoder/atob/btoa/URL).

const TOOL_ID = '827-agent-cred-class-matrix';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_agent_cred_matrix',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ---------- closed vocabularies ----------
export const CLASSES = Object.freeze([
  'shared_payment_token',
  'network_agent_token',
  'api_key_card_proxy',
  'x402_permit',
  'wallet_session_key',
]);
export const COLUMNS = Object.freeze(['scope', 'expiry', 'replay_protection']);
export const CHAINED_CLASSES = Object.freeze(['shared_payment_token', 'network_agent_token', 'x402_permit']);
export const LOCAL_CLASSES = Object.freeze(['api_key_card_proxy', 'wallet_session_key']);

// Chain sources per class and column: the sibling node whose verdict that cell chains to.
// shared_payment_token / network_agent_token chain to tool nodes that ship manifests but no
// graph shard; their ids are still the caller-facing citation handles and the page maps them
// to tool-page URLs. The x402 chain sources are graph nodes.
export const CHAIN_SOURCES = Object.freeze({
  shared_payment_token: Object.freeze({
    scope: Object.freeze(['acp-checkout-shared-payment-token-linter']),
    expiry: Object.freeze(['acp-checkout-shared-payment-token-linter']),
    replay_protection: Object.freeze(['acp-checkout-shared-payment-token-linter']),
  }),
  network_agent_token: Object.freeze({
    scope: Object.freeze(['visa-vic-agent-token-scope-builder', 'mastercard-agentic-token-builder']),
    expiry: Object.freeze(['visa-vic-agent-token-scope-builder', 'mastercard-agentic-token-builder']),
    replay_protection: Object.freeze(['visa-vic-agent-token-scope-builder', 'mastercard-agentic-token-builder']),
  }),
  x402_permit: Object.freeze({
    scope: Object.freeze(['art-385-agent-token-scope-checker']),
    expiry: Object.freeze(['art-703-mandate-authorization-gate', 'art-699-x402-permit2-evidence-recomputer']),
    replay_protection: Object.freeze(['art-699-x402-permit2-evidence-recomputer']),
  }),
});

// Local fact vocabularies for the two uncovered classes. A value listed here traces to a
// registered clause snapshot; 'unpinned_in_cited_sources' is the explicit honest marker for a
// column no cited source settles, and it always raises LOCAL_FACT_UNPINNED.
export const LOCAL_FACT_ENUMS = Object.freeze({
  api_key_card_proxy: Object.freeze({
    scope: Object.freeze(['container_scoped_token_use', 'tenant_wide_proxy_invoke']),
    expiry: Object.freeze(['unpinned_in_cited_sources']),
    replay_protection: Object.freeze(['fail_closed_single_forward']),
  }),
  wallet_session_key: Object.freeze({
    scope: Object.freeze(['counterparty_and_chain_scoped_grant']),
    expiry: Object.freeze(['expiry_rule_unix_timestamp']),
    replay_protection: Object.freeze(['unpinned_in_cited_sources']),
  }),
});

export const REVOCATION_MECHANISMS = Object.freeze([
  'authoritative_party_revoke_call',
  'expiry_rule_only',
  'account_validation_state',
  'module_uninstall',
  'declared_not_revocable',
  'unknown_or_undeclared',
]);
export const LEARN_FIELDS = Object.freeze([
  'opaque_credential',
  'learns_identity',
  'learns_action',
  'publicly_visible',
  'credential_persisted_or_logged',
]);
export const RAILS = Object.freeze(['mastercard_agent_pay', 'visa_tap', 'web_bot_auth']);

export const FLAGS = Object.freeze({
  RAIL_VERDICT_INVALID: 'RAIL_VERDICT_INVALID',
  UNKNOWN_CREDENTIAL_CLASS: 'UNKNOWN_CREDENTIAL_CLASS',
  MISSING_CHAINED_SOURCE: 'MISSING_CHAINED_SOURCE',
  UNKNOWN_CHAIN_SOURCE: 'UNKNOWN_CHAIN_SOURCE',
  CHAINED_CELL_FOR_LOCAL_CLASS: 'CHAINED_CELL_FOR_LOCAL_CLASS',
  UNKNOWN_LOCAL_FACT: 'UNKNOWN_LOCAL_FACT',
  LOCAL_FACT_UNPINNED: 'LOCAL_FACT_UNPINNED',
  REVOCATION_UNDECLARED: 'REVOCATION_UNDECLARED',
  UNKNOWN_REVOCATION_MECHANISM: 'UNKNOWN_REVOCATION_MECHANISM',
  INCOMPLETE_LEARN_FACTS: 'INCOMPLETE_LEARN_FACTS',
});

// ---------- helpers ----------
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function refusedCell(reason) {
  return { kind: 'refused', reason };
}

function validateRailVerdict(rv) {
  // Returns { ok, summary }. ok=false always pairs with RAIL_VERDICT_INVALID.
  if (!isPlainObject(rv)) return { ok: false, summary: { present: false } };
  const rails = rv.rails;
  if (!isPlainObject(rails)) return { ok: false, summary: { present: false } };
  const accepted_rails = [];
  const gap_counts = {};
  for (const name of RAILS) {
    const r = rails[name];
    if (!isPlainObject(r)) return { ok: false, summary: { present: false } };
    if (typeof r.accepted !== 'boolean') return { ok: false, summary: { present: false } };
    if (!Array.isArray(r.gaps)) return { ok: false, summary: { present: false } };
    if (r.accepted) accepted_rails.push(name);
    gap_counts[name] = r.gaps.length;
  }
  if (typeof rv.any_accepted !== 'boolean') return { ok: false, summary: { present: false } };
  const derivedAny = accepted_rails.length > 0;
  if (rv.any_accepted !== derivedAny) return { ok: false, summary: { present: false } };
  return {
    ok: true,
    summary: {
      present: true,
      any_accepted: rv.any_accepted,
      accepted_rails,
      gap_counts,
      consumed_from: 'art-133-agent-payment-rail-trust-crosswalk',
    },
  };
}

function chainedCells(cls, entry, addFlag) {
  const cells = {};
  const src = entry.chain_sources;
  if (!isPlainObject(src)) {
    addFlag(FLAGS.MISSING_CHAINED_SOURCE, `${cls}: chain_sources missing or malformed`);
    for (const col of COLUMNS) cells[col] = refusedCell(FLAGS.MISSING_CHAINED_SOURCE);
    return cells;
  }
  for (const col of COLUMNS) {
    const id = src[col];
    if (typeof id !== 'string' || id.length === 0) {
      addFlag(FLAGS.MISSING_CHAINED_SOURCE, `${cls}.${col}: no chained source supplied`);
      cells[col] = refusedCell(FLAGS.MISSING_CHAINED_SOURCE);
    } else if (!CHAIN_SOURCES[cls][col].includes(id)) {
      addFlag(FLAGS.UNKNOWN_CHAIN_SOURCE, `${cls}.${col}: "${id}" is not in the closed chain-source set`);
      cells[col] = refusedCell(FLAGS.UNKNOWN_CHAIN_SOURCE);
    } else {
      cells[col] = { kind: 'chained', source: id };
    }
  }
  return cells;
}

function localCells(cls, entry, addFlag) {
  const cells = {};
  if (isPlainObject(entry.chain_sources)) {
    addFlag(FLAGS.CHAINED_CELL_FOR_LOCAL_CLASS, `${cls}: chain_sources supplied for a local-fact class`);
  }
  const lf = entry.local_facts;
  if (!isPlainObject(lf)) {
    for (const col of COLUMNS) cells[col] = { kind: 'not_declared' };
    return cells;
  }
  for (const col of COLUMNS) {
    const value = lf[col];
    if (typeof value !== 'string' || !LOCAL_FACT_ENUMS[cls][col].includes(value)) {
      addFlag(FLAGS.UNKNOWN_LOCAL_FACT, `${cls}.${col}: value not in the closed local-fact set`);
      cells[col] = refusedCell(FLAGS.UNKNOWN_LOCAL_FACT);
    } else if (value === 'unpinned_in_cited_sources') {
      addFlag(FLAGS.LOCAL_FACT_UNPINNED, `${cls}.${col}: declared unpinned in the cited sources`);
      cells[col] = { kind: 'local_fact', value };
    } else {
      cells[col] = { kind: 'local_fact', value };
    }
  }
  return cells;
}

function revocationCell(cls, revocation, addFlag) {
  const rv = isPlainObject(revocation) ? revocation[cls] : undefined;
  if (!isPlainObject(rv) || typeof rv.mechanism !== 'string' || typeof rv.time_bound !== 'boolean') {
    addFlag(FLAGS.REVOCATION_UNDECLARED, `${cls}: revocation not declared as {mechanism, time_bound}`);
    return refusedCell(FLAGS.REVOCATION_UNDECLARED);
  }
  if (!REVOCATION_MECHANISMS.includes(rv.mechanism)) {
    addFlag(FLAGS.UNKNOWN_REVOCATION_MECHANISM, `${cls}: mechanism "${rv.mechanism}" not in the closed set`);
    return refusedCell(FLAGS.UNKNOWN_REVOCATION_MECHANISM);
  }
  return { kind: 'local_fact', mechanism: rv.mechanism, time_bound: rv.time_bound };
}

function learnCell(cls, learn, addFlag) {
  const ln = isPlainObject(learn) ? learn[cls] : undefined;
  if (!isPlainObject(ln)) {
    addFlag(FLAGS.INCOMPLETE_LEARN_FACTS, `${cls}: learn facts missing`);
    return refusedCell(FLAGS.INCOMPLETE_LEARN_FACTS);
  }
  for (const f of LEARN_FIELDS) {
    if (typeof ln[f] !== 'boolean') {
      addFlag(FLAGS.INCOMPLETE_LEARN_FACTS, `${cls}.${f}: missing or not boolean`);
      return refusedCell(FLAGS.INCOMPLETE_LEARN_FACTS);
    }
  }
  const facts = {};
  for (const f of LEARN_FIELDS) facts[f] = ln[f];
  return { kind: 'local_fact', facts };
}

// ---------- compute ----------
/**
 * compute(pp) -- pure decision kernel.
 * pp = {
 *   rail_verdict: art-133 output shape {any_accepted, rails: {<rail>: {accepted, gaps}}},
 *   classes: {  // declare only the classes the deployment uses
 *     <chained class>: { chain_sources: {scope, expiry, replay_protection} },
 *     <local class>:   { local_facts: {scope, expiry, replay_protection} },
 *   },
 *   revocation: { <class>: {mechanism, time_bound} },   // for declared classes
 *   learn:      { <class>: {opaque_credential, learns_identity, learns_action,
 *                           publicly_visible, credential_persisted_or_logged} },
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = isPlainObject(pp) ? pp : {};
  const flags = [];
  const review = [];
  const addFlag = (f, detail) => {
    if (!flags.includes(f)) flags.push(f);
    review.push({ flag: f, detail });
  };

  const rail = validateRailVerdict(pp.rail_verdict);
  if (!rail.ok) addFlag(FLAGS.RAIL_VERDICT_INVALID, 'rail_verdict missing or not a well-formed art-133 verdict');

  // Unknown class keys are refused outright; declared classes build rows.
  const declared = isPlainObject(pp.classes) ? pp.classes : {};
  for (const key of Object.keys(declared)) {
    if (!CLASSES.includes(key)) {
      addFlag(FLAGS.UNKNOWN_CREDENTIAL_CLASS, `classes key "${key}" is not one of the five credential classes`);
    }
  }

  const matrix = [];
  for (const cls of CLASSES) {
    const entry = declared[cls];
    const cells = {};
    if (!isPlainObject(entry)) {
      for (const col of COLUMNS) cells[col] = { kind: 'not_declared' };
      cells.revocability = { kind: 'not_declared' };
      cells.learn = { kind: 'not_declared' };
    } else if (CHAINED_CLASSES.includes(cls)) {
      for (const [col, cell] of Object.entries(chainedCells(cls, entry, addFlag))) cells[col] = cell;
      cells.revocability = revocationCell(cls, pp.revocation, addFlag);
      cells.learn = learnCell(cls, pp.learn, addFlag);
    } else {
      for (const [col, cell] of Object.entries(localCells(cls, entry, addFlag))) cells[col] = cell;
      cells.revocability = revocationCell(cls, pp.revocation, addFlag);
      cells.learn = learnCell(cls, pp.learn, addFlag);
    }
    matrix.push({ credential_class: cls, cells });
  }

  const output_payload = {
    matrix,
    rail_acceptance_summary: rail.summary,
    manual_review_required: review,
  };
  return { output_payload, compliance_flags: flags };
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
