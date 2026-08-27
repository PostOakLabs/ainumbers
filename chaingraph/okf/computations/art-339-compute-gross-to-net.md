---
type: Attested Computation
title: "Gross-to-Net Payroll Calculator (FICA) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-339-compute-gross-to-net.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-339-compute-gross-to-net.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Gross-to-Net Payroll Calculator (FICA) — attested computation

> §10.2 Attested Computation binding for [Gross-to-Net Payroll Calculator (FICA)](../tools/art-339-compute-gross-to-net.md).

## Executor

Kernel source: `chaingraph/kernels/art-339-compute-gross-to-net.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:884e9783d26552ef06435b323571abcc4f1cecc3b10648477fa0291b39dab877` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
