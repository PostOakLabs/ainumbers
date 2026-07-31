---
type: Attested Computation
title: "NAIC AI Systems Program Readiness Assessment — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-240-assess-naic-ais-program-readiness.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-240-assess-naic-ais-program-readiness.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NAIC AI Systems Program Readiness Assessment — attested computation

> §10.2 Attested Computation binding for [NAIC AI Systems Program Readiness Assessment](../tools/art-240-assess-naic-ais-program-readiness.md).

## Executor

Kernel source: `chaingraph/kernels/art-240-assess-naic-ais-program-readiness.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:ed2e6920e271e9beb07ec2b652b464385e213299d2abc4cbe33b2a28397bbc61` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
