---
type: Attested Computation
title: "CSCF Control Applicability & Coverage — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-486-cscf-control-applicability.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-486-cscf-control-applicability.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CSCF Control Applicability & Coverage — attested computation

> §10.2 Attested Computation binding for [CSCF Control Applicability & Coverage](../tools/art-486-cscf-control-applicability.md).

## Executor

Kernel source: `chaingraph/kernels/art-486-cscf-control-applicability.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e61f7e68aeceece5e32ce4f26e110cac1da3e8f1a8d79d74304674e7de0c8484` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
