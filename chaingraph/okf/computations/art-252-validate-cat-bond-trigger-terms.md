---
type: Attested Computation
title: "Cat Bond Trigger Terms Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-252-validate-cat-bond-trigger-terms.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-252-validate-cat-bond-trigger-terms.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Cat Bond Trigger Terms Validator — attested computation

> §10.2 Attested Computation binding for [Cat Bond Trigger Terms Validator](../tools/art-252-validate-cat-bond-trigger-terms.md).

## Executor

Kernel source: `chaingraph/kernels/art-252-validate-cat-bond-trigger-terms.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:2d69f187e9c32ff8b2bcd4346e912a0546f39bd91839fd9b301e67c13e36a438` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
