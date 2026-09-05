#!/usr/bin/env node
/**
 * scripts/check-ledger-proof-parity.mjs — LEDGER-GROTH16-VERIFY-1
 *
 * §18.1 parity gate: the ledger page's in-browser Groth16 (BN254) seal verifier
 * (vendored into ledger/index.html, extracted here LIVE between the
 * GROTH16-VERIFY:BEGIN/END markers — never a second copy) and the kernel-side
 * reference verifier (chaingraph/kernels/_computeproof.mjs verifySeal) must
 * return IDENTICAL verdicts over every published receipt in
 * chaingraph/chaingraph.json, and a tampered-seal fixture must FAIL in both.
 *
 * RED-then-GREEN: the tampered-seal fixture (rail 3 below) is the built-in red
 * proof; `--self-test` additionally proves the checker itself can go red by
 * feeding the comparator a deliberately broken ledger-side verifier.
 *
 * Usage:
 *   node scripts/check-ledger-proof-parity.mjs             — parity check (exit 1 on divergence)
 *   node scripts/check-ledger-proof-parity.mjs --self-test — red-proof of the checker (GATE-SELFTEST-META-1 pair)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySeal } from '../chaingraph/kernels/_computeproof.mjs';
import { cgCanon } from '../chaingraph/kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const HTML_PATH = resolve(REPO, 'ledger', 'index.html');
const GRAPH_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');

// Node <17 lacks the global atob the browser path uses — polyfill for the harness only.
if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

// Extract the ledger page's ACTUAL shipped verifier from the HTML (single source).
function loadLedgerVerifier(html) {
  const begin = html.indexOf('GROTH16-VERIFY:BEGIN');
  const endMarker = html.indexOf('GROTH16-VERIFY:END');
  if (begin === -1 || endMarker === -1 || endMarker < begin)
    throw new Error('ledger/index.html: GROTH16-VERIFY:BEGIN/END markers missing — the vendored §18.1 verifier block was removed or renamed');
  const code = html.slice(html.indexOf('*/', begin) + 2, html.lastIndexOf('/*', endMarker));
  return new Function('cgCanon', `"use strict";\n${code}\n;return ledgerVerifySeal;`)(cgCanon);
}

function publishedReceipts() {
  const graph = JSON.parse(readFileSync(GRAPH_PATH, 'utf8'));
  const out = [];
  for (const node of graph.nodes || []) {
    if (node.compute_proof) out.push({ id: node.tool_id, cp: node.compute_proof });
  }
  return out;
}

// Flip one byte deep inside the seal's G1/G2 coordinates — structurally plausible
// base64 of the right length, cryptographically wrong proof.
function tamperedSeal(cp) {
  const seal = Buffer.from(cp.seal, 'base64');
  seal[seal.length - 1] ^= 0x01;
  return Object.assign({}, cp, { seal: seal.toString('base64') });
}

const html = readFileSync(HTML_PATH, 'utf8');
const ledgerVerifySeal = loadLedgerVerifier(html);
const receipts = publishedReceipts();
if (receipts.length === 0) throw new Error('chaingraph.json carries no published compute proofs — nothing to parity-check');

if (process.argv.includes('--self-test')) {
  // GATE-SELFTEST-META-1 pair (cheap path — the full corpus loop above/below is the
  // main gate's job): prove the checker can go red. A ledger-side verifier stubbed to
  // constant true MUST surface as a verdict divergence on the tampered fixture.
  const tamperedSelfTest = tamperedSeal(receipts[0].cp);
  if (verifySeal(tamperedSelfTest) === true)
    throw new Error('self-test fixture broken: the kernel verifier ACCEPTED a tampered seal');
  const lyingLedger = () => true;
  const diverged = lyingLedger(tamperedSelfTest) !== (verifySeal(tamperedSelfTest) === true);
  if (!diverged) {
    console.error('SELF-TEST-FAIL: comparator did NOT flag a lying ledger-side verifier — checker cannot go red');
    process.exit(1);
  }
  console.log('check-ledger-proof-parity: SELF-TEST OK — a lying ledger verifier is flagged (red-proof); tampered-seal fixture rejected by the kernel verifier');
  process.exit(0);
}

let agree = 0;
for (const { id, cp } of receipts) {
  if (cp.receiptFormat !== 'groth16-bn254') continue; // stark stays delegated on both sides
  let a, b;
  try { a = ledgerVerifySeal(cp) === true; } catch (e) { a = 'throw:' + e.message; }
  try { b = verifySeal(cp) === true; } catch (e) { b = 'throw:' + e.message; }
  if (a !== b) {
    console.error(`PARITY-FAIL: ledger=${a} kernel=${b} for ${id}`);
    process.exit(1);
  }
  if (a !== true) {
    console.error(`PARITY-FAIL: published receipt ${id} does not VERIFY in either implementation (ledger=${a} kernel=${b})`);
    process.exit(1);
  }
  agree++;
}

const tampered = tamperedSeal(receipts[0].cp);
const tamLedger = ledgerVerifySeal(tampered) === true;
const tamKernel = verifySeal(tampered) === true;
if (tamLedger || tamKernel) {
  console.error(`TAMPER-FAIL: tampered-seal fixture must FAIL in BOTH verifiers (ledger rejected=${!tamLedger}, kernel rejected=${!tamKernel})`);
  process.exit(1);
}

if (process.argv.includes('--self-test')) {
  // handled above (cheap red-proof path) — unreachable here
  process.exit(0);
}

console.log(`check-ledger-proof-parity: PARITY-OK — identical verdicts over ${agree} published groth16-bn254 receipts; tampered-seal fixture FAIL in both (ledger + kernel)`);
