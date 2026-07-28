---
type: Attested Computation
title: "BIFSG Insurance Proxy Bias Threshold Test (Colorado SB 21-169) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-239-test-bifsg-bias-thresholds.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-239-test-bifsg-bias-thresholds.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# BIFSG Insurance Proxy Bias Threshold Test (Colorado SB 21-169) — attested computation

> §10.2 Attested Computation binding for [BIFSG Insurance Proxy Bias Threshold Test (Colorado SB 21-169)](../tools/art-239-test-bifsg-bias-thresholds.md).

## Executor

Kernel source: `chaingraph/kernels/art-239-test-bifsg-bias-thresholds.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:701d442f76691b38e5ab0fce5525b2d882260a259477651757e4f1cf0c4f9638` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
