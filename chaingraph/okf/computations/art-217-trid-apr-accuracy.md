---
type: Attested Computation
title: "TRID APR Accuracy Verifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-217-trid-apr-accuracy.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-217-trid-apr-accuracy.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# TRID APR Accuracy Verifier — attested computation

> §10.2 Attested Computation binding for [TRID APR Accuracy Verifier](../tools/art-217-trid-apr-accuracy.md).

## Executor

Kernel source: `chaingraph/kernels/art-217-trid-apr-accuracy.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:a74ebe7cdb837e03a939cbe160d49a4f412192f9c98d5d928c8daddda570f8fd` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
