# OpenChainGraph Standard — Changelog

One row per spec version. The version of record is `chaingraph.json.spec_version`; this file
narrates what each bump changed. Normative definitions live in `SPEC.md` + `openchain-graph-v0.4.schema.json`.

## 0.5.0 — Proof Binding (§16)
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
