# OpenChainGraph Standard — Changelog

One row per spec version. The version of record is `chaingraph.json.spec_version`; this file
narrates what each bump changed. Normative definitions live in `SPEC.md` + `openchain-graph-v0.4.schema.json`.

## 0.9-draft — Control Plane Profile (§26)
- **SPEC-TEXT PASS, draft label per estate convention — not a record bump.** `spec_version` of record
  stays 0.8.8; the draft label mirrors `SPEC-S26-CONTROL-PLANE-PROFILE-DRAFT.md`'s own header rather than
  claiming a coordinated 0.8.x text-pass number, since this section stages ahead of Helm Phase 1 landing.
- **§26** adds an OPTIONAL, NORMATIVE `ocg-control-plane@1` profile for connected, operated workflows
  (external data retrieval, durable local state, scheduling, human review, agent delegation) run by the
  artifact producer on its own infrastructure (the AINumbers Helm Local Hub). Defines: the in-toto
  Statement v1 / DSSE envelope with Ed25519 + SHOULD ML-DSA-44 dual-sign (§26.2); `workflow_manifest_digest`
  binding (§26.3); ten object kinds — `connector_attestation` and `execution_state` REQUIRED-producible,
  the other eight (`policy_decision`, `review_task`, `review_decision`, `override`, `agent_delegation`,
  `external_action_intent`, `external_action_receipt`, `disclosure_receipt`) reserved-schema/OPTIONAL-
  production for Phase 2+ but MUST-parse for a `@1` verifier (§26.4); an append-only per-stream
  hash-chained journal carrying the EU AI Act Art. 12(2)/(3) record-keeping fields plus signed periodic/
  final checkpoints anchorable per §20 (§26.5); a closed five-value trust-label vocabulary that MUST NOT
  collapse into an undifferentiated "verified" indicator (§26.6); a zero-network-access offline-verifiable
  evidence-bundle export with mandatory redaction (§26.7); and conformance requiring golden AND tampered
  negative fixtures to both round-trip correctly (§26.8). Purely additive: layered beside, never inside,
  a core artifact — §4 preimage members and `chaingraph_version` `"0.4.0"` UNTOUCHED, no existing
  `execution_hash` changes, a verifier ignorant of the profile stays fully correct. JSON Schemas are SSOT
  in the Helm repo (`ainumbers-helm`), mirrored here by fixture — no schema file lands in this repo as part
  of this pass. §26 was the gap §27 (Human Accountability) deliberately left open.
  Attribution: in-toto (Statement v1 + DSSE), RFC 9964 (JOSE PQC algorithm identifiers), RFC 8693
  (delegation exchange-chain shape, referenced not implemented), RFC 6920 / EU AI Act Art. 12 (naming +
  record-keeping minima) — patterns only, no code or text copied.

## 0.8.19 — Forward decision-outcome mandate (§STPFWD-1)
- **SPEC-TEXT PASS, not a record bump.** The `spec_version` of record in `chaingraph.json` stays 0.8.13
  until the next coordinated K landing moves it, the same separation v0.8.9 through v0.8.18 used.
- **§STPFWD-1** carves out the normative text `STP-BRANCHABILITY-BUILD-SPEC.md` §3 deliberately left
  unwritten: a node first published `status:"live"`, `gpu:false` after this section lands MUST emit the
  already-normative `$defs/haGatePolicy` (§27.4) at `/output_payload/decision/gate_policy` and the
  already-normative `$defs/haRunState` (§27.10) at the sibling `/output_payload/decision/execution_state`.
  Both vocabularies are reused verbatim — no new enum value, no new schema property, no `required[]` change.
  The nested `decision.{gate_policy,execution_state}` shape is adopted on the measured, non-lossy finding of
  `research/PTRSCOPE-DECISION-1-2026-08-02.md` (four coexisting pointer shapes across 8 live nodes today);
  this section explicitly does NOT normalize, rename, or alias any of those four — that stays a separate,
  unadjudicated question, and every node published before this section is untouched.
- **Enforcement rides the existing §18 ratchet** (`scripts/check-compute-proof-coverage.mjs`, downward-only
  against `compute-proof-baseline.json`, S18-BASELINE-GUARD-1 provenance discriminator already in place): a
  brand-new `gpu:false` node cannot silently enter the proven/deferred count, so the §STPFWD-1.1 MUST is a
  build-time authorship requirement checked at the same review point, not a second automated gate. One new
  §15 matrix row cites the already-on-disk `kernel-coverage.mjs --strict` / `compute-proof.test.mjs`.
- **Purely additive** under the same three-condition freeze test every prior text pass used: no existing
  `execution_hash` moves, no `required[]` entry changes, no MUST-emit reaches an already-published artifact.
  `$defs/artifact.required` and `chaingraph_version` (`"0.4.0"`) are unchanged; every pinned golden vector is
  byte-identical before and after.

## 0.8.18 — Retention & pruning profile (§20.3)
- **SPEC-TEXT PASS, not a record bump.** The `spec_version` of record in `chaingraph.json` stays 0.8.13
  until the next coordinated K landing moves it, the same separation v0.8.9 through v0.8.17 used.
- **§20.3** states, for the first time, when an artifact BODY behind a §20.1/§20.2 witness-cosigned batch
  anchor MAY be discarded while the artifact's evidentiary value survives ("prune behind a cosigned
  checkpoint"), and defines a NEW verifier report tier, `body-absent: anchored-hash-only`, for a body-absent
  artifact whose leaf hash is still checkable against a retained checkpoint (never conflated with
  `verified`/`failed`).
- **NEW top-level artifact member `retention_class`** (§20.3.0): OPTIONAL, closed enum `{ transient,
  case-file, regulatory-N-years, fixture }`. **Deliberately a DIFFERENT field from** the pre-existing
  `input_attestations[].freshness.retention_class` (§23.4, v0.8.9) — that field is a per-attestation
  declarative statement about one attested external input value; this field states the ARTIFACT'S OWN
  execution-body pruning eligibility. An earlier draft of this section proposed reusing the §23.4 field for
  this purpose; `DAG-SPECREVIEW-1`'s adversarial verification (2026-08-03) caught the mismatch before it
  landed — an artifact with zero `input_attestations` would have had nowhere to bind an artifact-level
  retention decision — so this pass gives it its own top-level home instead.
- **`fixture` is a new enum value**, forbidding pruning unconditionally — the §15 gate suite recomputes
  golden vectors from fixture bodies on every run, and a pruned fixture would silently disable the gates
  that depend on it.
- **Regulatory floors are prune-forbidden windows**, not suggestions: SEC 17a-4 (3y default / 6y
  blotters-ledgers-customer-files), MiFID II Art 16(6)/(7) (5-7y), BSA 31 CFR 1010.430 (5y) — a
  `regulatory-N-years` artifact MUST NOT be pruned until N years elapse from `generated_at`.
- **Hash-EXCLUDED.** `retention_class` sits at the artifact's top level, outside the §4 preimage exactly
  like `anchor_bindings`/`supersedes`. No `required[]` entry, no MUST-emit anywhere — an artifact without
  the member is byte-identical to a pre-v0.8.18 one and fully conformant; absence is treated as `case-file`
  (the most conservative non-regulatory class) for §20.3 purposes, never as `transient`.
- **New §15 gate row** — `retention-profile.test.mjs`, plus fixtures covering the hash-only-survivor report
  tier, a `regulatory-N-years` artifact pruned before its floor elapses (MUST fail), and a `fixture`-class
  artifact (NEVER eligible regardless of checkpoint state).
- **Non-goal, stated explicitly (§20.3.5):** this profile does not make OCG, `anchor.ainumbers.co`, or any
  AINumbers surface a retention service or archive of record — it states what a holder MAY discard and what
  a verifier reports, nothing more.

## 0.8.17 — DAG ancestry commitment (§21.6)
- **SPEC-TEXT PASS, not a record bump.** The `spec_version` of record in `chaingraph.json` stays 0.8.13
  until the next coordinated K landing moves it, the same separation v0.8.9 through v0.8.16 used.
- **§21.6 `ancestry_digest`** — an OPTIONAL member of `chain`: a `#/$defs/sha256ref` value computed as
  `SHA-256(cgCanon({ execution_hash, parent_ancestry_digests }))`, where `parent_ancestry_digests` is each
  cited parent's OWN `ancestry_digest` in `parent_hashes` order, through the SAME shared `_hash.mjs`
  canonicalizer §4 and §PPH-1 use. Closes the gap `parent_hashes` alone leaves open: `chain` sits outside
  the §4 preimage, so a producer can omit or reorder a mid-DAG ancestor today without moving any per-node
  `execution_hash`. A verifier holding the complete ancestor bundle can recompute bottom-up and detect an
  omitted/reordered/substituted ancestor or a topology change; it does NOT prove the presented bundle is
  complete relative to the world (stated as a non-guarantee, mirroring §20's anchor-completeness honesty).
- **Hash-EXCLUDED.** `ancestry_digest` lives inside `chain`, unchanged since §1 as a hash-excluded sibling
  of the `{policy_parameters, output_payload}` preimage. `required` on `chain` is unchanged (no new entry),
  and there is no MUST-emit anywhere — an artifact without the member is byte-identical to a pre-v0.8.17
  one and fully conformant.
- **New verdict tier.** A verifier missing a cited ancestor from its bundle reports `ancestry:
  "incomplete-bundle"` — an honest "cannot check" tier, distinct from and never conflated with
  `verified`/`failed`.
- **New §15 gate row** — `ancestry-digest.test.mjs`, plus a fixture pair (byte-identical-with/without the
  member, mutation-sensitive over the `cgCanon`-object-not-string trap §PPH-1 already guards against,
  incomplete-bundle tier).
- **New kernel helper** `chaingraph/kernels/_ancestry.mjs` — one exported function `ancestryDigest(...)`,
  calling the shared `cgCanon` from `_hash.mjs`. No second canonicalizer.
- **Relation to §21 array chains.** §21.1–§21.5 `run_chain`/`runChain` execution stays an unchanged
  forward-only array; `ancestry_digest` is the general DAG-shaped mechanism for artifact-level
  `parent_hashes` citation and composes independently.
- **The code half is deliberately NOT in this tick.** No kernel emits the member yet; emission lands as a
  separate row against a reference kernel, mirroring §PPH-1's own precedent.

## 0.8.13 — xBRL-CSV export profile (§13.14)
- **Record bump.** `spec_version` of record moves 0.8.12 → 0.8.13.
- **§13.14** populates the Annex slot §13.13.5 reserved for EBA DPM 2.0 (xBRL-CSV), mandatory from
  reference date 2026-03. Sibling to §13.13 xBRL-JSON: same view-not-fact posture, same
  never-fabricate discipline, same fixture-only fence. JSON metadata part + CSV data part(s), JCS
  key ordering on the metadata part, row-id sort on each CSV part. Not a submitted EBA return by
  itself (submission additionally needs DPM 2.0 dimensional/validation-rule conformance, out of
  scope, external-by-pointer per §13.14.4). Annex 2 EBA DPM 2.0 COREP concept map is a RESERVED,
  UNPOPULATED scaffold (`entry_point_schemaRef`/`ns.uri`/every `eba_qname` null) mirroring
  §13.8's COREP maps — unpopulated slot returns "pending," never a fabricated concept. Real-content
  structural demonstration uses the `ocg-ext` namespace, matching §13.13 Annex 1's FFIEC pattern.
  `export_capability` pattern gains `xbrl-csv(:[a-z0-9:-]+)?`. Gate: `xbrl-csv-fixtures.test.mjs`
  (§15) over three committed fixtures. Exporter implementation (`exporters/xbrl-csv.mjs`, worker
  wiring) and the populated Annex 2 concept map are separate, later work units.

## 0.8.12 — Human Accountability (§27)
- **SPEC-TEXT PASS, not a record bump.** `spec_version` of record stays 0.8.8, same separation as prior
  text passes.
- **§27** adds an OPTIONAL, NORMATIVE Human Accountability layer: a closed set of roles (§27.1
  preparer/reviewer/approver/attestor/submitter + optional model_owner/compliance_officer/read-only
  examiner); SCITT-style approval records (§27.2) that are NEW artifacts ABOUT a sealed artifact,
  referencing its `execution_hash` via `subject_hash` and carrying their own §16 named-human proof;
  in-toto integer `dual_control(N)` thresholds counted over DISTINCT identities (§27.3); a closed
  gate-policy vocabulary wired to §21.4 as a precondition annotation that never changes the `_gateval.mjs`
  routing math (§27.4); time-boxed `emergency_override` = §22.10 attenuation + mandatory evidence bundle,
  reverting the gate policy on expiry (§27.5); an evidence-bundle profile exportable via §13.12 SD-JWT
  selective disclosure (§27.6); a four-way separation of calculation / recommendation / judgment /
  sign-off (§27.7); and an agent-parity clause requiring an explicit §22 human-role mandate before an
  agent may satisfy a review/dual-control gate (§27.8). Purely additive: attached after hashing and
  EXCLUDED from every `execution_hash` preimage, `$defs/artifact.required` + `chaingraph_version`
  `"0.4.0"` UNCHANGED, absence conformant and meaningless. Schema adds `$defs/humanAccountabilityRecord`,
  `haEvidenceBundle`, `haGatePolicy`, `haRole`, `haApprovalThreshold`; `human_accountability_record` joins
  the recommended (non-enforced) `mandate_type` taxonomy. One new §15 gate row
  (`validate-ha-records.test.mjs`) proves shape, additivity, threshold distinctness, override expiry, and
  the signed-named-human requirement. §26 is reserved for the control-plane profile; §27 leaves the gap.
  Attribution: C2PA/CAWG (identity split), in-toto (threshold), IETF SCITT (statement-about-statement),
  ZCAP-LD (cited anti-pattern) — patterns only, no code or text copied.

## 0.8.11 — agent-receipts VC consumability (§13.11.1)
- **SPEC-TEXT PASS, not a record bump.** `spec_version` of record stays 0.8.8, same separation as prior
  text passes.
- **§13.11.1** extends the `vc` export profile's `credentialSubject` with members named to match the
  published agent-receipts (Obsigna) `AgentReceipt` credential shape — `action.type` (dotted-taxonomy alias
  table, `x-ocg.*` fallback; table starts empty, no OCG node currently maps), `action.parameters_hash`
  (conditional-presence alias of §PPH-1 `policy_parameters_hash`, `sha256:`-prefixed), `outcome.status`
  (derived from `compliance_flags`), `chain.{sequence, previous_receipt_hash, chain_id}` (derived from the
  existing `chain` member; `chain_id` is a deterministic OCG-native label, not an adopted external value),
  and a conditional-presence `principal` (the §16 proof signer keyid, only when a §22 mandate governed the
  run). Their `@context` (`https://agentreceipts.ai/context/v1`) is added alongside the OCG term context.
  Explicitly a PARTIAL mapping — `action.id`/`action.risk_level`/`action.timestamp`/`principal.type` are
  NOT populated (not derivable from the artifact without inventing values). Additive only: no envelope/hash
  change, `execution_hash` unaffected (the `vc` profile has never entered the preimage), existing `vc`
  exports without these fields stay fully conformant. No new §15 gate script — extends `export.test.mjs`
  under the existing §13 export round-trip row.

## 0.8.10 — policy-parameter digest (§PPH-1)
- **SPEC-TEXT PASS, not a record bump.** The `spec_version` of record in `chaingraph.json` stays 0.8.8 until
  the next coordinated K landing moves it, the same separation v0.8.7 through v0.8.9 used.
- **§PPH-1 `policy_parameters_hash`** — an OPTIONAL top-level member: the JCS-SHA-256 of `policy_parameters`
  alone, computed through the one canonical `_hash.mjs` path (`JSON.stringify(cgCanon(...))`, never a second
  canonicalization) and typed `#/$defs/sha256ref` — bare hex, `sha256:` prefix OPTIONAL. Producers SHOULD
  emit bare (the shared digest path returns bare hex); verifiers MUST accept either and MUST NOT fail a value
  for carrying or lacking the prefix. **No general prefix rule is claimed**: the two candidate rules were
  tried and both are falsified by the shipped schema — *self-digest vs foreign-hash* dies on
  `chain.parent_hashes[]` (foreign hashes, yet `sha256ref`), and *producer format* dies on §20 `anchored_hash`
  (byte-copies the same bare-hex pipeline, yet prefix-mandatory). The counterexamples are recorded and no
  third rule is proposed; the per-member inconsistency is pre-existing and out of scope. It is **EXCLUDED
  from the §4 preimage**:
  `canonicalPreimage()` is unchanged, `chaingraph_version` stays `"0.4.0"`, and every pinned golden vector is
  byte-identical. Adoption is per-implementation; **absence is conformant and carries no meaning**, so a
  verifier MUST NOT read anything into an omitted member. It is a content digest, not a signature — it adds
  no authority §16 does not already supply, and is not a §HASHRES-1 resolution address.
- **This closes a live incoherence rather than adding a new capability.** The §XMAP-1 annex shipped in v0.8.9
  already named `policy_parameters_hash` as the OCG-side anchor for AGT `covenantHash`, agent-receipts
  `credentialSubject.action.parameters_hash`, and AGA `arguments_hash` — but no normative section defined it
  and `$defs.artifact` (`additionalProperties: false`) rejected it outright, so an implementer following the
  annex would have produced artifacts that fail schema validation. **The annex text is unchanged**: it stays
  INFORMATIVE and is not restated in §PPH-1, because a duplicated normative definition is worse than a single
  place to look.
- **Placement recorded so it is not re-litigated:** artifact level, not nested under `audit_signature`. That
  subschema is permissive and needed no schema change, which is exactly why the rejection is written down —
  a content digest is not signing metadata, and all three mapped formats place their equivalent at artifact
  level.
- **New §15 gate row** — `policy-params-hash.test.mjs`, wired into preflight and CI, plus
  `fixtures/policy-params-hash.fixture.json` so the schema half actually executes (without a fixture carrying
  the member, `sha256ref` would never be exercised and the row would be documented-but-not-enforced). It
  proves the exclusion claim **non-vacuously** — asserting both that the member materially changes the
  artifact's canonical form AND that the §4 preimage and `execution_hash` stay byte-identical, since either
  half alone proves nothing — and asserts
  **mutation-sensitivity**, which is not ceremony: `cgCanon` returns a key-sorted OBJECT, so digesting its
  return value without `JSON.stringify` yields `"[object Object]"` — a constant digest for every input that
  passes a determinism check and fails only under mutation. That trap fired for real while the gate was being
  written, and §PPH-1.1 now warns about it in normative text. `assertIJson` is newly exported from `_hash.mjs`
  so the digest reuses §4's I-JSON rejection instead of reimplementing it.
- **Schema:** one OPTIONAL property added to `$defs.artifact`. Additive — no existing artifact changes.
- **The code half is deliberately NOT in this tick.** No kernel emits the member yet; emission lands as a
  separate R-class row against a reference kernel.

## 0.8.9 — exception classification (§22.11), anchor PQ note (§20), Wasm profile reference (§24), interop annex (§XMAP-1)
- **SPEC-TEXT PASS, not a record bump.** The `spec_version` of record in `chaingraph.json` stays 0.8.8 until the
  next coordinated K landing moves it, the same separation v0.8.7 and v0.8.8 used to avoid a `chaingraph.json`
  single-writer collision. §23.4 (attestation freshness and consent) already carried the 0.8.9 label from an
  earlier pass and is narrated in this line.
- **§22.11 exception classification + counted-resume approval** — OPTIONAL `exception_class`: `business` (no
  automatic retry; routes to a human queue in a terminal-until-resolved state) vs `application` (retry up to N,
  then MUST escalate). Adds `exception_detail {type, code, message}`, per-item terminal states
  `done`/`failed`/`pending_human` with sibling isolation (one failed item MUST NOT abort its batch), and a
  counted-resume gate `resume_approval {required_events, approver_group, resume_form, timeout}` where a timeout
  MUST resolve to a §22.8 escalation and NEVER to a silent auto-approve. Every resume message and exception
  record emitted as an OCG artifact MUST carry a §16 `eddsa-jcs-2022` proof bound to a named human — an unsigned
  resume is not conformant evidence. The frozen §22.8 escalation envelope is untouched and every field is
  hash-excluded. The standard defines the formats only; a queue runtime or UI is an implementation.
- **§20 post-quantum anchor note (informative)** — OpenTimestamps carries no signature primitive (SHA-256 Merkle
  aggregation committed by Bitcoin proof-of-work), so it is the PQ-resilient anchor in the set; `rfc3161-tst`
  carries a classical signature and inherits that exposure, mitigated today by §PQC-1. No public PQC RFC 3161
  TSA exists as of 2026-07-18 — a WATCH item, not a build. Measured against NIST IR 8547.
- **§24 normative reference to the Wasm Deterministic Profile** — where a compute binding's engine is a Wasm
  module, it MUST NOT use relaxed-SIMD, MUST NOT declare or import shared memory or threads, and MUST NOT
  observe non-deterministic NaN bit patterns. This upgrades §24's existing byte-parity claim from measured to
  profile-guaranteed; §24.1's D1–D7 enumeration is unchanged. Profile-cleanliness of our own shipped guest wasm
  is a build-time CI assertion, deliberately NOT a §15 row (§15 gates must be reproducible by third parties).
- **§XMAP-1 annex — external receipt-format mappings (informative)** — AGT / agent-receipts / AGA correspondence
  anchored on the OPTIONAL, hash-excluded `policy_parameters_hash` alias (JCS-SHA-256 of `policy_parameters`
  alone, via the one canonical hash path). **Coverage is PARTIAL and labeled as partial**; unmapped members are
  left blank rather than guessed. The proof-suite delta (`Ed25519Signature2020` vs `eddsa-jcs-2022`) is stated.
  **The AGA column is a DATED OBSERVATION (2026-07-16), INTEROP-ONLY** — congruence with earlier-shipped OCG
  features and a pending patent application are both recorded as observation; it is not an endorsement, not a
  compatibility claim, and no AGA export profile is defined.
- Fully additive: no envelope/hash/schema change, `chaingraph_version` stays `0.4.0`, every existing
  `execution_hash` is byte-identical, and every new normative MUST binds to an existing §15 gate — no new gate
  script and no new §15 row.
- Attribution: Robocorp work-items (Apache-2.0, patterns only — maintenance mode, no dependency), Windmill
  suspend/approval (AGPLv3, semantics only, never code or text), UiPath Business/System split (convergent prior
  art), OpenTimestamps, NIST IR 8547, W3C WebAssembly 3.0 Deterministic Profile (CR, April 2026).

## 0.8.8 — `seeded-stochastic` determinism class (§24.6.2) + the deferred vouch-hunt record bump
- **Record bump plus one new section.** The vouch-hunt additive pass (§20.2 witness cosignatures, §21.5
  `claim_strength`, §22.9 AR4SI/EAR failure receipts, §22.10 Biscuit attenuation, §24.6 determinism-class
  declaration, §24.6.1 `quantization_parity`) was already normative in `SPEC.md`; its `spec_version` bump was
  deferred to a coordinated K landing to avoid a `chaingraph.json` single-writer collision. This entry moves the
  record from 0.8.7 to 0.8.8 across every declared surface and adds §24.6.2.
- **§24.6.2 `seeded-stochastic`** — a determinism class STRONGER than `estimated`: the kernel MUST carry a named
  `prng_algorithm` (integer-only; the reference deployment uses `xoshiro256**` seeded through `splitmix64`), an
  integer `seed`, and the `draw_count` consumed, and replay at the same inputs and seed MUST reproduce a
  bit-identical `output_payload`, hence a byte-identical `execution_hash`. A kernel that cannot meet that bar MUST
  declare `estimated` — under-claiming stays conformant (§11).
- **Gated, not asserted** — new §15 row + `seed-replay.test.mjs`: replay against a committed reference vector, a
  tampered-seed negative fixture that MUST fail (proving the seed is load-bearing, not decorative), and a
  per-kernel replay/perturb check for any kernel declaring the class. The first two run unconditionally, so the
  paths stay proven while the estate has no adopters.
- **Specified, not yet adopted** — no live kernel declares `seeded-stochastic` at 0.8.8. `art-371`
  (`simulate_var_monte_carlo`) already carries `prng_algorithm`/`seed`/`draw_count` but continues to declare
  `estimated`; migrating it moves that node's `execution_hash`, so it is a kernel-versioning event tracked
  separately, not part of this tick.
- Fully additive: no envelope/hash/schema change, `chaingraph_version` stays `0.4.0`, every existing
  `execution_hash` is byte-identical.

## 0.8.7 — ML landing-pass riders (§HASHRES-1, §PQC-1, §REVOKE-1, §SIDECAR)
- **Record bump only — all four sections were already normative in `SPEC.md` since the additive landing pass.**
  This entry moves the `spec_version` of record from 0.8.6 to 0.8.7 across every declared surface. Folded into the
  GD-1 reserve-disclosure-checker landing so the `chaingraph.json` single-writer edit is touched once.
- **§HASHRES-1** — Ledger hash-resolution addressing contract (RFC 6920 / ISO 18670 SWHID), informative SCITT alignment.
- **§PQC-1** — hybrid dual §16 Data Integrity proof over the same JCS bytes (`eddsa-jcs-2022` + a TBD-on-registration
  ML-DSA cryptosuite; verifier policy modes classical/pq/both); retires the parked PQC-COSE detour.
- **§REVOKE-1** — OPTIONAL W3C BitstringStatusList receipt/key revocation reference under `audit_signature`.
- **§SIDECAR** — small riders: Identity Sidecar pattern, tiered `OCG-Verify`/`OCG-Execute`/`OCG-Prove` labels atop §15,
  reserved resource-narrowing invariant for future multi-hop mandates, Vouch Protocol prior-art acknowledgement.
- Fully additive: no envelope/hash/schema change, `chaingraph_version` stays `0.4.0`, every existing `execution_hash`
  is byte-identical, and each new normative MUST binds to an existing §15 gate.

## 0.8.6 — Deterministic Compute Profile `@2`: WebCrypto subset split (§24.5)
- **§24.5 `ocg-deterministic-compute@2` (new, normative, profile-scoped).** A new profile version — a new named
  profile ALONGSIDE `@1` per the §24.2 freeze clause, never an in-place edit of `@1` — that keeps rows D1–D6
  unchanged and ENUMERATES the WebCrypto split inside D7, resolving the over-reading that `@1`'s "platform APIs"
  wording could ban all of WebCrypto. **ALLOWED** as fully-specified deterministic replacements under D7:
  `crypto.subtle.digest` (SHA-256/384), `crypto.subtle.importKey`, `crypto.subtle.verify` — pure functions of
  their inputs, no entropy, so they satisfy "used identically on every surface" and MUST be byte-identical across
  the browser tool, the Cloudflare Worker, and the in-browser QuickJS VM. **BANNED** as D5 randomness:
  `crypto.getRandomValues`, `crypto.subtle.generateKey`, `crypto.subtle.sign` (fresh-key signing draws entropy) —
  MUST throw inside a conforming compute surface; a kernel reaching for them fails, never silently degrades an
  `output_payload`. Additive and profile-scoped: moves NO `execution_hash` — the six previously-VM-unrunnable
  kernels (art-55/124/129/189/190 crypto + art-201 BigInt) emit the SAME bytes the Worker already produces — the
  frozen v0.4 envelope and §4 preimage are UNTOUCHED, `chaingraph_version` stays `0.4.0`, only `spec_version` bumps
  to 0.8.6. The AINumbers reference deployment re-declares its `gpu:false` live set as `@2`-conforming; receipts
  minted under `@1` verify under `@1` forever. Conformance stays decided by the existing §15 gate suite (§24.3);
  `@2` adds the VM↔Worker byte-identity of the deterministic subset (`vm-parity-gate.mjs`), no new §15 row.

## 0.8.5 — Private-Input Profile (§25)
- **§25 Private-Input Profile (new, normative, profile-scoped).** Adds `ocg-private-input@1`, the
  machine-declared, machine-checked form of the §18.3 input-hiding mode — closing the white paper §6.4 caveat that
  the mode was "specified and not yet exercised by a production node." Three additions, no new integrity
  machinery: (1) the OPTIONAL hash-excluded top-level `private_inputs[]` declaration — each entry an RFC 6901
  `pointer` into `policy_parameters` + a `commitment` + a `commitment_scheme`; (2) the commitment scheme
  `sha256-salted@1`, `commitment = SHA-256(salt ‖ cgCanon(input))` with a fresh ≥256-bit prover-held `salt`,
  which is simultaneously HIDING (a bare `SHA-256(input)` is dictionary-attackable for low-entropy inputs and is
  rejected), DETERMINISTIC given `(input, salt)`, and risc0-private-input-bindable (the guest reads salt+input
  over the private channel and commits the commitment, never the plaintext); (3) the plaintext-exclusion invariant
  §25.2 — the value at each `pointer` IS the commitment, the plaintext never enters any §4 preimage, so the
  `execution_hash` and the §18 groth16 journal bind the commitment not the value — and the `validate_private_inputs`
  verifier that checks {proof binds commitment} + {journal.output == output_payload} + {commitment well-formed}
  WITHOUT the plaintext, with an authorized-verifier path that re-derives the commitment from `(salt, input)`.
  §23 composition is orthogonal (an attestation vouches for the committed input; hiding and attesting stack). The
  salt is disclosure material EXCLUDED from the hash, exactly as §13.12 / §24 D5 CSPRNG salts. §15 wires
  `validate-private-inputs.test.mjs` (shape + plaintext-exclusion + scheme + journal-commits-commitment binding)
  atop the existing §18 `compute-proof.test.mjs` pairing check. **Additive and profile-scoped:** no envelope or
  hash change — `$defs/artifact.required`, the §4 preimage, and `chaingraph_version` `0.4.0` are UNTOUCHED, a
  zero-private-input artifact is byte-identical and fully conformant, and only `spec_version` bumps to 0.8.5. The
  §24.2 freeze discipline governs the commitment construction: a different scheme ships as `ocg-private-input@<n>`,
  never an in-place edit.

## 0.8.4 — Deterministic Compute Profile (§24)
- **§24 Deterministic Compute Profile (new, normative, profile-scoped).** Adds `ocg-deterministic-compute@1`, a
  NAMING of the determinism the standard already enforces (§4 canonical hash, §12 kernel binding, §17 kernel
  identity, §18.5 deterministic guest-equivalent kernels, §18.6 proof profile, §21.4 evaluator parity), modeled
  on the **W3C WebAssembly 3.0 Deterministic Profile** (W3C CR, April 2026) with a **RISC-V-style freeze clause**:
  a ratified kernel-semantics version is never revised; any change that could move a conforming kernel's
  `output_payload` (for example re-baselining `_detmath`) ships as a NEW profile version, never an in-place edit.
  §24.1 enumerates seven kernel nondeterminism sources — D1 non-finite floats, D2 iteration order, D3
  transcendental math, D4 wall-clock time, D5 randomness, D6 locale/`Intl`, D7 environment/platform APIs — and
  binds each to the EXISTING §15 gate that already fixes or bans it (`kernel-hash-integrity`, `lint-forbidden-hash`,
  `golden-parity`, `empty-input-finite`, `gate-parity`, `sd-export-roundtrip`, `kernel-coverage`). Cartesi is cited
  as the zkVM precedent; Nock/Kelvin as a philosophy footnote only. **Additive and NORMATIVE-by-naming:** no new
  machinery, no §15 row (the meta-rule holds because every requirement cites an already-wired gate), no envelope or
  hash change — `$defs/artifact`, the §4 preimage, and `chaingraph_version` `0.4.0` are UNTOUCHED, every existing
  `execution_hash` is byte-identical, and only `spec_version` bumps to 0.8.4. The base standard is unchanged for
  external implementers; an implementation green on the §15 suite already conforms.

## 0.8.3 — Input Attestations (§23)
- **§23 Input Attestations (new, normative, OPTIONAL).** Adds the top-level `input_attestations[]` array —
  per-input evidence that a NAMED input value was vouched for by an external source, WITHOUT changing what
  `execution_hash` means. Like §16 `audit_signature` and §20 `anchor_bindings`, it is attached AFTER hashing
  and EXCLUDED from the `execution_hash` preimage, so **an artifact with zero attestations stays fully
  conformant** and adding/removing/re-ordering entries leaves every existing `execution_hash` byte-identical.
  Each entry is `{ type, pointer, proof, source_ref }`: `pointer` is an RFC 6901 JSON Pointer into
  `policy_parameters` naming WHICH input; a bound digest MUST equal the SHA-256 of the §4-canonical resolved
  value. Type phasing (D2): `vc-2.0` (verified via shipped §16/§13.11 Data Integrity + subject-digest),
  `rfc3161-snapshot` (verified via the SAME §20 `rfc3161-tst` verifier — no second RFC 3161 impl),
  `c2pa-manifest` (structural + hard-binding digest match now, signer trust-chain a link-out) all verify NOW;
  `zktls` is DEFINED with verification EXTERNAL (no vendored verifier — TLSNotary-class vendoring would break
  the zero-dependency posture), reported as `verifiable:"external"`. §23.2 pins the per-input verifier report
  computed INDEPENDENTLY of the hash verdict; §23.3 pins frozen-envelope invariance: `input_attestations` is a
  new OPTIONAL top-level property (exactly like `anchor_bindings`), so `$defs/artifact.required`, the §4
  preimage members, and `chaingraph_version` `0.4.0` are UNTOUCHED. Additive: no envelope/hash change; schema
  adds `$defs/inputAttestation` + the optional `input_attestations` property; only `spec_version` bumps to
  0.8.3. Verifiable-now types reuse §16/§13.11/§20 machinery; the `validate_input_attestations` worker utility
  and Ledger verify-card rows are FORTHCOMING (worker CI enforces `validate-input-attestations.test.mjs`).

## 0.8.2 — Escalation records (§22.8)
- **§22.8 Escalation records (new, normative).** Makes the `"escalate"` **evaluator semantics** normative:
  `"escalate"` is a TERMINAL routing target beside `"end"` (§22.8.1), classified by the new single-source
  `isTerminalTarget` / `isEscalationTarget` exports in `kernels/_gateval.mjs`. `evaluateGate` returns the
  SAME decision record for an escalate route (NO escalation field is added), so every existing gate decision
  and composite `execution_hash` is byte-identical (linear-hash-freeze holds). §22.8.2 pins the runtime halt
  contract: on an escalate decision `run_chain` HALTS and marks remaining steps `skipped_by_escalation`
  (distinct from `skipped_by_gate`), attaching an OPEN escalation record. §22.8.3 resolves the DETERMINISM
  crux: the record is `{ mandate_hash?, decision, halted_steps, opened_at }`, but its **record hash** (via
  `kernels/_hash.mjs`) covers ONLY the deterministic subset `{ mandate_hash?, decision, halted_steps }`;
  `opened_at` (wall-clock) is hash-EXCLUDED, exactly like §20 anchor bindings, so the record hash is
  reproducible. §22.8.4 pins closure: an open record CLOSES only via a countersigned closure
  (`{ record_hash, decision, anchor, envelope }`) whose Anchorproof envelope signs the record hash;
  verification = envelope valid AND recomputed record hash equals `record_hash` AND decision echo.
  Transport-agnostic (§22.8.5, D3); AuthZEN / SCITT vocabulary alignment (§22.8.6). Additive: no
  envelope/hash change, `chaingraph_version` stays `0.4.0`. FORTHCOMING: the `run_chain` emit/halt
  implementation, the `verify_escalation_closure` utility, and the SEP-2322 transport binding. Gates:
  `gate-parity.test.mjs`, `linear-hash-freeze.mjs` (§15).

## 0.7.0 — Anchor Binding (§20) + SD-JWT selective-disclosure export (§13.12)
- **§20 Anchor Binding (new, normative, OPTIONAL).** An artifact MAY carry portable, offline-verifiable
  evidence that its `execution_hash` was included in a transparency log or timestamp service by a point in
  time, at the OPTIONAL top-level array `anchor_bindings` — attached AFTER hashing, EXCLUDED from
  `execution_hash` scope. Evidence types: `rfc3161-tst` (TST DER stored verbatim, never re-encoded — the
  four RFC 3161 members `policy_oid`/`serial`/`gen_time`/`signer_cert_chain_b64` are REQUIRED for that
  type), `opentimestamps` (complete proofs verify against Bitcoin block headers alone),
  `c2sp-tlog-proof-v1` (checkpoint + cosignatures + Merkle inclusion, offline-verifiable), and
  `scitt-receipt-rfc9942` (COSE receipt, accepted for interop; OCG implementations are NOT SCITT
  Transparency Services). A verifier MUST reject a binding whose `anchored_hash` differs from the
  recomputed `execution_hash`; multiple bindings MAY coexist. Honesty semantics: an anchor proves
  EXISTENCE by a time + INCLUSION in the named log — not correctness (§18), authorship (§16), or kernel
  identity (§17). Gate: `anchor-binding.test.mjs` (§15).
- **§13.12 SD-JWT selective-disclosure export profile (new, normative).** An implementation MAY export an
  artifact as an [RFC 9901](https://www.rfc-editor.org/rfc/rfc9901) SD-JWT: always-disclosed =
  `execution_hash`, `chaingraph_version`, `spec_version`, `compute_capability`, §17 identity fields, all
  outputs, timestamps; selectively disclosable = top-level input values only; JWS (EdDSA) under the §16
  signing key. Disclosure salts are freshly CSPRNG-generated per export — the one permitted
  nondeterminism, confined to the export. NORMATIVE limitation: a redacted export is NOT re-executable
  and does NOT permit `execution_hash` recomputation. Gate: `sd-export-roundtrip.test.mjs` (§15).
- **§16.5 Proof sets and endorsement chains (clarification, normative).** `audit_signature.proof` MAY be
  an array (VC Data Integrity 1.0 proof-set semantics); an ENDORSEMENT (countersignature) MUST use
  proof-chain semantics via `previousProof`, verified in dependency order. eddsa-jcs-2022 throughout.
  Countersignature fixture added to `proof-binding.test.mjs` (§15).
- **Optional `supersedes` (§1, additive).** Top-level array of `sha256:`-prefixed execution_hashes this
  artifact corrects or replaces. Declared at creation; NO reverse link, NO status registry. Shape-checked
  by `schema-validate.mjs` (§15).
- **No envelope/hash/schema change.** Artifacts still emit `chaingraph_version:"0.4.0"`; the schema
  filename stays `openchain-graph-v0.4.schema.json` (new fields optional/additive: `anchor_bindings`,
  `supersedes`, `$defs.anchorBinding`; catalog `spec_version` pattern widened to `^0\.[4567]\.[0-9]+$`).
  Only `spec_version` bumps 0.6.1 → 0.7.0.

## 0.6.1 — Deterministic-node proof profile (§18.6)
- **§18.6 `ocg-p18-deterministic` (new, normative, profile-scoped).** Additive conformance profile an
  implementation MAY opt into. Under it, every `status:"live"` `gpu:false` node MUST carry a verifying
  `compute_proof` (groth16-bn254/stark, `imageId` in `compute_images`, journal output == `output_payload`) OR
  declare `compute_proof_ready:"deferred"` with a `deferral_reason`; `gpu:true` is out of scope (prohibitive
  in-guest proving cost, §18.2). Base §18 stays OPTIONAL for non-profile implementers. Machine-checked by
  `check-compute-proof-coverage.mjs` (coverage + binding shape + downward-only deferred ratchet). No
  envelope/hash/schema change: artifacts still emit `chaingraph_version:"0.4.0"`; schema filename stays
  `openchain-graph-v0.4.schema.json`; only `spec_version` bumps 0.6.0 → 0.6.1. The AINumbers reference
  deployment conforms with zero deferrals.

## 0.6.0 — Kernel Identity Binding (§17) + Compute-Integrity Proof (§18, zkVM)
- **§17 Kernel Identity Binding (new, normative).** An artifact MAY record the content digest of the exact
  kernel that produced it at `audit_signature.build_identity` (`{kernel_digest, buildType, source_ref?}`),
  closing the §4 gap that `execution_hash` proves *"output follows from inputs by **some** logic"* but does
  not pin *which* logic ran. `kernel_digest` = WebCrypto SHA-256 over the kernel's canonical source bytes
  (LF-normalized) via the shared `kernels/_buildid.mjs`. A node SHOULD publish it in the Graph Index node
  field `compute_images[]` (`system:"sha256-source"`); a verifier cross-checks artifact ↔ Graph Index ↔
  recomputed source. **Honesty caveat (§17.2):** §17 is an *advisory published claim* of which kernel SOURCE
  ran, not a proof of execution — that is §18.
- **§18 Compute-Integrity Proof (new, normative).** An artifact MAY attach an OPTIONAL **zkVM receipt** at
  `audit_signature.compute_proof` (`{type:"ZkVmReceipt", system, receiptFormat, imageId, seal, journal}`),
  turning the §4 hash from *re-execute-to-verify* into a **succinct proof of correct execution** — verifiable
  **without re-execution** and, optionally, **without seeing the inputs** (confidentiality, §18.3). OCG's
  analogue of the chained-verifiable-computation goal in
  [Trusted Compute Units (arXiv:2504.15717)](https://arxiv.org/abs/2504.15717) — but **software/cryptographic
  only: no TEE, no hardware enclave, no blockchain anchor.** System-agnostic; `groth16-bn254` is the
  RECOMMENDED interop receipt form (~200-byte SNARK, ms-verifiable in browser/Worker/CI — both Risc0 and SP1
  emit it). **Seal cryptographic verification is DELEGATED** to the named zkVM's vetted verifier (§18.1),
  exactly as §4 delegates SHA-256 and §16 delegates Ed25519 to WebCrypto; OCG specifies the **binding**, not a
  re-implemented proof system. **Proving is off-band (§18.2):** zkVM proving needs Rust + heavy compute and
  MUST NOT be claimed to run in the browser tool, the Worker, or CI — a `compute_proof` is produced offline
  and attached; live surfaces only verify. Default-off (§18.3).
- **Strength-of-verifiable ladder (§18.4).** L1 §4 hash (tamper-evidence) → L2 §16 proof (authenticated
  attestation) → L3 §18 receipt (succinct compute-integrity, optionally confidential). The layers compose; a
  §18 receipt MAY itself be covered by a §16 proof.
- **Backward-compatible.** All three new fields are hash-excluded and live under the tolerant `audit_signature`
  object — the artifact root stays `additionalProperties:false`, so a v0.6 artifact still validates under the
  frozen v0.4 schema. Hash preimage unchanged; `chaingraph_version` stays `"0.4.0"`; an artifact carrying
  neither `build_identity` nor `compute_proof` is byte-identical to v0.5. Only `spec_version` bumps to `0.6.0`.
- **Schema.** Adds `$defs.buildIdentity` + `$defs.computeProof`; optional `audit_signature.build_identity` +
  `audit_signature.compute_proof`; optional node `compute_images[]`; widens the catalog `spec_version` pattern
  to `^0\.[456]\.[0-9]+$`. Filename stays `openchain-graph-v0.4.schema.json` (envelope unchanged).
- Gates: `kernel-identity.test.mjs` (§17) + `compute-proof.test.mjs` (§18) — see §15.

## 0.5.0 — Proof Binding (§16) + audit_signature schema alignment
- **§16 Proof Binding (new, normative).** A node MAY attach an OPTIONAL **W3C Data Integrity proof**
  (cryptosuite `eddsa-jcs-2022`, [Rec 2025-05](https://www.w3.org/TR/vc-di-eddsa/)) at `audit_signature.proof`,
  turning the §4 hash from tamper-evidence into authenticated attestation — filling the §13.11 gap (the `vc`
  view mints no securing proof). Whole-artifact signing via the stock Data Integrity pipeline
  (Transform→Hash→Sign), reusing the §4 JCS canonicalizer (`kernels/_hash.mjs` `cgCanon`) — no second
  canonicalization path. Ed25519 over WebCrypto; `verificationMethod` is a did:key (§9).
- **Backward-compatible.** Hash preimage unchanged; `chaingraph_version` stays `"0.4.0"`; only `spec_version`
  bumps to `0.5.0`. The proof is homed at `audit_signature.proof` (NOT artifact root, NOT `signatures[]`):
  the artifact root is `additionalProperties:false`, so a root field would break v0.4 verifiers, but
  `audit_signature` tolerates added properties — a signed v0.5 artifact still validates under the frozen v0.4
  schema. An unsigned artifact is byte-identical to v0.4.1.
- **Default-off, privacy-guarded (§16.2).** Signing de-anonymizes a run (links it to a key), so Proof Binding
  MUST default OFF and surface that tradeoff. For ephemeral/client-side signing a did:key suffices; a stable
  institutional issuer SHOULD use did:web + HSM/KMS + server-side signing (§16.4) — a private key MUST NOT
  ship client-side.
- **Schema.** Adds `$defs.dataIntegrityProof` + optional `audit_signature.proof`; widens the catalog
  `spec_version` pattern to `^0\.[45]\.[0-9]+$`. Filename stays `openchain-graph-v0.4.schema.json` (envelope
  unchanged). Gate: `proof-binding.test.mjs` (§15).
- **`audit_signature` schema alignment (corrective).** Removed the stale `required: [client_side_executed,
  zero_pii_verified, deterministic_run]` array — these three boolean fields were never emitted by the canonical
  DSSE shell (`payloadType`/`payload`/`signatures`) shipped with v0.4. Added `payloadType` and `payload` as
  declared (optional) properties so the actual emitted shell validates cleanly. The three booleans remain as
  optional, typed properties. No hash preimage, `chaingraph_version`, or artifact envelope change.

## 0.4.1 — Verifiable Credentials export profile
- **§13.11 `vc` export profile (new, normative).** `export_artifact` can render any verified artifact as a
  [W3C Verifiable Credentials 2.0](https://www.w3.org/TR/vc-data-model-2.0/) credential (`application/vc+json`).
  Maps the envelope to VC fields (`issuer`/`credentialSubject`/`validFrom`/`validUntil`) and carries an
  `ocg:hashAnchor` that re-states the canonical `execution_hash`. It is a **base profile** — available on every
  node, no `export_capability` declaration required.
- **View, not a fact.** Like every §13 profile, `vc` mints no new `execution_hash` and adds no securing `proof`;
  verification routes back to the canonical JSON artifact. Deterministic (id derived from the hash; no UUID/clock).
- **Envelope + hash preimage unchanged.** Export profiles are not part of the artifact envelope, so artifacts
  still emit `chaingraph_version:"0.4.0"` and stay valid under any v0.4 verifier. Only `spec_version` bumps to 0.4.1.
- Gate: `exporters/export.test.mjs` (unit) + `smoke-compute.mjs` export round-trip (post-deploy).

## 0.4.0 — Compute Binding + Export Profiles
- **§12 Compute Binding (new, normative).** A `gpu:false` node MAY declare `compute_capability:"server"`
  and ship a registered server-side kernel, so an agent gets a verifiable artifact in one MCP round-trip.
  Every `gpu:false` node MUST have a kernel (`kernel-coverage.mjs --strict`) — a missing kernel fails CI,
  never a silent skip. Artifact adds `compute_mode` (`server|browser`), excluded from the hash preimage.
- **§13 Export Profiles (new, normative).** Generated, non-canonical renderings (xlsx/pdf/csv/xbrl) of an
  already-verified artifact, produced after `execution_hash` and excluded from the hash preimage. Single
  read-only `export_artifact` MCP tool; per-node `export_capability[]` discovery; no fabricated XBRL concepts.
- **Hash preimage unchanged.** A v0.4 artifact is verifiable by any v0.3 verifier that ignores unknown fields.
- **SSOT reconciliation.** This `standard/` directory becomes the single normative source: `SPEC.md` (prose)
  + `openchain-graph-v0.4.schema.json` (machine). `openchain-graph-spec.html` renders it; `CONTRACT.md` §A3
  references it; `chaingraph.json` + emitted artifacts validate against the schema in CI.
- **Schema strictness.** The artifact envelope and the catalog node object are both `additionalProperties:false`
  (single-producer internal catalog — strictness catches our own typo/drift fields). `deadline` is nullable.

## 0.3.1 — base for v0.4
- ISO 20022 semantic profile (§8), LEI & did:key party identity (§9), OKF companion bundle (§10),
  profile conformance (§11), DCAT 3.0 Graph Index (§7). Provenance envelope + canonical `execution_hash` (§4).
