#!/usr/bin/env node
/**
 * scripts/check-webmcp-snippet.mjs — WEBMCP-DIRECTORY-LISTING-1
 *
 * RED-first lint for a WebMCP `registerTool` registration block (the pattern
 * landed by WEBMCP-KERNELTOOLS-PILOT-1 and WEBMCP-DOCCONTEXT-COMPAT-1, PR
 * #1546). Checks the SOURCE TEXT of a page (or an inline snippet via
 * --self-test) against the security rails named in
 * board/queued/WEBMCP-DIRECTORY-LISTING-1.md:
 *
 *   1. feature-detect present (`document.modelContext` with a
 *      `'modelContext' in navigator` fallback) gating every new byte.
 *   2. registerTool called at TOP LEVEL — not inside an addEventListener
 *      callback (the scanner's `api-empty` trap: "if tools only appear
 *      after a user action... expose the discovery surface on page load").
 *   3. tool name is snake_case.
 *   4. description is >= 8 words (a real capability statement, not a stub).
 *   5. NO network call inside execute() — no fetch/XHR/WebSocket/
 *      EventSource/sendBeacon/dynamic import.
 *   6. at least one registerTool call; EVERY call is checked individually
 *      (LEDGER-WEBMCP-1: a hand-authored page may register several tools in
 *      one block — the ledger page registers three — so rule 6 was widened
 *      from "exactly 1" to "1..n, each fully linted"; rule 6 never allowed
 *      zero calls and still does not).
 *   7. schema-minimality (W3C §6.3.3 anti-profiling control) — every
 *      inputSchema property must be read inside execute().
 *   8. annotations carry readOnlyHint:true, and untrustedContentHint is either
 *      true (UGC answer class) or omitted WITH an n/a rationale comment
 *      (truthful-hint posture, WEBMCP-AUDIT-DRYRUN-1 #1616).
 *
 * WEBMCP-DOCCONTEXT-REGEN-1 adds a second, estate-wide mode:
 *
 *   --api-surface   sweep tools/, guides/, chaingraph/ (all .html), index.html
 *                   and ledger/ for BARE `navigator.modelContext` API usage.
 *                   The WebMCP spec draft of 2026-07-21 moved the getter to
 *                   `document.modelContext` and Chrome 150 deprecates the
 *                   `navigator` alias, so the ONLY sanctioned occurrence of the
 *                   alias in live script is the feature-detect fallback arm the
 *                   generator emits:
 *                       document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null)
 *                   Anything else (a direct registration, property read or call
 *                   on the alias, a guard-less `document.modelContext ??
 *                   navigator.modelContext`) is red. Occurrences in comments and
 *                   string literals are prose naming the API, not API usage, and
 *                   are blanked before matching; displayed teaching snippets in
 *                   <code>/<pre> blocks sit outside <script> and are out of
 *                   scope by construction. Scan is over inline <script> bodies
 *                   only (a `src=`-loaded script is external and already barred
 *                   by the egress gate).
 *
 * Usage:
 *   node scripts/check-webmcp-snippet.mjs <file.html> [<file.html> ...]
 *   node scripts/check-webmcp-snippet.mjs --api-surface   # estate-wide bare-alias sweep (WEBMCP-DOCCONTEXT-REGEN-1)
 *   node scripts/check-webmcp-snippet.mjs --self-test   # prints RED then GREEN fixture, exit 0 if both verdicts are as expected
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';

const NETWORK_PATTERNS = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\s*\(/, /\bEventSource\s*\(/, /navigator\.sendBeacon\s*\(/, /\bimport\s*\(/];

function findMatchingBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Extracts every `mc.registerTool({ ... })` (or `.registerTool({ ... })`) call body as raw text.
function extractRegisterToolCalls(src) {
  const calls = [];
  const re = /\.registerTool\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const openBrace = src.indexOf('{', m.index);
    const closeBrace = findMatchingBrace(src, openBrace);
    if (closeBrace === -1) continue;
    calls.push({ start: m.index, body: src.slice(openBrace, closeBrace + 1) });
  }
  return calls;
}

function extractStringField(body, field) {
  const m = body.match(new RegExp(field + "\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'"));
  return m ? m[1].replace(/\\'/g, "'") : null;
}

function extractExecuteBody(body) {
  const m = body.match(/execute\s*:\s*(async\s+)?function\s*\([^)]*\)\s*\{/);
  if (!m) return null;
  const openBrace = body.indexOf('{', m.index + m[0].length - 1);
  const closeBrace = findMatchingBrace(body, openBrace);
  if (closeBrace === -1) return null;
  return body.slice(openBrace, closeBrace + 1);
}

function extractSchemaProperties(body) {
  const m = body.match(/inputSchema\s*:\s*\{/);
  if (!m) return [];
  const openBrace = body.indexOf('{', m.index);
  const closeBrace = findMatchingBrace(body, openBrace);
  const schema = body.slice(openBrace, closeBrace + 1);
  const propsM = schema.match(/properties\s*:\s*\{/);
  if (!propsM) return [];
  const propsOpen = schema.indexOf('{', propsM.index);
  const propsClose = findMatchingBrace(schema, propsOpen);
  const propsBody = schema.slice(propsOpen + 1, propsClose);
  const keys = [];
  const keyRe = /(^|[,{\s])([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{/g;
  let km;
  while ((km = keyRe.exec(propsBody))) keys.push(km[2]);
  return keys;
}

function checkSnippet(src, label) {
  const issues = [];

  const hasDocModelContext = /document\.modelContext/.test(src);
  const hasNavigatorFallback = /'modelContext'\s+in\s+(window\.)?navigator/.test(src);
  if (!hasDocModelContext || !hasNavigatorFallback) {
    issues.push('missing feature-detect (document.modelContext + navigator fallback)');
  }

  const calls = extractRegisterToolCalls(src);
  if (calls.length === 0) {
    issues.push('no registerTool call found');
    return issues;
  }

  for (let ci = 0; ci < calls.length; ci++) {
    const call = calls[ci];
    const label = calls.length > 1 ? `registerTool #${ci + 1}: ` : '';

    // Rule 2: not event-gated — no addEventListener between the feature-detect
    // guard and the registerTool call.
    const preamble = src.slice(0, call.start);
    const guardIdx = Math.max(preamble.lastIndexOf('if (mc)'), preamble.lastIndexOf('if(mc)'));
    const scanFrom = guardIdx >= 0 ? guardIdx : Math.max(0, call.start - 400);
    const between = src.slice(scanFrom, call.start);
    if (/addEventListener\s*\(/.test(between)) {
      issues.push(label + 'registerTool appears gated behind addEventListener, not called at top level on page load');
    }

    const name = extractStringField(call.body, 'name');
    if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) {
      issues.push(label + `tool name '${name}' is not snake_case`);
    }

    const description = extractStringField(call.body, 'description');
    const wordCount = description ? description.trim().split(/\s+/).filter(Boolean).length : 0;
    if (wordCount < 8) {
      issues.push(label + `description has ${wordCount} words, need >= 8`);
    }

    const execBody = extractExecuteBody(call.body);
    if (!execBody) {
      issues.push(label + 'no execute() function found');
    } else {
      for (const pattern of NETWORK_PATTERNS) {
        if (pattern.test(execBody)) {
          issues.push(label + `execute() contains a network call matching ${pattern}`);
        }
      }
    }

    const schemaProps = extractSchemaProperties(call.body);
    if (execBody) {
      for (const prop of schemaProps) {
        const usedRe = new RegExp(`params(?:\\s*\\.\\s*${prop}\\b|\\s*\\[\\s*['"]${prop}['"]\\s*\\])`);
        if (!usedRe.test(execBody)) {
          issues.push(label + `inputSchema property '${prop}' is never read inside execute() (schema-minimality, W3C §6.3.3)`);
        }
      }
    }

    if (!/readOnlyHint\s*:\s*true/.test(call.body)) issues.push(label + 'annotations missing readOnlyHint:true');
  }
  // Truthful-hint posture (WEBMCP-AUDIT-DRYRUN-1 #1616): a zero-UGC deterministic
  // local tool must NOT claim untrustedContentHint:true. Either it carries the
  // field truthfully for its answer class, or it omits the field AND states the
  // n/a rationale in the block comment. Silent absence of both is red.
  if (!/untrustedContentHint\s*:\s*true/.test(src) && !/untrustedContentHint\s+is\s+not\s+applicable/.test(src)) {
    issues.push('untrustedContentHint: neither a true field nor an n/a rationale comment (truthful-hint posture)');
  }

  return issues;
}

// ── WEBMCP-DOCCONTEXT-REGEN-1: bare navigator.modelContext API-surface sweep ─

// The one sanctioned shape: the generator-emitted feature-detect fallback arm.
// Both quote styles are accepted (the generator emits single quotes; some
// hand-authored history guides show the double-quoted form).
const SANCTIONED_FALLBACK_RE = /\(\s*['"]modelContext['"]\s+in\s+(?:window\.)?navigator\s*\)\s*\?\s*navigator\.modelContext\s*:\s*null/g;
const BARE_ALIAS_SOURCE = 'navigator\\.modelContext';
const INLINE_SCRIPT_RE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

// Blanks string-literal contents and comments so only live code tokens remain:
// NAMING the alias in prose, a comment or a string is not USING it. Position
// and line structure are preserved (newlines kept, other bytes -> space) so
// findings can cite real line numbers. A regex literal containing a quote
// character can desync this micro-lexer; the failure mode is strictly
// under-reporting (bytes get blanked, never un-blanked), never a false red.
function blankStringsAndComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code'; // code | sq | dq | tpl | line | block
  while (i < n) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : '';
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === "'") { state = 'sq'; out += c; i++; continue; }
      if (c === '"') { state = 'dq'; out += c; i++; continue; }
      if (c === '`') { state = 'tpl'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; } else { out += ' '; }
      i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; out += '  '; i += 2; }
      else { out += c === '\n' ? '\n' : ' '; i++; }
      continue;
    }
    // string states (sq | dq | tpl)
    if (c === '\\') { out += '  '; i += 2; continue; }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) {
      state = 'code'; out += c; i++; continue;
    }
    out += c === '\n' ? '\n' : ' '; i++;
  }
  return out;
}

// Pure scanner: returns [{ line, snippet }] for every bare alias occurrence in
// an HTML page's inline script bodies. Sanctioned fallback arms are exempted;
// strings and comments are blanked before scanning. The strict 'modelContext'
// guard literal only exists in the RAW text (blanking empties string contents),
// so sanctioned ranges are matched on RAW — blankStringsAndComments preserves
// positions by construction, raw and blanked indexes are identical.
function bareAliasFindings(html) {
  const findings = [];
  const scriptRe = new RegExp(INLINE_SCRIPT_RE.source, 'gi');
  let m;
  while ((m = scriptRe.exec(html))) {
    const raw = m[1];
    const blanked = blankStringsAndComments(raw);
    const sanctioned = [];
    const sRe = new RegExp(SANCTIONED_FALLBACK_RE.source, 'g');
    let s;
    while ((s = sRe.exec(raw))) sanctioned.push([s.index, s.index + s[0].length]);
    const hitRe = new RegExp(BARE_ALIAS_SOURCE, 'g');
    let hit;
    const bodyStartAbs = m.index + m[0].indexOf(raw);
    while ((hit = hitRe.exec(blanked))) {
      const at = hit.index;
      if (sanctioned.some(([a, b]) => at >= a && at < b)) continue;
      const lineInBody = blanked.slice(0, at).split('\n').length;
      const line = html.slice(0, bodyStartAbs).split('\n').length + lineInBody - 1;
      const rawLine = raw.split('\n')[lineInBody - 1] || '';
      findings.push({ line, snippet: rawLine.trim().slice(0, 160) });
    }
  }
  return findings;
}

// Estate sweep: every tracked .html under the five published WebMCP areas.
function runApiSurfaceSweep() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..');
  const pathspecs = ['tools/*.html', 'guides/*.html', 'chaingraph/*.html', 'index.html', 'ledger/*.html'];
  const out = execFileSync('git', ['ls-files', '--', ...pathspecs], { cwd: repoRoot, env: gitEnv(), encoding: 'utf8' });
  const files = out.split('\n').filter(Boolean);
  let badFiles = 0;
  let hits = 0;
  for (const file of files) {
    let src;
    try {
      src = readFileSync(resolve(repoRoot, file), 'utf8');
    } catch {
      continue; // deleted-but-tracked race; the checkout's gates re-derive the tree
    }
    const found = bareAliasFindings(src);
    if (found.length === 0) continue;
    badFiles++;
    hits += found.length;
    console.error(`✗ ${file}`);
    found.forEach((f) => console.error(`    line ${f.line}: bare navigator.modelContext — ${f.snippet}`));
  }
  console.log(`api-surface: scanned ${files.length} file(s) across tools/, guides/, chaingraph/, index.html, ledger/`);
  if (badFiles > 0) {
    console.error(`api-surface: RED — ${hits} bare navigator.modelContext usage(s) in ${badFiles} file(s). ` +
      `Use the generator-emitted feature-detect form: document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null)`);
    process.exit(1);
  }
  console.log('api-surface: GREEN — 0 bare navigator.modelContext usages (only the sanctioned feature-detect fallback remains)');
  process.exit(0);
}

const RED_FIXTURE = `
<script>
mc.registerTool({
  name: 'bad tool name',
  description: 'too short',
  inputSchema: { type: 'object', properties: { widgetId: { type: 'string' } } },
  annotations: {},
  execute: function(params) {
    fetch('https://example.com/' + params.widgetId);
  }
});
</script>
`;

const GREEN_FIXTURE = `
<script>
const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);
if (mc) {
  mc.registerTool({
    name: 'list_agent_tools',
    description: 'Lists AINumbers calculator pages currently exposing an agent-callable WebMCP tool.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: function(params) {
      return TOOL_DIRECTORY;
    }
  });
}
</script>
`;

function selfTest() {
  const redIssues = checkSnippet(RED_FIXTURE, 'RED fixture');
  const greenIssues = checkSnippet(GREEN_FIXTURE, 'GREEN fixture');

  console.log('--- RED fixture (expected: FAIL) ---');
  redIssues.forEach((i) => console.log('  ✗ ' + i));
  console.log(redIssues.length > 0 ? 'RED: FAIL (as expected)' : 'RED: PASS (UNEXPECTED — lint is not catching known-bad input)');

  console.log('--- GREEN fixture (expected: PASS) ---');
  greenIssues.forEach((i) => console.log('  ✗ ' + i));
  console.log(greenIssues.length === 0 ? 'GREEN: PASS (as expected)' : 'GREEN: FAIL (UNEXPECTED — lint is rejecting known-good input)');

  // Generated-shape GREEN (WEBMCP-GEN-FROM-MANIFEST-1): async execute, readOnlyHint
  // only, untrustedContentHint n/a stated in the comment.
  const genGreen = checkSnippet(`
<script>
const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);
if (mc) {
  mc.registerTool({
    name: 'validate_generated_fixture',
    description: 'Generated fixture whose annotations carry readOnlyHint only with an n/a rationale comment.',
    // untrustedContentHint is not applicable: deterministic local compute, no untrusted content.
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async function(params) {
      return { ok: true };
    }
  });
}
</script>
`, 'generated-shape fixture');
  console.log('--- Generated-shape fixture (expected: PASS) ---');
  genGreen.forEach((i) => console.log('  ✗ ' + i));
  console.log(genGreen.length === 0 ? 'GENERATED-SHAPE: PASS (as expected)' : 'GENERATED-SHAPE: FAIL (UNEXPECTED)');

  // RED: readOnlyHint only, no n/a rationale — the truthful-hint posture gap.
  const hintRed = checkSnippet(`
<script>
mc.registerTool({
  name: 'silent_hint_fixture',
  description: 'Fixture that omits the hint and never states why, which is exactly the gap.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true },
  execute: function(params) { return { ok: true }; }
});
</script>
`, 'hint-red fixture');
  console.log('--- Hint-gap fixture (expected: FAIL) ---');
  hintRed.forEach((i) => console.log('  ✗ ' + i));
  console.log(hintRed.length > 0 ? 'HINT-GAP: FAIL (as expected)' : 'HINT-GAP: PASS (UNEXPECTED — lint is not catching the truthful-hint gap)');

  // Multi-tool page GREEN (LEDGER-WEBMCP-1): several registerTool calls in one
  // block, every call fully linted.
  const multiGreen = checkSnippet(`
<script>
const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);
if (mc) {
  mc.registerTool({
    name: 'first_tool',
    description: 'First tool of a multi-tool page with a real capability statement.',
    inputSchema: { type: 'object', required: ['doc'], properties: { doc: { type: 'object' } } },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async function(params) { return params.doc; }
  });
  mc.registerTool({
    name: 'second_tool',
    description: 'Second tool of a multi-tool page with a real capability statement.',
    inputSchema: { type: 'object', required: ['frag'], properties: { frag: { type: 'string' } } },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async function(params) { return params.frag; }
  });
}
</script>
`, 'multi-tool fixture');
  console.log('--- Multi-tool fixture (expected: PASS) ---');
  multiGreen.forEach((i) => console.log('  ✗ ' + i));
  console.log(multiGreen.length === 0 ? 'MULTI-TOOL: PASS (as expected)' : 'MULTI-TOOL: FAIL (UNEXPECTED)');

  // RED: on a multi-tool page only ONE call is bad — the verdict must still move.
  const multiRed = checkSnippet(`
<script>
const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);
if (mc) {
  mc.registerTool({
    name: 'good_tool_one',
    description: 'Good tool of a multi-tool page with a real capability statement.',
    inputSchema: { type: 'object', required: ['doc'], properties: { doc: { type: 'object' } } },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async function(params) { return params.doc; }
  });
  mc.registerTool({
    name: 'Bad Tool Name',
    description: 'Bad tool whose name is not snake_case, failing the lint.',
    inputSchema: { type: 'object', required: ['frag'], properties: { frag: { type: 'string' } } },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async function(params) { return params.frag; }
  });
}
</script>
`, 'multi-tool-red fixture');
  console.log('--- Multi-tool RED fixture (expected: FAIL) ---');
  multiRed.forEach((i) => console.log('  ✗ ' + i));
  console.log(multiRed.some((i) => i.startsWith('registerTool #2:')) ? 'MULTI-TOOL-RED: FAIL (as expected)' : 'MULTI-TOOL-RED: PASS (UNEXPECTED — lint missed the bad second call)');

  // ── API-surface mutation controls (WEBMCP-DOCCONTEXT-REGEN-1) ──────────────
  // RED: a bare alias registration — exactly the pre-migration shape.
  const bareRed = bareAliasFindings(`
<script>
const mc = navigator.modelContext;
if (mc) { mc.registerTool({ name: 'x', description: 'x' }); }
</script>
`);
  console.log('--- API-surface RED fixture (expected: 1 bare hit) ---');
  console.log(bareRed.length === 1 ? 'API-SURFACE-RED: 1 hit (as expected)' : 'API-SURFACE-RED: ' + bareRed.length + ' hits (UNEXPECTED — sweep missed the bare alias)');

  // RED: the guard-less `??` fallback — names the alias as a live code operand.
  const guardlessRed = bareAliasFindings(`
<script>
const mc = document.modelContext ?? navigator.modelContext;
if (mc) { mc.registerTool({ name: 'x', description: 'x' }); }
</script>
`);
  console.log('--- API-surface guard-less fallback RED fixture (expected: 1 bare hit) ---');
  console.log(guardlessRed.length === 1 ? 'API-SURFACE-GUARDLESS-RED: 1 hit (as expected)' : 'API-SURFACE-GUARDLESS-RED: ' + guardlessRed.length + ' hits (UNEXPECTED)');

  // GREEN: the canonical generator-emitted feature-detect form.
  const canonicalGreen = bareAliasFindings(`
<script>
const mc = document.modelContext ?? (('modelContext' in navigator) ? navigator.modelContext : null);
if (mc) { mc.registerTool({ name: 'x', description: 'x' }); }
</script>
`);
  console.log('--- API-surface canonical GREEN fixture (expected: 0 hits) ---');
  console.log(canonicalGreen.length === 0 ? 'API-SURFACE-CANONICAL: PASS (as expected)' : 'API-SURFACE-CANONICAL: FAIL (UNEXPECTED — sanctioned fallback reds)');

  // GREEN: prose naming the alias (comment, string literal, double-quoted
  // history-guide form of the guard) must not red — naming is not using.
  const proseGreen = bareAliasFindings(`
<script>
// navigator.modelContext is deprecated as of Chrome 150.
const label = "navigator.modelContext";
const mc = document.modelContext ?? (("modelContext" in navigator) ? navigator.modelContext : null);
if (mc) { mc.registerTool({ name: 'x', description: 'x' }); }
</script>
`);
  console.log('--- API-surface prose/string GREEN fixture (expected: 0 hits) ---');
  console.log(proseGreen.length === 0 ? 'API-SURFACE-PROSE: PASS (as expected)' : 'API-SURFACE-PROSE: FAIL (UNEXPECTED — comment or string literal reds)');

  // GREEN: a page with no script at all (prose-only history page shape).
  const noScriptGreen = bareAliasFindings('<p>navigator.modelContext moved to document.modelContext.</p>');
  console.log('--- API-surface no-script GREEN fixture (expected: 0 hits) ---');
  console.log(noScriptGreen.length === 0 ? 'API-SURFACE-NOSCRIPT: PASS (as expected)' : 'API-SURFACE-NOSCRIPT: FAIL (UNEXPECTED — prose outside <script> reds)');

  const apiOk = bareRed.length === 1 && guardlessRed.length === 1 && canonicalGreen.length === 0
    && proseGreen.length === 0 && noScriptGreen.length === 0;

  const ok = redIssues.length > 0 && greenIssues.length === 0 && genGreen.length === 0 && hintRed.length > 0
    && multiGreen.length === 0 && multiRed.some((i) => i.startsWith('registerTool #2:'))
    && apiOk;
  process.exit(ok ? 0 : 1);
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selfTest();
} else if (args.includes('--api-surface')) {
  runApiSurfaceSweep();
} else {
  if (args.length === 0) {
    console.error('Usage: node scripts/check-webmcp-snippet.mjs <file.html> [...] | --api-surface | --self-test');
    process.exit(1);
  }
  let anyFail = false;
  for (const file of args) {
    const src = readFileSync(file, 'utf8');
    const issues = checkSnippet(src, file);
    if (issues.length > 0) {
      anyFail = true;
      console.error(`✗ ${file}`);
      issues.forEach((i) => console.error('    ' + i));
    } else {
      console.log(`✓ ${file}`);
    }
  }
  process.exit(anyFail ? 1 : 0);
}
