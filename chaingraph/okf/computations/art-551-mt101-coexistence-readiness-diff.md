---
type: Attested Computation
title: "Swift MT101 Coexistence Readiness Diff — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-551-mt101-coexistence-readiness-diff.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-551-mt101-coexistence-readiness-diff.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Swift MT101 Coexistence Readiness Diff — attested computation

> §10.2 Attested Computation binding for [Swift MT101 Coexistence Readiness Diff](../tools/art-551-mt101-coexistence-readiness-diff.md).

## Executor

Kernel source: `chaingraph/kernels/art-551-mt101-coexistence-readiness-diff.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3c1274fc147ac5bb67216765094aaf175766d6505785a4e2a5d45f7f9fd4983d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
