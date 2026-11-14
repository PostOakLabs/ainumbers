---
type: Attested Computation
title: "x402 Exact Solana Payment Outcome Recompute — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-781-x402-svm-payment-outcome.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-781-x402-svm-payment-outcome.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# x402 Exact Solana Payment Outcome Recompute — attested computation

> §10.2 Attested Computation binding for [x402 Exact Solana Payment Outcome Recompute](../tools/art-781-x402-svm-payment-outcome.md).

## Executor

The kernel is deterministic source, values only: pasted instruction fields, PaymentRequirements and mint configuration in; clause verdicts, recomputed recipient ATAs and the net received amount out. Vendored SHA-256 and Ed25519 (decompression and signature verification on caller-pasted bytes), base58 integer conversion, ceiling-division fee arithmetic in BigInt. Zero network, zero RPC, no facilitator call, no balance lookup.

## Attestation

zkVM proof deferred (`compute_proof_ready: deferred`); the sha256-source image is pinned in the shard `compute_images`. Conformance fixtures vendored at `chaingraph/kernels/fixtures/art-781-x402-svm-payment-outcome.fixtures.json` (27 vectors) with a property-test floor at `chaingraph/kernels/__proptests__/art-781-x402-svm-payment-outcome.proptest.mjs`.
