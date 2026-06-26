/**
 * pnr-01-dora-ict-cascade-simulator.kernel.mjs
 * DORA ICT Cascade Simulator — LCG PRNG, Monte Carlo BFS cascade.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'pnr-01-dora-ict-cascade-simulator',
  mcp_name:     'simulate_ict_cascade',
  mandate_type: 'infrastructure_mandate',
  version:      '1.0.0',
};

const TOOL_ID      = 'pnr-01-dora-ict-cascade-simulator';
const TOOL_VERSION = '1.0.0';

// ── LCG (matches source HTML makeLCG) ────────────────────────────────────────
function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── MTTR multipliers ─────────────────────────────────────────────────────────
const MTTR_SCALE = { fast: 0.5, standard: 1.0, slow: 2.0 };

// ── Topology definitions (ported from source TOPOLOGIES) ─────────────────────
const TOPOLOGIES = {
  bank_core: {
    label: 'Bank Core',
    nodes: [
      { id:'core_banking',       critical:true,  clients:.90, txn:.85, mttr:8,  deps:[] },
      { id:'database_primary',   critical:true,  clients:.80, txn:.75, mttr:6,  deps:[] },
      { id:'identity_service',   critical:true,  clients:.95, txn:.50, mttr:3,  deps:[] },
      { id:'message_broker',     critical:false, clients:.50, txn:.60, mttr:2,  deps:['database_primary'] },
      { id:'payment_gateway',    critical:true,  clients:.70, txn:.90, mttr:3,  deps:['core_banking'] },
      { id:'swift_gateway',      critical:true,  clients:.30, txn:.80, mttr:4,  deps:['core_banking','payment_gateway'] },
      { id:'fraud_detection',    critical:true,  clients:.40, txn:.70, mttr:4,  deps:['message_broker','database_primary'] },
      { id:'api_gateway',        critical:true,  clients:.90, txn:.80, mttr:2,  deps:['core_banking','fraud_detection','identity_service'] },
      { id:'database_replica',   critical:false, clients:.40, txn:.30, mttr:2,  deps:['database_primary'] },
      { id:'customer_portal',    critical:false, clients:.60, txn:.50, mttr:1,  deps:['api_gateway'] },
      { id:'mobile_app',         critical:false, clients:.70, txn:.55, mttr:1,  deps:['api_gateway'] },
      { id:'clearing_interface', critical:true,  clients:.40, txn:.90, mttr:6,  deps:['payment_gateway','swift_gateway'] },
      { id:'reporting_engine',   critical:true,  clients:.20, txn:.10, mttr:8,  deps:['database_primary','message_broker'] },
      { id:'third_party_kyc',    critical:false, clients:.30, txn:.20, mttr:24, deps:['identity_service'] },
      { id:'backup_datacenter',  critical:false, clients:.30, txn:.30, mttr:12, deps:[] },
      { id:'monitoring',         critical:false, clients:.10, txn:.05, mttr:1,  deps:['message_broker'] },
    ],
  },
  cloud_native: {
    label: 'Cloud-Native',
    nodes: [
      { id:'cloud_provider',    critical:true,  clients:.95, txn:.90, mttr:2,  deps:[] },
      { id:'kubernetes',        critical:true,  clients:.85, txn:.85, mttr:1,  deps:['cloud_provider'] },
      { id:'auth_service',      critical:true,  clients:.95, txn:.50, mttr:1,  deps:['kubernetes'] },
      { id:'database_service',  critical:true,  clients:.70, txn:.80, mttr:2,  deps:['cloud_provider'] },
      { id:'config_service',    critical:true,  clients:.80, txn:.50, mttr:1,  deps:['kubernetes'] },
      { id:'api_service',       critical:true,  clients:.90, txn:.90, mttr:.5, deps:['kubernetes','auth_service','config_service'] },
      { id:'fraud_ml',          critical:true,  clients:.50, txn:.70, mttr:2,  deps:['kubernetes','database_service'] },
      { id:'payment_processor', critical:true,  clients:.80, txn:.95, mttr:2,  deps:['api_service','database_service','fraud_ml'] },
      { id:'third_party_rails', critical:true,  clients:.60, txn:.80, mttr:4,  deps:['api_service'] },
      { id:'cdn_edge',          critical:false, clients:.60, txn:.30, mttr:.5, deps:['cloud_provider'] },
      { id:'notification_svc',  critical:false, clients:.40, txn:.10, mttr:.5, deps:['kubernetes'] },
      { id:'data_warehouse',    critical:false, clients:.10, txn:.05, mttr:4,  deps:['database_service'] },
      { id:'backup_region',     critical:false, clients:.20, txn:.20, mttr:8,  deps:['cloud_provider'] },
      { id:'monitoring',        critical:false, clients:.05, txn:.02, mttr:.5, deps:['kubernetes'] },
    ],
  },
  legacy_hybrid: {
    label: 'Legacy Hybrid',
    nodes: [
      { id:'mainframe',         critical:true,  clients:.95, txn:.90, mttr:12, deps:[] },
      { id:'middleware_esb',    critical:true,  clients:.70, txn:.80, mttr:6,  deps:['mainframe'] },
      { id:'legacy_database',   critical:true,  clients:.60, txn:.75, mttr:8,  deps:['mainframe'] },
      { id:'cloud_integration', critical:true,  clients:.50, txn:.60, mttr:3,  deps:['middleware_esb'] },
      { id:'identity_mgmt',     critical:true,  clients:.90, txn:.40, mttr:4,  deps:['middleware_esb'] },
      { id:'modern_api',        critical:true,  clients:.80, txn:.70, mttr:2,  deps:['cloud_integration','legacy_database'] },
      { id:'payment_hub',       critical:true,  clients:.70, txn:.90, mttr:4,  deps:['mainframe','cloud_integration'] },
      { id:'batch_processing',  critical:true,  clients:.20, txn:.60, mttr:8,  deps:['mainframe','legacy_database'] },
      { id:'fraud_system',      critical:true,  clients:.40, txn:.70, mttr:6,  deps:['middleware_esb','legacy_database'] },
      { id:'digital_channel',   critical:false, clients:.70, txn:.50, mttr:1,  deps:['modern_api'] },
      { id:'swift_connection',  critical:true,  clients:.30, txn:.80, mttr:6,  deps:['payment_hub'] },
      { id:'reg_reporting',     critical:true,  clients:.10, txn:.20, mttr:12, deps:['batch_processing','legacy_database'] },
      { id:'market_data',       critical:false, clients:.10, txn:.10, mttr:2,  deps:['cloud_integration'] },
      { id:'disaster_recovery', critical:false, clients:.20, txn:.20, mttr:24, deps:['mainframe'] },
    ],
  },
};

// ── Exponential sample ────────────────────────────────────────────────────────
function sampleExponential(mean, rng) {
  return -mean * Math.log(1 - rng() * 0.9999);
}

// ── Single cascade path (ported from source runCascadePath) ──────────────────
function runCascadePath(nodes, nodeMap, seedIds, cascadeThreshold, mttrScale, rng) {
  const resistance = {};
  for (const n of nodes) {
    const noise = (rng() - 0.5) * 0.30;
    resistance[n.id] = Math.max(0.05, Math.min(0.95, cascadeThreshold + noise));
  }

  const failed   = new Set(seedIds);
  const failTime = {};
  for (const id of seedIds) failTime[id] = 0;

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (failed.has(node.id)) continue;
      if (!node.deps || node.deps.length === 0) continue;
      const failedDeps  = node.deps.filter(d => failed.has(d)).length;
      const failedRatio = failedDeps / node.deps.length;
      if (failedRatio >= resistance[node.id]) {
        failed.add(node.id);
        const parentTimes = node.deps.filter(d => failTime[d] !== undefined).map(d => failTime[d]);
        const baseTime    = parentTimes.length ? Math.max(...parentTimes) : 0;
        const lag         = sampleExponential(node.mttr * mttrScale * 0.15, rng);
        failTime[node.id] = baseTime + lag;
        changed = true;
      }
    }
  }

  const failedNodes = nodes.filter(n => failed.has(n.id));
  const clientsAff  = Math.min(1, failedNodes.reduce((s, n) => s + n.clients, 0));
  const txnAff      = Math.min(1, failedNodes.reduce((s, n) => s + n.txn, 0));
  const critBreach  = failedNodes.some(n => n.critical);
  const critTimes   = failedNodes.filter(n => n.critical && !seedIds.includes(n.id))
                                 .map(n => failTime[n.id] ?? 0);
  const timeToCrit  = critTimes.length ? Math.min(...critTimes) : (critBreach ? 0 : Infinity);
  const doraReport  = clientsAff >= 0.10 || txnAff >= 0.10 || critBreach;

  return {
    failedNodeIds: [...failed],
    failedCount:   failed.size,
    clientsAff,
    txnAff,
    critBreach,
    timeToCrit:    isFinite(timeToCrit) ? timeToCrit : 999,
    doraReport,
  };
}

// ── Percentile helper ─────────────────────────────────────────────────────────
function pctAt(arr, p) {
  return arr[Math.max(0, Math.min(arr.length - 1, Math.floor(arr.length * p)))];
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const topology_id       = pp.topology        ?? 'bank_core';
  const failure_node      = pp.failure_node;
  const cascade_threshold = pp.cascade_threshold ?? 0.50;
  const mttr_profile      = pp.mttr_profile     ?? 'standard';
  const n_paths           = Math.min(Math.max(pp.n_paths ?? 500, 50), 2000);
  const seed              = pp.seed             ?? 42;

  const topology = TOPOLOGIES[topology_id];
  if (!topology) {
    return {
      verdict: 'ERROR',
      error:   `Unknown topology: ${topology_id}`,
      compliance_flags: ['INVALID_TOPOLOGY'],
    };
  }

  const nodes   = topology.nodes;
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Seed nodes: always at least one (default to first node if not specified)
  const seedIds = [failure_node, pp.failure_node_2]
    .filter(Boolean)
    .filter(id => nodeMap[id]);
  if (seedIds.length === 0) {
    // Default to first node in topology
    seedIds.push(nodes[0].id);
  }

  const mttrScale = MTTR_SCALE[mttr_profile] ?? 1.0;

  // Single shared LCG (matches source: one rng object shared across all paths)
  const rng = makeLCG(seed ^ Math.round(cascade_threshold * 1e6) ^ (n_paths * 997));

  const pathResults = [];
  for (let i = 0; i < n_paths; i++) {
    pathResults.push(runCascadePath(nodes, nodeMap, seedIds, cascade_threshold, mttrScale, rng));
  }

  const ttcArr = pathResults.map(p => p.timeToCrit).sort((a, b) => a - b);
  const p5_breach_h  = +pctAt(ttcArr, 0.05).toFixed(2);
  const p25_breach_h = +pctAt(ttcArr, 0.25).toFixed(2);
  const p50_breach_h = +pctAt(ttcArr, 0.50).toFixed(2);
  const p75_breach_h = +pctAt(ttcArr, 0.75).toFixed(2);
  const p95_breach_h = +pctAt(ttcArr, 0.95).toFixed(2);

  const dora_reporting_probability = +(pathResults.filter(p => p.doraReport).length / n_paths).toFixed(3);

  const nodeFailCount = {};
  for (const n of nodes) nodeFailCount[n.id] = 0;
  for (const p of pathResults) for (const id of p.failedNodeIds) nodeFailCount[id]++;
  const node_cascade_probabilities = {};
  for (const n of nodes) {
    node_cascade_probabilities[n.id] = Math.round(nodeFailCount[n.id] / n_paths * 1000) / 1000;
  }

  const medianNodeCounts = pathResults.map(p => p.failedCount).sort((a, b) => a - b);
  const median_nodes_affected = medianNodeCounts[Math.floor(medianNodeCounts.length / 2)] ?? 0;

  // Critical path: highest-probability non-seed critical nodes
  const critPathNodes = nodes
    .filter(n => !seedIds.includes(n.id))
    .map(n => ({ id: n.id, critical: n.critical, p: node_cascade_probabilities[n.id] }))
    .filter(n => n.p > 0.01)
    .sort((a, b) => {
      if (a.critical !== b.critical) return b.critical ? 1 : -1;
      return b.p - a.p;
    });
  const critical_path_node = critPathNodes.length ? critPathNodes[0].id : (seedIds[0] ?? nodes[0].id);

  // Verdict
  let verdict;
  if (dora_reporting_probability >= 0.80)      verdict = 'CRITICAL_CASCADE';
  else if (dora_reporting_probability >= 0.50) verdict = 'HIGH_RISK';
  else if (dora_reporting_probability >= 0.25) verdict = 'MODERATE';
  else                                          verdict = 'CONTAINED';

  const compliance_flags = [];
  if (dora_reporting_probability >= 0.50) compliance_flags.push('DORA_MAJOR_INCIDENT_RISK_HIGH');
  if (dora_reporting_probability >= 0.25) compliance_flags.push('DORA_REPORTING_THRESHOLD_EXPOSURE');
  if (critPathNodes.some(n => n.critical)) compliance_flags.push('CRITICAL_FUNCTION_CASCADE_RISK');
  if (p5_breach_h < 1) compliance_flags.push('RAPID_PROPAGATION_RISK');
  if (compliance_flags.length === 0) compliance_flags.push('DORA_CASCADE_RISK_CONTAINED');

  return {
    verdict,
    p5_breach_h,
    p25_breach_h,
    p50_breach_h,
    p75_breach_h,
    p95_breach_h,
    dora_reporting_probability,
    critical_path_node,
    median_nodes_affected,
    node_cascade_probabilities,
    topology_id,
    n_paths,
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = {} } = result;
  const output_payload = result;
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
