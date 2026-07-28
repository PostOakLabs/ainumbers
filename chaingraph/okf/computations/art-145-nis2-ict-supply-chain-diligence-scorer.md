---
type: Attested Computation
title: "NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-145-nis2-ict-supply-chain-diligence-scorer.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-145-nis2-ict-supply-chain-diligence-scorer.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA) — attested computation

> §10.2 Attested Computation binding for [NIS2 ICT Supply-Chain Diligence Scorer (Art. 21(2)(d) / ENISA)](../tools/art-145-nis2-ict-supply-chain-diligence-scorer.md).

## Executor

Kernel source: `chaingraph/kernels/art-145-nis2-ict-supply-chain-diligence-scorer.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:5568ba2aecf8ca9923d20122d22c9cfd8950d2e781ea7cc58041c885e3de85b4` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
