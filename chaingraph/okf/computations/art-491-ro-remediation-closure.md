---
type: Attested Computation
title: "FATCA/CRS RO Remediation Closure Tracker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the attestation_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-491-ro-remediation-closure.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-491-ro-remediation-closure.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FATCA/CRS RO Remediation Closure Tracker — attested computation

> §10.2 Attested Computation binding for [FATCA/CRS RO Remediation Closure Tracker](../tools/art-491-ro-remediation-closure.md).

## Executor

Kernel source: `chaingraph/kernels/art-491-ro-remediation-closure.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3a605809e324af32ea025897ba46618e869f3a5701025e98ba5a7ff74a25847e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
