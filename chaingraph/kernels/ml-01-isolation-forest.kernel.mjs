export const meta = {
  tool_id: 'ml-01-isolation-forest',
  mcp_name: 'detect_transaction_anomalies',
  mandate_type: 'risk_control',
};

function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randn(rng) {
  const u1 = rng() + 1e-15;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function cN(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
}

const features = ['amount', 'hour', 'cptyFreq', 'recency'];

function buildITree(data, maxDepth, rng) {
  if (data.length <= 1 || maxDepth === 0) return { leaf: true, size: data.length };
  const feat = features[Math.floor(rng() * features.length)];
  const vals = data.map(d => d[feat]);
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  if (mn === mx) return { leaf: true, size: data.length };
  const split = mn + rng() * (mx - mn);
  const left = data.filter(d => d[feat] < split);
  const right = data.filter(d => d[feat] >= split);
  return { feat, split, left: buildITree(left, maxDepth - 1, rng), right: buildITree(right, maxDepth - 1, rng) };
}

function pathLen(node, x, depth) {
  if (node.leaf) return depth + cN(node.size);
  return x[node.feat] < node.split ? pathLen(node.left, x, depth + 1) : pathLen(node.right, x, depth + 1);
}

export function compute(pp) {
  const nTxns = Math.min(Number(pp.n_transactions) || 1000, 5000);
  const contamination = Number(pp.contamination_rate) || 0.05;
  const nAnomaly = Math.round(nTxns * contamination);
  const seed = Number(pp.seed) || 42;
  const nTrees = Number(pp.n_trees) || 10;
  const subsample = Number(pp.subsample_size) || 128;
  const threshold = Number(pp.threshold) || 0.60;

  const genRng = makeLCG(seed);
  const txns = [];

  for (let i = 0; i < nTxns - nAnomaly; i++) {
    txns.push({
      amount: 0.05 + genRng() * 0.45,
      hour: (6 + genRng() * 14) / 24,
      cptyFreq: 0.1 + genRng() * 0.7,
      recency: 0.2 + genRng() * 0.6,
      isAnomaly: false,
    });
  }

  for (let i = 0; i < nAnomaly; i++) {
    const aType = i % 3;
    if (aType === 0) {
      txns.push({ amount: 0.85 + genRng() * 0.15, hour: 0.3 + genRng() * 0.4, cptyFreq: 0.2 + genRng() * 0.4, recency: 0.3 + genRng() * 0.5, isAnomaly: true });
    } else if (aType === 1) {
      txns.push({ amount: 0.1 + genRng() * 0.3, hour: genRng() * 0.15, cptyFreq: genRng() * 0.15, recency: genRng() * 0.2, isAnomaly: true });
    } else {
      txns.push({ amount: 0.7 + genRng() * 0.3, hour: genRng() * 0.1, cptyFreq: genRng() * 0.1, recency: genRng() * 0.15, isAnomaly: true });
    }
  }

  // Fisher-Yates shuffle
  const shufRng = makeLCG(seed + 1000);
  for (let i = txns.length - 1; i > 0; i--) {
    const j = Math.floor(shufRng() * (i + 1));
    [txns[i], txns[j]] = [txns[j], txns[i]];
  }

  const maxDepth = Math.ceil(Math.log2(subsample));
  const trees = [];
  for (let t = 0; t < nTrees; t++) {
    const tRng = makeLCG(seed + 1 + t * 31337);
    const avail = [...Array(txns.length).keys()];
    const sampleIdx = [];
    const sRng = makeLCG(seed + t * 31337 + 999);
    const sampleSize = Math.min(subsample, txns.length);
    for (let i = 0; i < sampleSize; i++) {
      const j = Math.floor(sRng() * (avail.length - i));
      sampleIdx.push(avail[j]);
      avail[j] = avail[avail.length - 1 - i];
    }
    const subsampleData = sampleIdx.map(i => txns[i]);
    trees.push(buildITree(subsampleData, maxDepth, tRng));
  }

  const scores = txns.map(t => {
    const avgLen = trees.reduce((s, tree) => s + pathLen(tree, t, 0), 0) / trees.length;
    return Math.pow(2, -avgLen / cN(subsample));
  });

  const flagged = scores.filter(s => s >= threshold);
  const flagRate = flagged.length / nTxns;
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sortedScores = [...scores].sort((a, b) => a - b);
  const p95 = sortedScores[Math.floor(nTxns * 0.95)];
  const maxScore = sortedScores[sortedScores.length - 1];

  const verdict = flagRate > 0.10
    ? 'CRITICAL — High Anomaly Rate Detected'
    : flagRate > 0.05
      ? 'ELEVATED — Anomaly Rate Above Baseline'
      : 'NORMAL — Anomaly Rate Within Baseline';

  const complianceFlags = [
    'ANOMALY_DETECTION_COMPLETED',
    'EU_AI_ACT_RISK_SYSTEM_USED',
    'AMLA_SUSPICIOUS_TRANSACTION_PROFILING',
    'FCA_CONSUMER_DUTY_OUTCOME_MONITORING',
    flagRate > 0.10 ? 'SAR_REVIEW_RECOMMENDED' : 'BATCH_WITHIN_BASELINE',
  ];

  return {
    verdict,
    flagged_count: flagged.length,
    flag_rate: +flagRate.toFixed(4),
    mean_anomaly_score: +meanScore.toFixed(4),
    p95_anomaly_score: +p95.toFixed(4),
    max_anomaly_score: +maxScore.toFixed(4),
    threshold,
    n_transactions_scored: nTxns,
    compliance_flags: complianceFlags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    output_payload: result,
    compliance_flags: result.compliance_flags,
  };
}
