---
type: Attested Computation
title: "MCP Authorization Metadata Validator (RFC 9728) — attested computation"
runtime: server
computation: "Kernel-backed evaluation for the compliance_mandate decision, producing a hash-anchored OpenChainGraph artifact."
executor:
  resource: https://ainumbers.co/chaingraph/kernels/art-148-mcp-authorization-metadata-validator.kernel.mjs
  receipt: ["type", "system", "receiptFormat", "imageId", "seal", "journal"]
attester:
  resource: https://ainumbers.co/chaingraph/graph/nodes/art-148-mcp-authorization-metadata-validator.json#compute_images
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
---

# MCP Authorization Metadata Validator (RFC 9728) — attested computation

> §10.2 Attested Computation binding for [MCP Authorization Metadata Validator (RFC 9728)](../tools/art-148-mcp-authorization-metadata-validator.md).

## Executor

Kernel source: `chaingraph/kernels/art-148-mcp-authorization-metadata-validator.kernel.mjs`. A §18 zkVM compute-integrity
proof, when attached to an artifact this kernel produced, carries these receipt fields:
`type`, `system`, `receiptFormat`, `imageId`, `seal`, `journal` (SPEC.md §18.0).

## Attester

Kernel identity: `sha256:3165d9c916ead557ee007631e3a0dd32f84782a04aa5df796c776d31c963bd8b` (SPEC.md §17.1 `compute_images`) — a
content-addressed digest of this node's deployed kernel source, already published in the
Graph Index. Static and dereferenceable; nothing in OpenChainGraph verification depends on
this OKF bundle, and this concept asserts no execution event or `verified:` status.
