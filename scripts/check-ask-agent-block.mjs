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
 *   node scripts/check-ask-agent-block.mjs           (freshness gate; default —
 *                                                     ALWAYS whole-tree)
 *   node scripts/check-ask-agent-block.mjs --write   (regenerate blocks, whole tree)
 *   node scripts/check-ask-agent-block.mjs --write --only <node id>
 *       (WRITER-SCOPE-1, row-scoped regeneration: the write pass regenerates
 *        exactly the named node's page and touches nothing else — the
 *        sanctioned route for a row-scoped writer run or ask-agent heal,
 *        replacing the old "git checkout -- every other page" hand-revert
 *        workaround. --only without --write exits 2 with usage; the CHECK
 *        pass (no --write) stays whole-tree — the gate semantics do not
 *        change. Row-scoped recipe:
 *          node scripts/check-ask-agent-block.mjs --write --only art-699-x402-permit2-evidence-recomposer )
 *   node scripts/check-ask-agent-block.mjs --red-green
 *       (SO #34c proof: the gate is run against the pristine tree (GREEN),
 *        one byte inside one page's emitted region is mutated and the gate is
 *        re-run in-process expecting problems (RED), the page is restored and
 *        the gate is re-run expecting clean (GREEN). Never exits non-zero.)
 *
 * Exit: 0 clean; 1 on any drift, duplication, or coverage regression; 2 on a
 *       --only usage error.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  ASK_AGENT_END, askAgentImperative, buildAskAgentBlock, encodeAskAgentFragment,
} from '../chaingraph/_page-chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const WRITE = process.argv.includes('--write');
const RED_GREEN = process.argv.includes('--red-green');
// WRITER-SCOPE-1: --only <node id> scopes the WRITE pass to exactly the named
// node's page. The CHECK pass (no --write) is ALWAYS whole-tree — the gate
// semantics do not change — so --only without --write is a usage error (exit 2).
const onlyAt = process.argv.indexOf('--only');
const ONLY = onlyAt !== -1 ? process.argv[onlyAt + 1] : null;

function usageError(msg) {
  console.error([
    'USAGE-ERROR: ' + msg,
    '',
    '  node scripts/check-ask-agent-block.mjs                          whole-tree freshness gate',
    "  node scripts/check-ask-agent-block.mjs --write                  regenerate every page's block",
    "  node scripts/check-ask-agent-block.mjs --write --only <node id> write exactly the named node's page",
    '  node scripts/check-ask-agent-block.mjs --red-green | --self-test',
    '',
    '--only scopes the WRITE pass only: without --write it exits 2; the CHECK',
    'pass (no --write) is always whole-tree.',
  ].join('\n'));
  process.exit(2);
}
if (onlyAt !== -1 && (!ONLY || ONLY.startsWith('--'))) usageError('--only requires a <node id> argument');
if (ONLY && !WRITE) usageError('--only scopes the WRITE pass; re-run with --write');

function assert(cond, what) {
  if (!cond) fail('self-test assertion failed: ' + what);
}

/** SO #34c RED-then-GREEN proof, in-process (never exits non-zero):
 *  1. pristine tree clean (GREEN before), 2. one byte inside one page's emitted
 *  block mutated -> collect() reports a drift problem (RED), 3. page restored ->
 *  clean again (GREEN after). */
/** SO #34c RED-then-GREEN proof, in-process (never exits non-zero):
 *  1. pristine tree clean (GREEN before), 2. one byte inside one page's emitted
 *  block mutated -> collect() reports a drift problem (RED), 3. page restored ->
 *  clean again (GREEN after). */
async function redGreen() {
  const before = await collect();
  if (before.problems.length) fail('tree is not green before the red-green proof');
  const target = before.adjudicated.find((d) => regionsOf(d.pageSrc).length === 1);
  if (!target) fail('no emitted block found to mutate for the red-green proof');
  const mutated = target.pageSrc.replace('Run the AINumbers MCP tool', 'Run the AINumbers MCP t00l');
  if (mutated === target.pageSrc) fail('mutation did not apply');
  writeFileSync(target.pageAbs, mutated, 'utf8');
  const during = await collect();
  const redOk = during.problems.some((p) => p.startsWith(target.pageRel) && p.includes('drifted'));
  writeFileSync(target.pageAbs, target.pageSrc, 'utf8'); // restore
  const after = await collect();
  if (!redOk) fail('mutated tree did NOT red the gate — the gate is deaf');
  if (after.problems.length) fail('tree still red after restore');
  console.log(`RED-GREEN OK: mutated block in ${target.pageRel} redded the gate (${during.problems.length} problem(s), first: "${during.problems[0]}"); restored tree is clean again.`);
}

function fail(msg) {
  console.error('GEN-ERROR: ' + msg);
  process.exit(1);
}

/** WRITER-SCOPE-1 red-then-green proof on a hermetic fixture tree (temp dir,
 *  never touches the live tree): (red) an unscoped --write repaints 2+ fixture
 *  pages — one page missing its block (inserted) and one page carrying
 *  byte-exact block content at the wrong anchor (placement-moved, the measured
 *  art-701 repaint shape the CHECK pass cannot see); (green) --write --only
 *  <fixture node> modifies exactly 1 page, leaves the sibling byte-identical,
 *  and the whole-tree CHECK pass is clean afterwards. */
async function writerScopeProof() {
  const root = mkdtempSync(join(tmpdir(), 'ask-agent-writer-scope-'));
  const idA = 'scope-art-a';
  const idB = 'scope-art-b';
  const description = 'Validates the writer-scope fixture. Twice.';
  const nodes = [
    { tool_id: idA, status: 'live', mcp_name: 'scope_tool_a', url: `https://ainumbers.co/chaingraph/${idA}.html` },
    { tool_id: idB, status: 'live', mcp_name: 'scope_tool_b', url: `https://ainumbers.co/chaingraph/${idB}.html` },
  ];
  mkdirSync(join(root, 'chaingraph', 'kernels'), { recursive: true });
  mkdirSync(join(root, 'manifests'), { recursive: true });
  writeFileSync(join(root, 'chaingraph', 'chaingraph.json'), JSON.stringify({ nodes }, null, 2), 'utf8');
  for (const n of nodes) {
    writeFileSync(join(root, 'manifests', `${n.tool_id}.manifest.json`), JSON.stringify({
      mcp_tool_definition: { name: n.mcp_name, description },
      example: { policy_parameters: { k: n.tool_id } },
    }, null, 2), 'utf8');
    writeFileSync(join(root, 'chaingraph', 'kernels', `${n.tool_id}.kernel.mjs`),
      `export async function buildArtifact(sample){ if (!sample || sample.k !== ${JSON.stringify(n.tool_id)}) throw new Error('bad sample'); return { execution_hash: 'k'.repeat(64) }; }\n`, 'utf8');
  }
  const pageA = '<!doctype html><html><body><h1>scope-a</h1><footer>site footer</footer></body></html>';
  // Content byte-exact but at the WRONG anchor (before </body> instead of the
  // footer) — the measured placement-drift shape: an unscoped --write moves it
  // even though the CHECK pass stays green either way.
  const blockB = buildAskAgentBlock({
    manifestPath: `manifests/${idB}.manifest.json`, toolName: 'scope_tool_b',
    description, sample: { k: idB }, pageUrl: nodes[1].url, webmcpRegistered: false,
  });
  const pageB = `<!doctype html><html><body><h1>scope-b</h1><footer>site footer</footer>\n\n${blockB}\n\n</body></html>`;
  const pageAAbs = join(root, 'chaingraph', `${idA}.html`);
  const pageBAbs = join(root, 'chaingraph', `${idB}.html`);
  writeFileSync(pageAAbs, pageA, 'utf8');
  writeFileSync(pageBAbs, pageB, 'utf8');
  const red = await writePass(root); // unscoped --write
  if (red.error || red.problems.length) fail('fixture write pass unexpectedly errored: ' + (red.error || red.problems[0]));
  const redTouched = [idA, idB].filter((id) => readFileSync(join(root, 'chaingraph', `${id}.html`), 'utf8') !== (id === idA ? pageA : pageB));
  assert(redTouched.length >= 2, `unscoped --write must repaint 2+ fixture pages, repainted ${redTouched.length}`);
  console.log(`WRITER-SCOPE RED: unscoped --write on the fixture tree repainted ${redTouched.length} page(s) (${redTouched.join(', ')}) — every drifted sibling, exactly the measured repaint.`);
  writeFileSync(pageAAbs, pageA, 'utf8'); // restore fixture bytes
  writeFileSync(pageBAbs, pageB, 'utf8');
  const green = await writePass(root, idA); // --write --only <fixture node>
  if (green.error || green.problems.length) fail('scoped write pass unexpectedly errored: ' + (green.error || green.problems[0]));
  assert(green.written === 1, `--only must write exactly 1 page, wrote ${green.written}`);
  assert(readFileSync(pageAAbs, 'utf8') !== pageA, '--only did not write the named page');
  assert(readFileSync(pageBAbs, 'utf8') === pageB, '--only repainted the sibling page — scoping is broken');
  const after = await collect(root); // whole-tree CHECK pass on the fixture tree
  assert(after.problems.length === 0, 'whole-tree check red after the scoped write: ' + after.problems[0]);
  console.log(`WRITER-SCOPE GREEN: --write --only ${idA} wrote exactly ${green.written} page (${green.scopedCount} scoped emittable of ${green.liveCount} live), sibling byte-identical; whole-tree check on the fixture tree afterwards: clean.`);
  rmSync(root, { recursive: true, force: true });
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function liveNodes(repoRoot = REPO) {
  const cg = loadJson(resolve(repoRoot, 'chaingraph', 'chaingraph.json'));
  return (cg.nodes || []).filter((n) => n.status === 'live' && n.tool_id);
}

/** The adjudicated per-page inputs; { exclude } + reason when the block cannot
 *  be emitted for this node today (honest exclusion, never a guess — same
 *  posture as gen-webmcp-registrations.mjs). */
async function adjudicateNode(node, repoRoot) {
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
  // sample: manifest example when declared (top-level legacy, or
  // mcp_tool_definition.example — the schema-legal home, used by the five §25
  // private-input manifests for raw witnesses), else fixture 0 policy_parameters
  let sample = null;
  const ex = manifest.example ?? manifest.mcp_tool_definition?.example;
  if (ex && typeof ex === 'object' && !Array.isArray(ex)) {
    sample = ex.policy_parameters && typeof ex.policy_parameters === 'object'
      ? ex.policy_parameters : ex;
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
  // ASKAGENT-SAMPLE-EXEC-GATE-1: the published sample must actually RUN through
  // the node's own kernel. SPEC.md §25 private-input nodes take the RAW witness
  // as buildArtifact input, so fixture-derived post-commitment samples are
  // exactly the class this execution catches (D6: five pages shipped samples
  // that always threw "salt must be a hex string..."). Import by pathToFileURL
  // per SO #34's rider — no eval, same pattern as the other kernel gates.
  const kernelPath = join(repoRoot, 'chaingraph', 'kernels', `${id}.kernel.mjs`);
  if (!existsSync(kernelPath)) return { id, exclude: `no kernel shard chaingraph/kernels/${id}.kernel.mjs to execute the published sample` };
  let kernel;
  try { kernel = await import(pathToFileURL(kernelPath).href); }
  catch (e) { return { id, exclude: `kernel shard chaingraph/kernels/${id}.kernel.mjs unimportable: ${e.message}` }; }
  if (typeof kernel.buildArtifact !== 'function') return { id, exclude: `kernel shard chaingraph/kernels/${id}.kernel.mjs lacks buildArtifact()` };
  let artifact;
  try {
    artifact = await kernel.buildArtifact(sample, { now: new Date('2026-01-01T00:00:00Z'), parent_hashes: [], parent_tool_ids: [], chain_depth: 0 });
  } catch (e) {
    return { id, pageRel: `chaingraph/${id}.html`, sampleError: `published sample cannot run — kernel threw "${e.message}"` };
  }
  if (!artifact || typeof artifact.execution_hash !== 'string' || artifact.execution_hash.length === 0) {
    return { id, pageRel: `chaingraph/${id}.html`, sampleError: 'published sample cannot run — kernel produced no execution_hash' };
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
    isGpu: node.gpu === true,
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

/** Collect gate results. problems[] non-empty means RED. `repoRoot` defaults
 *  to the live tree; the self-test's writer-scope proof runs it against a
 *  hermetic fixture tree. `writeMode` forces the WRITE-pass posture (skip the
 *  region checks — a missing block is what the pass is for); defaults to the
 *  global WRITE so the CHECK pass semantics are untouched. */
async function collect(repoRoot = REPO, writeMode = WRITE) {
  const live = liveNodes(repoRoot);
  const problems = [];
  const excluded = [];
  const adjudicated = [];
  for (const node of live) {
    const d = await adjudicateNode(node, repoRoot);
    if (d.exclude) { excluded.push(d); continue; }
    if (d.sampleError) { problems.push(`${d.pageRel}: ${d.sampleError}`); continue; }
    if (d.mcpName && d.mcpName !== d.toolName) {
      problems.push(`${d.pageRel}: block tool name '${d.toolName}' != node mcp_name '${d.mcpName}'`);
      continue;
    }
    const fragErr = verifyFragment(d.expected, d.sample);
    if (fragErr) problems.push(`${d.pageRel}: ${fragErr}`);
    adjudicated.push(d);
  }
  if (!writeMode) {
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

/** The WRITE pass: regenerate blocks. With `onlyId` set (the --only flag) the
 *  pass regenerates exactly the named node's page and touches nothing else —
 *  the sanctioned row-scoped route (WRITER-SCOPE-1), replacing the old
 *  "git checkout -- every other page" hand-revert workaround. Returns the
 *  counters plus `.error` for scoped-selection failures. */
async function writePass(repoRoot, onlyId = null) {
  const { live, problems, excluded, adjudicated } = await collect(repoRoot, true);
  let scoped = adjudicated;
  if (onlyId) {
    if (!live.some((n) => n.tool_id === onlyId)) {
      return { error: `--only ${onlyId}: not a live node id in chaingraph.json`, problems, excluded };
    }
    scoped = adjudicated.filter((d) => d.id === onlyId);
    if (scoped.length === 0) {
      const why = excluded.find((e) => e.id === onlyId);
      return { error: `--only ${onlyId}: no emittable ask-agent block today${why ? ' — ' + why.exclude : ''}`, problems, excluded };
    }
  }
  let written = 0;
  let exact = 0;
  for (const d of scoped) {
    // Strip any existing region, then re-insert at the preferred anchor, so a
    // placement-policy change moves existing blocks instead of freezing them.
    let base = d.pageSrc;
    for (const r of regionsOf(base).reverse()) {
      base = base.slice(0, r.start) + base.slice(r.end);
    }
    let next;
    // Visible block: insert BEFORE the first <footer> that is NOT inside a
    // <script> span (reader-facing content belongs above the footer). Some
    // pages build their whole body inside a template literal in a script
    // that itself contains '<footer>' (measured: art-139/140/142/143) —
    // injecting there breaks page parsing. Fallback: before the LAST
    // </body> (never a first-match replace — several pages embed the
    // literal '</body>' inside script strings, measured: art-373 etc.).
    const scriptSpans = [];
    {
      const re = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
      let m;
      while ((m = re.exec(base)) !== null) scriptSpans.push([m.index, m.index + m[0].length]);
    }
    const inScript = (i) => scriptSpans.some(([a, b]) => i >= a && i < b);
    let close = -1;
    let f = base.indexOf('<footer>');
    while (f !== -1) {
      if (!inScript(f)) { close = f; break; }
      f = base.indexOf('<footer>', f + 1);
    }
    if (close === -1) close = base.lastIndexOf('</body>');
    if (close === -1) { problems.push(`${d.pageRel}: no non-script <footer> or </body> to insert before`); continue; }
    const head = base.slice(0, close).replace(/\s+$/, '');
    next = head + '\n\n' + d.expected + '\n\n' + base.slice(close);
    if (next !== d.pageSrc) { writeFileSync(d.pageAbs, next, 'utf8'); written++; }
    else exact++;
  }
  return { written, exact, scoped, scopedCount: scoped.length, onlyId, liveCount: live.length, excludedCount: excluded.length, excluded, problems };
}

async function run() {
  if (WRITE) {
    const r = await writePass(REPO, ONLY);
    if (r.error) fail(r.error);
    if (r.problems.length) {
      console.error('✗ write pass hit problems:');
      r.problems.forEach((p) => console.error('    ' + p));
      process.exit(1);
    }
    console.log(`✓ ${r.written} page(s) written, ${r.exact} already byte-exact; ${r.scopedCount} emittable of ${r.liveCount} live node(s)${r.onlyId ? ` (--only ${r.onlyId} scoped)` : ''}, ${r.excludedCount} excluded with reasons (shrinks as manifest/page rows land):`);
    printExcluded(r.excluded);
    return;
  }
  const { live, problems, excluded, adjudicated } = await collect();
  if (problems.length) {
    console.error(`✗ ask-agent block freshness FAILED (${problems.length}):`);
    problems.forEach((p) => console.error('    ' + p));
    process.exit(1);
  }
  console.log(`✓ ask-agent block freshness clean — ${adjudicated.length}/${live.length} live node page(s) carry exactly one byte-exact block (tool name == mcp_name; deep link decodes to the declared sample); ${excluded.length} live node(s) excluded with reasons (shrinks as manifest/page rows land).`);
  printExcluded(excluded);
}

if (RED_GREEN) {
  redGreen();
} else if (process.argv.includes('--self-test')) {
  // GATE-SELFTEST-META-1 pairing (rail 3: --self-test as its own GATES entry):
  // pure-function proofs plus the tree-touching mutation proof (never exits
  // non-zero on a red tree — it only proves the CHECKER goes red).
  assert(askAgentImperative('Validates AP2 v0.2 mandate chains. Extra.') === 'Validate AP2 v0.2 mandate chains.', 'verb table: Validates -> Validate');
  assert(askAgentImperative('Computes fund NAVs. Extra.') === 'Compute fund NAVs.', 'verb table: Computes -> Compute');
  assert(askAgentImperative('Basel III endgame RWA calculator. Extra.') === 'Basel III endgame RWA calculator.', 'unknown first word keeps the sentence verbatim');
  assert(askAgentImperative('') === '', 'empty description stays empty');
  const frag = encodeAskAgentFragment({ b: 2, a: [1, 'x'] });
  assert(frag.startsWith('#p=v1.') && !/[+/=]/.test(frag.slice(6)), 'fragment is #p=v1.<base64url>');
  const back = JSON.parse(gunzipSync(Buffer.from(frag.slice(6).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (frag.slice(6).length % 4)) % 4), 'base64')).toString('utf8'));
  assert(JSON.stringify(back) === JSON.stringify({ b: 2, a: [1, 'x'] }), 'fragment round-trips to the sample');
  const block = buildAskAgentBlock({
    manifestPath: 'manifests/selftest.manifest.json', toolName: 'self_test_tool',
    description: 'Validates the self-test. Twice.', sample: { k: 1 },
    pageUrl: 'https://ainumbers.co/chaingraph/self-test.html', webmcpRegistered: true,
  });
  assert(block.startsWith('<!-- ASK-AGENT:BEGIN generator=scripts/check-ask-agent-block.mjs manifest=manifests/selftest.manifest.json -->'), 'block begins with its provenance marker');
  assert(block.trimEnd().endsWith(ASK_AGENT_END), 'block ends with the END marker');
  assert((block.match(/<pre id="ask-agent-copy"/g) || []).length === 1, 'exactly one copy surface (a single pre carrying the paragraph)');
  assert(block.includes('verify_execution_hash') && block.includes('https://ledger.ainumbers.co/'), 'verify + ledger sentences present');
  assert(verifyFragment(block, { k: 1 }) === null, 'emitted block fragment decodes to the sample');
  const gpuBlock = buildAskAgentBlock({
    manifestPath: 'manifests/selftest.manifest.json', toolName: 'self_test_tool',
    description: 'Validates the self-test. Twice.', sample: { k: 1 },
    pageUrl: 'https://ainumbers.co/chaingraph/self-test.html', webmcpRegistered: false, isGpu: true,
  });
  assert(gpuBlock.includes('computes in your browser'), 'gpu block routes the agent to the in-page run');
  assert(gpuBlock.includes('Policy Mandate artifact'), 'gpu block names the page-produced artifact to verify');
  assert(!gpuBlock.includes('with the parameter `claimed_hash`'), 'gpu block never promises a server-side hash');
  await redGreen();
  await writerScopeProof();
  console.log('SELF-TEST PASS (verb table, fragment round-trip, block shape, gpu sentence, sample execution, mutation red-green, writer --only scoping red-then-green).');
} else {
  await run();
}
