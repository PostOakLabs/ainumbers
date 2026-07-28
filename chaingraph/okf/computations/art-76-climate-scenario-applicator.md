---
type: Attested Computation
title: "Climate Scenario Applicator (NGFS / Fit-for-55) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the model_governance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-76-climate-scenario-applicator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-76-climate-scenario-applicator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Climate Scenario Applicator (NGFS / Fit-for-55) — attested computation

> §10.2 Attested Computation binding for [Climate Scenario Applicator (NGFS / Fit-for-55)](../tools/art-76-climate-scenario-applicator.md).

## Executor

Kernel source: `chaingraph/kernels/art-76-climate-scenario-applicator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b93b7309081c0f6c2d2a5f3e8728d9d2cd11f4701cc936c42efc0d4d29c7809a` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
