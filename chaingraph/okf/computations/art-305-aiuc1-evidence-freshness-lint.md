---
type: Attested Computation
title: "AIUC-1 Evidence Freshness Lint — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-305-aiuc1-evidence-freshness-lint.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-305-aiuc1-evidence-freshness-lint.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AIUC-1 Evidence Freshness Lint — attested computation

> §10.2 Attested Computation binding for [AIUC-1 Evidence Freshness Lint](../tools/art-305-aiuc1-evidence-freshness-lint.md).

## Executor

Kernel source: `chaingraph/kernels/art-305-aiuc1-evidence-freshness-lint.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8dbc646bb29e68a985eb5fdcf053ed106137917d9b89dd4ec179f792589bf9cf` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
