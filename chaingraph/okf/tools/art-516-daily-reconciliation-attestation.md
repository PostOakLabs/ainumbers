---
type: DecisionTool
title: "Daily Reconciliation Attestation"
description: "Attests that a daily reconciliation duty was discharged over a caller-declared population, rather than computing the reconciliation match itself. Checks population completeness in both count and value (declared population vs matched+unmatched+partially-matched), ages open exceptions against a caller-declared tolerance, and diffs the current exception list against the prior period's carried-forward exception set to detect an exception that disappeared without a documented resolution. Where the prior-period exception set is not supplied at all, continuity is reported as unverifiable rather than falsely clean. Region-portable: every fact is a caller-declared input, with no country, currency, or scheme hardcoded. Deterministic arithmetic only. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-516-daily-reconciliation-attestation.html
tags: ["attestation_mandate", "wave-80", "mcp:attest_daily_reconciliation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-516-daily-reconciliation-attestation.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-516-daily-reconciliation-attestation.html
    title: "public tool page"
---

# Daily Reconciliation Attestation

> Exports a decision via MCP `attest_daily_reconciliation` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-516-daily-reconciliation-attestation.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-516-daily-reconciliation-attestation.md) — §10.2.
