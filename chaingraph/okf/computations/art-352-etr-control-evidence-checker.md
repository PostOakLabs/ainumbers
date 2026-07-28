---
type: Attested Computation
title: "ETR Singularity & Exclusive-Control Evidence Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-352-etr-control-evidence-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-352-etr-control-evidence-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ETR Singularity & Exclusive-Control Evidence Checker — attested computation

> §10.2 Attested Computation binding for [ETR Singularity & Exclusive-Control Evidence Checker](../tools/art-352-etr-control-evidence-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-352-etr-control-evidence-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e9bbe808cfaec0c0c043fb1b8936ec1bff6a491ee704298662e13591cfdbdd8f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
