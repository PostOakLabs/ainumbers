---
type: Attested Computation
title: "NIS2 Governance Readiness Checker (Art. 20 — Management Body Accountability) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-146-nis2-governance-readiness-checker.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-146-nis2-governance-readiness-checker.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NIS2 Governance Readiness Checker (Art. 20 — Management Body Accountability) — attested computation

> §10.2 Attested Computation binding for [NIS2 Governance Readiness Checker (Art. 20 — Management Body Accountability)](../tools/art-146-nis2-governance-readiness-checker.md).

## Executor

Kernel source: `chaingraph/kernels/art-146-nis2-governance-readiness-checker.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:6492a6a83f4e5bbfcd5e1a759af227e26770c5c65a70fc8fe7028c150712f280` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
