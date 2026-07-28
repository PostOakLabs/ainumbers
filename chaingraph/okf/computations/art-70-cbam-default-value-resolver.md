---
type: Attested Computation
title: "CBAM Default-Value Resolver — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-70-cbam-default-value-resolver.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-70-cbam-default-value-resolver.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CBAM Default-Value Resolver — attested computation

> §10.2 Attested Computation binding for [CBAM Default-Value Resolver](../tools/art-70-cbam-default-value-resolver.md).

## Executor

Kernel source: `chaingraph/kernels/art-70-cbam-default-value-resolver.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:749508d39ecd4cd00b1a5edd8752b21cd96eabf325052c24702fe3b2124624a0` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
