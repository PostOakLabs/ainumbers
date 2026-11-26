#!/usr/bin/env node
// zk-trust-inventory.mjs -- ZK-TRUST-INVENTORY-1. Per-node trust stage, computed from data.
//
// The trust-model page needs its stage counts derived, never typed (count-drift gate). Ladder:
//   S0  source only         live node with no well-formed compute_proof
//   S1  sealed              classifyNode() (the section 18 gate's own classifier) says 'proven'
//   S2  sealed + FV         S1 and a chaingraph/fv-pilot record with a non-empty evidence_vector whose
//                           kernel_digest_at_authoring still equals the kernel's live sourceDigest
//   S3  sealed + chain      S1 and the node is a step of a chain whose L1 edge-contract verdict is
//                           'L1-pass' (check-chain-edge-contracts.mjs buildReport)
// A node meeting both S2 and S3 reports stage S3 and both flags (fv_evidence, chain_contract); the flags
// carry the full picture, the stage is the highest rung reached.
//
// Also emitted: imageId groups (compute_proof.imageId), the caller-attested node list (kernel source or
// node shard text saying "caller-attested"), and per-node anchor legs. Leg names come from the node's
// compute_images[].system entries (the source-hash leg and the zkVM leg) plus 'groth16-bn254-seal' /
// 'stark-seal' when a well-formed receipt is attached; no other anchor data lives on the node.
//
// Usage:  node scripts/zk-trust-inventory.mjs [--fixture <abs path to json>] [--summary]
//   stdout: JSON, deterministic ordering. Exit 1 on an unknown stage or unreadable input.
// Read-only: never writes chaingraph.json or any other artifact. Node builtins plus sibling scripts only.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyNode } from './check-compute-proof-coverage.mjs';
import { sourceDigest, normDigest } from '../chaingraph/kernels/_buildid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

export const STAGES = ['S0', 'S1', 'S2', 'S3'];
const ATTESTED_RE = /caller[- ]attested/i;

const byStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function tally(stageList) {
  const out = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const s of stageList) {
    if (!STAGES.includes(s)) throw new Error(`unknown trust stage ${JSON.stringify(s)} (known: ${STAGES.join(', ')})`);
    out[s]++;
  }
  return out;
}

function hasEvidence(rec, currentDigest) {
  const ev = rec?.evidence_vector;
  const nonEmpty = Array.isArray(ev) ? ev.length > 0 : !!ev && typeof ev === 'object' && Object.keys(ev).length > 0;
  if (!nonEmpty) return false;
  return currentDigest == null || normDigest(rec.kernel_digest_at_authoring) === currentDigest;
}

// Pure core. inputs: { nodes, chainVerdicts: [{steps:[tool_id], verdict}], fvRecords: {tool_id: rec},
// currentDigests: {tool_id: digest}, attestedIds: [tool_id] }
export function computeInventory({ nodes, chainVerdicts = [], fvRecords = {}, currentDigests = {}, attestedIds = [] }) {
  const live = nodes.filter((n) => n.status === 'live').sort((a, b) => byStr(a.tool_id, b.tool_id));
  const passSteps = new Set();
  for (const c of chainVerdicts) if (c.verdict === 'L1-pass') for (const t of c.steps) passSteps.add(t);

  const perNode = [];
  const groups = new Map();
  for (const n of live) {
    const sealed = classifyNode(n).state === 'proven';
    const cp = n.audit_signature?.compute_proof ?? n.compute_proof;
    const fv = sealed && hasEvidence(fvRecords[n.tool_id], currentDigests[n.tool_id]);
    const chain = sealed && passSteps.has(n.tool_id);
    let stage = !sealed ? 'S0' : chain ? 'S3' : fv ? 'S2' : 'S1';
    if (n.declared_stage !== undefined) {
      if (!STAGES.includes(n.declared_stage)) throw new Error(`unknown trust stage ${JSON.stringify(n.declared_stage)} on ${n.tool_id} (known: ${STAGES.join(', ')})`);
      stage = n.declared_stage;
    }
    const legs = [...new Set((n.compute_images ?? []).map((i) => i.system).filter(Boolean))];
    if (sealed && cp?.receiptFormat) legs.push(`${cp.receiptFormat}-seal`);
    perNode.push({ tool_id: n.tool_id, stage, fv_evidence: fv, chain_contract: chain, anchor_legs: legs.sort(byStr) });
    if (typeof cp?.imageId === 'string') {
      if (!groups.has(cp.imageId)) groups.set(cp.imageId, []);
      groups.get(cp.imageId).push(n.tool_id);
    }
  }
  const imageGroups = [...groups.entries()]
    .map(([image_id, ids]) => ({ image_id, count: ids.length, nodes: ids.sort(byStr) }))
    .sort((a, b) => b.count - a.count || byStr(a.image_id, b.image_id));
  const liveIds = new Set(live.map((n) => n.tool_id));
  return {
    live_nodes: live.length,
    stage_counts: tally(perNode.map((p) => p.stage)),
    flag_counts: { fv_evidence: perNode.filter((p) => p.fv_evidence).length, chain_contract: perNode.filter((p) => p.chain_contract).length },
    unsealed: perNode.filter((p) => p.stage === 'S0').map((p) => p.tool_id),
    image_id_group_counts: imageGroups.map((g) => g.count),
    image_id_groups: imageGroups,
    caller_attested: [...new Set(attestedIds)].filter((t) => liveIds.has(t)).sort(byStr),
    nodes: perNode,
  };
}

// ── disk loaders (all read-only) ─────────────────────────────────────────────────────────────────
export function loadFvRecords(root = REPO) {
  const dir = resolve(root, 'chaingraph', 'fv-pilot');
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const rec = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
    if (rec.tool_id) out[rec.tool_id] = rec;
  }
  return out;
}

export async function loadCurrentDigests(toolIds, root = REPO) {
  const out = {};
  for (const t of toolIds) {
    const p = resolve(root, 'chaingraph', 'kernels', `${t}.kernel.mjs`);
    if (existsSync(p)) out[t] = normDigest(await sourceDigest(readFileSync(p, 'utf8')));
  }
  return out;
}

export function findAttested(toolIds, root = REPO) {
  const hits = [];
  for (const t of toolIds) {
    const k = resolve(root, 'chaingraph', 'kernels', `${t}.kernel.mjs`);
    const s = resolve(root, 'chaingraph', 'graph', 'nodes', `${t}.json`);
    if ((existsSync(k) && ATTESTED_RE.test(readFileSync(k, 'utf8'))) || (existsSync(s) && ATTESTED_RE.test(readFileSync(s, 'utf8')))) hits.push(t);
  }
  return hits;
}

// Used by counts.mjs: chaingraph + the already-built L1 report, everything else from the checkout.
export async function deriveFromGraph(chaingraph, l1Report, root = REPO) {
  const nodes = chaingraph.nodes ?? [];
  const liveIds = nodes.filter((n) => n.status === 'live').map((n) => n.tool_id);
  const chainSteps = new Map((chaingraph.chains ?? []).map((c) => [c.name, (c.steps ?? []).map((s) => s.tool_id)]));
  const chainVerdicts = (l1Report?.chains ?? []).map((c) => ({ verdict: c.verdict, steps: chainSteps.get(c.name) ?? [] }));
  return computeInventory({
    nodes, chainVerdicts,
    fvRecords: loadFvRecords(root),
    currentDigests: await loadCurrentDigests(liveIds, root),
    attestedIds: findAttested(liveIds, root),
  });
}

// Count keys for the verify-counts sentinel mechanism (<!--COUNT:trust.S1-->N<!--/COUNT-->).
export function trustCountKeys(inv) {
  return {
    'trust.S0': inv.stage_counts.S0,
    'trust.S1': inv.stage_counts.S1,
    'trust.S2': inv.stage_counts.S2,
    'trust.S3': inv.stage_counts.S3,
    'trust.sealed': inv.live_nodes - inv.stage_counts.S0,
    'trust.live': inv.live_nodes,
    'trust.fvEvidence': inv.flag_counts.fv_evidence,
    'trust.chainContract': inv.flag_counts.chain_contract,
    'trust.imageIdGroups': inv.image_id_groups.length,
    'trust.callerAttested': inv.caller_attested.length,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const fi = argv.indexOf('--fixture');
  let inv;
  if (fi >= 0) {
    inv = computeInventory(JSON.parse(readFileSync(argv[fi + 1], 'utf8')));
  } else {
    const chaingraph = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
    const { buildReport } = await import('./check-chain-edge-contracts.mjs');
    inv = await deriveFromGraph(chaingraph, buildReport(REPO), REPO);
  }
  const out = argv.includes('--summary') ? { ...inv, nodes: undefined, image_id_groups: undefined } : inv;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`zk-trust-inventory: ${e.message}`); process.exit(1); });
}
