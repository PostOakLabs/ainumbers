---
type: Attested Computation
title: "FSMA 204 Critical Tracking Event (CTE) Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-118-fsma204-cte-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-118-fsma204-cte-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# FSMA 204 Critical Tracking Event (CTE) Validator — attested computation

> §10.2 Attested Computation binding for [FSMA 204 Critical Tracking Event (CTE) Validator](../tools/art-118-fsma204-cte-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-118-fsma204-cte-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e34e3e945044a3bafac4c9c72d15227e4b0a89ddff995e5afb0f4ae661015922` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
