---
type: Attested Computation
title: "MCP Server Identity Attestation Validator — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-147-mcp-server-identity-attestation-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-147-mcp-server-identity-attestation-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MCP Server Identity Attestation Validator — attested computation

> §10.2 Attested Computation binding for [MCP Server Identity Attestation Validator](../tools/art-147-mcp-server-identity-attestation-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-147-mcp-server-identity-attestation-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:53a835c4eb29c70aecbe5a595bc2d64466e1391b6c0fcf4a2be48f795a51f73d` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
