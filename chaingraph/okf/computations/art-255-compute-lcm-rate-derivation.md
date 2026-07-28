---
type: Attested Computation
title: "LCM Rate Derivation Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-255-compute-lcm-rate-derivation.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-255-compute-lcm-rate-derivation.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# LCM Rate Derivation Calculator — attested computation

> §10.2 Attested Computation binding for [LCM Rate Derivation Calculator](../tools/art-255-compute-lcm-rate-derivation.md).

## Executor

Kernel source: `chaingraph/kernels/art-255-compute-lcm-rate-derivation.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d206ed051fd45134f40a3c4a1c1d7ff696243aa84d005225fe8c3d4e9084dca4` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
