#!/usr/bin/env node
/**
 * check-ask-agent-block.mjs — TOOLPAGE-ASK-AGENT-1 (AGENT-REACH-BUILD-SPEC 3.6)
 *
 * Generator + freshness gate for the "Ask your agent" copyable block on every
 * live node page. The block BYTES are the single source of truth in
 * chaingraph/_page-chrome.mjs (buildAskAgentBlock); this script adjudicates the
 * per-page inputs (manifest, fixture 0, chaingraph.json node record), renders
 * the expected block, and reds any drift, duplication, or coverage gap.
 *
 * Block contents per section 3.6, all projected from the manifest + kit (no
 * LLM, no invention):
 *   - tool name        = mcp_tool_definition.name (gated == node.mcp_name)
 *   - task sentence    = first sentence of mcp_tool_definition.description,
 *                        verb-fronted by the FIXED table (ASK_AGENT_VERB_TABLE);
 *                        unknown first word keeps the sentence verbatim
 *   - sample input     = manifest `example` when declared, else fixture 0's
 *                        policy_parameters (chaingraph/kernels/fixtures/)
 *   - verify step      = verify_execution_hash on mcp.ainumbers.co (kit.json
 *                        estate.mcp_url); pages with a generated WebMCP
 *                        registration add the in-page tool name
 *   - ledger sentence  = kit.json estate.ledger_url (return-a-ledger-link rule)
 *   - PII banner       = the same sentence buildDeeplinkScript enforces
 *   - deep link        = section 3.1 fragment-only link (#p=v1.<b64url(gzip)>)
 *                        carrying the sample, base = the node's canonical url
 * One copy button, inline clipboard API, no library.
 *
 * Modes:
 *   node scripts/check-ask-agent-block.mjs           (freshness gate; default)
 *   node scripts/check-ask-agent-block.mjs --write   (regenerate blocks)
 *   node scripts/check-ask-agent-block.mjs --red-green
 *       (SO #34c proof: the gate is run against the pristine tree (GREEN),
 *        one byte inside one page's emitted region is mutated and the gate is
 *        re-run in-process expecting problems (RED), the page is restored and
 *        the gate is re-run expecting clean (GREEN). Never exits non-zero.)
 *
 * Exit: 0 clean; 1 on any drift, duplication, or coverage regression.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  ASK_AGENT_END, buildAskAgentBlock,
} from '../chaingraph/_page-chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const WRITE = process.argv.includes('--write');
const RED_GREEN = process.argv.includes('--red-green');

function fail(msg) {
  console.error('GEN-ERROR: ' + msg);
  process.exit(1);
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function liveNodes() {
  const cg = loadJson(resolve(REPO, 'chaingraph', 'chaingraph.json'));
  return (cg.nodes || []).filter((n) => n.status === 'live' && n.tool_id);
}

/** The adjudicated per-page inputs; { exclude } + reason when the block cannot
 *  be emitted for this node today (honest exclusion, never a guess — same
 *  posture as gen-webmcp-registrations.mjs). */
function adjudicateNode(node, repoRoot) {
  const id = node.tool_id;
  const pageRel = `chaingraph/${id}.html`;
  const pageAbs = resolve(repoRoot, pageRel);
  if (!existsSync(pageAbs)) return { id, exclude: `${pageRel} absent (no in-repo page)` };
  const manifestRel = `manifests/${id}.manifest.json`;
  const manifestAbs = resolve(repoRoot, manifestRel);
  if (!existsSync(manifestAbs)) return { id, exclude: `${manifestRel} absent` };
  let manifest;
  try { manifest = loadJson(manifestAbs); } catch (e) { return { id, exclude: `${manifestRel} unparseable: ${e.message}` }; }
  const def = manifest.mcp_tool_definition;
  if (!def || typeof def.name !== 'string' || typeof def.description !== 'string') {
    return { id, exclude: `${manifestRel} lacks mcp_tool_definition.name/description` };
  }
  // sample: manifest example when declared, else fixture 0 policy_parameters
  let sample = null;
  if (manifest.example && typeof manifest.example === 'object' && !Array.isArray(manifest.example)) {
    sample = manifest.example.policy_parameters && typeof manifest.example.policy_parameters === 'object'
      ? manifest.example.policy_parameters : manifest.example;
  }
  if (!sample) {
    const fixturePath = join(repoRoot, 'chaingraph', 'kernels', 'fixtures', `${id}.fixtures.json`);
    if (!existsSync(fixturePath)) return { id, exclude: `no manifest example and no fixture file ${fixturePath.slice(repoRoot.length + 1)}` };
    let fixture;
    try { fixture = loadJson(fixturePath); } catch (e) { return { id, exclude: `fixture unparseable: ${e.message}` }; }
    const vectors = fixture.vectors || fixture.fixtures || [];
    const fx = vectors[0];
    if (!fx || !fx.policy_parameters) return { id, exclude: 'fixture 0 lacks policy_parameters' };
    sample = fx.policy_parameters;
  }
  const pageSrc = readFileSync(pageAbs, 'utf8');
  const pageUrl = String(node.url || `https://ainumbers.co/chaingraph/${id}.html`);
  const webmcpRegistered = pageSrc.includes('<!-- WEBMCP:GEN-BEGIN ');
  const expected = buildAskAgentBlock({
    manifestPath: manifestRel,
    toolName: def.name,
    description: def.description,
    sample,
    pageUrl,
    webmcpRegistered,
  });
  return { id, pageRel, pageAbs, pageSrc, expected, mcpName: node.mcp_name, toolName: def.name, sample };
}

function regionsOf(pageSrc) {
  const regions = [];
  let i = pageSrc.indexOf('<!-- ASK-AGENT:BEGIN ');
  while (i !== -1) {
    const end = pageSrc.indexOf(ASK_AGENT_END, i);
    if (end === -1) break;
    regions.push({ start: i, end: end + ASK_AGENT_END.length });
    i = pageSrc.indexOf('<!-- ASK-AGENT:BEGIN ', i + 1);
  }
  return regions;
}

/** Gate: the section 3.1 fragment inside an emitted block decodes to exactly
 *  the declared sample (b64url + gzip + JSON round-trip, the in-page reader's
 *  codec run Node-side). Returns an error string or null. */
function verifyFragment(expected, sample) {
  const m = /Open the tool with the sample prefilled: (\S+)#p=v1\.([A-Za-z0-9_-]+)/.exec(expected);
  if (!m) return 'block carries no deep link';
  let json;
  try {
    const b64 = m[2].replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64');
    json = gunzipSync(buf).toString('utf8');
  } catch (e) {
    return `deep link does not decode: ${e.message}`;
  }
  let params;
  try { params = JSON.parse(json); } catch (e) { return `deep link payload is not JSON: ${e.message}`; }
  return JSON.stringify(params) === JSON.stringify(sample) ? null : 'deep link payload does not equal the declared sample';
}

/** Collect gate results. problems[] non-empty means RED. */
function collect() {
  const live = liveNodes();
  const problems = [];
  const excluded = [];
  const adjudicated = [];
  for (const node of live) {
    const d = adjudicateNode(node, REPO);
    if (d.exclude) { excluded.push(d); continue; }
    if (d.mcpName && d.mcpName !== d.toolName) {
      problems.push(`${d.pageRel}: block tool name '${d.toolName}' != node mcp_name '${d.mcpName}'`);
      continue;
    }
    const fragErr = verifyFragment(d.expected, d.sample);
    if (fragErr) problems.push(`${d.pageRel}: ${fragErr}`);
    adjudicated.push(d);
  }
  if (!WRITE) {
    for (const d of adjudicated) {
      const regions = regionsOf(d.pageSrc);
      if (regions.length === 0) { problems.push(`${d.pageRel}: no ask-agent block (coverage regression) — run node scripts/check-ask-agent-block.mjs --write`); continue; }
      if (regions.length > 1) { problems.push(`${d.pageRel}: ${regions.length} ask-agent blocks, exactly one required`); continue; }
      const actual = d.pageSrc.slice(regions[0].start, regions[0].end);
      if (actual !== d.expected) {
        problems.push(`${d.pageRel}: ask-agent block drifted from its manifest — hand-edits to generated blocks are red; run node scripts/check-ask-agent-block.mjs --write`);
      }
    }
  }
  return { live, problems, excluded, adjudicated };
}

function printExcluded(excluded) {
  excluded.forEach((e) => console.log(`  EXCLUDED ${e.id}: ${e.exclude}`));
}

function run() {
  const { live, problems, excluded, adjudicated } = collect();
  if (WRITE) {
    let written = 0;
    let exact = 0;
    for (const d of adjudicated) {
      const regions = regionsOf(d.pageSrc);
      let next;
      if (regions.length === 1) {
        next = d.pageSrc.slice(0, regions[0].start) + d.expected + d.pageSrc.slice(regions[0].end);
      } else if (regions.length === 0) {
        // Insert before the LAST </body>: several pages embed the literal
        // string '</body>' inside document.write()/template strings in their
        // own scripts (measured: art-373 etc.), so a first-match replace would
        // inject the block into script context and break page parsing.
        const close = d.pageSrc.lastIndexOf('</body>');
        if (close === -1) { problems.push(`${d.pageRel}: no </body> to insert before`); continue; }
        next = d.pageSrc.slice(0, close) + d.expected + '\n\n' + d.pageSrc.slice(close);
      } else {
        problems.push(`${d.pageRel}: ${regions.length} ask-agent blocks, refusing to write`);
        continue;
      }
      if (next !== d.pageSrc) { writeFileSync(d.pageAbs, next, 'utf8'); written++; }
      else exact++;
    }
    if (problems.length) {
      console.error('✗ write pass hit problems:');
      problems.forEach((p) => console.error('    ' + p));
      process.exit(1);
    }
    console.log(`✓ ${written} page(s) written, ${exact} already byte-exact; ${adjudicated.length} emittable of ${live.length} live node(s), ${excluded.length} excluded with reasons (shrinks as manifest/page rows land):`);
    printExcluded(excluded);
    return;
  }
  if (problems.length) {
    console.error(`✗ ask-agent block freshness FAILED (${problems.length}):`);
    problems.forEach((p) => console.error('    ' + p));
    process.exit(1);
  }
  console.log(`✓ ask-agent block freshness clean — ${adjudicated.length}/${live.length} live node page(s) carry exactly one byte-exact block (tool name == mcp_name; deep link decodes to the declared sample); ${excluded.length} live node(s) excluded with reasons (shrinks as manifest/page rows land).`);
  printExcluded(excluded);
}

if (RED_GREEN) {
  // SO #34c RED-then-GREEN proof, in-process (never exits non-zero):
  //   1. pristine tree must be clean (GREEN before),
  //   2. one byte inside one page's emitted block mutated -> collect() must
  //      report a drift problem (RED),
  //   3. page restored -> collect() must be clean again (GREEN after).
  const before = collect();
  if (before.problems.length) fail('tree is not green before the red-green proof');
  const target = before.adjudicated.find((d) => regionsOf(d.pageSrc).length === 1);
  if (!target) fail('no emitted block found to mutate for the red-green proof');
  const mutated = target.pageSrc.replace('Run the AINumbers MCP tool', 'Run the AINumbers MCP t00l');
  if (mutated === target.pageSrc) fail('mutation did not apply');
  writeFileSync(target.pageAbs, mutated, 'utf8');
  const during = collect();
  const redOk = during.problems.some((p) => p.startsWith(target.pageRel) && p.includes('drifted'));
  writeFileSync(target.pageAbs, target.pageSrc, 'utf8'); // restore
  const after = collect();
  if (!redOk) fail('mutated tree did NOT red the gate — the gate is deaf');
  if (after.problems.length) fail('tree still red after restore');
  console.log(`RED-GREEN OK: mutated block in ${target.pageRel} redded the gate (${during.problems.length} problem(s), first: "${during.problems[0]}"); restored tree is clean again.`);
} else {
  run();
}
