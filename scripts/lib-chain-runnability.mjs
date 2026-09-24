#!/usr/bin/env node
/**
 * scripts/lib-chain-runnability.mjs — per-chain runnability classification
 * for the prompts.html "Every chain" rows (PROMPTS-BORROW-LABELS-1, BORROW-1
 * of RESEARCH-OCS-PROMPTS-BORROW-SCAN-2026-09-24.md).
 *
 * PURE CORE: classifyChainRows() takes already-loaded inputs and returns a
 * Map of chain id -> one of four states. No writes, no wall clock, no
 * randomness, so the page stays deterministic (PROMPT-LIBRARY-PAGE-2's
 * idempotency contract).
 *
 * THE PER-STEP RULE IS THE HOSTED WORKER'S, VERBATIM — read on the worker's
 * origin/master @ 5cc86820dd38e3c1fcca41324b8e9394db32383a at claim time
 * (2026-09-24), `run_chain` step loop:
 *   worker.mjs:2837      if (!node)          -> status 'unknown_node'
 *   worker.mjs:2838      else if (node.gpu)  -> status 'gpu_browser_only'
 *   worker.mjs:2840-2841 else if (!getKernel(tid)) -> 'no_kernel_browser_only'
 *   else the step executes server-side (status 'ok').
 * A step with any of the three refusals is a step run_chain will not execute;
 * the worker lists the browser_url for it instead of running it.
 *
 * THE FOUR PAGE STATES (chip text lives in CHIP_LABELS; gen-prompts-page.mjs
 * renders one chip per row and the section legend from these constants):
 *   server  — every step executes on the worker
 *   partial — some steps execute on the worker, the rest only in the browser
 *   browser — no step executes on the worker (legacy tools/ slugs, gpu nodes,
 *             or nodes without a kernel: every step is browser-only)
 *   reading — the id is absent from chaingraph.json's chain list entirely
 *             (the worker's run_chain answers "Unknown chain" for it)
 *
 * Inputs (read, never written): chaingraph/chaingraph.json (chain list, node
 * gpu flags) and chaingraph/kernels/index.mjs (the kernel registry the
 * worker's getKernel() dispatch reads — the same AUTO-GENERATED file
 * generate.mjs vendors into the worker's data/kernels/). Zero-dep: node
 * builtins plus first-party pure kernel modules only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KERNELS } from '../chaingraph/kernels/index.mjs';

/** Closed state enum; a validate() error if a row renders anything else. */
export const RUN_STATES = ['server', 'partial', 'browser', 'reading'];

/** Positive chip wording, one per state (⛔ no negation phrasing — the
 * ", not X" shape is a copy-hallmark violation; CONTRACT.md §1.4). */
export const CHIP_LABELS = {
  server: 'Runs on the worker',
  partial: 'Runs in part',
  browser: 'Runs in the browser',
  reading: 'Reading path',
};

/** The kernel-id set the vendored chaingraph/kernels/index.mjs serves — the
 * same registry the worker's getKernel() dispatch reads server-side. */
export const KERNEL_IDS = new Set(Object.keys(KERNELS));

/**
 * One step, one verdict — the worker's refusal ladder verbatim
 * (mcp-apps-poc worker.mjs:2837-2841 @ origin/master 5cc86820).
 * @param {string} tid tool id of the step
 * @param {{nodesById: Map<string, object>, kernelIds: Set<string>}} env
 * @returns {'unknown_node'|'gpu_browser_only'|'no_kernel_browser_only'|'ran'}
 */
export function stepStatus(tid, { nodesById, kernelIds }) {
  const node = nodesById.get(tid);
  if (!node) return 'unknown_node'; // worker.mjs:2837
  if (node.gpu) return 'gpu_browser_only'; // worker.mjs:2838
  if (!kernelIds.has(tid)) return 'no_kernel_browser_only'; // worker.mjs:2840-2841
  return 'ran';
}

/** Accepts the graph's step shape ({tool_id, …}) or a bare tool-id string. */
function stepToolId(s) {
  return typeof s === 'string' ? s : s?.tool_id;
}

/**
 * Collapse per-step statuses to the page's four-state chip.
 * A chain present in the graph with zero steps has nothing executable either;
 * it is not 'reading' (the id IS in the chain list), so 'browser' is the
 * closest truthful label. No live chain is zero-step (measured 2026-09-24:
 * all 368 graph chains carry >= 1 step).
 * @param {string[]} statuses
 * @returns {'server'|'partial'|'browser'}
 */
export function runnabilityFromStatuses(statuses) {
  const ran = statuses.filter((s) => s === 'ran').length;
  if (statuses.length && ran === statuses.length) return 'server';
  if (ran > 0) return 'partial';
  return 'browser';
}

/**
 * Classify the page's chain rows.
 * @param {Array<{id: string}>} rows the rows to label (mcp.html #workflows ids)
 * @param {object} graph parsed chaingraph.json
 * @param {Iterable<string>} [kernelIds] defaults to KERNEL_IDS
 * @returns {Map<string, 'server'|'partial'|'browser'|'reading'>}
 */
export function classifyChainRows(rows, graph, kernelIds = KERNEL_IDS) {
  const nodesById = new Map((graph.nodes ?? []).map((n) => [n.tool_id, n]));
  const chainsByName = new Map((graph.chains ?? []).map((c) => [c.name, c]));
  const kernels = kernelIds instanceof Set ? kernelIds : new Set(kernelIds);
  const out = new Map();
  for (const row of rows) {
    const chain = chainsByName.get(row.id);
    if (!chain) {
      out.set(row.id, 'reading'); // absent from the graph's chain list
      continue;
    }
    const statuses = (chain.steps ?? []).map((s) =>
      stepStatus(stepToolId(s), { nodesById, kernelIds: kernels }));
    out.set(row.id, runnabilityFromStatuses(statuses));
  }
  return out;
}

/** Read the parsed chaingraph.json. This module only ever reads it. */
export function loadChainGraph(repoRoot) {
  return JSON.parse(readFileSync(resolve(repoRoot, 'chaingraph', 'chaingraph.json'), 'utf8'));
}
