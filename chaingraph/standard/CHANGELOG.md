# OpenChainGraph Standard — Changelog

One row per spec version. The version of record is `chaingraph.json.spec_version`; this file
narrates what each bump changed. Normative definitions live in `SPEC.md` + `openchain-graph-v0.4.schema.json`.

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
