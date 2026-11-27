#!/usr/bin/env node
/**
 * scripts/check-ledger-proof-parity.mjs — LEDGER-GROTH16-VERIFY-1 (three-way since RISC0-310-R4-DUAL-VERIFIER-1)
 *
 * §18.1 parity gate: the ledger page's in-browser Groth16 (BN254) seal verifier
 * (vendored into ledger/index.html, extracted here LIVE between the
 * GROTH16-VERIFY:BEGIN/END markers — never a second copy) and the kernel-side
 * reference verifier (chaingraph/kernels/_computeproof.mjs verifySealReport)
 * must return IDENTICAL three-way verdicts ('current' | 'legacy' | 'invalid')
 * over every published receipt in chaingraph/chaingraph.json, and a
 * tampered-seal fixture must read 'invalid' in both.
 *
 * Legacy receipts (risc0 3.0.x parameter set) are "not yet re-sealed", never
 * evidence: they are allowed only up to LEGACY_CEILING, which can only go DOWN
 * (lower it in a separate PR after a re-seal batch's rollback window, never in
 * the batch itself). An 'invalid' published receipt is red, as before.
 *
 * RED-then-GREEN: the tampered-seal fixture is the built-in red proof;
 * `--self-test` additionally proves the checker itself can go red (a lying
 * ledger-side verifier, an invalid published receipt, and a legacy count above
 * the ceiling are each flagged).
 *
 * Usage:
 *   node scripts/check-ledger-proof-parity.mjs             — parity check (exit 1 on divergence)
 *   node scripts/check-ledger-proof-parity.mjs --self-test — red-proof of the checker (GATE-SELFTEST-META-1 pair)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySealReport } from '../chaingraph/kernels/_computeproof.mjs';
import { cgCanon, jcsStringify } from '../chaingraph/kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const HTML_PATH = resolve(REPO, 'ledger', 'index.html');
const GRAPH_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');

// Down-only ceiling on published receipts that verify only under the legacy (risc0 3.0.x) set.
// 730 = every receipt published before the risc0 3.1.0 re-seal began.
export const LEGACY_CEILING = 730;

// Node <17 lacks the global atob the browser path uses — polyfill for the harness only.
if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

// Extract the ledger page's ACTUAL shipped verifier from the HTML (single source).
// JCS-CANON-PAGES-1: the shipped block's journal bytes serialize through the page's
// __ocgJcs (the SSOT line, byte-equivalent to _hash.mjs jcsStringify), so the extraction
// injects it exactly like the pre-existing cgCanon parameter — the gate-side identity
// for the block's serializer is the core one, which is the equivalence under test.
function loadLedgerVerifier(html) {
  const begin = html.indexOf('GROTH16-VERIFY:BEGIN');
  const endMarker = html.indexOf('GROTH16-VERIFY:END');
  if (begin === -1 || endMarker === -1 || endMarker < begin)
    throw new Error('ledger/index.html: GROTH16-VERIFY:BEGIN/END markers missing — the vendored §18.1 verifier block was removed or renamed');
  const code = html.slice(html.indexOf('*/', begin) + 2, html.lastIndexOf('/*', endMarker));
  const api = new Function('cgCanon', '__ocgJcs', `"use strict";\n${code}\n;return { ledgerVerifySeal, ledgerVerifySealReport: typeof ledgerVerifySealReport === 'function' ? ledgerVerifySealReport : null };`)(cgCanon, jcsStringify);
  if (!api.ledgerVerifySealReport)
    throw new Error('ledger/index.html: ledgerVerifySealReport missing from the GROTH16-VERIFY block — the ledger copy has no three-way verdict');
  return api;
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

const verdictOf = (fn, cp) => { try { return fn(cp); } catch (e) { return 'throw:' + e.message; } };

// Pure comparator over already-loaded inputs: returns { failures[], counts }.
export function evaluateParity(receipts, ledgerReport, kernelReport, ceiling = LEGACY_CEILING) {
  const failures = [];
  const counts = { current: 0, legacy: 0, compared: 0 };
  for (const { id, cp } of receipts) {
    if (cp.receiptFormat !== 'groth16-bn254') continue; // stark stays delegated on both sides
    const a = verdictOf(ledgerReport, cp);
    const b = verdictOf(kernelReport, cp);
    counts.compared++;
    if (a !== b) { failures.push(`PARITY-FAIL: ledger=${a} kernel=${b} for ${id}`); continue; }
    if (a === 'current') counts.current++;
    else if (a === 'legacy') counts.legacy++;
    else failures.push(`PARITY-FAIL: published receipt ${id} does not VERIFY in either implementation (ledger=${a} kernel=${b})`);
  }
  if (counts.legacy > ceiling) {
    failures.push(`LEGACY-CEILING-FAIL: ${counts.legacy} published receipts verify only under the legacy (risc0 3.0.x) set, ceiling is ${ceiling} (down only; a new receipt must be sealed under the current set)`);
  }
  return { failures, counts };
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const html = readFileSync(HTML_PATH, 'utf8');
  const { ledgerVerifySealReport } = loadLedgerVerifier(html);
  const receipts = publishedReceipts();
  if (receipts.length === 0) throw new Error('chaingraph.json carries no published compute proofs — nothing to parity-check');

  if (process.argv.includes('--self-test')) {
    // GATE-SELFTEST-META-1 pair (cheap path — the full corpus loop below is the main gate's job):
    // prove the checker can go red, on one real receipt.
    const sample = receipts.find((r) => r.cp.receiptFormat === 'groth16-bn254');
    const tamperedSelfTest = tamperedSeal(sample.cp);
    if (verifySealReport(tamperedSelfTest) !== 'invalid')
      throw new Error('self-test fixture broken: the kernel verifier ACCEPTED a tampered seal');
    const one = [{ id: sample.id + ' (tampered)', cp: tamperedSelfTest }];
    // (1) a ledger-side verifier stubbed to a constant pass MUST surface as a divergence.
    const lying = evaluateParity(one, () => 'current', verifySealReport);
    // (2) both sides agreeing on 'invalid' for a published receipt MUST be red.
    const invalid = evaluateParity(one, () => 'invalid', () => 'invalid');
    // (3) a legacy count above the ceiling MUST be red, and at the ceiling MUST be green.
    const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `stub-${i}`, cp: { receiptFormat: 'groth16-bn254' } }));
    const over = evaluateParity(many(3), () => 'legacy', () => 'legacy', 2);
    const at = evaluateParity(many(2), () => 'legacy', () => 'legacy', 2);
    const bad = [];
    if (!lying.failures.some((f) => f.startsWith('PARITY-FAIL: ledger=current'))) bad.push('a lying ledger verifier was NOT flagged');
    if (!invalid.failures.some((f) => f.includes('does not VERIFY'))) bad.push('an invalid published receipt was NOT flagged');
    if (!over.failures.some((f) => f.startsWith('LEGACY-CEILING-FAIL'))) bad.push('a legacy count above the ceiling was NOT flagged');
    if (at.failures.length) bad.push('a legacy count AT the ceiling was flagged');
    if (bad.length) {
      for (const b of bad) console.error('SELF-TEST-FAIL: ' + b + ' — checker cannot go red');
      process.exit(1);
    }
    console.log('check-ledger-proof-parity: SELF-TEST OK — a lying ledger verifier, an invalid published receipt and a legacy count above the ceiling are each flagged (red-proof); tampered-seal fixture rejected by the kernel verifier');
    process.exit(0);
  }

  const { failures, counts } = evaluateParity(receipts, ledgerVerifySealReport, verifySealReport);
  if (failures.length) {
    for (const f of failures) console.error(f);
    process.exit(1);
  }

  const tampered = tamperedSeal(receipts[0].cp);
  const tamLedger = ledgerVerifySealReport(tampered);
  const tamKernel = verdictOf(verifySealReport, tampered);
  if (tamLedger !== 'invalid' || tamKernel !== 'invalid') {
    console.error(`TAMPER-FAIL: tampered-seal fixture must read invalid in BOTH verifiers (ledger=${tamLedger}, kernel=${tamKernel})`);
    process.exit(1);
  }

  console.log(`check-ledger-proof-parity: PARITY-OK — identical verdicts over ${counts.compared} published groth16-bn254 receipts (current ${counts.current}, legacy ${counts.legacy} of ceiling ${LEGACY_CEILING}); tampered-seal fixture invalid in both (ledger + kernel)`);
}
