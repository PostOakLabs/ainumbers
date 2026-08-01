---
type: Attested Computation
title: "Build Allocation Decision Receipt — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-515-build-allocation-decision-receipt.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-515-build-allocation-decision-receipt.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Build Allocation Decision Receipt — attested computation

> §10.2 Attested Computation binding for [Build Allocation Decision Receipt](../tools/art-515-build-allocation-decision-receipt.md).

## Executor

Kernel source: `chaingraph/kernels/art-515-build-allocation-decision-receipt.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cfa8312a00a78e19af8654199d3cfbc6224cc85e41ade3919d9eca0e60f46b40` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
