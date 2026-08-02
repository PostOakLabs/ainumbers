// generate-node-manifest.mjs — draft repo/manifests/<tool_id>.manifest.json for a
// live chaingraph.json node that has none yet (CONTRACT.md §2.7 backfill, MFSTGEN-1).
//
// Sources read, in order of trust: (1) the node's chaingraph.json entry,
// (2) the node's page's inline `const MANIFEST = {...}` block (not read by
// any other generator today), (3) the node's conformance-vector fixture
// `expected_output_payload` if one exists, else (4) the node's recorded
// `compute_proof.journal.output`. Tier3 nodes (no proof yet) get every
// machine-derivable field except output_schema.
//
// tags, ap2_export, execution.function_name have no source on most pages
// (measured: tags ~1%, ap2_export ~11%, function_name ~2.4% of art-*.html
// pages carry them in the inline MANIFEST) — used when present, never
// guessed otherwise. Absent ones get an explicit greppable TODO marker
// (TODO_TAGS_REVIEW / TODO_FUNCTION_NAME_REVIEW / a TODO_AP2_EXPORT_REVIEW
// tag, since ap2_export is a strict boolean and can't itself carry a
// string marker).
//
// category (NODECAT-WIRE-1): inline MANIFEST value wins when present
// (~12% of pages); otherwise derived from the node's chaingraph/hub-categories.json
// cluster assignment, slugified — that file already assigns 494/526 nodes to
// one of 94 named clusters (built for the hub page, per NODECAT-SCOPE-1).
// A node in neither source gets the explicit TODO_CATEGORY_REVIEW marker,
// never a fabricated value.
// output_schema is best-effort single-sample JSON-Schema-from-example,
// never hand-composed — see deriveSchema().
//
// Modes:
//   --all --check              dry run over every in-scope node, no writes,
//                               reports tier counts + per-TODO counts +
//                               in-memory schema validation against
//                               chaingraph/schemas/manifest.schema.json
//   --tool-id <id> [--out DIR] draft one node's manifest, write to DIR
//                               (default: manifests/)
//   --sample N [--out DIR]     draft N nodes spread across the derivation
//                               tiers, write to DIR (default: manifests/)

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CHAINGRAPH_JSON = resolve(REPO, 'chaingraph', 'chaingraph.json');
const VECTORS_DIR = resolve(REPO, 'chaingraph', 'conformance', 'vectors');
const MANIFESTS_DIR = resolve(REPO, 'manifests');
const SCHEMA_PATH = resolve(REPO, 'chaingraph', 'schemas', 'manifest.schema.json');
const HUB_CATEGORIES_JSON = resolve(REPO, 'chaingraph', 'hub-categories.json');

// ---- category derivation from hub-categories.json cluster assignment
// (NODECAT-SCOPE-1: 494/526 nodes already carry a cluster there, built for
// the hub page, never wired into manifest `category`). A node's cluster
// title is slugified and used only when the inline MANIFEST carries no
// explicit category. A node absent from hub-categories.json falls through
// to the existing TODO marker — never fabricated. ----
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function loadToolIdToCategorySlug() {
  const clusters = JSON.parse(readFileSync(HUB_CATEGORIES_JSON, 'utf8'));
  const map = new Map();
  for (const [title, { art_ids }] of Object.entries(clusters)) {
    const slug = slugify(title);
    for (const toolId of art_ids) map.set(toolId, slug);
  }
  return map;
}
const TOOL_ID_TO_CATEGORY_SLUG = loadToolIdToCategorySlug();

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i === -1 ? def : args[i + 1];
};

// ---- minimal JSON Schema (draft 2020-12 subset) validator — same subset as
// scripts/check-manifest-schema.mjs, kept as a separate small copy per that
// script's own stated convention rather than a shared import. ----
function validate(schema, data, root, path, errs) {
  if (schema.$ref) {
    const def = resolveRef(schema.$ref, root);
    if (!def) { errs.push(`${path}: unresolved $ref ${schema.$ref}`); return; }
    return validate(def, data, root, path, errs);
  }
  if (schema.oneOf) {
    const branchErrs = schema.oneOf.map((s) => { const e = []; validate(s, data, root, path, e); return e; });
    const passing = branchErrs.filter((e) => e.length === 0).length;
    if (passing !== 1) {
      errs.push(`${path}: matched ${passing} of ${schema.oneOf.length} oneOf branches (need exactly 1)`);
    }
    return;
  }
  if (schema.type && !typeOk(schema.type, data)) {
    errs.push(`${path}: expected type ${JSON.stringify(schema.type)}, got ${jsType(data)}`);
    return;
  }
  if (typeof data === 'string' && schema.minLength != null && data.length < schema.minLength)
    errs.push(`${path}: shorter than minLength ${schema.minLength}`);
  if (Array.isArray(data) && schema.items)
    data.forEach((d, i) => validate(schema.items, d, root, `${path}[${i}]`, errs));
  if (isObj(data)) {
    (schema.required || []).forEach((k) => { if (!(k in data)) errs.push(`${path}: missing required "${k}"`); });
    if (schema.properties)
      for (const [k, s] of Object.entries(schema.properties))
        if (k in data) validate(s, data[k], root, `${path}.${k}`, errs);
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const k of Object.keys(data))
        if (!allowed.has(k)) errs.push(`${path}: additional property "${k}" not allowed (strict)`);
    }
  }
}
function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) return null;
  return ref.slice(2).split('/').reduce((o, seg) => (o ? o[seg] : undefined), root);
}
function typeOk(t, d) {
  if (Array.isArray(t)) return t.some((x) => typeOk(x, d));
  return t === 'object' ? isObj(d)
    : t === 'null' ? d === null
    : t === 'array' ? Array.isArray(d)
    : t === 'string' ? typeof d === 'string'
    : t === 'number' ? typeof d === 'number'
    : t === 'integer' ? Number.isInteger(d)
    : t === 'boolean' ? typeof d === 'boolean'
    : true;
}
const isObj = (d) => d !== null && typeof d === 'object' && !Array.isArray(d);
const jsType = (d) => (Array.isArray(d) ? 'array' : d === null ? 'null' : typeof d);

// ---- best-effort JSON-Schema-from-example (matches MFSTSCOPE-1-2026-08-02.md §1) ----
function deriveSchema(sample) {
  if (sample === null || sample === undefined) return { type: 'string' }; // can't see through null; least-committal
  if (Array.isArray(sample)) {
    return sample.length
      ? { type: 'array', items: deriveSchema(sample[0]) }
      : { type: 'array' };
  }
  if (isObj(sample)) {
    const properties = {};
    for (const [k, v] of Object.entries(sample)) properties[k] = deriveSchema(v);
    return { type: 'object', properties };
  }
  if (typeof sample === 'number') return { type: Number.isInteger(sample) ? 'integer' : 'number' };
  if (typeof sample === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

// ---- inline `const MANIFEST = {...}` extraction from a node's page ----
function extractInlineManifest(html) {
  const start = html.indexOf('const MANIFEST');
  if (start === -1) return null;
  const braceStart = html.indexOf('{', start);
  if (braceStart === -1) return null;
  let depth = 0, inStr = null, esc = false, end = -1;
  for (let i = braceStart; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  const snippet = html.slice(braceStart, end + 1);
  try {
    return new Function(`return (${snippet});`)();
  } catch {
    return null; // malformed/non-literal MANIFEST block — treat as absent, never guess
  }
}

function relativeEntry(url) {
  try { return new URL(url).pathname.replace(/^\//, ''); }
  catch { return url; }
}

function loadFixtureOutput(toolId) {
  const p = resolve(VECTORS_DIR, `${toolId}.fixture.json`);
  if (!existsSync(p)) return null;
  const fx = JSON.parse(readFileSync(p, 'utf8'));
  return fx.expected_output_payload ?? null;
}

function deriveTier(node, toolId) {
  if (existsSync(resolve(VECTORS_DIR, `${toolId}.fixture.json`))) return 1;
  if (node.compute_proof?.journal?.output) return 2;
  return 3;
}

function draftManifest(node) {
  const toolId = node.tool_id;
  const pagePath = resolve(REPO, 'chaingraph', `${toolId}.html`);
  const html = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
  const inline = html ? extractInlineManifest(html) : null;

  const tier = deriveTier(node, toolId);
  let outputSample = null;
  if (tier === 1) outputSample = loadFixtureOutput(toolId);
  else if (tier === 2) outputSample = node.compute_proof.journal.output;

  const todo = [];
  const hubCategorySlug = TOOL_ID_TO_CATEGORY_SLUG.get(toolId);
  let categorySource;
  const category = typeof inline?.category === 'string' && inline.category
    ? ((categorySource = 'inline MANIFEST'), inline.category)
    : hubCategorySlug
      ? ((categorySource = 'hub-categories.json cluster'), hubCategorySlug)
      : ((categorySource = null), todo.push('category'), 'TODO_CATEGORY_REVIEW');
  const tags = Array.isArray(inline?.tags) && inline.tags.length
    ? [...inline.tags]
    : (todo.push('tags'), ['TODO_TAGS_REVIEW']);
  const functionName = typeof inline?.execution?.function_name === 'string' && inline.execution.function_name
    ? inline.execution.function_name
    : (todo.push('execution.function_name'), 'TODO_FUNCTION_NAME_REVIEW');
  let ap2Export;
  if (typeof inline?.ap2_export === 'boolean') {
    ap2Export = inline.ap2_export;
  } else {
    todo.push('ap2_export');
    ap2Export = false; // conservative default: never claim export capability without a source
    tags.push('TODO_AP2_EXPORT_REVIEW');
  }

  const inputSchema = inline?.mcp_tool_definition?.inputSchema || { type: 'object' };
  const mcpDescription = inline?.mcp_tool_definition?.description || node.description;

  const manifest = {
    tool_id: toolId,
    version: node.tool_version || '1.0.0',
    title: node.display_name || inline?.title || toolId,
    description: node.description || inline?.description || '',
    category,
    tags,
    input_schema: inputSchema,
    mcp_tool_definition: {
      name: node.mcp_name,
      description: mcpDescription,
      inputSchema,
    },
    execution: {
      type: 'browser-javascript',
      entry: relativeEntry(node.url),
      function_name: functionName,
      timeout_ms: inline?.execution?.timeout_ms || 5000,
    },
    ap2_export: ap2Export,
  };

  if (outputSample !== null) {
    manifest.output_schema = deriveSchema(outputSample);
  }

  const remainingTodo = todo.filter((t) => t !== 'category');
  const fieldNote = `${remainingTodo.length ? remainingTodo.join(', ') + ' are TODO markers, no source found; ' : ''}category sourced from ${categorySource || 'no source (TODO_CATEGORY_REVIEW)'}`;
  manifest.source = outputSample !== null
    ? `generated draft — scripts/generate-node-manifest.mjs (MFSTGEN-1/NODECAT-WIRE-1, derivation tier ${tier}); ${fieldNote}; output_schema is best-effort single-sample typing — review before treating as authoritative`
    : `generated draft — scripts/generate-node-manifest.mjs (MFSTGEN-1/NODECAT-WIRE-1, derivation tier 3); output_schema OMITTED — no compute_proof yet (async proving pending); ${fieldNote}`;

  return { manifest, tier, todo };
}

// ---- main ----
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const chaingraph = JSON.parse(readFileSync(CHAINGRAPH_JSON, 'utf8'));
const liveNodes = chaingraph.nodes.filter((n) => n.mcp_name);
const haveManifest = new Set(
  readdirSync(MANIFESTS_DIR).filter((f) => f.endsWith('.manifest.json')).map((f) => f.replace(/\.manifest\.json$/, ''))
);
const inScope = liveNodes.filter((n) => !haveManifest.has(n.tool_id));

function reportTierCounts(nodes) {
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const n of nodes) counts[deriveTier(n, n.tool_id)]++;
  return counts;
}

if (flag('--all') && flag('--check')) {
  const tierCounts = reportTierCounts(inScope);
  const todoTotals = {};
  let schemaFail = 0;
  for (const node of inScope) {
    const { manifest, todo } = draftManifest(node);
    for (const t of todo) todoTotals[t] = (todoTotals[t] || 0) + 1;
    const errs = [];
    validate(schema, manifest, schema, '', errs);
    if (errs.length) {
      schemaFail++;
      if (schemaFail <= 5) console.error(`  ✗ ${node.tool_id}: ${errs[0]}`);
    }
  }
  console.log(`live nodes with mcp_name: ${liveNodes.length}`);
  console.log(`in-scope (no manifest yet): ${inScope.length}`);
  console.log(`tiers — 1 (fixture): ${tierCounts[1]} · 2 (proof-output): ${tierCounts[2]} · 3 (no proof): ${tierCounts[3]}`);
  console.log('TODO marker counts (fields with no source, drafted as explicit markers):');
  for (const [k, v] of Object.entries(todoTotals)) console.log(`  ${k}: ${v}`);
  console.log(`schema-invalid drafts: ${schemaFail} / ${inScope.length}`);
  process.exit(schemaFail ? 1 : 0);
}

const outDir = resolve(REPO, opt('--out', 'manifests'));

if (flag('--tool-id')) {
  const toolId = opt('--tool-id', null);
  const node = liveNodes.find((n) => n.tool_id === toolId);
  if (!node) { console.error(`✗ no live node with tool_id ${toolId}`); process.exit(1); }
  const { manifest, tier, todo } = draftManifest(node);
  const path = resolve(outDir, `${toolId}.manifest.json`);
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`✓ wrote ${path} (tier ${tier}, TODOs: ${todo.length ? todo.join(', ') : 'none'})`);
  process.exit(0);
}

if (flag('--sample')) {
  const n = Number(opt('--sample', '5'));
  const byTier = { 1: [], 2: [], 3: [] };
  for (const node of inScope) byTier[deriveTier(node, node.tool_id)].push(node);
  const picked = [];
  const tiers = [1, 2, 3];
  let i = 0;
  while (picked.length < n && picked.length < inScope.length) {
    const t = tiers[i % tiers.length];
    if (byTier[t].length) picked.push(byTier[t].shift());
    i++;
    if (tiers.every((tt) => byTier[tt].length === 0)) break;
  }
  for (const node of picked) {
    const { manifest, tier, todo } = draftManifest(node);
    const path = resolve(outDir, `${node.tool_id}.manifest.json`);
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`✓ wrote ${path} (tier ${tier}, TODOs: ${todo.length ? todo.join(', ') : 'none'})`);
  }
  process.exit(0);
}

console.error('usage: generate-node-manifest.mjs --all --check | --tool-id <id> [--out DIR] | --sample N [--out DIR]');
process.exit(1);
