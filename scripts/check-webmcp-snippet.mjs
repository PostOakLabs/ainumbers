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
 *   6. exactly one registerTool call per page.
 *   7. schema-minimality (W3C §6.3.3 anti-profiling control) — every
 *      inputSchema property must be read inside execute().
 *   8. annotations carry readOnlyHint:true, and untrustedContentHint is either
 *      true (UGC answer class) or omitted WITH an n/a rationale comment
 *      (truthful-hint posture, WEBMCP-AUDIT-DRYRUN-1 #1616).
 *
 * Usage:
 *   node scripts/check-webmcp-snippet.mjs <file.html> [<file.html> ...]
 *   node scripts/check-webmcp-snippet.mjs --self-test   # prints RED then GREEN fixture, exit 0 if both verdicts are as expected
 */
import { readFileSync } from 'node:fs';

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
  if (calls.length > 1) {
    issues.push(`${calls.length} registerTool calls found, expected exactly 1`);
  }

  const call = calls[0];

  // Rule 2: not event-gated — no addEventListener between the feature-detect
  // guard and the registerTool call.
  const preamble = src.slice(0, call.start);
  const guardIdx = Math.max(preamble.lastIndexOf('if (mc)'), preamble.lastIndexOf('if(mc)'));
  const scanFrom = guardIdx >= 0 ? guardIdx : Math.max(0, call.start - 400);
  const between = src.slice(scanFrom, call.start);
  if (/addEventListener\s*\(/.test(between)) {
    issues.push('registerTool appears gated behind addEventListener, not called at top level on page load');
  }

  const name = extractStringField(call.body, 'name');
  if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) {
    issues.push(`tool name '${name}' is not snake_case`);
  }

  const description = extractStringField(call.body, 'description');
  const wordCount = description ? description.trim().split(/\s+/).filter(Boolean).length : 0;
  if (wordCount < 8) {
    issues.push(`description has ${wordCount} words, need >= 8`);
  }

  const execBody = extractExecuteBody(call.body);
  if (!execBody) {
    issues.push('no execute() function found');
  } else {
    for (const pattern of NETWORK_PATTERNS) {
      if (pattern.test(execBody)) {
        issues.push(`execute() contains a network call matching ${pattern}`);
      }
    }
  }

  const schemaProps = extractSchemaProperties(call.body);
  if (execBody) {
    for (const prop of schemaProps) {
      const usedRe = new RegExp(`params(?:\\s*\\.\\s*${prop}\\b|\\s*\\[\\s*['"]${prop}['"]\\s*\\])`);
      if (!usedRe.test(execBody)) {
        issues.push(`inputSchema property '${prop}' is never read inside execute() (schema-minimality, W3C §6.3.3)`);
      }
    }
  }

  if (!/readOnlyHint\s*:\s*true/.test(call.body)) issues.push('annotations missing readOnlyHint:true');
  // Truthful-hint posture (WEBMCP-AUDIT-DRYRUN-1 #1616): a zero-UGC deterministic
  // local tool must NOT claim untrustedContentHint:true. Either it carries the
  // field truthfully for its answer class, or it omits the field AND states the
  // n/a rationale in the block comment. Silent absence of both is red.
  if (!/untrustedContentHint\s*:\s*true/.test(call.body) && !/untrustedContentHint\s+is\s+not\s+applicable/.test(src)) {
    issues.push('untrustedContentHint: neither a true field nor an n/a rationale comment (truthful-hint posture)');
  }

  return issues;
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

  const ok = redIssues.length > 0 && greenIssues.length === 0 && genGreen.length === 0 && hintRed.length > 0;
  process.exit(ok ? 0 : 1);
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selfTest();
} else {
  if (args.length === 0) {
    console.error('Usage: node scripts/check-webmcp-snippet.mjs <file.html> [...] | --self-test');
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
