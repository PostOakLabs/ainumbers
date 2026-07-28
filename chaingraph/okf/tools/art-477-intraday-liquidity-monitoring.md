---
type: DecisionTool
title: "BCBS 248 Intraday Liquidity Monitoring Snapshot"
description: "BCBS 248 \"Monitoring tools for intraday liquidity management\" (Basel Committee, April 2013): computes daily maximum intraday liquidity usage (the largest negative excursion of a cumulative net settlement position built from a caller-supplied time-stamped transaction list), echoes start-of-day available liquidity, totals gross payments and receipts, checks time-specific obligations against their due times, and classifies the daily maximum usage against a caller-supplied list of available intraday liquidity sources. Not DW capacity (art-427) or FR 2052a inflow/outflow classification (art-437) -- adjacent but distinct BCBS 248 daily-usage metrics. Evidence artifact only, not a filing or supervisory submission."
resource: https://ainumbers.co/chaingraph/art-477-intraday-liquidity-monitoring.html
tags: ["compliance_mandate", "wave-71", "mcp:compute_intraday_liquidity_monitoring"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-477-intraday-liquidity-monitoring.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-477-intraday-liquidity-monitoring.html
    title: "public tool page"
---

# BCBS 248 Intraday Liquidity Monitoring Snapshot

> Exports a decision via MCP `compute_intraday_liquidity_monitoring` — mandate type `compliance_mandate`.

**Context:** BCBS 248 (April 2013): supervisory expectation, no statutory filing deadline -- monitoring tools are reported to supervisors on request/periodic schedule set by the home regulator.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-477-intraday-liquidity-monitoring.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-477-intraday-liquidity-monitoring.md) — §10.2.
