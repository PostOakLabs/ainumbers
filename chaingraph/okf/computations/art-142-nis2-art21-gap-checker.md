---
type: Attested Computation
title: "NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-142-nis2-art21-gap-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-142-nis2-art21-gap-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures) — attested computation

> §10.2 Attested Computation binding for [NIS2 Article 21 Gap Checker (Ten Cybersecurity Risk-Management Measures)](../tools/art-142-nis2-art21-gap-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-142-nis2-art21-gap-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:1e2ae5da118e19c5c3b8960fcc173a82582f8ecc9952ef30fb521b8d5e0a16b7` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
