#!/usr/bin/env node
/**
 * scripts/gen-estate-map.mjs
 *
 * SSOT: data/suite-map.json (rail[] -- 3 stops; concepts[] -- 5 conceptual steps)
 *
 * Renders the agent-facing "How the estate fits together" markdown section
 * and injects it into llms.txt between the ESTATE-MAP sentinels. Text only --
 * no visual rail, no wf- / wayfinder CSS, no numeral glyphs (do-not-regress,
 * see scripts/gen-wayfinder.mjs header).
 *
 * LLMS-TXT-AGENTIC-1 (2026-09-05): also renders the "What an agent can do
 * here" block between the AGENT-TASKS sentinels in the same file. This script
 * stays the SINGLE writer for both llms.txt marker regions (SO #35 -- do not
 * add a second writer).
 *
 * TODO-SSOT (2026-09-05, LLMS-TXT-AGENTIC-1): the agent task lines and the
 * four agent rules are embedded fallbacks sourced from
 * research/WEBMCP-AGENT-SHOWCASE-PROMPTS-2026-09-05.md §1-§5 and the
 * AGENT-REACH-BUILD-SPEC §3.4 rule list. When mcp/showcase-prompts.json
 * (MCP-SHOWCASE-PROMPTS-1) and agent-kit/kit.json (AIN-AGENT-KIT-1) land,
 * this generator already prefers them; delete the fallbacks then.
 *
 * Usage:
 *   node scripts/gen-estate-map.mjs          # inject into llms.txt
 *   node scripts/gen-estate-map.mjs --check  # freshness gate (exit 1 if stale)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const MAP_PATH = resolve(REPO, 'data', 'suite-map.json');
const LLMS_PATH = resolve(REPO, 'llms.txt');
const PROMPTS_PATH = resolve(REPO, 'mcp', 'showcase-prompts.json');
const KIT_PATH = resolve(REPO, 'agent-kit', 'kit.json');

const START = '<!--ESTATE-MAP:start-->';
const END = '<!--ESTATE-MAP:end-->';
const AGENT_HEADING = '## What an agent can do here';
const AGENT_START = '<!--AGENT-TASKS:start-->';
const AGENT_END = '<!--AGENT-TASKS:end-->';

function audienceLabel(a) {
  if (a === 'agent') return 'agent';
  if (a === 'human') return 'human';
  return 'human + agent';
}

export function renderEstateMap(map) {
  const lines = [];
  lines.push('The AINumbers estate is a closed loop. The user-facing navigation rail has three stops:');
  lines.push('');
  map.rail.forEach((stop, i) => {
    const surfaces = stop.surfaces
      .map(s => `${s.name} (${s.url}, ${audienceLabel(s.audience)})`)
      .join('; ');
    const micro = stop.microtext ? ` (${stop.microtext})` : '';
    lines.push(`${i + 1}. **${stop.label}**${micro} -- ${stop.one_line_role}. Surfaces: ${surfaces}.`);
  });
  lines.push('');
  lines.push('The underlying conceptual model has five steps that map onto those three stops:');
  lines.push('');
  map.concepts.forEach((c, i) => {
    lines.push(`${i + 1}. **${c.label}** -- ${c.one_line_role} (${c.host})`);
  });
  lines.push('');
  lines.push(`Machine-readable rail and concept map (surfaces, URLs, audiences): \`https://ainumbers.co/data/suite-map.json\``);
  return lines.join('\n');
}

// ── Agent tasks (LLMS-TXT-AGENTIC-1) ────────────────────────────────────────
// Fallback task lines: task -> tool/chain -> verify surface. One per showcase
// prompt in research/WEBMCP-AGENT-SHOWCASE-PROMPTS-2026-09-05.md §1-§5.
const FALLBACK_TASKS = [
  {
    id: 'cross-transport-determinism',
    task: 'Prove cross-transport determinism',
    path: 'run the same tool in the page (WebMCP) and on the remote MCP with identical inputs, then compare the two execution_hash values',
    verify: 'verify_execution_hash, then build_session_receipt and anchor the session root at https://anchor.ainumbers.co/mcp (OpenTimestamps)',
  },
  {
    id: 'mandated-agentic-commerce',
    task: 'Run agentic commerce under a signed policy',
    path: 'find_chain("agent commerce conformance"), sign a Work Mandate (OCG §22) with vc_issue, then run_chain with a synthetic over-cap cart and expect a recorded escalation',
    verify: 'the §21 gate replay on the returned ledger_url',
  },
  {
    id: 'zero-egress-evidence-pack',
    task: 'Produce a regulatory evidence pack without the data leaving the browser',
    path: 'run the four EMIR Refit validators (art-154/155/157/158) in-page on synthetic data, then send hashes only to build_evidence_pack',
    verify: 'anchor_batch (Sigstore TSA + OpenTimestamps) and the ledger fragment link',
  },
  {
    id: 'content-credentials',
    task: 'Check content credentials before publishing',
    path: 'validate a C2PA manifest plus AI Act Art. 50 marking (art-123/126/127), then run_chain("content-credential-verification")',
    verify: 'build_disclosure_manifest, verify_disclosure_inclusion, and anchor_hash (OpenTimestamps)',
  },
  {
    id: 'air-gapped-control-plane',
    task: 'Run an air-gapped workflow with a human release step',
    path: 'helmd (loopback-only MCP): workflow.dry_run then workflow.run, then artifact.verify',
    verify: 'evidence.export requires a consent ticket minted by a human in the Helm UI; the bundle verifies offline with helmd verify',
  },
];

// Fallback rules, from AGENT-REACH-BUILD-SPEC §3.4 (the kit.json verify rules).
const FALLBACK_RULES = [
  'Use synthetic data only.',
  'Verify with `verify_execution_hash` before trusting any result.',
  'Return a ledger link for any run you report.',
  'Never paste PII into any tool input.',
];

function loadTasks() {
  if (!existsSync(PROMPTS_PATH)) return FALLBACK_TASKS;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(PROMPTS_PATH, 'utf8'));
  } catch {
    return FALLBACK_TASKS;
  }
  // SSOT shapes accepted: a bare array, or the landed {prompts: [...]} envelope
  // (mcp/showcase-prompts.json, MCP-SHOWCASE-PROMPTS-1). verify_surface may be
  // a string or an array of verify-surface URLs.
  const prompts = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.prompts) ? parsed.prompts : null);
  if (!Array.isArray(prompts) || prompts.length === 0) return FALLBACK_TASKS;
  return prompts.map((p) => {
    const verify = Array.isArray(p.verify_surface) ? p.verify_surface.join('; ') : (p.verify_surface || '');
    return {
      id: p.id,
      task: p.title || p.id,
      path: p.one_line || '',
      verify,
    };
  });
}

function loadRules() {
  if (!existsSync(KIT_PATH)) return FALLBACK_RULES;
  const kit = JSON.parse(readFileSync(KIT_PATH, 'utf8'));
  const rules = kit.verify_rules || kit.rules;
  if (!Array.isArray(rules) || rules.length === 0) return FALLBACK_RULES;
  return rules;
}

export function renderAgentTasks() {
  const lines = [];
  lines.push('Task -> tool/chain -> verify surface, one line per showcase task. Connect to `https://mcp.ainumbers.co/mcp`; browser pages expose the same tools via WebMCP.');
  lines.push('');
  loadTasks().forEach((t) => {
    lines.push(`- **${t.task}** -> ${t.path} -> Verify: ${t.verify}.`);
  });
  lines.push('');
  lines.push(`Discovery: \`find_chain(query)\` for a named workflow, \`find_tool(query)\` for a single calculator, \`tools/list\` on the MCP endpoint for the live catalog.`);
  lines.push('');
  lines.push(`Agent rules: ${loadRules().join(' ')}`);
  return lines.join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const body = renderEstateMap(map);
  const block = `${START}\n${body}\n${END}`;
  const agentBlock = `${AGENT_HEADING}\n${AGENT_START}\n${renderAgentTasks()}\n${AGENT_END}`;

  let src = readFileSync(LLMS_PATH, 'utf8');
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(src)) {
    console.error(`gen-estate-map: sentinels ${START} / ${END} not found in llms.txt`);
    process.exit(1);
  }
  let next = src.replace(re, block);

  // AGENT-TASKS region: replace between sentinels; if the sentinels are not in
  // the file yet (first run after this generator ships), insert the whole
  // block right after the ESTATE-MAP region so one run heals main.
  const agentRe = new RegExp(`${AGENT_HEADING}\\n${AGENT_START}[\\s\\S]*?${AGENT_END}`);
  if (agentRe.test(next)) {
    next = next.replace(agentRe, agentBlock);
  } else {
    const anchor = next.indexOf(END);
    if (anchor === -1) {
      console.error('gen-estate-map: cannot locate ESTATE-MAP end to insert AGENT-TASKS block');
      process.exit(1);
    }
    const at = anchor + END.length;
    next = next.slice(0, at) + '\n\n' + agentBlock + next.slice(at);
  }

  if (check) {
    if (next !== src) {
      console.error('gen-estate-map --check: llms.txt is stale (estate map or agent tasks). Run `node scripts/gen-estate-map.mjs`.');
      process.exit(1);
    }
    console.log('gen-estate-map --check: llms.txt estate map and agent tasks are fresh.');
    return;
  }

  writeFileSync(LLMS_PATH, next);
  console.log('gen-estate-map: llms.txt estate map and agent tasks regenerated.');
}

main();
