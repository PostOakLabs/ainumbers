import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-459-sod-matrix-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_sod_matrix',
  mandate_type: 'compliance_control', gpu: false,
};

// Segregation-of-duties matrix-check kernel (SOX 404 / ICFR access controls, art-459). Evaluates
// a caller-declared role assignment set against a caller-declared conflict ruleset -- both are
// policy inputs (the versioned SoD ruleset is an auditor/control-owner artifact, never derived by
// this kernel). For every user, every unordered pair of their assigned roles is checked against
// the ruleset; a pair present in the ruleset (in either order) is a conflict. Deterministic set
// membership + pairwise iteration only -- no randomness, no clock, no network. Zero PII: caller
// supplies opaque user_id/role strings, never names or other identifying attributes.

function s(v) { return String(v == null ? '' : v).trim(); }

function conflictKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

export function compute(pp) {
  pp = pp || {};
  const ruleset_version = s(pp.ruleset_version) || 'unversioned';
  const ruleset = Array.isArray(pp.conflict_ruleset) ? pp.conflict_ruleset : [];
  const assignments = Array.isArray(pp.assignments) ? pp.assignments : [];
  const compliance_flags = ['SOD_MATRIX_EVALUATED'];

  const ruleMap = new Map();
  for (const r of ruleset) {
    const ra = s(r && r.role_a);
    const rb = s(r && r.role_b);
    if (!ra || !rb || ra === rb) continue;
    ruleMap.set(conflictKey(ra, rb), s(r.reason_code) || 'SOD_CONFLICT');
  }

  const conflicts = [];
  const usersWithConflicts = new Set();
  for (const a of assignments) {
    const user_id = s(a && a.user_id);
    const roles = Array.isArray(a && a.roles) ? [...new Set(a.roles.map(s).filter(Boolean))] : [];
    if (!user_id || roles.length < 2) continue;
    roles.sort();
    for (let i = 0; i < roles.length; i++) {
      for (let j = i + 1; j < roles.length; j++) {
        const key = conflictKey(roles[i], roles[j]);
        if (ruleMap.has(key)) {
          conflicts.push({ user_id, role_a: roles[i], role_b: roles[j], reason_code: ruleMap.get(key) });
          usersWithConflicts.add(user_id);
        }
      }
    }
  }

  const clean = conflicts.length === 0;
  if (clean) compliance_flags.push('SOD_NO_CONFLICTS');
  else compliance_flags.push('SOD_CONFLICTS_DETECTED');

  return {
    output_payload: {
      ruleset_version,
      users_evaluated: assignments.length,
      conflict_rules_evaluated: ruleMap.size,
      conflicts,
      conflict_count: conflicts.length,
      users_with_conflicts: usersWithConflicts.size,
      clean,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
