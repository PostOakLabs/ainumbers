#!/usr/bin/env node
/**
 * scripts/gen-webmcp-snippets.mjs — WEBMCP-DIRECTORY-LISTING-1
 *
 * Emits a WebMCP `registerTool` registration block for one page FROM the
 * page's existing manifest (mcp_tool_definition), in the exact shape landed
 * by WEBMCP-KERNELTOOLS-PILOT-1 (the template golden):
 *
 *   - feature-detect wrapper: `document.modelContext` preferred,
 *     `'modelContext' in navigator` fallback; absent API registers nothing;
 *   - registerTool called at TOP LEVEL on page load (api-empty trap);
 *   - name / description / inputSchema reused VERBATIM from the manifest
 *     (the generator computes nothing and restates no computed value);
 *   - annotations: { readOnlyHint: true, untrustedContentHint: true };
 *   - execute() delegates to the page's EXISTING kernel compute by mapping
 *     params onto the page's own form element ids, then calling the
 *     manifest-declared execution.function_name and returning _lastResult
 *     (the byte-for-byte delegate pattern proven by the pilot's EXECUTE
 *     control). Zero network I/O, zero kernel bytes (hash-neutral);
 *   - errors return structured text, never raw exceptions.
 *
 * Guard rails (all hard failures — the generator never guesses):
 *   G1 manifest shape: snake_case name, description >= 8 words, typed
 *      inputSchema properties;
 *   G2 page mapping: every inputSchema property must match a form element
 *      id on the page (`id="<prop>"`) — a property with no element is a
 *      personalization-attraction vector (W3C §6.3.3) and is refused;
 *   G3 the page declares `function <execution.function_name>` and a
 *      `_lastResult` global;
 *   G4 OWNERSHIP: a page that already contains `registerTool` is never
 *      rewritten (the pilot's page is pilot-row-owned);
 *   G5 the manifest's execution.entry must be the page being written.
 *
 * Usage:
 *   node scripts/gen-webmcp-snippets.mjs --manifest <m.json> --page <p.html>
 *       verify mapping and print the block to stdout (no file is written)
 *   node scripts/gen-webmcp-snippets.mjs --manifest <m.json> --out <p.html>
 *       verify and insert the block before </body> in <p.html>
 *   node scripts/gen-webmcp-snippets.mjs --self-test
 */
import { readFileSync, writeFileSync } from 'node:fs';

function findMatchingBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function fail(msg) {
  console.error('GEN-ERROR: ' + msg);
  process.exit(1);
}

function loadManifest(path) {
  let m;
  try {
    m = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`manifest ${path} is not valid JSON: ${e.message}`);
  }
  const def = m.mcp_tool_definition;
  if (!def || typeof def.name !== 'string') fail(`${path}: missing mcp_tool_definition.name`);
  if (!/^[a-z][a-z0-9_]*$/.test(def.name)) fail(`${path}: mcp_tool_definition.name '${def.name}' is not snake_case`);
  const words = (def.description || '').trim().split(/\s+/).filter(Boolean).length;
  if (words < 8) fail(`${path}: mcp_tool_definition.description has ${words} words, need >= 8`);
  const props = def.inputSchema && def.inputSchema.properties ? def.inputSchema.properties : null;
  if (!props || typeof props !== 'object') fail(`${path}: mcp_tool_definition.inputSchema.properties missing`);
  for (const [k, v] of Object.entries(props)) {
    if (!v || typeof v.type !== 'string') fail(`${path}: inputSchema property '${k}' has no type`);
  }
  if (!m.execution || typeof m.execution.function_name !== 'string') fail(`${path}: missing execution.function_name`);
  return m;
}

// G2/G3: every schema property must map to a page element; the page must
// declare the compute function and the _lastResult global. Throws Error —
// the CLI path turns that into a GEN-ERROR exit, the self-test catches it.
function verifyPageMapping(manifest, pageSrc, pageLabel) {
  const props = Object.keys(manifest.mcp_tool_definition.inputSchema.properties);
  const missing = props.filter((p) => !new RegExp(`id=["']${p}["']`).test(pageSrc));
  if (missing.length > 0) {
    throw new Error(`${pageLabel}: inputSchema properties with no matching element id: ${missing.join(', ')}`);
  }
  const fn = manifest.execution.function_name;
  if (!new RegExp(`function\\s+${fn}\\s*\\(`).test(pageSrc)) {
    throw new Error(`${pageLabel}: no 'function ${fn}(' found — execution.function_name does not exist on the page`);
  }
  if (!/_lastResult\s*=/.test(pageSrc)) {
    throw new Error(`${pageLabel}: no _lastResult global found — the delegate return shape cannot be verified`);
  }
}

function emitValueExpr(propName, type, optional) {
  const read = `params.${propName}`;
  if (type === 'boolean') {
    const expr = `document.getElementById('${propName}').checked = ${read} === true`;
    return optional ? `if (${read} !== undefined) ${expr}` : expr;
  }
  if (type === 'array' || type === 'object') {
    const expr = `document.getElementById('${propName}').value = JSON.stringify(${read})`;
    return optional ? `if (${read} !== undefined) ${expr}` : expr;
  }
  const expr = `document.getElementById('${propName}').value = String(${read})`;
  return optional ? `if (${read} !== undefined) ${expr}` : expr;
}

function buildSnippet(manifest, manifestPath) {
  const def = manifest.mcp_tool_definition;
  const props = def.inputSchema.properties;
  const required = Array.isArray(def.inputSchema.required) ? def.inputSchema.required : [];
  const fn = manifest.execution.function_name;
  const q = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const lines = [];
  lines.push('<script>');
  lines.push(`// WebMCP registration emitted by scripts/gen-webmcp-snippets.mjs from`);
  lines.push(`// ${manifestPath} (mcp_tool_definition reused verbatim; the generator`);
  lines.push(`// computes nothing and restates no computed value — kernel bytes are`);
  lines.push(`// untouched, hash-neutral). Feature-detected: absent API registers`);
  lines.push(`// nothing. Answer-class delegate to the page's existing kernel compute;`);
  lines.push(`// zero network I/O; errors return structured text, never raw exceptions.`);
  lines.push(`const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);`);
  lines.push(`if (mc) {`);
  lines.push(`  mc.registerTool({`);
  lines.push(`    name: '${q(def.name)}',`);
  lines.push(`    description: '${q(def.description)}',`);
  lines.push(`    inputSchema: ${JSON.stringify(def.inputSchema, null, 2).replace(/\n/g, '\n    ')},`);
  lines.push(`    annotations: { readOnlyHint: true, untrustedContentHint: true },`);
  lines.push(`    execute: function(params) {`);
  lines.push(`      try {`);
  for (const [name, spec] of Object.entries(props)) {
    const optional = !required.includes(name);
    lines.push(`      ${emitValueExpr(name, spec.type, optional)}`);
  }
  lines.push(`        ${fn}();`);
  lines.push(`        return _lastResult;`);
  lines.push(`      } catch (err) {`);
  lines.push(`        return { error: 'compute_failed', detail: String((err && err.message) || err) };`);
  lines.push(`      }`);
  lines.push(`    }`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(`</script>`);
  return lines.join('\n');
}

function selfTest() {
  let failures = 0;
  const check = (label, ok) => {
    console.log((ok ? '  ✓ ' : '  ✗ ') + label);
    if (!ok) failures++;
  };

  // 1. Happy path: schema properties map to elements; block is emitted.
  const manifest = {
    tool_id: 'self-test-tool',
    mcp_tool_definition: {
      name: 'run_self_test_compute',
      description: 'Self-test delegate that exercises the generator verification path end to end.',
      inputSchema: {
        type: 'object',
        required: ['amountA'],
        properties: {
          amountA: { type: 'number', description: 'Required numeric input' },
          labelB: { type: 'string', description: 'Optional text input' },
          flagC: { type: 'boolean', description: 'Optional boolean toggle' },
          rowsD: { type: 'array', description: 'Optional array input' }
        }
      }
    },
    execution: { type: 'browser-javascript', entry: 'self-test.html', function_name: 'runSelfTest', timeout_ms: 3000 }
  };
  const page = '<html><body><input id="amountA"><input id="labelB"><input id="flagC"><input id="rowsD"><script>function runSelfTest(){ _lastResult = {}; } var _lastResult = null;</script></body></html>';
  let snippet = null;
  try {
    verifyPageMapping(manifest, page, 'self-test page');
    snippet = buildSnippet(manifest, 'self-test.manifest.json');
  } catch (e) {
    check('happy path emits a block (unexpected throw: ' + e.message + ')', false);
  }
  check('happy path emits a block', snippet !== null);
  check('emitted block feature-detects before registering', snippet !== null && snippet.indexOf('modelContext') < snippet.indexOf('registerTool'));
  check('emitted block maps every schema property', snippet !== null && ['amountA', 'labelB', 'flagC', 'rowsD'].every((p) => snippet.includes(`getElementById('${p}')`)));
  check('emitted block delegates to the manifest function', snippet !== null && snippet.includes('runSelfTest();'));
  check('emitted block returns _lastResult', snippet !== null && snippet.includes('return _lastResult;'));
  check('emitted block carries both annotations', snippet !== null && snippet.includes('readOnlyHint: true') && snippet.includes('untrustedContentHint: true'));
  check('emitted block returns structured errors', snippet !== null && snippet.includes("error: 'compute_failed'"));

  // 2. G2: a schema property with no page element is refused.
  let refusedMapping = false;
  try {
    const badPage = page.replace('<input id="rowsD">', '');
    verifyPageMapping(manifest, badPage, 'self-test page');
  } catch (e) {
    refusedMapping = String(e.message || e).indexOf('rowsD') !== -1;
  }
  check('G2 fires: unmapped schema property refused (rowsD)', refusedMapping);

  // 3. G3: missing compute function is refused.
  let refusedFn = false;
  try {
    verifyPageMapping(manifest, page.replace('function runSelfTest(', 'function otherName('), 'self-test page');
  } catch (e) {
    refusedFn = true;
  }
  check('G3 fires: missing compute function refused', refusedFn);

  // 4. G4: ownership guard (checked by the caller path on real pages).
  const ownedPage = page + '<script>mc.registerTool({});</script>';
  check('G4 guard predicate detects an existing registerTool', /\.registerTool\s*\(/.test(ownedPage));

  console.log(failures === 0 ? 'GEN SELF-TEST: PASS' : 'GEN SELF-TEST: FAIL');
  process.exit(failures === 0 ? 0 : 1);
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selfTest();
} else {
  const mIdx = args.indexOf('--manifest');
  const outIdx = args.indexOf('--out');
  const pageIdx = args.indexOf('--page');
  if (mIdx === -1 || (outIdx === -1 && pageIdx === -1)) {
    console.error('Usage: node scripts/gen-webmcp-snippets.mjs --manifest <m.json> (--page <p.html> | --out <p.html>) | --self-test');
    process.exit(1);
  }
  const manifestPath = args[mIdx + 1];
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
  const pagePath = outPath !== null ? outPath : args[pageIdx + 1];

  const manifest = loadManifest(manifestPath);

  // G5: the manifest's declared entry must be the page being emitted into.
  const entryBase = String(manifest.execution.entry || '').split('/').pop();
  const pageBase = pagePath.split(/[/\\]/).pop();
  if (entryBase && entryBase !== pageBase) {
    fail(`manifest execution.entry '${manifest.execution.entry}' does not match page '${pagePath}'`);
  }

  const pageSrc = readFileSync(pagePath, 'utf8');

  // G4: ownership — never rewrite a page that already registers a tool.
  if (/\.registerTool\s*\(/.test(pageSrc)) {
    fail(`${pagePath}: already contains a registerTool call — owned by another row, never rewritten`);
  }

  try {
    verifyPageMapping(manifest, pageSrc, pagePath);
  } catch (e) {
    fail(e.message);
  }

  const snippet = buildSnippet(manifest, manifestPath.split(/[/\\]/).pop());

  if (outPath) {
    if (!pageSrc.includes('</body>')) fail(`${pagePath}: no </body> found`);
    const next = pageSrc.replace('</body>', snippet + '\n\n</body>');
    writeFileSync(outPath, next, 'utf8');
    console.log(`✓ inserted WebMCP registration into ${pagePath}`);
  } else {
    console.log(snippet);
  }
}
