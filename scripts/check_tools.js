#!/usr/bin/env node
/*
 * scripts/check_tools.js — MANDATORY pre-commit / pre-merge gate.
 *
 * Parses every tool's inline JavaScript <script> blocks and fails if any has a
 * syntax error. Skips non-JS blocks (application/ld+json, importmap, src=...).
 * Auto-detects layout: tools/<slug>/index.html (nested) or tools/<name>.html (flat).
 *
 * Run from the repo root (or anywhere):   node scripts/check_tools.js
 * Exit code 0 = clean, 1 = at least one tool has a JS syntax error (blocks commit).
 *
 * Why this exists: a structural JS edit once deleted live code in dozens of tools
 * and the breakage was invisible until users hit it. This is the gate that catches
 * it. NEVER commit tool HTML without a green run. See CONTRACT (MCP/manifest +
 * QA-gate clause).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const toolsDir = path.join(path.resolve(__dirname, '..'), 'tools');
const JS_TYPES = ['', 'text/javascript', 'application/javascript', 'module', 'text/babel'];

function listTools() {
  const ents = fs.readdirSync(toolsDir, { withFileTypes: true });
  const nested = ents.filter(e => e.isDirectory() && fs.existsSync(path.join(toolsDir, e.name, 'index.html')))
    .map(e => [e.name, path.join(toolsDir, e.name, 'index.html')]);
  const flat = ents.filter(e => e.isFile() && e.name.endsWith('.html'))
    .map(e => [e.name, path.join(toolsDir, e.name)]);
  return nested.concat(flat).sort((a, b) => a[0].localeCompare(b[0]));
}

let bad = 0, total = 0;
for (const [name, p] of listTools()) {
  total++;
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
  if (failed) { bad++; console.log('FAIL  ' + name + '  ::  ' + failed); }
}
console.log(`\n${bad} of ${total} tools have a real JS syntax error.`);
process.exit(bad ? 1 : 0);
