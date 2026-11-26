---
type: DecisionTool
title: "Caregiver Income Impact & Lost Earnings Estimator"
description: "Financial cost of unpaid caregiving: direct income loss during the care period, the retirement savings gap from missed 401(k) contributions plus their lost compounding, the cumulative cost of a post-care career setback, and a flagged Social Security reduction estimate, in integer USD cents. The SSA contribution and benefit base and the SSA average annual benefit are selected from a pinned vintage table by an explicit as_of date (the node reads no clock). Ported from ApexLogics display_number #117 (117-caregiver-income-impact, al_id AL-124, CC BY 4.0); DIFFERS-D1..D5 in the porting payload, three modelling constants UNGROUNDED."
resource: https://ainumbers.co/chaingraph/art-761-caregiver-income-impact.html
tags: ["compliance_mandate", "wave-133", "mcp:caregiver_income_impact"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-761-caregiver-income-impact.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-761-caregiver-income-impact.html
    title: "public tool page"
---

# Caregiver Income Impact & Lost Earnings Estimator

> Exports a decision via MCP `caregiver_income_impact` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-761-caregiver-income-impact.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-761-caregiver-income-impact.md) — §10.2.
