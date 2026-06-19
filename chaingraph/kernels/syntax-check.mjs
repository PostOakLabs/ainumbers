// syntax-check.mjs — parse every inline <script> in the edited tool HTML and
// report any SyntaxError. This is the check the Node hash-gates DON'T do: it
// confirms the agent edits (comma fixes, async refactors, helper injection)
// didn't break JavaScript parsing in any tool. Uses new Function() which PARSES
// without executing, so it catches SyntaxError only (ReferenceErrors from DOM
// access do not fire — exactly what we want).
//
// Run:  node repo/chaingraph/kernels/syntax-check.mjs
// Exit non-zero if any script fails to parse.
//
// Zero dependencies. Scans the dirs we edited: chaingraph/, chaingraph/chains/,
// and tools/ (5xx Canton + 311). Classic inline scripts only; JSON-LD, module,
// and external (src=) scripts are skipped.
//
// Uses node:vm `new vm.Script(code)` which PARSES with classic-<script> (Program)
// semantics — exactly how a browser parses an inline classic script — and throws
// on a real SyntaxError without executing. (An earlier version used `new Function`,
// which parses as a FUNCTION BODY, not a script, and produced false positives on
// tools with large top-level blocks.)

import vm from 'node:vm';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

function htmlFiles() {
  const out = [];
  const add = (dir, filter) => {
    const abs = resolve(REPO, dir);
    if (!existsSync(abs)) return;
    for (const f of readdirSync(abs)) {
      if (f.endsWith('.html') && (!filter || filter(f))) out.push(resolve(abs, f));
    }
  };
  add('chaingraph');                 // all ChainGraph node tools + pages
  add('chaingraph/chains');          // chain viewers (agentic-policy etc.)
  add('tools');                      // ALL catalog tools (full-suite syntax coverage)
  add('guides');                     // composers + guide hubs
  return out;
}

// Extract classic inline <script> bodies. Skip src=, type=module, JSON-LD, importmap.
function inlineScripts(html) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const body = m[2] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    if (type && !['text/javascript', 'application/javascript', 'module'].includes(type)) continue; // skip ld+json, importmap, etc.
    if (type === 'module') continue; // new Function can't represent a module; modules are not used by these tools
    if (!body.trim()) continue;
    scripts.push(body);
  }
  return scripts;
}

let failed = 0, filesChecked = 0, scriptsChecked = 0;
for (const file of htmlFiles()) {
  const html = readFileSync(file, 'utf8');
  const scripts = inlineScripts(html);
  filesChecked++;
  let fileBad = false;
  scripts.forEach((code, i) => {
    scriptsChecked++;
    try {
      new vm.Script(code, { filename: relative(REPO, file) + `#script${i + 1}` }); // parse-only (compile); throws SyntaxError on bad JS
    } catch (e) {
      if (e instanceof SyntaxError) {
        if (!fileBad) { console.error(`\n✗ ${relative(REPO, file)}`); fileBad = true; }
        console.error(`    script #${i + 1}: ${e.message}`);
        failed++;
      }
      // non-SyntaxError (shouldn't happen for parse-only) is ignored
    }
  });
}

console.log(`\nChecked ${scriptsChecked} inline scripts across ${filesChecked} files.`);
if (failed === 0) { console.log('✓ no JavaScript syntax errors in any edited tool.'); process.exit(0); }
console.error(`✗ ${failed} script(s) failed to parse — fix before pushing.`);
process.exit(1);
