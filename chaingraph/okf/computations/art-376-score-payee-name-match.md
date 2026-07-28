---
type: Attested Computation
title: "Payee Name-Match Score (VoP/CoP) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-376-score-payee-name-match.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-376-score-payee-name-match.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Payee Name-Match Score (VoP/CoP) — attested computation

> §10.2 Attested Computation binding for [Payee Name-Match Score (VoP/CoP)](../tools/art-376-score-payee-name-match.md).

## Executor

Kernel source: `chaingraph/kernels/art-376-score-payee-name-match.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:de422d2d169f590fa61cfe8f37060bd7af2944def5730c83f77b88c6ed538871` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
