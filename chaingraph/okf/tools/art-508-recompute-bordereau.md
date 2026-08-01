---
type: DecisionTool
title: "Delegated Authority Bordereau Recomputation"
description: "Recomputes a delegated authority bordereau the way the carrier reviewer does, from the same file the coverholder sent. It foots gross premium, brokerage, coverholder commission, mapped taxes and levies, ceded premium and net per currency, derives net from its components and compares that against a mapped net column, then compares the whole footing field by field against the totals the coverholder asserts. Exact agreement on a footing is a weak result and the tool says so, because both sides added the same column. The check that carries weight is utilisation of the binding authority: the aggregate and per risk limits are held by the carrier and are not on the bordereau, so they are declared caller inputs and are never derived from the document under review, which is what gives that comparison independent provenance. It also reports lines outside the declared period or permitted currency list, repeated policy references, absent expected periods and lines whose mapped fields are missing. Which of the supplied columns carries which measure is a caller declaration, as are the standard label and version, which are pinned into the artifact and shown on screen: no field list, schema, rate table or commission table is bundled or read, and nothing claims which revision of any standard is current, so a later revision makes an old receipt dated rather than wrong. The arithmetic reads only mapped numeric and reference columns. Every other column is ignored and reaches no result, and no rejection record echoes a cell value, so insured names, addresses and claim narratives stay out of the computed output. Money is fixed point in integer minor units with two decimal display throughout, decimal input is parsed from its string form rather than by floating point, and zero rows, an empty mapping and a zero limit each resolve to a defined result rather than to a not a number. Absent asserted totals the run is reported as recompute only, which is its own state and never a pass. Stated boundary: a difference means the two arithmetics disagree on the rows supplied, not that the coverholder misreported. It performs no data standard conformance validation, no terms of business or sanctions screening, no reserving or pricing adequacy assessment, and makes no assertion that authority was properly exercised, which is a conclusion for the delegated authority audit."
resource: https://ainumbers.co/chaingraph/art-508-recompute-bordereau.html
tags: ["analytics_mandate", "wave-78", "mcp:recompute_bordereau"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-508-recompute-bordereau.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-508-recompute-bordereau.html
    title: "public tool page"
---

# Delegated Authority Bordereau Recomputation

> Exports a decision via MCP `recompute_bordereau` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-508-recompute-bordereau.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-508-recompute-bordereau.md) — §10.2.
