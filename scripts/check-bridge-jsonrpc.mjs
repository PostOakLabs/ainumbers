#!/usr/bin/env node
/**
 * scripts/check-bridge-jsonrpc.mjs — BRIDGE-MCP-APPS-ALIGN-1, goal 4.
 *
 * Holds the AIN Bridge master snippet's MCP Apps layer to its primary text and to
 * the origin-pinning rule:
 *
 *   1. The snippet carries exactly one MCP-APPS-JSONRPC region (START .. END).
 *   2. MCP_HOST_METHODS equals the Host→View method set of the MCP Apps
 *      specification 2026-01-26 (modelcontextprotocol/ext-apps,
 *      specification/2026-01-26/apps.mdx), and MCP_VIEW_METHODS equals its
 *      View→Host set. Not a superset and not a subset: a method the View accepts
 *      but the spec never sends is an unreviewed intake path, and a method the
 *      spec sends but the View drops is a silent capability hole.
 *   3. The `ui/notifications/sandbox-*` messages are RESERVED for a web host's
 *      sandbox proxy, so neither list may name one.
 *   4. No `postMessage(…, '*')` survives after the handshake: every wildcard
 *      target must sit on a line carrying the `PRE-HANDSHAKE-ORIGIN-OK` sentinel
 *      AND that line must test `MCP.hostOrigin`, and there may be at most two
 *      such lines (the ui/initialize send, and the opaque-origin legacy reply).
 *   5. mcpPost — the post-handshake sender — refuses to send with no pinned
 *      origin, so a wildcard can never be reached by falling through it.
 *   6. Unknown methods are answered with JSON-RPC error -32601 inside the
 *      handler, and the ain-handoff/v1 alias table still names all three legacy
 *      types (kept for ONE snippet version, per the row).
 *
 * Why a lint and not only a unit test: the unit test evaluates the region, so it
 * proves the ROUTINES behave; this gate reads the FILE, so it also catches a
 * wildcard target or an off-spec method added in the DOM-wiring half of the
 * snippet, which no evaluation of the pure region would ever see.
 *
 * SCOPE: the master snippet only (`scripts/ain-bridge-v1.snippet.html`) — the
 * single place a bridge version is authored. Published pages carry copies written
 * by scripts/sync-ain-bridge.mjs; BRIDGE-SNIPPET-ROLL-1 rolls them and can widen
 * this gate's scope in the same breath as it flips sync-ain-bridge --check
 * blocking. Widening it here, before any page carries v1.3, would only assert
 * against the v1.2 copies this row deliberately leaves alone.
 *
 * Usage:
 *   node scripts/check-bridge-jsonrpc.mjs            — check the master snippet
 *   node scripts/check-bridge-jsonrpc.mjs <path>...  — check the named files
 * Self-test: scripts/check-bridge-jsonrpc.test.mjs (imports auditSnippet and
 * proves each rule goes RED on a mutated snippet and GREEN on the real one).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
export const MASTER_PATH = resolve(REPO, 'scripts', 'ain-bridge-v1.snippet.html');

export const REGION_START = 'MCP-APPS-JSONRPC v1 START';
export const REGION_END = 'MCP-APPS-JSONRPC v1 END';
export const WILDCARD_SENTINEL = 'PRE-HANDSHAKE-ORIGIN-OK';
export const MAX_WILDCARD_LINES = 2;

/** Host→View, quoted from the spec's "Notifications (Host → View)" plus the one
 *  Host→View request (`ui/resource-teardown`). */
export const SPEC_HOST_METHODS = [
  'ui/notifications/tool-input',
  'ui/notifications/tool-input-partial',
  'ui/notifications/tool-result',
  'ui/notifications/tool-cancelled',
  'ui/notifications/host-context-changed',
  'ui/resource-teardown',
];

/** View→Host: the spec's "Requests (View → Host)", the two lifecycle messages the
 *  View sends, its size notification, and the standard `tools/call` the host
 *  proxies to the server. */
export const SPEC_VIEW_METHODS = [
  'ui/initialize',
  'ui/notifications/initialized',
  'ui/message',
  'ui/open-link',
  'ui/request-display-mode',
  'ui/update-model-context',
  'ui/notifications/size-changed',
  'tools/call',
];

export const SPEC_PROTOCOL_VERSION = '2026-01-26';
export const LEGACY_ALIAS_TYPES = ['ain:prefill', 'ain:run', 'ain:getMandate'];

/** Pure. The quoted strings of a `var <NAME>=[ ... ];` array literal, or null. */
export function readArrayLiteral(src, name) {
  const m = src.match(new RegExp(`var\\s+${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return null;
  return [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((q) => q[1] ?? q[2]);
}

function setDiff(actual, expected) {
  const a = new Set(actual);
  const e = new Set(expected);
  return {
    missing: expected.filter((x) => !a.has(x)),
    unexpected: actual.filter((x) => !e.has(x)),
  };
}

/**
 * Pure. Every rule above, over one file's bytes.
 * Returns an array of finding strings — empty means GREEN.
 */
export function auditSnippet(html, label = 'snippet') {
  const findings = [];
  const say = (msg) => findings.push(`${label}: ${msg}`);

  // (1) exactly one region, correctly ordered.
  const starts = [...html.matchAll(new RegExp(REGION_START, 'g'))].length;
  const ends = [...html.matchAll(new RegExp(REGION_END, 'g'))].length;
  if (starts !== 1 || ends !== 1) {
    say(`expected exactly one ${REGION_START}/${REGION_END} pair, found ${starts}/${ends}`);
  }
  const startIdx = html.indexOf(REGION_START);
  const endIdx = html.indexOf(REGION_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    say('the MCP-APPS-JSONRPC region is absent or its END precedes its START');
    return findings; // nothing downstream can be read honestly
  }
  const region = html.slice(startIdx, endIdx);

  // (2) + (3) the two allowlists, read out of the region itself.
  for (const [name, expected] of [
    ['MCP_HOST_METHODS', SPEC_HOST_METHODS],
    ['MCP_VIEW_METHODS', SPEC_VIEW_METHODS],
  ]) {
    const actual = readArrayLiteral(region, name);
    if (actual === null) {
      say(`${name} is not declared as a var array literal inside the region`);
      continue;
    }
    const { missing, unexpected } = setDiff(actual, expected);
    if (missing.length) say(`${name} is missing spec method(s): ${missing.join(', ')}`);
    if (unexpected.length) say(`${name} declares method(s) the spec does not: ${unexpected.join(', ')}`);
    const reserved = actual.filter((x) => x.includes('sandbox-'));
    if (reserved.length) say(`${name} names sandbox-proxy reserved message(s): ${reserved.join(', ')}`);
  }

  if (!region.includes(`'${SPEC_PROTOCOL_VERSION}'`)) {
    say(`the region does not declare the spec protocolVersion '${SPEC_PROTOCOL_VERSION}'`);
  }

  // (4) wildcard targets. Read over the WHOLE file, not just the region: the DOM
  // wiring outside it is where a postMessage actually happens.
  const lines = html.split('\n');
  const wildcardLines = [];
  const sentinelLines = [];
  lines.forEach((line, i) => {
    if (/postMessage\s*\(/.test(line) && /(^|[^\w$])'\*'/.test(line)) wildcardLines.push([i + 1, line]);
    if (line.includes(WILDCARD_SENTINEL)) sentinelLines.push([i + 1, line]);
  });
  for (const [n, line] of wildcardLines) {
    if (!line.includes(WILDCARD_SENTINEL)) {
      say(`line ${n} posts to a wildcard target with no ${WILDCARD_SENTINEL} sentinel: ${line.trim().slice(0, 120)}`);
    }
  }
  for (const [n, line] of sentinelLines) {
    if (!line.includes('MCP.hostOrigin')) {
      say(`line ${n} carries the ${WILDCARD_SENTINEL} sentinel without testing MCP.hostOrigin`);
    }
  }
  if (sentinelLines.length > MAX_WILDCARD_LINES) {
    say(`${sentinelLines.length} ${WILDCARD_SENTINEL} lines, at most ${MAX_WILDCARD_LINES} are allowed`);
  }

  // (5) the post-handshake sender refuses an unpinned send.
  if (!/function mcpPost\(env\)\{\s*\n\s*if\(!MCP\.hostOrigin\)return false;/.test(html)) {
    say('mcpPost must refuse to send when MCP.hostOrigin is not pinned (first statement `if(!MCP.hostOrigin)return false;`)');
  }

  // (6) -32601 inside the handler, and the legacy alias table intact.
  const handlerIdx = region.indexOf('function mcpHandleHostMessage');
  if (handlerIdx === -1) say('the region declares no mcpHandleHostMessage');
  else if (!region.slice(handlerIdx).includes('-32601')) {
    say('mcpHandleHostMessage must answer an unknown method with JSON-RPC error -32601');
  }
  const alias = region.match(/var\s+MCP_LEGACY_ALIAS\s*=\s*\{([\s\S]*?)\};/);
  if (!alias) say('the ain-handoff/v1 alias table MCP_LEGACY_ALIAS is absent');
  else {
    for (const type of LEGACY_ALIAS_TYPES) {
      if (!alias[1].includes(`'${type}'`)) say(`MCP_LEGACY_ALIAS does not carry the legacy type '${type}'`);
    }
  }

  return findings;
}

function main(argv) {
  const targets = argv.filter((a) => !a.startsWith('--'));
  const files = targets.length ? targets.map((p) => resolve(REPO, p)) : [MASTER_PATH];
  let findings = [];
  for (const f of files) {
    const rel = f.replace(REPO, '').replace(/\\/g, '/').replace(/^\//, '');
    findings = findings.concat(auditSnippet(readFileSync(f, 'utf8'), rel));
  }
  if (findings.length) {
    console.log(`check-bridge-jsonrpc: ${findings.length} FINDING(S)`);
    for (const f of findings) console.log(`  ✗ ${f}`);
    return 1;
  }
  console.log(
    `check-bridge-jsonrpc: OK · ${files.length} file(s) · ` +
      `${SPEC_HOST_METHODS.length} host method(s) + ${SPEC_VIEW_METHODS.length} view method(s) per MCP Apps ${SPEC_PROTOCOL_VERSION}`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
