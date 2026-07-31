---
type: Attested Computation
title: "AP2/MCP Policy Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the scheme_rule decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-17-ap2-mcp-policy-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-17-ap2-mcp-policy-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# AP2/MCP Policy Validator — attested computation

> §10.2 Attested Computation binding for [AP2/MCP Policy Validator](../tools/art-17-ap2-mcp-policy-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-17-ap2-mcp-policy-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:c8bd009b480838215fafa652ee90ae0e5439c003a08ca20fc0d5c97819232151` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
