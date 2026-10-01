#!/usr/bin/env node
/**
 * scripts/ledger-dedup.test.mjs
 * Gate: the AIN ledger live channel (LEDGER-BRIDGE-LIVE-1, B3/B4/B5).
 *
 * ANCHORED TO SHIPPED SOURCE (TAMPER-GATE-SHIPPED-SOURCE-1). This file carries
 * NO copy of the de-dup rule, the envelope constructors or the origin guard. It
 * brace-extracts the REAL routines out of `ledger/index.html` and out of the
 * master snippet `scripts/ain-bridge-v1.snippet.html` through the shared helper
 * `scripts/lib-extract-shipped.mjs`, so a regression in either shipped file reds
 * this gate instead of leaving a green replica behind.
 *
 * What it pins:
 *   B4  de-dup: a receipt whose execution_hash is already in the store decides
 *       'duplicate', a new one decides 'added', a non-artifact decides
 *       'rejected'. One decision function is shared by the fragment leg and the
 *       channel leg, so the two ingress paths cannot drift apart.
 *   B3  origin guard: the snippet returns a channel target ONLY on a path-form
 *       origin. `ledger.ainumbers.co` and every foreign origin return null, so
 *       the snippet never posts on the channel when the origins differ.
 *   B5  envelope: the snippet's notification satisfies the ledger's validator
 *       and the ledger's ack satisfies the snippet's validator, both in the
 *       JSON-RPC 2.0 `ui/` dialect. Neither side accepts the other side's
 *       message as its own, so an ack can never loop back in as a receipt.
 *   The message-schema comment block is byte-identical in the two files.
 *
 * SELF-PROVING (SO #34c: absence is not a pass). Every run also TAMPERS each
 * shipped source in memory (disarms the de-dup comparison; disarms the origin
 * guard) and requires the matching suite to go red. If extraction ever goes
 * blind or the assertions stop discriminating, that check fails.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShipped, mutateSource } from './lib-extract-shipped.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const LEDGER_REL = 'ledger/index.html';
const SNIPPET_REL = 'scripts/ain-bridge-v1.snippet.html';

const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
const LEDGER_SRC = read(LEDGER_REL);
const SNIPPET_SRC = read(SNIPPET_REL);

// The extraction contract: exactly the shipped symbols the channel is made of.
const LEDGER_SPEC = {
  file: LEDGER_REL,
  decls: ['ARTIFACT_REQUIRED'],
  fns: ['isArtifact', 'extractArtifact', 'isLedgerReceiptNotification', 'ledgerReceiptAck', 'dedupDecision'],
};
const SNIPPET_SPEC = {
  file: SNIPPET_REL,
  fns: ['ainLedgerTarget', 'ainLedgerReceipt', 'ainIsLedgerAck'],
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const ARTIFACT = {
  '@context': 'https://ainumbers.co/chaingraph/standard/v0.4',
  chaingraph_version: '0.4.0',
  execution_hash: HASH_A,
  chain: 'mortgage-compliance-preflight',
  tool_id: 'chaingraph/chains/mortgage-compliance-preflight',
  mandate_type: 'mortgage_compliance',
  policy_parameters: { loan_amount: 425000 },
  output_payload: { conforming: true },
  audit_signature: { server_side_executed: true, zero_pii_verified: true, deterministic_run: true },
};

// A Policy Mandate is NOT an OCG artifact: the channel must reject it, exactly
// as the fragment leg does, rather than growing a second accepted payload shape.
const MANDATE = { mandate_id: 'm-1', tool_id: '320-ap2-mcp-policy-validator', payload: { a: 1 } };

const clone = (o) => JSON.parse(JSON.stringify(o));
const STORED = { execution_hash: HASH_A, artifact: ARTIFACT, added_at: 1, source: 'link', chain_name: '' };

// ── The suites, run against whichever build they are handed ───────────────────
// Each returns a list of failure messages (empty = suite passed).

function runDedupSuite(L) {
  const fails = [];
  const check = (name, fn) => { try { fn(); } catch (e) { fails.push(name + ': ' + e.message); } };
  const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

  check('B4 new receipt decides added', () => {
    const d = L.dedupDecision(clone(ARTIFACT), undefined);
    ok(d.status === 'added', 'expected added, got ' + d.status);
    ok(d.execution_hash === HASH_A, 'expected the receipt execution_hash on the decision');
  });

  check('B4 receipt already in the store decides duplicate', () => {
    const d = L.dedupDecision(clone(ARTIFACT), STORED);
    ok(d.status === 'duplicate', 'expected duplicate, got ' + d.status);
    ok(d.execution_hash === HASH_A, 'a duplicate still names the row it resolved to');
  });

  check('B4 a different execution_hash is not a duplicate', () => {
    const other = clone(ARTIFACT);
    other.execution_hash = HASH_B;
    ok(L.dedupDecision(other, undefined).status === 'added', 'a second distinct receipt is a new row');
  });

  check('B4 a non-artifact decides rejected', () => {
    for (const bad of [null, undefined, 42, 'x', {}, clone(MANDATE)]) {
      const d = L.dedupDecision(bad, undefined);
      ok(d.status === 'rejected', 'expected rejected for ' + JSON.stringify(bad) + ', got ' + d.status);
      ok(d.execution_hash === null, 'a rejected receipt names no row');
    }
  });

  check('B4 a receipt missing a required field decides rejected', () => {
    const broken = clone(ARTIFACT);
    delete broken.audit_signature;
    ok(L.dedupDecision(broken, undefined).status === 'rejected', 'required fields are still required on the channel');
  });

  check('B3 the channel leg unwraps a container the same way the fragment leg does', () => {
    const wrapped = { composite_artifact: clone(ARTIFACT) };
    const a = L.extractArtifact(wrapped);
    ok(a !== null, 'extractArtifact must unwrap the run_chain response wrapper');
    ok(L.dedupDecision(a, undefined).status === 'added', 'the unwrapped artifact is accepted');
    ok(L.extractArtifact(clone(MANDATE)) === null, 'a mandate yields no artifact');
  });

  return fails;
}

function runOriginSuite(S) {
  const fails = [];
  const check = (name, fn) => { try { fn(); } catch (e) { fails.push(name + ': ' + e.message); } };
  const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

  check('B3 the path form gets a channel target', () => {
    ok(S.ainLedgerTarget('https://ainumbers.co') === 'https://ainumbers.co/ledger/', 'path-form origin must resolve');
    ok(S.ainLedgerTarget('http://localhost:8080') === 'http://localhost:8080/ledger/', 'local dev must resolve');
  });

  check('B3 the subdomain form gets no channel target', () => {
    ok(S.ainLedgerTarget('https://ledger.ainumbers.co') === null, 'the subdomain form keeps fragment-only intake');
  });

  check('B3 a foreign origin gets no channel target', () => {
    for (const o of ['https://evil.example', 'https://apexlogics.org', 'https://ainumbers.co.evil.example', 'https://sub.ainumbers.co']) {
      ok(S.ainLedgerTarget(o) === null, o + ' must not resolve to a channel target');
    }
  });

  check('B3 a malformed or non-http origin gets no channel target', () => {
    for (const o of [null, undefined, '', 42, 'not a url', 'file:///tmp', 'javascript:alert(1)']) {
      ok(S.ainLedgerTarget(o) === null, JSON.stringify(o) + ' must not resolve to a channel target');
    }
  });

  return fails;
}

function runEnvelopeSuite(L, S) {
  const fails = [];
  const check = (name, fn) => { try { fn(); } catch (e) { fails.push(name + ': ' + e.message); } };
  const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

  check('the snippet notification satisfies the ledger validator', () => {
    const msg = S.ainLedgerReceipt(clone(ARTIFACT));
    ok(msg.jsonrpc === '2.0', 'JSON-RPC 2.0 envelope');
    ok(msg.method === 'ui/notifications/receipt', 'page to ledger method');
    ok(!('id' in msg), 'a notification carries no id');
    ok(L.isLedgerReceiptNotification(msg) === true, 'the ledger must accept the snippet envelope');
  });

  check('the ledger ack satisfies the snippet validator', () => {
    for (const status of ['added', 'duplicate', 'rejected']) {
      const ack = L.ledgerReceiptAck(HASH_A, status);
      ok(ack.jsonrpc === '2.0', 'JSON-RPC 2.0 envelope');
      ok(ack.method === 'ui/notifications/receipt-ack', 'ledger to page method');
      ok(!('id' in ack), 'a notification carries no id');
      ok(S.ainIsLedgerAck(ack) === true, 'the snippet must accept the ledger ack for status ' + status);
    }
  });

  check('neither side accepts the other side message as its own', () => {
    ok(S.ainIsLedgerAck(S.ainLedgerReceipt(clone(ARTIFACT))) === false, 'a receipt is not an ack');
    ok(L.isLedgerReceiptNotification(L.ledgerReceiptAck(HASH_A, 'added')) === false, 'an ack is not a receipt, so it cannot loop back in');
  });

  check('a malformed envelope is refused by both validators', () => {
    const bad = [
      null, undefined, 42, 'x', {},
      { jsonrpc: '1.0', method: 'ui/notifications/receipt', params: { v: 1, receipt: {} } },
      { jsonrpc: '2.0', method: 'ui/notifications/other', params: { v: 1, receipt: {} } },
      { jsonrpc: '2.0', method: 'ui/notifications/receipt', params: { v: 2, receipt: {} } },
      { jsonrpc: '2.0', method: 'ui/notifications/receipt', params: { v: 1 } },
      { jsonrpc: '2.0', method: 'ui/notifications/receipt' },
    ];
    for (const m of bad) ok(L.isLedgerReceiptNotification(m) === false, 'ledger must refuse ' + JSON.stringify(m));
    const badAcks = [
      null, 42, {},
      { jsonrpc: '2.0', method: 'ui/notifications/receipt-ack', params: { v: 1, execution_hash: HASH_A, status: 'maybe' } },
      { jsonrpc: '2.0', method: 'ui/notifications/receipt-ack', params: { v: 1, status: 'added' } },
      { jsonrpc: '2.0', method: 'ui/notifications/receipt-ack', params: { v: 2, execution_hash: HASH_A, status: 'added' } },
    ];
    for (const m of badAcks) ok(S.ainIsLedgerAck(m) === false, 'snippet must refuse ' + JSON.stringify(m));
  });

  check('the ack names execution_hash, never record_hash', () => {
    const ack = L.ledgerReceiptAck(HASH_A, 'duplicate');
    ok('execution_hash' in ack.params, 'the ack carries execution_hash');
    ok(!('record_hash' in ack.params), 'record_hash is the 22.8.4 escalation-record hash and must not be reused here');
  });

  return fails;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const LEDGER = buildShipped(LEDGER_SRC, LEDGER_SPEC);
const SNIPPET = buildShipped(SNIPPET_SRC, SNIPPET_SPEC);

test('B4 de-dup, against the SHIPPED ledger', () => {
  assert.deepEqual(runDedupSuite(LEDGER), []);
});

test('B3 origin guard, against the SHIPPED master snippet', () => {
  assert.deepEqual(runOriginSuite(SNIPPET), []);
});

test('B3/B5 envelope, across BOTH shipped sources', () => {
  assert.deepEqual(runEnvelopeSuite(LEDGER, SNIPPET), []);
});

test('the message-schema block is identical in the ledger and the snippet', () => {
  const grab = (src, rel) => {
    const start = src.indexOf('AIN LEDGER LIVE CHANNEL v1: MESSAGE SCHEMA');
    assert.ok(start >= 0, 'schema block missing from ' + rel);
    const end = src.indexOf('*/', start);
    assert.ok(end > start, 'unterminated schema block in ' + rel);
    // Normalize leading indentation only: the two files nest the block differently.
    return src.slice(start, end).split('\n').map((l) => l.trim()).join('\n').trim();
  };
  assert.equal(
    grab(LEDGER_SRC, LEDGER_REL),
    grab(SNIPPET_SRC, SNIPPET_REL),
    'the channel message schema must read identically in both files',
  );
});

test('SELF-PROOF: disarming the shipped de-dup comparison reds the B4 suite', () => {
  const tampered = mutateSource(
    LEDGER_SRC,
    LEDGER_REL,
    "return { status: existing ? 'duplicate' : 'added', execution_hash: artifact.execution_hash };",
    "return { status: 'added', execution_hash: artifact.execution_hash };",
  );
  const fails = runDedupSuite(buildShipped(tampered, LEDGER_SPEC));
  assert.ok(fails.length > 0, 'a ledger that never de-dups must red this gate');
});

test('SELF-PROOF: disarming the shipped origin guard reds the B3 suite', () => {
  const tampered = mutateSource(
    SNIPPET_SRC,
    SNIPPET_REL,
    "if(h!=='ainumbers.co'&&h!=='localhost'&&h!=='127.0.0.1')return null;",
    'if(false)return null;',
  );
  const fails = runOriginSuite(buildShipped(tampered, SNIPPET_SPEC));
  assert.ok(fails.length > 0, 'a snippet that posts on any origin must red this gate');
});
