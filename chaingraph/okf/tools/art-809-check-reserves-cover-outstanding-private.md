---
type: DecisionTool
title: "Private-Input Reserves Cover Outstanding Check"
description: "Pilot private-input predicate: 16 committed reserve slots, tagged by the eight GENIUS Act 4(a)(1)(A) categories, must cover the committed payment stablecoins outstanding. OCG section 25: inputs are sha256-salted@1 commitments, the receipt holds only the yes/no verdict. Integer only, no haircut, witness is 16 slots of 20 digits. Not proof reserves exist, are unencumbered, approved, or free of 4(a)(2) rehypothecation, nor the Act monthly report. Proof deferred; result is a preview, not a receipt."
resource: https://ainumbers.co/chaingraph/art-809-check-reserves-cover-outstanding-private.html
tags: ["compliance_control", "wave-142", "mcp:check_reserves_cover_private"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-809-check-reserves-cover-outstanding-private.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-809-check-reserves-cover-outstanding-private.html
    title: "public tool page"
---

# Private-Input Reserves Cover Outstanding Check

> Exports a decision via MCP `check_reserves_cover_private` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-809-check-reserves-cover-outstanding-private.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-809-check-reserves-cover-outstanding-private.md) — §10.2.
