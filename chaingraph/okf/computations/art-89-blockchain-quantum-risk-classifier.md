---
type: Attested Computation
title: "Blockchain / Stablecoin Quantum-Risk Classifier — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the model_governance decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-89-blockchain-quantum-risk-classifier.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-89-blockchain-quantum-risk-classifier.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Blockchain / Stablecoin Quantum-Risk Classifier — attested computation

> §10.2 Attested Computation binding for [Blockchain / Stablecoin Quantum-Risk Classifier](../tools/art-89-blockchain-quantum-risk-classifier.md).

## Executor

Kernel source: `chaingraph/kernels/art-89-blockchain-quantum-risk-classifier.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:f075b3e27027e3b2ac21bd47aab935f60e01cef5e8892de2fcac74de6def21ea` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
