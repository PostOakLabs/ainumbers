// OCG chain-level proof — the composition kernel (CHAIN-PROOF-TRIAL-1, trial only).
//
// WHAT THIS IS. A JS kernel that runs inside the SECOND risc0 guest image (`chainproofguest` in
// `ainumbers-prover`, the universal QuickJS harness plus one `env::verify` host function). Given one
// chain run — the per-step journals, inputs and outputs — it verifies every step's §18 claim, the
// hash linkage between the steps, and the chain's own gate rules, then recomputes the §21.2
// `composite_execution_hash`. The guest commits what this kernel returns as the journal's `output`,
// so ONE Groth16 seal ends up attesting the whole run instead of one seal per step.
//
// ⛔ NOT A GRAPH NODE. This module exports no `compute`/`buildArtifact`, it is not in
// `chaingraph.json`, it mints no `execution_hash` of its own (SPEC §18.4) and nothing here is
// published. It is the trial artifact of CHAIN-PROOF-TRIAL-1; the SPEC text that would let a
// composite artifact carry this receipt is a follow-on row, unwritten.
//
// WHAT IT ATTESTS / DOES NOT ATTEST: CHAIN-PROOF-SCOPE.md §4, in full. In short — it attests that
// each listed step is a real execution of the PINNED image with the PINNED kernel digest producing
// exactly the stated output, that the steps link by `parent_hashes` in the committed order, that the
// committed gate rules admit the run, and that the composite hash is the §21.2 hash over exactly
// those steps. It attests NOTHING about whether the inputs were true or authorised.
//
// THREE RULES THIS FILE EXISTS TO ENFORCE:
//  1. EVERY pinned fact comes from PINNED_CHAINS below, never from the caller's input. `image_id`,
//     `kernel_digest`, step order, step ids, gates and the chain title are transcribed from the
//     published `chaingraph.json`, and the transcription is covered by this kernel's own
//     `kernel_digest` (which the guest computes in-guest and commits). A caller who supplies a
//     different `image_id` for a step does not get a different verification — they get a panic.
//  2. ONE canonicalizer. `execution_hash` is recomputed with `executionHash()` from `_hash.mjs` and
//     nothing else (SPEC §18.7, repo/CLAUDE.md). Gate rules are evaluated with `evaluateGate()` from
//     `_gateval.mjs` and nothing else (SPEC §21.4). Both modules are served to the guest from the
//     kernel's own directory, so no second implementation of either can exist here.
//  3. NO PARTIAL RECEIPT. Every check throws on failure; the guest turns a throw into a panic, and a
//     panicking risc0 session produces no receipt at all. There is no "N of M steps verified" form.
//
// SPEC: §17 (kernel_digest), §18.0–§18.7 (journal shape, one canonicalizer, no new hash layer),
// §21.1 (parent threading), §21.2 (composite preimage), §21.4 (gates, route_plan_digest,
// decisions[], path_taken[]), §22.5 (mandate_hash conditional presence).

import { cgCanon, executionHash } from './_hash.mjs';
import { evaluateGate, isTerminalTarget } from './_gateval.mjs';

const CHAINGRAPH_VERSION = '0.4.0';

// ── PINNED FACTS ─────────────────────────────────────────────────────────────────────────────
// Transcribed 2026-09-27 from repo/chaingraph/chaingraph.json (spec_version 0.8.13): each step's
// `compute_images[]` risc0 entry (the image every one of its receipts is bound to), its
// `compute_images[]` sha256-source entry (which is the §17 `kernel_digest` its journal carries),
// its `mandate_type` (a §21.2 composite-preimage member), and the chain's own `steps[]` definition.
// `chain_definition_digest` is the SPEC §21.4 `route_plan_digest` form — bare-hex SHA-256 over
// JCS(steps[]) through `cgCanon` — and is re-derived below from `definition_steps`, so a typo in the
// transcription cannot pass silently.
const PINNED_CHAINS = Object.freeze({
  'aca-226j-response-composer': {
    chain_name: 'aca-226j-response-composer',
    chain_title: 'ACA 226J Response Composer',
    spec_version: '0.8.13',
    chain_definition_digest: '63eb5e99670360231e527396c97c1a982e8bc3fdddbb119f3c17eb63837896a7',
    // The chains[] `steps` array verbatim — the object the digest above is taken over.
    definition_steps: [
      { tool_id: 'art-298-aca-affordability-safe-harbor', handoff: 'affordability harbor verdicts feed Stage 2 ESRP exposure recomputation' },
      { tool_id: 'art-299-aca-esrp-exposure', handoff: 'controlling_exposure_annual feeds the terminal 226J response evidence pack' },
      { tool_id: 'art-300-aca-226j-response-evidence-pack', handoff: 'Composes the response-window-deadline evidence pack with named-human attestation closure -- final stage' },
    ],
    steps: [
      {
        tool_id: 'art-298-aca-affordability-safe-harbor',
        mandate_type: 'compliance_mandate',
        image_id: 'sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6',
        kernel_digest: 'sha256:517e7ad37c5723b7df461c5830be597d989342422f3c60cad22e15cdcd8d7695',
        gate: null,
      },
      {
        tool_id: 'art-299-aca-esrp-exposure',
        mandate_type: 'compliance_mandate',
        image_id: 'sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6',
        kernel_digest: 'sha256:d07a15cc7c7b3da43db92b15595249dcb3e8a81ca73d2e0144172de35b6e410e',
        gate: null,
      },
      {
        tool_id: 'art-300-aca-226j-response-evidence-pack',
        mandate_type: 'compliance_mandate',
        image_id: 'sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6',
        kernel_digest: 'sha256:4d4fb49f4aacbbbdeaa9aa38d119217e3cfd2e5234bb80c9fd6bb055afb5fcc9',
        gate: null,
      },
    ],
  },
});

// ── helpers ──────────────────────────────────────────────────────────────────────────────────

// Every refusal goes through here so the failure mode is uniform: a throw, which the guest turns
// into a panic, which means no receipt exists at all (CHAIN-PROOF-SCOPE.md §2 refusal rule).
function refuse(code, detail) {
  throw new Error(detail ? `chain_proof_refused:${code} ${detail}` : `chain_proof_refused:${code}`);
}
function must(cond, code, detail) { if (!cond) refuse(code, detail); }

// RFC 8785 through the one canonicalizer. Used for the journal-output equality test and for the
// digests below; never as a second execution-hash path (executionHash() is the only hash of a
// {policy_parameters, output_payload} pair in this file).
const jcs = (v) => JSON.stringify(cgCanon(v));

// SPEC §21.4 route_plan_digest form: bare-hex SHA-256 over the JCS-canonical value. Byte-identical
// to the worker's `cgSha256Hex` (mcp-apps-poc/worker.mjs, run_chain) — same canonicalizer, same
// encoder, same hex formatting; there is no second hash path here.
export async function cgSha256Hex(value) {
  const bytes = new TextEncoder().encode(jcs(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// `env::verify` on the pinned image id. The host function lives on the composition guest; outside
// the guest (fixtures, a Node dry run) a caller may install a stand-in on globalThis. Absent both,
// refuse — a composition that silently skipped the step-claim check would be worthless.
function assumeStepClaim(imageIdWithPrefix, journalBytes) {
  const fn = globalThis.__ocg_verify;
  must(typeof fn === 'function', 'host_verify_unavailable', 'globalThis.__ocg_verify is not installed');
  const hex = String(imageIdWithPrefix).replace(/^sha256:/, '');
  must(/^[0-9a-f]{64}$/.test(hex), 'pinned_image_id_malformed', hex);
  fn(hex, journalBytes);
}

function sameStringArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const stepIdOf = (pinnedStep) => (typeof pinnedStep.id === 'string' && pinnedStep.id.length ? pinnedStep.id : pinnedStep.tool_id);

// ── the composition ──────────────────────────────────────────────────────────────────────────

/**
 * Verify one chain run against a PINNED chain definition and return the committed output.
 * Exported separately from `chainProof` so fixtures can exercise shapes (a gated chain, a mandate
 * run) that the pinned registry does not carry yet, without ever letting the guest path read a
 * caller-supplied definition.
 *
 * @param {object} pinned one PINNED_CHAINS entry
 * @param {object} input  { chain_name, steps: [...], mandate_hash? } — RUN data only
 */
export async function composeChainProof(pinned, input) {
  must(input && typeof input === 'object' && !Array.isArray(input), 'input_not_an_object');
  must(input.chain_name === pinned.chain_name, 'chain_name_mismatch', String(input.chain_name));
  must(Array.isArray(input.steps) && input.steps.length > 0, 'no_steps_supplied');

  // Self-check: the pinned digest must be the digest of the pinned definition.
  const definitionDigest = await cgSha256Hex(pinned.definition_steps);
  must(definitionDigest === pinned.chain_definition_digest, 'pinned_definition_digest_mismatch', definitionDigest);

  const mandateHash = Object.prototype.hasOwnProperty.call(input, 'mandate_hash') ? input.mandate_hash : null;
  if (mandateHash !== null) must(typeof mandateHash === 'string' && mandateHash.length > 0, 'mandate_hash_not_a_string');

  const hasGates = pinned.steps.some((s) => s.gate);
  const ran = [];
  const decisions = [];
  const pathTaken = [];

  // Walk the PINNED step order. The caller's array supplies run data in RAN order only; which steps
  // are ALLOWED to have run is decided here, from the committed definition and its gates.
  let i = 0;
  let k = 0;            // index into input.steps (RAN order)
  let previousHash = null;
  while (i < pinned.steps.length) {
    const pinnedStep = pinned.steps[i];
    const supplied = input.steps[k];
    must(supplied && typeof supplied === 'object', 'step_missing', pinnedStep.tool_id);
    must(supplied.tool_id === pinnedStep.tool_id, 'step_out_of_order', `${supplied.tool_id} != ${pinnedStep.tool_id}`);

    // (i) The step claim itself — image id PINNED, never read from `supplied`. A caller who names a
    // different image is refused outright rather than quietly verified against the pinned one.
    if (supplied.image_id !== undefined) {
      must(supplied.image_id === pinnedStep.image_id, 'step_image_substituted', `${supplied.image_id} != ${pinnedStep.image_id}`);
    }
    must(Array.isArray(supplied.journal_bytes) && supplied.journal_bytes.length > 0, 'journal_bytes_missing', pinnedStep.tool_id);
    const journalBytes = Uint8Array.from(supplied.journal_bytes);
    assumeStepClaim(pinnedStep.image_id, journalBytes);

    // (ii) The journal must say what the run claims it says.
    let journal;
    try {
      journal = JSON.parse(new TextDecoder().decode(journalBytes));
    } catch (e) {
      refuse('journal_not_json', pinnedStep.tool_id);
    }
    must(journal && typeof journal === 'object', 'journal_not_an_object', pinnedStep.tool_id);
    must(journal.chaingraph_version === CHAINGRAPH_VERSION, 'journal_version_mismatch', String(journal.chaingraph_version));
    must(journal.kernel_digest === pinnedStep.kernel_digest, 'kernel_digest_mismatch', `${journal.kernel_digest} != ${pinnedStep.kernel_digest}`);
    must(supplied.output_payload !== undefined && supplied.output_payload !== null, 'output_payload_missing', pinnedStep.tool_id);
    must(jcs(journal.output) === jcs(supplied.output_payload), 'journal_output_tampered', pinnedStep.tool_id);

    // (iii) The step execution_hash, recomputed through the ONE canonicalizer (§4, §18.7).
    must(supplied.policy_parameters !== undefined && supplied.policy_parameters !== null, 'policy_parameters_missing', pinnedStep.tool_id);
    const recomputed = await executionHash(supplied.policy_parameters, supplied.output_payload);
    const claimed = String(supplied.execution_hash ?? '').replace(/^sha256:/, '');
    must(recomputed === claimed, 'execution_hash_mismatch', `${pinnedStep.tool_id} ${recomputed} != ${claimed}`);

    // §22.5 mandate binding: conditional-presence, and it is the SAME condition for every step. A
    // run where some steps carry `mandate_hash` and others do not is refused, not averaged.
    const ppMandate = (supplied.policy_parameters && typeof supplied.policy_parameters === 'object' && !Array.isArray(supplied.policy_parameters))
      ? supplied.policy_parameters.mandate_hash : undefined;
    if (mandateHash === null) {
      must(ppMandate === undefined, 'mandate_unexpected', pinnedStep.tool_id);
    } else {
      must(ppMandate === mandateHash, 'mandate_binding_mismatch', `${pinnedStep.tool_id} ${String(ppMandate)}`);
    }

    // (iv) §21.1 parent threading: [] for the first RAN step, [previous RAN execution_hash] after.
    const expectedParents = previousHash === null ? [] : [previousHash];
    const suppliedParents = (supplied.parent_hashes ?? []).map((h) => String(h).replace(/^sha256:/, ''));
    must(sameStringArray(suppliedParents, expectedParents), 'parent_hashes_broken', pinnedStep.tool_id);

    ran.push({
      tool_id: pinnedStep.tool_id,
      mandate_type: pinnedStep.mandate_type,
      image_id: pinnedStep.image_id,
      kernel_digest: pinnedStep.kernel_digest,
      execution_hash: recomputed,
      output_payload: supplied.output_payload,
    });
    pathTaken.push(stepIdOf(pinnedStep));
    previousHash = recomputed;
    k += 1;

    // (v) Gate re-evaluation from the COMMITTED definition (§21.4). The gate decides which pinned
    // index may run next; a run that took any other route does not verify.
    if (pinnedStep.gate) {
      const decision = evaluateGate(pinnedStep.gate, supplied.output_payload);
      decisions.push({ step_id: stepIdOf(pinnedStep), ...decision });
      if (isTerminalTarget(decision.next)) { i = pinned.steps.length; break; }
      const target = pinned.steps.findIndex((s) => stepIdOf(s) === decision.next);
      must(target > i, 'gate_target_not_forward', `${decision.next}`);
      i = target;
    } else {
      i += 1;
    }
  }

  // A step that RAN but that the route never reached is exactly the skipped-gate attack.
  must(k === input.steps.length, 'unrouted_step_ran', `${input.steps.length - k} supplied step(s) the committed route never reaches`);

  // ── §21.2 composite preimage, over RAN steps only ──
  const composite_policy = {
    compute_mode: 'server',
    chain: pinned.chain_name,
    chain_title: pinned.chain_title,
    step_count: ran.length,
    step_tool_ids: ran.map((r) => r.tool_id),
  };
  const composite_output = {
    chain: pinned.chain_name,
    steps: ran.map((r) => ({ tool_id: r.tool_id, mandate_type: r.mandate_type, execution_hash: r.execution_hash, output_payload: r.output_payload })),
  };
  // §22.5 / §21.4 conditional-presence keys, in the worker's order: mandate first, gate metadata
  // second. Absent both, the preimage is byte-identical to a plain linear §21.2 composite, which is
  // what makes this hash comparable with the one `run_chain` already produces.
  if (mandateHash !== null) composite_policy.mandate_hash = mandateHash;
  if (hasGates) {
    composite_policy.route_plan_digest = await cgSha256Hex(pinned.definition_steps);
    composite_output.decisions = decisions;
    composite_output.path_taken = pathTaken;
  }
  const composite_execution_hash = await executionHash(composite_policy, composite_output);

  // The committed output. Domain separation against cross-workflow replay is the chain name, the
  // spec version and the definition digest sitting INSIDE the committed value.
  const output = {
    chain_name: pinned.chain_name,
    spec_version: pinned.spec_version,
    chain_definition_digest: pinned.chain_definition_digest,
    composite_execution_hash,
    steps: ran.map((r) => ({
      tool_id: r.tool_id,
      image_id: r.image_id,
      kernel_digest: r.kernel_digest,
      execution_hash: r.execution_hash,
    })),
  };
  if (mandateHash !== null) output.mandate_hash = mandateHash;
  return output;
}

/**
 * Guest entry point. The composition guest's bootstrap calls exactly this.
 * `input.chain_name` selects a PINNED chain; an unknown name is a refusal, never a caller-supplied
 * definition.
 */
export async function chainProof(input) {
  must(input && typeof input === 'object' && !Array.isArray(input), 'input_not_an_object');
  const pinned = Object.prototype.hasOwnProperty.call(PINNED_CHAINS, input.chain_name) ? PINNED_CHAINS[input.chain_name] : null;
  must(pinned !== null, 'chain_not_pinned', String(input.chain_name));
  return composeChainProof(pinned, input);
}

// Exported for the fixture runner and for host-side dry runs. Not read by the guest path.
export { PINNED_CHAINS };
