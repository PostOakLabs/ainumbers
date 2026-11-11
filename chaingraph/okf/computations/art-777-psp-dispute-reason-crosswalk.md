---
type: Attested Computation
title: "PSP Dispute Reason Crosswalk — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-777-psp-dispute-reason-crosswalk.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-777-psp-dispute-reason-crosswalk.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# PSP Dispute Reason Crosswalk — attested computation

> §10.2 Attested Computation binding for [PSP Dispute Reason Crosswalk](../tools/art-777-psp-dispute-reason-crosswalk.md).

## Executor

Kernel source: `chaingraph/kernels/art-777-psp-dispute-reason-crosswalk.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8932a23abee00ab938d8cbc12ccc3cc44bd59addb232c25e4097e343e4383037` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
