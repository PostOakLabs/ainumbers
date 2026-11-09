/**
 * art-811-check-dti-within-policy-private.kernel.mjs
 * Second private-input PREDICATE node: "debt obligations at most a policy share of income", under
 * OCG Standard section 25 ocg-private-input@1. The monthly income and the 16 monthly debt
 * obligation slots are the PRIVATE witness: never present in policy_parameters, output_payload, or
 * the execution_hash preimage. Two independent sha256-salted@1 commitments sit at
 * policy_parameters.income_commitment and policy_parameters.debts_commitment, so the income figure
 * can be opened on its own (for example to an employment-verification party) without opening the debts.
 *
 * Rule implemented (each line is design-file R1..R3, PRIVATE-PREDICATE-DESIGN-2026-11 section 2.2):
 *   R1 verdict true iff income > 0 and sum(debts) * 10000 <= dti_max_bps * income.
 *      Regulation Z card ability-to-pay rule, paragraph (a)(1)(ii): consideration of "the ratio of
 *      debt obligations to income".
 *   R2 income = 0 gives false. Same paragraph: unreasonable to issue a credit card to a
 *      consumer who does not have any income or assets. Assets are out of scope for this predicate.
 *   R3 dti_max_bps is the issuer's own written policy figure. The regulation names no number
 *      (CLAUSE-SILENT by design). The kernel accepts only the fixed public list 3600, 4300, 4500, 5000;
 *      the list is a design choice that limits threshold probing, not a regulatory claim.
 *   NOT checked: that income is income to which the consumer has a reasonable expectation of access;
 *      that every current obligation was listed; the (a)(2) minimum-payment estimate.
 *
 * Fixed shape on purpose: exactly 16 debt slots of exactly 20-digit decimal strings (zero-padded),
 * so the committed preimage has constant byte length and does not leak how many debts exist. Any
 * witness that is not exactly that shape throws, so the zkVM guest panics and nothing is sealed.
 * Integers are BigInt throughout; no floats. The ratio itself is never computed or published.
 *
 * Private-input variant of a public ratio check; use a public-input kernel when the figures may be
 * disclosed. Hiding holds only if the proof is generated where the inputs live.
 *
 * Pure decision kernel: no DOM, no window, no Date.now(), no Math.random().
 */
import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID      = 'art-811-check-dti-within-policy-private';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_dti_within_policy_private',
  mandate_type: 'compliance_control',
  gpu:          false,
  // section 25 profile marker: buildArtifact's first argument is the PRIVATE WITNESS
  // (income/debts/two salts), not policy_parameters (commitments only).
  private_input_profile: 'ocg-private-input@1',
};

const DEBT_SLOTS   = 16;
const AMOUNT_WIDTH = 20;
const DTI_ENUM     = [3600, 4300, 4500, 5000];

const CITATION = '12 CFR 1026.51(a)(1)(ii): a card issuer\'s reasonable written policies and procedures must consider the ratio of debt obligations to income, and it is unreasonable to issue a card to a consumer who has no income or assets. The regulation names no ratio; the threshold is the issuer\'s own policy.';
const BASIS = 'Shows that the committed monthly debt obligations are at most the chosen share of the committed monthly income. The share comes from a fixed list. It does not show that every debt was listed or that the income is real.';
const PRIVACY_NOTE = 'The verdict is public. The inputs are not in the receipt. A receipt made from inputs you gave a server was seen by that server. Each receipt answers one yes/no question; asking many questions about the same figures at different shares reveals more.';
const NOT_ADVICE = 'Not legal or regulatory advice. Ability-to-pay determinations require review by the issuer\'s qualified credit and compliance staff.';

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

// ---- pure, deterministic verdict over the PRIVATE witness (R1, R2, R3) ----
function dtiVerdict(debts, incomeObj, bps) {
  if (!DTI_ENUM.includes(bps)) throw new Error('DTI_MAX_BPS');
  if (!Array.isArray(debts) || debts.length !== DEBT_SLOTS) throw new Error('DEBT_SLOTS');
  let total = 0n;
  for (const d of debts) total += amt(d);
  if (!exactKeys(incomeObj, ['monthly_income_minor'])) throw new Error('INCOME_SHAPE');
  const income = amt(incomeObj.monthly_income_minor);
  if (income === 0n) return false;
  return total * 10000n <= BigInt(bps) * income;
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
  const p = pp || {};
  return {
    dti_within_policy: null,
    unit: p.unit ?? null,
    note: 'Private-input node: verdict is not recomputable from policy_parameters alone (SPEC.md §18.3). Call buildArtifact with the private witness, or verify the existing artifact via validate_private_inputs.',
  };
}

/**
 * buildArtifact — `raw` is the caller's PRIVATE witness plus public config:
 *   { debts: [16 x "<20 digits>"], income: {monthly_income_minor}, income_salt, debts_salt,
 *     dti_max_bps, unit, as_of }
 * policy_parameters carries ONLY the two commitments + public fields; income, debts and both salts
 * never enter policy_parameters, output_payload, or the section 4 preimage.
 */
export async function buildArtifact(raw, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const r = raw || {};
  const unit  = r.unit;
  const as_of = r.as_of;
  if (typeof unit !== 'string' || !/^[A-Za-z0-9_]{1,16}$/.test(unit)) throw new Error('UNIT');
  if (typeof as_of !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(as_of)) throw new Error('AS_OF');
  if (r.income_salt === r.debts_salt) throw new Error('SALT_REUSE');

  const verdict = dtiVerdict(r.debts, r.income, r.dti_max_bps);
  const income_commitment = await commitPrivateInput(r.income_salt, r.income);
  const debts_commitment  = await commitPrivateInput(r.debts_salt, r.debts);

  const policy_parameters = {
    income_commitment,
    debts_commitment,
    dti_max_bps: r.dti_max_bps,
    unit,
    as_of,
    citation: CITATION,
  };
  const output_payload = {
    dti_within_policy: verdict,
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
      { pointer: '/income_commitment', commitment: income_commitment, commitment_scheme: 'sha256-salted@1' },
      { pointer: '/debts_commitment', commitment: debts_commitment, commitment_scheme: 'sha256-salted@1' },
    ],
    compliance_flags: verdict ? ['DTI_WITHIN_POLICY'] : ['DTI_ABOVE_POLICY'],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
