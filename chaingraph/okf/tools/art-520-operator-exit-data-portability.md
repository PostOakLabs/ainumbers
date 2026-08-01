---
type: DecisionTool
title: "Operator Exit & Data Portability"
description: "Evaluates a caller-declared operator-exit and data-portability posture: per data category, whether an export path exists and whether its format is open or proprietary, producing a stranded-category list rather than a coverage ratio. Checks declared operator- versus supplier-control of named components and flags a contractual-operator claim unsupported by that declared control, single-supplier dependencies with no declared substitute, escrow arrangements, and notice period / transition-assistance terms. Undeclared is a distinct, non-failing state from an explicit negative declaration throughout. Evaluates declarations only -- never a supplier audit, vendor rating, or enforceability opinion, and no output names or characterises a supplier. Region-portable: every fact is a caller-declared input, with no country, currency, scheme or supplier hardcoded. Deterministic arithmetic only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-520-operator-exit-data-portability.html
tags: ["attestation_mandate", "wave-80", "mcp:check_operator_exit_portability"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-520-operator-exit-data-portability.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-520-operator-exit-data-portability.html
    title: "public tool page"
---

# Operator Exit & Data Portability

> Exports a decision via MCP `check_operator_exit_portability` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-520-operator-exit-data-portability.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-520-operator-exit-data-portability.md) — §10.2.
