#!/usr/bin/env node
/**
 * check-webmcp-chain-execute.mjs: WEBMCP-CHAIN-EXEC-GATE-1
 *
 * The chain-execution vm gate that CONTRACT A15.2 names for parts 2 and 3 of
 * a WebMCP-conformant chain. The registration-freshness check
 * (gen-webmcp-registrations.mjs --check) proves a composer page carries the
 * generated chain region; nothing ever CALLED the registered plan_chain. This
 * gate does, for every chain in chaingraph/chaingraph.json:
 *
 *   Part 2 (plan_chain executes with a stable hash): load the chain's
 *     composer_url page in a node:vm context with the wrapper-execute gate's
 *     harness (imported, its bytes untouched), call the registered plan_chain,
 *     and assert the result is a v0.4 plan whose execution_hash
 *       (a) recomputes through executionHash(policy_parameters, output_payload)
 *           imported from chaingraph/kernels/_hash.mjs (the one canonicalization;
 *           this gate never builds a preimage itself), and
 *       (b) is identical across two runs in two FRESH vm contexts.
 *   Part 3 (every step node is registered): each step tool_id resolves to a
 *     registered node tool, i.e. the generator's own wrapper (prefill) set or
 *     direct-mode set (deriveTargets + adjudicateTool + directAdjudication,
 *     the same live adjudication the generator and the two execute gates use),
 *     or is kernel-only (kernel present, no page) with a chaingraph.json
 *     mcp_name, so the worker door covers it.
 *   G6 column: whether the page registers run_chain or run_chain__<chain>
 *     (reported, never a failure; a registered runner is called once and its
 *     settle state recorded).
 *   Part 4 column: browser versus server composite hash, ADVISORY only. This
 *     gate has no offline server-composite source (the server leg runs in the
 *     worker repo), so the column is labelled and never fails.
 *
 * Zero network: the sandbox traps fetch, XMLHttpRequest, WebSocket,
 * EventSource and navigator.sendBeacon. A composer page that reaches for the
 * network fails part 2 (CONTRACT zero-network constraint).
 *
 * Page scope (--pages, report only): a per-PAGE table for every tool page
 * (tools/*.html) and node page (chaingraph/art-*.html). Part 3 there is the
 * verdict of the gate the page's mode uses (the wrapper-execute and
 * direct-execute gates, run as child processes in --json mode so their
 * machinery is reused, never duplicated); part 4 is ADVISORY (no offline
 * worker-hash comparison source exists yet). Part 3 is already gated by those
 * two gates, so the page table never changes this gate's exit code.
 *
 * BASELINE + DOWNWARD RATCHET (wrapper-execute pattern): pre-existing failures
 * are keyed `<chain>#part2` or `<chain>#part3:<tool_id>` in
 * scripts/webmcp-chain-execute-baseline.json and WARN. A new key fails. A
 * baseline key that no longer fails is STALE: it blocks on main and locally
 * (down-only) and warns on a pull_request or merge_group (see verdictBlocks).
 * `--prune` drops STALE keys and never adds one. Deleting a baseline entry is
 * always safe. --seed-baseline writes the file only when it does not exist yet
 * (first rollout); it never adds to an existing baseline.
 *
 * Rollout: advisory on a pull_request (GITHUB_EVENT_NAME=pull_request prints
 * ::warning and exits 0); NEW keys block everywhere else (merge_group, main,
 * local).
 *
 * Usage:
 *   node scripts/check-webmcp-chain-execute.mjs                 # gate
 *   node scripts/check-webmcp-chain-execute.mjs --only <chain>  # one chain
 *   node scripts/check-webmcp-chain-execute.mjs --json          # full JSON report on stdout
 *   node scripts/check-webmcp-chain-execute.mjs --report <file> # write the JSON report to <file>
 *   node scripts/check-webmcp-chain-execute.mjs --pages         # add the per-page table to the report
 *   node scripts/check-webmcp-chain-execute.mjs --seed-baseline # first rollout only
 *   node scripts/check-webmcp-chain-execute.mjs --prune         # drop STALE keys (never adds)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as vm from 'node:vm';
import { executionHash } from '../chaingraph/kernels/_hash.mjs';
import { deriveTargets, adjudicateTool, directAdjudication } from './gen-webmcp-registrations.mjs';
import { makeExecuteSandbox, extractInlineScripts } from './check-webmcp-wrapper-execute.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SITE_ORIGIN = 'https://ainumbers.co/';
const argv = process.argv.slice(2);
const argVal = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
const ONLY = argVal('--only');
const REPORT = argVal('--report');
const JSONMODE = argv.includes('--json');
const PAGES = argv.includes('--pages');
const SEED = argv.includes('--seed-baseline');
const PRUNE = argv.includes('--prune');
const CALL_TIMEOUT_MS = 10_000;
const SURFACE_WAIT_MS = 3_000;
const POOL = 8;

const PART4_NOTE = 'advisory: browser versus server composite hash is report-only (A15.2 part 4); no offline server-composite source in this gate';
const PAGE_PART4_NOTE = 'advisory: no offline worker MCP hash comparison source (A15.1 part 4)';

// A composer page's async init can reject inside the vm (for example a missing
// canonicalizer helper). Node surfaces that as a host-level unhandled
// rejection; attribute it to its page by the vm script filename instead of
// crashing the gate, and fail that page's part 2 with the reason.
const PAGE_REJECTIONS = new Map();
process.on('unhandledRejection', (e) => {
  const stack = String(e?.stack ?? e);
  const m = stack.match(/([\w./-]+\.html)#script-\d+/);
  if (!m) { console.error('✗ harness exception:', e); process.exit(1); }
  const list = PAGE_REJECTIONS.get(m[1]) || [];
  list.push(String(e?.message ?? e).slice(0, 200));
  PAGE_REJECTIONS.set(m[1], list);
});

const strip = (h) => String(h ?? '').replace(/^sha256:/, '').toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── composer page load (wrapper-execute harness + a network trap) ───────── */

function trapNetwork(sandbox) {
  const net = [];
  const deny = (what) => { net.push(what); throw new Error(`network access attempted (${what}): zero network calls is a contract constraint`); };
  sandbox.fetch = (u) => deny(`fetch ${String(u).slice(0, 80)}`);
  sandbox.XMLHttpRequest = class { open(m, u) { deny(`XMLHttpRequest ${String(u).slice(0, 80)}`); } send() {} setRequestHeader() {} };
  sandbox.WebSocket = class { constructor(u) { deny(`WebSocket ${String(u).slice(0, 80)}`); } };
  sandbox.EventSource = class { constructor(u) { deny(`EventSource ${String(u).slice(0, 80)}`); } };
  sandbox.navigator.sendBeacon = (u) => deny(`sendBeacon ${String(u).slice(0, 80)}`);
  return net;
}

/** Map a chain's composer_url to a repo-relative page path. */
export function composerPageRel(composerUrl) {
  if (typeof composerUrl !== 'string' || !composerUrl) return null;
  const rel = composerUrl.startsWith(SITE_ORIGIN) ? composerUrl.slice(SITE_ORIGIN.length) : composerUrl.replace(/^\/+/, '');
  return rel.split('#')[0].split('?')[0];
}

function withTimeout(promise, ms, what) {
  return new Promise((res) => {
    const t = setTimeout(() => res({ timedOut: true, error: `${what} did not settle within ${ms}ms` }), ms);
    t.unref?.();
    promise.then((v) => { clearTimeout(t); res({ value: v }); }, (e) => { clearTimeout(t); res({ error: `${what} threw: ${e?.message ?? e}` }); });
  });
}

/**
 * Load one composer page in a FRESH vm context, run its inline scripts in
 * document order, then call the registered plan_chain (waiting for the page's
 * async init to publish its plan hash surface). `extraGlobals` lets the
 * self-test hand fixture pages the real _hash.mjs executionHash.
 * Returns { ok, error?, names, plan?, runner?, network }.
 */
export async function runPlanChain(pageAbs, pageRel, chainName, extraGlobals = {}) {
  let html;
  try { html = readFileSync(pageAbs, 'utf8'); } catch (e) { return { ok: false, error: `composer page unreadable: ${e.message}`, names: [], network: [] }; }
  const { scripts, seedElements } = extractInlineScripts(html);
  const { sandbox, warns, registered } = makeExecuteSandbox(seedElements);
  const network = trapNetwork(sandbox);
  Object.assign(sandbox, extraGlobals);
  const context = vm.createContext(sandbox);
  for (let i = 0; i < scripts.length; i++) {
    try {
      new vm.Script(scripts[i], { filename: `${pageRel}#script-${i}` }).runInContext(context);
    } catch (e) {
      return { ok: false, error: `inline script ${i} threw at load: ${e.message}`, names: registered.map((t) => t.name), network };
    }
  }
  const names = registered.map((t) => t.name);
  const plan = registered.find((t) => t.name === 'plan_chain');
  if (!plan) {
    const why = warns.filter((w) => w.length).join(' | ');
    return { ok: false, error: `page registers no plan_chain tool (registered: ${names.join(', ') || 'none'}${why ? '; ' + why.slice(0, 200) : ''})`, names, network };
  }
  // The page's init is async (WebCrypto); plan_chain reports "no plan hash
  // surface" until it has published CHAIN_HASH. Poll the registered tool, not
  // page internals, so the gate sees exactly what a host would.
  const deadline = Date.now() + SURFACE_WAIT_MS;
  let out;
  for (;;) {
    out = await withTimeout(Promise.resolve().then(() => plan.execute({})), CALL_TIMEOUT_MS, 'plan_chain execute()');
    const v = out.value;
    const notReady = v && typeof v === 'object' && v.error === 'compute_failed' && /no plan hash surface/.test(String(v.detail ?? ''));
    if (!notReady || Date.now() > deadline) break;
    await sleep(5);
  }
  let runner = null;
  const runTool = registered.find((t) => t.name === 'run_chain' || t.name === `run_chain__${chainName}`);
  if (runTool) {
    const r = await withTimeout(Promise.resolve().then(() => runTool.execute({})), CALL_TIMEOUT_MS, `${runTool.name} execute()`);
    runner = { name: runTool.name, settled: !r.error, error: r.error ?? (r.value && typeof r.value.error === 'string' ? r.value.error : null) };
  }
  const rejected = PAGE_REJECTIONS.get(pageRel);
  if (rejected && rejected.length) return { ok: false, error: `page async init rejected: ${rejected[0]}`, names, runner, network };
  if (out.error) return { ok: false, error: out.error, names, runner, network };
  return { ok: true, names, plan: out.value, runner, network };
}

/* ── verdicts (pure, exported for the self-test) ─────────────────────────── */

/**
 * Part 2 verdict over two independent runs. Recomputes through _hash.mjs.
 * Returns { ok, problem?, hash? }.
 */
export async function judgePart2(runA, runB) {
  for (const r of [runA, runB]) {
    if (r.network && r.network.length) return { ok: false, problem: `network access attempted: ${r.network[0]}` };
    if (!r.ok) return { ok: false, problem: r.error };
  }
  const p = runA.plan;
  if (!p || typeof p !== 'object') return { ok: false, problem: `plan_chain returned no plan artifact (${p === null ? 'null' : typeof p})` };
  if (typeof p.error === 'string') return { ok: false, problem: `plan_chain returned a structured error (${p.error}: ${String(p.detail ?? '').slice(0, 200)})` };
  if (!/^0\.4(\.|$)/.test(String(p.chaingraph_version ?? ''))) return { ok: false, problem: `plan is not a v0.4 artifact (chaingraph_version ${JSON.stringify(p.chaingraph_version)})` };
  if (!p.execution_hash) return { ok: false, problem: 'plan carries no execution_hash' };
  if (!p.policy_parameters || typeof p.policy_parameters !== 'object' || p.output_payload === undefined) {
    return { ok: false, problem: 'plan lacks policy_parameters/output_payload, so its execution_hash cannot be recomputed through _hash.mjs' };
  }
  let recomputed;
  try {
    recomputed = await executionHash(p.policy_parameters, p.output_payload);
  } catch (e) {
    return { ok: false, problem: `execution_hash cannot be recomputed through _hash.mjs: ${e.message}` };
  }
  const a = strip(p.execution_hash);
  if (recomputed !== a) return { ok: false, problem: `execution_hash does not reproduce via _hash.mjs executionHash (page ${a.slice(0, 16)}…, recomputed ${recomputed.slice(0, 16)}…)` };
  const q = runB.plan;
  const b = strip(q && typeof q === 'object' ? q.execution_hash : '');
  if (a !== b) return { ok: false, problem: `execution_hash unstable across two fresh runs (${a.slice(0, 16)}… then ${b.slice(0, 16) || 'none'}…)` };
  return { ok: true, hash: a };
}

/**
 * Part 3 verdict. `registry` = { wrapper:Set, direct:Set, kernelOnly:Set }.
 * Returns { ok, steps:[{tool_id, via}], unregistered:[tool_id] }.
 */
export function judgePart3(stepIds, registry) {
  const steps = stepIds.map((id) => ({
    tool_id: id,
    via: registry.wrapper.has(id) ? 'wrapper' : registry.direct.has(id) ? 'direct' : registry.kernelOnly.has(id) ? 'kernel-only-worker' : 'unregistered',
  }));
  const unregistered = steps.filter((s) => s.via === 'unregistered').map((s) => s.tool_id);
  return { ok: unregistered.length === 0, steps, unregistered };
}

/* ── registered node set (the generator's own adjudication) ──────────────── */

export async function registeredNodeSet(repo) {
  const { cleared, manifestIndex, mcpNameByTool } = deriveTargets(repo);
  const wrapper = new Set();
  const direct = new Set();
  for (const id of cleared) {
    if (adjudicateTool(id, repo, manifestIndex, mcpNameByTool).ok) { wrapper.add(id); continue; }
    const v = await directAdjudication(id, manifestIndex, mcpNameByTool, repo);
    if (v.eligible) direct.add(id);
  }
  // Kernel-only: a kernel with no node page to carry a registration, and a
  // chaingraph.json mcp_name, so the worker MCP door is the registered surface.
  const kernelOnly = new Set();
  for (const [toolId] of mcpNameByTool) {
    if (wrapper.has(toolId) || direct.has(toolId)) continue;
    if (existsSync(join(repo, 'chaingraph', 'kernels', `${toolId}.kernel.mjs`)) && !existsSync(join(repo, 'chaingraph', `${toolId}.html`))) kernelOnly.add(toolId);
  }
  return { wrapper, direct, kernelOnly };
}

/* ── baseline (down-only ratchet) ────────────────────────────────────────── */

const BASELINE_PATH = join(HERE, 'webmcp-chain-execute-baseline.json');
function baselinePath() {
  const o = process.env.AINUM_CHAIN_EXECUTE_BASELINE;
  return o ? resolve(o) : BASELINE_PATH;
}
function loadBaseline() {
  const p = baselinePath();
  if (!existsSync(p)) return new Map();
  return new Map(Object.entries(JSON.parse(readFileSync(p, 'utf8'))));
}

/** Failure keys for one chain row. */
export function failureKeys(row) {
  const keys = [];
  if (!row.part2.ok) keys.push([`${row.chain}#part2`, row.part2.problem]);
  for (const id of row.part3.unregistered) keys.push([`${row.chain}#part3:${id}`, 'unregistered step (no wrapper, direct or kernel-only worker registration)']);
  return keys;
}

/**
 * Pure exit verdict. NEW keys are advisory on a pull_request and block
 * everywhere else. STALE keys (a failure that went away) are never a PR's
 * fault, so they warn on a pull_request and a merge_group and block only on
 * main and locally, where `--prune` cures them (6 queue
 * ejections in 10-23..10-24 were stale-only).
 */
export function verdictBlocks({ fresh, stale, event }) {
  if (event === 'pull_request') return false;
  return fresh > 0 || (stale > 0 && event !== 'merge_group');
}

/** Pure ratchet split. Returns { fresh, warned, stale }. */
export function ratchet(keys, baseline, ranChains) {
  const fresh = [];
  const warned = [];
  const failing = new Set();
  for (const [k, why] of keys) {
    failing.add(k);
    (baseline.has(k) ? warned : fresh).push(`${k}: ${why}`);
  }
  const stale = [...baseline.keys()].filter((k) => ranChains.has(k.slice(0, k.indexOf('#'))) && !failing.has(k));
  return { fresh, warned, stale };
}

/* ── page table (--pages, report only) ───────────────────────────────────── */

function cleanPagesFrom(script) {
  const r = spawnSync(process.execPath, [join(HERE, script), '--json'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = new Map();
  for (const line of String(r.stdout || '').split('\n')) {
    if (!line.startsWith('{')) continue;
    try { const j = JSON.parse(line); const s = out.get(j.page) || new Set(); s.add(j.leg ?? 1); out.set(j.page, s); } catch { /* not a report line */ }
  }
  return out;
}

async function pageTable(registry) {
  const wrapperClean = cleanPagesFrom('check-webmcp-wrapper-execute.mjs');
  const directClean = cleanPagesFrom('check-webmcp-direct-execute.mjs');
  const rows = [];
  const nodePages = readdirSync(join(REPO, 'chaingraph')).filter((f) => /^art-.*\.html$/.test(f)).sort();
  for (const f of nodePages) {
    const id = f.replace(/\.html$/, '');
    const page = `chaingraph/${f}`;
    let mode = 'none';
    let part3 = 'fail: no WebMCP registration the vm gates cover';
    if (registry.wrapper.has(id)) { mode = 'wrapper'; part3 = wrapperClean.has(page) ? 'pass' : 'fail: wrapper-execute gate not clean (baselined WARN does not pass)'; }
    else if (registry.direct.has(id)) { mode = 'direct'; const s = directClean.get(page); part3 = s && s.has(1) && s.has(2) ? 'pass' : 'fail: direct-execute gate not clean on both legs'; }
    rows.push({ page, kind: 'node', mode, part3, part4: PAGE_PART4_NOTE });
  }
  const toolPages = existsSync(join(REPO, 'tools')) ? readdirSync(join(REPO, 'tools')).filter((f) => f.endsWith('.html')).sort() : [];
  for (const f of toolPages) rows.push({ page: `tools/${f}`, kind: 'tool', mode: 'none', part3: 'fail: no vm execute gate covers tool pages', part4: PAGE_PART4_NOTE });
  return rows;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function main() {
  const cg = JSON.parse(readFileSync(join(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const chains = (cg.chains ?? []).filter((c) => c && c.name && (!ONLY || c.name === ONLY));
  const registry = await registeredNodeSet(REPO);

  const rows = await pool(chains, POOL, async (c) => {
    const rel = composerPageRel(c.composer_url);
    const stepIds = (c.steps ?? []).map((s) => s.tool_id).filter(Boolean);
    const part3 = judgePart3(stepIds, registry);
    let part2;
    let runA = null;
    if (!rel) part2 = { ok: false, problem: 'chain has no composer_url' };
    else if (!existsSync(join(REPO, rel))) part2 = { ok: false, problem: `composer page ${rel} absent` };
    else {
      runA = await runPlanChain(join(REPO, rel), rel, c.name);
      const runB = await runPlanChain(join(REPO, rel), rel, c.name);
      part2 = await judgePart2(runA, runB);
    }
    return {
      chain: c.name,
      composer_page: rel,
      part2,
      part3: { ok: part3.ok, unregistered: part3.unregistered, steps: part3.steps },
      g6_run_chain: runA?.runner ? runA.runner : { name: null, registered: false },
      part4: PART4_NOTE,
    };
  });

  const ran = new Set(rows.map((r) => r.chain));
  const keys = rows.flatMap(failureKeys);

  if (SEED) {
    const p = baselinePath();
    if (existsSync(p)) { console.error(`✗ --seed-baseline refused: ${p} exists (down-only ratchet; delete entries by hand, never add)`); process.exit(1); }
    const obj = Object.fromEntries(keys.map(([k, why]) => [k, why]).sort((x, y) => (x[0] < y[0] ? -1 : 1)));
    writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
    console.log(`seeded ${p} with ${keys.length} entr${keys.length === 1 ? 'y' : 'ies'}`);
    process.exit(0);
  }

  const summary = {
    chains: rows.length,
    part2_pass: rows.filter((r) => r.part2.ok).length,
    part3_pass: rows.filter((r) => r.part3.ok).length,
    both_pass: rows.filter((r) => r.part2.ok && r.part3.ok).length,
    run_chain_registered: rows.filter((r) => r.g6_run_chain.name).length,
    registered_nodes: { wrapper: registry.wrapper.size, direct: registry.direct.size, kernel_only_worker: registry.kernelOnly.size },
  };
  const report = { gate: 'check-webmcp-chain-execute', generated_at: new Date().toISOString(), summary, chains: rows };
  if (PAGES) {
    report.pages = await pageTable(registry);
    report.page_summary = { pages: report.pages.length, part3_pass: report.pages.filter((p) => p.part3 === 'pass').length };
  }
  if (REPORT) writeFileSync(resolve(REPORT), JSON.stringify(report, null, 2) + '\n');
  if (JSONMODE) console.log(JSON.stringify(report));

  const baseline = loadBaseline();
  const { fresh, warned, stale } = ratchet(keys, baseline, ran);
  const line = `${summary.chains} chain(s): part 2 pass ${summary.part2_pass}, part 3 pass ${summary.part3_pass}, both ${summary.both_pass}; run_chain registered on ${summary.run_chain_registered}; part 4 advisory`;
  const say = JSONMODE ? console.error : console.log;
  if (PRUNE) {
    // Down-only writer: drops STALE keys, never adds one. A NEW failure is not
    // absorbed — it still reds below.
    const kept = Object.fromEntries([...baseline].filter(([k]) => !stale.includes(k)).sort((x, y) => (x[0] < y[0] ? -1 : 1)));
    writeFileSync(baselinePath(), JSON.stringify(kept, null, 2) + '\n');
    console.log(`--prune wrote ${baselinePath()}: removed ${stale.length} stale entr${stale.length === 1 ? 'y' : 'ies'}, ${Object.keys(kept).length} kept (never adds)`);
    stale.length = 0;
  }
  if (fresh.length || stale.length) {
    const ev = process.env.GITHUB_EVENT_NAME;
    const blocking = verdictBlocks({ fresh: fresh.length, stale: stale.length, event: ev });
    const head = `check-webmcp-chain-execute ${blocking ? 'FAILED' : ev === 'pull_request' ? 'ADVISORY (pull_request)' : 'WARN (stale only)'} (${fresh.length} NEW, ${stale.length} STALE baseline entr${stale.length === 1 ? 'y' : 'ies'}; ${warned.length} baselined WARN) over ${line}`;
    if (!blocking) console.log(`::warning::${head}`);
    console.error(`${blocking ? '✗' : '⚠'} ${head}:`);
    fresh.forEach((p) => console.error('    ' + p));
    stale.forEach((k) => console.error(`    STALE baseline entry: ${k} no longer fails; run node scripts/check-webmcp-chain-execute.mjs --prune (down-only ratchet)`));
    process.exit(blocking ? 1 : 0);
  }
  say(`✓ check-webmcp-chain-execute clean: ${line}. ${warned.length} failure(s) WARN on the documented baseline (downward ratchet).`);
  process.exit(0);
}

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) main().catch((e) => { console.error('✗ harness exception:', e); process.exit(1); });
