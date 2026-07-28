---
type: Attested Computation
title: "ViDA OSS Registration Router — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-163-vida-oss-registration-router.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-163-vida-oss-registration-router.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# ViDA OSS Registration Router — attested computation

> §10.2 Attested Computation binding for [ViDA OSS Registration Router](../tools/art-163-vida-oss-registration-router.md).

## Executor

Kernel source: `chaingraph/kernels/art-163-vida-oss-registration-router.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e9b1818d3a4a679dc9585a58e6326dbccbfd2d60ea6a738cf3cd6b51adfb12ef` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
