---
type: Attested Computation
title: "Retail Installment Contract TILA Disclosure Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-404-check-retail-installment-disclosures.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-404-check-retail-installment-disclosures.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Retail Installment Contract TILA Disclosure Checker — attested computation

> §10.2 Attested Computation binding for [Retail Installment Contract TILA Disclosure Checker](../tools/art-404-check-retail-installment-disclosures.md).

## Executor

Kernel source: `chaingraph/kernels/art-404-check-retail-installment-disclosures.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:06ea130127d2c462fd7cf1f689399a8c38d577cfe49220ea12f30a71eacaf87e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
