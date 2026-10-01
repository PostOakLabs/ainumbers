#!/usr/bin/env node
/**
 * scripts/check-bridge-jsonrpc.test.mjs — BRIDGE-MCP-APPS-ALIGN-1 / SO #40b,
 * GATE-SELFTEST-META-1 pairing for scripts/check-bridge-jsonrpc.mjs.
 *
 * "A checker that cannot be shown red proves nothing." Every rule the gate
 * claims is mutated here on an in-memory copy of the REAL master snippet and
 * must produce a finding; the unmutated snippet must produce none. The gate is
 * pure over bytes (auditSnippet), so no fixture file and no temp tree is needed.
 *
 * Usage: node scripts/check-bridge-jsonrpc.test.mjs  (also under `node --test`)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MASTER_PATH,
  auditSnippet,
  readArrayLiteral,
  SPEC_HOST_METHODS,
  SPEC_VIEW_METHODS,
  WILDCARD_SENTINEL,
} from './check-bridge-jsonrpc.mjs';

const SNIPPET = readFileSync(MASTER_PATH, 'utf8');

/** Replace once, and prove the mutation actually landed. */
function mutate(find, replace) {
  assert.ok(SNIPPET.includes(find), `the mutation anchor must exist in the snippet: ${find}`);
  return SNIPPET.replace(find, replace);
}

const findingsFor = (html) => auditSnippet(html, 'fixture');

test('GREEN: the shipped master snippet has no findings', () => {
  assert.deepEqual(auditSnippet(SNIPPET, 'scripts/ain-bridge-v1.snippet.html'), []);
});

test('RED: a spec method dropped from the host allowlist', () => {
  const f = findingsFor(mutate("  'ui/notifications/tool-cancelled',\n", ''));
  assert.ok(
    f.some((x) => /MCP_HOST_METHODS is missing spec method\(s\): ui\/notifications\/tool-cancelled/.test(x)),
    `expected a missing-method finding, got: ${f.join(' | ')}`,
  );
});

test('RED: an invented method added to the view allowlist', () => {
  const f = findingsFor(mutate("  'ui/open-link',\n", "  'ui/open-link',\n  'ui/take-over-the-host',\n"));
  assert.ok(
    f.some((x) => /MCP_VIEW_METHODS declares method\(s\) the spec does not: ui\/take-over-the-host/.test(x)),
    `expected an off-spec finding, got: ${f.join(' | ')}`,
  );
});

test('RED: a sandbox-proxy reserved message smuggled into a list', () => {
  const f = findingsFor(mutate("  'ui/resource-teardown'\n", "  'ui/resource-teardown',\n  'ui/notifications/sandbox-resource-ready'\n"));
  assert.ok(
    f.some((x) => /names sandbox-proxy reserved message\(s\)/.test(x)),
    `expected a reserved-message finding, got: ${f.join(' | ')}`,
  );
});

test('RED: a wildcard postMessage with no sentinel', () => {
  const f = findingsFor(
    mutate(
      'function mcpSend(method,params,id){return mcpPost(mcpEnvelopeOut(method,params,id));}',
      "function mcpSend(method,params,id){window.parent.postMessage(mcpEnvelopeOut(method,params,id),'*');return true;}",
    ),
  );
  assert.ok(
    f.some((x) => new RegExp(`posts to a wildcard target with no ${WILDCARD_SENTINEL} sentinel`).test(x)),
    `expected an unsentinelled-wildcard finding, got: ${f.join(' | ')}`,
  );
});

test('RED: a sentinel that does not test MCP.hostOrigin', () => {
  const f = findingsFor(
    mutate(
      "  try{window.parent.postMessage(env,MCP.hostOrigin||'*');}catch(e){return false;} /* PRE-HANDSHAKE-ORIGIN-OK: MCP.hostOrigin is null until ui/initialize answers */",
      "  try{window.parent.postMessage(env,'*');}catch(e){return false;} /* PRE-HANDSHAKE-ORIGIN-OK: trust me */",
    ),
  );
  assert.ok(
    f.some((x) => new RegExp(`carries the ${WILDCARD_SENTINEL} sentinel without testing MCP.hostOrigin`).test(x)),
    `expected a sentinel-without-guard finding, got: ${f.join(' | ')}`,
  );
});

test('RED: mcpPost stops refusing an unpinned send', () => {
  const f = findingsFor(mutate('function mcpPost(env){\n  if(!MCP.hostOrigin)return false;', 'function mcpPost(env){\n  var anyOrigin=true;'));
  assert.ok(
    f.some((x) => /mcpPost must refuse to send when MCP.hostOrigin is not pinned/.test(x)),
    `expected an mcpPost-guard finding, got: ${f.join(' | ')}`,
  );
});

test('RED: the -32601 answer removed from the handler', () => {
  const f = findingsFor(mutate("mcpError(d.id,-32601,'Method not found: '+method)", "mcpError(d.id,-32000,'nope')"));
  assert.ok(
    f.some((x) => /must answer an unknown method with JSON-RPC error -32601/.test(x)),
    `expected a -32601 finding, got: ${f.join(' | ')}`,
  );
});

test('RED: a legacy alias type dropped from the table', () => {
  const f = findingsFor(mutate("  'ain:run':'ui/notifications/tool-input',\n", ''));
  assert.ok(
    f.some((x) => /MCP_LEGACY_ALIAS does not carry the legacy type 'ain:run'/.test(x)),
    `expected an alias-table finding, got: ${f.join(' | ')}`,
  );
});

test('RED: the region deleted altogether', () => {
  const f = findingsFor(SNIPPET.replace('MCP-APPS-JSONRPC v1 START', 'MCP-APPS-GONE'));
  assert.ok(f.length > 0, 'a snippet with no region must not read green');
});

test('RED: the protocol version drifted off the spec revision', () => {
  const f = findingsFor(mutate("var MCP_PROTOCOL_VERSION='2026-01-26';", "var MCP_PROTOCOL_VERSION='2025-11-21';"));
  assert.ok(
    f.some((x) => /does not declare the spec protocolVersion '2026-01-26'/.test(x)),
    `expected a protocolVersion finding, got: ${f.join(' | ')}`,
  );
});

test('the gate reads its allowlists out of the file, not out of its own constants', () => {
  // A known-answer control on the reader itself: the snippet's two arrays are what
  // the gate compares, so a reader that silently returned its expectation would
  // make every RED case above vacuous.
  const region = SNIPPET.slice(SNIPPET.indexOf('MCP-APPS-JSONRPC v1 START'), SNIPPET.indexOf('MCP-APPS-JSONRPC v1 END'));
  assert.deepEqual(readArrayLiteral(region, 'MCP_HOST_METHODS'), SPEC_HOST_METHODS);
  assert.deepEqual(readArrayLiteral(region, 'MCP_VIEW_METHODS'), SPEC_VIEW_METHODS);
  assert.equal(readArrayLiteral(region, 'MCP_NOT_A_LIST'), null);
});
