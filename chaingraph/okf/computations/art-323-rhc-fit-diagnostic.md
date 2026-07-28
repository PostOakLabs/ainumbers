---
type: Attested Computation
title: "Robinhood Chain Fit Diagnostic — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the agent_guardrail_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-323-rhc-fit-diagnostic.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-323-rhc-fit-diagnostic.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# Robinhood Chain Fit Diagnostic — attested computation

> §10.2 Attested Computation binding for [Robinhood Chain Fit Diagnostic](../tools/art-323-rhc-fit-diagnostic.md).

## Executor

Kernel source: `chaingraph/kernels/art-323-rhc-fit-diagnostic.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:e09470ce920af00e8494502ae75b0a5986c163b2150f95ec58478d93c87e1a47` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
