---
type: Attested Computation
title: "ACA Employer Shared Responsibility Payment Exposure Calculator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-299-aca-esrp-exposure.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-299-aca-esrp-exposure.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ACA Employer Shared Responsibility Payment Exposure Calculator — attested computation

> §10.2 Attested Computation binding for [ACA Employer Shared Responsibility Payment Exposure Calculator](../tools/art-299-aca-esrp-exposure.md).

## Executor

Kernel source: `chaingraph/kernels/art-299-aca-esrp-exposure.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:d07a15cc7c7b3da43db92b15595249dcb3e8a81ca73d2e0144172de35b6e410e` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
