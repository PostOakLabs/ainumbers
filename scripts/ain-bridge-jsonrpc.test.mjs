#!/usr/bin/env node
/**
 * scripts/ain-bridge-jsonrpc.test.mjs — BRIDGE-MCP-APPS-ALIGN-1, goal 2.
 *
 * Exercises the MCP Apps layer of the REAL master snippet
 * (scripts/ain-bridge-v1.snippet.html): the test cuts the MCP-APPS-JSONRPC
 * region out of the shipped file and evaluates it, so nothing here can pass
 * against a copy of the routines that the estate does not actually carry. The
 * region is written to have no reference to any identifier outside it, which is
 * what makes that possible — and this suite is what keeps that true.
 *
 * Covered: the ui/initialize handshake and its shapes, origin pinning (before
 * and after the response), the ain-handoff/v1 alias table, the -32601 answer to
 * an unknown method, the intake path for ui/notifications/tool-input, the
 * ui/notifications/tool-result hook, the work-free ui/resource-teardown response,
 * and the ui/message receipt's content shape.
 *
 * Usage: node scripts/ain-bridge-jsonrpc.test.mjs  (also under `node --test`)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNIPPET = readFileSync(resolve(REPO, 'scripts', 'ain-bridge-v1.snippet.html'), 'utf8');

const START = 'MCP-APPS-JSONRPC v1 START';
const END = 'MCP-APPS-JSONRPC v1 END';

/** The region's source, from the line after its START banner to its END banner. */
function regionSource(html) {
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  assert.ok(s !== -1 && e > s, 'the snippet must carry one MCP-APPS-JSONRPC region');
  // Start after the banner comment's own close, so the evaluated text is code.
  const afterBanner = html.indexOf('*/', s);
  return html.slice(afterBanner + 2, html.lastIndexOf('/*', e));
}

const EXPORTS = [
  'MCP_PROTOCOL_VERSION',
  'MCP_HOST_METHODS',
  'MCP_VIEW_METHODS',
  'MCP_LEGACY_ALIAS',
  'mcpNewState',
  'mcpEnvelopeKind',
  'mcpError',
  'mcpOk',
  'mcpEnvelopeOut',
  'mcpAppCapabilities',
  'mcpInitRequest',
  'mcpInitializedNotification',
  'mcpOriginOk',
  'mcpAcceptInitResponse',
  'mcpReceiptText',
  'mcpMessageRequest',
  'mcpHandleHostMessage',
];

/**
 * Evaluate the region in its own scope and hand back its routines. A ReferenceError
 * here means the region grew a dependency on the snippet's DOM half, which would
 * also mean this suite had stopped testing the shipped code.
 */
function loadRegion() {
  const src = regionSource(SNIPPET);
  const fn = new Function(`${src}\nreturn {${EXPORTS.join(',')}};`);
  return fn();
}

const M = loadRegion();

/** A stub dep set that records what the handler asked for. */
function recorder() {
  const calls = [];
  return {
    calls,
    applyArguments: (args, complete) => calls.push(['applyArguments', args, complete]),
    renderResult: (res) => calls.push(['renderResult', res]),
    cancelled: (reason) => calls.push(['cancelled', reason]),
    hostContextChanged: (ctx) => calls.push(['hostContextChanged', ctx]),
  };
}

test('region evaluates standalone and exposes every routine (no outside identifiers)', () => {
  for (const name of EXPORTS) assert.ok(M[name] !== undefined, `${name} must be declared in the region`);
  assert.equal(M.MCP_PROTOCOL_VERSION, '2026-01-26');
});

test('handshake: ui/initialize carries the spec params, initialized follows the result', () => {
  const state = M.mcpNewState();
  state.initId = 1;
  const req = M.mcpInitRequest(1, { version: '1.3', prefill: true }, '1.3');
  assert.equal(req.jsonrpc, '2.0');
  assert.equal(req.method, 'ui/initialize');
  assert.equal(req.id, 1);
  assert.equal(req.params.protocolVersion, '2026-01-26');
  assert.equal(req.params.clientInfo.name, 'ainumbers-ain-bridge');
  assert.equal(req.params.clientInfo.version, '1.3');
  // appCapabilities per McpUiAppCapabilities: the B7 capabilities object rides in
  // `experimental`, and no `tools` capability is claimed.
  assert.deepEqual(req.params.appCapabilities.experimental.ainBridge, { version: '1.3', prefill: true });
  assert.equal(req.params.appCapabilities.tools, undefined);
  assert.deepEqual(req.params.appCapabilities.availableDisplayModes, ['inline', 'fullscreen']);

  const initialized = M.mcpAcceptInitResponse(
    state,
    {
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2026-01-26',
        hostCapabilities: { openLinks: {} },
        hostInfo: { name: 'claude-desktop', version: '1.0.0' },
        hostContext: { theme: 'dark' },
      },
    },
    'https://host.example',
  );
  assert.deepEqual(initialized, { jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} });
  assert.equal(state.ready, true);
  assert.equal(state.hostOrigin, 'https://host.example');
  assert.deepEqual(state.hostCapabilities, { openLinks: {} });
  assert.deepEqual(state.hostInfo, { name: 'claude-desktop', version: '1.0.0' });
  assert.deepEqual(state.hostContext, { theme: 'dark' });
});

test('handshake: a response with another id, or an error, pins nothing', () => {
  const other = M.mcpNewState();
  other.initId = 1;
  assert.equal(M.mcpAcceptInitResponse(other, { jsonrpc: '2.0', id: 7, result: {} }, 'https://host.example'), null);
  assert.equal(other.ready, false);
  assert.equal(other.hostOrigin, null);

  const errored = M.mcpNewState();
  errored.initId = 1;
  assert.equal(
    M.mcpAcceptInitResponse(errored, { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'no' } }, 'https://host.example'),
    null,
  );
  assert.equal(errored.ready, false);
  assert.equal(errored.hostOrigin, null);
});

test('origin pinning: any origin before the handshake, only the pinned one after', () => {
  const state = M.mcpNewState();
  assert.equal(M.mcpOriginOk(state, 'https://anything.example'), true);
  M.mcpAcceptInitResponse(state, { jsonrpc: '2.0', id: null, result: {} }, 'https://ignored.example');
  // (id null is not the pending handshake, so still unpinned)
  assert.equal(state.hostOrigin, null);

  state.initId = 1;
  M.mcpAcceptInitResponse(state, { jsonrpc: '2.0', id: 1, result: {} }, 'https://host.example');
  assert.equal(M.mcpOriginOk(state, 'https://host.example'), true);
  assert.equal(M.mcpOriginOk(state, 'https://evil.example'), false);

  const deps = recorder();
  const r = M.mcpHandleHostMessage(
    state,
    { jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: { a: 1 } } },
    'https://evil.example',
    deps,
  );
  assert.equal(r.ignored, 'origin-not-pinned-host');
  assert.deepEqual(deps.calls, [], 'a message from an unpinned origin must reach no dep');
  assert.deepEqual(r.responses, [], 'and must not be answered either');
});

test('tool-input and tool-input-partial both feed the one intake path', () => {
  const state = M.mcpNewState();
  const deps = recorder();
  M.mcpHandleHostMessage(state, { jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: { validateInput: '{}' } } }, 'https://host.example', deps);
  M.mcpHandleHostMessage(state, { jsonrpc: '2.0', method: 'ui/notifications/tool-input-partial', params: { arguments: { validateInput: '{' } } }, 'https://host.example', deps);
  assert.deepEqual(deps.calls, [
    ['applyArguments', { validateInput: '{}' }, true],
    ['applyArguments', { validateInput: '{' }, false],
  ]);
});

test('tool-result reaches the result hook; tool-cancelled reaches the cancel hook', () => {
  const state = M.mcpNewState();
  const deps = recorder();
  const result = { content: [{ type: 'text', text: 'ok' }], structuredContent: { mandate_id: 'm1' }, _meta: {} };
  M.mcpHandleHostMessage(state, { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result }, 'https://host.example', deps);
  M.mcpHandleHostMessage(state, { jsonrpc: '2.0', method: 'ui/notifications/tool-cancelled', params: { reason: 'user' } }, 'https://host.example', deps);
  assert.deepEqual(deps.calls, [['renderResult', result], ['cancelled', 'user']]);
});

test('host-context-changed updates the state and the hook', () => {
  const state = M.mcpNewState();
  const deps = recorder();
  M.mcpHandleHostMessage(
    state,
    { jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { hostContext: { theme: 'light' } } },
    'https://host.example',
    deps,
  );
  assert.deepEqual(state.hostContext, { theme: 'light' });
  assert.deepEqual(deps.calls, [['hostContextChanged', { theme: 'light' }]]);
});

test('ui/resource-teardown is answered with an empty result and no work', () => {
  const state = M.mcpNewState();
  const deps = recorder();
  const r = M.mcpHandleHostMessage(state, { jsonrpc: '2.0', id: 9, method: 'ui/resource-teardown', params: { reason: 'user closed' } }, 'https://host.example', deps);
  assert.deepEqual(r.responses, [{ jsonrpc: '2.0', id: 9, result: {} }]);
  assert.deepEqual(deps.calls, [], 'teardown must not run page work');
});

test('unknown method: a request is answered -32601, a notification is dropped', () => {
  const state = M.mcpNewState();
  const deps = recorder();
  const req = M.mcpHandleHostMessage(state, { jsonrpc: '2.0', id: 4, method: 'ui/definitely-not-a-method', params: {} }, 'https://host.example', deps);
  assert.equal(req.responses.length, 1);
  assert.equal(req.responses[0].error.code, -32601);
  assert.match(req.responses[0].error.message, /Method not found: ui\/definitely-not-a-method/);
  assert.equal(req.responses[0].id, 4);

  const notif = M.mcpHandleHostMessage(state, { jsonrpc: '2.0', method: 'ui/definitely-not-a-method', params: {} }, 'https://host.example', deps);
  assert.deepEqual(notif.responses, [], 'a notification has no reply channel to carry an error on');
  assert.equal(notif.ignored, 'method-not-allowlisted');
  assert.deepEqual(deps.calls, []);
});

test('a non-JSON-RPC message (including ain-handoff/v1) is not a host message', () => {
  const state = M.mcpNewState();
  assert.equal(M.mcpEnvelopeKind({ type: 'ain:prefill', fields: {} }), null);
  assert.equal(M.mcpEnvelopeKind({ jsonrpc: '1.0', method: 'ui/notifications/tool-input' }), null);
  assert.equal(M.mcpEnvelopeKind(null), null);
  assert.equal(M.mcpEnvelopeKind({ jsonrpc: '2.0', method: 'ui/message' }), 'notification');
  assert.equal(M.mcpEnvelopeKind({ jsonrpc: '2.0', id: 1, method: 'ui/resource-teardown' }), 'request');
  assert.equal(M.mcpEnvelopeKind({ jsonrpc: '2.0', id: 1, result: {} }), 'response');
  const r = M.mcpHandleHostMessage(state, { type: 'ain:prefill' }, 'https://host.example', recorder());
  assert.equal(r.ignored, 'not-a-host-message');
});

test('alias table: all three ain-handoff/v1 types, each naming its ui/ twin or null', () => {
  assert.equal(M.MCP_LEGACY_ALIAS['ain:prefill'], 'ui/notifications/tool-input');
  assert.equal(M.MCP_LEGACY_ALIAS['ain:run'], 'ui/notifications/tool-input');
  // getMandate is a composer pull; the spec has no Host→View "send me your state"
  // request, so the alias is explicitly null rather than a look-alike method.
  assert.equal(M.MCP_LEGACY_ALIAS['ain:getMandate'], null);
  for (const method of Object.values(M.MCP_LEGACY_ALIAS)) {
    if (method !== null) assert.ok(M.MCP_HOST_METHODS.includes(method), `${method} must be an allowlisted host method`);
  }
});

test('outbound envelopes are refused off-allowlist and shaped per spec', () => {
  assert.equal(M.mcpEnvelopeOut('ui/not-a-method', {}, 1), null);
  assert.deepEqual(M.mcpEnvelopeOut('ui/open-link', { url: 'https://ainumbers.co' }, 3), {
    jsonrpc: '2.0',
    method: 'ui/open-link',
    id: 3,
    params: { url: 'https://ainumbers.co' },
  });
  const msg = M.mcpMessageRequest(5, 'text here');
  assert.deepEqual(msg, {
    jsonrpc: '2.0',
    method: 'ui/message',
    id: 5,
    params: { role: 'user', content: { type: 'text', text: 'text here' } },
  });
});

test('the ui/message receipt names identifiers only, never the mandate body', () => {
  const mandate = {
    mandate_id: 'pm-123',
    tool_id: '320-ap2-mcp-policy-validator',
    execution_hash: 'sha256:abc',
    payload: { secret_input: 'do-not-send-me' },
  };
  const text = M.mcpReceiptText(mandate);
  assert.match(text, /pm-123/);
  assert.match(text, /320-ap2-mcp-policy-validator/);
  assert.match(text, /sha256:abc/);
  assert.doesNotMatch(text, /do-not-send-me/, 'the payload must never reach the host transcript');
  assert.equal(M.mcpReceiptText(null).length > 0, true, 'a missing mandate still yields a safe line');
});
