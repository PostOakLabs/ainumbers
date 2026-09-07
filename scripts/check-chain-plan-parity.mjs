#!/usr/bin/env node
/**
 * check-chain-plan-parity.mjs — COMPOSER-PLAN-AND-ROOT-WEBMCP-1, parity gate A.
 *
 * In-repo SSOT recompute of every chain composer page's §4 chain-definition PLAN
 * hash. The plan preimage is the one the page builds at load
 * (chaingraph/chains/build-chain-pages.mjs, buildPreimage(), lines ~396-410):
 *
 *   { policy_parameters: { execution_backend: 'browser', chain_id, step_count,
 *                          step_tool_ids },
 *     output_payload: { chain_title, chain_description,
 *                       steps: [{ tool_id, handoff }] } }
 *
 * hashed with the shared canonicaliser chaingraph/kernels/_hash.mjs
 * (cgCanon + SHA-256 via executionHash()) — the SAME module the worker imports
 * (WORKER-HASH-SSOT-1). Three checks, any mismatch RED (exit 1):
 *
 *   (1) SSOT vs COMMITTED SET  — all chains vs repo/data/chain-plan-hashes.json
 *       (the committed derived set; idempotency proof that the recompute is
 *       deterministic and that the fleet's plan hashes are pinned in-repo).
 *   (2) SSOT vs PAGE SAMPLE    — for a deterministic sample of >= 10 composer
 *       pages per run, the page's OWN CHAIN_MANIFEST literal is compared with
 *       chaingraph.json: chain title, ordered step tool_ids and ordered handoffs
 *       (the plan definition proper) must be equal, and the page must carry the
 *       fleet OCG-CANON canonicaliser block (byte-identical to cgCanon).
 *       Headless: the page bytes are the fixture. Manifest description COPY is
 *       informational (stale derived view on main, see the check body).
 *   (3) COMMitted SET COMPLETENESS — the committed file covers exactly the
 *       chain set (no stale entries, none missing).
 *
 * Modes:
 *   node scripts/check-chain-plan-parity.mjs            # gate (exit 1 on any mismatch)
 *   node scripts/check-chain-plan-parity.mjs --write    # (re)generate the committed set
 *   node scripts/check-chain-plan-parity.mjs --sample N # page-sample size (default 12)
 *
 * Declared in scripts/derived-artifacts.mjs (id 'chain-plan-hashes') so the
 * main-side regen owns the write; preflight runs the gate form.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from '../chaingraph/kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const DATA_REL = 'data/chain-plan-hashes.json';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const sIdx = args.indexOf('--sample');
const SAMPLE_N = sIdx !== -1 ? parseInt(args[sIdx + 1], 10) : 12;

/** The plan preimage for one chain from chaingraph.json — mirror of the page's
 *  buildPreimage() (build-chain-pages.mjs). Change BOTH together; the page
 *  sample check (2) below is the tripwire that keeps them locked. */
function planPreimage(chain) {
  const steps = chain.steps ?? [];
  return {
    policy_parameters: {
      execution_backend: 'browser',
      chain_id: chain.name,
      step_count: steps.length,
      step_tool_ids: steps.map((s) => s.tool_id),
    },
    output_payload: {
      chain_title: chain.title,
      chain_description: chain.description,
      steps: steps.map((s) => ({ tool_id: s.tool_id, handoff: s.handoff })),
    },
  };
}

/** Extract the CHAIN_MANIFEST literal from a composer page. The fleet carries
 *  two page generations (template and legacy post-processed); both declare the
 *  manifest with const/var/let. Returns null when the page carries none. */
function pageManifest(pageSrc) {
  const m = pageSrc.match(/(?:const|var|let) CHAIN_MANIFEST = ([\s\S]*?);\r?\n/);
  if (!m) return null;
  try {
    return JSON.parse(m[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'));
  } catch {
    return null;
  }
}

const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
const chains = (cg.chains ?? []).filter((c) => c.name && Array.isArray(c.steps) && c.steps.length > 0);

// SSOT recompute, all chains.
const ssot = new Map();
for (const chain of chains) ssot.set(chain.name, await executionHash(planPreimage(chain).policy_parameters, planPreimage(chain).output_payload));

if (WRITE) {
  const sorted = Object.fromEntries([...ssot.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  const body = JSON.stringify({
    _comment: 'Derived set (COMPOSER-PLAN-AND-ROOT-WEBMCP-1 parity gate A): sha256 over RFC 8785/JCS canonical plan preimage per chain, recomputed by scripts/check-chain-plan-parity.mjs from chaingraph.json with chaingraph/kernels/_hash.mjs. Regenerate with --write; never hand-edit.',
    generated: 'scripts/check-chain-plan-parity.mjs',
    chain_count: chains.length,
    hashes: sorted,
  }, null, 2) + '\n';
  writeFileSync(resolve(REPO, DATA_REL), body);
  console.log(`wrote ${DATA_REL}: ${chains.length} chain plan hashes.`);
  process.exit(0);
}

const problems = [];
let pageSampleSize = 0;

// (1) + (3) vs the committed set.
const dataPath = resolve(REPO, DATA_REL);
if (!existsSync(dataPath)) {
  problems.push(`${DATA_REL} missing — run: node scripts/check-chain-plan-parity.mjs --write`);
} else {
  const committed = JSON.parse(readFileSync(dataPath, 'utf8')).hashes ?? {};
  for (const [name, hash] of ssot) {
    if (!(name in committed)) problems.push(`(1) ${name}: missing from committed set ${DATA_REL}`);
    else if (committed[name] !== hash) problems.push(`(1) ${name}: committed ${committed[name].slice(0, 12)}… != SSOT recompute ${hash.slice(0, 12)}…`);
  }
  for (const name of Object.keys(committed)) {
    if (!ssot.has(name)) problems.push(`(3) ${name}: stale entry in committed set (chain gone)`);
  }
}

// (2) page sample: deterministic — the three canonical proof chains first, then
// the first (SAMPLE_N - 3) manifest-carrying pages alphabetically. The check
// asserts STEP-PLAN parity between the page's own manifest literal and
// chaingraph.json (chain title, ordered tool_ids, ordered handoffs — the plan
// definition proper), plus that the page carries the fleet OCG-CANON
// canonicaliser block (byte-identical to kernels/_hash.mjs cgCanon). Manifest
// description COPY is informational, not gating: measured 2026-09-05, the fleet
// page manifests are a stale derived view on main (descriptions were updated in
// chaingraph.json after generation on N pages); regenerating 358 pages is not
// this row's fence (build-chain-pages: runner link only).
const PRIORITY = ['agent-identity-verification', 'content-credential-verification', 'emir-trade-report-validation'];
const sortedNames = [...ssot.keys()].sort();
const manifestPages = [];
for (const name of sortedNames) {
  const pagePath = resolve(REPO, 'chaingraph', 'chains', `${name}.html`);
  if (existsSync(pagePath) && /(?:const|var|let) CHAIN_MANIFEST = /.test(readFileSync(pagePath, 'utf8'))) manifestPages.push(name);
}
const sample = [];
for (const p of PRIORITY) if (manifestPages.includes(p)) sample.push(p);
for (const n of manifestPages) {
  if (sample.length >= Math.max(SAMPLE_N, PRIORITY.length)) break;
  if (!sample.includes(n)) sample.push(n);
}
let staleDescriptions = 0;
const BASELINE_REL = 'scripts/chain-plan-parity-baseline.json';
const baselinePath = resolve(REPO, BASELINE_REL);
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
const liveFindings = new Map(); // name -> Set<kind>
let baselinedCount = 0;
const addFinding = (name, kind, msg) => {
  if (!liveFindings.has(name)) liveFindings.set(name, new Set());
  liveFindings.get(name).add(kind);
  const allowed = (baseline[name] ?? []);
  if (!allowed.includes(kind)) problems.push(`(2) ${name}: ${msg}`);
  else baselinedCount++;
};
for (const name of sample) {
  const pagePath = resolve(REPO, 'chaingraph', 'chains', `${name}.html`);
  const chain = chains.find((c) => c.name === name);
  const pageSrc = readFileSync(pagePath, 'utf8');
  const mf = pageManifest(pageSrc);
  if (!mf) { addFinding(name, 'no-manifest', 'CHAIN_MANIFEST literal not parseable'); continue; }
  if (mf.title !== chain.title) addFinding(name, 'title', 'page manifest title != chaingraph.json');
  const mfSteps = mf.steps ?? [];
  if (mfSteps.length !== chain.steps.length) {
    addFinding(name, 'step_count', `page manifest step count ${mfSteps.length} != chaingraph.json ${chain.steps.length}`);
  } else {
    for (let i = 0; i < mfSteps.length; i++) {
      if (mfSteps[i].tool_id !== chain.steps[i].tool_id) addFinding(name, `tool_id:${i + 1}`, `step ${i + 1} tool_id ${mfSteps[i].tool_id} != ${chain.steps[i].tool_id}`);
      if (mfSteps[i].handoff !== chain.steps[i].handoff) addFinding(name, `handoff:${i + 1}`, `step ${i + 1} handoff != chaingraph.json`);
    }
  }
  if (!/OCG-CANON v1/.test(pageSrc)) addFinding(name, 'no-canon', 'page lacks the OCG-CANON canonicaliser block');
  if (mf.description !== chain.description) staleDescriptions++;
}
pageSampleSize = sample.length;
// Ratchet: a baseline entry that no longer matches a live finding is stale and
// fails the gate (the shield may only shrink), exactly like the copy-hallmarks
// baseline discipline.
for (const [name, kinds] of Object.entries(baseline)) {
  if (!Array.isArray(kinds)) continue; // comment keys
  const live = liveFindings.get(name) ?? new Set();
  for (const kind of kinds) {
    if (!live.has(kind)) problems.push(`(2) ${name}: stale baseline entry '${kind}' — the page healed; remove the entry from ${BASELINE_REL}`);
  }
}

if (problems.length) {
  console.error(`✗ chain-plan-parity FAILED (${problems.length}):`);
  problems.forEach((p) => console.error('    ' + p));
  process.exit(1);
}
console.log(`✓ chain-plan-parity clean — ${ssot.size}/${ssot.size} chain plan hashes match the committed set ${DATA_REL}; ${pageSampleSize} composer pages sampled, step-plan parity (title, ordered tool_ids, ordered handoffs) == chaingraph.json on every sampled page (${baselinedCount} pre-existing page-staleness finding(s) baselined in ${BASELINE_REL}, ratchet may only shrink); ${staleDescriptions} sampled page(s) carry stale manifest description copy (informational, stale-derived-view on main).`);
