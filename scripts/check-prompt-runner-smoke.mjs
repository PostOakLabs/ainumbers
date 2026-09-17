#!/usr/bin/env node
/**
 * scripts/check-prompt-runner-smoke.mjs — PROMPT-RUNNER-1 headless smoke.
 *
 * Runs P1's (same-law-three-doorways) runner_steps against the LIVE worker
 * (https://mcp.ainumbers.co/mcp) exactly the way the mcp-playground.html runner
 * panel does — initialize once, then one tools/call per tool step, thread refs
 * substituted with the same rules — TWICE, and asserts the two runs produce
 * identical execution_hash sequences (the demo's punchline: deterministic
 * compute reproduces identical hashes).
 *
 * ADVISORY when the worker is unreachable (CI sandboxes, rate limits, local
 * offline runs): prints an explicit ADVISORY line and exits 0, saying so.
 * Exit 1 on: malformed runner_steps, unresolvable thread refs, worker errors,
 * or the two runs disagreeing on any execution_hash.
 *
 * No npm deps; plain node >= 18 (global fetch).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const EP = 'https://mcp.ainumbers.co/mcp';
const TIMEOUT_MS = 30000;

const THREAD_REF = /^(\d+)\.(execution_hash|artifact|session_receipt_root)$/;

function runnerHash(sc) {
  if (!sc || typeof sc !== 'object') return null;
  return (sc.artifact && sc.artifact.execution_hash) || sc.execution_hash || sc.computed_hash ||
    sc.composite_execution_hash || sc.session_receipt_root ||
    (sc.session_receipt && sc.session_receipt.session_receipt_root) || null;
}
function runnerArtifact(sc) {
  if (!sc || typeof sc !== 'object') return null;
  return sc.composite_artifact || sc.artifact || null;
}
function runnerRoot(sc) {
  if (!sc || typeof sc !== 'object') return null;
  return sc.session_receipt_root || (sc.session_receipt && sc.session_receipt.session_receipt_root) || null;
}

async function post(method, params) {
  const body = { jsonrpc: '2.0', id: 1, method };
  if (params !== undefined) body.params = params;
  let res, text;
  try {
    res = await fetch(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    text = await res.text();
  } catch (e) {
    return { unreachable: true, message: e.message };
  }
  try {
    return { json: JSON.parse(text) };
  } catch (e) {
    const m = text.match(/data:\s*(\{[\s\S]*\})/);
    return m ? { json: JSON.parse(m[1]) } : { json: { error: { message: 'non-JSON response: ' + text.slice(0, 200) } } };
  }
}

function scOf(r) {
  const res = r.json && r.json.result;
  if (!res) return { is_error: true, text: 'no result object' };
  if (res.isError) {
    const t = res.content && res.content[0] && res.content[0].text;
    return { is_error: true, text: String(t || 'tool error') };
  }
  if (res.structuredContent && typeof res.structuredContent === 'object') return res.structuredContent;
  const c = res.content && res.content[0];
  if (c && c.type === 'text') { try { return JSON.parse(c.text); } catch { return { _raw: String(c.text).slice(0, 400) }; } }
  return {};
}

function resolveThreadRefs(value, results) {
  if (typeof value === 'string') {
    const m = THREAD_REF.exec(value);
    if (m) {
      const rec = results[Number(m[1]) - 1];
      const sc = rec && rec.sc;
      if (m[2] === 'execution_hash') return runnerHash(sc);
      if (m[2] === 'artifact') return runnerArtifact(sc);
      return runnerRoot(sc);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveThreadRefs(v, results));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = resolveThreadRefs(value[k], results);
    return out;
  }
  return value;
}

async function runOnce(steps, label) {
  const results = new Array(steps.length).fill(null);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.manual) { results[i] = { kind: 'manual', label: s.label }; continue; }
    if (!s.tool) throw new Error(`step ${i + 1}: neither tool nor manual`);
    const args = resolveThreadRefs(s.args || {}, results);
    const r = await post('tools/call', { name: s.tool, arguments: args });
    if (r.unreachable) return { unreachable: r.message };
    const sc = scOf(r);
    if (sc.is_error) throw new Error(`[${label}] step ${i + 1} (${s.tool}) errored: ${sc.text.slice(0, 200)}`);
    results[i] = { kind: 'tool', tool: s.tool, sc, hash: runnerHash(sc) };
    if (!results[i].hash) throw new Error(`[${label}] step ${i + 1} (${s.tool}) returned no execution_hash`);
  }
  return { results };
}

async function main() {
  const sp = JSON.parse(readFileSync(resolve(REPO, 'mcp', 'showcase-prompts.json'), 'utf8'));
  const p = sp.find((e) => e.id === 'same-law-three-doorways');
  if (!p || !p.runner_steps?.length) throw new Error('same-law-three-doorways has no runner_steps');
  const steps = p.runner_steps;

  const init = await post('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'prompt-runner-smoke', version: '1.0' } });
  if (init.unreachable) {
    console.log(`ADVISORY: mcp.ainumbers.co unreachable (${init.message}) — the PROMPT-RUNNER-1 smoke is advisory when the worker cannot be reached; hash stability was NOT verified this run.`);
    process.exit(0);
  }
  if (init.json.error) throw new Error('initialize failed: ' + JSON.stringify(init.json.error).slice(0, 200));

  const a = await runOnce(steps, 'run A');
  if (a.unreachable) {
    console.log(`ADVISORY: mcp.ainumbers.co unreachable mid-run (${a.message}) — advisory exit 0; hash stability was NOT verified this run.`);
    process.exit(0);
  }
  const b = await runOnce(steps, 'run B');
  if (b.unreachable) {
    console.log(`ADVISORY: mcp.ainumbers.co unreachable mid-run (${b.message}) — advisory exit 0; hash stability was NOT verified this run.`);
    process.exit(0);
  }

  const hashesA = a.results.map((r) => (r && r.hash) || null);
  const hashesB = b.results.map((r) => (r && r.hash) || null);
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].manual) continue;
    console.log(`  step ${i + 1} ${steps[i].tool}: ${hashesA[i]} ${hashesA[i] === hashesB[i] ? '== (stable)' : '!= ' + hashesB[i]}`);
  }
  const stable = JSON.stringify(hashesA) === JSON.stringify(hashesB);
  if (!stable) {
    console.error('check-prompt-runner-smoke FAILED: the two runs disagree on execution_hash values.');
    process.exit(1);
  }
  console.log(`✓ check-prompt-runner-smoke: P1 executed against the live worker twice; ${hashesA.filter(Boolean).length} hashes identical run over run.`);
  process.exit(0);
}

main().catch((e) => { console.error('check-prompt-runner-smoke FAILED:', e.message); process.exit(1); });
