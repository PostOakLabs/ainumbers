# OpenChainGraph Standard — Changelog

One row per spec version. The version of record is `chaingraph.json.spec_version`; this file
narrates what each bump changed. Normative definitions live in `SPEC.md` + `openchain-graph-v0.4.schema.json`.

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
