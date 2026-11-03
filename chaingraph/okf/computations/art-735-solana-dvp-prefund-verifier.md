---
type: Attested Computation
title: "Solana DvP Pre-Funding Terms Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the settlement_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-735-solana-dvp-prefund-verifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-735-solana-dvp-prefund-verifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Solana DvP Pre-Funding Terms Verifier — attested computation

> §10.2 Attested Computation binding for [Solana DvP Pre-Funding Terms Verifier](../tools/art-735-solana-dvp-prefund-verifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-735-solana-dvp-prefund-verifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7f829143fa17775ede38a2a9591a5de5b4f4090ce1f6e12e9d0cfc41d97b560b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
