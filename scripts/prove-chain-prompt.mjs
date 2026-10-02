#!/usr/bin/env node
/**
 * scripts/prove-chain-prompt.mjs — CHAIN-PROMPT-INFRA-1
 *
 * WHY: a `try_changing` is only worth shipping if a live run proves the change
 * moves `look_at` (Tim's ruling, 2026-09-27). Proving that by hand costs real
 * context: measured in the pilot, a base plus variant pair of raw `run_chain`
 * responses averages 115 KB, roughly 29K tokens, and the 244-chain corpus is
 * about 28 MB. So this helper prints EXTRACTS ONLY, about 20 lines per chain,
 * and NEVER a response body (decision F8). That is what makes a backfill row of
 * 20 chains affordable.
 *
 * WHAT IT PRINTS: per-step statuses, the `look_at` value in the base run and in
 * the variant run with a MOVED / UNCHANGED verdict, and both composite hashes.
 *
 * THE VARIANT, and why a value_note needs a file: the prompt tells an agent to
 * reuse the values the first result echoed and change one field. For a scalar
 * `value` this helper does exactly that, from the step's own echoed output
 * intersected with its manifest inputSchema. A `value_note` describes an edit to
 * an object or an array field, which no deterministic rule can synthesise, so
 * pass the step-keyed inputs with `--variant <file.json>`.
 *
 * ⚠ The variant never reproduces the base composite hash, and that is expected,
 * not a defect: the echoed set carries derived fields the fixture omits and
 * `policy_parameters` is in the hash preimage, so a reconstructed run is
 * answer-faithful and hash-divergent (the pilot's echo control proved it). Only
 * the `look_at` value is compared.
 *
 * ADVISORY BY DESIGN: the endpoint is live, so an unreachable or erroring server
 * prints the reason and exits 0. This helper is a proving aid for an author, not
 * a gate, and it is never wired into preflight.
 *
 * Usage:
 *   node scripts/prove-chain-prompt.mjs <chain>
 *   node scripts/prove-chain-prompt.mjs <chain> --variant <inputs.json>
 *   node scripts/prove-chain-prompt.mjs <chain> --base-only
 *
 * Zero-dependency: node builtins only. Read-only against the live worker.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MCP_URL = 'https://mcp.ainumbers.co/mcp';
const TIMEOUT_MS = 60_000;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

/** The live endpoint answers tools/call as text/event-stream; a client that
 *  parses only application/json reads nothing. Handle both. */
function parseEnvelope(body) {
  const trimmed = body.trimStart();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const datas = body.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean);
  if (!datas.length) throw new Error('no SSE data line in the response');
  return JSON.parse(datas.join(''));
}

async function runChain(args) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_chain', arguments: args } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  const bytes = text.length;
  const env = parseEnvelope(text);
  if (env.error) throw new Error(`JSON-RPC error code ${env.error.code}`);
  const blocks = env.result?.content ?? [];
  let payload = env.result?.structuredContent;
  if (!payload) {
    const t = blocks.find((b) => b.type === 'text');
    if (t) payload = JSON.parse(t.text);
  }
  if (!payload) throw new Error('response carried no structured payload');
  return { payload, bytes };
}

function steps(payload) {
  return payload.composite_artifact?.output_payload?.steps ?? payload.steps ?? [];
}

function stepOf(payload, toolId) {
  return steps(payload).find((s) => s.tool_id === toolId) ?? null;
}

function pick(obj, path) {
  return path.split('.').reduce((cur, part) => (cur == null ? cur : (/^\d+$/.test(part) ? cur[Number(part)] : cur[part])), obj);
}

function inputSchemaProps(toolId) {
  const p = resolve(REPO, 'manifests', `${toolId}.manifest.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'))?.mcp_tool_definition?.inputSchema?.properties ?? null;
  } catch {
    return null;
  }
}

/** Echo-derived variant inputs for a scalar `value`: the step's own echoed
 *  output fields that its manifest declares as inputs, with the one field
 *  changed. The same reconstruction the rendered prompt asks an agent for. */
function echoVariant(payload, tc) {
  const step = stepOf(payload, tc.step);
  const props = inputSchemaProps(tc.step);
  if (!step || !props) return null;
  const echoed = {};
  for (const k of Object.keys(props)) {
    if (step.output_payload && Object.prototype.hasOwnProperty.call(step.output_payload, k)) echoed[k] = step.output_payload[k];
  }
  echoed[tc.field] = tc.value;
  return { [tc.step]: echoed };
}

async function main() {
  const chain = process.argv[2];
  if (!chain || chain.startsWith('--')) {
    console.error('usage: node scripts/prove-chain-prompt.mjs <chain> [--variant <inputs.json>] [--base-only]');
    process.exit(2);
  }
  const promptPath = resolve(REPO, 'chaingraph', 'chain-prompts', `${chain}.json`);
  if (!existsSync(promptPath)) {
    console.error(`prove-chain-prompt: no prompt file at chaingraph/chain-prompts/${chain}.json`);
    process.exit(2);
  }
  const prompt = JSON.parse(readFileSync(promptPath, 'utf8'));
  const tc = prompt.try_changing;
  const dot = prompt.look_at.indexOf('.');
  const lookStep = prompt.look_at.slice(0, dot);
  const lookPath = prompt.look_at.slice(dot + 1);

  console.log(`chain = ${chain} | look_at = ${prompt.look_at}`);

  let base;
  try {
    base = await runChain({ chain });
  } catch (e) {
    console.log(`ADVISORY: the live server did not answer a base run (${e.message}). Exit 0, nothing proved.`);
    return;
  }
  const baseStepCount = steps(base.payload).length;
  console.log(`base run: ${baseStepCount} step(s), ${base.bytes} response bytes (body never printed)`);
  for (const s of steps(base.payload)) {
    console.log(`  step ${s.tool_id} | status=${s.status ?? (s.error ? 'error' : 'ok')}${s.execution_hash ? ` | exec=${String(s.execution_hash).slice(0, 12)}` : ''}`);
  }
  console.log(`base composite = ${base.payload.composite_execution_hash}`);
  if (base.payload.hash_valid !== undefined) console.log(`base hash_valid = ${JSON.stringify(base.payload.hash_valid)}`);
  const baseStep = stepOf(base.payload, lookStep);
  if (!baseStep) {
    console.log(`ADVISORY: step ${lookStep} is absent from the base response, so look_at could not be read. Exit 0.`);
    return;
  }
  const baseValue = JSON.stringify(pick(baseStep.output_payload, lookPath));
  console.log(`FIELD ${lookPath} | base = ${baseValue}`);

  if (process.argv.includes('--base-only') || !tc) {
    if (!tc) console.log('this prompt carries no try_changing, so there is no variant to run.');
    return;
  }

  const variantFile = arg('--variant');
  let inputs = null;
  if (variantFile) {
    inputs = JSON.parse(readFileSync(resolve(variantFile), 'utf8'));
  } else if (Object.prototype.hasOwnProperty.call(tc, 'value')) {
    inputs = echoVariant(base.payload, tc);
    if (!inputs) {
      console.log(`ADVISORY: could not reconstruct the echoed inputs for ${tc.step}. Pass --variant <inputs.json>. Exit 0.`);
      return;
    }
  } else {
    console.log(`ADVISORY: try_changing carries value_note ("${tc.value_note}"), which names an edit to a structured field. Pass --variant <inputs.json> with that step's inputs. Exit 0.`);
    return;
  }

  let variant;
  try {
    variant = await runChain({ chain, inputs });
  } catch (e) {
    console.log(`ADVISORY: the live server did not answer the variant run (${e.message}). Exit 0, variant not proved.`);
    return;
  }
  console.log(`variant run: ${steps(variant.payload).length} step(s), ${variant.bytes} response bytes (body never printed)`);
  for (const s of steps(variant.payload)) {
    console.log(`  step ${s.tool_id} | status=${s.status ?? (s.error ? 'error' : 'ok')}${s.execution_hash ? ` | exec=${String(s.execution_hash).slice(0, 12)}` : ''}`);
  }
  console.log(`variant composite = ${variant.payload.composite_execution_hash}`);
  if (variant.payload.hash_valid !== undefined) console.log(`variant hash_valid = ${JSON.stringify(variant.payload.hash_valid)}`);
  const varStep = stepOf(variant.payload, lookStep);
  const varValue = varStep ? JSON.stringify(pick(varStep.output_payload, lookPath)) : '(step absent)';
  console.log(`FIELD ${lookPath} | base = ${baseValue} | variant = ${varValue} | ${baseValue === varValue ? 'UNCHANGED' : 'MOVED'}`);
  if (baseValue === varValue) {
    console.log('ADVISORY: this try_changing does not move look_at on a live run, so it fails the rubric. Choose another input or another field.');
  }
  console.log('note: the two composite hashes differ by construction (the echoed set carries derived fields the fixture omits). Only the look_at value is the proof.');
}

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (IS_CLI) main().catch((e) => { console.error(`prove-chain-prompt: ${e.stack || e.message}`); process.exit(1); });
