---
type: Attested Computation
title: "§125 Cafeteria Plan Nondiscrimination Tester — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-301-section125-ndt.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-301-section125-ndt.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# §125 Cafeteria Plan Nondiscrimination Tester — attested computation

> §10.2 Attested Computation binding for [§125 Cafeteria Plan Nondiscrimination Tester](../tools/art-301-section125-ndt.md).

## Executor

Kernel source: `chaingraph/kernels/art-301-section125-ndt.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:88e54dc6a5136721213a32c5acbcb0563bf120ad2af4e3f8e9f58caadc9665da` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
