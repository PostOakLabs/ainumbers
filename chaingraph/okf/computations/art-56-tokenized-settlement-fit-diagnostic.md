---
type: Attested Computation
title: "Wholesale Tokenized Settlement Fit Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the agent_guardrail_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-56-tokenized-settlement-fit-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-56-tokenized-settlement-fit-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Wholesale Tokenized Settlement Fit Diagnostic — attested computation

> §10.2 Attested Computation binding for [Wholesale Tokenized Settlement Fit Diagnostic](../tools/art-56-tokenized-settlement-fit-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/art-56-tokenized-settlement-fit-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:b52a79f937c901786a32dcae3e275f3e2a4bb308cb0fb844998c5cf1268da1ff` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
