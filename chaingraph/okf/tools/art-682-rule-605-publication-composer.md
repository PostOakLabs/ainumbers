---
type: DecisionTool
title: "Rule 605 Publication Composer"
description: "Rule 605 publication composer over caller-declared best-ex/669-shaped inputs: the effective-vs-quoted spread ratio (eq_ratio, 2dp half-up), the covered-order roll-up echoes (declared orders_covered and shares_covered), and a publication-row builder for declared categories. Declared-input discipline: covered orders, covered shares, and spread statistics are your declarations, never observations this kernel makes; no market data, tape, venue, or order-management system is read. PUBLICATION_ROWS_BUILT is a composition verdict, not an obligation assessment. Absent or invalid inputs fail closed and are named. No network, no storage, no clock."
resource: https://ainumbers.co/tools/682-rule-605-publication-composer.html
tags: ["regulatory_reporting", "wave-116", "mcp:compute_rule_605_publication_composer"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-682-rule-605-publication-composer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/682-rule-605-publication-composer.html
    title: "public tool page"
---

# Rule 605 Publication Composer

> Exports a decision via MCP `compute_rule_605_publication_composer` — mandate type `regulatory_reporting`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/682-rule-605-publication-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-682-rule-605-publication-composer.md) — §10.2.
