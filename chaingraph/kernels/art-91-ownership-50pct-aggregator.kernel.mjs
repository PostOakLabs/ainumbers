/**
 * art-91-ownership-50pct-aggregator.kernel.mjs
 * Wave 19 — Ownership 50%-Rule Aggregator (W-A flagship).
 * Walks a SYNTHETIC ownership graph; computes aggregate beneficial ownership
 * from listed entities to target entities; applies OFAC, EU, and BIS Affiliates
 * Rule 50%-thresholds → constructively-blocked verdict per entity.
 * Pure graph math — no PII, no real persons or entities.
 *
 * Citations (verify before citing):
 *   OFAC 50% Rule — constructive SDN blocking where aggregate ≥50% owned by SDN(s).
 *   BIS Affiliates Rule (15 CFR §744, in force 29 Sep 2025) — Entity List restrictions
 *     auto-extend to affiliates that are ≥50% in aggregate owned by a listed entity.
 *   EU Council Regulation (EU) No 833/2014 as amended — ownership/control thresholds
 *     for Russian sanctions screening; EU consolidated list.
 *   EDUCATIONAL: synthetic entities only — outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-91-ownership-50pct-aggregator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'aggregate_ownership_50pct',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// Default thresholds per regime (verify against current guidance)
const DEFAULT_THRESHOLDS = { ofac_50: 0.50, eu_50: 0.50, bis_50: 0.50 };

// Relaxation stops when no node's contribution rises by more than this in a full round.
const CONVERGENCE_EPSILON = 1e-12;
// Hard round ceiling so a cyclic ownership graph can never spin forever. A directed
// acyclic graph is exact after at most (node count) rounds; the constant is slack for
// circular cross-holdings, whose contribution series converges geometrically.
const MAX_RELAXATION_ROUNDS_SLACK = 1024;

/**
 * Index an adjacency map for fixpoint relaxation: the sorted node id set, plus each
 * node's incoming edges as {from, frac}.
 *
 * Both the node list and every in-edge list are sorted, so neither the traversal nor
 * the order of the floating-point additions below depends on how the caller happened
 * to serialize edges[]. Float addition is not associative, so an unsorted in-edge list
 * would leave a residual order dependence at the last significant bit.
 *
 * @param {Object} adjMap - adjacency map: from → [{to, pct}]
 * @returns {{nodeIds: string[], inEdges: Object}}
 */
function buildTraversalIndex(adjMap) {
  const inEdges = {};
  const ids = new Set();
  for (const from of Object.keys(adjMap)) {
    ids.add(from);
    for (const { to, pct } of adjMap[from]) {
      ids.add(to);
      if (!inEdges[to]) inEdges[to] = [];
      inEdges[to].push({ from, frac: pct / 100 }); // pct is 0–100
    }
  }
  const nodeIds = [...ids].sort();
  for (const id of nodeIds) {
    if (inEdges[id]) {
      inEdges[id].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.frac - b.frac));
    }
  }
  return { nodeIds, inEdges };
}

/**
 * Solve the aggregate ownership held by `source` in every node of the graph.
 *
 * The quantity is the sum, over every ownership path from source to the node, of the
 * product of that path's edge fractions. That is the fixpoint of
 *
 *     c[source] = 1
 *     c[n]      = min(1, sum over in-edges (u → n) of c[u] * frac(u, n))
 *
 * solved by Jacobi relaxation: every round recomputes each node purely from the
 * PREVIOUS round's values, so the sweep order cannot affect the result. Values start
 * at 0 and only ever rise, so the iteration is monotone and bounded above by 1 and
 * therefore converges; the round ceiling is a belt-and-braces stop for circular
 * holdings. Clamping at 1 inside the loop (not only on the way out) is what makes a
 * cycle terminate at all: no entity can be more than 100% owned.
 *
 * A single-pass traversal cannot compute this. A node's contribution is a running sum
 * over parallel paths, so it can rise after the node has already been expanded, and a
 * one-shot walk never carries that rise to the node's own out-edges.
 *
 * @param {string} source - starting node id (a listed entity)
 * @param {{nodeIds: string[], inEdges: Object}} graph - output of buildTraversalIndex
 * @returns {Map<string, number>} node id → aggregate ownership fraction [0, 1]
 */
function solveContributions(source, graph) {
  const { nodeIds, inEdges } = graph;
  let contributions = new Map();
  for (const id of nodeIds) contributions.set(id, 0);
  contributions.set(source, 1.0); // the origin's stake in itself, pinned

  const maxRounds = nodeIds.length + MAX_RELAXATION_ROUNDS_SLACK;
  for (let round = 0; round < maxRounds; round++) {
    const next = new Map(contributions);
    let maxDelta = 0;
    for (const id of nodeIds) {
      if (id === source) continue; // pinned; an edge back into the origin cannot raise it
      let sum = 0;
      for (const { from, frac } of (inEdges[id] || [])) sum += (contributions.get(from) || 0) * frac;
      if (sum > 1) sum = 1;
      const prev = contributions.get(id) || 0;
      if (sum > prev) {
        next.set(id, sum);
        if (sum - prev > maxDelta) maxDelta = sum - prev;
      }
    }
    contributions = next;
    if (maxDelta <= CONVERGENCE_EPSILON) break;
  }
  return contributions;
}

/**
 * Compute aggregate ownership from a listed entity (source) to a target entity.
 * Contributions are solved once per source and reused across targets.
 *
 * @param {string} source - starting node id (a listed entity)
 * @param {string} target - end node id (entity under assessment)
 * @param {{nodeIds: string[], inEdges: Object}} graph - output of buildTraversalIndex
 * @param {Map<string, Map<string, number>>} cache - per-source solved contributions
 * @returns {number} aggregate ownership fraction [0, 1]
 */
function aggregateOwnership(source, target, graph, cache) {
  if (source === target) return 1.0;
  let contributions = cache.get(source);
  if (!contributions) {
    contributions = solveContributions(source, graph);
    cache.set(source, contributions);
  }
  return Math.min(contributions.get(target) || 0, 1.0);
}

/**
 * Build adjacency map from edges array.
 * Caps each edge pct at 100 (data guard).
 */
function buildAdjMap(edges) {
  const adj = {};
  for (const { from, to, pct } of edges) {
    if (!adj[from]) adj[from] = [];
    adj[from].push({ to, pct: Math.min(Math.max(pct, 0), 100) });
  }
  return adj;
}

/**
 * Find all listed nodes and their list_source.
 */
function listedNodes(nodes) {
  return nodes.filter(n => n.listed === true);
}

/**
 * Recover a controlling path (first BFS path from source to target).
 */
function findPath(source, target, adjMap) {
  if (source === target) return [source];
  const prev = new Map();
  const queue = [source];
  const visited = new Set([source]);
  prev.set(source, null);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === target) break;
    for (const { to } of (adjMap[cur] || [])) {
      if (!visited.has(to)) {
        visited.add(to);
        prev.set(to, cur);
        queue.push(to);
      }
    }
  }
  if (!prev.has(target)) return [];
  const path = [];
  let cur = target;
  while (cur !== null) { path.unshift(cur); cur = prev.get(cur); }
  return path;
}

export function compute(pp) {
  const {
    ownership_graph = { nodes: [], edges: [] },
    thresholds      = DEFAULT_THRESHOLDS,
  } = pp;

  const { nodes = [], edges = [] } = ownership_graph;
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  if (nodes.length === 0) {
    return {
      output_payload: {
        entity_verdicts: [],
        blocked_count: 0,
        listed_entity_count: 0,
        summary: 'Empty graph — no entities to evaluate.',
        reference_version: '2026-06',
        note: 'SYNTHETIC DATA ONLY. No real entities assessed. Verify OFAC/EU/BIS thresholds against current official guidance.',
      },
      compliance_flags: [],
    };
  }

  const adjMap    = buildAdjMap(edges);
  const graph     = buildTraversalIndex(adjMap);
  const contribCache = new Map(); // source id → solved contributions, one solve per listed entity
  const listed    = listedNodes(nodes);
  const allIds    = nodes.map(n => n.id);

  const entity_verdicts = [];
  let blocked_count = 0;

  for (const target of allIds) {
    // Aggregate ownership from each listed entity to this target
    let total_ofac = 0, total_eu = 0, total_bis = 0;
    const controlling_paths = [];
    let worst_path = [];

    for (const src of listed) {
      const frac = aggregateOwnership(src.id, target, graph, contribCache);
      if (frac <= 0) continue;
      total_ofac = Math.min(total_ofac + (src.list_source === 'ofac' || src.list_source === 'both' ? frac : 0), 1);
      total_eu   = Math.min(total_eu   + (src.list_source === 'eu'   || src.list_source === 'both' ? frac : 0), 1);
      total_bis  = Math.min(total_bis  + (src.list_source === 'bis'  || src.list_source === 'both' ? frac : 0), 1);
      // For composite aggregation, track the best contributing path
      const path = findPath(src.id, target, adjMap);
      if (path.length > 0) controlling_paths.push({ from: src.id, pct: +(frac * 100).toFixed(2), path });
    }

    // If the target itself is listed, it is always constructively blocked
    const self_listed = listed.find(l => l.id === target);
    if (self_listed) {
      total_ofac = self_listed.list_source === 'ofac' || self_listed.list_source === 'both' ? 1 : total_ofac;
      total_eu   = self_listed.list_source === 'eu'   || self_listed.list_source === 'both' ? 1 : total_eu;
      total_bis  = self_listed.list_source === 'bis'  || self_listed.list_source === 'both' ? 1 : total_bis;
    }

    const blocked_under = [];
    if (total_ofac >= t.ofac_50) blocked_under.push('OFAC');
    if (total_eu   >= t.eu_50)   blocked_under.push('EU');
    if (total_bis  >= t.bis_50)  blocked_under.push('BIS');

    const aggregate_pct = +(Math.max(total_ofac, total_eu, total_bis) * 100).toFixed(2);

    // Best controlling path for display
    if (controlling_paths.length > 0)
      worst_path = controlling_paths.sort((a, b) => b.pct - a.pct)[0].path;

    const verdict = {
      id:             target,
      aggregate_pct,
      ofac_pct:       +(total_ofac * 100).toFixed(2),
      eu_pct:         +(total_eu   * 100).toFixed(2),
      bis_pct:        +(total_bis  * 100).toFixed(2),
      blocked_under,
      constructively_blocked: blocked_under.length > 0,
      controlling_path:       worst_path,
    };
    entity_verdicts.push(verdict);
    if (blocked_under.length > 0) blocked_count++;
  }

  const compliance_flags = [];
  if (blocked_count > 0) compliance_flags.push('CONSTRUCTIVELY_BLOCKED');
  const any_aggregate = entity_verdicts.some(v => v.aggregate_pct > 0 && v.aggregate_pct < 100);
  if (any_aggregate) compliance_flags.push('AGGREGATE_THRESHOLD_MET');
  const deep_indirect = entity_verdicts.some(v => v.controlling_path && v.controlling_path.length > 2);
  if (deep_indirect) compliance_flags.push('LAYERED_INDIRECT_OWNERSHIP');

  const output_payload = {
    entity_verdicts,
    blocked_count,
    listed_entity_count: listed.length,
    thresholds_applied: t,
    key_dates: {
      bis_affiliates_rule: '2025-09-29',
      ofac_50_rule:        'ongoing',
      eu_50_rule:          'ongoing',
    },
    reference_version: '2026-06',
    note: 'SYNTHETIC DATA ONLY. Graph traversal applies OFAC/EU/BIS 50%-rule thresholds to aggregate ownership paths. No real entities processed. Verify thresholds against current OFAC guidance, 15 CFR §744 (BIS), and EU council regulations.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
