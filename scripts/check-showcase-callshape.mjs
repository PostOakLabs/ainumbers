/**
 * check-showcase-callshape.mjs — SHOWCASE-CALLSHAPE-1 (finding D7 of the MCP
 * agent-prompt audit, 2026-09-08).
 *
 * Every showcase prompt that calls a live ChainGraph node tool must show the
 * {"policy_parameters": { ... }} wrapper somewhere in its body: flat arguments
 * are discarded by the worker's zod schema (finding D2) and the call degrades
 * to browser delegation with the false "No kernel registered" stub (finding
 * D1). Entries whose tools include a gpu:true node must additionally route
 * verification in-page: a GPU node computes in the browser and the MCP
 * endpoint returns no execution_hash, so the prompt must send the agent to the
 * page-produced Policy Mandate artifact. Any entry instructing
 * verify_execution_hash must name its real parameter, claimed_hash (finding
 * D4, consistent with ASKAGENT-CALLSHAPE-1).
 *
 * Exit 0 clean; exit 1 listing every violating entry id and rule.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const prompts = JSON.parse(readFileSync(join(repoRoot, 'mcp', 'showcase-prompts.json'), 'utf8'));
const graph = JSON.parse(readFileSync(join(repoRoot, 'chaingraph', 'chaingraph.json'), 'utf8'));
const nodes = Array.isArray(graph) ? graph : Object.values(graph.nodes ?? graph);
const nodeName = new Map(nodes.map((n) => [n.mcp_name, n]));
const gpuNames = new Set(nodes.filter((n) => n.gpu === true).map((n) => n.mcp_name));

const WRAPPER = 'policy_parameters';
const IN_PAGE_MARKER = 'computes in your browser';
const problems = [];
let checked = 0;
let gpuChecked = 0;

for (const entry of prompts) {
  const id = entry.id ?? entry.slug ?? entry.title ?? '<untitled>';
  const tools = Array.isArray(entry.tools) ? entry.tools : [];
  const body = typeof entry.body === 'string' ? entry.body : JSON.stringify(entry.body ?? '');
  const nodeHits = tools.filter((t) => nodeName.has(t));
  if (nodeHits.length === 0) continue;
  checked++;
  const touchesGpu = nodeHits.some((t) => gpuNames.has(t));
  if (touchesGpu) gpuChecked++;
  if (!body.includes(WRAPPER)) {
    problems.push(`${id}: calls node tool(s) ${nodeHits.join(', ')} but never shows the ${WRAPPER} wrapper`);
  }
  if (touchesGpu && !body.includes(IN_PAGE_MARKER)) {
    problems.push(`${id}: calls gpu node tool(s) ${nodeHits.filter((t) => gpuNames.has(t)).join(', ')} but does not route the run in-page (must say the tool ${IN_PAGE_MARKER} and the artifact is passed to verify_execution_hash as a full artifact)`);
  }
  if (body.includes('verify_execution_hash') && !body.includes('claimed_hash')) {
    problems.push(`${id}: instructs verify_execution_hash without naming its parameter claimed_hash`);
  }
}

if (problems.length) {
  console.error(`✗ showcase call-shape FAILED (${problems.length} of ${checked} node-calling entries, ${gpuChecked} gpu-touching):`);
  for (const p of problems) console.error(`    ${p}`);
  process.exit(1);
}
console.log(`✓ showcase call-shape OK: ${checked} node-calling entries all show the ${WRAPPER} wrapper, ${gpuChecked} gpu-touching entries route in-page, verify sentences name claimed_hash.`);
