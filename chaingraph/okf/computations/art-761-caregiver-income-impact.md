---
type: Attested Computation
title: "Caregiver Income Impact & Lost Earnings Estimator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-761-caregiver-income-impact.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-761-caregiver-income-impact.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Caregiver Income Impact & Lost Earnings Estimator — attested computation

> §10.2 Attested Computation binding for [Caregiver Income Impact & Lost Earnings Estimator](../tools/art-761-caregiver-income-impact.md).

## Executor

Kernel source: `chaingraph/kernels/art-761-caregiver-income-impact.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3c16e24e31e72a555c95d70f83aa49d3ab203f17b706617b020df1491a5601ef` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
