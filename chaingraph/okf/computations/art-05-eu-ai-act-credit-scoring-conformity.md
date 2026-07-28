---
type: Attested Computation
title: "EU AI Act Credit-Scoring Conformity Pack — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the model_governance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-05-eu-ai-act-credit-scoring-conformity.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-05-eu-ai-act-credit-scoring-conformity.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# EU AI Act Credit-Scoring Conformity Pack — attested computation

> §10.2 Attested Computation binding for [EU AI Act Credit-Scoring Conformity Pack](../tools/art-05-eu-ai-act-credit-scoring-conformity.md).

## Executor

Kernel source: `chaingraph/kernels/art-05-eu-ai-act-credit-scoring-conformity.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:fcb93e8040bc73e15337abc8b67a8e70b03cd115900de0221cee4a2bf125136f` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
