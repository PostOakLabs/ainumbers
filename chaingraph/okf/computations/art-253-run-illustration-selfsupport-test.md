---
type: Attested Computation
title: "Life Illustration Self-Support Test (NAIC Model 582) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-253-run-illustration-selfsupport-test.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-253-run-illustration-selfsupport-test.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Life Illustration Self-Support Test (NAIC Model 582) — attested computation

> §10.2 Attested Computation binding for [Life Illustration Self-Support Test (NAIC Model 582)](../tools/art-253-run-illustration-selfsupport-test.md).

## Executor

Kernel source: `chaingraph/kernels/art-253-run-illustration-selfsupport-test.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:7752a4c0f60362741de571e3a2ec25b3797b26ca9da1f2d301742e230dc2a91e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
