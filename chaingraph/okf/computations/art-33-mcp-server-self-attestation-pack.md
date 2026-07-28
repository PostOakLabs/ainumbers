---
type: Attested Computation
title: "MCP Server Self-Attestation Pack — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the infrastructure_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-33-mcp-server-self-attestation-pack.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-33-mcp-server-self-attestation-pack.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MCP Server Self-Attestation Pack — attested computation

> §10.2 Attested Computation binding for [MCP Server Self-Attestation Pack](../tools/art-33-mcp-server-self-attestation-pack.md).

## Executor

Kernel source: `chaingraph/kernels/art-33-mcp-server-self-attestation-pack.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:0fa24d32f68661ef9900f03ddab76d94fc674c6cf4327d809bd7bd5d2451c316` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
