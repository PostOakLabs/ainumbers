#!/usr/bin/env node
/**
 * check-deeplink-contract.test.mjs — self-test pairing for
 * scripts/check-deeplink-contract.mjs (GATE-SELFTEST-META-1; TOOLPAGE-DEEPLINK-1).
 *
 * Controls, RED before GREEN where a control claims detection:
 *   1. Codec parity: the harness-side fragment builder round-trips through the
 *      page reader's decode path (gzip -> b64url -> gzip -> JSON), and a flipped
 *      payload byte decodes to DIFFERENT JSON (tamper visibility).
 *   2. Reader rejection controls on a real registered page (art-118, the row's
 *      workthrough page): a corrupted golden_hash fixture is RED (hash mismatch
 *      detected), the intact fixture is GREEN, and the proof exits 0 only when
 *      both verdicts hold.
 *   3. Reader size cap: a fragment over the 30 KB budget is rejected by the
 *      reader's budget check, never truncated (asserted via the reader source
 *      constant compiled from chaingraph/_page-chrome.mjs).
 *
 * Usage: node scripts/check-deeplink-contract.test.mjs   (exit 0 = all controls pass)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeeplinkScript, DEEPLINK_MARKER, DEEPLINK_BUDGET_BYTES } from '../chaingraph/_page-chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PAGE = 'chaingraph/art-118-fsma204-cte-validator.html';

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + label);
  if (!ok) failures++;
};

/* 1. Codec round-trip + tamper visibility (harness side vs reader side). */
async function codecControls() {
  const obj = { cte_type: 'shipping', kdes: { traceability_lot_code: 'TLC-1' }, ftl_food: 'spinach' };
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const cs = new CompressionStream('gzip');
  const w = cs.writable.getWriter();
  w.write(bytes); w.close();
  const chunks = [];
  const reader = cs.readable.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
  await reader.closed.catch(() => {}); // drain the stream so node exits cleanly
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total); let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  let s = '';
  for (let i = 0; i < out.length; i++) s += String.fromCharCode(out[i]);
  const b64 = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // Decode through the READER's own emitted codec, in a vm context.
  const vm = await import('node:vm');
  const src = buildDeeplinkScript('{}', 'run');
  const sb = { console, DecompressionStream, TextDecoder, atob, btoa };
  sb.window = sb;
  const ctx = vm.createContext(sb);
  // Expose just the codec functions by evaluating the IIFE's inner helpers via a probe.
  const codecSrc = src.slice(src.indexOf('function b64uDec'), src.indexOf('function fail'));
  new vm.Script(codecSrc + '\nwindow.__dec = async function (p) { return JSON.parse(await gunzip(b64uDec(p))); };').runInContext(ctx);
  const back = await sb.__dec(b64);
  check('codec round-trip: harness-built fragment decodes to the exact policy_parameters', JSON.stringify(back) === JSON.stringify(obj));

  const flipped = b64.slice(0, 4) + (b64[4] === 'A' ? 'B' : 'A') + b64.slice(5);
  // Decode the tampered payload with zlib (no web-stream error events to babysit);
  // parity with the reader's DecompressionStream path is already proven above.
  let tampered = null;
  try {
    const z = await import('node:zlib');
    const p = flipped.replace(/-/g, '+').replace(/_/g, '/');
    tampered = z.gunzipSync(Buffer.from(p + '='.repeat((4 - p.length % 4) % 4), 'base64')).toString('utf8');
  } catch (e) { tampered = '<decode error: ' + e.message + '>'; }
  check('tamper visibility: a flipped payload byte never decodes to the same JSON', tampered !== JSON.stringify(obj));
}

/* 3. Budget constant carried from the ledger cap. */
function budgetControls() {
  const src = buildDeeplinkScript('{}', 'run');
  check('reader carries the 30000-byte budget (ledger FRAGMENT_BUDGET_BYTES parity)', src.includes('var BUDGET = ' + DEEPLINK_BUDGET_BYTES));
  check('reader is marker-guarded', src.startsWith(DEEPLINK_MARKER));
  check('page carries the generated reader', readFileSync(join(REPO, PAGE), 'utf8').includes(DEEPLINK_MARKER));
}

/* 2. RED-then-GREEN on one real page (fast --only form of the gate's proof). */
function redGreenControl() {
  const out = execFileSync(process.execPath, [join(HERE, 'check-deeplink-contract.mjs'), '--only', 'art-118-fsma204-cte-validator', '--red-green'], { encoding: 'utf8', cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  const red = /RED verdict: \d+ raw problem/.exec(out);
  const green = /0 NOT in baseline/.exec(out);
  check('RED-then-GREEN: corrupted fixture hash is detected, intact estate passes', Boolean(red && green));
}

await codecControls();
budgetControls();
redGreenControl();

if (failures) {
  console.error(`check-deeplink-contract.test: ${failures} control(s) FAILED`);
  process.exit(1);
}
console.log('check-deeplink-contract.test: PASS');
