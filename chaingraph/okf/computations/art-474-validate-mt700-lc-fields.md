---
type: Attested Computation
title: "MT700 LC Field Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-474-validate-mt700-lc-fields.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-474-validate-mt700-lc-fields.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MT700 LC Field Validator — attested computation

> §10.2 Attested Computation binding for [MT700 LC Field Validator](../tools/art-474-validate-mt700-lc-fields.md).

## Executor

Kernel source: `chaingraph/kernels/art-474-validate-mt700-lc-fields.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:bbd232c7a97741b408b0957f63f84669da0307d0b6c6f36e92c821d2ff568bf4` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
