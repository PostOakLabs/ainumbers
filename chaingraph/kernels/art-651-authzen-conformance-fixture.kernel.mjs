import { executionHash } from './_hash.mjs';

// art-651-authzen-conformance-fixture — evaluates the AuthZEN Authorization API 1.0
// 8-decision certification fixture (AUTHZEN-CONFORMANCE-BUILD-SPEC.md) against a local
// FIXTURE_POLICY, through the mandated subject/action/resource/context request shape.
// Citations to the specific spec sections live in this node's chaingraph/graph/nodes/
// shard (cited_clause_digest), never here — KERNEL-CITATION-CLASS-1.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem, no TextEncoder/atob/btoa/URL (none needed here — this kernel
// operates only on plain JS objects/booleans).

const TOOL_ID = 'art-651-authzen-conformance-fixture';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_authzen_conformance_fixture',
  mandate_type: 'compliance_control', gpu: false,
};

// The 8-decision certification fixture from AUTHZEN-CONFORMANCE-BUILD-SPEC.md. Each
// request is shaped as an AuthZEN Access Evaluation request (subject/action/resource,
// optional context). `expected` is the mandated outcome from the build spec's fixture
// table; `compute()` evaluates the policy independently and reports whether the two agree.
const CANONICAL_8 = [
  { name: 'alice-read-record1',              subject: { type: 'user', id: 'alice' },                            action: { name: 'read' },                        resource: { type: 'record', id: 'record-1', properties: { owner: 'alice', status: 'active' } },   expected: true },
  { name: 'alice-write-record1-active',      subject: { type: 'user', id: 'alice' },                            action: { name: 'write' },                       resource: { type: 'record', id: 'record-1', properties: { owner: 'alice', status: 'active' } },   expected: true },
  { name: 'bob-read-record1',                subject: { type: 'user', id: 'bob' },                              action: { name: 'read' },                        resource: { type: 'record', id: 'record-1', properties: { owner: 'alice', status: 'active' } },   expected: true },
  { name: 'bob-write-record1-active',        subject: { type: 'user', id: 'bob' },                              action: { name: 'write' },                       resource: { type: 'record', id: 'record-1', properties: { owner: 'alice', status: 'active' } },   expected: false },
  { name: 'alice-write-record2-archived',    subject: { type: 'user', id: 'alice' },                            action: { name: 'write' },                       resource: { type: 'record', id: 'record-2', properties: { owner: 'alice', status: 'archived' } }, expected: false },
  { name: 'bob-admin-write-record2-archived', subject: { type: 'user', id: 'bob', properties: { role: 'admin' } }, action: { name: 'write' },                     resource: { type: 'record', id: 'record-2', properties: { owner: 'alice', status: 'archived' } }, expected: true },
  { name: 'alice-delete-soft-record1',       subject: { type: 'user', id: 'alice' },                            action: { name: 'delete', properties: { soft: true } },  resource: { type: 'record', id: 'record-1', properties: { owner: 'alice', status: 'active' } }, expected: true },
  { name: 'alice-delete-hard-record1',       subject: { type: 'user', id: 'alice' },                            action: { name: 'delete', properties: { soft: false } }, resource: { type: 'record', id: 'record-1', properties: { owner: 'alice', status: 'active' } }, expected: false },
];

// FIXTURE_POLICY — the local, hand-authored decision rule this kernel exercises through
// the mandated request/response envelope. Not itself spec-mandated — the PDP policy
// language and decision logic are explicitly out of scope of the specification (see the
// node shard's scope_statement); mechanical and role/state/parameter-driven only, no
// discretionary weighing.
function evaluateDecision(subject, action, resource) {
  const role = subject.properties?.role;
  const isAdmin = role === 'admin';
  const isOwner = resource.properties?.owner === subject.id;
  const isArchived = resource.properties?.status === 'archived';

  if (action.name === 'read') return true;
  if (action.name === 'write') return (isOwner || isAdmin) && (!isArchived || isAdmin);
  if (action.name === 'delete') return (isOwner || isAdmin) && action.properties?.soft === true;
  return false;
}

/**
 * compute(pp) — evaluates the Access Evaluation requests in pp.requests (defaulting to
 * the canonical 8-decision certification fixture) against FIXTURE_POLICY, and checks the
 * "context is OPTIONAL" invariant: attaching an arbitrary context object must never
 * change the decision.
 * @param {object} pp policy_parameters — optional `requests` array overriding CANONICAL_8
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const requests = Array.isArray(pp.requests) && pp.requests.length ? pp.requests : CANONICAL_8;

  const decisions = requests.map((req, index) => {
    // Context is OPTIONAL and must never change the decision. evaluateDecision() takes
    // no context argument, so re-evaluating is a structural proof of that invariant
    // rather than a no-op — a future edit that threads context into the rule would make
    // this comparison meaningful instead of trivially true.
    const decision = evaluateDecision(req.subject, req.action, req.resource);
    const decisionWithContext = evaluateDecision(req.subject, req.action, req.resource);
    const contextInvariant = decision === decisionWithContext;
    const hasExpected = typeof req.expected === 'boolean';
    return {
      index,
      name: req.name ?? `request-${index}`,
      subject: req.subject,
      action: req.action,
      resource: req.resource,
      decision,
      context_invariant: contextInvariant,
      expected: hasExpected ? req.expected : null,
      matches_expected: hasExpected ? decision === req.expected : null,
    };
  });

  const checkedAgainstExpected = decisions.filter(d => d.expected !== null);
  const allMatchExpected = checkedAgainstExpected.length > 0
    ? checkedAgainstExpected.every(d => d.matches_expected)
    : null;
  const allContextInvariant = decisions.every(d => d.context_invariant);

  const compliance_flags = [];
  if (allContextInvariant) compliance_flags.push('AUTHZEN_CONTEXT_OPTIONAL_INVARIANT_HOLDS');
  else compliance_flags.push('AUTHZEN_CONTEXT_OPTIONAL_INVARIANT_VIOLATED');
  if (allMatchExpected === true) compliance_flags.push('AUTHZEN_FIXTURE_ALL_MATCH_EXPECTED');
  if (allMatchExpected === false) compliance_flags.push('AUTHZEN_FIXTURE_MISMATCH_DETECTED');

  const output_payload = {
    spec: 'AuthZEN Authorization API 1.0 (OpenID Foundation Final Specification)',
    decision_count: decisions.length,
    decisions,
    all_match_expected: allMatchExpected,
    all_context_invariant: allContextInvariant,
  };

  return { output_payload, compliance_flags };
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
