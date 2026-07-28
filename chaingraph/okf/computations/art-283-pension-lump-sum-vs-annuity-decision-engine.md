---
type: Attested Computation
title: "Pension Lump-Sum vs. Annuity Decision Engine — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-283-pension-lump-sum-vs-annuity-decision-engine.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-283-pension-lump-sum-vs-annuity-decision-engine.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Pension Lump-Sum vs. Annuity Decision Engine — attested computation

> §10.2 Attested Computation binding for [Pension Lump-Sum vs. Annuity Decision Engine](../tools/art-283-pension-lump-sum-vs-annuity-decision-engine.md).

## Executor

Kernel source: `chaingraph/kernels/art-283-pension-lump-sum-vs-annuity-decision-engine.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f6d1afb8e2ecf41c2176368c4f1383cba8b5ffe9cbfed4ac2b8f12760984e828` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
