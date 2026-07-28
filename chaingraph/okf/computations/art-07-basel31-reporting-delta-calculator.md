---
type: Attested Computation
title: "Basel 3.1 Reporting Delta Calculator — attested computation"
runtime: browser
computation: "Kernel-backed evaluation for the capital_assessment decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-07-basel31-reporting-delta-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-07-basel31-reporting-delta-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Basel 3.1 Reporting Delta Calculator — attested computation

> §10.2 Attested Computation binding for [Basel 3.1 Reporting Delta Calculator](../tools/art-07-basel31-reporting-delta-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-07-basel31-reporting-delta-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bb655f6f08ccd299198d1eff963940525ec31c073ef296bfce08503620cb28c7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
