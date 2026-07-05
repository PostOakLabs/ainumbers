import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-264-validate-commission-hierarchy';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

export function compute(policy_parameters) {
  const {
    hierarchy = [],
    max_levels = 10,
  } = policy_parameters;

  const violations = [];
  const byLevel = [];
  let orphan_count = 0;
  let override_stacking_detected = false;

  // Build adjacency maps
  const byId = {};
  const childrenOf = {};
  for (const node of hierarchy) {
    byId[node.agent_id] = node;
    if (!childrenOf[node.parent_id]) childrenOf[node.parent_id] = [];
    childrenOf[node.parent_id].push(node.agent_id);
  }

  // Find roots (no parent or parent_id = null/"")
  const roots = hierarchy.filter(n => !n.parent_id || n.parent_id === '' || n.parent_id === null);
  const rootIds = new Set(roots.map(n => n.agent_id));

  // Detect orphans: non-root nodes whose parent doesn't exist
  for (const node of hierarchy) {
    if (!rootIds.has(node.agent_id) && node.parent_id && !byId[node.parent_id]) {
      orphan_count++;
      violations.push({
        type: 'ORPHAN',
        agent_id: node.agent_id,
        message: `agent_id ${node.agent_id} references non-existent parent ${node.parent_id}`,
      });
    }
  }

  // BFS to assign levels + detect cycles
  const levelOf = {};
  const visited = new Set();
  const queue = roots.map(r => ({ id: r.agent_id, level: 0 }));
  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (visited.has(id)) {
      violations.push({ type: 'CIRCULAR', agent_id: id, message: `Circular reference detected at agent_id ${id}` });
      continue;
    }
    visited.add(id);
    levelOf[id] = level;
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(id);
    for (const child of (childrenOf[id] || [])) {
      queue.push({ id: child, level: level + 1 });
    }
  }

  const total_levels = byLevel.length;

  // Validate splits per level: sum of splits for children of same parent must be <=100%
  const parentSums = {};
  for (const node of hierarchy) {
    if (!node.parent_id) continue;
    const pct = typeof node.split_pct === 'number' ? node.split_pct : 0;
    if (pct < 0) {
      violations.push({ type: 'NEGATIVE_SPLIT', agent_id: node.agent_id, message: `Negative split_pct ${pct} for agent_id ${node.agent_id}` });
    }
    if (!parentSums[node.parent_id]) parentSums[node.parent_id] = 0;
    parentSums[node.parent_id] += pct;
  }

  for (const [parentId, sum] of Object.entries(parentSums)) {
    const roundedSum = Math.round(sum * 10000) / 10000;
    if (roundedSum > 100) {
      violations.push({
        type: 'EXCEEDS_100_PCT',
        agent_id: parentId,
        message: `Children splits sum to ${roundedSum}% (exceeds 100%) under parent ${parentId}`,
      });
    }
    // Override stacking: parent distributes >80% across >=3 children (stacked override signals inflated payout)
    const childCount = (childrenOf[parentId] || []).length;
    if (childCount >= 3 && roundedSum > 80) {
      override_stacking_detected = true;
    }
  }

  // Level summary
  const by_level = byLevel.map((agents, level) => {
    const splitSum = agents.reduce((s, id) => {
      const n = byId[id];
      return s + (n && typeof n.split_pct === 'number' ? n.split_pct : 0);
    }, 0);
    return {
      level,
      agent_count: agents.length,
      agents,
      total_split_pct: Math.round(splitSum * 10000) / 10000,
    };
  });

  const is_valid = violations.length === 0;

  return {
    is_valid,
    total_levels,
    agent_count: hierarchy.length,
    orphan_count,
    override_stacking_detected,
    violations,
    by_level,
    table_version: 'ASC606-COMMISSION-HIERARCHY-V2024',
    table_source: 'ASC 606 (revenue recognition) + ASC 340-40 (incremental costs of obtaining a contract); hierarchy split logic per carrier commission agreement structural norms; ICM Commission Management best practices 2024',
    regulatory_basis: 'ASC 340-40-05-1: incremental costs of obtaining a contract must be recognized as assets if expected recovery is probable; hierarchy splits determine which agent cost layers are incremental. ZERO PII: synthetic agent-id graphs and split percentages only.',
    pii_note: 'ZERO PII: synthetic agent identifiers and numeric split percentages only. No agent name, SSN, NPN, address, or personal data enters this kernel.',
    not_legal_advice: 'Not legal or accounting advice. Commission hierarchy validation is for structural compliance review only; consult your carrier agreements and accountants for binding interpretation.',
  };
}

export async function buildArtifact(policy_parameters, opts = {}) {
  const output_payload = compute(policy_parameters);
  const execution_hash = await executionHash(policy_parameters, output_payload);
  return {
    chaingraph_version: '0.4.0',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    policy_parameters,
    output_payload,
    execution_hash,
  };
}
