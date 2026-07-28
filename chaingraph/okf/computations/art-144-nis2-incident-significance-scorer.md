---
type: Attested Computation
title: "NIS2 Incident Significance Scorer (Art. 23 Reporting Threshold) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-144-nis2-incident-significance-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-144-nis2-incident-significance-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NIS2 Incident Significance Scorer (Art. 23 Reporting Threshold) — attested computation

> §10.2 Attested Computation binding for [NIS2 Incident Significance Scorer (Art. 23 Reporting Threshold)](../tools/art-144-nis2-incident-significance-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-144-nis2-incident-significance-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3cedfccda08a549a70693a65306d63f4593eb7be89533f956fd171400b76bfd2` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
