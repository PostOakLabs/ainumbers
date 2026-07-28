---
type: Attested Computation
title: "IRRBB Basis-Risk NII Shock Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-443-irrbb-basis-risk-nii-shock-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-443-irrbb-basis-risk-nii-shock-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# IRRBB Basis-Risk NII Shock Calculator — attested computation

> §10.2 Attested Computation binding for [IRRBB Basis-Risk NII Shock Calculator](../tools/art-443-irrbb-basis-risk-nii-shock-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-443-irrbb-basis-risk-nii-shock-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6a53b2b9e42a854d9801a6759fcc8e62fbd7ee5f0585ea83b9c43165bf2d9bcc` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
