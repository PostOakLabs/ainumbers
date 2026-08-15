# ics23-testvectors provenance

Fetched live 2026-08-15 from `cosmos/ics23` (Apache-2.0), `master` branch, for
`ICS23-VERIFY-MODULE-1`'s regression proof (`ics23-verify.test.mjs`). Re-fetch and re-hash at any
future build touching these fixtures — living-branch copies, not tagged releases, per
`ICS23-PROOFSPEC-BUILD-SPEC.md` §1's caveat.

- `iavl/`, `tendermint/`, `smt/` — `testdata/{iavl,tendermint,smt}/{exist_left,exist_middle,
  exist_right,nonexist_left,nonexist_middle,nonexist_right}.json`. Each file is
  `{key, value, root, proof}` (key/value/root hex; `proof` is the hex-encoded serialized
  `CommitmentProof` protobuf message) — decoded at test time by the minimal protobuf reader in
  `ics23-verify.test.mjs` (scoped to the five message types in `proofs.proto`, test-harness-only,
  not part of the shipped module).
- `TestCheckAgainstSpecData.json` — `testdata/TestCheckAgainstSpecData.json`, the direct regression
  fixture for the October 2022 VSA-2022-103 fix (`CheckAgainstSpec` hardening). Already JSON-native
  (base64 byte fields, field names matching `proofs.proto`) — no protobuf decode needed.

`proofs.proto` sha256 re-verified at fetch time: `49eb9317e4ea2388f5c9404c4a728761815110875f3be28a80ba8dea46703a02`, matching the pin in
`ICS23-PROOFSPEC-BUILD-SPEC.md` §1 exactly.
