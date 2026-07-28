---
type: Attested Computation
title: "FR Y-9C Schedule HC-R (Regulatory Capital) Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-436-bhc-schedule-hcr-capital.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-436-bhc-schedule-hcr-capital.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FR Y-9C Schedule HC-R (Regulatory Capital) Calculator — attested computation

> §10.2 Attested Computation binding for [FR Y-9C Schedule HC-R (Regulatory Capital) Calculator](../tools/art-436-bhc-schedule-hcr-capital.md).

## Executor

Kernel source: `chaingraph/kernels/art-436-bhc-schedule-hcr-capital.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3eb8ae80e279ce36b74155e260a9f47adda9dd53dc62f3668ff6dd3a1e90b295` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
