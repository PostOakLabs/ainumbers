/**
 * art-809-check-reserves-cover-outstanding-private.kernel.mjs
 * First private-input PREDICATE node: "reserves at least outstanding", under OCG Standard section 25
 * ocg-private-input@1. The reserve amounts (16 fixed slots, each tagged with a GENIUS Act
 * section 4(a)(1)(A)(i)-(viii) category code) and the outstanding amount are the PRIVATE witness:
 * never present in policy_parameters, output_payload, or the execution_hash preimage. Two
 * independent sha256-salted@1 commitments (reserves_commitment, outstanding_commitment) sit in
 * policy_parameters, so the outstanding figure can be opened to an
 * auditor on its own without opening the reserves.
 *
 * Rule implemented (each line is design-file R1..R3, PRIVATE-PREDICATE-DESIGN-2026-11 section 2.1):
 *   R1 verdict true iff sum(reserve amounts) >= outstanding amount. GENIUS Act (Pub. L. 119-27)
 *      section 4(a)(1)(A): reserves "on an at least 1 to 1 basis". No haircut: the statute states none
 *      (a stated design choice, not a regulatory claim).
 *   R2 each non-empty slot carries a category code "01".."08" mapping to section 4(a)(1)(A)(i)..(viii);
 *      "00" is an empty slot whose amount must be zero. Any other code refuses (throws).
 *   R3 NOT checked here: (vii) approval by the primary Federal payment stablecoin regulator; the
 *      (ii) FDIC/NCUA limits; the section 4(a)(2) no-rehypothecation rule; that entries are held or
 *      identifiable at all. These are on the page's "not proven" list.
 *
 * Fixed shape on purpose: exactly 16 slots of exactly 20-digit decimal strings, so the committed
 * preimage has constant byte length and does not leak how many reserve lines exist. Any witness
 * that is not exactly that shape throws, so the zkVM guest panics and nothing is sealed.
 * Integers are BigInt throughout; no floats.
 *
 * Private-input variant of a public coverage check; use a public-input kernel when the amounts
 * may be disclosed. Hiding holds only if the proof is generated where the inputs live.
 *
 * Pure decision kernel: no DOM, no window, no Date.now(), no Math.random().
 */
import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID      = 'art-809-check-reserves-cover-outstanding-private';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_reserves_cover_private',
  mandate_type: 'compliance_control',
  gpu:          false,
  // section 25 profile marker: buildArtifact's first argument is the PRIVATE WITNESS
  // (reserves/outstanding/two salts), not policy_parameters (commitments only).
  private_input_profile: 'ocg-private-input@1',
};

const RESERVE_SLOTS = 16;
const AMOUNT_WIDTH  = 20;
// Fixed-width category codes for GENIUS Act section 4(a)(1)(A)(i)-(viii); '00' = empty slot.
const ELIGIBLE = ['01', '02', '03', '04', '05', '06', '07', '08'];

const CITATION = 'GENIUS Act (Pub. L. 119-27) section 4(a)(1)(A): reserves backing outstanding payment stablecoins on an at least 1 to 1 basis, in the reserve categories listed in (i) to (viii).';
const BASIS = 'Shows that the committed reserve amounts, in the categories the GENIUS Act lists, add up to at least the committed amount outstanding. It does not show the reserves exist, are unencumbered, or are approved where approval is required, and it does not replace the monthly report the Act requires.';
const PRIVACY_NOTE = 'The verdict is public. The inputs are not in the receipt. A receipt made from inputs you gave a server was seen by that server. Each receipt answers one yes/no question; asking many questions about the same figures reveals more.';
const NOT_ADVICE = 'Not legal or regulatory advice. Reserve adequacy determinations require review by the issuer\'s qualified finance and compliance staff and the applicable regulator.';

// Fixed-width non-negative decimal string -> BigInt. Throws on any other shape.
function amt(s) {
  if (typeof s !== 'string' || s.length !== AMOUNT_WIDTH || !/^[0-9]+$/.test(s)) throw new Error('AMOUNT_FORMAT');
  return BigInt(s);
}

function exactKeys(o, keys) {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return false;
  const k = Object.keys(o);
  return k.length === keys.length && keys.every((x) => Object.prototype.hasOwnProperty.call(o, x));
}

// ---- pure, deterministic verdict over the PRIVATE witness (R1, R2) ----
function coverVerdict(reserves, outstanding) {
  if (!Array.isArray(reserves) || reserves.length !== RESERVE_SLOTS) throw new Error('RESERVE_SLOTS');
  let total = 0n;
  for (const e of reserves) {
    if (!exactKeys(e, ['category', 'amount_minor'])) throw new Error('SLOT_SHAPE');
    const a = amt(e.amount_minor);
    if (e.category === '00') { if (a !== 0n) throw new Error('PAD_NONZERO'); continue; }
    if (!ELIGIBLE.includes(e.category)) throw new Error('CATEGORY');
    total += a;
  }
  if (!exactKeys(outstanding, ['outstanding_minor'])) throw new Error('OUTSTANDING_SHAPE');
  const out = amt(outstanding.outstanding_minor);
  return total >= out;
}

// section 25.1 commitment = sha256(salt ‖ cgCanon(input_value)), hex-encoded, "sha256:"-prefixed.
async function commitPrivateInput(saltHex, inputValue) {
  if (typeof saltHex !== 'string' || saltHex.length < 64 || !/^[0-9a-f]+$/i.test(saltHex)) {
    throw new Error('salt must be a hex string of at least 256 bits (64 hex chars)');
  }
  const saltBytes = new Uint8Array(saltHex.length / 2);
  for (let i = 0; i < saltBytes.length; i++) saltBytes[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
  const inputBytes = new TextEncoder().encode(JSON.stringify(cgCanon(inputValue)));
  const combined = new Uint8Array(saltBytes.length + inputBytes.length);
  combined.set(saltBytes, 0);
  combined.set(inputBytes, saltBytes.length);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', combined);
  return 'sha256:' + Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Decoy export for gate harnesses expecting `compute` (see art-413/415): the verdict is never
// recomputed from policy_parameters alone (SPEC.md section 18.3). Defined BEFORE buildArtifact so
// check-engine-parity.mjs's bundler captures it.
export function compute(pp) {
  return {
    reserves_cover_outstanding: null,
    unit: pp.unit ?? null,
    note: 'Private-input node: verdict is not recomputable from policy_parameters alone (SPEC.md §18.3). Call buildArtifact with the private witness, or verify the existing artifact via validate_private_inputs.',
  };
}

/**
 * buildArtifact — `raw` is the caller's PRIVATE witness plus public config:
 *   { reserves: [16 x {category, amount_minor}], outstanding: {outstanding_minor},
 *     reserves_salt, outstanding_salt, unit, as_of }
 * policy_parameters carries ONLY the two commitments + public fields; reserves, outstanding and
 * both salts never enter policy_parameters, output_payload, or the section 4 preimage.
 */
export async function buildArtifact(raw, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const r = raw || {};
  const unit  = r.unit;
  const as_of = r.as_of;
  if (typeof unit !== 'string' || !/^[A-Za-z0-9_]{1,16}$/.test(unit)) throw new Error('UNIT');
  if (typeof as_of !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(as_of)) throw new Error('AS_OF');
  if (r.reserves_salt === r.outstanding_salt) throw new Error('SALT_REUSE');

  const verdict = coverVerdict(r.reserves, r.outstanding);
  const reserves_commitment    = await commitPrivateInput(r.reserves_salt, r.reserves);
  const outstanding_commitment = await commitPrivateInput(r.outstanding_salt, r.outstanding);

  const policy_parameters = {
    reserves_commitment,
    outstanding_commitment,
    unit,
    as_of,
    citation: CITATION,
  };
  const output_payload = {
    reserves_cover_outstanding: verdict,
    basis: BASIS,
    privacy_note: PRIVACY_NOTE,
    not_legal_advice: NOT_ADVICE,
  };

  const hash = await executionHash(policy_parameters, output_payload);

  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters,
    output_payload,
    private_inputs: [
      { pointer: '/reserves_commitment', commitment: reserves_commitment, commitment_scheme: 'sha256-salted@1' },
      { pointer: '/outstanding_commitment', commitment: outstanding_commitment, commitment_scheme: 'sha256-salted@1' },
    ],
    compliance_flags: verdict ? ['RESERVES_COVER_OUTSTANDING'] : ['RESERVES_BELOW_OUTSTANDING'],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
