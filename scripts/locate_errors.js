#!/usr/bin/env node
/*
 * scripts/locate_errors.js — companion to check_tools.js (diagnostic).
 * For every tool with a JS syntax error, prints the file line + surrounding
 * source so the break can be fixed precisely. Auto-detects tools/ layout.
 *
 * Run:  node scripts/locate_errors.js
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

for (const [name, p] of listTools()) {
  const html = fs.readFileSync(p, 'utf8');
  const lines = html.split('\n');
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '', body = m[2];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const tm = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    if (!JS_TYPES.includes(tm ? tm[1].toLowerCase() : '')) continue;
    if (!body.trim()) continue;
    try { new vm.Script(body); }
    catch (e) {
      const bodyStart = m.index + m[0].indexOf('>') + 1;
      const baseLine = html.slice(0, bodyStart).split('\n').length;
      const rel = (String(e.stack || '').split('\n')[0].match(/:(\d+)\s*$/) || [])[1];
      const abs = rel ? baseLine + parseInt(rel, 10) - 1 : 0;
      console.log(`\n${name}`);
      console.log(`  ${e.message.split('\n')[0]}  @ ~line ${abs}`);
      for (let i = Math.max(1, abs - 3); i <= Math.min(lines.length, abs + 1); i++) {
        console.log(`  ${i === abs ? '>>' : '  '} ${i}: ${lines[i - 1]}`);
      }
      break;
    }
  }
}
