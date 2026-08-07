---
type: DecisionTool
title: "Proof-of-Reserves Verifier"
description: "Independently recomputes an exchange or custodian's published Proof-of-Reserves data: a single-leaf Merkle-sum inclusion path, a liability-side Merkle-sum branch aggregation, and a coverage ratio between the two recomputed sums, with an optional cross-check against a caller-declared published reserve figure. Emits a per-check finding (reserve_inclusion, liability_aggregation, coverage_ratio) plus an overall CONSISTENT, INCONSISTENT, or INDETERMINATE determination. Generic Merkle-sum schema only; named-exchange export formats are a documented field-mapping reference in the page copy, not a standing per-exchange adapter. Mirrors the shipped art-280 reserve-proof-verifier (single-leaf inclusion) and art-540 por-liabilities-composer (composes a caller-asserted liabilities total); this node independently recomputes both sides from raw Merkle-sum path data rather than composing a pre-verified boolean. CONSISTENT never implies solvency, audit assurance, or that the underlying published figures are truthful, only that what was published is internally consistent with itself."
resource: https://ainumbers.co/chaingraph/art-584-proof-of-reserves-verifier.html
tags: ["compliance_mandate", "wave-82", "mcp:verify_proof_of_reserves_consistency"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-584-proof-of-reserves-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-584-proof-of-reserves-verifier.html
    title: "public tool page"
---

# Proof-of-Reserves Verifier

> Exports a decision via MCP `verify_proof_of_reserves_consistency` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-584-proof-of-reserves-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-584-proof-of-reserves-verifier.md) — §10.2.
