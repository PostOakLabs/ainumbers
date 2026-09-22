#!/usr/bin/env node
/*
 * scripts/check_tools.js — MANDATORY pre-commit / pre-merge gate.
 *
 * Parses every tool's inline JavaScript <script> blocks and fails if any has a
 * syntax error. Skips non-JS blocks (application/ld+json, importmap, src=...).
 * Auto-detects layout: tools/<slug>/index.html (nested) or tools/<name>.html (flat).
 * Also parses every published ROOT page (scripts/published-dirs.json rootPages):
 * the sitemap.html search outage shipped because this gate scanned tools/ only
 * while a doubled `const TOTAL` made sitemap.html's whole script a SyntaxError.
 *
 * Run from the repo root (or anywhere):   node scripts/check_tools.js
 * Exit code 0 = clean, 1 = at least one tool has a JS syntax error (blocks commit).
 *
 * Why this exists: a structural JS edit once deleted live code in dozens of tools
 * and the breakage was invisible until users hit it. This is the gate that catches
 * it. NEVER commit tool HTML without a green run. See CONTRACT (MCP/manifest +
 * QA-gate clause).
 *
 * --changed <REF> (PREREQ-CHANGED-SCOPING-1, B2 of GATE-MANIFEST-DRAFT.md §1):
 * scope the scan to tools touched vs <REF> instead of every tools/*.html.
 * Undeterminable diff (no git / unresolvable ref) BLOCKS (fail-closed) rather
 * than silently widening to a full scan — see scripts/_changed-files-lib.js.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { resolveChangedScope, isTouched } = require('./_changed-files-lib.js');
const REPO = path.resolve(__dirname, '..');
const toolsDir = path.join(REPO, 'tools');
const JS_TYPES = ['', 'text/javascript', 'application/javascript', 'module', 'text/babel'];

const changedIdx = process.argv.indexOf('--changed');
const changedRef = changedIdx !== -1 ? process.argv[changedIdx + 1] : null;
const changed = resolveChangedScope(changedRef, { gate: 'check_tools.js (B2)', failClosed: true });

function listTools() {
  const ents = fs.readdirSync(toolsDir, { withFileTypes: true });
  const nested = ents.filter(e => e.isDirectory() && fs.existsSync(path.join(toolsDir, e.name, 'index.html')))
    .map(e => [e.name, path.join(toolsDir, e.name, 'index.html')]);
  const flat = ents.filter(e => e.isFile() && e.name.endsWith('.html'))
    .map(e => [e.name, path.join(toolsDir, e.name)]);
  let all = nested.concat(flat).sort((a, b) => a[0].localeCompare(b[0]));
  if (changed) all = all.filter(([, p]) => isTouched(path.relative(REPO, p), changed));
  return all;
}

// ROOT-PAGES-SCOPE (sitemap-drift guard): the sitemap.html search outage shipped
// because the JS-syntax gate scanned tools/ only — a doubled `const TOTAL` in
// sitemap.html's inline script was a SyntaxError that killed the whole page
// script in production while every gate stayed green. Root published pages get
// the same parse here. The list comes from scripts/published-dirs.json
// (the shared manifest regen-sitemap.mjs and verify_repo.py already read), so
// scope cannot drift from the rest of the estate by hand-editing one place.
function listRootPages() {
  const pub = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts', 'published-dirs.json'), 'utf8'));
  let all = pub.rootPages.map(r => [r.path, path.join(REPO, r.path)]);
  if (changed) all = all.filter(([, p]) => isTouched(path.relative(REPO, p), changed));
  return all;
}

function scanInlineScripts(name, p) {
  const html = fs.readFileSync(p, 'utf8');
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, failed = null, idx = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '', body = m[2];
    idx++;
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const tm = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    if (!JS_TYPES.includes(tm ? tm[1].toLowerCase() : '')) continue;
    if (!body.trim()) continue;
    try { new vm.Script(body, { filename: `${name}#${idx}` }); }
    catch (e) { if (!failed) failed = `script#${idx}: ${String(e.message).split('\n')[0]}`; }
  }
  return failed;
}

let bad = 0, total = 0;
for (const [name, p] of listTools()) {
  total++;
  const failed = scanInlineScripts(name, p);
  if (failed) { bad++; console.log('FAIL  ' + name + '  ::  ' + failed); }
}
let rootBad = 0, rootTotal = 0;
for (const [name, p] of listRootPages()) {
  if (!fs.existsSync(p)) continue; // published-dirs entries are hand-maintained; a deleted page is verify_repo's finding, not this gate's
  rootTotal++;
  const failed = scanInlineScripts(name, p);
  if (failed) { rootBad++; console.log('FAIL  ' + name + ' (root page)  ::  ' + failed); }
}
console.log(`\n${bad} of ${total} tool(s)${changed ? ' (touched-scope)' : ''} have a real JS syntax error.`);
console.log(`${rootBad} of ${rootTotal} root page(s)${changed ? ' (touched-scope)' : ''} have a real JS syntax error.`);
process.exit(bad || rootBad ? 1 : 0);
