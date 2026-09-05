// check-showcase-prompts.mjs — gate for the example-prompts SSOT (mcp/showcase-prompts.json).
// EXAMPLE-PROMPTS-JSON-1. Five checks:
//   (a) every tools[] entry is a live name: an mcp_name in chaingraph/chaingraph.json, a worker
//       utility name (UTILITY_TOOL_NAMES in the vendored worker utility-tools copy), or a helmd
//       name (helm/hub/mcp.mjs TOOLS, written "helmd:<name>"). RED otherwise.
//   (b) every tool name that appears inside a body also appears in that entry's tools[] —
//       no unlisted tool.
//   (c) ids unique; group in the enum; requires ⊆ {W,R,H,L,A,Z}; doorways ⊆ enum.
//   (d) entry count == baseline (down-only ratchet: a later addition updates the baseline file,
//       a silent drop goes red without a code change).
//   (e) copy-hallmarks over title/one_line is enforced by scripts/check-copy-hallmarks.mjs
//       (already in preflight); this script re-runs its scoped assertions for the file so the
//       gate is self-contained under --selftest.
//
// --selftest runs the RED-then-GREEN mutation battery: injects one bad tool name, one unlisted
// body tool, a duplicate id, a bad group, and a count drop, and requires each to fail.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SELFTEST = process.argv.includes('--selftest') || process.argv.includes('--self-test');

const GROUPS = ['showcase', 'persona', 'everyday', 'commerce', 'crypto', 'banking', 'compliance', 'governance'];
const DOORWAYS = ['webmcp', 'mcp', 'helmd', 'ledger', 'anchor', 'zk'];
const REQUIRES = ['W', 'R', 'H', 'L', 'A', 'Z'];

function loadUniverses() {
  const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const mcpNames = new Set((cg.nodes ?? []).map((n) => n.mcp_name).filter(Boolean));
  const baselinePath = resolve(HERE, 'showcase-prompts-baseline.json');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  // The worker/helm name snapshots live in the baseline file (pinned at authoring time from
  // mcp-apps-poc/utility-tools.mjs UTILITY_TOOL_NAMES and helm/hub/mcp.mjs TOOLS — both
  // outside this repo). If an upstream list changes, regenerate the snapshot and re-run;
  // a tool that disappears goes red here, which is the point.
  const utilNames = new Set(baseline.utility_tools ?? []);
  const helmNames = new Set(baseline.helm_tools ?? []);
  return { mcpNames, utilNames, helmNames, baseline };
}
function check(sp, universes) {
  const errs = [];
  const { mcpNames, utilNames, helmNames, baseline } = universes;
  const live = (t) => {
    if (t.startsWith('helmd:')) return helmNames.has(t.slice(6));
    return mcpNames.has(t) || utilNames.has(t);
  };

  const ids = new Set();
  for (const e of sp) {
    const where = `prompt ${e.id}`;
    if (!e.id) errs.push('entry missing id');
    if (ids.has(e.id)) errs.push(`${where}: duplicate id`);
    ids.add(e.id);
    if (!GROUPS.includes(e.group)) errs.push(`${where}: group "${e.group}" not in enum`);
    for (const r of e.requires ?? []) if (!REQUIRES.includes(r)) errs.push(`${where}: requires "${r}" not in legend`);
    for (const d of e.doorways ?? []) if (!DOORWAYS.includes(d)) errs.push(`${where}: doorway "${d}" not in enum`);
    for (const t of e.tools ?? []) if (!live(t)) errs.push(`${where}: tool "${t}" is not a live mcp_name / utility / helmd name`);
    // (b) scan body for known tool names not listed in tools[]
    const listed = new Set((e.tools ?? []).map((t) => (t.startsWith('helmd:') ? t.slice(6) : t)));
    const corpus = [mcpNames, utilNames, helmNames];
    for (const set of corpus) {
      for (const t of set) {
        if (t.length < 5) continue; // skip short names to avoid false substring hits
        if (e.body.includes(t) && !listed.has(t)) errs.push(`${where}: body uses tool "${t}" but it is not in tools[]`);
      }
    }
  }
  if (sp.length < baseline.min_entries) {
    errs.push(`entry count ${sp.length} < baseline ${baseline.min_entries} — silent drop (EXAMPLE-PROMPTS-JSON-1 check d)`);
  }
  // (e) scoped copy-hallmarks assertions (same rules as check-copy-hallmarks.mjs scope block)
  for (const e of sp) {
    for (const field of ['title', 'one_line']) {
      const t = String(e[field] ?? '');
      if (/—/.test(t)) errs.push(`${field} of ${e.id}: em-dash`);
      for (const w of ['seamless', 'robust', 'leverage', 'myriad', 'plethora', 'foster', 'underscore']) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(t)) errs.push(`${field} of ${e.id}: AI-vocabulary "${w}"`);
      }
      for (const a of ['guarantees', 'ensures', 'complies', 'certifies', 'bulletproof', 'unbreakable']) {
        if (new RegExp(`\\b${a}\\b`, 'i').test(t)) errs.push(`${field} of ${e.id}: absolute claim "${a}"`);
      }
    }
  }
  return errs;
}

const universes = loadUniverses();
const raw = JSON.parse(readFileSync(resolve(REPO, 'mcp', 'showcase-prompts.json'), 'utf8'));
const sp = Array.isArray(raw) ? raw : (raw.prompts ?? []);

if (SELFTEST) {
  const clone = () => JSON.parse(JSON.stringify(sp));
  const expectRed = (label, mutate) => {
    const mutated = clone();
    mutate(mutated);
    const errs = check(mutated, universes);
    if (!errs.length) {
      console.error(`✗ selftest FAILED: mutation "${label}" did NOT go red`);
      process.exit(1);
    }
    console.log(`  selftest RED ok: ${label} -> ${errs[0]}`);
  };
  expectRed('bad tool name', (m) => { m[0].tools.push('totally_fake_tool'); });
  expectRed('unlisted body tool', (m) => { const e = m.find((x) => x.body.includes('run_chain')); e.tools = e.tools.filter((t) => t !== 'run_chain'); });
  expectRed('duplicate id', (m) => { m[1].id = m[0].id; });
  expectRed('bad group', (m) => { m[0].group = 'showcase2'; });
  expectRed('bad requires', (m) => { m[0].requires.push('X'); });
  expectRed('bad doorway', (m) => { m[0].doorways.push('carrier-pigeon'); });
  expectRed('count drop', (m) => { m.length = 45; });
  expectRed('em-dash in title', (m) => { m[9].title = 'A — B'; });
  console.log('✓ check-showcase-prompts --selftest: all 8 mutations went RED.');
  process.exit(0);
}

const errs = check(sp, universes);
if (errs.length) {
  console.error(`✗ showcase-prompts FAILED (${errs.length}):`);
  for (const e of errs) console.error('  • ' + e);
  process.exit(1);
}
const groups = {};
for (const e of sp) groups[e.group] = (groups[e.group] || 0) + 1;
console.log(`✓ showcase-prompts: ${sp.length} entries, groups {${Object.entries(groups).map(([k, v]) => `${k}:${v}`).join(', ')}}, all tools live, no unlisted body tools, ids/groups/requires/doorways clean, count ≥ baseline.`);
