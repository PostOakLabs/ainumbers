// check-manifest-parity.mjs — two checks in one pass over the ChainGraph node pages:
//
// (1) BLOCKING (unchanged): a node's HTML inline MANIFEST.mcp_tool_definition.name must equal
//     the node's mcp_name in chaingraph.json. The HTML MANIFEST name is the registration key
//     the page advertises; if it disagrees with the canonical chaingraph.json mcp_name, agents
//     see two different tool names for one node (art-22 shipped with a stale
//     'compare_agentic_payment_protocols' vs the real 'compare_agentic_rail_protocols', found
//     by hand on 2026-06-25). This catches that drift deterministically before deploy.
//
// (2) ADVISORY (PAGE-MANIFEST-PARITY-GATE-1): for the same pages, the inline MANIFEST's
//     example_execution_hash and its output-schema property keys (including `warnings`) must
//     match the node's manifest file manifests/<tool_id>.manifest.json. The estate drifted
//     here before: page 836 advertised example_execution_hash fad67219... while its manifest
//     file carries 507fadc0..., and the inline output schema lacked the `warnings` key, with
//     no gate covering either. Every mismatch in this class is REPORTED and recorded by
//     --write-baseline, but never blocks: the advisory class always exits 0. The baseline is
//     never read back by this script; a later row may add an enforcing mode over it.
//
// Self-test: scripts/check-manifest-parity.selftest.mjs (RED/GREEN controls, GATE-SELFTEST-META-1).

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// Matches both the JSON-quoted form ("mcp_tool_definition":{..."name":"x"}) and the older
// JS-literal form (mcp_tool_definition:{name:'x'}) — quoted/unquoted keys, single/double quotes.
const NAME_RE = /["']?mcp_tool_definition["']?\s*:\s*\{[^}]*?["']?name["']?\s*:\s*["']([^"']+)["']/;

// The inline MANIFEST data literal every node page ships: `const MANIFEST = { ... };`.
const MANIFEST_RE = /(?:const|let|var)\s+MANIFEST\s*=\s*\{/;

/**
 * Extract the inline MANIFEST object from page source. String-aware balanced-brace scan
 * (handles quoted strings with escapes and template literals), then evaluates the literal.
 * Returns the object, or null when the literal is absent, unterminated, or not an object.
 */
export function extractInlineManifest(src) {
  const m = src.match(MANIFEST_RE);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0, inStr = null, end = -1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) return null;
  let obj;
  try { obj = new Function('return (' + src.slice(start, end) + ')')(); } catch { return null; }
  return obj && typeof obj === 'object' ? obj : null;
}

const propKeys = (schema) =>
  (schema && typeof schema === 'object' && schema.properties && typeof schema.properties === 'object')
    ? Object.keys(schema.properties).sort() : null;

/**
 * Pure comparison of one page's inline MANIFEST against its manifest file.
 * Returns { hash, missing, extra }:
 *   hash    { inline, file } when the two example_execution_hash values differ (a side that
 *           does not declare the field is recorded as null), else null.
 *   missing output-schema property keys present in the file but absent inline (sorted).
 *   extra   output-schema property keys present inline but absent in the file (sorted).
 * A field absent on BOTH sides never produces an entry.
 */
export function compareManifest(inline, file) {
  const out = { hash: null, missing: [], extra: [] };
  const ih = inline ? inline.example_execution_hash : undefined;
  const fh = file ? file.example_execution_hash : undefined;
  if (ih !== undefined || fh !== undefined) {
    if (ih !== fh) out.hash = { inline: ih === undefined ? null : ih, file: fh === undefined ? null : fh };
  }
  const ik = propKeys(inline ? inline.output_schema : null);
  const fk = propKeys(file ? file.output_schema : null);
  if (ik || fk) {
    const iset = new Set(ik || []);
    const fset = new Set(fk || []);
    out.missing = (fk || []).filter((k) => !iset.has(k));
    out.extra = (ik || []).filter((k) => !fset.has(k));
  }
  return out;
}

/**
 * Baseline document for a future enforcing stage: the estate's advisory mismatch rows only.
 * Written ONLY by --write-baseline; this script never reads it back. No timestamps, so the
 * file is byte-stable across runs on an unchanged estate.
 */
export function buildBaseline(rows) {
  const pages = {};
  let hashCount = 0, keyPages = 0;
  for (const r of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    pages[r.id] = { hash: r.hash, schema_keys: { missing: r.missing, extra: r.extra } };
    if (r.hash) hashCount++;
    if (r.missing.length || r.extra.length) keyPages++;
  }
  return {
    gate: 'check-manifest-parity.mjs advisory (inline example_execution_hash + output-schema keys vs manifests/<tool_id>.manifest.json)',
    advisory: true,
    baseline_never_read_back: true,
    totals: { pages_with_mismatches: rows.length, hash_mismatches: hashCount, schema_key_pages: keyPages },
    pages,
  };
}

function parseArgs(argv) {
  const a = { root: resolve(HERE, '..'), baseline: null, json: null };
  const need = (i) => { if (argv[i] === undefined) { console.error('usage: missing value for a flag'); process.exit(2); } return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') a.root = resolve(need(++i));
    else if (argv[i] === '--write-baseline') a.baseline = need(++i);
    else if (argv[i] === '--json') a.json = need(++i);
    else { console.error('usage: check-manifest-parity.mjs [--root <dir>] [--write-baseline <file>] [--json <file>] (unknown arg ' + argv[i] + ')'); process.exit(2); }
  }
  return a;
}

const shortHash = (h) => (typeof h === 'string' ? h.slice(0, 16) + '...' : String(h));
const shortList = (ks) => ks.length <= 8 ? ks.join(', ') : ks.slice(0, 8).join(', ') + ' +' + (ks.length - 8) + ' more';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const CG = resolve(args.root, 'chaingraph');
  const cg = JSON.parse(readFileSync(resolve(CG, 'chaingraph.json'), 'utf8'));

  const fails = [];
  const advRows = [];
  let checked = 0, noHtml = 0, noManifest = 0;
  let noInline = 0, noFile = 0, badFile = 0, advClean = 0;

  for (const n of cg.nodes ?? []) {
    if (!n.mcp_name) continue;
    const html = resolve(CG, n.tool_id + '.html');
    if (!existsSync(html)) { noHtml++; continue; }
    const src = readFileSync(html, 'utf8');
    const m = src.match(NAME_RE);
    if (!m) { noManifest++; continue; }
    checked++;
    if (m[1] !== n.mcp_name)
      fails.push(`${n.tool_id}: HTML MANIFEST name "${m[1]}" != chaingraph.json mcp_name "${n.mcp_name}"`);

    // Advisory class (PAGE-MANIFEST-PARITY-GATE-1): inline vs manifest file. Report-only.
    const inline = extractInlineManifest(src);
    if (!inline) { noInline++; continue; }
    const mfPath = resolve(args.root, 'manifests', n.tool_id + '.manifest.json');
    if (!existsSync(mfPath)) { noFile++; continue; }
    let file = null;
    try { file = JSON.parse(readFileSync(mfPath, 'utf8')); } catch { badFile++; continue; }
    const d = compareManifest(inline, file);
    if (d.hash || d.missing.length || d.extra.length)
      advRows.push({ id: n.tool_id, hash: d.hash, missing: d.missing, extra: d.extra });
    else advClean++;
  }

  // Advisory report first (so it is visible even when the blocking check below exits 1).
  advRows.sort((a, b) => a.id.localeCompare(b.id));
  for (const r of advRows) {
    const parts = [];
    if (r.hash) parts.push(`hash inline=${shortHash(r.hash.inline)} file=${shortHash(r.hash.file)}`);
    if (r.missing.length) parts.push(`schema-keys missing ${r.missing.length} (${shortList(r.missing)})`);
    if (r.extra.length) parts.push(`schema-keys extra ${r.extra.length} (${shortList(r.extra)})`);
    console.log(`  ADVISORY ${r.id}  ${parts.join('; ')}`);
  }
  console.log(`manifest-parity advisory (PAGE-MANIFEST-PARITY-GATE-1, report-only): ${advRows.length} page(s) with mismatches of ${checked} checked (hash: ${advRows.filter((r) => r.hash).length}, schema-key pages: ${advRows.filter((r) => r.missing.length || r.extra.length).length}; skipped: ${noInline} no-inline-MANIFEST, ${noFile} no-manifest-file, ${badFile} unreadable-manifest, ${advClean} clean). Advisory mismatches never block and never change the exit code.`);

  if (args.json) {
    mkdirSync(dirname(resolve(args.json)), { recursive: true });
    writeFileSync(args.json, JSON.stringify({ advisory: true, totals: { checked, pages_with_mismatches: advRows.length }, rows: advRows }, null, 2) + '\n');
  }
  if (args.baseline) {
    mkdirSync(dirname(resolve(args.baseline)), { recursive: true });
    writeFileSync(args.baseline, JSON.stringify(buildBaseline(advRows), null, 2) + '\n');
  }

  if (fails.length) {
    console.error(`✗ manifest-parity FAILED (${fails.length}) — HTML MANIFEST name drifted from chaingraph.json mcp_name:`);
    for (const f of fails) console.error('  • ' + f);
    console.error('\nMake the node HTML\'s MANIFEST.mcp_tool_definition.name EXACTLY equal the chaingraph.json mcp_name.');
    process.exit(1);
  }
  console.log(`✓ manifest-parity clean — ${checked} node HTML MANIFEST names match chaingraph.json mcp_name (${noHtml} no-HTML, ${noManifest} no-MANIFEST skipped).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
