---
type: Attested Computation
title: "Eval Attestation Receipt Composer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the governance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-438-eval-attestation-receipt-composer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-438-eval-attestation-receipt-composer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Eval Attestation Receipt Composer — attested computation

> §10.2 Attested Computation binding for [Eval Attestation Receipt Composer](../tools/art-438-eval-attestation-receipt-composer.md).

## Executor

Kernel source: `chaingraph/kernels/art-438-eval-attestation-receipt-composer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:4dd15343a439bc1a1a1212c58f21fed27dd330d9f8cf4476bfdd468f67a7624e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
