---
type: Attested Computation
title: "Call Report Published Edit-Check Gate — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the regulatory_reporting decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-434-call-report-edit-check-gate.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-434-call-report-edit-check-gate.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Call Report Published Edit-Check Gate — attested computation

> §10.2 Attested Computation binding for [Call Report Published Edit-Check Gate](../tools/art-434-call-report-edit-check-gate.md).

## Executor

Kernel source: `chaingraph/kernels/art-434-call-report-edit-check-gate.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fc730e1410814863f534802d3bcd7d948ac232f8f1fb5ddcf9078e4c97dd075d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
