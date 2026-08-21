// art-652-verify-receipt — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:2662a63bf15814b04ad4a314cabd6b1b4f47260c916cc58df3ae59bbd24eedf9
// spec: research/EVIDENCE-ENVELOPE-V01-RATIFIED-2026-08-20.md (MCP-VERIFY-RECEIPT-TOOL-1)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-652-verify-receipt.proptest.mjs
//
// Checks: fixture-oracle gate (P0, includes the tamper matrix as golden vectors already —
// see the kernel's own fixtures for payload/signature/kid/prev-link tamper cases), totality
// over hostile malformed pp (P1 — never throws), determinism (P2 — identical pp twice
// produces byte-identical output_payload), and two metamorphic tamper properties built
// independently of the fixtures (P3: any single-character mutation to a signed field of a
// KNOWN-VALID receipt must flip valid:true -> false with SIGNATURE_INVALID in failed_codes;
// P4: substituting signatures[0].kid with a syntactically-valid but different did:key must
// produce KID_NOT_RESOLVABLE without ever reaching the signature-verify step).

import { compute } from '../art-652-verify-receipt.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pickNasty } from './_pbt-common.mjs';

const KERNEL_ID = 'art-652-verify-receipt';

// A known-good, independently-fixture-verified receipt — reused from the kernel's own golden
// vectors (genesis-receipt-verifies) so P3/P4 mutate real signed bytes rather than fabricating
// a fresh keypair inside this floor.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));
const GOOD_RECEIPT = FIXTURES.vectors.find((v) => v.name === 'genesis-receipt-verifies').policy_parameters.receipt;

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

// ---------- P1: totality — compute() never throws on hostile/malformed pp ----------
function checkTotalityNeverThrows() {
  const rng = mulberry32(652);
  const shapes = [
    undefined, null, {}, { receipt: null }, { receipt: {} }, { receipt: [] },
    { receipt: 'not-an-object' }, { receipt: 42 }, { receipt: { schema: 123 } },
    { receipt: { signatures: 'not-an-array' } }, { receipt: { signatures: [null, undefined, 42] } },
    { receipt: { signatures: [{ alg: 'EdDSA', kid: 123, value: {} }] } },
    { receipt: GOOD_RECEIPT, previous_receipt: 'not-an-object' },
    { receipt: GOOD_RECEIPT, previous_receipt: null },
  ];
  for (let i = 0; i < 20; i++) shapes.push({ receipt: { ...deepClone(GOOD_RECEIPT), extensions: pickNasty(rng) } });
  let checked = 0, violations = 0;
  for (const pp of shapes) {
    checked++;
    try {
      const { output_payload } = compute(pp);
      if (typeof output_payload.valid !== 'boolean') violations++;
    } catch {
      violations++; // compute() must never throw — every hostile shape resolves to a verdict
    }
  }
  return { name: 'totality_never_throws', checked, violations };
}

// ---------- P2: determinism — same pp twice -> byte-identical output_payload ----------
function checkDeterminism() {
  const samples = [
    { receipt: GOOD_RECEIPT },
    { receipt: GOOD_RECEIPT, previous_receipt: GOOD_RECEIPT },
    {},
  ];
  let checked = 0, violations = 0;
  for (const pp of samples) {
    checked++;
    const a = JSON.stringify(compute(deepClone(pp)).output_payload);
    const b = JSON.stringify(compute(deepClone(pp)).output_payload);
    if (a !== b) violations++;
  }
  return { name: 'determinism', checked, violations };
}

// ---------- P3: any single-char mutation to a signed field flips valid -> false / SIGNATURE_INVALID ----------
function checkPayloadTamperBreaksSignature() {
  // issuer_id deliberately excluded: mutating it changes signatures[].kid resolvability (a
  // different, also-correct fail code — KID_NOT_RESOLVABLE, exercised by P4) before the
  // signature is ever checked, so it is not a like-for-like SIGNATURE_INVALID case.
  const SIGNED_STRING_FIELDS = ['receipt_id', 'event_type', 'source_adapter', 'issued_at', 'result_status', 'input_hash', 'policy_digest'];
  let checked = 0, violations = 0;
  for (const field of SIGNED_STRING_FIELDS) {
    checked++;
    const tampered = deepClone(GOOD_RECEIPT);
    const orig = String(tampered[field]);
    tampered[field] = orig.slice(0, -1) + (orig.slice(-1) === 'a' ? 'b' : 'a');
    const { output_payload } = compute({ receipt: tampered });
    if (output_payload.valid !== false || !output_payload.failed_codes.includes('SIGNATURE_INVALID')) {
      violations++;
    }
  }
  return { name: 'payload_tamper_breaks_signature', checked, violations };
}

// ---------- P4: kid substitution is caught BEFORE signature verify, never a false SIGNATURE_VALID ----------
function checkKidSubstitutionNotResolvable() {
  const OTHER_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
  let checked = 1, violations = 0;
  const tampered = deepClone(GOOD_RECEIPT);
  tampered.signatures[0].kid = OTHER_DID;
  const { output_payload } = compute({ receipt: tampered });
  if (output_payload.valid !== false || !output_payload.failed_codes.includes('KID_NOT_RESOLVABLE')) {
    violations++;
  }
  return { name: 'kid_substitution_not_resolvable', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkTotalityNeverThrows(),
  checkDeterminism(),
  checkPayloadTamperBreaksSignature(),
  checkKidSubstitutionNotResolvable(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
