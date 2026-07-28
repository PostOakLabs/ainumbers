---
type: Attested Computation
title: "Social Security Claiming-Age Optimizer — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-282-social-security-claiming-optimizer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-282-social-security-claiming-optimizer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Social Security Claiming-Age Optimizer — attested computation

> §10.2 Attested Computation binding for [Social Security Claiming-Age Optimizer](../tools/art-282-social-security-claiming-optimizer.md).

## Executor

Kernel source: `chaingraph/kernels/art-282-social-security-claiming-optimizer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:83b81f55de1dfe9bda0dc897482ce07935b420bc7f4b93f30ffd3e01d7ae7a35` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
