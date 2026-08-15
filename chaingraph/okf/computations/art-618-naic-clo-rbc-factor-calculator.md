---
type: Attested Computation
title: "NAIC CLO/CBO/CDO Tranche RBC Factor Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-618-naic-clo-rbc-factor-calculator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-618-naic-clo-rbc-factor-calculator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NAIC CLO/CBO/CDO Tranche RBC Factor Calculator — attested computation

> §10.2 Attested Computation binding for [NAIC CLO/CBO/CDO Tranche RBC Factor Calculator](../tools/art-618-naic-clo-rbc-factor-calculator.md).

## Executor

Kernel source: `chaingraph/kernels/art-618-naic-clo-rbc-factor-calculator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:cb99858043a626cef3ee2982c902f5dc20456fe04034d70adf63b9a8177fd864` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
