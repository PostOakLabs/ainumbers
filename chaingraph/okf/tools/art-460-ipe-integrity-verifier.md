---
type: DecisionTool
title: "IPE Integrity Verifier"
description: "Verifies Information-Produced-by-Entity (IPE) completeness and accuracy for SOX 404 / ICFR control testing -- is this report extract what the source system actually produced. Reconciles a caller-declared source-extract hash, row count, and control total against the same facts for the report built from it, within a caller-set rounding tolerance. All facts are policy inputs; the kernel never re-derives the extract, only reconciles the declared parameters into a confirmed/exception verdict with a discrepancy list. Deterministic equality and tolerance checks only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-460-ipe-integrity-verifier.html
tags: ["compliance_control", "wave-74", "mcp:verify_ipe_integrity"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-460-ipe-integrity-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-460-ipe-integrity-verifier.html
    title: "public tool page"
---

# IPE Integrity Verifier

> Exports a decision via MCP `verify_ipe_integrity` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-460-ipe-integrity-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-460-ipe-integrity-verifier.md) — §10.2.
