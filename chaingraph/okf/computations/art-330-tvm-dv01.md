---
type: Attested Computation
title: "Bond DV01 (Price Value of a Basis Point) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the analytics_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-330-tvm-dv01.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-330-tvm-dv01.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Bond DV01 (Price Value of a Basis Point) — attested computation

> §10.2 Attested Computation binding for [Bond DV01 (Price Value of a Basis Point)](../tools/art-330-tvm-dv01.md).

## Executor

Kernel source: `chaingraph/kernels/art-330-tvm-dv01.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:76262e8984a1549f9ff95eb1312333c269fc15afbeb9c2f7fc6a7364393ef966` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
