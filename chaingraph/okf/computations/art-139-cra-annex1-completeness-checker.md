---
type: Attested Computation
title: "CRA Annex I Completeness Checker — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-139-cra-annex1-completeness-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-139-cra-annex1-completeness-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# CRA Annex I Completeness Checker — attested computation

> §10.2 Attested Computation binding for [CRA Annex I Completeness Checker](../tools/art-139-cra-annex1-completeness-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-139-cra-annex1-completeness-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:8d0924a6bc66cc3c3c6e9211692dd759285b3c07143163946ef596a4b48c6235` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
