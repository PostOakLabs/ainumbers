#!/usr/bin/env node
/**
 * check-webmcp-name-uniqueness.mjs — WEBMCP-GEN-FROM-MANIFEST-1
 *
 * The check-tool-names gate family (CONTRACT §A4.1, mcp-apps-poc) extended to the
 * WebMCP registration namespace. The Worker's gate exists because a name collision
 * threw "Tool X is already registered" → 500 on the /mcp handshake; the same class
 * lands browser-side once 600+ pages carry inline `registerTool` blocks: a duplicate
 * registration name across two pages is a real collision inside one browser namespace
 * (the second page's registration is dropped or the name resolves to the wrong tool,
 * and an agent cannot tell which surface answered).
 *
 * Sources (all recomputed from primary artifacts, never self-attested):
 *   (a) every `registerTool({ name: '...' })` in every tracked *.html page
 *       (enumerated via `git ls-files '*.html'` — SO #52; git child via
 *       scripts/_git-env-lib.mjs — SO #57);
 *   (b) every live node's `mcp_name` in chaingraph.json (READ-only indexing read —
 *       the worker registers exactly these names, so both surfaces name tools to
 *       agents in one vocabulary).
 *
 * FATAL (exit 1):
 *   F1  one WebMCP registration name registered by two different pages;
 *   F2  a WebMCP registration name equals a live node's mcp_name where that node's
 *       own page (chaingraph/<tool_id>.html) is NOT the registering page — a
 *       same-tool twin (page registers the node's mcp_name on the node's own page)
 *       is legal and is the generated shape;
 *   F3  two live nodes sharing one mcp_name (the mcp_name uniqueness half of the
 *       extended gate; measured clean at 640/640 on 2026-09-01).
 *
 * Usage: node scripts/check-webmcp-name-uniqueness.mjs [--self-test]
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

function findMatchingBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Every <script> block body in a page (documentation snippets in visible HTML
 *  prose are not runtime registrations and must not enter the namespace). */
export function scriptBodies(src) {
  const bodies = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) bodies.push(m[1]);
  return bodies;
}

/** Extracts the `name` string of every `.registerTool({ ... })` call in a page source. */
export function extractRegistrationNames(src) {
  const names = [];
  const re = /\.registerTool\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const openBrace = src.indexOf('{', m.index);
    const closeBrace = findMatchingBrace(src, openBrace);
    if (closeBrace === -1) continue;
    const body = src.slice(openBrace, closeBrace + 1);
    const nm = body.match(/\bname\s*:\s*(['"])((?:[^'"\\]|\\.)*)\1/);
    if (nm) names.push(nm[2].replace(/\\(['\\])/g, '$1'));
  }
  return names;
}

/** Page-level extraction: script bodies only, in document order. */
export function extractPageRegistrationNames(src) {
  return scriptBodies(src).flatMap((b) => extractRegistrationNames(b));
}

/** Tracked HTML page list (SO #52: git ls-files, never a filesystem walk). */
export function listTrackedPages(repoRoot) {
  const out = execFileSync('git', ['ls-files', '*.html'], { cwd: repoRoot, env: gitEnv(), encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * Core check over (pageRegistrations: Map<pageRelPath, name[]>) and
 * (nodeNames: Map<mcpName, tool_id[]>). Returns FATAL finding strings (empty = clean).
 */
export function findCollisions(pageRegistrations, nodeNames) {
  const fatal = [];

  // F1 — one name, two pages.
  const byName = new Map();
  for (const [page, names] of pageRegistrations) {
    for (const n of names) {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push(page);
    }
  }
  for (const [name, pages] of byName) {
    const uniq = [...new Set(pages)];
    if (uniq.length > 1) fatal.push(`F1: WebMCP name '${name}' is registered by ${uniq.length} pages: ${uniq.join(', ')}`);
  }

  // F2 — WebMCP name vs a live node mcp_name owned by a DIFFERENT page.
  for (const [name, pages] of byName) {
    const nodes = nodeNames.get(name);
    if (!nodes) continue;
    for (const toolId of nodes) {
      const ownPage = `chaingraph/${toolId}.html`;
      for (const page of new Set(pages)) {
        const pageBase = page.split(/[/\\]/).pop();
        if (pageBase !== `${toolId}.html`) {
          fatal.push(`F2: WebMCP name '${name}' on ${page} collides with live node mcp_name of ${toolId} (own page ${ownPage})`);
        }
      }
    }
  }

  // F3 — mcp_name mutual uniqueness across live nodes.
  for (const [name, toolIds] of nodeNames) {
    if (toolIds.length > 1) fatal.push(`F3: mcp_name '${name}' is declared by ${toolIds.length} live nodes: ${toolIds.join(', ')}`);
  }

  return fatal;
}

function loadLiveNodeNames(repoRoot) {
  const nodeNames = new Map();
  let g;
  try {
    g = JSON.parse(readFileSync(resolve(repoRoot, 'chaingraph', 'chaingraph.json'), 'utf8'));
  } catch {
    return nodeNames; // unreadable chaingraph.json is the assembler's domain, not this gate's
  }
  for (const n of g?.nodes || []) {
    if (n?.status === 'live' && n?.mcp_name) {
      if (!nodeNames.has(n.mcp_name)) nodeNames.set(n.mcp_name, []);
      nodeNames.get(n.mcp_name).push(n.tool_id);
    }
  }
  return nodeNames;
}

function run(repoRoot) {
  const pages = listTrackedPages(repoRoot);
  const pageRegistrations = new Map();
  let registrationCount = 0;
  for (const p of pages) {
    let src;
    try { src = readFileSync(resolve(repoRoot, p), 'utf8'); } catch { continue; }
    const names = extractPageRegistrationNames(src);
    if (names.length) {
      pageRegistrations.set(p, names);
      registrationCount += names.length;
    }
  }
  const nodeNames = loadLiveNodeNames(repoRoot);
  const fatal = findCollisions(pageRegistrations, nodeNames);
  if (fatal.length) {
    console.error(`✗ webmcp-name-uniqueness FAILED (${fatal.length} collision${fatal.length === 1 ? '' : 's'}):`);
    fatal.forEach((f) => console.error('    ' + f));
    console.error('\nOne browser namespace holds every page registration; one worker namespace holds every mcp_name.');
    console.error('A name may be reused only as the same-tool twin: the node page registering its own mcp_name.');
    process.exit(1);
  }
  const nodeCount = [...nodeNames.values()].length;
  console.log(`✓ webmcp-name-uniqueness clean — ${registrationCount} page registration(s) across ${pageRegistrations.size} page(s), ${nodeCount} live node mcp_name(s); no duplicate, no cross-surface collision.`);
}

const SELFTEST_PAGES = new Map([
  ['chaingraph/art-9000-fixture-a.html', ['fixture_tool_alpha']],
  ['chaingraph/art-9001-fixture-b.html', ['verify_something_else']],
  ['chaingraph/art-9002-node-page.html', ['twin_name_of_this_node']],
]);
const SELFTEST_NODES = new Map([
  ['twin_name_of_this_node', ['art-9002-node-page']],
  ['other_live_node_name', ['art-9003-other-node']],
]);

function selftest() {
  let failures = 0;
  const check = (label, ok) => {
    console.log((ok ? '  ✓ ' : '  ✗ ') + label);
    if (!ok) failures++;
  };

  // GREEN: distinct names + one legal same-tool twin.
  const green = findCollisions(SELFTEST_PAGES, SELFTEST_NODES);
  check('GREEN control: distinct names + legal twin pass', green.length === 0);

  // RED (F1): a second page registers the same name — verdict must MOVE.
  const dup = new Map(SELFTEST_PAGES);
  dup.set('chaingraph/art-9004-intruder.html', ['fixture_tool_alpha']);
  const red1 = findCollisions(dup, SELFTEST_NODES);
  check('RED F1 control: duplicate page registration caught', red1.some((f) => f.startsWith('F1:')));
  check('F1 verdict moves with the artifact (clean set had none)', green.length === 0 && red1.length > 0);

  // RED (F2): a page that is NOT the node's own page claims the node's mcp_name.
  const cross = new Map(SELFTEST_PAGES);
  cross.set('chaingraph/art-9005-somewhere-else.html', ['other_live_node_name']);
  const red2 = findCollisions(cross, SELFTEST_NODES);
  check('RED F2 control: cross-surface mcp_name collision caught', red2.some((f) => f.startsWith('F2:')));

  // RED (F3): two live nodes share an mcp_name.
  const dupNodes = new Map(SELFTEST_NODES);
  dupNodes.set('other_live_node_name', ['art-9003-other-node', 'art-9006-second-node']);
  const red3 = findCollisions(SELFTEST_PAGES, dupNodes);
  check('RED F3 control: duplicate node mcp_name caught', red3.some((f) => f.startsWith('F3:')));

  // Extraction: quoted, escaped, and multi-registration forms.
  const exSrc = `<script>
const mc = document.modelContext ?? null;
if (mc) {
  mc.registerTool({ name: 'alpha_one', description: 'x', execute: function(){} });
  mc.registerTool({ name: 'beta_two', description: 'y', execute: function(){} });
}
</script>`;
  const names = extractRegistrationNames(exSrc);
  check('extraction finds both names in order', names.length === 2 && names[0] === 'alpha_one' && names[1] === 'beta_two');
  const esc = extractRegistrationNames("mc.registerTool({ name: 'it\\'s_escaped', description: 'z' });");
  check('extraction unescapes quoted names', esc.length === 1 && esc[0] === "it's_escaped");
  const dq = extractRegistrationNames('mc.registerTool({ name: "double_quoted", description: "z" });');
  check('extraction reads double-quoted names', dq.length === 1 && dq[0] === 'double_quoted');
  const docSnippet = '<div class="snippet">document.modelContext.registerTool({\n  name: "probe-tool",\n});</div>';
  check('extraction skips registerTool mentions outside <script> blocks', extractPageRegistrationNames(docSnippet).length === 0);
  const inScript = '<script>document.modelContext.registerTool({ name: "probe_tool_two", description: "probe two" });</script>';
  check('extraction reads registrations inside <script> blocks', extractPageRegistrationNames(inScript).length === 1 && extractPageRegistrationNames(inScript)[0] === 'probe_tool_two');
  const none = extractRegistrationNames('<p>no registrations here</p>');
  check('extraction returns none for a page without registerTool', none.length === 0);

  console.log(failures === 0 ? 'WEBMCP-NAME-UNIQUENESS SELFTEST: PASS' : 'WEBMCP-NAME-UNIQUENESS SELFTEST: FAIL');
  process.exit(failures === 0 ? 0 : 1);
}

if (process.argv.includes('--self-test')) {
  selftest();
} else {
  run(REPO);
}
