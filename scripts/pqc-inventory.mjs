// pqc-inventory.mjs — PQC-INVENTORY-1: what our own corpus signs/proves with, classified against the
// quantum threat. Read-only measurement. Changes nothing, moves no execution_hash, re-signs nothing.
//
// Contract: PQC-READINESS-BUILD-SPEC.md. Companion doc: research/PQC-INVENTORY-1-2026-07-30.md.
//
// SCOPE: this repo (the site, `PostOakLabs/ainumbers`) only. The estate spans four repos
// (feedback-repo-scoped-search-false-absence) — this script does not claim to cover mcp-apps-poc/, helm/,
// or anchor-suite/.
//
// THREE CORRECTIONS THIS SCRIPT RESPECTS (PQC-READINESS-BUILD-SPEC.md §1):
//   1. Shor breaks SIGNATURES and PAIRINGS (Ed25519; BN254 and groth16 proofs over it). At-risk.
//   2. SHA-256/SHA3 are NOT quantum-broken (Grover only gives a quadratic speedup, ~128-bit collision
//      resistance remains, which NIST guidance still accepts). Never flagged at-risk here.
//   3. "Harvest now, decrypt later" does not apply (we encrypt nothing). The real exposure is signature
//      FORGERY after the algorithm falls — relevant because of multi-year evidence retention.
//
// Output is a named list of surfaces + algorithms, classified and split into REACHABLE (what a produced
// artifact is actually signed/proved with) vs PRESENT-ONLY (exists in code, nothing calls it). No coverage
// percentage, no readiness score (PQC-READINESS-BUILD-SPEC.md §2.4) — a score is a claim we'd own forever.
//
// Usage:
//   node scripts/pqc-inventory.mjs            human-readable report to stdout, exit 0
//   node scripts/pqc-inventory.mjs --json      machine-readable report to stdout, exit 0

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const CLASS = { AT_RISK: 'at-risk', ACCEPTABLE: 'acceptable', PQC: 'pqc' };

function safeRead(relPath) {
  try { return readFileSync(resolve(REPO, relPath), 'utf8'); } catch { return null; }
}

function listFiles(relDir, suffix) {
  try { return readdirSync(resolve(REPO, relDir)).filter(f => f.endsWith(suffix)); }
  catch { return []; }
}

// ── §2.2 hypothesis: does chaingraph/verify.html reach the ML-DSA (§PQC-1) code path in _proof.mjs? ──
function traceVerifyHtml() {
  const src = safeRead('chaingraph/verify.html');
  if (src === null) return { traced: false, note: 'chaingraph/verify.html not found' };

  const importsProofMjs = /_proof\.mjs/.test(src);
  const mentionsMldsa = /mldsa|ml[-_]dsa|dilithium/i.test(src);
  const ed25519ImportKey = src.match(/crypto\.subtle\.importKey\([^)]*\{[^}]*name:\s*'Ed25519'/g) || [];
  const ed25519SignVerify = src.match(/crypto\.subtle\.(sign|verify|generateKey)\(\s*(?:\{\s*name:\s*)?'Ed25519'/g) || [];
  const sha256Digest = src.match(/crypto\.subtle\.digest\('SHA-256'/g) || [];

  return {
    traced: true,
    imports_proof_mjs: importsProofMjs,
    mentions_mldsa_or_dilithium: mentionsMldsa,
    ed25519_importKey_calls: ed25519ImportKey.length,
    ed25519_sign_verify_generate_calls: ed25519SignVerify.length,
    sha256_digest_calls: sha256Digest.length,
    verdict: (!importsProofMjs && !mentionsMldsa && ed25519SignVerify.length > 0)
      ? 'CONFIRMED — verify.html signs/verifies with WebCrypto Ed25519 + SHA-256 only; it does not import _proof.mjs and contains no ML-DSA/Dilithium reference.'
      : 'REFUTED-OR-UNCLEAR — verify.html shows an ML-DSA-related reference; re-check manually.',
  };
}

// ── Is the ML-DSA (§PQC-1) signer in _proof.mjs called from anywhere outside itself + its own unit test? ──
function traceMldsaCallers() {
  const callNames = ['mldsaSign', 'mldsaVerify', 'mldsaKeygen'];
  const searchDirs = [
    { dir: 'scripts', suffix: '.mjs' },
    { dir: 'chaingraph', suffix: '.html' },
    { dir: 'chaingraph/kernels', suffix: '.mjs' },
  ];
  const callers = [];
  for (const { dir, suffix } of searchDirs) {
    for (const f of listFiles(dir, suffix)) {
      const relPath = join(dir, f);
      if (relPath.replace(/\\/g, '/') === 'chaingraph/kernels/_proof.mjs') continue; // definition site, not a caller
      if (relPath.replace(/\\/g, '/') === 'chaingraph/kernels/proof-binding.test.mjs') continue; // unit test, not production
      const src = safeRead(relPath);
      if (src && callNames.some(name => src.includes(name + '('))) callers.push(relPath);
    }
  }
  return callers;
}

// ── Every art-*.html page inlines a byte-pinned copy of _proof.mjs's Ed25519 (eddsa-jcs-2022) signer ──
function countArtPagesWithProofPin() {
  const files = listFiles('chaingraph', '.html').filter(f => /^art-\d+-/.test(f));
  let withPin = 0;
  const withoutPin = [];
  for (const f of files) {
    const src = safeRead(join('chaingraph', f));
    if (src && /OCG-PROOF v1.*eddsa-jcs-2022/.test(src)) withPin++;
    else withoutPin.push(f);
  }
  return { totalArtPages: files.length, withEddsaProofPin: withPin, withoutProofPin: withoutPin };
}

// ── Every gpu:true kernel's compute-proof fixture: what zkVM receipt format is actually produced ──
function inventoryComputeProofReceipts() {
  const dir = 'chaingraph/kernels/fixtures/compute-proof';
  const files = listFiles(dir, '.receipt.json');
  const formats = {};
  for (const f of files) {
    const src = safeRead(join(dir, f));
    if (!src) continue;
    let json;
    try { json = JSON.parse(src); } catch { continue; }
    const fmt = json.receiptFormat || 'UNKNOWN';
    formats[fmt] = (formats[fmt] || 0) + 1;
  }
  return { totalReceiptFixtures: files.length, byFormat: formats };
}

function buildInventory() {
  const verifyTrace = traceVerifyHtml();
  const mldsaCallers = traceMldsaCallers();
  const artPagePin = countArtPagesWithProofPin();
  const receipts = inventoryComputeProofReceipts();

  const surfaces = [
    {
      surface: 'chaingraph/kernels/_proof.mjs — W3C Data Integrity proof signer (eddsa-jcs-2022)',
      algorithm: 'Ed25519',
      classification: CLASS.AT_RISK,
      reachable: true,
      note: 'Vendored/native WebCrypto Ed25519. Byte-pinned into every art-*.html page (see below) and verified by chaingraph/verify.html. This IS the production audit_signature path.',
    },
    {
      surface: `${artPagePin.totalArtPages} chaingraph/art-*.html pages`,
      algorithm: 'Ed25519 (eddsa-jcs-2022 proof pin, byte-identical to _proof.mjs)',
      classification: CLASS.AT_RISK,
      reachable: true,
      note: `${artPagePin.withEddsaProofPin} of ${artPagePin.totalArtPages} carry the pin` + (artPagePin.withoutProofPin.length ? `; ${artPagePin.withoutProofPin.length} do not (see withoutProofPin list)` : ' (all of them)'),
    },
    {
      surface: 'chaingraph/verify.html — public artifact verifier, audit_signature check',
      algorithm: 'Ed25519 (WebCrypto native)',
      classification: CLASS.AT_RISK,
      reachable: true,
      note: 'Public-facing verifier only implements Ed25519 signature verification (its execution_hash check is the separate SHA-256 entry below). Trace below.',
    },
    {
      surface: 'chaingraph/verify.html + chaingraph/kernels/_hash.mjs — execution_hash',
      algorithm: 'SHA-256',
      classification: CLASS.ACCEPTABLE,
      reachable: true,
      note: 'Grover reduces SHA-256 to ~128-bit collision resistance, still acceptable under current NIST guidance. NOT flagged at-risk (PQC-READINESS-BUILD-SPEC.md §1.2).',
    },
    {
      surface: `${receipts.totalReceiptFixtures} chaingraph/kernels/fixtures/compute-proof/*.receipt.json (§18 zkVM compute-integrity receipts, gpu:true kernels, risc0)`,
      algorithm: Object.keys(receipts.byFormat).join(', ') || 'none found',
      classification: CLASS.AT_RISK,
      reachable: true,
      note: `receiptFormat distribution: ${JSON.stringify(receipts.byFormat)}. groth16-bn254 is a pairing-based proof system over the BN254 curve — Shor-breakable per §1.1.`,
    },
    {
      surface: 'chaingraph/kernels/_proof.mjs — §PQC-1 hybrid ML-DSA-65 Data Integrity proof (vendored FIPS 204 / @noble/post-quantum)',
      algorithm: 'ML-DSA-65 (CRYSTALS-Dilithium, FIPS 204)',
      classification: CLASS.PQC,
      reachable: mldsaCallers.length > 0,
      note: mldsaCallers.length > 0
        ? `Called from: ${mldsaCallers.join(', ')}`
        : 'PRESENT IN CODE, NOT REACHABLE — no production caller found outside _proof.mjs itself and its own unit test (chaingraph/kernels/proof-binding.test.mjs). No produced artifact is signed with this. This is the §2.2 hypothesis, CONFIRMED.',
    },
    {
      surface: 'chaingraph/kernels/_proof.mjs — SHA3/SHAKE256 (internal to the ML-DSA implementation)',
      algorithm: 'SHA3-256 / SHAKE256',
      classification: CLASS.ACCEPTABLE,
      reachable: mldsaCallers.length > 0,
      note: 'Hash, not signature — not flagged at-risk regardless of reachability (PQC-READINESS-BUILD-SPEC.md §1.2). Reachability inherited from the ML-DSA path above: since nothing calls the ML-DSA signer, this internal SHA3 usage is also never exercised in a produced artifact.',
    },
  ];

  return {
    scope: 'site repo only (PostOakLabs/ainumbers, this checkout) — NOT estate-wide; mcp-apps-poc/, helm/, anchor-suite/ are separate repos and out of scope for v1',
    hypothesis_2_2: verifyTrace,
    mldsa_production_callers: mldsaCallers,
    art_page_proof_pin: artPagePin,
    compute_proof_receipts: receipts,
    surfaces,
  };
}

function printHuman(inv) {
  console.log('PQC INVENTORY — site repo (ainumbers)');
  console.log('Scope: ' + inv.scope);
  console.log('');
  console.log('§2.2 HYPOTHESIS TRACE (does verify.html reach the ML-DSA path in _proof.mjs?)');
  console.log('  ' + inv.hypothesis_2_2.verdict);
  console.log(`  imports_proof_mjs=${inv.hypothesis_2_2.imports_proof_mjs}  mentions_mldsa=${inv.hypothesis_2_2.mentions_mldsa_or_dilithium}  ed25519_calls=${inv.hypothesis_2_2.ed25519_sign_verify_generate_calls}  sha256_calls=${inv.hypothesis_2_2.sha256_digest_calls}`);
  console.log('');
  console.log('SURFACES (named, not a percentage):');
  for (const s of inv.surfaces) {
    console.log(`  [${s.classification.toUpperCase()}${s.reachable ? ', REACHABLE' : ', PRESENT-ONLY'}] ${s.surface}`);
    console.log(`    algorithm: ${s.algorithm}`);
    console.log(`    ${s.note}`);
  }
  console.log('');
  console.log('ML-DSA production callers found: ' + (inv.mldsa_production_callers.length ? inv.mldsa_production_callers.join(', ') : 'NONE'));
}

const inv = buildInventory();
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(inv, null, 2));
} else {
  printHuman(inv);
}

export { buildInventory };
