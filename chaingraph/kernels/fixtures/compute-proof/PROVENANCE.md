# §18 compute-proof fixture — provenance

`art-04-agent-identity-attestation-checker.receipt.json` is a **real** RISC Zero Groth16-BN254 receipt
(`RISC0_DEV_MODE=0`, no fake/dev receipt). `compute-proof.test.mjs` verifies it against its published
ImageID via the self-contained BN254 verifier in `_computeproof.mjs` (green = a real proof verified).

## What the proof attests
A risc0 zkVM guest (a Rust port of art-04's `compute()`) ran on the canonical test
`policy_parameters` and committed, as its journal, the canonical JSON
`JCS({ chaingraph_version:"0.4.0", kernel_digest, output })` where `output` is byte-identical to the JS
kernel's `compute(pp).output_payload`. The receipt proves the named program (ImageID below) produced that
journal; `verifySeal` reconstructs the risc0 ReceiptClaim digest from `(imageId, journal)` and checks the
Groth16 pairing against the published risc0 verifying key.

- **ImageID:** `sha256:93c746e79afcf4b27f6d2a6da6cd142a4dd0da31f33d942f92b97344188526c5`
- **kernel_digest (§17):** `sha256:f4e9e5aed913e80c7f97e3d0d2501e7349c523de4ffd433a1d29081620197b1f`
  (SHA-256 of the LF-normalized art-04 kernel source, via `_buildid.mjs`)
- **receiptFormat:** `groth16-bn254` (256-byte BN254 Groth16 seal)
- **journal:** 520 bytes UTF-8

## Toolchain (reproducibility)
- rustc 1.96.0, cargo-risczero 3.0.5, r0vm 3.0.5, risc0-zkvm ^3.0.5, risc0-groth16 3.0.4
- Linux (WSL2 Ubuntu-24.04), Docker (native `docker.io`) for the STARK→Groth16 wrap
- Guest: `slice/methods/guest/src/main.rs` (Rust port of art-04 `compute()`, commits the canonical journal)
- Prove: `RISC0_DEV_MODE=0 RISC0_WORK_DIR=… cargo run --release --bin host` (`ProverOpts::groth16()`)
- Verifying-key + control constants embedded in `_computeproof.mjs` are risc0 v3.0.x defaults
  (`risc0-groth16` verifier.rs + `Groth16ReceiptVerifierParameters::default()`).

## Scope (slice limitation)
This is the §18 vertical slice: ONE FP-safe kernel, Rust-ported (NOT the QuickJS-in-guest runner), with the
`policy_parameters` fixed and the `kernel_digest` declared as a guest constant. The universal QuickJS runner
(one ImageID for all kernels, kernel source as a private input) and rollout to the other nodes are a later phase.
