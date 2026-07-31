---
type: Attested Computation
title: "MCP Developer Readiness Scorecard — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_control decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-18-mcp-developer-readiness-scorecard.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-18-mcp-developer-readiness-scorecard.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MCP Developer Readiness Scorecard — attested computation

> §10.2 Attested Computation binding for [MCP Developer Readiness Scorecard](../tools/art-18-mcp-developer-readiness-scorecard.md).

## Executor

Kernel source: `chaingraph/kernels/art-18-mcp-developer-readiness-scorecard.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c81916c6a7e22cfeeef2b25f1f7aabff7bdbe4b32867e558653e5324e016ab4c` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
