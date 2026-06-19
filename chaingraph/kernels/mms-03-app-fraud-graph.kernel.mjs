/**
 * mms-03-app-fraud-graph.kernel.mjs
 * APP Fraud Graph Simulator — LCG PRNG, Monte Carlo BFS propagation.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

export const meta = {
  tool_id:      'mms-03-app-fraud-graph',
  mcp_name:     'simulate_app_fraud_graph',
  mandate_type: 'aml_rule',
  version:      '1.0.0',
};

// ── LCG (matches source HTML makeLCG) ────────────────────────────────────────
function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── Topology definitions (ported from source TOPOLOGIES) ─────────────────────
const TOPOLOGIES = {
  retail_network: {
    nodes: [
      {id:'victim_001',  type:'victim',      balance:12500,  psr_eligible:true,  connections:['mule_A','clean_001','clean_002']},
      {id:'victim_002',  type:'victim',      balance:8200,   psr_eligible:true,  connections:['mule_A','clean_003']},
      {id:'victim_003',  type:'victim',      balance:22000,  psr_eligible:true,  connections:['mule_B','clean_004','victim_004']},
      {id:'victim_004',  type:'victim',      balance:4500,   psr_eligible:true,  connections:['victim_003','clean_005']},
      {id:'mule_A',      type:'mule',        balance:500,    psr_eligible:false, connections:['beneficiary_001','clean_006'], is_seed:true},
      {id:'mule_B',      type:'mule',        balance:300,    psr_eligible:false, connections:['beneficiary_002','clean_007'], is_seed:true},
      {id:'beneficiary_001', type:'beneficiary', balance:0, psr_eligible:false, connections:[]},
      {id:'beneficiary_002', type:'beneficiary', balance:0, psr_eligible:false, connections:[]},
      {id:'clean_001',   type:'clean',       balance:3000,   psr_eligible:true,  connections:['clean_008']},
      {id:'clean_002',   type:'clean',       balance:5500,   psr_eligible:true,  connections:[]},
      {id:'clean_003',   type:'clean',       balance:1200,   psr_eligible:true,  connections:['clean_009']},
      {id:'clean_004',   type:'clean',       balance:9000,   psr_eligible:true,  connections:[]},
      {id:'clean_005',   type:'clean',       balance:2100,   psr_eligible:true,  connections:[]},
      {id:'clean_006',   type:'clean',       balance:4400,   psr_eligible:true,  connections:['victim_005']},
      {id:'clean_007',   type:'clean',       balance:6700,   psr_eligible:true,  connections:[]},
      {id:'clean_008',   type:'clean',       balance:800,    psr_eligible:true,  connections:[]},
      {id:'clean_009',   type:'clean',       balance:1600,   psr_eligible:true,  connections:[]},
      {id:'victim_005',  type:'victim',      balance:15000,  psr_eligible:true,  connections:['mule_A']},
      {id:'victim_006',  type:'victim',      balance:6800,   psr_eligible:true,  connections:['mule_B','clean_003']},
      {id:'aggregator',  type:'clean',       balance:0,      psr_eligible:false, connections:['beneficiary_001','beneficiary_002']},
    ],
  },
  corporate_sweep: {
    nodes: [
      {id:'corp_victim_A',    type:'victim',      balance:180000, psr_eligible:false, connections:['mule_corp','clean_corp_1','clean_corp_2']},
      {id:'corp_victim_B',    type:'victim',      balance:95000,  psr_eligible:false, connections:['clean_corp_1','clean_corp_3']},
      {id:'mule_corp',        type:'mule',        balance:1000,   psr_eligible:false, connections:['beneficiary_corp_1','beneficiary_corp_2'], is_seed:true},
      {id:'beneficiary_corp_1', type:'beneficiary', balance:0,   psr_eligible:false, connections:[]},
      {id:'beneficiary_corp_2', type:'beneficiary', balance:0,   psr_eligible:false, connections:[]},
      {id:'clean_corp_1',     type:'clean',       balance:50000,  psr_eligible:false, connections:['clean_corp_4']},
      {id:'clean_corp_2',     type:'clean',       balance:30000,  psr_eligible:false, connections:[]},
      {id:'clean_corp_3',     type:'clean',       balance:120000, psr_eligible:false, connections:['clean_corp_5']},
      {id:'clean_corp_4',     type:'clean',       balance:15000,  psr_eligible:false, connections:[]},
      {id:'clean_corp_5',     type:'clean',       balance:200000, psr_eligible:true,  connections:[]},
      {id:'treasury',         type:'victim',      balance:500000, psr_eligible:false, connections:['mule_corp','clean_corp_1']},
      {id:'correspondent',    type:'clean',       balance:0,      psr_eligible:false, connections:['beneficiary_corp_1','beneficiary_corp_2']},
    ],
  },
  mule_dense: {
    nodes: [
      {id:'victim_D1',  type:'victim', balance:9000,  psr_eligible:true,  connections:['mule_1','mule_2','clean_D1']},
      {id:'victim_D2',  type:'victim', balance:14000, psr_eligible:true,  connections:['mule_3','clean_D2']},
      {id:'victim_D3',  type:'victim', balance:6500,  psr_eligible:true,  connections:['mule_4','mule_5','clean_D3']},
      {id:'victim_D4',  type:'victim', balance:21000, psr_eligible:true,  connections:['mule_1','clean_D4']},
      {id:'victim_D5',  type:'victim', balance:3800,  psr_eligible:true,  connections:['mule_6','clean_D1']},
      {id:'mule_1',     type:'mule',   balance:200,   psr_eligible:false, connections:['mule_2','beneficiary_D1'], is_seed:true},
      {id:'mule_2',     type:'mule',   balance:150,   psr_eligible:false, connections:['mule_3','beneficiary_D2'], is_seed:true},
      {id:'mule_3',     type:'mule',   balance:300,   psr_eligible:false, connections:['mule_4','beneficiary_D1'], is_seed:true},
      {id:'mule_4',     type:'mule',   balance:100,   psr_eligible:false, connections:['mule_5','beneficiary_D3'], is_seed:true},
      {id:'mule_5',     type:'mule',   balance:250,   psr_eligible:false, connections:['beneficiary_D2','beneficiary_D3'], is_seed:true},
      {id:'mule_6',     type:'mule',   balance:180,   psr_eligible:false, connections:['mule_1','beneficiary_D1'], is_seed:true},
      {id:'beneficiary_D1', type:'beneficiary', balance:0, psr_eligible:false, connections:[]},
      {id:'beneficiary_D2', type:'beneficiary', balance:0, psr_eligible:false, connections:[]},
      {id:'beneficiary_D3', type:'beneficiary', balance:0, psr_eligible:false, connections:[]},
      {id:'clean_D1',   type:'clean',  balance:4500,  psr_eligible:true,  connections:['clean_D5']},
      {id:'clean_D2',   type:'clean',  balance:7200,  psr_eligible:true,  connections:[]},
      {id:'clean_D3',   type:'clean',  balance:2100,  psr_eligible:true,  connections:[]},
      {id:'clean_D4',   type:'clean',  balance:8800,  psr_eligible:true,  connections:[]},
      {id:'clean_D5',   type:'clean',  balance:3300,  psr_eligible:true,  connections:['victim_D4']},
      {id:'victim_D6',  type:'victim', balance:17500, psr_eligible:true,  connections:['mule_2','mule_6']},
      {id:'victim_D7',  type:'victim', balance:5100,  psr_eligible:true,  connections:['mule_3','mule_4']},
      {id:'victim_D8',  type:'victim', balance:11200, psr_eligible:true,  connections:['mule_5']},
      {id:'victim_D9',  type:'victim', balance:3600,  psr_eligible:true,  connections:['mule_1','clean_D2']},
      {id:'victim_D10', type:'victim', balance:8900,  psr_eligible:true,  connections:['mule_6','clean_D3']},
      {id:'aggregator_D', type:'clean', balance:0,   psr_eligible:false, connections:['beneficiary_D1','beneficiary_D2','beneficiary_D3']},
    ],
  },
};

// ── Quantile helper ───────────────────────────────────────────────────────────
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo  = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ── Single BFS path (ported from source runOnePath) ───────────────────────────
function runOnePath(nodes, seeds, detectionRate, psrThreshold, rng) {
  const seed    = seeds[Math.floor(rng() * seeds.length)];
  const reached = new Set([seed.id]);
  const queue   = [seed.id];
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  let hop = 0, detectionHop = 0, detected = false;

  while (queue.length > 0 && !detected) {
    const current = queue.shift();
    const node    = nodeMap[current];
    hop++;
    for (const connId of (node.connections ?? [])) {
      if (reached.has(connId)) continue;
      if (rng() < detectionRate) { detected = true; detectionHop = hop; break; }
      reached.add(connId);
      queue.push(connId);
    }
  }

  let loss = 0;
  reached.forEach(id => {
    const n = nodeMap[id];
    if (n && (n.type === 'victim' || n.type === 'clean') && n.balance > 0) loss += n.balance;
  });

  return { reached: [...reached], loss, detectionHop };
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const topology_id    = pp.topology    ?? 'retail_network';
  const n_paths        = Math.min(Math.max(pp.n_paths ?? 300, 10), 2000);
  const detection_rate = pp.detection_rate ?? 0.20;
  const psr_threshold  = pp.psr_threshold  ?? 85000;   // UK PSR £85k reimbursement cap
  const seed_base      = pp.seed           ?? 42;

  const topo = TOPOLOGIES[topology_id];
  if (!topo) {
    return {
      fraud_verdict: 'ERROR',
      error: `Unknown topology: ${topology_id}`,
      compliance_flags: ['INVALID_TOPOLOGY'],
    };
  }

  const nodes = topo.nodes;
  const seeds = nodes.filter(n => n.is_seed);

  const reachCount   = {};
  const lossPerPath  = [];
  const detectionHops = [];
  nodes.forEach(n => { reachCount[n.id] = 0; });

  for (let p = 0; p < n_paths; p++) {
    const rng    = makeLCG(p * 7919 + seed_base);
    const result = runOnePath(nodes, seeds, detection_rate, psr_threshold, rng);
    result.reached.forEach(id => { reachCount[id]++; });
    lossPerPath.push(result.loss);
    detectionHops.push(result.detectionHop);
  }

  const reachProb = {};
  nodes.forEach(n => { reachProb[n.id] = reachCount[n.id] / n_paths; });

  const totalLoss = lossPerPath.reduce((a, b) => a + b, 0);
  const meanLoss  = totalLoss / n_paths;
  const sortedLoss = [...lossPerPath].sort((a, b) => a - b);
  const lossP95   = quantile(sortedLoss, 0.95);
  const psrP      = lossPerPath.filter(l => l > psr_threshold).length / n_paths;
  const validHops = detectionHops.filter(h => h > 0);
  const meanDetectHop = validHops.length > 0
    ? validHops.reduce((a, b) => a + b, 0) / validHops.length
    : 0;

  const fraud_verdict = psrP >= 0.5 ? 'CRITICAL' : psrP >= 0.2 ? 'HIGH' : 'CONTAINED';

  const compliance_flags = [
    'UK_PSR_REIMBURSEMENT_ASSESSED',
    'EBA_FRAUD_MONITORING_GUIDELINES',
    'SEPA_INSTANT_SCT_FRAUD_REVIEW',
    'PSD2_TRANSACTION_MONITORING',
    psrP >= 0.5 ? 'PSR_BREACH_LIKELY' : 'PSR_BREACH_UNLIKELY',
  ];

  return {
    fraud_verdict,
    mean_loss_at_risk:              +meanLoss.toFixed(2),
    loss_p95:                       +lossP95.toFixed(2),
    psr_threshold_breach_probability: +psrP.toFixed(4),
    mean_detection_hop:             +meanDetectHop.toFixed(2),
    node_reach_probabilities:       Object.fromEntries(
      Object.entries(reachProb).map(([k, v]) => [k, +v.toFixed(4)])
    ),
    n_paths,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:                          meta.tool_id,
    mandate_type:                     meta.mandate_type,
    fraud_verdict:                    r.fraud_verdict,
    mean_loss_at_risk:                r.mean_loss_at_risk,
    loss_p95:                         r.loss_p95,
    psr_threshold_breach_probability: r.psr_threshold_breach_probability,
    mean_detection_hop:               r.mean_detection_hop,
    compliance_flags:                 r.compliance_flags,
    inputs:                           pp,
  };
}
